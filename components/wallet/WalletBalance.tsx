"use client"
import { useState, useEffect } from 'react'
import { useUser, useAuth } from '@clerk/nextjs'
import { toast } from 'sonner'
import { IndianRupee, Plus, Copy, Loader2, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from '@/lib/utils'
import { getWalletBalance, createRechargeRequest } from '@/lib/walletService'
import { RechargeHistory } from './RechargeHistory'

interface WalletBalanceProps {
  className?: string
}

export function WalletBalance({ className }: WalletBalanceProps) {
  const { user } = useUser()
  const { getToken } = useAuth()
  const [balance, setBalance] = useState<number>(0)
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)
  const [balanceError, setBalanceError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [amount, setAmount] = useState<number>(0)
  const [utrNumber, setUtrNumber] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingQR, setIsLoadingQR] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)

  const upiId = process.env.NEXT_PUBLIC_UPI_ID
  const upiQrUrl = `upi://pay?pa=${upiId}&pn=OTPMaya&am=${amount}&cu=INR`

  useEffect(() => {
    const fetchBalance = async () => {
      if (!user?.id) return;
      
      setIsLoadingBalance(true);
      setBalanceError(null);
      
      try {
        const balance = await getWalletBalance(user.id);
        setBalance(balance);
      } catch (error) {
        console.error('Error fetching balance:', error);
        setBalanceError('Failed to load balance');
        toast.error('Failed to load wallet balance');
      } finally {
        setIsLoadingBalance(false);
      }
    };
    
    fetchBalance();
  }, [user?.id]);

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

  useEffect(() => {
    if (utrNumber.length === 12) {
      setCurrentStep(3);
    } else if (amount >= 50) {
      setCurrentStep(2);
    }
  }, [utrNumber, amount]);

  const copyUPIId = async () => {
    if (!upiId) return;
    try {
      await navigator.clipboard.writeText(upiId);
      toast.success('UPI ID copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy UPI ID');
    }
  };

  const handleSubmit = async () => {
    if (!user?.id) {
      toast.error('Please sign in to continue')
      return
    }

    if (!utrNumber.trim() || utrNumber.length !== 12 || !/^\d+$/.test(utrNumber)) {
      toast.error('Please enter a valid 12-digit UTR number')
      return
    }

    if (amount < 50) {
      toast.error('Minimum recharge amount is ₹50')
      return
    }

    try {
      setIsSubmitting(true)
      
      const token = await getToken()
      await createRechargeRequest(
        user.id,
        amount,
        utrNumber,
        token || ''
      )

      toast.success('Recharge request submitted successfully')
      setAmount(0)
      setUtrNumber('')
      setIsDialogOpen(false)
      setShowQR(false)
      setCurrentStep(1)
      
      const newBalance = await getWalletBalance(user.id)
      setBalance(newBalance)
    } catch (error) {
      console.error('Error submitting recharge request:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to submit recharge request')
    } finally {
      setIsSubmitting(false)
    }
  }

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
  )

  return (
    <div className="space-y-6">
      <Card className={cn('w-full max-w-md mx-auto', className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Wallet Balance
            </CardTitle>
            <div className="flex items-center gap-1">
              <IndianRupee className="h-4 w-4" />
              {isLoadingBalance ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Loading...</span>
                </div>
              ) : balanceError ? (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">Error loading balance</span>
                </div>
              ) : (
                <span className="text-2xl font-bold">
                  {balance.toLocaleString('en-IN')}
                </span>
              )}
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open)
            if (!open) {
              setAmount(0)
              setUtrNumber('')
              setShowQR(false)
              setCurrentStep(1)
            }
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="relative overflow-hidden group">
                <div className="absolute inset-0 bg-primary/10 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300" />
                <Plus className="h-4 w-4 mr-2" />
                Recharge
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Recharge Wallet</DialogTitle>
                <DialogDescription>
                  Add money to your wallet using UPI payment
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col gap-6 py-4">
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

                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
                      <Input
                        id="amount"
                        type="number"
                        placeholder="Enter amount (min ₹50)"
                        value={amount || ''}
                        onChange={(e) => setAmount(Number(e.target.value))}
                        min={50}
                        disabled={isSubmitting}
                        className="pl-8"
                      />
                    </div>
                    {amount > 0 && amount < 50 && (
                      <Alert variant="destructive" className="mt-2">
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
                                <div className="bg-secondary px-3 py-1.5 rounded-md">
                                  <code className="text-sm font-medium">{upiId}</code>
                                </div>
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
                            <Label htmlFor="utr">UTR Number</Label>
                            <Input
                              id="utr"
                              placeholder="Enter 12-digit UTR Number"
                              value={utrNumber}
                              onChange={(e) => {
                                const value = e.target.value.replace(/\D/g, '')
                                if (value.length <= 12) setUtrNumber(value)
                              }}
                              maxLength={12}
                              disabled={isSubmitting}
                              className={cn(
                                "transition-all duration-200",
                                utrNumber.length === 12 && "border-primary"
                              )}
                            />
                            <p className="text-xs text-muted-foreground">
                              UTR number can be found in your UPI app payment history
                            </p>
                          </div>

                          <Button
                            type="submit"
                            onClick={handleSubmit}
                            disabled={isSubmitting || amount < 50 || !utrNumber || utrNumber.length !== 12}
                            className="w-full"
                          >
                            {isSubmitting ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                              <ArrowRight className="mr-2 h-4 w-4" />
                            )}
                            Submit Recharge Request
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
      </Card>
      
      <RechargeHistory className="max-w-4xl mx-auto" />
    </div>
  )
}
