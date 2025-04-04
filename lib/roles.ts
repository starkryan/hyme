import { Roles } from '@/types/globals'
import { auth } from '@clerk/nextjs/server'

// Server-side role checker
export const checkRole = async (role: Roles) => {
  const { sessionClaims } = await auth()
  return sessionClaims?.publicMetadata?.role === role
} 