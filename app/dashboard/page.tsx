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
      
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold mb-4 text-center">
          5sim Service Dashboard
        </h1>
        <div className="grid grid-cols-1 gap-4">
          {/* <Balance /> */}
          <GetVirtualNumber />
          {/* <ProductList /> */}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;