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
    return <div>Loading...</div>
  }

  return (
    <div className="container max-w-6xl mx-auto py-10 space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Recharge Wallet</CardTitle>
          <CardDescription>
            Add money to your wallet using UPI payment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RechargeForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recharge History</CardTitle>
            <CardDescription>
              View your recharge request history
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className="ml-auto"
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
          <CardContent>
            <RechargeHistory />
          </CardContent>
        )}
      </Card>
    </div>
  )
}
