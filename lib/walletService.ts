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

    if (fetchError) {
      // PGRST116 means no rows found, which is expected for new users
      if (fetchError.code === 'PGRST116') {
        // If no balance exists, initialize it with upsert to handle race conditions
        const { data: newBalance, error: insertError } = await supabase
          .from('wallet_balances')
          .upsert(
            {
              user_id: userId,
              balance: 0,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            },
            {
              onConflict: 'user_id',
              ignoreDuplicates: false
            }
          )
          .select('balance')
          .single();

        if (insertError) {
          console.error('Error initializing wallet:', insertError);
          throw insertError;
        }

        return newBalance?.balance ?? 0;
      }
      
      // For other errors, throw them
      console.error('Error fetching wallet:', fetchError);
      throw fetchError;
    }

    return existingBalance?.balance ?? 0;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Error in wallet balance operation');
  }
};

export const updateWalletBalance = async (
  userId: string,
  amount: number,
  type: 'CREDIT' | 'DEBIT'
): Promise<void> => {
  try {
    // First get the current balance
    const { data: currentData, error: fetchError } = await supabase
      .from('wallet_balances')
      .select('balance')
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      return handleSupabaseError(fetchError, 'Failed to fetch current balance');
    }

    // Calculate new balance
    const currentBalance = currentData?.balance || 0;
    const newBalance = type === 'CREDIT' 
      ? currentBalance + amount 
      : currentBalance - amount;

    if (newBalance < 0) {
      throw new Error('Insufficient balance');
    }

    // Use upsert with onConflict to handle duplicate records
    const { error: updateError } = await supabase
      .from('wallet_balances')
      .upsert(
        {
          user_id: userId,
          balance: newBalance,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
          ignoreDuplicates: false,
        }
      );

    if (updateError) {
      // Check if it's a unique constraint violation
      if (updateError instanceof Error && 'code' in updateError && updateError.code === '23505') {
        // Handle duplicate key violation
        console.error('Duplicate record detected:', updateError);
        throw new Error('Wallet record already exists. Please try again.');
      }
      return handleSupabaseError(updateError, 'Failed to update wallet balance');
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Insufficient balance') {
        throw error; // Re-throw insufficient balance error
      }
      if (error.message.includes('Wallet record already exists')) {
        throw error; // Re-throw duplicate record error
      }
    }
    return handleSupabaseError(error, 'Error updating wallet balance');
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

export async function createRechargeRequest(
  userId: string,
  amount: number,
  utrNumber: string,
  token: string
): Promise<RechargeRequest> {
  try {
    console.log('Creating recharge request:', { userId, amount, utrNumber });

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

    console.log('UTR check result:', { existingRecharge, error: checkError });

    if (checkError) {
      // PGRST116 means no rows found, which is what we want
      if (checkError.code !== 'PGRST116') {
        console.error('Error checking UTR:', checkError);
        return handleSupabaseError(checkError, 'Failed to verify UTR number');
      }
    }

    if (existingRecharge) {
      throw new Error('This UTR number has already been used');
    }

    const rechargeData = {
      user_id: userId,
      amount: amount,
      payment_method: 'UPI',
      status: 'PENDING',
      utr_number: utrNumber,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('Inserting recharge request:', rechargeData);

    // Insert new recharge request
    const { data, error: rechargeError } = await supabase
      .from('recharge_requests')
      .insert(rechargeData)
      .select()
      .single();

    if (rechargeError) {
      console.error('Error creating recharge:', rechargeError);
      return handleSupabaseError(rechargeError, 'Failed to create recharge request');
    }

    if (!data) {
      throw new Error('Failed to create recharge request: No data returned');
    }

    console.log('Recharge request created:', data);
    return data as RechargeRequest;
  } catch (error) {
    console.error('Recharge request failed:', error);
    return handleSupabaseError(error, 'Error in createRechargeRequest');
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
      return handleSupabaseError(error, 'Failed to fetch recharge history');
    }
    
    return data || [];
  } catch (error) {
    return handleSupabaseError(error, 'Failed to fetch recharge history');
  }
};

export async function verifyRechargeRequest(
  userId: string,
  rechargeId: string
): Promise<void> {
  try {
    // Step 1: Fetch the recharge request
    const { data: recharge, error: fetchError } = await supabase
      .from('recharge_requests')
      .select('*')
      .eq('id', rechargeId)
      .eq('user_id', userId)
      .eq('status', 'PENDING')
      .single();

    if (fetchError) {
      return handleSupabaseError(fetchError, 'Failed to fetch recharge request');
    }
    if (!recharge) {
      throw new Error('Recharge request not found or already processed');
    }

    // Step 2: Add the recharge amount to the wallet balance using updateWalletBalance
    await updateWalletBalance(userId, recharge.amount, 'CREDIT');

    // Step 3: Create a transaction record for the recharge
    await createTransaction(userId, recharge.amount, 'CREDIT', rechargeId);

    // Step 4: Mark the recharge request as COMPLETED
    const { error: updateError } = await supabase
      .from('recharge_requests')
      .update({
        status: 'COMPLETED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', rechargeId)
      .eq('status', 'PENDING');

    if (updateError) {
      return handleSupabaseError(updateError, 'Failed to update recharge request status');
    }

    console.log('Recharge request completed successfully:', rechargeId);
  } catch (error) {
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
