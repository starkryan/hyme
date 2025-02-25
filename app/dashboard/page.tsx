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
    <div className="container mx-auto p-4 bg-center flex items-center justify-center h-screen">
      <GetVirtualNumber />
    </div>
  );
};


export default Dashboard;