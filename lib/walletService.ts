import { createClient } from '@supabase/supabase-js';
import { Transaction, RechargeRequest } from '@/types/wallet';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function to handle Supabase errors
function handleSupabaseError(error: unknown, defaultMessage: string): never {
  if (error instanceof Error) {
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    throw error;
  }

  // Handle Supabase PostgrestError
  if (error && typeof error === 'object' && 'code' in error) {
    const err = error as Record<string, unknown>;
    
    console.error('Database error:', {
      code: err.code,
      message: err.message,
      details: err.details,
      hint: err.hint
    });

    // Handle specific error codes
    if (err.code === '23505') {
      throw new Error('This record already exists');
    }
    if (err.code === '42P01') {
      throw new Error('Database table not found');
    }
    if (err.code === '42501') {
      throw new Error('Permission denied');
    }
    if (err.code === '23503') {
      throw new Error('Referenced record does not exist');
    }
    
    // If it has a message, use it
    if (typeof err.message === 'string' && err.message) {
      throw new Error(err.message);
    }
  }

  // If we can't determine the error type, throw the default message
  throw new Error(defaultMessage);
}

// Get or initialize wallet balance
export async function getWalletBalance(userId: string): Promise<number> {
  try {
    // First try to get existing balance
    let { data, error } = await supabase
      .from('wallet_balances')
      .select('balance')
      .eq('user_id', userId)
      .maybeSingle();

    // If no balance exists or error, initialize/update it using upsert
    if (!data || error) {
      try {
        const { data: upsertData, error: upsertError } = await supabase
          .from('wallet_balances')
          .upsert({ 
            user_id: userId, 
            balance: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'user_id',
            ignoreDuplicates: true // Changed to true to ignore duplicates
          })
          .select('balance')
          .single();

        if (upsertError) {
          // If error is duplicate key, try to get the existing balance
          if (upsertError.code === '23505') {
            const { data: existingData, error: existingError } = await supabase
              .from('wallet_balances')
              .select('balance')
              .eq('user_id', userId)
              .single();

            if (existingError) {
              throw existingError;
            }

            return existingData?.balance || 0;
          }
          throw upsertError;
        }

        return upsertData?.balance || 0;
      } catch (upsertError) {
        console.error('Error upserting wallet balance:', upsertError);
        throw upsertError;
      }
    }

    return data.balance || 0;
  } catch (error) {
    console.error('Error fetching/initializing wallet balance:', error);
    throw error;
  }
}

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

export async function getTransactionHistory(userId: string) {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    throw error;
  }
}

export const createTransactionInDatabase = async (
  userId: string,
  amount: number,
  type: 'CREDIT' | 'DEBIT',
  referenceId?: string
): Promise<Transaction> => {
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
      return handleSupabaseError(error, 'Failed to create transaction');
    }
    return data as Transaction;
  } catch (error) {
    return handleSupabaseError(error, 'Error creating transaction');
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
      return handleSupabaseError(error, 'Failed to update transaction status');
    }
  } catch (error) {
    return handleSupabaseError(error, 'Error updating transaction status');
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
      return handleSupabaseError(error, 'Failed to initialize wallet');
    }
  } catch (error) {
    return handleSupabaseError(error, 'Error initializing wallet');
  }
};

// Add type for recharge status
type RechargeStatus = 'PENDING' | 'COMPLETED' | 'FAILED';

export async function createRechargeRequest(
  userId: string,
  amount: number,
  utrNumber: string
): Promise<RechargeRequest> {
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
    return handleSupabaseError(error, 'Error creating recharge request');
  }
}

export async function getRechargeHistory(userId: string): Promise<RechargeRequest[]> {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const { data, error } = await supabase
      .from('recharge_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    return handleSupabaseError(error, 'Failed to fetch recharge history');
  }
}

