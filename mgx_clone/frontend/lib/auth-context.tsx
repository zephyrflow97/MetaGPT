'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { User, AuthResponse, LoginRequest, RegisterRequest } from './types'
import { getApiBase } from './config'

const API_BASE = getApiBase() + '/api'

interface AuthContextType {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (credentials: LoginRequest) => Promise<void>
  register: (data: RegisterRequest) => Promise<void>
  logout: () => void
  updateProfile: (data: { display_name?: string; avatar_url?: string }) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  resetPassword: (token: string, newPassword: string) => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const TOKEN_KEY = 'mgx_auth_token'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load token from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY)
    if (savedToken) {
      setToken(savedToken)
      fetchUser(savedToken)
    } else {
      setIsLoading(false)
    }
  }, [])

  const fetchUser = async (authToken: string) => {
    try {
      const response = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })
      
      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
      } else {
        // Token invalid, clear it
        localStorage.removeItem(TOKEN_KEY)
        setToken(null)
        setUser(null)
      }
    } catch (error) {
      console.error('Failed to fetch user:', error)
      localStorage.removeItem(TOKEN_KEY)
      setToken(null)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  const login = async (credentials: LoginRequest) => {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Login failed')
    }

    const data: AuthResponse = await response.json()
    localStorage.setItem(TOKEN_KEY, data.access_token)
    setToken(data.access_token)
    setUser({
      id: data.id,
      email: data.email,
      username: data.username,
      display_name: data.display_name,
      avatar_url: data.avatar_url,
      is_active: data.is_active,
      created_at: data.created_at,
      updated_at: data.updated_at
    })
  }

  const register = async (data: RegisterRequest) => {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Registration failed')
    }

    const authData: AuthResponse = await response.json()
    localStorage.setItem(TOKEN_KEY, authData.access_token)
    setToken(authData.access_token)
    setUser({
      id: authData.id,
      email: authData.email,
      username: authData.username,
      display_name: authData.display_name,
      avatar_url: authData.avatar_url,
      is_active: authData.is_active,
      created_at: authData.created_at,
      updated_at: authData.updated_at
    })
  }

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }, [])

  const updateProfile = async (data: { display_name?: string; avatar_url?: string }) => {
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(`${API_BASE}/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to update profile')
    }

    const updatedUser = await response.json()
    setUser(updatedUser)
  }

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!token) throw new Error('Not authenticated')

    const response = await fetch(`${API_BASE}/auth/password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to change password')
    }
  }

  const requestPasswordReset = async (email: string) => {
    const response = await fetch(`${API_BASE}/auth/password-reset-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to request password reset')
    }
  }

  const resetPassword = async (resetToken: string, newPassword: string) => {
    const response = await fetch(`${API_BASE}/auth/password-reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: resetToken,
        new_password: newPassword
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.detail || 'Failed to reset password')
    }
  }

  const refreshUser = async () => {
    if (token) {
      await fetchUser(token)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        updateProfile,
        changePassword,
        requestPasswordReset,
        resetPassword,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Helper to get auth header for API calls
export function getAuthHeader(token: string | null): HeadersInit {
  if (!token) return {}
  return { 'Authorization': `Bearer ${token}` }
}

