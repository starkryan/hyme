"use client"

import { useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Home, AlertTriangle, RotateCcw } from "lucide-react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Optionally log the error to an error reporting service
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
      <Card className="max-w-md w-full shadow-lg border-muted">
        <CardHeader className="space-y-1 flex flex-col items-center text-center pb-2">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
            <AlertTriangle className="h-10 w-10 text-destructive" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Something went wrong</CardTitle>
          <CardDescription className="text-base">
            We apologize for the inconvenience
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center py-6">
          <div className="space-y-2">
            <p className="text-muted-foreground">
              An unexpected error has occurred. Our team has been notified.
            </p>
            {process.env.NODE_ENV === "development" && (
              <div className="mt-4 p-4 bg-muted/50 rounded-md text-left overflow-auto max-h-32">
                <p className="text-xs font-mono text-destructive">
                  {error.message || "Unknown error"}
                </p>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row gap-2">
          <Button 
            className="w-full" 
            variant="default"
            onClick={() => reset()}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          <Button asChild className="w-full" variant="outline">
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Go to Homepage
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
} 