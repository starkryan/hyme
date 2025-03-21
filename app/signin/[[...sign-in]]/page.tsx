"use client";

import { SignIn } from "@clerk/nextjs";
import { useUser, useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuthLoadingSkeleton } from "@/app/components/ui/loading-skeleton";

export default function AuthPage() {
  const { isSignedIn, isLoaded } = useUser();
  const { getToken } = useAuth();
  const router = useRouter();

  // Redirect to dashboard if user is already signed in
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      console.log("User is signed in, redirecting to dashboard");
      
      // Get token to ensure auth is fully established before redirecting
      getToken().then(() => {
        router.push('/dashboard');
      });
    }
  }, [isLoaded, isSignedIn, router, getToken]);

  // Show skeleton loader while checking authentication or during redirect
  if (!isLoaded || isSignedIn) {
    return <AuthLoadingSkeleton />;
  }

  return (
    <div className="w-full min-h-screen flex flex-col">
      <div className="flex justify-center mt-10 sm:my-auto">
        <SignIn 
          path="/signin"
          routing="path"
          signUpUrl="/signup"
          afterSignInUrl="/dashboard"
          redirectUrl="/dashboard"
        />
      </div>
    </div>
  );
}
