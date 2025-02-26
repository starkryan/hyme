"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import Hero from './components/Hero';
import { HeroLoadingSkeleton } from './components/ui/loading-skeleton';

function HomePage() {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();

  // Redirect to dashboard if user is already signed in
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.push('/dashboard');
    }
  }, [isLoaded, isSignedIn, router]);

  // Show skeleton loader while checking authentication
  if (!isLoaded) {
    return <HeroLoadingSkeleton />;
  }
  
  // Don't render anything if signed in (will redirect)
  if (isSignedIn) {
    return <HeroLoadingSkeleton />;
  }

  return (
    <div>
      <Hero />
    </div>
  );
}

export default HomePage;
