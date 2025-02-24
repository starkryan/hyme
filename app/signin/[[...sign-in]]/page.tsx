"use client";

import { SignIn } from "@clerk/nextjs";

export default function AuthPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex space-x-10">
 
        <SignIn 
          afterSignInUrl="/dashboard"
          signUpUrl="/signup"
        />
      </div>
    </div>
  );
}
