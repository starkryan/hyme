import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export type OtpSessionStatus = 'PENDING' | 'RECEIVED' | 'CANCELED' | 'TIMEOUT' | 'FINISHED' | 'BANNED';

interface OtpSession {
  id: string;
  user_id: string;
  order_id: string;
  phone_number: string;
  service: string;
  sms_code?: string;
  full_sms?: string;
  status: OtpSessionStatus;
  transaction_id: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

export async function createOtpSession(
  userId: string,
  orderId: string,
  phoneNumber: string,
  service: string,
  transactionId: string
): Promise<OtpSession> {
  try {
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000); // 20 minutes from now

    const { data, error } = await supabase
      .from('otp_sessions')
      .insert({
        user_id: userId,
        order_id: orderId,
        phone_number: phoneNumber,
        service,
        transaction_id: transactionId,
        status: 'PENDING',
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating OTP session:', error);
    throw error;
  }
}

export async function updateOtpSession(
  sessionId: string,
  updates: Partial<OtpSession>
): Promise<OtpSession> {
  try {
    const { data, error } = await supabase
      .from('otp_sessions')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error updating OTP session:', error);
    throw error;
  }
}

export async function getActiveOtpSession(userId: string): Promise<OtpSession | null> {
  try {
    const { data, error } = await supabase
      .from('otp_sessions')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['PENDING', 'RECEIVED'])
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "not found"
    return data;
  } catch (error) {
    console.error('Error getting active OTP session:', error);
    throw error;
  }
}

export async function deleteOtpSession(sessionId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('otp_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting OTP session:', error);
    throw error;
  }
} 