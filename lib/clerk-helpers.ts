import { clerkClient, currentUser } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Check if the current user is an admin
 * This checks both Clerk user metadata and the admin users table in Supabase
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  try {
    // Get current user from Clerk
    const user = await currentUser();
    if (!user) return false;
    
    // Method 1: Check Clerk public metadata
    // You can set this in Clerk Dashboard: User -> Public Metadata -> Add Key
    const isAdminViaClerk = user.publicMetadata?.role === 'admin';
    if (isAdminViaClerk) return true;
    
    // Method 2: Check Supabase admin users table as backup
    const { data } = await supabase
      .from('clerk_admin_users')
      .select('user_id')
      .eq('user_id', user.id)
      .single();
    
    return !!data;
    
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Add a user to the admin table in Supabase
 * Only existing admins can add new admins
 */
export async function addAdminUser(userIdToAdd: string, emailToAdd: string): Promise<boolean> {
  try {
    // First verify current user is an admin
    const isAdmin = await isCurrentUserAdmin();
    if (!isAdmin) {
      throw new Error('Unauthorized: Only admins can add other admins');
    }
    
    // Add the new admin to Supabase
    const { error } = await supabase
      .from('clerk_admin_users')
      .insert([
        { user_id: userIdToAdd, email: emailToAdd }
      ]);
    
    if (error) throw error;
    return true;
    
  } catch (error) {
    console.error('Error adding admin user:', error);
    return false;
  }
} 