import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'OTPMaya - Virtual Phone Numbers for SMS Verification',
  description: 'Get instant, secure, and reliable virtual phone numbers for SMS verification. Our service provides temporary numbers for receiving OTP codes and verification messages securely.',
  keywords: ['virtual number', 'sms verification', 'otp', 'one-time password', 'temporary phone number'],
  alternates: {
    canonical: 'https://otpmaya.shop',
  },
  openGraph: {
    title: 'OTPMaya - Virtual Phone Numbers for SMS Verification',
    description: 'Get instant, secure, and reliable virtual phone numbers for SMS verification.',
    url: 'https://otpmaya.shop',
    siteName: 'OTPMaya',
    images: [
      {
        url: '/og-image.jpg',
        width: 1200,
        height: 630,
      }
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OTPMaya - Virtual Phone Numbers for SMS Verification',
    description: 'Get instant, secure, and reliable virtual phone numbers for SMS verification.',
    images: ['/twitter-image.jpg'],
    creator: '@otpmaya',
  },
}; 