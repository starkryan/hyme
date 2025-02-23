import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Create matchers for protected routes
const isProtectedRoute = createRouteMatcher(['/dashboard(.*)', '/forum(.*)']);
const isAdminRoute = createRouteMatcher(['/admin(.*)']);

export default clerkMiddleware(async (auth, req) => {
  console.log('Middleware running for path:', req.nextUrl.pathname);
  
  // Handle admin routes first
  if (isAdminRoute(req)) {
    console.log('Admin route detected');
    const { userId, sessionClaims } = auth;
    
    // Debug log
    console.log('Auth state:', {
      userId,
      hasSession: !!auth.session,
      sessionClaims,
      url: req.url
    });

    if (!userId) {
      console.log('No userId found, redirecting to sign in');
      const signInUrl = new URL('/sign-in', req.url);
      signInUrl.searchParams.set('redirect_url', req.url);
      return Response.redirect(signInUrl);
    }

    const role = sessionClaims?.metadata?.role;
    console.log('Admin check:', {
      userId,
      metadata: sessionClaims?.metadata,
      role
    });

    if (role !== 'admin') {
      console.log('User is not admin, returning 403');
      return Response.json(
        { 
          error: 'Unauthorized', 
          message: 'Admin access required',
          metadata: sessionClaims?.metadata 
        },
        { status: 403 }
      );
    }

    console.log('Admin access granted');
  }
  // Handle other protected routes
  else if (isProtectedRoute(req)) {
    console.log('Protected route detected, protecting...');
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!.*\\.[^.]*$|_next).*)',
    // Optional: Match API routes
    '/(api|trpc)(.*)'
  ]
};