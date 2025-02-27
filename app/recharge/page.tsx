"use client"

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { RechargeForm } from '@/components/recharge/RechargeForm'
import { RechargeHistory } from '@/components/recharge/RechargeHistory'
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp } from "lucide-react"

export default function RechargePage() {
  const { user, isLoaded } = useUser()
  const [showHistory, setShowHistory] = useState(false)

  if (!isLoaded) {
    return <div className="flex justify-center items-center min-h-[50vh]">Loading...</div>
  }

  return (
    <div className="w-full">
      <Card className="shadow-sm">
        <CardHeader className="px-4 sm:px-6 py-4 sm:py-6">
          <CardTitle className="text-xl sm:text-2xl">Recharge Wallet</CardTitle>
          <CardDescription className="text-sm sm:text-base">
            Add money to your wallet using UPI payment
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-6">
          <RechargeForm />
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between px-4 sm:px-6 py-4 sm:py-6">
          <div>
            <CardTitle className="text-xl sm:text-2xl">Recharge History</CardTitle>
            <CardDescription className="text-sm sm:text-base">
              View your recharge request history
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className="ml-auto"
            aria-expanded={showHistory}
            aria-label="Toggle history visibility"
          >
            {showHistory ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
            <span className="sr-only">Toggle history</span>
          </Button>
        </CardHeader>
        {showHistory && (
          <CardContent className="px-4 sm:px-6 pb-6">
            <RechargeHistory />
          </CardContent>
        )}
      </Card>
    </div>
  )
}
