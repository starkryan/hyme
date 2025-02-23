import { RechargeRequests } from '@/components/admin/RechargeRequests';
import { auth } from '@clerk/nextjs';
import { redirect } from 'next/navigation';

// List of admin user IDs
const ADMIN_IDS = ['user_2ZHc7ZyVNg5G75YWcLuA4Vw9X6N']; // Replace with your admin user IDs

export default async function AdminPage() {
  const { userId, sessionClaims } = auth();
  
  if (!userId) {
    redirect('/sign-in?redirect_url=/admin');
  }

  const role = sessionClaims?.metadata?.role;
  console.log('Admin page check:', { userId, role, metadata: sessionClaims?.metadata });
  
  if (role !== 'admin') {
    return (
      <div className="container mx-auto py-8">
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Access Denied</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>You do not have permission to access the admin panel. Please contact an administrator if you believe this is a mistake.</p>
                <p className="mt-2">User ID: {userId}</p>
                <p>Current Role: {role || 'none'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      </div>
      <RechargeRequests />
    </div>
  );
}
