"use client"

import { useState } from 'react'
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Menu, Home, Settings, User, LogOut } from "lucide-react"
import { useRouter } from 'next/navigation'
import { UserButton, useAuth } from "@clerk/nextjs"
import Link from 'next/link'
import { cn } from "@/lib/utils"

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
  const { isSignedIn } = useAuth()

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

  return (
    <div className="fixed top-0 w-full z-50">
      {/* Mobile Navigation */}
      <div className="md:hidden flex items-center justify-between p-4 border-b bg-background">
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
        {isSignedIn ? (
          <UserButton afterSignOutUrl="/" />
        ) : null}
      </div>

      {/* Desktop Navigation */}
      <div className="hidden md:flex items-center justify-between p-4 border-b bg-background">
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
        {isSignedIn ? (
          <UserButton afterSignOutUrl="/" />
        ) : (
          authLinks
        )}
      </div>
    </div>
  )
}
