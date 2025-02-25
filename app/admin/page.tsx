import { redirect } from 'next/navigation'
import { checkRole } from '@/lib/roles'

import { clerkClient } from '@clerk/nextjs/server'
import { removeRole, setRole } from './_actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RechargeRequests } from '@/components/admin/RechargeRequests'
import { Badge } from "@/components/ui/badge"
import { createClient } from '@supabase/supabase-js'

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function AdminDashboard(params: {
  searchParams: Promise<{ search?: string }>
}) {
  if (!checkRole('admin')) {
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
              </Card>
            </TabsContent>

            <TabsContent value="users">
              <Card className="border-0 shadow-none">
                <CardHeader className="px-2 sm:px-6">
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>Search and manage user roles</CardDescription>
                </CardHeader>
                <CardContent className="px-2 sm:px-6">
                  <div className="space-y-4">
                    {users.map((user) => (
                      <div key={user.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg space-y-3 sm:space-y-0 hover:bg-muted/50 transition-colors">
                        <div className="space-y-1">
                          <div className="font-medium">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {user.emailAddresses[0]?.emailAddress}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Role: <Badge variant="outline">{user.publicMetadata?.role || 'user'}</Badge>
                          </div>
                        </div>
                        <div className="w-full sm:w-auto">
                          {user.publicMetadata?.role === 'admin' ? (
                            <form action={removeRole}>
                              <input type="hidden" name="userId" value={user.id} />
                              <button className="w-full sm:w-auto bg-destructive text-destructive-foreground hover:bg-destructive/90 px-4 py-2 text-sm rounded-md transition-colors">
                                Remove Admin
                              </button>
                            </form>
                          ) : (
                            <form action={setRole}>
                              <input type="hidden" name="userId" value={user.id} />
                              <button className="w-full sm:w-auto bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 text-sm rounded-md transition-colors">
                                Make Admin
                              </button>
                            </form>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
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