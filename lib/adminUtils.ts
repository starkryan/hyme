import { currentUser } from '@clerk/nextjs/server';

export async function isAdmin(): Promise<boolean> {
  const user = await currentUser();
  if (!user) return false;
  return user.publicMetadata?.role === 'admin';
}

export async function requireAdmin() {
  const isUserAdmin = await isAdmin();
  if (!isUserAdmin) {
    throw new Error('Unauthorized: Admin access required');
  }
}
