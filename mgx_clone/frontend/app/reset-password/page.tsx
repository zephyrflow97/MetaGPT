'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { Lock, ArrowLeft, Loader2, Sparkles, Eye, EyeOff, CheckCircle } from 'lucide-react'
import Link from 'next/link'

function ResetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { resetPassword } = useAuth()
  
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const tokenParam = searchParams.get('token')
    if (tokenParam) {
      setToken(tokenParam)
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    if (!token) {
      setError('Invalid reset link')
      return
    }

    setIsLoading(true)

    try {
      await resetPassword(token, password)
      setIsSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password')
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <div className="text-center">
        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-8 h-8 text-green-400" />
        </div>
        <h2 className="text-2xl font-bold text-mgx-text-primary mb-2">Password reset successful!</h2>
        <p className="text-mgx-text-secondary mb-8">
          Your password has been changed. You can now sign in with your new password.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-mgx-accent hover:bg-mgx-accent-hover
                     text-white font-medium rounded-lg transition-colors"
        >
          Go to Sign In
        </Link>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-bold text-mgx-text-primary mb-2">Invalid Reset Link</h2>
        <p className="text-mgx-text-secondary mb-8">
          This password reset link is invalid or has expired.
        </p>
        <Link
          href="/forgot-password"
          className="inline-flex items-center gap-2 text-mgx-accent hover:text-mgx-accent-hover transition-colors"
        >
          Request a new reset link
        </Link>
      </div>
    )
  }

  return (
    <>
      <h2 className="text-2xl font-bold text-mgx-text-primary mb-2 text-center">
        Reset your password
      </h2>
      <p className="text-mgx-text-secondary mb-8 text-center">
        Enter your new password below
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-mgx-text-secondary mb-2">
            New Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter new password"
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
            Confirm New Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
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
              Resetting...
            </>
          ) : (
            <>
              <Lock size={20} />
              Reset Password
            </>
          )}
        </button>

        <div className="text-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-mgx-text-muted hover:text-mgx-text-secondary transition-colors"
          >
            <ArrowLeft size={16} />
            Back to sign in
          </Link>
        </div>
      </form>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-mgx-bg-primary flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-2 mb-8 justify-center">
          <Sparkles className="w-8 h-8 text-mgx-accent" />
          <span className="text-2xl font-bold text-mgx-text-primary">MGX Clone</span>
        </Link>
        
        <Suspense fallback={
          <div className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-mgx-accent" />
          </div>
        }>
          <ResetPasswordContent />
        </Suspense>
      </div>
    </div>
  )
}

