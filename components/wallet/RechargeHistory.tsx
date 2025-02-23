"use client"

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Loader2, Clock, CheckCircle2, XCircle } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from '@/lib/utils'
import { getRechargeHistoryService } from '@/lib/walletService'
import type { RechargeHistory } from '@/types/wallet'

interface RechargeHistoryProps {
  className?: string
}

const statusConfig = {
  PENDING: {
    label: 'Pending',
    icon: Clock,
    className: 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20'
  },
  COMPLETED: {
    label: 'Completed',
    icon: CheckCircle2,
    className: 'bg-green-500/10 text-green-500 hover:bg-green-500/20'
  },
  FAILED: {
    label: 'Failed',
    icon: XCircle,
    className: 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
  }
} as const

export function RechargeHistory({ className }: RechargeHistoryProps) {
  const { user } = useUser()
  const [history, setHistory] = useState<RechargeHistory[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user?.id) return
      
      setIsLoading(true)
      try {
        const data = await getRechargeHistoryService(user.id)
        setHistory(data)
      } catch (error) {
        console.error('Error fetching recharge history:', error)
        toast.error('Failed to load recharge history')
      } finally {
        setIsLoading(false)
      }
    }

    fetchHistory()
  }, [user?.id])

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="text-xl">Recharge History</CardTitle>
        <CardDescription>Your recent wallet recharge transactions</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-muted-foreground">No recharge history found</p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>UTR Number</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((item) => {
                  const status = statusConfig[item.status]
                  const StatusIcon = status.icon
                  
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(item.created_at), 'MMM dd, yyyy')}
                      </TableCell>
                      <TableCell>₹{item.amount}</TableCell>
                      <TableCell className="font-mono">{item.utr_number}</TableCell>
                      <TableCell>
                        <Badge 
                          variant="secondary"
                          className={cn(
                            "flex w-fit items-center gap-1",
                            status.className
                          )}
                        >
                          <StatusIcon className="h-3 w-3" />
                          <span>{status.label}</span>
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
