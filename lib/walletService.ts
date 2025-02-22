import { createClient } from '@supabase/supabase-js'
import { Database } from '@/types/database.types'
import { toast } from 'sonner'
import { useUser } from '@clerk/nextjs'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const getWallet = async (userId: string) => {
  try {
    let { data: wallet, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error) {
      console.error('Supabase error:', error.message || 'No error message provided')
      if (error.code === 'PGRST116') { // Wallet not found
        const { data: newWallet, error: createError } = await supabase
          .from('wallets')
          .insert([{ user_id: userId, balance: 0 }])
          .select()
          .single()

        if (createError) {
          console.error('Error creating wallet:', createError.message || 'No error message provided')
          throw createError
        }
        return newWallet
      }
      throw error
    }

    return wallet
  } catch (error) {
    console.error('Error getting wallet:', error instanceof Error ? error.message : 'Unknown error')
    toast.error('Failed to get wallet')
    throw error
  }
}

export const rechargeWallet = async (userId: string, amount: number, description: string) => {
  try {
    const wallet = await getWallet(userId)

    const { data, error } = await supabase.rpc('recharge_wallet', {
      p_wallet_id: wallet.id,
      p_amount: amount,
      p_description: description,
    })

    if (error) throw error

    toast.success('Wallet recharged successfully')
    return data
  } catch (error) {
    console.error('Error recharging wallet:', error)
    toast.error('Failed to recharge wallet')
    throw error
  }
}

export const deductBalance = async (userId: string, amount: number, serviceId: string, description: string) => {
  try {
    const wallet = await getWallet(userId)

    if (wallet.balance < amount) {
      throw new Error('Insufficient balance')
    }

    const { data, error } = await supabase.rpc('deduct_balance', {
      p_wallet_id: wallet.id,
      p_amount: amount,
      p_service_id: serviceId,
      p_description: description,
    })

    if (error) throw error

    return data
  } catch (error) {
    console.error('Error deducting balance:', error)
    toast.error(error instanceof Error ? error.message : 'Failed to deduct balance')
    throw error
  }
} 