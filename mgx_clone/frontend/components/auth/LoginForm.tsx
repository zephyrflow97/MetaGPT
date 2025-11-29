'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { Eye, EyeOff, LogIn, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface LoginFormProps {
  onSuccess?: () => void
}

export function LoginForm({ onSuccess }: LoginFormProps) {
  const { login } = useAuth()
  const [emailOrUsername, setEmailOrUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      await login({
        email_or_username: emailOrUsername,
        password
      })
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="emailOrUsername" className="block text-sm font-medium text-mgx-text-secondary mb-2">
          Email or Username
        </label>
        <input
          id="emailOrUsername"
          type="text"
          value={emailOrUsername}
          onChange={(e) => setEmailOrUsername(e.target.value)}
          placeholder="Enter your email or username"
          required
          className="w-full px-4 py-3 bg-[#1a1a2e] border border-mgx-border rounded-lg
                     text-white placeholder-gray-500
                     focus:outline-none focus:ring-2 focus:ring-mgx-accent focus:border-transparent
                     transition-colors"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-mgx-text-secondary mb-2">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
            className="w-full px-4 py-3 bg-[#1a1a2e] border border-mgx-border rounded-lg
                       text-white placeholder-gray-500
                       focus:outline-none focus:ring-2 focus:ring-mgx-accent focus:border-transparent
                       transition-colors pr-12"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <Link
          href="/forgot-password"
          className="text-mgx-accent hover:text-mgx-accent-hover transition-colors"
        >
          Forgot password?
        </Link>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-3 bg-mgx-accent hover:bg-mgx-accent-hover disabled:opacity-50
                   text-white font-medium rounded-lg flex items-center justify-center gap-2
                   transition-colors"
      >
        {isLoading ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            Signing in...
          </>
        ) : (
          <>
            <LogIn size={20} />
            Sign In
          </>
        )}
      </button>

      <p className="text-center text-sm text-mgx-text-muted">
        Don't have an account?{' '}
        <Link href="/register" className="text-mgx-accent hover:text-mgx-accent-hover transition-colors">
          Sign up
        </Link>
      </p>
    </form>
  )
}

