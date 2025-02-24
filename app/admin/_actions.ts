'use server'

import { checkRole } from '@/lib/roles'
import { clerkClient } from '@clerk/nextjs/server'

export async function setRole(formData: FormData) {
  const client = await clerkClient()

  // Check that the user trying to set the role is an admin
  if (!(await checkRole('admin'))) {
    return { message: 'Not Authorized' }
  }

  try {
    const res = await client.users.updateUserMetadata(formData.get('userId') as string, {
      publicMetadata: { role: 'admin' },
    })
    return { message: res.publicMetadata }
  } catch (err) {
    return { message: err }
  }
}

export async function removeRole(formData: FormData) {
  const client = await clerkClient()

  // Check that the user trying to remove the role is an admin
  if (!(await checkRole('admin'))) {
    return { message: 'Not Authorized' }
  }

  try {
    const res = await client.users.updateUserMetadata(formData.get('userId') as string, {
      publicMetadata: { role: null },
    })
    return { message: res.publicMetadata }
  } catch (err) {
    return { message: err }
  }
}