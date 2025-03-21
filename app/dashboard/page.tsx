'use client'

import React from 'react'
import GetVirtualNumber from '@/components/5sim/GetVirtualNumber';
import { useUser } from '@clerk/nextjs';
import { Skeleton } from '@/components/ui/skeleton';

function Dashboard() {
  const { isLoaded, isSignedIn } = useUser();

  if (!isLoaded) {
    return (
      <div className='w-full space-y-6'>
        <Skeleton className="h-12 w-[200px] rounded-md mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-[150px] rounded-lg" />
          <Skeleton className="h-[150px] rounded-lg" />
          <Skeleton className="h-[150px] rounded-lg" />
        </div>
        <Skeleton className="h-[400px] rounded-lg mt-4" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className='w-full text-center py-12'>
        <h2 className='text-2xl font-bold mb-2'>Authentication Error</h2>
        <p className='text-gray-500 dark:text-gray-400'>
          Please sign out and sign in again to access your dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className='w-full'>
      <GetVirtualNumber />
    </div>
  )
}

export default Dashboard;