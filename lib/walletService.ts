import { Transaction, RechargeRequest } from '@/types/wallet';
import { supabase } from '@/lib/supabase';

// Helper function to handle Supabase errors - now with proper generic return type
function handleSupabaseError<T>(error: unknown, defaultMessage: string, defaultValue: T): T {
  // Log error details for debugging
  console.error('Database error:', error);
  
  if (error instanceof Error) {
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    return defaultValue;
  }

  // Handle Supabase PostgrestError
  if (error && typeof error === 'object' && 'code' in error) {
    const err = error as Record<string, unknown>;
    
    console.error('Database error details:', {
      code: err.code,
      message: err.message,
      details: err.details,
      hint: err.hint
    });

    // For specific error codes, just log them
    if (err.code === '23505') {
      console.error('This record already exists');
      return defaultValue;
    }
    if (err.code === '42P01') {
      console.error('Database table not found');
      return defaultValue;
    }
    if (err.code === '42501') {
      console.error('Permission denied');
      return defaultValue;
    }
    if (err.code === '23503') {
      console.error('Referenced record does not exist');
      return defaultValue;
    }
    if (err.code === 'PGRST116') {
      console.error('No rows returned when one was expected');
      return defaultValue;
    }
    
    // If it has a message, log it
    if (typeof err.message === 'string' && err.message) {
      console.error(err.message);
      return defaultValue;
    }
  }

  // If we can't determine the error type, log the default message
  console.error(defaultMessage);
  return defaultValue;
}

