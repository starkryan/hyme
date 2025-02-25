import type { Metadata } from 'next'
import {
  ClerkProvider,
} from '@clerk/nextjs'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Toaster } from 'sonner'  
import Navbar from "@/app/components/Navbar";
import { Footerdemo } from "@/app/components/Footer";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className="h-full">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background`}>
          <div className="relative flex min-h-screen flex-col">
            <Toaster />
            <Navbar />
            <main className="flex-1">
              <div className="container mx-auto px-4 py-8 w-full max-w-7xl">
                {children}
              </div>
            </main>
            <Footerdemo />
          </div>
        </body>
      </html>
    </ClerkProvider>
  )
}