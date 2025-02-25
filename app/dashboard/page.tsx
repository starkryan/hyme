'use client';

import GetVirtualNumber from '@/components/5sim/GetVirtualNumber';

import { toast } from 'sonner';
import { useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const Dashboard = () => {
  useEffect(() => {
    toast.success('Dashboard loaded!');
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
        <GetVirtualNumber />
      </div>
    </div>
  );
};


export default Dashboard;