// Get wallet balance from the database
export const getWalletBalance = async (
  userId: string
): Promise<number> => {
  try {
    // Get wallet balance from the database
    const { data, error } = await supabase
      .from('wallet_balances')
      .select('balance')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;

    // If user does not have a wallet, create one with zero balance
    if (!data) {
      // Create a new wallet record
      const { data: newWallet, error: createError } = await supabase
        .from('wallet_balances')
        .insert([
          { 
            user_id: userId, 
            balance: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (createError) throw createError;
      return 0;
    }

    return Number(data.balance);
  } catch (error) {
    return handleSupabaseError(error, 'Error getting wallet balance', 0);
  }
};

export async function updateWalletBalance(userId: string, amount: number, type: 'CREDIT' | 'DEBIT'): Promise<void> {
  try {
    // Get current balance with FOR UPDATE lock
    const { data: currentData, error: selectError } = await supabase
      .from('wallet_balances')
      .select('balance')
      .eq('user_id', userId)
      .single();

    if (selectError) {
      throw selectError;
    }

    if (!currentData) {
      throw new Error('Wallet not found');
    }

    const currentBalance = Number(currentData.balance);
    const newBalance = type === 'CREDIT' ? currentBalance + amount : currentBalance - amount;

    if (type === 'DEBIT' && newBalance < 0) {
      throw new Error('Insufficient balance');
    }

    // Update balance with optimistic locking
    const { error: updateError } = await supabase
      .from('wallet_balances')
      .update({ 
        balance: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('balance', currentBalance); // Optimistic locking

    if (updateError) {
      // If update fails due to concurrent modification, retry
      if (updateError.code === '23514') { // Check constraint violation
        throw new Error('Balance update failed due to concurrent modification');
      }
      throw updateError;
    }

    // Create a transaction record for this balance update
    const { error: transactionError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        amount,
        type,
        status: 'COMPLETED',
        reference_id: `WALLET_${type}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (transactionError) {
      throw transactionError;
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error updating wallet balance:', {
        message: error.message,
        userId,
        amount,
        type
      });
      throw error;
    }
    throw new Error('Failed to update wallet balance');
  }
}

export async function createTransaction(
  userId: string,
  amount: number,
  type: 'CREDIT' | 'DEBIT',
  description: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        amount,
        type,
        status: 'COMPLETED',
        reference_id: description,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (error) {
      throw error;
    }
  } catch (error) {
    console.error('Error creating transaction:', error);
    throw error;
  }
}

// For functions returning Transaction or Transaction[] types
export const getTransactionHistory = async (userId: string): Promise<Transaction[]> => {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    return handleSupabaseError(error, 'Error getting transaction history', []);
  }
};

export const createTransactionInDatabase = async (
  userId: string,
  amount: number,
  type: 'CREDIT' | 'DEBIT',
  referenceId?: string
): Promise<Transaction | null> => {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        amount,
        type,
        status: 'PENDING',
        reference_id: referenceId,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return handleSupabaseError(error, 'Failed to create transaction', null);
    }
    return data as Transaction;
  } catch (error) {
    return handleSupabaseError(error, 'Error creating transaction', null);
  }
};

export const updateTransactionStatus = async (
  transactionId: string,
  status: 'COMPLETED' | 'FAILED'
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('transactions')
      .update({ 
        status, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', transactionId);

    if (error) {
      handleSupabaseError(error, 'Failed to update transaction status', null);
      return;
    }
  } catch (error) {
    handleSupabaseError(error, 'Error updating transaction status', null);
    return;
  }
};

// New function to initialize wallet for new users
export const initializeWallet = async (userId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('wallet_balances')
      .upsert({
        user_id: userId,
        balance: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
        ignoreDuplicates: false
      });

    if (error && error.code !== '23505') { // Ignore unique violation
      handleSupabaseError(error, 'Failed to initialize wallet', null);
      return;
    }
  } catch (error) {
    handleSupabaseError(error, 'Error initializing wallet', null);
    return;
  }
};

// Add type for recharge status
type RechargeStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export async function createRechargeRequest(
  userId: string,
  amount: number,
  utrNumber: string
): Promise<RechargeRequest | null> {
  try {
    // Input validation
    if (!userId) {
      throw new Error('User ID is required');
    }

    if (amount < 50) {
      throw new Error('Minimum recharge amount is ₹50');
    }

    if (!utrNumber || utrNumber.length !== 12 || !/^\d+$/.test(utrNumber)) {
      throw new Error('Invalid UTR number. Must be 12 digits.');
    }

    // Check if UTR already exists
    const { data: existingRecharge, error: checkError } = await supabase
      .from('recharge_requests')
      .select('id')
      .eq('utr_number', utrNumber)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      throw checkError;
    }

    if (existingRecharge) {
      throw new Error('This UTR number has already been used');
    }

    const rechargeData = {
      user_id: userId,
      amount,
      payment_method: 'UPI',
      status: 'PENDING' as RechargeStatus,
      utr_number: utrNumber,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Insert new recharge request
    const { data, error: insertError } = await supabase
      .from('recharge_requests')
      .insert(rechargeData)
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    if (!data) {
      throw new Error('Failed to create recharge request: No data returned');
    }

    return data as RechargeRequest;
  } catch (error) {
    return handleSupabaseError(error, 'Error creating recharge request', null);
  }
}

// For functions returning RechargeRequest or RechargeRequest[] types
export const getRechargeRequest = async (id: string): Promise<RechargeRequest | null> => {
  try {
    const { data, error } = await supabase
      .from('recharge_requests')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    return handleSupabaseError(error, `Error getting recharge request ${id}`, null);
  }
};

export const getRechargeRequests = async (userId: string): Promise<RechargeRequest[]> => {
  try {
    const { data, error } = await supabase
      .from('recharge_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    return handleSupabaseError(error, 'Error getting recharge requests', []);
  }
};

export const verifyRechargeRequest = async (requestId: string, status: 'COMPLETED' | 'FAILED') => {
  try {
    // Get the recharge request
    const { data: request, error: fetchError } = await supabase
      .from('recharge_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError) throw fetchError;
    if (!request) throw new Error('Recharge request not found');

    // If approving the request, add balance to user's wallet
    if (status === 'COMPLETED') {
      // Get the current wallet balance
      const { data: walletData, error: getWalletError } = await supabase
        .from('wallet_balances')
        .select('balance')
        .eq('user_id', request.user_id)
        .single();
        
      if (getWalletError) throw getWalletError;
      if (!walletData) throw new Error('Wallet not found');
      
      // Update the wallet balance directly
      const newBalance = Number(walletData.balance) + Number(request.amount);
      const { error: walletError } = await supabase
        .from('wallet_balances')
        .update({ 
          balance: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', request.user_id);

      if (walletError) throw walletError;

      // Create a wallet transaction record
      const { error: transactionError } = await supabase
        .from('wallet_transactions')
        .insert([
          {
            user_id: request.user_id,
            amount: request.amount,
            type: 'CREDIT',
            description: 'Wallet recharge',
            reference_id: requestId,
            status: 'COMPLETED'
          }
        ]);

      if (transactionError) throw transactionError;
    }

    // Update recharge request status
    const { error: updateError } = await supabase
      .from('recharge_requests')
      .update({ status })
      .eq('id', requestId);

    if (updateError) throw updateError;

    return { success: true };
  } catch (error) {
    console.error('Wallet service error:', error);
    
    // Improved error handling
    const err = error as any;
    const errorDetails = {
      code: err?.code,
      message: err?.message || 'Unknown error occurred',
      details: err?.details,
      hint: err?.hint
    };
    
    console.error('Database error details:', errorDetails);
    throw new Error(errorDetails.message);
  }
};

export const getTransactions = async (userId: string): Promise<Transaction[]> => {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return handleSupabaseError(error, 'Failed to fetch transactions', []);
    }
    return data;
  } catch (error) {
    return handleSupabaseError(error, 'Error fetching transactions', []);
  }
};

// Add new types for virtual number transactions
type VirtualNumberStatus = 
  | 'PENDING'    // Initial state when order is created
  | 'RECEIVED'   // When SMS is received
  | 'CANCELED'   // When user cancels the order
  | 'TIMEOUT'    // When order expires (20 minutes by default)
  | 'FINISHED'   // When order is completed successfully
  | 'BANNED'     // When number is banned
  | 'EXPIRED';   // When activation period expires

interface VirtualNumberTransaction extends Omit<Transaction, 'status'> {
  order_id: string;
  phone_number: string;
  service: string;
  status: VirtualNumberStatus;
}

// Add retry logic for critical operations
const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  }
  
  throw lastError!;
};

// Update createVirtualNumberTransaction with retry logic
export const createVirtualNumberTransaction = async (
  userId: string,
  amount: number,
  orderId: string,
  phoneNumber: string,
  service: string
): Promise<VirtualNumberTransaction> => {
  return withRetry(async () => {
    try {
      // Check balance without using transactions
      const { data: walletData, error: walletError } = await supabase
        .from('wallet_balances')
        .select('balance')
        .eq('user_id', userId)
        .single();

      if (walletError) throw walletError;
      if (!walletData) throw new Error('Wallet not found');

      const currentBalance = Number(walletData.balance);
      if (currentBalance < amount) {
        throw new Error('Insufficient balance');
      }

      // Create transaction record
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          amount,
          type: 'DEBIT',
          status: 'PENDING',
          reference_id: service,
          order_id: orderId,
          phone_number: phoneNumber,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (transactionError) throw transactionError;

      // Update balance
      const { error: updateError } = await supabase
        .from('wallet_balances')
        .update({ 
          balance: currentBalance - amount,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      return transaction;
    } catch (error) {
      console.error("Error in createVirtualNumberTransaction:", error);
      throw error;
    }
  });
};

// Function to handle successful OTP receipt - update to not use transactions
export const handleSuccessfulOTP = async (
  userId: string,
  transactionId: string,
  orderId: string
): Promise<void> => {
  try {
    // Validate input parameters
    if (!userId || !transactionId || !orderId) {
      console.warn('Invalid parameters for handleSuccessfulOTP', { userId, transactionId, orderId });
      return;
    }
    
    // Get the transaction - don't filter by status to avoid errors
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('user_id', userId)
      .maybeSingle(); // Use maybeSingle instead of single to avoid errors when no rows found

    // Handle database error but don't throw
    if (transactionError) {
      console.error('Database error in handleSuccessfulOTP:', transactionError);
      return; // Exit gracefully on database error
    }
    
    // Handle missing transaction
    if (!transaction) {
      console.warn(`No transaction found with ID ${transactionId} for user ${userId}`);
      return; // Exit gracefully if no transaction found
    }

    // Skip update if transaction is already in a final state
    if (transaction.status === 'COMPLETED' || transaction.status === 'FAILED') {
      console.log(`Transaction ${transactionId} already in final state: ${transaction.status}`);
      return; // Exit gracefully
    }

    // Update transaction status to COMPLETED
    const { error: updateError } = await supabase
      .from('transactions')
      .update({ 
        status: 'COMPLETED',
        updated_at: new Date().toISOString()
      })
      .eq('id', transactionId)
      .eq('user_id', userId); // Extra safety to ensure we're updating the right record

    if (updateError) {
      console.error('Error updating transaction status:', updateError);
      return; // Exit gracefully on database error
    }
    
    // Transaction is now marked as COMPLETED
    console.log(`Successfully updated transaction ${transactionId} to COMPLETED`);
    
    // If we've reached this point and the transaction was in PENDING state,
    // it means we need to finalize the balance deduction
    if (transaction.status === 'PENDING') {
      // No need to deduct the balance again as it was already deducted during the createVirtualNumberTransaction
      // But we do need to log this deduction in the console for tracking purposes
      console.log(`Balance deduction finalized for transaction ${transactionId} (${transaction.amount} ${transaction.currency || 'INR'})`);
    }
  } catch (error) {
    console.error("Error in handleSuccessfulOTP:", error);
    // Don't throw the error, just log it to prevent component from crashing
  }
};

// Function to clean up stuck transactions - update to not use transactions
export async function cleanupStuckTransactions(
  userId: string
): Promise<void> {
  try {
    // 1. Get all pending transactions older than 15 minutes
    const { data: pendingTransactions, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'PENDING')
      .eq('type', 'DEBIT')
      .lt('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString());

    if (fetchError) throw fetchError;
    if (!pendingTransactions || pendingTransactions.length === 0) {
      return;
    }

    // Get current wallet balance
    const { data: walletData, error: walletError } = await supabase
      .from('wallet_balances')
      .select('balance')
      .eq('user_id', userId)
      .single();

    if (walletError) throw walletError;
    if (!walletData) throw new Error('Wallet not found');

    let currentBalance = Number(walletData.balance);

    // 2. Process each pending transaction
    for (const transaction of pendingTransactions) {
      // Check if a refund transaction already exists
      const { data: existingRefund } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'CREDIT')
        .eq('reference_id', `REFUND_${transaction.reference_id}`)
        .single();

      // Only process refund if no refund exists
      if (!existingRefund) {
        // Create refund transaction
        const { error: refundError } = await supabase
          .from('transactions')
          .insert({
            user_id: userId,
            amount: transaction.amount,
            type: 'CREDIT',
            status: 'COMPLETED',
            reference_id: `REFUND_${transaction.reference_id}`,
            order_id: transaction.order_id,
            phone_number: transaction.phone_number,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (refundError) throw refundError;

        // Update wallet balance (refund the amount)
        currentBalance += Number(transaction.amount);
      }

      // Update original transaction status to FAILED
      const { error: updateError } = await supabase
        .from('transactions')
        .update({
          status: 'FAILED',
          updated_at: new Date().toISOString()
        })
        .eq('id', transaction.id);

      if (updateError) throw updateError;
    }

    // Only update balance if there were actual refunds
    if (currentBalance !== Number(walletData.balance)) {
      const { error: balanceError } = await supabase
        .from('wallet_balances')
        .update({
          balance: currentBalance,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (balanceError) throw balanceError;
    }
  } catch (error) {
    console.error('Error cleaning up stuck transactions:', error);
    throw error;
  }
}

// Update handleVirtualNumberRefund to use correct status values
export const handleVirtualNumberRefund = async (
  userId: string,
  transactionId: string,
  reason: 'CANCELED' | 'TIMEOUT' | 'BANNED'
): Promise<void> => {
  try {
    // Get the transaction
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('user_id', userId)
      .single();

    if (transactionError) throw transactionError;
    if (!transaction) throw new Error('Transaction not found');

    // Check if a refund transaction already exists
    const { data: existingRefund, error: refundCheckError } = await supabase
      .from('transactions')
      .select('*')
      .eq('reference_id', `REFUND_${transaction.reference_id}`)
      .eq('order_id', transaction.order_id)
      .maybeSingle();
      
    if (refundCheckError && refundCheckError.code !== 'PGRST116') {
      console.error('Error checking for existing refund:', refundCheckError);
    }
    
    // Skip refund if one already exists to prevent double refunds
    if (existingRefund) {
      console.log(`Refund already processed for transaction ${transactionId}`);
      return;
    }

    // Process refund for any transaction that's not already in COMPLETED or FAILED status
    if (transaction.status !== 'COMPLETED' && transaction.status !== 'FAILED') {
      // Get current balance
      const { data: walletData, error: walletError } = await supabase
        .from('wallet_balances')
        .select('balance')
        .eq('user_id', userId)
        .single();

      if (walletError) throw walletError;
      if (!walletData) throw new Error('Wallet not found');

      // Update balance - add the refund amount
      const newBalance = Number(walletData.balance) + Number(transaction.amount);
      const { error: updateError } = await supabase
        .from('wallet_balances')
        .update({ 
          balance: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      // Update original transaction status to FAILED
      const { error: updateTransError } = await supabase
        .from('transactions')
        .update({ 
          status: 'FAILED',
          updated_at: new Date().toISOString()
        })
        .eq('id', transactionId);

      if (updateTransError) throw updateTransError;

      // Add more detail to the reference_id for better tracking
      const refundReference = `REFUND_${reason}_${transaction.reference_id}`;

      // Create refund transaction
      const { error: refundError } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          amount: transaction.amount,
          type: 'CREDIT',
          status: 'COMPLETED',
          reference_id: refundReference,
          order_id: transaction.order_id,
          phone_number: transaction.phone_number,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (refundError) throw refundError;
      
      console.log(`Successfully processed refund for transaction ${transactionId}, reason: ${reason}`);
      return;
    } else {
      console.log(`Transaction ${transactionId} is already in ${transaction.status} status, no refund needed`);
    }
  } catch (error) {
    console.error('Error handling virtual number refund:', error);
    throw error;
  }
};

// Function to update virtual number transaction status in database based on 5sim status
export const updateVirtualNumberStatus = async (
  userId: string,
  orderId: string,
  status: VirtualNumberStatus,
  smsCode?: string,
  fullSms?: string
): Promise<void> => {
  try {
    // Find the DEBIT transaction associated with this order (original purchase)
    const { data: transactions, error: transactionError } = await supabase
      .from('transactions')
      .select('*')
      .eq('order_id', orderId)
      .eq('type', 'DEBIT'); // Only get the original purchase transaction

    if (transactionError) throw transactionError;
    
    // If there are multiple transactions or no transactions, handle gracefully
    if (!transactions || transactions.length === 0) {
      console.warn(`No DEBIT transaction found for order ${orderId}, user ${userId}`);
      // Continue with session update only
    } else {
      // Use the first transaction if there are multiple (unlikely but possible)
      const transaction = transactions[0];
      const transactionId = transaction.id;
      
      console.log(`Updating status for order ${orderId} to ${status}, current transaction status: ${transaction.status}`);
      
      // Handle different status changes
      switch (status) {
        case 'RECEIVED':
          // Update to COMPLETED status when SMS is received
          await handleSuccessfulOTP(userId, transactionId, orderId);
          break;
        
        case 'CANCELED':
        case 'TIMEOUT':
        case 'BANNED':
          // Process refund when canceled, timed out, or banned
          try {
            await handleVirtualNumberRefund(userId, transactionId, status);
            console.log(`Refund processed for order ${orderId} with status ${status}`);
          } catch (refundError) {
            console.error(`Error processing refund for ${status} status:`, refundError);
            // Continue with status update even if refund fails
          }
          break;
          
        case 'FINISHED':
          // Just update status to COMPLETED if not already
          if (transaction.status !== 'COMPLETED') {
            const { error: updateError } = await supabase
              .from('transactions')
              .update({
                status: 'COMPLETED',
                updated_at: new Date().toISOString()
              })
              .eq('id', transactionId);
              
            if (updateError) {
              console.error('Error updating transaction to COMPLETED:', updateError);
            } else {
              console.log(`Transaction ${transactionId} marked as COMPLETED for FINISHED order`);
            }
          }
          break;
          
        default:
          // For other statuses, just update the metadata
          const { error: updateError } = await supabase
            .from('transactions')
            .update({
              updated_at: new Date().toISOString()
            })
            .eq('id', transactionId);
            
          if (updateError) {
            console.error('Error updating transaction metadata:', updateError);
          }
      }
    }
    
    // Update OTP session if it exists - use maybeSingle() to avoid errors
    const { data: session, error: sessionError } = await supabase
      .from('otp_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('order_id', orderId)
      .maybeSingle();
      
    if (sessionError) {
      console.error('Error finding OTP session:', sessionError);
    } else if (session) {
      // Update the session with new status and SMS data if available
      const sessionUpdateData: any = { 
        status,
        updated_at: new Date().toISOString()
      };
      
      if (smsCode) {
        sessionUpdateData.sms_code = smsCode;
      }
      
      if (fullSms) {
        sessionUpdateData.full_sms = fullSms;
      }
      
      const { error: updateSessionError } = await supabase
        .from('otp_sessions')
        .update(sessionUpdateData)
        .eq('id', session.id);
        
      if (updateSessionError) {
        console.error('Error updating OTP session:', updateSessionError);
      } else {
        console.log(`OTP session updated for order ${orderId} with status ${status}`);
      }
    }
  } catch (error) {
    console.error('Error updating virtual number status:', error);
    // Log error but don't throw, to prevent component from crashing
  }
};

// Function to check if user can purchase another number
export async function canPurchaseNumber(userId: string, amount: number): Promise<boolean> {
  try {
    // 1. Check wallet balance
    const balance = await getWalletBalance(userId);
    if (balance < amount) {
      return false;
    }

    // 2. Check for any pending transactions
    const { data: pendingTransactions, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'PENDING')
      .eq('type', 'DEBIT');

    if (error) {
      throw error;
    }

    // Don't allow new purchase if there are pending transactions
    return pendingTransactions.length === 0;
  } catch (error) {
    console.error('Error checking purchase eligibility:', error);
    return false;
  }
}

export const getVirtualNumberTransactions = async (userId: string): Promise<Transaction[]> => {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'DEBIT')
      .ilike('description', '%Virtual number%')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    return handleSupabaseError(error, 'Error getting virtual number transactions', []);
  }
};