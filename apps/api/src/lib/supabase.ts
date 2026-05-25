/**
 * Supabase admin client — backend-only (uses SERVICE_ROLE key).
 *
 * The service role key bypasses Row Level Security and can call
 * supabase.auth.getUser(token) to validate user JWTs server-side.
 *
 * NEVER expose this key to the frontend.
 */
import { createClient } from '@supabase/supabase-js'
import { env } from '../env'

export const supabaseAdmin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession:   false,
    },
  },
)

/**
 * Verify a bearer token and return the Supabase user.
 * Throws a string error message if invalid.
 */
export async function verifyToken(token: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) {
    throw new Error(error?.message ?? 'Invalid or expired token')
  }
  return data.user
}
