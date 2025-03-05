"use client"

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Menu, Wallet, PhoneCall, Receipt, CreditCard, X, Moon, Sun, BugOff, Bug, ChevronDown, ChevronRight } from "lucide-react"
import { UserButton, useAuth, useUser } from "@clerk/nextjs"
import Link from 'next/link'
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { getWalletBalance } from "@/lib/walletService"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { useQuery } from "@tanstack/react-query"
import { motion, AnimatePresence } from "framer-motion"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Image from "next/image"

// Common routes for all users (minus bug reporting routes)
const commonRoutes = [
  {
    label: 'Dashboard',
    icon: PhoneCall,
    href: '/dashboard',
    description: 'View your OTP services and active numbers',
  },
]

// Bug reporting routes - to be placed in submenu
const bugReportRoutes = [
  {
    label: 'Report Bug',
    icon: BugOff,
    href: '/bug-report',
    description: 'Report an issue with our service',
  },
  {
    label: 'My Bug Reports',
    icon: Bug,
    href: '/my-bug-reports',
    description: 'Track your submitted bug reports',
  },
]

// Routes that should only be shown to non-admin users
const regularUserRoutes = [
  {
    label: 'Transactions',
    icon: Receipt,
    href: '/transactions',
    description: 'Check your transaction history',
  },
  {
    label: 'Recharge',
    icon: CreditCard,
    href: '/recharge',
    description: 'Add funds to your wallet',
  },
]

// Admin routes that only show for admin users
const adminRoutes = [
  {
    label: 'Admin Panel',
    icon: Bug,
    href: '/admin',
    description: 'Access admin dashboard',
  },
  {
    label: 'Bug Management',
    icon: BugOff,
    href: '/admin/bug-reports',
    description: 'Manage user bug reports',
  },
]



