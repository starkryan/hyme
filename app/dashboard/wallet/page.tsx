'use client'

import { useUser } from "@clerk/nextjs"
import { useEffect, useState } from "react"
import { getWallet, rechargeWallet } from "@/lib/walletService"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Wallet } from "lucide-react"

export default function WalletBalance() {
  const { user } = useUser()
  const [balance, setBalance] = useState<number>(0)

  useEffect(() => {
    const loadWallet = async () => {
      if (user?.id) {
        const wallet = await getWallet(user.id)
        setBalance(wallet.balance)
      }
    }

    loadWallet()
  }, [user?.id])

  const handleRecharge = async () => {
    if (user?.id) {
      const amount = 10; // Example amount
      const description = 'Recharge via web';
      await rechargeWallet(user.id, amount, description);
      // Reload wallet balance after recharge
      const wallet = await getWallet(user.id);
      setBalance(wallet.balance);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          Wallet Balance
        </CardTitle>
        <Wallet className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">₹{balance?.toFixed(2) || '0.00'}</div>
        <Button 
          className="mt-4"
          onClick={handleRecharge}
        >
          Recharge Wallet
        </Button>
      </CardContent>
    </Card>
  )
}