export async function verifyRechargeRequest(
  userId: string,
  rechargeId: string
): Promise<void> {
  const client = supabase;
  
  try {
    // Start a transaction
    await client.rpc('begin');

    // 1. Fetch and lock the recharge request
    const { data: recharge, error: fetchError } = await client
      .from('recharge_requests')
      .select('*')
      .eq('id', rechargeId)
      .eq('user_id', userId)
      .eq('status', 'PENDING')
      .single();

    if (fetchError) {
      throw fetchError;
    }

    if (!recharge) {
      throw new Error('Recharge request not found or already processed');
    }

    // 2. Update wallet balance
    await updateWalletBalance(userId, recharge.amount, 'CREDIT');

    // 3. Create transaction record
    await createTransaction(
      userId,
      recharge.amount,
      'CREDIT',
      `Recharge via UPI (UTR: ${recharge.utr_number})`
    );

    // 4. Update recharge request status
    const { error: updateError } = await client
      .from('recharge_requests')
      .update({
        status: 'COMPLETED' as RechargeStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', rechargeId)
      .eq('status', 'PENDING');

    if (updateError) {
      throw updateError;
    }

    // Commit transaction
    await client.rpc('commit');
  } catch (error) {
    // Rollback transaction on error
    await client.rpc('rollback');
    return handleSupabaseError(error, 'Error verifying recharge request');
  }
}

export const getTransactions = async (userId: string): Promise<Transaction[]> => {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return handleSupabaseError(error, 'Failed to fetch transactions');
    }
    return data;
  } catch (error) {
    return handleSupabaseError(error, 'Error fetching transactions');
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

// Function to create a pending transaction for virtual number
export const createVirtualNumberTransaction = async (
  userId: string,
  amount: number,
  orderId: string,
  phoneNumber: string,
  service: string
): Promise<VirtualNumberTransaction> => {
  try {
    // Start transaction
    await supabase.rpc('begin');
    
    // First check if user has sufficient balance
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

    // Create pending transaction first
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        amount: amount,
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

    // Deduct balance immediately but keep transaction pending
    const newBalance = currentBalance - amount;
    const { error: updateError } = await supabase
      .from('wallet_balances')
      .update({ 
        balance: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('balance', currentBalance); // Optimistic locking

    if (updateError) throw updateError;
    
    await supabase.rpc('commit');
    return transaction;
  } catch (error) {
    await supabase.rpc('rollback');
    throw error;
  }
};

// Function to handle successful OTP receipt
export const handleSuccessfulOTP = async (
  userId: string,
  transactionId: string,
  orderId: string
): Promise<void> => {
  try {
    await supabase.rpc('begin');

    // Get the pending transaction
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('user_id', userId)
      .eq('status', 'PENDING')
      .single();

    if (transactionError) throw transactionError;
    if (!transaction) throw new Error('Transaction not found');

    // Update transaction status to COMPLETED
    const { error: updateError } = await supabase
      .from('transactions')
      .update({ 
        status: 'COMPLETED',
        updated_at: new Date().toISOString()
      })
      .eq('id', transactionId);

    if (updateError) throw updateError;

    await supabase.rpc('commit');
  } catch (error) {
    await supabase.rpc('rollback');
    throw error;
  }
};

// Function to clean up stuck pending transactions
export async function cleanupStuckTransactions(
  userId: string
): Promise<void> {
  const client = supabase;
  
  try {
    await client.rpc('begin');

    // 1. Get all pending transactions older than 15 minutes
    const { data: pendingTransactions, error: fetchError } = await client
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'PENDING')
      .eq('type', 'DEBIT')
      .lt('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString());

    if (fetchError) throw fetchError;
    if (!pendingTransactions || pendingTransactions.length === 0) {
      await client.rpc('commit');
      return;
    }

    // Get current wallet balance
    const { data: walletData, error: walletError } = await client
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
      const { data: existingRefund } = await client
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('type', 'CREDIT')
        .eq('reference_id', `REFUND_${transaction.reference_id}`)
        .single();

      // Only process refund if no refund exists
      if (!existingRefund) {
        // Create refund transaction
        const { error: refundError } = await client
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
      const { error: updateError } = await client
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
      const { error: balanceError } = await client
        .from('wallet_balances')
        .update({
          balance: currentBalance,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (balanceError) throw balanceError;
    }

    await client.rpc('commit');
  } catch (error) {
    await client.rpc('rollback');
    return handleSupabaseError(error, 'Error cleaning up stuck transactions');
  }
}

// Update handleVirtualNumberRefund to use correct status values
export const handleVirtualNumberRefund = async (
  userId: string,
  transactionId: string,
  reason: 'CANCELED' | 'TIMEOUT'
): Promise<void> => {
  try {
    await supabase.rpc('begin');

    // Get the transaction
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', transactionId)
      .eq('user_id', userId)
      .single();

    if (transactionError) throw transactionError;
    if (!transaction) throw new Error('Transaction not found');

    // Only process refund if transaction is PENDING
    if (transaction.status === 'PENDING') {
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
    }

    await supabase.rpc('commit');
  } catch (error) {
    await supabase.rpc('rollback');
    throw error;
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