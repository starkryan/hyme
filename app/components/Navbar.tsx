"use client"

import { useState } from 'react'
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Menu, Wallet, PhoneCall, Receipt, CreditCard } from "lucide-react"
import { UserButton, useAuth, useUser } from "@clerk/nextjs"
import Link from 'next/link'
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { getWalletBalance } from "@/lib/walletService"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useQuery } from "@tanstack/react-query"


const routes = [
  
  {
    label: 'Dashboard',
    icon: PhoneCall,
    href: '/dashboard',
  },
  {
    label: 'Transactions',
    icon: Receipt,
    href: '/transactions',
  },
  {
    label: 'Recharge',
    icon: CreditCard,
    href: '/recharge',
  },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [walletSheetOpen, setWalletSheetOpen] = useState(false)
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const [isLoading, setIsLoading] = useState(false)

  const { data: walletBalance = 0 } = useQuery({
    queryKey: ['walletBalance', user?.id],
    queryFn: () => getWalletBalance(user?.id as string),
    enabled: !!user?.id,
  })

  const authLinks = (
    <div className="flex items-center gap-4">
      <Link href="/signin">
        <Button variant="outline" size="sm">
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
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle  className="text-lg">Wallet Balance</DialogTitle>
              <DialogDescription>
                Current available balance in your account
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
        <Link href="/" className="font-bold text-xl text-primary">
          OTPMaya
        </Link>
        <div className="flex items-center gap-4">
          {isSignedIn && <WalletSheet />}
          {isSignedIn && <UserButton afterSignOutUrl="/" />}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
            <Button 
              variant="outline"
              size="default"
              className="gap-2 px-4 sm:px-6 text-sm sm:text-base w-full sm:w-auto"
            >
              <Menu className="w-4 h-4" />
              Menu
            </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <div className="font-bold text-xl mb-6 text-primary">OTPMaya</div>
              <nav className="flex flex-col gap-4">
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
        </div>
      </div>

      {/* Desktop Navigation */}
      <div className="hidden md:flex items-center justify-between p-4 border-b">
        <div className="container mx-auto flex items-center justify-between max-w-7xl">
          <nav className="flex items-center gap-6">
            <Link href="/" className="font-bold text-xl text-primary mr-8">
              OTPMaya
            </Link>
            {routes.map((route) => (
              <Link
                key={route.href}
                href={route.href}
                className={cn(
                  "flex items-center gap-2 text-sm hover:text-primary transition-colors",
                  "hover:text-accent-foreground"
                )}
              >
                <route.icon className="h-4 w-4" />
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
