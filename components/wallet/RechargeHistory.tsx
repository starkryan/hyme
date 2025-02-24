"use client"

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { toast } from 'sonner'
import { getRechargeHistoryService } from '@/lib/walletService'
import { RechargeRequest } from '@/types/wallet'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from "@/components/ui/separator"
import { cn } from '@/lib/utils'
import { 
  ChevronDown, 
  ChevronUp, 
  Clock, 
  IndianRupee, 
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Receipt
} from 'lucide-react'
import { ScrollArea } from "@/components/ui/scroll-area"

interface RechargeHistoryProps {
  className?: string
}

export function RechargeHistory({ className }: RechargeHistoryProps) {
  const { user } = useUser()
  const [history, setHistory] = useState<RechargeRequest[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const fetchHistory = async () => {
    if (!user?.id) return
    
    setIsLoading(true)
    setError(null)
    setIsRefreshing(true)
    
    try {
      const data = await getRechargeHistoryService(user.id)
      setHistory(data)
      if (isRefreshing) {
        toast.success('History refreshed')
      }
    } catch (error) {
      console.error('Error fetching recharge history:', error)
      setError('Failed to load recharge history')
      toast.error('Failed to load recharge history')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [user?.id])

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusConfig = (status: string) => {
    const configs = {
      pending: {
        color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        icon: AlertCircle,
        bgColor: 'bg-yellow-50 dark:bg-yellow-950/50'
      },
      completed: {
        color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        icon: CheckCircle,
        bgColor: 'bg-green-50 dark:bg-green-950/50'
      },
      failed: {
        color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        icon: XCircle,
        bgColor: 'bg-red-50 dark:bg-red-950/50'
      },
      default: {
        color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
        icon: Receipt,
        bgColor: 'bg-gray-50 dark:bg-gray-900/50'
      }
    }
    return configs[status.toLowerCase() as keyof typeof configs] || configs.default
  }

  if (!user) return null

  const totalAmount = history.reduce((sum, item) => 
    item.status.toLowerCase() === 'completed' ? sum + item.amount : sum, 0
  )

  return (
    <Card className={cn(
      'w-full overflow-hidden transition-all duration-300 border-none shadow-none bg-transparent',
      'group/card hover:bg-accent/5',
      className
    )}>
      <CardHeader className="pb-4 px-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              Recharge History
            </CardTitle>
            <Badge variant="outline" className="ml-2 animate-in fade-in slide-in-from-right duration-500">
              {history.length} transactions
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchHistory}
              disabled={isRefreshing}
              className="h-8 w-8 transition-all duration-200 hover:text-primary"
            >
              <RefreshCw className={cn(
                "h-4 w-4",
                isRefreshing && "animate-spin"
              )} />
              <span className="sr-only">Refresh history</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 transition-all duration-200 hover:text-primary"
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 transition-transform duration-200" />
              ) : (
                <ChevronDown className="h-4 w-4 transition-transform duration-200" />
              )}
              <span className="sr-only">
                {isExpanded ? 'Collapse history' : 'Expand history'}
              </span>
            </Button>
          </div>
        </div>
        {!isExpanded && history.length > 0 && (
          <div className="flex items-center justify-between mt-2 text-sm text-muted-foreground animate-in fade-in slide-in-from-top duration-500">
            <span>Total Completed Recharges:</span>
            <span className="font-medium flex items-center gap-1 text-primary">
              <IndianRupee className="h-3 w-3" />
              {totalAmount.toLocaleString('en-IN')}
            </span>
          </div>
        )}
      </CardHeader>

      {isExpanded && (
        <CardContent className="px-0 animate-in fade-in slide-in-from-top duration-500">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="relative">
                <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent" />
                <div className="absolute inset-0 animate-ping rounded-full h-12 w-12 border border-primary opacity-20" />
              </div>
              <p className="text-sm text-muted-foreground animate-pulse">
                Loading transaction history...
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-3 text-sm text-destructive py-8">
              <div className="rounded-full bg-destructive/10 p-3">
                <XCircle className="h-6 w-6" />
              </div>
              <p className="font-medium">{error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchHistory}
                className="mt-2"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <div className="rounded-full bg-muted p-4">
                <Receipt className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No recharge history found</p>
              <p className="text-xs text-muted-foreground">
                Your recharge transactions will appear here
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4 px-4">
                <span className="text-sm text-muted-foreground">
                  Showing {history.length} transactions
                </span>
                <span className="text-sm font-medium flex items-center gap-1 text-primary">
                  Total: <IndianRupee className="h-3 w-3" />
                  {totalAmount.toLocaleString('en-IN')}
                </span>
              </div>
              <Separator className="mb-4" />
              <ScrollArea className="h-[400px]">
                <div className="space-y-3 px-4">
                  {history.map((item, index) => {
                    const statusConfig = getStatusConfig(item.status)
                    const StatusIcon = statusConfig.icon
                    
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "group flex items-center justify-between p-4 rounded-lg",
                          "transition-all duration-300",
                          "hover:translate-x-1 hover:shadow-lg hover:shadow-primary/5",
                          "animate-in fade-in slide-in-from-left duration-300",
                          statusConfig.bgColor
                        )}
                        style={{
                          animationDelay: `${index * 50}ms`
                        }}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "flex items-center gap-1 px-2 py-0.5",
                                "transition-colors duration-300",
                                statusConfig.color,
                                "group-hover:bg-background group-hover:text-primary"
                              )}
                            >
                              <StatusIcon className="h-3 w-3" />
                              <span className="capitalize">{item.status.toLowerCase()}</span>
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(item.created_at)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-medium flex items-center text-base group-hover:text-primary transition-colors duration-300">
                              <IndianRupee className="h-3 w-3" />
                              {item.amount.toLocaleString('en-IN')}
                            </span>
                            <Separator orientation="vertical" className="h-4" />
                            <span className="text-xs text-muted-foreground font-mono group-hover:text-foreground transition-colors duration-300">
                              UTR: {item.utr_number}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            </>
          )}
        </CardContent>
      )}
    </Card>
  )
}
