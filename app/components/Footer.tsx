"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Moon, Sun } from "lucide-react"
import { RiTelegram2Fill } from "react-icons/ri"
import { FaWhatsapp } from "react-icons/fa"


function Footerdemo() {
  const [isDarkMode, setIsDarkMode] = React.useState(false);

  React.useEffect(() => {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode === 'true') {
      setIsDarkMode(true);
    }
  }, []);

  React.useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem('darkMode', 'true');
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem('darkMode', 'false');
    }
  }, [isDarkMode]);

  return (
    <footer className="w-full border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-6 sm:py-8 w-full max-w-7xl">
        <div className="grid gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-2">
          <div>
            <h3 className="mb-4 text-lg font-semibold">OTPMaya</h3>
            <nav className="space-y-2 text-sm">
              <a href="/" className="block transition-colors hover:text-primary">
                Home
              </a>
              <a href="/recharge" className="block transition-colors hover:text-primary">
                Payment
              </a>
              <a href="/transactions" className="block transition-colors hover:text-primary">
                Transactions
              </a>
              <a href="/dashboard" className="block transition-colors hover:text-primary">
                Dashboard
              </a>
              <a href="/support" className="block transition-colors hover:text-primary">
                Support
              </a>
            </nav>
          </div>
          <div className="relative">
            <h3 className="mb-4 text-lg font-semibold">Connect With Us</h3>
            <div className="mb-6 flex space-x-4">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a href="https://wa.me/919826000000">
                      <Button variant="outline" size="icon" className="rounded-full">
                        <FaWhatsapp className="h-4 w-4 text-green-500" />
                        <span className="sr-only">Whatsapp</span>
                      </Button>
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Connect with us on Whatsapp</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a href="https://t.me/otpmaya">
                      <Button variant="outline" size="icon" className="rounded-full">
                        <RiTelegram2Fill className="h-4 w-4 text-blue-500" />
                        <span className="sr-only">Telegram</span>
                      </Button>
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Connect with us on Telegram</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-center space-x-2">
              <Sun className="h-4 w-4" />
              <Switch
                id="dark-mode"
                checked={isDarkMode}
                onCheckedChange={setIsDarkMode}
              />
              <Moon className="h-4 w-4" />
              <Label htmlFor="dark-mode" className="sr-only">
                Toggle dark mode
              </Label>
            </div>
          </div>
        </div>
        <div className="mt-6 sm:mt-8 flex flex-col items-center justify-between gap-4 border-t pt-6 sm:pt-8 text-center md:flex-row">
          <p className="text-sm text-muted-foreground">
            © 2024 OTPMaya. All rights reserved.
          </p>
          <nav className="flex gap-4 text-sm">
            <a href="/privacy" className="transition-colors hover:text-primary">
              Privacy Policy
            </a>
            <a href="/terms-of-service" className="transition-colors hover:text-primary">
              Terms of Service
            </a>
          </nav>
        </div>
      </div>
    </footer>
  )
}

export { Footerdemo }