import { Roles } from '@/types/globals'

// Client-side role checker that doesn't use server-only modules
export const checkRoleClient = (role: Roles, user?: any): boolean => {
  if (!user) {
    // If no user object is passed, return false
    return false
  }
  
  // Check if the current user has the specified role in their metadata
  return user.publicMetadata?.role === role
} 