import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/signin(.*)',
  '/signup(.*)',
  '/sso-callback',
  '/api/webhook'
])

// Routes that should always redirect to dashboard if logged in
const shouldRedirectToDashboard = createRouteMatcher([
  '/',
  '/signin(.*)',
  '/signup(.*)'
])

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth()
  
  // Redirect unauthenticated users trying to access protected routes to sign in
  if (!isPublicRoute(req) && !userId) {
    return NextResponse.redirect(new URL('/signin', req.url))
  }
  
  // Redirect authenticated users away from public routes like sign-in and sign-up to dashboard
  if (shouldRedirectToDashboard(req) && userId) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}