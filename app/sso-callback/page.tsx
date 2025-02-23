"use client";

import { useEffect } from "react";
import { useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

export default function SSOCallback() {
  const { signUp, isLoaded } = useSignUp();
  const router = useRouter();

  useEffect(() => {
    if (!isLoaded) return;

    // Handle the OAuth callback
    const handleCallback = async () => {
      try {
        const result = await signUp.attemptFirstFactor({
          strategy: "oauth_callback",
          redirectUrl: `${window.location.origin}/sso-callback`,
        });

        if (result.status === "complete") {
          router.push("/dashboard");
        }
      } catch (err) {
        console.error("OAuth error:", err);
        router.push("/signup");
      }
    };

    handleCallback();
  }, [isLoaded, signUp, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Completing sign in...</h2>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
      </div>
    </div>
  );
} 