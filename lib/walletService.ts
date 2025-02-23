import { createClient, PostgrestError } from '@supabase/supabase-js';
import { WalletBalance, Transaction, RechargeRequest } from '@/types/wallet';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Helper function to handle Supabase errors
function handleSupabaseError(error: unknown, defaultMessage: string): never {
  if (error instanceof Error) {
    if ('code' in error) { // PostgrestError
      const pgError = error as PostgrestError;
      console.error('Supabase error:', {
        code: pgError.code,
        message: pgError.message,
        details: pgError.details,
        hint: pgError.hint
      });
      
      // Handle specific error codes
      if (pgError.code === '23505') { // Unique violation
        throw new Error('This record already exists');
      }
      
      throw new Error(pgError.message || defaultMessage);
    }
    // Regular Error object
    console.error('Error:', error.message);
    throw error;
  }
  // Unknown error type
  console.error('Unknown error type:', typeof error, error);
  throw new Error(defaultMessage);
}

// Get or initialize wallet balance
export const getWalletBalance = async (userId: string): Promise<number> => {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    // First try to get existing balance
    const { data: existingBalance, error: fetchError } = await supabase
      .from('wallet_balances')
      .select('balance')
      .eq('user_id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // Not found error
      handleSupabaseError(fetchError, 'Failed to fetch wallet balance');
    }

    // If balance exists, return it
    if (existingBalance?.balance !== undefined) {
      return existingBalance.balance;
    }

    // If no balance exists, initialize it
    const { error: insertError } = await supabase
      .from('wallet_balances')
      .insert({
        user_id: userId,
        balance: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (insertError) {
      handleSupabaseError(insertError, 'Failed to initialize wallet balance');
    }

    return 0;
  } catch (error) {
    handleSupabaseError(error, 'Error in wallet balance operation');
  }
};

export const updateWalletBalance = async (
  userId: string,
  amount: number,
  type: 'CREDIT' | 'DEBIT'
): Promise<void> => {
  try {
    const { data: wallet, error: walletError } = await supabase
      .from('wallet_balances')
      .select('balance')
      .eq('user_id', userId)
      .single();

    if (walletError && walletError.code !== 'PGRST116') { // Not found error
      handleSupabaseError(walletError, 'Failed to fetch wallet balance');
    }

    const currentBalance = wallet?.balance || 0;
    const newBalance = type === 'CREDIT' 
      ? currentBalance + amount
      : currentBalance - amount;

    if (newBalance < 0) {
      throw new Error('Insufficient balance');
    }

    const { error: updateError } = await supabase
      .from('wallet_balances')
      .upsert({
        user_id: userId,
        balance: newBalance,
        updated_at: new Date().toISOString(),
      });

    if (updateError) {
      handleSupabaseError(updateError, 'Failed to update wallet balance');
    }
  } catch (error) {
    handleSupabaseError(error, 'Error updating wallet balance');
  }
};

export const createTransaction = async (
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
      handleSupabaseError(error, 'Failed to create transaction');
    }
    return data as Transaction;
  } catch (error) {
    handleSupabaseError(error, 'Error creating transaction');
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
      handleSupabaseError(error, 'Failed to update transaction status');
    }
  } catch (error) {
    handleSupabaseError(error, 'Error updating transaction status');
  }
};

// New function to initialize wallet for new users
export const initializeWallet = async (userId: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('wallet_balances')
      .insert({
        user_id: userId,
        balance: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (error && error.code !== '23505') { // Ignore unique violation
      handleSupabaseError(error, 'Failed to initialize wallet');
    }
  } catch (error) {
    handleSupabaseError(error, 'Error initializing wallet');
  }
};

export async function createRechargeRequest(
  userId: string,
  amount: number,
  utrNumber: string,
  token: string
): Promise<RechargeRequest> {
  try {
    // Input validation
    if (!userId) {
      throw new Error('User ID is required')
    }

    if (amount < 50) {
      throw new Error('Minimum recharge amount is ₹50')
    }

    if (!utrNumber || utrNumber.length !== 12 || !/^\d+$/.test(utrNumber)) {
      throw new Error('Invalid UTR number. Must be 12 digits.')
    }

    // Check if UTR already exists
    const { data: existingRecharge, error: checkError } = await supabase
      .from('recharge_requests')
      .select('id')
      .eq('utr_number', utrNumber)
      .single()

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 means no rows returned
      handleSupabaseError(checkError, 'Failed to verify UTR number');
    }

    if (existingRecharge) {
      throw new Error('This UTR number has already been used')
    }

    // Insert new recharge request
    const { data, error: rechargeError } = await supabase
      .from('recharge_requests')
      .insert({
        user_id: userId,
        amount: amount,
        payment_method: 'UPI',
        status: 'PENDING',
        utr_number: utrNumber,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (rechargeError) {
      handleSupabaseError(rechargeError, 'Failed to create recharge request');
    }

    if (!data) {
      throw new Error('Failed to create recharge request: No data returned')
    }

    return data as RechargeRequest;
  } catch (error) {
    handleSupabaseError(error, 'Error in createRechargeRequest');
  }
};

export async function getRechargeHistoryService(userId: string): Promise<RechargeRequest[]> {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    const { data, error } = await supabase
      .from('recharge_requests')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      handleSupabaseError(error, 'Failed to fetch recharge history');
    }
    
    return data || [];
  } catch (error) {
    handleSupabaseError(error, 'Failed to fetch recharge history');
  }
};

export async function verifyRechargeRequest(
  userId: string,
  rechargeId: string
): Promise<void> {
  try {
    const { data: recharge, error: fetchError } = await supabase
      .from('recharge_requests')
      .select('*')
      .eq('id', rechargeId)
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      handleSupabaseError(fetchError, 'Failed to fetch recharge request');
    }
    if (!recharge) throw new Error('Recharge request not found');
    if (recharge.status !== 'PENDING') throw new Error('Recharge already processed');

    // Update wallet balance
    await updateWalletBalance(userId, recharge.amount, 'CREDIT');

    // Update recharge status
    const { error: updateError } = await supabase
      .from('recharge_requests')
      .update({
        status: 'COMPLETED',
        updated_at: new Date().toISOString()
      })
      .eq('id', rechargeId);

    if (updateError) {
      handleSupabaseError(updateError, 'Failed to update recharge status');
    }

    // Create a transaction record
    await createTransaction(userId, recharge.amount, 'CREDIT', rechargeId);
  } catch (error) {
    handleSupabaseError(error, 'Error verifying recharge request');
  }
};

export const getTransactions = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      handleSupabaseError(error, 'Failed to fetch transactions');
    }
    return data;
  } catch (error) {
    handleSupabaseError(error, 'Error fetching transactions');
  }
};
