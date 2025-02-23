'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input }   from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface RechargeRequest {
  id: string;
  user_id: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
  utr_number: string;
  created_at: string;
}

export function RechargeRequests() {
  const { user } = useUser();
  
  const [amount, setAmount] = useState('');
  const [utrNumber, setUtrNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<RechargeRequest[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const loadRequests = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('recharge_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading requests:', error);
        return;
      }

      setRequests(data || []);
    };

    loadRequests();
  }, [user]);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error checking admin:', error);
        return;
      }

      setIsAdmin(data?.is_admin || false);
    };

    checkAdmin();
  }, [user]);

  // Submit recharge request
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !amount || !utrNumber) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('recharge_requests')
        .insert([
          {
            user_id: user.id,
            amount: parseFloat(amount),
            utr_number: utrNumber,
            status: 'pending'
          }
        ]);

      if (error) throw error;

      toast.success('Recharge request submitted successfully!');

      // Reset form
      setAmount('');
      setUtrNumber('');
      setRequests((prevRequests) => [...prevRequests, { id: '', user_id: user.id, amount: parseFloat(amount), status: 'pending', utr_number: utrNumber, created_at: new Date().toISOString() }]);
    } catch (error) {
      console.error('Error submitting request:', error);
      toast.error('Failed to submit recharge request');
    } finally {
      setLoading(false);
    }
  };

  // Approve recharge request
  const handleApprove = async (requestId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('recharge_requests')
        .update({ status: 'approved' })
        .eq('id', requestId);

      if (error) throw error;

      toast.success('Recharge request approved!');

      setRequests((prevRequests) => prevRequests.map((request) => request.id === requestId ? { ...request, status: 'approved' } : request));
    } catch (error) {
      console.error('Error approving request:', error);
      toast.error('Failed to approve request');
    } finally {
      setLoading(false);
    }
  };

  // Reject recharge request
  const handleReject = async (requestId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('recharge_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId);

      if (error) throw error;

      toast.success('Recharge request rejected');

      setRequests((prevRequests) => prevRequests.map((request) => request.id === requestId ? { ...request, status: 'rejected' } : request));
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error('Failed to reject request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Recharge Request Form */}
      {!isAdmin && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4">
            <div>
              <label htmlFor="amount" className="block text-sm font-medium mb-1">
                Amount (₹)
              </label>
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                min="1"
                required
              />
            </div>
            <div>
              <label htmlFor="utr" className="block text-sm font-medium mb-1">
                UTR Number
              </label>
              <Input
                id="utr"
                type="text"
                value={utrNumber}
                onChange={(e) => setUtrNumber(e.target.value)}
                placeholder="Enter UTR number"
                required
              />
            </div>
          </div>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Request
          </Button>
        </form>
      )}

      {/* Recharge Requests List */}
      <div className="rounded-md border">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                UTR Number
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {requests.map((request) => (
              <tr key={request.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  {new Date(request.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">₹{request.amount}</td>
                <td className="px-6 py-4 whitespace-nowrap">{request.utr_number}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      request.status === 'approved'
                        ? 'bg-green-100 text-green-800'
                        : request.status === 'rejected'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {request.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {isAdmin && request.status === 'pending' && (
                    <div className="space-x-2">
                      <Button
                        onClick={() => handleApprove(request.id)}
                        disabled={loading}
                        variant="outline"
                        size="sm"
                      >
                        Approve
                      </Button>
                      <Button
                        onClick={() => handleReject(request.id)}
                        disabled={loading}
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
