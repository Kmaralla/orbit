import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,       // store session in localStorage (default, but explicit)
    autoRefreshToken: true,     // silently refresh access token before it expires
    detectSessionInUrl: true,   // pick up tokens from OAuth redirect URLs
    storageKey: 'orbit-auth',   // stable key so session survives Supabase lib upgrades
  },
})
