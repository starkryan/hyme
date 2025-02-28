"use client"

import { useState, useEffect } from "react"
import { useRouter } from 'next/navigation'
import { useUser } from "@clerk/nextjs"
import { checkRoleClient } from '@/lib/roles-client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { RechargeRequests } from '@/components/admin/RechargeRequests'
import { Badge } from "@/components/ui/badge"
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { toast } from "sonner"
import { Loader2, Menu, RefreshCw } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

export default function AdminDashboard() {
  const { user, isLoaded, isSignedIn } = useUser()
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [pendingRequests, setPendingRequests] = useState(0)
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    const checkAuthorization = async () => {
      if (!isLoaded) return;

      if (!isSignedIn) {
        toast.error('Please sign in to access this page');
        router.push('/signin');
        return;
      }

      if (!user) {
        toast.error('User data not available');
        router.push('/');
        return;
      }

      const isAdmin = checkRoleClient('admin', user);
      if (!isAdmin) {
        toast.error('You do not have permission to access this page');
        router.push('/');
        return;
      }

      setIsAuthorized(true);
      fetchData();
    };

    checkAuthorization();
  }, [isLoaded, isSignedIn, user, router]);

  // Add realtime subscription for admin dashboard
  useEffect(() => {
    if (!isAuthorized || !user) return;
    
    const channel = supabase
      .channel('admin-dashboard')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recharge_requests'
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthorized, user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch pending recharge requests count
      const { count, error } = await supabase
        .from('recharge_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'PENDING');
      
      if (error) throw error;
      setPendingRequests(count || 0);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
    toast.success('Dashboard data refreshed');
  };

  if (!isLoaded || loading) {
    return (
      <div className="container mx-auto py-10 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="container mx-auto py-4 sm:py-8 px-4 sm:px-6">
      {/* Mobile Header */}
      <div className="flex items-center justify-between mb-4 md:hidden">
        <h1 className="text-xl font-bold">Admin</h1>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <div className="py-4">
                <h2 className="text-lg font-medium mb-4">Admin Actions</h2>
                <div className="flex flex-col gap-2">
                  <Button variant="ghost" asChild className="justify-start">
                    <Link href="/admin">Dashboard</Link>
                  </Button>
                  <Button variant="ghost" asChild className="justify-start">
                    <Link href="/admin/bug-reports">Bug Reports</Link>
                  </Button>
                  <Button variant="ghost" asChild className="justify-start">
                    <Link href="/admin/settings">Settings</Link>
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:flex md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back, {user?.firstName}</p>
        </div>
        <Button 
          variant="outline" 
          className="gap-2" 
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Stats - Mobile optimized */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6">
        <Card className="shadow-sm">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent className="py-2 px-4">
            <div className="text-xl md:text-2xl font-bold">{pendingRequests}</div>
          </CardContent>
        </Card>

        {/* Only show more stats on desktop */}
        <Card className="shadow-sm hidden md:block">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium">Processed Today</CardTitle>
          </CardHeader>
          <CardContent className="py-2 px-4">
            <div className="text-xl md:text-2xl font-bold">0</div>
          </CardContent>
        </Card>

        <Card className="shadow-sm hidden md:block">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
          </CardHeader>
          <CardContent className="py-2 px-4">
            <Badge variant="outline" className="bg-green-50">Operational</Badge>
          </CardContent>
        </Card>
      </div>

      {/* Main Content - Responsive */}
      <Card className="shadow-sm mb-6">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base md:text-lg">Recharge Requests</CardTitle>
              <CardDescription className="hidden md:block">Review and manage user requests</CardDescription>
            </div>
            {pendingRequests > 0 && (
              <Badge variant="destructive">
                {pendingRequests} pending
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px] md:h-[500px]">
            <RechargeRequests />
          </ScrollArea>
        </CardContent>
        <CardFooter className="border-t p-3 md:p-4">
          <Link 
            href="/admin/settings" 
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            View all requests →
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}