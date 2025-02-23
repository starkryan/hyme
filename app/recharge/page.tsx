"use client"
import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'
import { Loader2, IndianRupee, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { createRechargeRequest } from '@/lib/walletService'

export default function RechargePage() {
  const { user } = useUser()
  const [utrNumber, setUtrNumber] = useState('')
  const [amount, setAmount] = useState<number>(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const upiId = process.env.NEXT_PUBLIC_UPI_ID
  const upiQrUrl = `upi://pay?pa=${upiId}&pn=OTPMaya&am=${amount}&cu=INR`

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
      
      await createRechargeRequest(
        user.id,
        amount,
        utrNumber,
        await user.getToken()
      )

      toast.success('Recharge request submitted successfully')
      setAmount(0)
      setUtrNumber('')
    } catch (error) {
      console.error('Error submitting recharge request:', error)
      toast.error('Failed to submit recharge request')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="container max-w-2xl py-10">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IndianRupee className="h-5 w-5" />
            Recharge Wallet
          </CardTitle>
          <CardDescription>
            Add money to your wallet using UPI payment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="amount">Recharge Amount</Label>
            <Input
              id="amount"
              type="number"
              placeholder="Enter amount (min ₹50)"
              value={amount || ''}
              onChange={(e) => setAmount(Number(e.target.value))}
              min={50}
              disabled={isSubmitting}
            />
          </div>

          {amount >= 50 && (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center space-y-4 rounded-lg bg-muted p-6">
                <div className="relative aspect-square w-48 h-48 bg-white p-2 rounded-lg shadow-sm">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiQrUrl)}`}
                    alt="UPI QR Code"
                    className="w-full h-full"
                  />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">Scan QR or pay to</p>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <code className="text-sm font-medium">{upiId}</code>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={copyUPIId}
                      className="h-6 w-6"
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
                />
                <p className="text-xs text-muted-foreground">
                  UTR number can be found in your UPI app payment history
                </p>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter>
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={isSubmitting || amount < 50 || !utrNumber || utrNumber.length !== 12}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Recharge Request
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
