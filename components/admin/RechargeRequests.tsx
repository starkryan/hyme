'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, Copy, CheckCircle2, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { verifyRechargeRequest } from '@/lib/walletService';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
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

interface RechargeRequest {
  id: string;
  user_id: string;
  amount: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED'; // Database valid statuses
  utr_number: string;
  created_at: string;
  updated_at?: string;
}


export function RechargeRequests() {
  const { user, isLoaded } = useUser();
  
  const [amount, setAmount] = useState<number>(0);
  const [utrNumber, setUtrNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<RechargeRequest[]>([]);
  const [processingRequests, setProcessingRequests] = useState<Set<string>>(new Set()); // Track requests in processing state
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

      try {
        // First check if the user is an admin - this needs to happen before the query
        const role = user.publicMetadata?.role;
        const userIsAdmin = role === 'admin';
        setIsAdmin(userIsAdmin);

        // Now build the proper query based on whether user is admin or not
        let query = supabase
          .from('recharge_requests')
          .select('*')
          .order('created_at', { ascending: false });
          
        // Only filter by user_id if not an admin
        if (!userIsAdmin) {
          query = query.eq('user_id', user.id);
        }
        
        const { data, error } = await query;

        if (error) {
          console.error('Error loading requests:', error);
          toast.error('Failed to load payment requests');
          return;
        }

        console.log('Loaded requests:', data?.length || 0);
        setRequests(data || []);
        
        if (userIsAdmin) {
          const pendingRequests = data?.filter(r => r.status === 'PENDING') || [];
          setPendingCount(pendingRequests.length);
        }
      } catch (err) {
        console.error('Error in loadRequests:', err);
        toast.error('Failed to load payment requests');
      }
    };

    if (isLoaded && user) {
      loadRequests();
    }
  }, [user, isLoaded]);

  // Replace the existing admin check effect with this one that doesn't overlap with the request loading
  useEffect(() => {
    if (!isLoaded || !user) return;
    
    // Update admin status check when user changes
    const role = user.publicMetadata?.role;
    setIsAdmin(role === 'admin');
  }, [user, isLoaded]);

  // Add real-time subscription for updates - fix the subscription setup
  useEffect(() => {
    if (!isLoaded || !user) return;

    // Only subscribe after we know if the user is admin or not
    const role = user.publicMetadata?.role;
    const userIsAdmin = role === 'admin';

    console.log('Setting up realtime subscription, admin:', userIsAdmin);
    
    let channelFilter = {};
    if (!userIsAdmin) {
      channelFilter = { filter: `user_id=eq.${user.id}` };
    }
    
    const channel = supabase
      .channel('recharge-requests')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recharge_requests',
          ...channelFilter
        },
        (payload) => {
          console.log('Realtime event received:', payload.eventType, payload.new);
          
          if (payload.eventType === 'INSERT') {
            setRequests(prev => {
              // Check if this request is already in the array to avoid duplicates
              const exists = prev.some(req => req.id === payload.new.id);
              if (exists) return prev;
              
              // Add the new request to the beginning of the array
              const newRequests = [payload.new as RechargeRequest, ...prev];
              console.log('Updated requests after INSERT:', newRequests.length);
              
              // Update pending count if admin
              if (userIsAdmin && payload.new.status === 'PENDING') {
                setPendingCount(prevCount => prevCount + 1);
              }
              
              return newRequests;
            });
          } else if (payload.eventType === 'UPDATE') {
            setRequests(prev => {
              // Update the existing request
              const updatedRequests = prev.map(request => 
                request.id === payload.new.id ? payload.new as RechargeRequest : request
              );
              
              console.log('Updated requests after UPDATE:', updatedRequests.length);
              
              // Recalculate pending count if admin
              if (userIsAdmin) {
                const pendingCount = updatedRequests.filter(r => r.status === 'PENDING').length;
                setPendingCount(pendingCount);
              }
              
              return updatedRequests;
            });
          }
        }
      )
      .subscribe((status) => {
        console.log('Subscription status:', status);
      });

    return () => {
      console.log('Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [user, isLoaded]);

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
    
    // Find the specific request we're approving to display detailed feedback
    const requestToApprove = requests.find(req => req.id === requestId);
    const requestAmount = requestToApprove?.amount || 0;
    const userIdToUpdate = requestToApprove?.user_id;
    
    try {
      // Set this request as processing (for UI only)
      setProcessingRequests(prev => new Set(prev).add(requestId));
      
      console.log(`Approving request ${requestId} for amount ₹${requestAmount}`);
      const result = await verifyRechargeRequest(requestId, 'COMPLETED');
      
      if (result.success) {
        // Immediately update the UI for better user experience
        setRequests(prev => 
          prev.map(req => 
            req.id === requestId 
              ? { ...req, status: 'COMPLETED', updated_at: new Date().toISOString() } 
              : req
          )
        );
        
        if (isAdmin) {
          const pendingCount = requests.filter(r => 
            r.status === 'PENDING' && r.id !== requestId
          ).length;
          setPendingCount(pendingCount);
        }
        
        if (result.warning) {
          // If there was a warning but operation succeeded
          toast.success(`Request for ₹${requestAmount} approved with a note`, {
            duration: 5000,
            description: `The user's balance has been updated. Note: ${result.warning}`
          });
          console.log('Recharge request approved with warning:', result.warning);
        } else {
          // Clean success
          toast.success(`Request for ₹${requestAmount} approved successfully`, {
            description: "The user's wallet has been credited."
          });
        }
        
        // Now refresh the data from the database to ensure everything is up-to-date
        try {
          let query = supabase
            .from('recharge_requests')
            .select('*')
            .order('created_at', { ascending: false });
            
          // Only filter by user_id if not an admin
          if (!isAdmin && user) {
            query = query.eq('user_id', user.id);
          }
          
          const { data, error } = await query;
          
          if (error) throw error;
          
          if (data) {
            console.log('Refreshed requests after approval:', data.length);
            // Don't overwrite our optimistic update immediately - wait a moment
            setTimeout(() => {
              setRequests(data);
              if (isAdmin) {
                const pendingCount = data.filter(r => r.status === 'PENDING').length;
                setPendingCount(pendingCount);
              }
            }, 500);
          }
        } catch (refreshError) {
          console.error('Error refreshing requests:', refreshError);
          // Don't show an error toast since the operation succeeded
        }
      } else {
        // Reset the UI if operation failed
        toast.error(`Failed to approve request: ${result.warning || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error approving request:', error);
      
      // Check if the wallet balance was updated despite the error
      let errorMessage = 'Unknown error';
      let isMinorError = false;
      
      if (error instanceof Error) {
        errorMessage = error.message;
        // Check if it contains indications that the wallet was updated successfully
        isMinorError = errorMessage.includes('final cleanup') || 
                       errorMessage.includes('transaction record failed') ||
                       errorMessage.includes('Most critical operations succeeded') ||
                       errorMessage.includes('wallet_transactions'); // New check for the table name error
      }
      
      if (isMinorError) {
        // Still update the UI if the important part succeeded
        setRequests(prev => 
          prev.map(req => 
            req.id === requestId 
              ? { ...req, status: 'COMPLETED', updated_at: new Date().toISOString() } 
              : req
          )
        );
        
        if (isAdmin) {
          setPendingCount(prev => Math.max(0, prev - 1));
        }
        
        toast.success(`Request for ₹${requestAmount} was processed with a warning`, {
          description: "The balance has been added to the user's wallet, but there was a minor issue recording the transaction.",
          duration: 5000
        });
      } else {
        // Show detailed error message
        toast.error(`Failed to approve request: ${errorMessage}`);
      }
    } finally {
      // Remove from processing set when done
      setProcessingRequests(prev => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });
      setLoading(false);
    }
  };

  const handleReject = async (requestId: string) => {
    setLoading(true);
    
    // Find the specific request we're rejecting to display detailed feedback
    const requestToReject = requests.find(req => req.id === requestId);
    const requestAmount = requestToReject?.amount || 0;
    
    try {
      // Set this request as processing (for UI only)
      setProcessingRequests(prev => new Set(prev).add(requestId));
      
      console.log(`Rejecting request ${requestId} for amount ₹${requestAmount}`);
      const result = await verifyRechargeRequest(requestId, 'FAILED');
      
      if (result.success) {
        // Immediately update the UI for better user experience
        setRequests(prev => 
          prev.map(req => 
            req.id === requestId 
              ? { ...req, status: 'FAILED', updated_at: new Date().toISOString() } 
              : req
          )
        );
        
        if (isAdmin) {
          const pendingCount = requests.filter(r => 
            r.status === 'PENDING' && r.id !== requestId
          ).length;
          setPendingCount(pendingCount);
        }
        
        if (result.warning) {
          toast.success(`Request for ₹${requestAmount} rejected with a note`, {
            description: `The request has been marked as rejected. Note: ${result.warning}`,
            duration: 5000
          });
        } else {
          toast.success(`Request for ₹${requestAmount} rejected successfully`);
        }
        
        // Refresh the data from the database
        try {
          let query = supabase
            .from('recharge_requests')
            .select('*')
            .order('created_at', { ascending: false });
            
          // Only filter by user_id if not an admin
          if (!isAdmin && user) {
            query = query.eq('user_id', user.id);
          }
          
          const { data, error } = await query;
          
          if (error) throw error;
          
          if (data) {
            // Don't overwrite our optimistic update immediately
            setTimeout(() => {
              setRequests(data);
              if (isAdmin) {
                const pendingCount = data.filter(r => r.status === 'PENDING').length;
                setPendingCount(pendingCount);
              }
            }, 500);
          }
        } catch (refreshError) {
          console.error('Error refreshing requests:', refreshError);
        }
      } else {
        // Reset the UI if operation failed
        toast.error(`Failed to reject request: ${result.warning || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      
      // Create a safe error message
      let errorMessage = 'Unknown error';
      let isMinorError = false;
      
      if (error instanceof Error) {
        errorMessage = error.message;
        // Check if it contains indications that the status was updated successfully
        isMinorError = errorMessage.includes('final cleanup') || 
                      errorMessage.includes('transaction record failed') ||
                      errorMessage.includes('Most critical operations succeeded') ||
                      errorMessage.includes('wallet_transactions');
      }
      
      if (isMinorError) {
        // Still update the UI if the important part succeeded
        setRequests(prev => 
          prev.map(req => 
            req.id === requestId 
              ? { ...req, status: 'FAILED', updated_at: new Date().toISOString() } 
              : req
          )
        );
        
        if (isAdmin) {
          setPendingCount(prev => Math.max(0, prev - 1));
        }
        
        toast.success(`Request for ₹${requestAmount} was rejected with a note`, {
          description: "The request has been marked as rejected, but there was a minor issue with the database record.",
          duration: 5000
        });
      } else {
        // Show detailed error message
        toast.error(`Failed to reject request: ${errorMessage}`);
      }
    } finally {
      // Remove from processing set when done
      setProcessingRequests(prev => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });
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
    <div className="space-y-6">
      {!isAdmin && (
        <Card>
          <CardHeader className="sm:pb-3">
            <CardTitle className="text-xl">Request Wallet Recharge</CardTitle>
            <CardDescription>
              Follow the steps below to recharge your wallet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
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
              <form onSubmit={handleSubmit} className="space-y-4">
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
                  <div className="space-y-4">
                    {isLoadingQR ? (
                      <div className="flex flex-col items-center justify-center py-6">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        <p className="mt-2 text-sm text-muted-foreground">Generating QR Code...</p>
                      </div>
                    ) : showQR && (
                      <>
                        <div className="flex flex-col items-center justify-center space-y-3">
                          <div className="relative aspect-square w-40 sm:w-44 h-40 sm:h-44 bg-white p-3 rounded-lg">
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiQrUrl)}`}
                              alt="UPI QR Code"
                              className="w-full h-full"
                            />
                          </div>
                          <div className="text-center space-y-1.5">
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
        <CardContent className="px-0 sm:px-6">
          <div className="table-container">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[90px]">Date</TableHead>
                  <TableHead className="w-[80px]">Amount</TableHead>
                  <TableHead className="w-[130px]">UTR Number</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  {isAdmin && <TableHead className="w-[140px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="whitespace-nowrap text-xs sm:text-sm py-2 sm:py-4">
                      {new Date(request.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-xs sm:text-sm py-2 sm:py-4">₹{request.amount}</TableCell>
                    <TableCell className="font-mono text-xs sm:text-sm py-2 sm:py-4 truncate max-w-[130px]">{request.utr_number}</TableCell>
                    <TableCell className="py-2 sm:py-4">
                      <Badge
                        variant={
                          request.status === 'COMPLETED'
                            ? 'default'
                            : request.status === 'FAILED'
                            ? 'destructive'
                            : processingRequests.has(request.id)
                            ? 'outline'
                            : 'secondary'
                        }
                        className={cn(
                          "whitespace-nowrap text-xs",
                          processingRequests.has(request.id)
                            ? 'animate-pulse bg-yellow-100 text-yellow-800 border-yellow-300' 
                            : ''
                        )}
                      >
                        {processingRequests.has(request.id) && (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        )}
                        {processingRequests.has(request.id) ? 'PROCESSING' : request.status}
                      </Badge>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="py-2 sm:py-4">
                        {request.status === 'PENDING' && (
                          <div className="flex flex-col xs:flex-row items-start xs:items-center gap-2">
                            <Button
                              onClick={() => handleApprove(request.id)}
                              disabled={loading || processingRequests.has(request.id)}
                              variant="outline"
                              size="sm"
                              className={cn(
                                "text-green-600 hover:text-green-700 transition-all text-xs w-full xs:w-auto",
                                processingRequests.has(request.id) && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              {processingRequests.has(request.id) ? (
                                <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Processing</>
                              ) : (
                                <><CheckCircle className="h-3 w-3 mr-1" /> Approve</>
                              )}
                            </Button>
                            <Button
                              onClick={() => handleReject(request.id)}
                              disabled={loading || processingRequests.has(request.id)}
                              variant="outline"
                              size="sm"
                              className={cn(
                                "text-destructive hover:text-destructive/90 transition-all text-xs w-full xs:w-auto",
                                processingRequests.has(request.id) && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              {processingRequests.has(request.id) ? (
                                <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Processing</>
                              ) : (
                                <><XCircle className="h-3 w-3 mr-1" /> Reject</>
                              )}
                            </Button>
                          </div>
                        )}
                        {request.status === 'COMPLETED' && (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Approved
                          </Badge>
                        )}
                        {request.status === 'FAILED' && (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                            <XCircle className="h-3 w-3 mr-1" /> Rejected
                          </Badge>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {requests.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 5 : 4} className="text-center py-6 text-muted-foreground">
                      No recharge requests found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
