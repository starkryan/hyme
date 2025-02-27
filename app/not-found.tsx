"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Home, AlertCircle, ArrowLeft } from "lucide-react"

export default function NotFound() {
  const router = useRouter()

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] px-4">
      <Card className="max-w-md w-full shadow-lg border-muted">
        <CardHeader className="space-y-1 flex flex-col items-center text-center pb-2">
          <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-2">
            <AlertCircle className="h-10 w-10 text-muted-foreground" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">404</CardTitle>
          <CardDescription className="text-base">Page not found</CardDescription>
        </CardHeader>
        <CardContent className="text-center space-y-6 py-6">
          <div className="space-y-2">
            <p className="text-muted-foreground">
              The page you're looking for doesn't exist or has been moved.
            </p>
          </div>
          
          {/* 404 illustration */}
          <div className="py-4 flex justify-center">
            <div className="relative w-64 h-48 border-2 border-dashed border-muted-foreground/50 rounded-lg flex items-center justify-center">
              <div className="absolute inset-0 flex items-center justify-center opacity-10">
                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-background"></div>
              </div>
              <div className="text-5xl font-mono text-primary/70 animate-pulse">404</div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row gap-2">
          <Button asChild className="w-full" variant="default">
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Go to Homepage
            </Link>
          </Button>
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => router.back()}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
} 