"use client";

import { useState, useRef } from "react";
import { useSignUp } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail, Lock, Eye, EyeOff, Loader2, Github } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp"

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignUpPage() {
  const { signUp, isLoaded } = useSignUp();
  const router = useRouter();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    showPassword: false,
    loading: false
  });
  const [verificationState, setVerificationState] = useState({
    otp: "",
    isDialogOpen: false,
    verifying: false
  });

  const captchaRef = useRef<HTMLDivElement>(null);

  // Add this state to track OAuth loading
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md border border-border shadow-md rounded-lg p-6">
          <Skeleton className="h-8 w-40 mb-3" />
          <Skeleton className="h-5 w-56 mb-6" />
          <Skeleton className="h-10 w-full mb-4" />
          <Skeleton className="h-10 w-full mb-4" />
          <Skeleton className="h-10 w-full" />
        </Card>
      </div>
    );
  }

  const handleSignUp = async () => {
    const { email, password } = formData;
    
    // Basic validation for email format
    if (!email || !emailPattern.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    if (!password || password.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    try {
      setFormData(prev => ({ ...prev, loading: true }));
      
      // Create the user
      const signUpResponse = await signUp.create({ 
        emailAddress: email, 
        password,
      });

      // Check if the user already exists
      if (signUpResponse.status === "complete") {
        // Prepare email verification only if the sign-up was successful
        await signUp.prepareEmailAddressVerification({ 
          strategy: "email_code" 
        });
        
        setVerificationState(prev => ({ ...prev, isDialogOpen: true }));
        toast.info("Please check your email for the verification code");
      } else {
        toast.error("An account with this email already exists. Please sign in instead.");
      }
      
    } catch (err: any) {
      const errorMsg = err.errors?.[0]?.message || "Failed to sign up";
      
      if (err.errors?.[0]?.code === "email_exists") {
        toast.error("An account with this email already exists. Please sign in instead.");
      } else if (err.errors?.[0]?.code === "session_exists") {
        toast.error("You're already signed in. Please sign out first.");
        router.push("/dashboard");
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setFormData(prev => ({ ...prev, loading: false }));
    }
  };

  const handleVerifyOtp = async () => {
    const { otp } = verificationState;
    
    try {
      setVerificationState(prev => ({ ...prev, verifying: true }));
      
      if (!otp || otp.length !== 6) {
        toast.error("Please enter a valid 6-digit verification code");
        return;
      }

      const completeSignUp = await signUp.attemptEmailAddressVerification({ code: otp });
      
      if (completeSignUp.status !== "complete") {
        throw new Error(`Verification failed. Status: ${completeSignUp.status}. Please try again.`);
      }
      
      // Create the session after successful verification
      await completeSignUp.createdSessionId;
      
      toast.success("Email verified successfully! Redirecting...");
      
      // Redirect to dashboard
      router.push("/dashboard");

    } catch (err: any) {
      console.error("Verification error:", err);
      const errorMessage = err.errors?.[0]?.longMessage || err.errors?.[0]?.message || "Failed to verify code";
      
      if (errorMessage.includes("expired")) {
        toast.error("Verification code has expired. Please request a new one.");
      } else if (errorMessage.includes("invalid")) {
        toast.error("Invalid verification code. Please check and try again.");
      } else {
        toast.error(errorMessage);
      }
      
      // Clear the OTP input on error
      setVerificationState(prev => ({ ...prev, otp: "" }));
    } finally {
      setVerificationState(prev => ({ ...prev, verifying: false }));
    }
  };

  return (
    <>
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md border border-border shadow-md rounded-lg">
          <CardHeader className="text-center space-y-3">
            <CardTitle className="text-3xl font-bold text-primary">Sign Up</CardTitle>
            <p className="text-sm text-muted-foreground">Create an account to get started.</p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  required
                  className="pl-10 rounded-md"
                  aria-invalid={!emailPattern.test(formData.email) && formData.email ? "true" : "false"}
                />
                {formData.email && !emailPattern.test(formData.email) && (
                  <p className="text-red-500 text-sm">Invalid email format</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={formData.showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  required
                  className="pl-10 pr-10 rounded-md"
                />
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, showPassword: !prev.showPassword }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-label="Toggle password visibility"
                >
                  {formData.showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {formData.password.length < 6 && <p className="text-red-500 text-sm">Password must be at least 6 characters long</p>}
            </div>

            <div ref={captchaRef} id="clerk-captcha" />

            <Button type="button" className="w-full rounded-md" onClick={handleSignUp} disabled={formData.loading}>
              {formData.loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign Up
            </Button>

            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="w-full"
                disabled={isOAuthLoading}
                onClick={async () => {
                  try {
                    setIsOAuthLoading(true);
                    await signUp.authenticateWithRedirect({
                      strategy: "oauth_google",
                      redirectUrl: `${window.location.origin}/sso-callback`,
                      redirectUrlComplete: `${window.location.origin}/dashboard`,
                      // Add these additional parameters
                      appearance: {
                        elements: {
                          rootBox: {
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                          },
                        },
                      },
                    });
                  } catch (error) {
                    setIsOAuthLoading(false);
                    toast.error("Failed to initiate Google sign-in");
                  }
                }}
              >
                {isOAuthLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FcGoogle className="mr-2 h-5 w-5" />
                )}
                {isOAuthLoading ? "Signing in..." : "Sign up with Google"}
              </Button>
            </div>
          </CardContent>
          <CardFooter className="text-center">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Button variant="link" className="p-0" onClick={() => router.push("/signin")}>
                Sign In
              </Button>
            </p>
          </CardFooter>
        </Card>
      </div>

      <Dialog 
        open={verificationState.isDialogOpen} 
        onOpenChange={(open) => setVerificationState(prev => ({ ...prev, isDialogOpen: open }))}
      >
        <DialogContent className="sm:max-w-md">
          <DialogTitle>Verify Your Email</DialogTitle>
          <DialogDescription>
            We've sent a verification code to your email. Please enter it below.
          </DialogDescription>
          <div className="flex justify-center">
            <InputOTP 
              maxLength={6} 
              value={verificationState.otp} 
              onChange={(value) => setVerificationState(prev => ({ ...prev, otp: value }))}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
              </InputOTPGroup>
              <InputOTPSeparator />
              <InputOTPGroup>
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
          <Button 
            onClick={handleVerifyOtp} 
            className="w-full mt-4"
            disabled={verificationState.verifying || verificationState.otp.length !== 6}
          >
            {verificationState.verifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Verify Email
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
