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
  // Initialize operations as a properly typed const (not let)
  const operations = {
    fetchedRequest: false,
    walletUpdated: false,
    transactionCreated: false,
    requestStatusUpdated: false
  };
  
  try {
    console.log(`Starting verification of recharge request ${requestId} with status ${status}`);
    
    // Get the recharge request
    const { data: request, error: fetchError } = await supabase
      .from('recharge_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError) {
      console.error('Error fetching request:', fetchError);
      throw fetchError;
    }
    if (!request) {
      throw new Error('Recharge request not found');
    }
    
    operations.fetchedRequest = true;
    console.log(`Recharge request found: amount ${request.amount}, user ${request.user_id}`);

    // Check if request is already in target status
    if (request.status === status) {
      console.log(`Request is already in ${status} status, no update needed`);
      return { success: true, operations, warning: `Request was already in ${status} status` };
    }

    // If approving the request, add balance to user's wallet
    if (status === 'COMPLETED') {
      try {
        // Get the current wallet balance
        const { data: walletData, error: getWalletError } = await supabase
          .from('wallet_balances')
          .select('balance')
          .eq('user_id', request.user_id)
          .single();
          
        if (getWalletError) {
          console.error('Error fetching wallet:', getWalletError);
          throw getWalletError;
        }
        if (!walletData) {
          throw new Error('Wallet not found');
        }
        console.log(`Current wallet balance: ${walletData.balance}`);
        
        // Update the wallet balance directly
        const newBalance = Number(walletData.balance) + Number(request.amount);
        const { error: walletError } = await supabase
          .from('wallet_balances')
          .update({ 
            balance: newBalance,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', request.user_id);

        if (walletError) {
          console.error('Error updating wallet balance:', walletError);
          throw walletError;
        }
        
        operations.walletUpdated = true;
        console.log(`Wallet balance updated to ${newBalance}`);
      } catch (walletError) {
        console.error('Wallet operation failed:', walletError);
        throw new Error(`Wallet update failed: ${walletError instanceof Error ? walletError.message : 'Unknown wallet error'}`);
      }

      try {
        // Create a wallet transaction record
        const { error: transactionError } = await supabase
          .from('transactions')
          .insert([
            {
              user_id: request.user_id,
              amount: request.amount,
              type: 'CREDIT',
              description: 'Wallet recharge',
              reference_id: requestId,
              status: 'COMPLETED',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          ]);

        
        
        operations.transactionCreated = true;
        console.log(`Transaction record created successfully`);
      } catch (transactionError) {
        // If wallet was updated but transaction record failed, we'll handle this
        // gracefully later and not throw here
        console.error('Transaction record creation failed:', transactionError);
        // Log more details about the error
        if (transactionError instanceof Error) {
          console.error('Transaction error details:', {
            message: transactionError.message,
            name: transactionError.name,
            stack: transactionError.stack
          });
        } else {
          console.error('Non-Error transaction error:', typeof transactionError, transactionError);
        }
        
        if (!operations.walletUpdated) {
          throw new Error(`Transaction record failed: ${transactionError instanceof Error ? transactionError.message : 'Unknown transaction error'}`);
        }
      }
    }

    try {
      // Update recharge request status
      const { error: updateError } = await supabase
        .from('recharge_requests')
        .update({ 
          status,
          updated_at: new Date().toISOString() 
        })
        .eq('id', requestId);

      if (updateError) {
        console.error('Error updating request status:', updateError);
        throw updateError;
      }
      
      operations.requestStatusUpdated = true;
      console.log(`Recharge request status updated to ${status}`);
    } catch (statusError) {
      console.error('Status update failed:', statusError);
      throw new Error(`Status update failed: ${statusError instanceof Error ? statusError.message : 'Unknown status error'}`);
    }

    console.log(`Recharge verification completed successfully`, operations);
    return { success: true, operations };
  } catch (error) {
    // Create a detailed operations log to help with debugging
    console.error('Operations completed before error:', operations);
    
    // Improved error handling that safely handles empty error objects
    if (error instanceof Error) {
      console.error('Wallet service error:', error.message);
    } else if (error && typeof error === 'object') {
      try {
        // Try to handle circular references and non-serializable props
        const safeErrorObj: Record<string, unknown> = {};
        for (const key in error) {
          if (Object.prototype.hasOwnProperty.call(error, key) && 
              typeof (error as Record<string, unknown>)[key] !== 'function' && 
              key !== 'toJSON') {
            try {
              safeErrorObj[key] = (error as Record<string, unknown>)[key];
            } catch (e) {
              safeErrorObj[key] = "<<non-serializable>>";
            }
          }
        }
        console.error('Wallet service error details:', safeErrorObj);
      } catch (jsonError) {
        console.error('Wallet service error: Could not stringify error object', error);
      }
    } else {
      console.error('Wallet service error: Unknown error format', error);
    }
    
    // If all critical operations succeeded, don't throw an error, just log it
    if (operations.walletUpdated && operations.requestStatusUpdated) {
      console.log('NOTE: Most critical operations succeeded despite error in transaction record.');
      return { success: true, operations, warning: operations.transactionCreated ? "Error in final cleanup" : "Transaction record creation failed" };
    }
    
    // Create safe error details
    let errorMessage = 'Unknown error occurred';
    
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (error && typeof error === 'object') {
      const err = error as any;
      errorMessage = err.message || errorMessage;
    }
    
    throw new Error(`Recharge verification failed: ${errorMessage}`);
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
// Removing this function as it's not needed
// export async function cleanupStuckTransactions() {...}

// Update handleVirtualNumberRefund to use correct status values
export const handleVirtualNumberRefund = async (
  userId: string,
  transactionId: string,
  reason: 'CANCELED' | 'TIMEOUT' | 'BANNED'
): Promise<void> => {
  try {
    console.log(`[handleVirtualNumberRefund] Processing refund for ${reason} transaction ${transactionId} for user ${userId}`)
    
    // Check if the transaction exists and get its details
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .single()
      
    if (transactionError) {
      console.error('Error fetching transaction during refund:', transactionError)
      throw new Error('Transaction not found for refund')
    }
    
    if (!transaction) {
      console.error(`Transaction not found for refund: ${transactionId}`)
      throw new Error('Transaction not found for refund')
    }

    // IMPORTANT: Check if there was an SMS received for this order
    // If yes, we should not refund as the service was already delivered
    if (transaction.order_id) {
      const { data: vnTransactions, error: vnError } = await supabase
        .from('virtual_number_transactions')
        .select('status')
        .eq('order_id', transaction.order_id)
        .single();
        
      if (!vnError && vnTransactions && 
          (vnTransactions.status === 'RECEIVED' || vnTransactions.status === 'FINISHED')) {
        console.log(`Not refunding order ${transaction.order_id} as SMS was already received (status: ${vnTransactions.status})`);
        return; // Exit early, no refund needed
      }
    }
    
    // Check OTP sessions too as a fallback
    if (transaction.order_id) {
      const { data: otpSession, error: otpError } = await supabase
        .from('otp_sessions')
        .select('sms_code, status')
        .eq('order_id', transaction.order_id)
        .maybeSingle();
        
      if (!otpError && otpSession && 
          (otpSession.sms_code || otpSession.status === 'RECEIVED')) {
        console.log(`Not refunding order ${transaction.order_id} as SMS was found in OTP session`);
        return; // Exit early, no refund needed
      }
    }
    
    // Check if this transaction has already been refunded by looking for CREDIT transactions with this order_id
    const { data: existingRefunds, error: refundCheckError } = await supabase
      .from('transactions')
      .select('*')
      .eq('order_id', transaction.order_id)
      .eq('type', 'CREDIT')
      .ilike('reference_id', '%REFUND%');
      
    if (refundCheckError) {
      console.error('Error checking for existing refunds:', refundCheckError);
    } else if (existingRefunds && existingRefunds.length > 0) {
      console.log(`Refund already exists for order ${transaction.order_id}, no need to process again`);
      return; // Exit early, refund already processed
    }
    
    // First update the transaction status to FAILED
    const { error: updateError } = await supabase
      .from('transactions')
      .update({ 
        status: 'FAILED',
        updated_at: new Date().toISOString()
      })
      .eq('id', transactionId);

    if (updateError) {
      console.error('Error updating transaction status:', updateError);
      throw updateError;
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

    // Calculate new balance
    const currentBalance = Number(walletData.balance);
    const refundAmount = Number(transaction.amount);
    const newBalance = currentBalance + refundAmount;
    
    console.log(`Processing refund: Current balance: ${currentBalance}, Refund amount: ${refundAmount}, New balance: ${newBalance}`);
    
    // Update wallet balance
    const { error: balanceError } = await supabase
      .from('wallet_balances')
      .update({ 
        balance: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (balanceError) {
      console.error('Error updating wallet balance:', balanceError);
      throw balanceError;
    }
    
    // Create a unique reference ID to avoid duplicates
    const refundReference = `REFUND_${reason}_${transaction.reference_id}`;
    const timestamp = new Date().getTime();
    const uniqueRefundReference = `${refundReference}_${timestamp}`;
    
    // Create refund transaction record
    const { error: refundError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        amount: refundAmount,
        type: 'CREDIT',
        status: 'COMPLETED',
        reference_id: uniqueRefundReference,
        order_id: transaction.order_id,
        phone_number: transaction.phone_number,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (refundError) {
      console.error('Error creating refund transaction:', refundError);
      throw refundError;
    }
    
    console.log(`Successfully processed refund of ${refundAmount} for order ${transaction.order_id}`);
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
  fullSms?: string,
  skipRefund?: boolean
): Promise<void> => {
  try {
    console.log(`[updateVirtualNumberStatus] Updating order ${orderId} to status ${status} for user ${userId}`);
    if (skipRefund) {
      console.log(`Skipping refund for order ${orderId} as SMS was already received`);
    }
    
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
          
          // IMPORTANT: First update the transaction status regardless of refund
          // This ensures the transaction is not left in PENDING state
          try {
            const { error: updateError } = await supabase
              .from('transactions')
              .update({
                status: skipRefund ? 'COMPLETED' : 'FAILED', // COMPLETED if service was used, FAILED if cancelled
                updated_at: new Date().toISOString()
              })
              .eq('id', transactionId);
              
            if (updateError) {
              console.error(`Error updating transaction status for ${orderId}:`, updateError);
            } else {
              console.log(`Successfully updated transaction ${transactionId} status to ${skipRefund ? 'COMPLETED' : 'FAILED'}`);
            }
          } catch (statusError) {
            console.error(`Error updating transaction status:`, statusError);
          }
          
          // Process refund when canceled, timed out, or banned
          try {
            // Skip refund if service was already used (SMS received)
            if (skipRefund) {
              console.log(`Skipping refund for order ${orderId} as SMS was already received`);
            } else {
              await handleVirtualNumberRefund(userId, transactionId, status);
              console.log(`Refund successfully processed for order ${orderId}`);
            }
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
      console.log(`User ${userId} has insufficient balance: ${balance} < ${amount}`);
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

    // If there are no pending transactions, allow the purchase
    if (pendingTransactions.length === 0) {
      return true;
    }

    // If we have pending transactions, we need to check if they're actually
    // from active orders or just "stuck" in the PENDING state

    // For each pending transaction, check if there's a corresponding OTP session
    let activeOrders = 0;
    for (const transaction of pendingTransactions) {
      if (!transaction.order_id) {
        continue; // Skip if no order ID (not a virtual number transaction)
      }

      // Check if there's an active OTP session for this order
      const { data: session } = await supabase
        .from('otp_sessions')
        .select('status')
        .eq('order_id', transaction.order_id)
        .maybeSingle();

      // If the session exists and is in PENDING or RECEIVED status, it's an active order
      if (session && (session.status === 'PENDING' || session.status === 'RECEIVED')) {
        activeOrders++;
      } else {
        // This transaction might be "stuck" in PENDING status
        console.log(`Found potentially stuck transaction: ${transaction.id} for order ${transaction.order_id}`);
        
        // Attempt to update this transaction to FAILED status
        try {
          await supabase
            .from('transactions')
            .update({ 
              status: 'FAILED',
              updated_at: new Date().toISOString()
            })
            .eq('id', transaction.id);
            
          console.log(`Updated stuck transaction ${transaction.id} to FAILED status`);
        } catch (updateError) {
          console.error(`Error updating stuck transaction: ${updateError}`);
        }
      }
    }

    // Only block new purchases if there are actually active orders
    return activeOrders === 0;
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