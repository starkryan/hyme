"use client"

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
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
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { ChevronDown, Loader2 } from "lucide-react"
import { format } from "date-fns"

interface RechargeRequest {
  id: string
  user_id: string
  amount: number
  status: 'PENDING' | 'COMPLETED' | 'FAILED'
  utr_number: string
  created_at: string
}

export function RechargeHistory() {
  const { user } = useUser()
  const [requests, setRequests] = useState<RechargeRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const loadRequests = async () => {
      if (!user) return
      setIsLoading(true)

      try {
        const { data, error } = await supabase
          .from('recharge_requests')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (error) throw error
        setRequests(data || [])
      } catch (error) {
        console.error('Error loading requests:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadRequests()

    // Set up real-time subscription
    const channel = supabase
      .channel('recharge-requests')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recharge_requests',
          filter: `user_id=eq.${user?.id}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setRequests(prev => [payload.new as RechargeRequest, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setRequests(prev => 
              prev.map(request => 
                request.id === payload.new.id ? payload.new as RechargeRequest : request
              )
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  // Filter and search requests
  const filteredRequests = requests.filter(request => {
    const matchesStatus = statusFilter === 'all' || request.status === statusFilter
    const matchesSearch = searchQuery === '' || 
      request.utr_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      request.amount.toString().includes(searchQuery)
    return matchesStatus && matchesSearch
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'success'
      case 'FAILED':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  if (!user) return null

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Recharge History</CardTitle>
            <CardDescription>View your recharge request history</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="relative w-full sm:w-[200px]">
              <Input
                placeholder="Search UTR or amount..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full sm:w-[120px] justify-between">
                  {statusFilter === 'all' ? 'All Status' : statusFilter}
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[120px]">
                <DropdownMenuLabel>Filter by</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setStatusFilter('all')}>
                  All Status
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('PENDING')}>
                  Pending
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('COMPLETED')}>
                  Completed
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatusFilter('FAILED')}>
                  Failed
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        {isLoading ? (
          <div className="flex h-[200px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="flex h-[200px] flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm text-muted-foreground">No recharge requests found</p>
            {searchQuery && (
              <Button 
                variant="link" 
                onClick={() => setSearchQuery('')}
                className="h-auto p-0"
              >
                Clear search
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="whitespace-nowrap">UTR Number</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(request.created_at), 'MMM dd, yyyy HH:mm')}
                    </TableCell>
                    <TableCell>₹{request.amount}</TableCell>
                    <TableCell className="font-mono max-w-[120px] sm:max-w-none truncate">
                      {request.utr_number}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(request.status)}>
                        {request.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
} 