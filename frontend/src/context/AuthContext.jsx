import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import api, { tokens } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(Boolean(tokens.access))

  const loadMe = useCallback(async () => {
    if (!tokens.access) { setUser(null); setLoading(false); return null }
    try {
      const { data } = await api.get('/auth/me/')
      setUser(data)
      return data
    } catch {
      tokens.clear()
      setUser(null)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMe()
    const onLogout = () => setUser(null)
    window.addEventListener('auth:logout', onLogout)
    return () => window.removeEventListener('auth:logout', onLogout)
  }, [loadMe])

  /** Вызывается после успешной проверки кода 2FA */
  const completeLogin = (data) => {
    tokens.set(data)
    setUser(data.user)
  }

  const logout = async () => {
    try { await api.post('/auth/logout/', { refresh: tokens.refresh }) } catch { /* ignore */ }
    tokens.clear()
    setUser(null)
  }

  const value = {
    user,
    loading,
    isAuth: Boolean(user),
    isManager: user?.role === 'manager' || user?.role === 'admin',
    isAdmin: user?.role === 'admin',
    completeLogin,
    logout,
    refreshUser: loadMe,
    setUser,
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
