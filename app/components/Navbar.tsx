"use client"

import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Menu, Home, Wallet } from "lucide-react"
import { UserButton, useAuth, useUser } from "@clerk/nextjs"
import Link from 'next/link'
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDistanceToNow } from "date-fns"
import { getWalletBalance, getTransactionHistory } from "@/lib/walletService"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { Loader2 } from "lucide-react"

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
  {
    label: 'Transactions',
    icon: Wallet,
    href: '/transactions',
  },
  {
    label: 'Recharge',
    icon: Wallet,
    href: '/recharge',
  },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [walletSheetOpen, setWalletSheetOpen] = useState(false)
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const [walletBalance, setWalletBalance] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setIsLoading(true);
      try {
        const balance = await getWalletBalance(user.id);
        setWalletBalance(balance);
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

  const WalletSheet = () => {
    const [dialogOpen, setDialogOpen] = useState(false);

    return (
      <>
        <Button 
          variant="outline" 
          size="icon" 
          className="relative"
          onClick={() => setDialogOpen(true)}
        >
          <Wallet className="h-4 w-4" />
          <Badge 
            variant="secondary" 
            className="absolute -top-2 -right-2 h-5 w-auto px-2 text-xs"
          >
            ₹{walletBalance}
          </Badge>
        </Button>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Wallet Balance</DialogTitle>
              <DialogDescription>
                Your current balance is ₹{walletBalance}
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex flex-col gap-4 mt-4">
              <div className="p-4 border rounded-lg">
                <div className="text-2xl font-bold">₹{walletBalance}</div>
                <div className="text-sm text-muted-foreground">Available Balance</div>
              </div>
              
              <Link href="/recharge" onClick={() => setDialogOpen(false)}>
                <Button className="w-full" size="lg">
                  Recharge Wallet
                </Button>
              </Link>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  };

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
