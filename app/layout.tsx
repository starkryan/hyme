import type { Metadata, Viewport } from 'next'
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
import { dark} from '@clerk/themes'
import { SupportButton } from '@/components/SupportButton'


const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
})

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export const metadata: Metadata = {
  title: {
    default: 'OTPMaya - Virtual Number Service for SMS Verification',
    template: '%s | OTPMaya',
  },
  description: 'Get instant, secure, and reliable virtual phone numbers for SMS verification. OTPMaya provides automated OTP reception services worldwide.',
  keywords: ['OTP', 'virtual number', 'SMS verification', 'temporary phone number', 'one-time password', 'SMS reception', 'verification service'],
  authors: [{ name: 'OTPMaya Team' }],
  creator: 'OTPMaya',
  publisher: 'OTPMaya',
  formatDetection: {
    telephone: true,
    email: false,
    address: false,
    date: false,
  },
  metadataBase: new URL('https://otpmaya.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://otpmaya.com',
    title: 'OTPMaya - Virtual Number Service for SMS Verification',
    description: 'Get instant, secure, and reliable virtual phone numbers for SMS verification.',
    siteName: 'OTPMaya',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'OTPMaya - Virtual Number Service',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OTPMaya - Virtual Number Service for SMS Verification',
    description: 'Get instant, secure, and reliable virtual phone numbers for SMS verification.',
    images: ['/twitter-image.jpg'],
    creator: '@otpmaya',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-video-preview': -1,
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/apple-icon.png',
  },
  manifest: '/site.webmanifest',
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
    <ClerkProvider appearance={{ baseTheme: dark }}>
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
                <SupportButton />
              </Suspense>
            </div>
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  )
}