import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let settled = false

    const settle = (sessionUser) => {
      setUser(sessionUser ?? null)
      if (!settled) {
        settled = true
        setLoading(false)
      }
    }

    // onAuthStateChange fires INITIAL_SESSION on mount (reads storage),
    // then TOKEN_REFRESHED if the access token was expired and got refreshed.
    // We wait for TOKEN_REFRESHED before declaring loading=false so ProtectedRoute
    // never redirects to "/" based on a stale null session.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
        settle(session?.user)
      } else if (event === 'INITIAL_SESSION') {
        if (session) {
          // Valid session in storage — check if token is still alive
          const expiresAt = session.expires_at ?? 0
          const nowSec = Date.now() / 1000
          if (expiresAt > nowSec + 5) {
            // Token is fresh — resolve immediately
            settle(session.user)
          }
          // else: token expired — wait for TOKEN_REFRESHED to fire
        } else {
          // No session at all — no need to wait
          settle(null)
        }
      }
    })

    // Safety net: if Supabase never fires a settling event (network down, etc.)
    // don't block the app forever — give up after 5 seconds
    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true
        setLoading(false)
      }
    }, 5000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
