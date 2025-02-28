import { redirect } from 'next/navigation'
import { checkRoleClient } from '@/lib/roles-client'
import { clerkClient } from '@clerk/nextjs/server'

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RechargeRequests } from '@/components/admin/RechargeRequests'
import { Badge } from "@/components/ui/badge"
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default async function AdminDashboard(params: {
  searchParams: Promise<{ search?: string }>
}) {
  if (!checkRoleClient('admin')) {
    redirect('/')
  }

  const query = (await params.searchParams).search
  const client = await clerkClient()
  const users = query ? (await client.users.getUserList({ query })).data : []

  // Fetch pending recharge requests count
  const { count } = await supabase
    .from('recharge_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'PENDING');

  const pendingRequests = count || 0;

  return (
    <div className="container mx-auto py-6 sm:py-10 px-4 sm:px-6">
      <Card>
        <CardContent className="p-2 sm:p-6">
          <Tabs defaultValue="recharge" className="space-y-6">
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 gap-2">
              <TabsTrigger value="recharge" className="flex items-center justify-center gap-2">
                <span>Recharge Requests</span>
                {pendingRequests > 0 && (
                  <Badge variant="secondary">{pendingRequests}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="users">User Management</TabsTrigger>
              <TabsTrigger value="stats">Dashboard</TabsTrigger>
            </TabsList>
            
            <TabsContent value="recharge">
              <Card className="border-0 shadow-none">
                <CardHeader className="px-2 sm:px-6">
                  <CardTitle>Pending Recharge Requests</CardTitle>
                  <CardDescription>Review and manage user recharge requests</CardDescription>
                </CardHeader>
                <CardContent className="px-0 sm:px-6">
                  <RechargeRequests />
                </CardContent>
                <CardFooter className="px-2 sm:px-6 pt-0">
                  <Link href="/admin/bug-reports" className="text-primary hover:underline text-sm">
                    Manage Bug Reports →
                  </Link>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="stats">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card className="hover:bg-muted/50 transition-colors">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{users.length}</div>
                    <p className="text-xs text-muted-foreground">
                      Registered users on the platform
                    </p>
                  </CardContent>
                </Card>
                
                <Card className="hover:bg-muted/50 transition-colors">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Admin Users</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {users.filter(user => user.publicMetadata?.role === 'admin').length}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Users with admin privileges
                    </p>
                  </CardContent>
                </Card>

                <Card className="hover:bg-muted/50 transition-colors">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Pending Requests</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{pendingRequests}</div>
                    <p className="text-xs text-muted-foreground">
                      Awaiting approval
                    </p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}