export default function Navbar() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isBugMenuOpen, setIsBugMenuOpen] = useState(false);

  useEffect(() => {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode === 'true') {
      setIsDarkMode(true);
    }
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem('darkMode', 'false');
    }
  }, [isDarkMode]);

  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const isAdmin = user?.publicMetadata?.role === 'admin'

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
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="icon" 
                className="relative hover:scale-105 transition-transform"
                onClick={() => setDialogOpen(true)}
              >
                <Wallet className="h-4 w-4" />
                <Badge 
                  variant="secondary" 
                  className="absolute -top-2 -right-2 h-5 w-auto px-2 text-xs animate-in fade-in"
                >
                  ₹{walletBalance}
                </Badge>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Your wallet balance</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle  className="text-lg">Wallet Balance</DialogTitle>
              <DialogDescription>
                Current available balance in your account
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex flex-col gap-4 mt-4">
              <div className="p-6 border rounded-lg bg-accent/50 hover:bg-accent/70 transition-colors">
                <div className="text-3xl font-bold">₹{walletBalance}</div>
                <div className="text-sm text-muted-foreground mt-1">Available Balance</div>
              </div>
              
              {!isAdmin && (
                <Link href="/recharge" onClick={() => setDialogOpen(false)}>
                  <Button className="w-full group" size="lg">
                    Recharge Wallet
                    <CreditCard className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  };

  // Update mobile menu variants for smoother animation
  const mobileMenuVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 }
  };

  const DarkModeToggle = () => (
    <Button 
      variant="ghost" 
      size="icon"
      onClick={() => setIsDarkMode(!isDarkMode)}
      className="relative"
    >
      <AnimatePresence initial={false} mode='wait'>
        <motion.div
          key={isDarkMode ? 'dark' : 'light'}
          initial={{ scale: 0.5, rotate: 0, opacity: 0 }}
          animate={{ 
            scale: 1, 
            rotate: isDarkMode ? 360 : 0,
            opacity: 1,
          }}
          exit={{ 
            scale: 0.5, 
            rotate: isDarkMode ? -360 : 0,
            opacity: 0 
          }}
          transition={{ 
            duration: 0.3,
            ease: "easeInOut"
          }}
          className="absolute"
        >
          {isDarkMode ? (
            <Moon className="h-4 w-4 transition-all" />
          ) : (
            <Sun className="h-4 w-4 transition-all" />
          )}
        </motion.div>
      </AnimatePresence>
    </Button>
  );

  // Bug Reports Dropdown for Desktop
  const BugReportsDropdown = () => (
    <DropdownMenu>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "flex items-center gap-2 text-base font-medium px-4 py-2.5 rounded-md",
                  "hover:bg-accent hover:text-accent-foreground transition-all",
                  "hover:scale-105"
                )}
              >
                <BugOff className="h-5 w-5" />
                Bug Reports
                <ChevronDown className="h-4 w-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Bug reporting options</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DropdownMenuContent align="end" className="w-56">
        {bugReportRoutes.map((route) => (
          <DropdownMenuItem key={route.href} asChild>
            <Link href={route.href} className="flex items-center gap-2 cursor-pointer">
              <route.icon className="h-4 w-4" />
              <span>{route.label}</span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <header className="sticky top-0 w-full z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      {/* Mobile Navigation */}
      <div className="md:hidden">
        <div className="flex items-center justify-between p-4">
          
            <Image src="/logo.webp" alt="OTPMaya Logo" width={32} height={32} />
            {/* <Link href="/" className="font-bold text-xl text-primary">
              OTPMaya
            </Link> */}
        
          
          <div className="flex items-center gap-2">
            {isSignedIn && <WalletSheet />}
            {isSignedIn && <UserButton afterSignOutUrl="/" />}
            <DarkModeToggle />
            
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <AnimatePresence initial={false} mode='wait'>
                <motion.div
                  key={isMenuOpen ? 'close' : 'menu'}
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {isMenuOpen ? (
                    <X className="w-5 h-5" />
                  ) : (
                    <Menu className="w-5 h-5" />
                  )}
                </motion.div>
              </AnimatePresence>
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={mobileMenuVariants}
              transition={{ duration: 0.2 }}
              className="absolute w-full bg-background border-t shadow-lg z-50"
            >
              <nav className="flex flex-col p-4 gap-4">
                {commonRoutes.map((route) => (
                  <Link
                    key={route.href}
                    href={route.href}
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-4 p-4 rounded-lg hover:bg-accent transition-colors font-medium"
                  >
                    <route.icon className="w-6 h-6" />
                    <span>{route.label}</span>
                  </Link>
                ))}
                
                {!isAdmin && (
                  <div className="relative">
                    <button
                      className="flex items-center justify-between w-full gap-4 p-4 rounded-lg hover:bg-accent transition-colors font-medium"
                      onClick={() => setIsBugMenuOpen(!isBugMenuOpen)}
                    >
                      <div className="flex items-center gap-4">
                        <BugOff className="w-6 h-6" />
                        <span>Bug Reports</span>
                      </div>
                      <ChevronRight className={`w-5 h-5 transition-transform ${isBugMenuOpen ? 'rotate-90' : ''}`} />
                    </button>
                    
                    <AnimatePresence>
                      {isBugMenuOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="pl-10 mt-1 space-y-2">
                            {bugReportRoutes.map((route) => (
                              <Link
                                key={route.href}
                                href={route.href}
                                onClick={() => setIsMenuOpen(false)}
                                className="flex items-center gap-4 p-3 rounded-lg hover:bg-accent/80 transition-colors"
                              >
                                <route.icon className="w-5 h-5" />
                                <span>{route.label}</span>
                              </Link>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
                
                {!isAdmin && regularUserRoutes.map((route) => (
                  <Link
                    key={route.href}
                    href={route.href}
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-4 p-4 rounded-lg hover:bg-accent transition-colors font-medium"
                  >
                    <route.icon className="w-6 h-6" />
                    <span>{route.label}</span>
                  </Link>
                ))}
                
                {isAdmin && adminRoutes.map((route) => (
                  <Link
                    key={route.href}
                    href={route.href}
                    onClick={() => setIsMenuOpen(false)}
                    className="flex items-center gap-4 p-4 rounded-lg hover:bg-accent transition-colors font-medium bg-primary/10"
                  >
                    <route.icon className="w-6 h-6" />
                    <span>{route.label}</span>
                  </Link>
                ))}
                
                {!isSignedIn && (
                  <div className="flex flex-col gap-2 mt-4">
                    <Link href="/signin" onClick={() => setIsMenuOpen(false)}>
                      <Button variant="outline" className="w-full">
                        Sign in
                      </Button>
                    </Link>
                    <Link href="/signup" onClick={() => setIsMenuOpen(false)}>
                      <Button className="w-full">
                        Sign up
                      </Button>
                    </Link>
                  </div>
                )}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Desktop Navigation - Fixed container issues */}
      <div className="hidden md:block">
        <div className="container mx-auto flex items-center justify-between max-w-7xl px-4 sm:px-6 lg:px-8 h-16">
          <nav className="flex items-center gap-8">
            <Image src="/logo.webp" alt="OTPMaya Logo" width={32} height={32} />
            <div className="flex items-center gap-6">
              {commonRoutes.map((route) => (
                <TooltipProvider key={route.href}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        href={route.href}
                        className={cn(
                          "flex items-center gap-2 text-base font-medium px-4 py-2.5 rounded-md",
                          "hover:bg-accent hover:text-accent-foreground transition-all",
                          "hover:scale-105"
                        )}
                      >
                        <route.icon className="h-5 w-5" />
                        {route.label}
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{route.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
              
              {!isAdmin && <BugReportsDropdown />}
              
              {!isAdmin && regularUserRoutes.map((route) => (
                <TooltipProvider key={route.href}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        href={route.href}
                        className={cn(
                          "flex items-center gap-2 text-base font-medium px-4 py-2.5 rounded-md",
                          "hover:bg-accent hover:text-accent-foreground transition-all",
                          "hover:scale-105"
                        )}
                      >
                        <route.icon className="h-5 w-5" />
                        {route.label}
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{route.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
              
              {isAdmin && adminRoutes.map((route) => (
                <TooltipProvider key={route.href}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        href={route.href}
                        className={cn(
                          "flex items-center gap-2 text-base font-medium px-4 py-2.5 rounded-md",
                          "bg-primary/10 hover:bg-primary/20 hover:text-accent-foreground transition-all",
                          "hover:scale-105"
                        )}
                      >
                        <route.icon className="h-5 w-5" />
                        {route.label}
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{route.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </nav>
          
          <div className="flex items-center gap-6">
            <DarkModeToggle />
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
