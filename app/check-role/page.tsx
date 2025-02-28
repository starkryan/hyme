"use client"

import { UserButton, useUser } from "@clerk/nextjs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export default function CheckRole() {
  const { user, isLoaded } = useUser()
  const router = useRouter()

  if (!isLoaded) {
    return <div className="container mx-auto py-10">Loading...</div>
  }

  if (!user) {
    return <div className="container mx-auto py-10">Not logged in</div>
  }

  const userRole = user.publicMetadata?.role as string || "No role assigned"

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>User Role Information</CardTitle>
          <CardDescription>Diagnostic information about your user account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <UserButton afterSignOutUrl="/" />
            <div>
              <p className="font-medium">{user.fullName || user.username}</p>
              <p className="text-sm text-muted-foreground">{user.primaryEmailAddress?.emailAddress}</p>
            </div>
          </div>
          
          <div className="grid gap-2">
            <div className="flex justify-between">
              <span className="font-medium">User ID:</span>
              <span className="text-sm">{user.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Role:</span>
              <span className="text-sm">{userRole}</span>
            </div>
          </div>

          <div className="pt-4">
            <Button variant="outline" onClick={() => router.push('/dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 