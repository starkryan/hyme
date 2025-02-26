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

// Add WalletBalance type definition
export interface WalletBalance {
  userId: string;
  balance: number;
  created_at: string;
  updated_at: string;
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

// Enhanced version that also cleans up stuck transactions
export const getUserBalance = async (userId: string): Promise<WalletBalance | null> => {
  try {
    // Check for stuck transactions first
    try {
      await cleanupStuckTransactions(userId);
    } catch (cleanupError) {
      console.error("Error cleaning up stuck transactions:", cleanupError);
      // Continue even if cleanup fails - don't prevent the user from seeing their balance
    }

    // Then get the updated balance
    const { data, error } = await supabase
      .from('wallet_balances')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No wallet found, initialize one with zero balance
        await initializeWallet(userId);
        return { userId, balance: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      }
      return handleSupabaseError(error, 'Failed to get wallet balance', null);
    }
    return data;
  } catch (error) {
    return handleSupabaseError(error, 'Error getting wallet balance', null);
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
    console.log(`Starting cleanup of stuck transactions for user ${userId}`);
    
    // 1. Get all pending transactions older than 15 minutes
    const { data: pendingTransactions, error: fetchError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'PENDING')
      .eq('type', 'DEBIT')
      .lt('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString());

    if (fetchError) {
      console.error('Error fetching pending transactions:', fetchError);
      throw fetchError;
    }
    
    console.log(`Found ${pendingTransactions?.length || 0} pending transactions older than 15 minutes`);
    
    if (!pendingTransactions || pendingTransactions.length === 0) {
      console.log('No stuck transactions found, checking for completed transactions with no refunds');
      
      // Also check for completed transactions with service names that might be canceled
      const { data: completedTransactions, error: completedError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'COMPLETED')
        .eq('type', 'DEBIT')
        .lt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Older than 1 hour
        .limit(10);
        
      if (completedError) {
        console.error('Error fetching completed transactions:', completedError);
      } else if (completedTransactions && completedTransactions.length > 0) {
        console.log(`Found ${completedTransactions.length} completed transactions to check for refunds`);
        
        // For each completed transaction, check if there's a corresponding refund
        for (const transaction of completedTransactions) {
          try {
            // Check if there's a corresponding refund transaction
            const { data: refunds, error: refundError } = await supabase
              .from('transactions')
              .select('*')
              .eq('user_id', userId)
              .eq('type', 'CREDIT')
              .eq('order_id', transaction.order_id)
              .ilike('reference_id', '%REFUND%');
              
            if (refundError) {
              console.error(`Error checking refunds for transaction ${transaction.id}:`, refundError);
              continue;
            }
            
            if (!refunds || refunds.length === 0) {
              console.log(`No refund found for completed transaction ${transaction.id}, checking order status`);
              
              // Try to check the order status to see if it needs a refund
              try {
                if (transaction.order_id) {
                  // Make an API call to check the current status of this order
                  // This is optional if you have a way to check the 5sim order status
                  // If not, you can skip this part
                  
                  // If the order is found to be CANCELED, BANNED, or TIMEOUT, process a refund
                  console.log(`Will create a refund for transaction ${transaction.id} with order ${transaction.order_id}`);
                }
              } catch (orderCheckError) {
                console.error(`Error checking order status for transaction ${transaction.id}:`, orderCheckError);
              }
            } else {
              console.log(`Found ${refunds.length} refunds for transaction ${transaction.id}, no action needed`);
            }
          } catch (transactionError) {
            console.error(`Error processing completed transaction ${transaction.id}:`, transactionError);
          }
        }
      }
      
      return;
    }

    // Get current wallet balance
    const { data: walletData, error: walletError } = await supabase
      .from('wallet_balances')
      .select('balance')
      .eq('user_id', userId)
      .single();

    if (walletError) {
      console.error('Error fetching wallet balance:', walletError);
      throw walletError;
    }
    if (!walletData) {
      console.error(`No wallet found for user ${userId}`);
      throw new Error('Wallet not found');
    }

    let currentBalance = Number(walletData.balance);
    console.log(`Current wallet balance: ${currentBalance}`);
    let refundsProcessed = 0;

    // 2. Process each pending transaction
    for (const transaction of pendingTransactions) {
      console.log(`Processing stuck transaction ${transaction.id} for order ${transaction.order_id}`);
      try {
        // Check if a refund transaction already exists
        const { data: existingRefunds, error: refundCheckError } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', userId)
          .eq('type', 'CREDIT')
          .eq('order_id', transaction.order_id)
          .ilike('reference_id', '%REFUND%');

        if (refundCheckError) {
          console.error(`Error checking for existing refunds for transaction ${transaction.id}:`, refundCheckError);
          continue;
        }

        // Only process refund if no refund exists
        if (!existingRefunds || existingRefunds.length === 0) {
          console.log(`No refunds found for transaction ${transaction.id}, processing refund`);
          
          // Create refund transaction
          const { error: refundError } = await supabase
            .from('transactions')
            .insert({
              user_id: userId,
              amount: transaction.amount,
              type: 'CREDIT',
              status: 'COMPLETED',
              reference_id: `REFUND_TIMEOUT_${transaction.reference_id}`,
              order_id: transaction.order_id,
              phone_number: transaction.phone_number,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });

          if (refundError) {
            console.error(`Error creating refund for transaction ${transaction.id}:`, refundError);
            continue;
          }

          // Update wallet balance (refund the amount)
          currentBalance += Number(transaction.amount);
          refundsProcessed++;
          
          console.log(`Refund created for transaction ${transaction.id}, amount: ${transaction.amount}`);
        } else {
          console.log(`Refund already exists for transaction ${transaction.id}: ${existingRefunds[0].id}`);
        }

        // Update original transaction status to FAILED
        const { error: updateError } = await supabase
          .from('transactions')
          .update({
            status: 'FAILED',
            updated_at: new Date().toISOString()
          })
          .eq('id', transaction.id);

        if (updateError) {
          console.error(`Error updating transaction ${transaction.id} to FAILED:`, updateError);
          continue;
        }
        
        console.log(`Transaction ${transaction.id} marked as FAILED`);
      } catch (processError) {
        console.error(`Error processing transaction ${transaction.id}:`, processError);
      }
    }

    // Only update balance if there were actual refunds
    if (refundsProcessed > 0) {
      console.log(`Updating wallet balance to ${currentBalance} after processing ${refundsProcessed} refunds`);
      
      const { error: balanceError } = await supabase
        .from('wallet_balances')
        .update({
          balance: currentBalance,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (balanceError) {
        console.error('Error updating wallet balance:', balanceError);
        throw balanceError;
      }
      
      console.log(`Successfully updated wallet balance to ${currentBalance}`);
    } else {
      console.log('No balance update needed, no refunds processed');
    }
    
    console.log(`Completed cleanup of stuck transactions for user ${userId}`);
  } catch (error) {
    console.error('Error cleaning up stuck transactions:', error);
    throw error;
  }
};

// Update handleVirtualNumberRefund to use correct status values
export const handleVirtualNumberRefund = async (
  userId: string,
  transactionId: string,
  reason: 'CANCELED' | 'TIMEOUT' | 'BANNED'
): Promise<void> => {
  try {
    console.log(`Starting refund process for user ${userId}, transaction ${transactionId}, reason ${reason}`);
    
    // First, check if this transaction has already been refunded recently
    // This is to prevent double refunds within a short time period
    const checkTimeWindow = new Date();
    checkTimeWindow.setMinutes(checkTimeWindow.getMinutes() - 5); // Check the last 5 minutes
    
    const { data: recentRefunds, error: recentRefundError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'CREDIT')
      .gt('created_at', checkTimeWindow.toISOString())
      .ilike('reference_id', '%REFUND%');
      
    if (recentRefundError) {
      console.error('Error checking recent refunds:', recentRefundError);
    } else if (recentRefunds && recentRefunds.length > 0) {
      console.log(`Found ${recentRefunds.length} recent refunds, checking if any match our transaction`);
      
      // Get the transaction to find its order_id and amount
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', transactionId)
        .maybeSingle();
        
      if (!transactionError && transaction) {
        // Check if any of the recent refunds match this transaction's order_id or match the exact amount
        const matchingRefunds = recentRefunds.filter(refund => {
          // Consider a refund matching if:
          // 1. It has the same order_id OR
          // 2. It has the same amount AND similar reference (contains the service name)
          return (
            (refund.order_id && refund.order_id === transaction.order_id) ||
            (refund.amount === transaction.amount && 
             transaction.reference_id && 
             refund.reference_id.includes(transaction.reference_id))
          );
        });
        
        if (matchingRefunds.length > 0) {
          console.log(`Refund already processed for this transaction/order. Found ${matchingRefunds.length} matching refunds.`);
          console.log(`Most recent refund: ${matchingRefunds[0].id} created at ${matchingRefunds[0].created_at}`);
          return; // Exit early, no need to process refund again
        }
      }
    }
    
    // Get the transaction
    let transactionToProcess;
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('user_id', userId)
      .single();

    if (transactionError) {
      console.error('Transaction fetch error:', transactionError);
      throw transactionError;
    }
    
    if (!transaction) {
      console.error(`No transaction found with ID ${transactionId} for user ${userId}`);
      
      // Fallback: Try to find transaction by the most recent DEBIT transaction for this user
      console.log(`Attempting to find most recent transaction for user ${userId}`);
      const { data: recentTransactions, error: recentError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'DEBIT')
        .order('created_at', { ascending: false })
        .limit(5);
        
      if (recentError) {
        console.error('Recent transactions fetch error:', recentError);
        throw new Error('Transaction not found and fallback search failed');
      }
      
      if (recentTransactions && recentTransactions.length > 0) {
        console.log(`Found ${recentTransactions.length} recent transactions for user ${userId}`);
        // Use the most recent transaction
        const mostRecent = recentTransactions[0];
        console.log(`Using most recent transaction: ${mostRecent.id} (${mostRecent.created_at})`);
        // Continue with this transaction instead
        transactionToProcess = mostRecent;
      } else {
        throw new Error('No transactions found for this user');
      }
    } else {
      transactionToProcess = transaction;
    }
    
    console.log(`Found transaction: ${transactionToProcess.id}, status: ${transactionToProcess.status}, amount: ${transactionToProcess.amount}`);

    // Check if this transaction has already been refunded by looking for CREDIT transactions with this order_id
    // This is a more thorough check than just checking recently
    const { data: relatedTransactions, error: relatedError } = await supabase
      .from('transactions')
      .select('*')
      .eq('order_id', transactionToProcess.order_id)
      .eq('type', 'CREDIT')
      .eq('user_id', userId);
      
    if (relatedError) {
      console.error('Error checking for related transactions:', relatedError);
    }
    
    if (relatedTransactions && relatedTransactions.length > 0) {
      console.log(`Found ${relatedTransactions.length} related CREDIT transactions for this order`);
      
      // Check if any of these transactions are refunds
      const refunds = relatedTransactions.filter(t => 
        t.reference_id.includes('REFUND') || 
        t.reference_id.includes(transactionToProcess.reference_id)
      );
      
      if (refunds.length > 0) {
        console.log(`Refund already processed in ${refunds.length} transactions. Latest refund ID: ${refunds[0].id}`);
        return;
      }
    }
    
    // For extra safety, create a "transaction lock" record to prevent concurrent refund processing
    const lockId = `lock_${userId}_${transactionToProcess.id}`;
    const lockData = {
      id: lockId,
      user_id: userId,
      transaction_id: transactionToProcess.id,
      expires_at: new Date(Date.now() + 30000).toISOString() // 30 seconds lock
    };
    
    try {
      // Try to insert a lock record
      const { error: lockError } = await supabase
        .from('refund_locks')
        .upsert(lockData, { onConflict: 'id' })
        .select()
        .single();
        
      if (lockError) {
        // If the table doesn't exist, just log and continue
        if (lockError.code === '42P01') { // Relation does not exist
          console.log('Refund lock table not found, continuing without lock');
        } else {
          console.warn('Could not obtain refund lock, but continuing:', lockError);
        }
      } else {
        console.log(`Obtained refund lock: ${lockId}`);
      }
    } catch (lockError) {
      console.warn('Error with refund lock system, continuing anyway:', lockError);
    }

    // Process refund for MOST transactions - be more permissive to fix bugs
    // Only skip if it's already FAILED (not COMPLETED since we want to refund COMPLETED transactions too in case of cancellation)
    if (transactionToProcess.status !== 'FAILED') {
      console.log(`Processing refund for transaction ${transactionToProcess.id} with status ${transactionToProcess.status}`);
      
      // Get current balance
      const { data: walletData, error: walletError } = await supabase
        .from('wallet_balances')
        .select('balance')
        .eq('user_id', userId)
        .single();

      if (walletError) {
        console.error('Wallet fetch error:', walletError);
        throw walletError;
      }
      
      if (!walletData) {
        console.error(`No wallet found for user ${userId}`);
        throw new Error('Wallet not found');
      }

      const currentBalance = Number(walletData.balance);
      const refundAmount = Number(transactionToProcess.amount);
      console.log(`Current balance: ${currentBalance}, Refund amount: ${refundAmount}`);
      
      // Update balance - add the refund amount
      const newBalance = currentBalance + refundAmount;
      console.log(`New balance will be: ${newBalance}`);
      
      const { error: updateError } = await supabase
        .from('wallet_balances')
        .update({ 
          balance: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (updateError) {
        console.error('Balance update error:', updateError);
        throw updateError;
      }
      
      console.log(`Balance updated successfully to ${newBalance}`);

      // Update original transaction status to FAILED
      const { error: updateTransError } = await supabase
        .from('transactions')
        .update({ 
          status: 'FAILED',
          updated_at: new Date().toISOString()
        })
        .eq('id', transactionToProcess.id);

      if (updateTransError) {
        console.error('Transaction status update error:', updateTransError);
        throw updateTransError;
      }
      
      console.log(`Transaction ${transactionToProcess.id} status updated to FAILED`);

      // Add more detail to the reference_id for better tracking
      const refundReference = `REFUND_${reason}_${transactionToProcess.reference_id}`;
      const timestamp = new Date().getTime(); // Add timestamp to make reference unique
      const uniqueRefundReference = `${refundReference}_${timestamp}`;

      // Create refund transaction
      const { data: refundTransaction, error: refundError } = await supabase
        .from('transactions')
        .insert({
          user_id: userId,
          amount: transactionToProcess.amount,
          type: 'CREDIT',
          status: 'COMPLETED',
          reference_id: uniqueRefundReference, // Use unique reference to prevent duplicates
          order_id: transactionToProcess.order_id,
          phone_number: transactionToProcess.phone_number,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (refundError) {
        console.error('Refund transaction creation error:', refundError);
        throw refundError;
      }
      
      console.log(`Successfully created refund transaction: ${refundTransaction.id}`);
      console.log(`Completed refund process for transaction ${transactionToProcess.id}, reason: ${reason}`);
      
      // Try to clean up the lock if it exists
      try {
        await supabase
          .from('refund_locks')
          .delete()
          .eq('id', lockId);
      } catch (cleanupError) {
        console.warn('Could not clean up refund lock, will expire naturally:', cleanupError);
      }
      
      return;
    } else {
      console.log(`Transaction ${transactionToProcess.id} is already in ${transactionToProcess.status} status, checking if refund exists`);
      
      // Even if the transaction is FAILED, let's make sure a refund exists
      // This handles the case where the transaction was marked FAILED but no refund was created
      
      // Check if a refund transaction exists
      const { data: refundCheck, error: refundCheckError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'CREDIT')
        .eq('order_id', transactionToProcess.order_id)
        .ilike('reference_id', '%REFUND%')
        .maybeSingle();
        
      if (refundCheckError) {
        console.error('Error checking for refund transaction:', refundCheckError);
      }
      
      if (!refundCheck) {
        console.log('No refund found for FAILED transaction, creating one now');
        
        // Get current balance
        const { data: walletData, error: walletError } = await supabase
          .from('wallet_balances')
          .select('balance')
          .eq('user_id', userId)
          .single();

        if (walletError) {
          console.error('Wallet fetch error:', walletError);
          throw walletError;
        }
        
        const currentBalance = Number(walletData.balance);
        const refundAmount = Number(transactionToProcess.amount);
        
        // Update balance
        const newBalance = currentBalance + refundAmount;
        const { error: updateError } = await supabase
          .from('wallet_balances')
          .update({ 
            balance: newBalance,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);

        if (updateError) {
          console.error('Balance update error:', updateError);
          throw updateError;
        }
        
        // Add more detail to the reference_id for better tracking
        const refundReference = `REFUND_${reason}_${transactionToProcess.reference_id}`;
        const timestamp = new Date().getTime(); // Add timestamp to make reference unique
        const uniqueRefundReference = `${refundReference}_${timestamp}`;

        // Create refund transaction
        const { data: refundTransaction, error: refundError } = await supabase
          .from('transactions')
          .insert({
            user_id: userId,
            amount: transactionToProcess.amount,
            type: 'CREDIT',
            status: 'COMPLETED',
            reference_id: uniqueRefundReference, // Use unique reference to prevent duplicates
            order_id: transactionToProcess.order_id,
            phone_number: transactionToProcess.phone_number,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        if (refundError) {
          console.error('Refund transaction creation error:', refundError);
          throw refundError;
        }
        
        console.log(`Created missing refund transaction: ${refundTransaction.id} for failed transaction`);
      } else {
        console.log(`Refund already exists for this failed transaction: ${refundCheck.id}`);
      }
    }
    
    // Try to clean up the lock if it exists
    try {
      await supabase
        .from('refund_locks')
        .delete()
        .eq('id', lockId);
    } catch (cleanupError) {
      console.warn('Could not clean up refund lock, will expire naturally:', cleanupError);
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
    console.log(`[updateVirtualNumberStatus] Updating order ${orderId} to status ${status} for user ${userId}`);
    
    // Find the DEBIT transaction associated with this order (original purchase)
    let transactionsData;
    const { data: transactions, error: transactionError } = await supabase
      .from('transactions')
      .select('*')
      .eq('order_id', orderId)
      .eq('type', 'DEBIT'); // Only get the original purchase transaction

    if (transactionError) {
      console.error(`Error fetching transactions for order ${orderId}:`, transactionError);
      throw transactionError;
    }
    
    // Assign to our mutable variable
    transactionsData = transactions;
    
    // If there are multiple transactions or no transactions, handle gracefully
    if (!transactionsData || transactionsData.length === 0) {
      console.warn(`No DEBIT transaction found for order ${orderId}, user ${userId}`);
      // Try a different query - maybe the order_id was stored differently
      const { data: altTransactions, error: altError } = await supabase
        .from('transactions')
        .select('*')
        .ilike('order_id', `%${orderId}%`) // More flexible search
        .eq('type', 'DEBIT')
        .eq('user_id', userId);
        
      if (altError) {
        console.error(`Error in alternate transaction search:`, altError);
      } else if (altTransactions && altTransactions.length > 0) {
        console.log(`Found ${altTransactions.length} transactions with similar order ID`);
        transactionsData = altTransactions;
      } else {
        console.warn(`No transactions found even with flexible search for order ${orderId}`);
      }
    }
    
    if (transactionsData && transactionsData.length > 0) {
      // Use the first transaction if there are multiple (unlikely but possible)
      const transaction = transactionsData[0];
      const transactionId = transaction.id;
      
      console.log(`Found transaction ${transactionId} for order ${orderId}, current status: ${transaction.status}`);
      
      // Handle different status changes
      switch (status) {
        case 'RECEIVED':
          console.log(`Updating order ${orderId} to RECEIVED status`);
          // Update to COMPLETED status when SMS is received
          try {
            await handleSuccessfulOTP(userId, transactionId, orderId);
            console.log(`Successfully updated order ${orderId} to RECEIVED status`);
          } catch (otpError) {
            console.error(`Error handling successful OTP for order ${orderId}:`, otpError);
            // Continue with session update even if OTP handling fails
          }
          break;
        
        case 'CANCELED':
        case 'TIMEOUT':
        case 'BANNED':
          console.log(`Processing refund for order ${orderId} with status ${status}`);
          // Process refund when canceled, timed out, or banned
          try {
            await handleVirtualNumberRefund(userId, transactionId, status);
            console.log(`Refund successfully processed for order ${orderId}`);
          } catch (refundError) {
            console.error(`Error processing refund for ${status} status:`, refundError);
            // Try direct balance update as a last resort if refund fails
            try {
              console.log('Attempting direct balance update as fallback');
              const { data: walletData, error: walletError } = await supabase
                .from('wallet_balances')
                .select('balance')
                .eq('user_id', userId)
                .single();
                
              if (walletError) {
                console.error('Error fetching wallet balance:', walletError);
              } else if (walletData) {
                const newBalance = Number(walletData.balance) + Number(transaction.amount);
                const { error: updateError } = await supabase
                  .from('wallet_balances')
                  .update({ 
                    balance: newBalance,
                    updated_at: new Date().toISOString()
                  })
                  .eq('user_id', userId);
                  
                if (updateError) {
                  console.error('Error updating balance directly:', updateError);
                } else {
                  console.log(`Successfully updated balance directly to ${newBalance}`);
                }
              }
            } catch (directUpdateError) {
              console.error('Error in direct balance update:', directUpdateError);
            }
          }
          break;
          
        case 'FINISHED':
          console.log(`Finalizing order ${orderId} as FINISHED`);
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
              console.error(`Error updating transaction to COMPLETED: ${updateError}`);
            } else {
              console.log(`Transaction ${transactionId} marked as COMPLETED for FINISHED order`);
            }
          } else {
            console.log(`Transaction ${transactionId} already in COMPLETED status, no update needed`);
          }
          break;
          
        default:
          console.log(`Updating metadata for order ${orderId} with status ${status}`);
          // For other statuses, just update the metadata
          const { error: updateError } = await supabase
            .from('transactions')
            .update({
              updated_at: new Date().toISOString()
            })
            .eq('id', transactionId);
            
          if (updateError) {
            console.error('Error updating transaction metadata:', updateError);
          } else {
            console.log(`Transaction metadata updated for order ${orderId}`);
          }
      }
    } else {
      console.warn(`No transaction found to process for order ${orderId}, user ${userId}`);
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
      console.log(`Updating OTP session ${session.id} with new status ${status}`);
      // Update the session with new status and SMS data if available
      const sessionUpdateData: any = { 
        status,
        updated_at: new Date().toISOString()
      };
      
      if (smsCode) {
        sessionUpdateData.sms_code = smsCode;
        console.log(`Adding SMS code to session: ${smsCode}`);
      }
      
      if (fullSms) {
        sessionUpdateData.full_sms = fullSms;
        console.log(`Adding full SMS to session`);
      }
      
      const { error: updateSessionError } = await supabase
        .from('otp_sessions')
        .update(sessionUpdateData)
        .eq('id', session.id);
        
      if (updateSessionError) {
        console.error('Error updating OTP session:', updateSessionError);
      } else {
        console.log(`OTP session ${session.id} updated successfully`);
      }
    } else {
      console.log(`No OTP session found for order ${orderId}, not updating session`);
    }
    
    console.log(`Completed status update for order ${orderId} to ${status}`);
  } catch (error) {
    console.error('Error in updateVirtualNumberStatus:', error);
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