import type { Metadata } from 'next'
import {
  ClerkProvider,
} from '@clerk/nextjs'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'  
import Navbar from "@/app/components/Navbar";
import { Footerdemo } from "@/app/components/Footer";
import { Providers } from '@/app/providers'
import { Skeleton } from "@/components/ui/skeleton"
import { Suspense } from 'react'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'OTPMaya- Virtual Number',
  description: 'OTPMaya',
}

// Create a loading skeleton component
function LoadingSkeleton() {
  return (
    <div className="w-full space-y-4">
      {/* Navbar skeleton */}
      <div className="border-b">
        <div className="flex h-16 items-center px-4">
          <Skeleton className="h-8 w-[120px]" />
          <div className="ml-auto flex items-center space-x-4">
            <Skeleton className="h-8 w-[100px]" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
      </div>
      
      {/* Main content skeleton */}
      <div className="container mx-auto px-4 py-8 w-full max-w-7xl">
        <div className="grid gap-6">
          <Skeleton className="h-[200px] w-full rounded-xl" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-[120px] rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className="h-full">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background`}>
          <Providers>
            <div className="relative flex min-h-screen flex-col">
              <Toaster />
              <Suspense fallback={<LoadingSkeleton />}>
                <Navbar />
                <main className="flex-1">
                  <div className="container mx-auto px-4 py-8 w-full max-w-7xl">
                    {children}
                  </div>
                </main>
                <Footerdemo />
              </Suspense>
            </div>
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  )
}