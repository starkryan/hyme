"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow } from "date-fns"
import { useUser } from "@clerk/nextjs"
import { getTransactionHistory } from "@/lib/walletService"
import { Loader2, Search } from "lucide-react"

interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  type: 'CREDIT' | 'DEBIT';
  description: string;
  created_at: string;
  reference_id: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
}

export default function TransactionsPage() {
  const { user } = useUser()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")

  useEffect(() => {
    async function loadTransactions() {
      if (!user) return;
      
      try {
        const transactionHistory = await getTransactionHistory(user.id);
        setTransactions(transactionHistory as Transaction[]); // Type assertion to match state type
      } catch (error) {
        console.error('Failed to load transactions:', error);
        // Optionally add error state handling here
      } finally {
        setIsLoading(false);
      }
    }

    loadTransactions();
  }, [user]);

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = transaction.reference_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         transaction.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesType = filterType === "all" || transaction.type === filterType
    const matchesStatus = filterStatus === "all" || transaction.status === filterStatus
    return matchesSearch && matchesType && matchesStatus
  })

  return (
    <div className="container mx-auto py-8 max-w-5xl">
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>View and manage your transaction history</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search and Filter Controls */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search transactions..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="CREDIT">Credit</SelectItem>
                  <SelectItem value="DEBIT">Debit</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                  <SelectItem value="PENDING">Pending</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Transactions List */}
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No transactions found
              </div>
            ) : (
              filteredTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">
                        {transaction.reference_id}
                      </p>
                      <Badge variant={
                        transaction.status === 'COMPLETED' ? 'default' :
                        transaction.status === 'PENDING' ? 'secondary' : 'destructive'
                      }>
                        {transaction.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {transaction.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {transaction.created_at ? formatDistanceToNow(new Date(transaction.created_at), {
                        addSuffix: true,
                      }) : 'Date not available'}
                    </p>
                  </div>
                  <Badge
                    variant={transaction.type === 'CREDIT' ? 'default' : 'destructive'}
                    className="text-sm"
                  >
                    {transaction.type === 'CREDIT' ? '+' : '-'}₹{transaction.amount}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 