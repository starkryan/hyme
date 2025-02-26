"use client";

import { SignIn, SignUp } from "@clerk/nextjs";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AuthLoadingSkeleton } from "@/app/components/ui/loading-skeleton";

export default function AuthPage() {
  const { isSignedIn, isLoaded } = useUser();
  const router = useRouter();

  // Redirect to dashboard if user is already signed in
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.push('/dashboard');
    }
  }, [isLoaded, isSignedIn, router]);

  // Show skeleton loader while checking authentication or during redirect
  if (!isLoaded || isSignedIn) {
    return <AuthLoadingSkeleton />;
  }

  return (
    <div className="w-full min-h-screen flex flex-col">
      <div className="flex justify-center mt-10 sm:my-auto">
        <SignUp 
          afterSignUpUrl="/dashboard"
          signInUrl="/signin"
        />
      </div>
    </div>
  );
}
