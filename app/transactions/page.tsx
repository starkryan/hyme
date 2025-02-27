"use client"

import { useState, useEffect, useRef, useCallback } from "react"
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
import { useInfiniteQuery } from "@tanstack/react-query"

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

interface PaginatedTransactionResponse {
  transactions: Transaction[];
  nextCursor: number | null;
  hasMore: boolean;
}

// Number of transactions to fetch per page
const PAGE_SIZE = 10;

export default function TransactionsPage() {
  const { user } = useUser()
  const [searchQuery, setSearchQuery] = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  
  // Reference to the bottom of the transaction list for intersection observer
  const observerRef = useRef<HTMLDivElement>(null);
  
  // Function to fetch transactions with pagination
  const fetchTransactions = async ({ pageParam = 0 }) => {
    if (!user) return { transactions: [], nextCursor: null, hasMore: false };
    
    try {
      // Using the existing getTransactionHistory function
      // This might need to be updated to support pagination in your API
      const transactionHistory = await getTransactionHistory(user.id);
      
      // Simulating pagination until API is updated
      const startIndex = pageParam * PAGE_SIZE;
      const endIndex = startIndex + PAGE_SIZE;
      const transactions = transactionHistory.slice(startIndex, endIndex);
      const hasMore = endIndex < transactionHistory.length;
      
      // Filter transactions based on current filters
      const filteredTransactions = transactions.filter(transaction => {
        const matchesSearch = !searchQuery || 
          (transaction.reference_id?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
          (transaction.description?.toLowerCase().includes(searchQuery.toLowerCase()) || false);
        const matchesType = filterType === "all" || transaction.type === filterType;
        const matchesStatus = filterStatus === "all" || transaction.status === filterStatus;
        return matchesSearch && matchesType && matchesStatus;
      });
      
      return {
        transactions: filteredTransactions,
        nextCursor: hasMore ? pageParam + 1 : null,
        hasMore: hasMore
      } as PaginatedTransactionResponse;
      
    } catch (error) {
      console.error('Failed to load transactions:', error);
      return { transactions: [], nextCursor: null, hasMore: false } as PaginatedTransactionResponse;
    }
  };
  
  // Use TanStack Query's useInfiniteQuery for data fetching with pagination
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch
  } = useInfiniteQuery({
    queryKey: ['transactions', user?.id, filterType, filterStatus, searchQuery],
    queryFn: fetchTransactions,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: 0,
    enabled: !!user,
  });
  
  // Callback for intersection observer to load more when user scrolls to bottom
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const [entry] = entries;
    if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);
  
  // Setup intersection observer to detect when user scrolls to bottom
  useEffect(() => {
    const element = observerRef.current;
    
    if (!element) return;
    
    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: '0px',
      threshold: 1.0
    });
    
    observer.observe(element);
    
    return () => {
      if (element) observer.unobserve(element);
    };
  }, [handleObserver]);
  
  // Refresh data when filters change
  useEffect(() => {
    refetch();
  }, [filterType, filterStatus, searchQuery, refetch]);
  
  // Flatten the pages of transactions into a single array
  const allTransactions = data?.pages.flatMap(page => page.transactions) || [];

  return (
    <div className="w-full">
      <Card className="shadow-sm">
        <CardHeader className="px-4 sm:px-6 py-4 sm:py-6">
          <CardTitle className="text-xl sm:text-2xl">Transaction History</CardTitle>
          <CardDescription className="text-sm sm:text-base">View and manage your transaction history</CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-6">
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
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="CREDIT">Credit</SelectItem>
                  <SelectItem value="DEBIT">Debit</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-[140px]">
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
            ) : isError ? (
              <div className="text-center py-8 text-destructive">
                Error loading transactions. Please try again.
              </div>
            ) : allTransactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No transactions found
              </div>
            ) : (
              <>
                {allTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border gap-2 sm:gap-4"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex flex-wrap items-start sm:items-center gap-2">
                        <p className="text-sm font-medium break-all">
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
                      className="text-sm self-end sm:self-center whitespace-nowrap ml-auto"
                    >
                      {transaction.type === 'CREDIT' ? '+' : '-'}₹{transaction.amount}
                    </Badge>
                  </div>
                ))}
              
                {/* Loading indicator and intersection observer target */}
                <div 
                  ref={observerRef} 
                  className="flex justify-center items-center py-4"
                >
                  {isFetchingNextPage ? (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  ) : hasNextPage ? (
                    <p className="text-sm text-muted-foreground">Scroll for more</p>
                  ) : allTransactions.length > 0 ? (
                    <p className="text-sm text-muted-foreground">No more transactions</p>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 