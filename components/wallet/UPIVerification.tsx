"use client"
import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'
import { Loader2, IndianRupee, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { getWalletBalance } from '@/lib/walletService'

interface UPIVerificationProps {
  onSuccess?: () => void
  className?: string
}

export function UPIVerification({ onSuccess, className }: UPIVerificationProps) {
  const { user } = useUser()
  const [utrNumber, setUtrNumber] = useState('')
  const [amount, setAmount] = useState<number>(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [balance, setBalance] = useState<number>(0)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const upiId = process.env.NEXT_PUBLIC_UPI_ID

  // Fetch wallet balance
  useEffect(() => {
    const fetchBalance = async () => {
      if (!user?.id) return;
      try {
        const balance = await getWalletBalance(user.id);
        setBalance(balance);
      } catch (error) {
        console.error('Error fetching balance:', error);
      }
    };
    fetchBalance();
  }, [user?.id]);

  const handleUTRSubmit = async () => {
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
      
      const response = await fetch('/api/wallet/verify-upi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          utrNumber,
          amount,
          userId: user.id
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to verify payment')
      }

      const data = await response.json()
      
      if (data.status === 'success') {
        toast.success('Payment verified successfully!')
        setAmount(0)
        setUtrNumber('')
        setIsDialogOpen(false)
        // Refresh balance
        const newBalance = await getWalletBalance(user.id)
        setBalance(newBalance)
        onSuccess?.()
      } else {
        toast.error(data.message || 'Payment verification failed')
      }
    } catch (error) {
      toast.error('Failed to verify payment. Please try again.')
      console.error('Payment verification error:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <Card className={cn('w-full max-w-md mx-auto', className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Wallet Balance
            </CardTitle>
            <div className="flex items-center gap-1">
              <IndianRupee className="h-4 w-4" />
              <span className="text-2xl font-bold">
                {balance.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Recharge
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Recharge Wallet</DialogTitle>
                <DialogDescription>
                  Add money to your wallet using UPI. Minimum recharge amount is ₹50.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Input
                    type="number"
                    placeholder="Enter recharge amount (min ₹50)"
                    value={amount || ''}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    min={50}
                    disabled={isSubmitting}
                  />
                  {upiId && (
                    <p className="text-xs text-muted-foreground">
                      UPI ID: <span className="font-medium">{upiId}</span>
                    </p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Input
                    placeholder="Enter 12-digit UTR Number"
                    value={utrNumber}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '')
                      if (value.length <= 12) setUtrNumber(value)
                    }}
                    maxLength={12}
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-muted-foreground">
                    UTR number can be found in your UPI app payment history
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  onClick={handleUTRSubmit}
                  disabled={isSubmitting || amount < 50 || !utrNumber || utrNumber.length !== 12}
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify Payment
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
      </Card>
    </>
  )
}
