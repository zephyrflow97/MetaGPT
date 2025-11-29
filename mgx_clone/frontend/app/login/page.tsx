'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { LoginForm } from '@/components/auth'
import { Sparkles } from 'lucide-react'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/')
    }
  }, [isAuthenticated, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-mgx-bg-primary flex items-center justify-center">
        <div className="animate-pulse text-mgx-text-muted">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-mgx-bg-primary flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-mgx-bg-secondary to-mgx-bg-primary p-12 flex-col justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Sparkles className="w-8 h-8 text-mgx-accent" />
          <span className="text-2xl font-bold text-mgx-text-primary">MGX Clone</span>
        </Link>
        
        <div>
          <h1 className="text-4xl font-bold text-mgx-text-primary mb-4">
            Build with AI-Powered<br />Multi-Agent Teams
          </h1>
          <p className="text-mgx-text-secondary text-lg">
            Describe your project in natural language and watch as our AI agents collaborate to bring your vision to life.
          </p>
        </div>
        
        <p className="text-mgx-text-muted text-sm">
          &copy; {new Date().getFullYear()} MGX Clone. Built on MetaGPT.
        </p>
      </div>

      {/* Right side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <Sparkles className="w-8 h-8 text-mgx-accent" />
            <span className="text-2xl font-bold text-mgx-text-primary">MGX Clone</span>
          </div>
          
          <h2 className="text-2xl font-bold text-mgx-text-primary mb-2">Welcome back</h2>
          <p className="text-mgx-text-secondary mb-8">Sign in to your account to continue</p>
          
          <LoginForm onSuccess={() => router.push('/')} />
        </div>
      </div>
    </div>
  )
}

