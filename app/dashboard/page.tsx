"use client"
import React, { useState, useEffect } from 'react';
import { getVirtualNumber, getSmsCode, getBalance, getProducts, checkSmsMessages, cancelOrder } from '@/lib/5simService';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Wallet, History, UserCircle, LogOut, Phone, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { OTPInput } from 'input-otp';
import { Slot } from '@radix-ui/react-slot';

interface Product {
  id: string;
  name: string;
  Category: string;
  Qty: number;
  Price: number;
}

const RequestNumber = () => {
  const [number, setNumber] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedService, setSelectedService] = useState('');
  const [balance, setBalance] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [cancellationMessage, setCancellationMessage] = useState('');
  const { user, signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const router = useRouter();
  const [otpValue, setOtpValue] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [balanceData, productsData] = await Promise.all([
          getBalance(),
          getProducts('russia', 'any')
        ]);
        
        setBalance(balanceData.balance);
        setProducts(productsData);
        
        // Set first available product as default
        if (productsData.length > 0) {
          setSelectedService(productsData[0].id);
        }
      } catch (err: any) {
        setError(err.message);
      }
    };

    fetchData();
  }, []);

  const handleRequestNumber = async () => {
    if (!selectedService) {
      setError('Please select a service first');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      // Add a delay before making the request
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const data = await getVirtualNumber(selectedService);
      
      setNumber(data.phone || data.number);
      setOrderId(data.id);
      
      // Show success message
      toast.success(`Virtual number acquired: ${data.phone || data.number}`);
      
    } catch (err: any) {
      console.error('Request Number Error:', err);
      
      // Set a more user-friendly error message
      setError(err.message || 'Failed to get virtual number. Please try again.');
      
      // Show error toast
      toast.error(err.message || 'Failed to get virtual number');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!orderId) {
      setError('No active order to cancel');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const cancelResponse = await cancelOrder(orderId);
      setNumber('');
      setOrderId(null);
      setSmsCode('');
      setCancellationMessage(`Order ${cancelResponse.id} has been successfully canceled.`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckSmsCode = async () => {
    if (!number) {
      setError('Please request a number first');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      const data = await getSmsCode(number);
      setSmsCode(data.code);
      setOtpValue(data.code);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await signOut(); // Use Clerk's signOut
      toast.success('Signed out successfully');
      window.location.href = '/login';
    } catch (error) {
      toast.error('Error signing out');
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* User Profile Card */}
      <Card>
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">Dashboard</CardTitle>
            <Badge variant="outline" className="font-normal">
              Balance: ${balance}
            </Badge>
          </div>
          <CardDescription>
            Welcome back, {user?.email}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Button 
            variant="outline"
            className="justify-start"
            onClick={() => router.push('/dashboard/profile')}
          >
            <UserCircle className="mr-2 h-4 w-4" />
            Profile
          </Button>
          
          <Button 
            variant="outline"
            className="justify-start"
            onClick={() => router.push('/dashboard/history')}
          >
            <History className="mr-2 h-4 w-4" />
            History
          </Button>
          
          <Button 
            variant="outline"
            className="justify-start"
            onClick={() => router.push('/dashboard/wallet')}
          >
            <Wallet className="mr-2 h-4 w-4" />
            Recharge
          </Button>
          
        
           
          
          
          
          <Button 
            variant="outline"
            className="justify-start"
            onClick={handleSignOut}
            disabled={isSigningOut}
          >
            {isSigningOut ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Signing out...
              </>
            ) : (
              <>
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Virtual Number Service Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Phone className="mr-2 h-5 w-5" />
            Virtual Number Service
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ScrollArea className="h-[300px] rounded-md border p-4">
            <div className="space-y-4">
              <Select
                value={selectedService}
                onValueChange={setSelectedService}
                disabled={loading}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a service" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      <span className="flex items-center justify-between w-full">
                        <span>{product.name}</span>
                        <span className="text-muted-foreground">
                          ${product.Price} ({product.Qty})
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleRequestNumber}
                  disabled={loading || !selectedService}
                  className={cn(
                    "flex-1",
                    loading && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Requesting...
                    </>
                  ) : (
                    <>
                      <Phone className="mr-2 h-4 w-4" />
                      Request Number
                    </>
                  )}
                </Button>
                
                {orderId && (
                  <Button 
                    onClick={handleCancelOrder}
                    disabled={loading}
                    variant="destructive"
                    className="flex-1"
                  >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Cancel Order
                  </Button>
                )}
                
                <Button 
                  onClick={handleCheckSmsCode}
                  disabled={loading || !number}
                  variant="secondary"
                  className="flex-1"
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Check SMS
                </Button>
              </div>

              {number && (
                <Card className="bg-muted">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Virtual Number</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-lg font-mono">{number}</p>
                  </CardContent>
                </Card>
              )}

              {smsCode && (
                <Card className="bg-muted">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">SMS Code</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <OTPInput
                      maxLength={6}
                      value={otpValue}
                      onChange={setOtpValue}
                      render={({ slots }) => (
                        <div className="flex gap-2 justify-center">
                          {slots.map((slot, idx) => (
                            <Slot key={idx} {...slot}>
                              <div className="w-10 h-12 border-2 rounded-md flex items-center justify-center text-lg font-semibold bg-background">
                                {slot.char || ''}
                              </div>
                            </Slot>
                          ))}
                        </div>
                      )}
                    />
                  </CardContent>
                </Card>
              )}

              {cancellationMessage && (
                <div className="p-4 bg-red-50 rounded-lg">
                  <p className="font-medium">{cancellationMessage}</p>
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default RequestNumber; 