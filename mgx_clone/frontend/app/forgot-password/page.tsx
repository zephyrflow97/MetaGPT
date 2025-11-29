'use client'

import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { Mail, ArrowLeft, Loader2, Sparkles } from 'lucide-react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      await requestPasswordReset(email)
      setIsSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-mgx-bg-primary flex items-center justify-center p-8">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-2 mb-8 justify-center">
          <Sparkles className="w-8 h-8 text-mgx-accent" />
          <span className="text-2xl font-bold text-mgx-text-primary">MGX Clone</span>
        </Link>

        {isSubmitted ? (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Mail className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-mgx-text-primary mb-2">Check your email</h2>
            <p className="text-mgx-text-secondary mb-8">
              If an account with that email exists, we've sent you a password reset link.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-mgx-accent hover:text-mgx-accent-hover transition-colors"
            >
              <ArrowLeft size={18} />
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-mgx-text-primary mb-2 text-center">
              Forgot your password?
            </h2>
            <p className="text-mgx-text-secondary mb-8 text-center">
              Enter your email and we'll send you a reset link
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
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
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail size={20} />
                    Send Reset Link
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
        )}
      </div>
    </div>
  )
}

