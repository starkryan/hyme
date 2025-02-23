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
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  reference_id?: string;
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

// export interface RechargeHistory {
//   id: string;
//   user_id: string;  // This will still be string in TypeScript since we handle UUIDs as strings
//   amount: number;
//   utr_number: string;
//   status: 'pending' | 'approved' | 'rejected';
//   created_at: string;
//   updated_at: string;
// }
