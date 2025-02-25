'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, Copy, CheckCircle2, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { verifyRechargeRequest } from '@/lib/walletService';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface RechargeRequest {
  id: string;
  user_id: string;
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  utr_number: string;
  created_at: string;
}

export function RechargeRequests() {
  const { user, isLoaded } = useUser();
  
  const [amount, setAmount] = useState<number>(0);
  const [utrNumber, setUtrNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<RechargeRequest[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [showQR, setShowQR] = useState(false);
  const [isLoadingQR, setIsLoadingQR] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  
  const upiId = process.env.NEXT_PUBLIC_UPI_ID || 'example@upi';
  const upiQrUrl = `upi://pay?pa=${upiId}&pn=OTPMaya&am=${amount}&cu=INR`;

  useEffect(() => {
    const loadRequests = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('recharge_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .eq(isAdmin ? '' : 'user_id', isAdmin ? '' : user.id);

      if (error) {
        console.error('Error loading requests:', error);
        return;
      }

      setRequests(data || []);
      
      if (isAdmin) {
        const pendingRequests = data?.filter(r => r.status === 'PENDING') || [];
        setPendingCount(pendingRequests.length);
      }
    };

    if (user) {
      loadRequests();
    }
  }, [user, isAdmin]);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!isLoaded || !user) return;
      
      // Check if user has admin role in Clerk metadata
      const role = user.publicMetadata?.role;
      setIsAdmin(role === 'admin');
    };

    checkAdmin();
  }, [user, isLoaded]);

  // Add real-time subscription for updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('recharge-requests')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recharge_requests',
          filter: isAdmin ? undefined : `user_id=eq.${user.id}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setRequests(prev => [payload.new as RechargeRequest, ...prev]);
            if (isAdmin && payload.new.status === 'PENDING') {
              setPendingCount(prev => prev + 1);
            }
          } else if (payload.eventType === 'UPDATE') {
            setRequests(prev => 
              prev.map(request => 
                request.id === payload.new.id ? payload.new as RechargeRequest : request
              )
            );
            if (isAdmin) {
              // Recalculate pending count after status update
              setRequests(prev => {
                const pendingRequests = prev.filter(r => r.status === 'PENDING');
                setPendingCount(pendingRequests.length);
                return prev;
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isAdmin]);

  // Add QR code loading effect
  useEffect(() => {
    if (amount < 50) {
      setShowQR(false);
      setCurrentStep(1);
      return;
    }

    setIsLoadingQR(true);
    setCurrentStep(2);
    const timer = setTimeout(() => {
      setShowQR(true);
      setIsLoadingQR(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [amount]);

  // Update step when UTR is entered
  useEffect(() => {
    if (utrNumber.length === 12) {
      setCurrentStep(3);
    } else if (amount >= 50) {
      setCurrentStep(2);
    }
  }, [utrNumber, amount]);

  const copyUPIId = async () => {
    try {
      await navigator.clipboard.writeText(upiId);
      toast.success('UPI ID copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy UPI ID');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!utrNumber.trim() || utrNumber.length !== 12 || !/^\d+$/.test(utrNumber)) {
      toast.error('Please enter a valid 12-digit UTR number');
      return;
    }

    if (amount < 50) {
      toast.error('Minimum recharge amount is ₹50');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('recharge_requests')
        .insert([
          {
            user_id: user.id,
            amount: amount,
            utr_number: utrNumber,
            status: 'PENDING'
          }
        ]);

      if (error) throw error;

      toast.success('Recharge request submitted successfully');
      setAmount(0);
      setUtrNumber('');
      setCurrentStep(1);
      setShowQR(false);
    } catch (error) {
      console.error('Error submitting request:', error);
      toast.error('Failed to submit request');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    setLoading(true);
    try {
      await verifyRechargeRequest(requestId, 'COMPLETED');
      toast.success('Request approved successfully');
    } catch (error) {
      console.error('Error approving request:', error);
      toast.error('Failed to approve request');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (requestId: string) => {
    setLoading(true);
    try {
      await verifyRechargeRequest(requestId, 'FAILED');
      toast.success('Request rejected successfully');
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error('Failed to reject request');
    } finally {
      setLoading(false);
    }
  };

  const StepIndicator = ({ number, title, isActive, isCompleted }: { 
    number: number; 
    title: string; 
    isActive: boolean; 
    isCompleted: boolean;
  }) => (
    <div className={cn(
      "flex items-center gap-3 py-3 px-4 rounded-lg transition-all",
      isActive && "bg-secondary",
      isCompleted && "text-primary"
    )}>
      <div className={cn(
        "flex items-center justify-center w-8 h-8 rounded-full transition-all",
        isActive && "bg-primary text-primary-foreground",
        isCompleted && "bg-primary text-primary-foreground",
        !isActive && !isCompleted && "bg-muted text-muted-foreground"
      )}>
        {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : number}
      </div>
      <span className={cn(
        "text-sm font-medium",
        !isActive && !isCompleted && "text-muted-foreground"
      )}>{title}</span>
    </div>
  );

  if (!isLoaded) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-8">
      {!isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>Request Wallet Recharge</CardTitle>
            <CardDescription>
              Follow the steps below to recharge your wallet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-6">
              {/* Step Indicators */}
              <div className="flex flex-col gap-1 bg-secondary/50 rounded-lg overflow-hidden">
                <StepIndicator 
                  number={1} 
                  title="Enter Amount" 
                  isActive={currentStep === 1} 
                  isCompleted={currentStep > 1} 
                />
                <StepIndicator 
                  number={2} 
                  title="Make Payment" 
                  isActive={currentStep === 2} 
                  isCompleted={currentStep > 2} 
                />
                <StepIndicator 
                  number={3} 
                  title="Submit UTR" 
                  isActive={currentStep === 3} 
                  isCompleted={currentStep > 3} 
                />
              </div>

              {/* Step Content */}
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="amount" className="text-sm font-medium">
                    Amount
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="Enter amount (min ₹50)"
                      value={amount || ''}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      min={50}
                      className="pl-8"
                      disabled={currentStep > 1 && loading}
                    />
                  </div>
                  {amount > 0 && amount < 50 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Minimum recharge amount is ₹50
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                {amount >= 50 && (
                  <div className="space-y-6">
                    {isLoadingQR ? (
                      <div className="flex flex-col items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        <p className="mt-2 text-sm text-muted-foreground">Generating QR Code...</p>
                      </div>
                    ) : showQR && (
                      <>
                        <div className="flex flex-col items-center justify-center space-y-4">
                          <div className="relative aspect-square w-48 h-48 bg-white p-4 rounded-lg">
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiQrUrl)}`}
                              alt="UPI QR Code"
                              className="w-full h-full"
                            />
                          </div>
                          <div className="text-center space-y-2">
                            <p className="text-sm text-muted-foreground">Scan QR or pay to</p>
                            <div className="flex items-center justify-center gap-2">
                              <code className="bg-secondary px-3 py-1.5 rounded-md text-sm font-medium">
                                {upiId}
                              </code>
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={copyUPIId}
                                className="h-8 w-8"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label htmlFor="utr" className="text-sm font-medium">
                            UTR Number
                          </label>
                          <Input
                            id="utr"
                            placeholder="Enter 12-digit UTR Number"
                            value={utrNumber}
                            onChange={(e) => {
                              const value = e.target.value.replace(/\D/g, '');
                              if (value.length <= 12) setUtrNumber(value);
                            }}
                            maxLength={12}
                            disabled={loading}
                            className={cn(
                              "font-mono transition-all duration-200",
                              utrNumber.length === 12 && "border-primary"
                            )}
                          />
                          <p className="text-xs text-muted-foreground">
                            UTR number can be found in your UPI app payment history
                          </p>
                        </div>

                        <Button
                          type="submit"
                          className="w-full"
                          disabled={loading || amount < 50 || !utrNumber || utrNumber.length !== 12}
                        >
                          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Submit Recharge Request
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </form>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recharge Requests List */}
      <Card>
        <CardHeader>
          <CardTitle>Recharge History</CardTitle>
          <CardDescription>
            View your recharge request history and status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>UTR Number</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    {new Date(request.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>₹{request.amount}</TableCell>
                  <TableCell className="font-mono">{request.utr_number}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        request.status === 'COMPLETED'
                          ? 'default'
                          : request.status === 'FAILED'
                          ? 'destructive'
                          : 'secondary'
                      }
                    >
                      {request.status}
                    </Badge>
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      {request.status === 'PENDING' && (
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => handleApprove(request.id)}
                            disabled={loading}
                            variant="outline"
                            size="sm"
                            className="text-green-600 hover:text-green-700"
                          >
                            {loading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle className="h-4 w-4 mr-1" />
                            )}
                            Approve
                          </Button>
                          <Button
                            onClick={() => handleReject(request.id)}
                            disabled={loading}
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive/90"
                          >
                            {loading ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <XCircle className="h-4 w-4 mr-1" />
                            )}
                            Reject
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
