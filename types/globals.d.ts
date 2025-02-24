export {}

// Create a type for the roles
export type Roles = 'admin' | 'moderator'

declare global {
  interface CustomJwtSessionClaims {
    publicMetadata: {
      role?: Roles
    }
  }
}