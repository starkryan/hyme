"use client"

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Copy, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import Image from 'next/image'

interface StepIndicatorProps {
  number: number
  title: string
  isActive: boolean
  isCompleted: boolean
}

const StepIndicator = ({ number, title, isActive, isCompleted }: StepIndicatorProps) => (
  <div 
    className={cn(
      "flex items-center gap-4 p-4 transition-colors",
      isActive && "bg-secondary",
      isCompleted && "text-primary"
    )}
  >
    <div className={cn(
      "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
      isActive && "border-primary bg-primary text-primary-foreground",
      isCompleted && "border-primary bg-primary text-primary-foreground",
      !isActive && !isCompleted && "border-muted-foreground text-muted-foreground"
    )}>
      {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : number}
    </div>
    <span className={cn(
      "font-medium",
      !isActive && !isCompleted && "text-muted-foreground"
    )}>
      {title}
    </span>
  </div>
)

export function RechargeForm() {
  const { user } = useUser()
  const [amount, setAmount] = useState<number>(0)
  const [utrNumber, setUtrNumber] = useState('')
  const [currentStep, setCurrentStep] = useState(1)
  const [showQR, setShowQR] = useState(false)
  const [isLoadingQR, setIsLoadingQR] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showManualQR, setShowManualQR] = useState(false)
  const [manualQRVisible, setManualQRVisible] = useState(false)
  const [copied, setCopied] = useState(false)
  
  const upiId = process.env.NEXT_PUBLIC_UPI_ID || 'example@upi'

  // Handle amount change and QR code generation
  useEffect(() => {
    if (amount < 20) {
      setShowQR(false)
      setCurrentStep(1)
      return
    }

    setIsLoadingQR(true)
    setCurrentStep(2)
    const timer = setTimeout(() => {
      setShowQR(true)
      setIsLoadingQR(false)
    }, 500)

    return () => clearTimeout(timer)
  }, [amount])

  // Update step when UTR is entered
  useEffect(() => {
    if (utrNumber.length === 12) {
      setCurrentStep(3)
    } else if (amount >= 50) {
      setCurrentStep(2)
    }
  }, [utrNumber, amount])

  const copyUPIId = async () => {
    try {
      await navigator.clipboard.writeText(upiId)
      setCopied(true)
      toast.success('UPI ID copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error('Failed to copy UPI ID')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    if (!utrNumber.trim() || utrNumber.length !== 12 || !/^\d+$/.test(utrNumber)) {
      toast.error('Please enter a valid 12-digit UTR number')
      return
    }

    if (amount < 20) {
      toast.error('Minimum recharge amount is ₹20')
      return
    }

    setIsSubmitting(true)
    try {
      const { error } = await supabase
        .from('recharge_requests')
        .insert([{
          user_id: user.id,
          amount: amount,
          utr_number: utrNumber,
          status: 'PENDING'
        }])

      if (error) throw error

      toast.success('Recharge request submitted successfully')
      setAmount(0)
      setUtrNumber('')
      setCurrentStep(1)
      setShowQR(false)
    } catch (error) {
      console.error('Error submitting request:', error)
      toast.error('Failed to submit request')
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleQRView = () => setShowManualQR(!showManualQR)

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-1 bg-secondary/50 rounded-lg overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-3">
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
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Amount Input */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₹</span>
              <Input
                id="amount"
                type="number"
                placeholder="Enter amount (min ₹20)"
                value={amount || ''}
                onChange={(e) => setAmount(Number(e.target.value))}
                min={20}
                className="pl-8"
                disabled={currentStep > 1 && isSubmitting}
              />
            </div>
          </div>

          {amount > 0 && amount < 20 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Minimum recharge amount is ₹20
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Payment Section */}
        {amount >= 20 && (
          <Card className="p-6">
            {isLoadingQR ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="mt-2 text-sm text-muted-foreground">Generating QR Code...</p>
              </div>
            ) : showQR && (
              <div className="space-y-8">
                <div className="flex flex-col items-center justify-center space-y-4">
                  <div className="relative aspect-square w-48 h-48 bg-white p-4 rounded-lg border">
                    <Image
                      src="/qr.jpg"
                      alt="UPI QR Code"
                      className="w-full h-full object-contain"
                      width={200}
                      height={200}
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
                        className={cn(
                          "h-8 w-8 transition-colors",
                          copied && "text-green-600 hover:text-green-600"
                        )}
                      >
                        {copied ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* UTR Input */}
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
                      "font-mono transition-all duration-200",
                      utrNumber.length === 12 && "border-primary"
                    )}
                  />
                  <p className="text-xs text-muted-foreground">
                    UTR number can be found in your UPI app payment history
                  </p>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting || amount < 20 || !utrNumber || utrNumber.length !== 12}
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="mr-2 h-4 w-4" />
                  )}
                  Submit Recharge Request
                </Button>
              </div>
            )}
          </Card>
        )}
      </form>
    </div>
  )
} 