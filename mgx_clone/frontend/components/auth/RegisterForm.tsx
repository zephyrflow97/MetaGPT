'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { Eye, EyeOff, UserPlus, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface RegisterFormProps {
  onSuccess?: () => void
}

export function RegisterForm({ onSuccess }: RegisterFormProps) {
  const { register } = useAuth()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    // Validate password strength
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError('Password must contain at least one letter and one number')
      return
    }

    setIsLoading(true)

    try {
      await register({
        email,
        username,
        password,
        display_name: displayName || undefined
      })
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-mgx-text-secondary mb-2">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          className="w-full px-4 py-3 bg-[#1a1a2e] border border-mgx-border rounded-lg
                     text-white placeholder-gray-500
                     focus:outline-none focus:ring-2 focus:ring-mgx-accent focus:border-transparent
                     transition-colors"
        />
      </div>

      <div>
        <label htmlFor="username" className="block text-sm font-medium text-mgx-text-secondary mb-2">
          Username
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Choose a username"
          required
          minLength={3}
          maxLength={30}
          pattern="[a-zA-Z0-9_-]+"
          className="w-full px-4 py-3 bg-[#1a1a2e] border border-mgx-border rounded-lg
                     text-white placeholder-gray-500
                     focus:outline-none focus:ring-2 focus:ring-mgx-accent focus:border-transparent
                     transition-colors"
        />
        <p className="mt-1 text-xs text-mgx-text-muted">
          3-30 characters, letters, numbers, underscores, hyphens only
        </p>
      </div>

      <div>
        <label htmlFor="displayName" className="block text-sm font-medium text-mgx-text-secondary mb-2">
          Display Name <span className="text-mgx-text-muted">(optional)</span>
        </label>
        <input
          id="displayName"
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="How you want to be called"
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
            placeholder="Create a strong password"
            required
            minLength={8}
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
        <p className="mt-1 text-xs text-mgx-text-muted">
          At least 8 characters with letters and numbers
        </p>
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-mgx-text-secondary mb-2">
          Confirm Password
        </label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm your password"
          required
          className="w-full px-4 py-3 bg-[#1a1a2e] border border-mgx-border rounded-lg
                     text-white placeholder-gray-500
                     focus:outline-none focus:ring-2 focus:ring-mgx-accent focus:border-transparent
                     transition-colors"
        />
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
            Creating account...
          </>
        ) : (
          <>
            <UserPlus size={20} />
            Create Account
          </>
        )}
      </button>

      <p className="text-center text-sm text-mgx-text-muted">
        Already have an account?{' '}
        <Link href="/login" className="text-mgx-accent hover:text-mgx-accent-hover transition-colors">
          Sign in
        </Link>
      </p>
    </form>
  )
}

