export interface WalletBalance {
  id: string;
  user_id: string;
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  type: 'CREDIT' | 'DEBIT';
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  reference_id?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface RechargeRequest {
  id: string;
  user_id: string;
  amount: number;
  payment_method: 'UPI';
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  utr_number: string;
  created_at: string;
  updated_at: string;
}
export interface OtpSession {
  id: string;
  user_id: string;
  order_id: string;
  phone_number: string;
  service: string;
  sms_code?: string;
  full_sms?: string;
  status: 'PENDING' | 'RECEIVED' | 'CANCELED' | 'TIMEOUT' | 'FINISHED' | 'BANNED';
  transaction_id: string;
  created_at: string;
  updated_at: string;
}

// export interface RechargeHistory {
//   id: string;
//   user_id: string;  // This will still be string in TypeScript since we handle UUIDs as strings
//   amount: number;
//   utr_number: string;
//   status: 'pending' | 'approved' | 'rejected';
//   created_at: string;
//   updated_at: string;
// }
