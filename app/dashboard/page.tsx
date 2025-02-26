'use client';

import GetVirtualNumber from '@/components/5sim/GetVirtualNumber';
import { DashboardLoadingSkeleton } from '@/app/components/ui/loading-skeleton';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const Dashboard = () => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate loading time to show skeleton (remove in production)
    const timer = setTimeout(() => {
      setIsLoading(false);
      toast.success('Dashboard loaded!');
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6 px-4 space-y-6">
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Get virtual numbers for OTP verification.
          </p>
        </div>
        
        {isLoading ? (
          // Show skeleton while component is loading
          <div className="mt-6">
            <div className="rounded-lg border bg-card text-card-foreground shadow">
              <div className="p-6">
                <DashboardLoadingSkeleton />
              </div>
            </div>
          </div>
        ) : (
          <GetVirtualNumber />
        )}
      </div>
    </div>
  );
};

export default Dashboard;