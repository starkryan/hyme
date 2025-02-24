import { redirect } from 'next/navigation'
import { checkRole } from '@/lib/roles'
import { SearchUsers } from './SearchUsers'
import { clerkClient } from '@clerk/nextjs/server'
import { removeRole, setRole } from './_actions'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RechargeRequests } from '@/components/admin/RechargeRequests'

export default async function AdminDashboard(params: {
  searchParams: Promise<{ search?: string }>
}) {
  if (!checkRole('admin')) {
    redirect('/')
  }

  const query = (await params.searchParams).search
  const client = await clerkClient()
  const users = query ? (await client.users.getUserList({ query })).data : []

  return (
    <div className="container mx-auto py-10">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Admin Dashboard</CardTitle>
          <CardDescription>
            Manage users and system settings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="recharge" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="recharge">Recharge Requests</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="stats">Statistics</TabsTrigger>
            </TabsList>
            
            <TabsContent value="recharge">
              <Card>
                <CardHeader>
                  <CardTitle>Recharge Requests</CardTitle>
                  <CardDescription>
                    Manage user recharge requests and wallet balances
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RechargeRequests />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="users">
              <Card>
                <CardHeader>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>
                    Search and manage user roles
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <SearchUsers />
                    {users.map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <div className="font-medium">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {user.emailAddresses[0]?.emailAddress}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Role: {user.publicMetadata?.role || 'user'}
                          </div>
                        </div>
                        <div className="space-x-2">
                          {user.publicMetadata?.role === 'admin' ? (
                            <form action={removeRole}>
                              <input type="hidden" name="userId" value={user.id} />
                              <button className="bg-destructive text-destructive-foreground hover:bg-destructive/90 px-3 py-2 text-sm rounded-md">
                                Remove Admin
                              </button>
                            </form>
                          ) : (
                            <form action={setRole}>
                              <input type="hidden" name="userId" value={user.id} />
                              <button className="bg-secondary text-secondary-foreground hover:bg-secondary/80 px-3 py-2 text-sm rounded-md">
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
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Total Users
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{users.length}</div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      Admin Users
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {users.filter(user => user.publicMetadata?.role === 'admin').length}
                    </div>
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