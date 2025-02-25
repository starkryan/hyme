"use client"

import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Menu, Home, Settings, User, LogOut, Wallet } from "lucide-react"
import { useRouter } from 'next/navigation'
import { UserButton, useAuth, useUser } from "@clerk/nextjs"
import Link from 'next/link'
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDistanceToNow } from "date-fns"
import { getWalletBalance, getTransactionHistory } from "@/lib/walletService"

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

const routes = [
  {
    label: 'OTPMaya',
    icon: Home,
    href: '/',
  },
  {
    label: 'Dashboard',
    icon: Home,
    href: '/dashboard',
  },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [walletSheetOpen, setWalletSheetOpen] = useState(false)
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const [walletBalance, setWalletBalance] = useState<number>(0)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setIsLoading(true);
      try {
        const [balance, history] = await Promise.all([
          getWalletBalance(user.id),
          getTransactionHistory(user.id)
        ]);
        setWalletBalance(balance);
        setTransactions(history);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const authLinks = (
    <div className="flex items-center gap-4">
      <Link href="/signin">
        <Button variant="ghost" size="sm">
          Sign in
        </Button>
      </Link>
      <Link href="/signup">
        <Button variant="default" size="sm">
          Sign up
        </Button>
      </Link>
    </div>
  )

  const WalletSheet = () => (
    <Sheet open={walletSheetOpen} onOpenChange={setWalletSheetOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Wallet className="h-4 w-4" />
          <Badge 
            variant="secondary" 
            className="absolute -top-2 -right-2 h-5 w-auto px-2 text-xs"
          >
            ₹{walletBalance}
          </Badge>
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Wallet Balance</SheetTitle>
          <SheetDescription>
            Your current balance is ₹{walletBalance}
          </SheetDescription>
        </SheetHeader>
        <div className="flex items-center justify-between py-4">
          <Link href="/wallet">
            <Button className="w-full">
              <Wallet className="mr-2 h-4 w-4" />
              Recharge Wallet
            </Button>
          </Link>
        </div>
        <Separator className="my-4" />
        <ScrollArea className="h-[calc(100vh-12rem)] pr-4">
          <div className="space-y-4">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[200px]" />
                    <Skeleton className="h-3 w-[100px]" />
                  </div>
                  <Skeleton className="h-6 w-[80px]" />
                </div>
              ))
            ) : transactions.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No transactions yet
              </div>
            ) : (
              transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {transaction.reference_id}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {transaction.created_at ? formatDistanceToNow(new Date(transaction.created_at), {
                        addSuffix: true,
                      }) : 'Date not available'}
                    </p>
                  </div>
                  <Badge
                    variant={transaction.type === 'CREDIT' ? 'default' : 'destructive'}
                  >
                    {transaction.type === 'CREDIT' ? '+' : '-'}₹{transaction.amount}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )

  return (
    <header className="sticky top-0 w-full z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Mobile Navigation */}
      <div className="md:hidden flex items-center justify-between p-4 border-b">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72">
            <nav className="flex flex-col gap-4 mt-8">
              {routes.map((route) => (
                <Link
                  key={route.href}
                  href={route.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-2 p-3 text-sm hover:bg-accent rounded-lg transition-colors",
                    "hover:text-accent-foreground"
                  )}
                >
                  <route.icon className="h-5 w-5" />
                  {route.label}
                </Link>
              ))}
              {!isSignedIn && (
                <div className="flex flex-col gap-2 mt-4">
                  {authLinks}
                </div>
              )}
            </nav>
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          {isSignedIn && <WalletSheet />}
          {isSignedIn ? (
            <UserButton afterSignOutUrl="/" />
          ) : null}
        </div>
      </div>

      {/* Desktop Navigation */}
      <div className="hidden md:flex items-center justify-between p-4 border-b">
        <div className="container mx-auto flex items-center justify-between max-w-7xl">
          <nav className="flex items-center gap-6">
            {routes.map((route) => (
              <Link
                key={route.href}
                href={route.href}
                className={cn(
                  "flex items-center gap-2 text-sm hover:text-primary transition-colors",
                  "hover:text-accent-foreground"
                )}
              >
                <route.icon className="h-5 w-5" />
                {route.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            {isSignedIn && <WalletSheet />}
            {isSignedIn ? (
              <UserButton afterSignOutUrl="/" />
            ) : (
              authLinks
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
