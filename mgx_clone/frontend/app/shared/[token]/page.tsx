'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { Sparkles, Eye, Lock, Loader2, ExternalLink, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { getApiBase, getPreviewUrl } from '@/lib/config'
import { Project } from '@/lib/types'

const API_BASE = getApiBase() + '/api'

export default function SharedProjectPage() {
  const params = useParams()
  const shareToken = params.token as string
  const { token: authToken } = useAuth()
  
  const [project, setProject] = useState<Project | null>(null)
  const [shareInfo, setShareInfo] = useState<{ is_public: boolean; view_count: number } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requiresAuth, setRequiresAuth] = useState(false)
  const [iframeKey, setIframeKey] = useState(0)

  useEffect(() => {
    fetchSharedProject()
  }, [shareToken, authToken])

  const fetchSharedProject = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const headers: HeadersInit = {}
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`
      }

      const response = await fetch(`${API_BASE}/shared/${shareToken}`, { headers })

      if (response.status === 401) {
        setRequiresAuth(true)
        setError('This project requires you to sign in to view.')
        return
      }

      if (!response.ok) {
        const err = await response.json()
        setError(err.detail || 'Project not found or link expired')
        return
      }

      const data = await response.json()
      setProject(data.project)
      setShareInfo(data.share_info)
    } catch (err) {
      setError('Failed to load shared project')
    } finally {
      setIsLoading(false)
    }
  }

  const refreshPreview = () => {
    setIframeKey(prev => prev + 1)
  }

  const openInNewTab = () => {
    if (project) {
      window.open(getPreviewUrl(project.id), '_blank')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-mgx-bg-primary flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-mgx-accent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-mgx-bg-primary flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-mgx-bg-secondary rounded-full flex items-center justify-center mx-auto mb-6">
            {requiresAuth ? (
              <Lock className="w-8 h-8 text-yellow-400" />
            ) : (
              <Eye className="w-8 h-8 text-mgx-text-muted" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-mgx-text-primary mb-2">
            {requiresAuth ? 'Sign In Required' : 'Project Not Found'}
          </h1>
          <p className="text-mgx-text-secondary mb-8">{error}</p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/"
              className="px-6 py-3 bg-mgx-bg-secondary hover:bg-mgx-bg-tertiary text-mgx-text-primary
                         rounded-lg transition-colors"
            >
              Go Home
            </Link>
            {requiresAuth && (
              <Link
                href="/login"
                className="px-6 py-3 bg-mgx-accent hover:bg-mgx-accent-hover text-white
                           rounded-lg transition-colors"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-mgx-bg-primary flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-mgx-border bg-mgx-bg-secondary px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-mgx-accent" />
              <span className="text-xl font-bold text-mgx-text-primary">MGX Clone</span>
            </Link>
            <span className="text-mgx-text-muted">|</span>
            <div>
              <h1 className="text-lg font-semibold text-mgx-text-primary">
                {project?.name}
              </h1>
              <p className="text-sm text-mgx-text-muted">
                {shareInfo?.view_count || 0} views
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {shareInfo?.is_public ? (
              <span className="flex items-center gap-1 text-sm text-green-400">
                <Eye size={16} />
                Public
              </span>
            ) : (
              <span className="flex items-center gap-1 text-sm text-yellow-400">
                <Lock size={16} />
                Private
              </span>
            )}
            <button
              onClick={refreshPreview}
              className="p-2 rounded-lg bg-mgx-bg-tertiary hover:bg-mgx-bg-primary text-mgx-text-secondary hover:text-mgx-text-primary transition-colors"
              title="Refresh Preview"
            >
              <RefreshCw size={18} />
            </button>
            <button
              onClick={openInNewTab}
              className="p-2 rounded-lg bg-mgx-bg-tertiary hover:bg-mgx-bg-primary text-mgx-text-secondary hover:text-mgx-text-primary transition-colors"
              title="Open in New Tab"
            >
              <ExternalLink size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Preview Content */}
      <div className="flex-1 min-h-0 bg-white">
        {project?.workspace_path ? (
          <iframe
            key={iframeKey}
            src={getPreviewUrl(project.id)}
            className="w-full h-full border-0"
            title={`Preview of ${project.name}`}
            style={{ minHeight: '100%' }}
          />
        ) : (
          <div className="h-full flex items-center justify-center bg-mgx-bg-primary">
            <div className="text-center">
              <Eye className="w-16 h-16 text-mgx-text-muted mx-auto mb-4" />
              <h3 className="text-lg font-medium text-mgx-text-primary mb-2">
                Preview Not Available
              </h3>
              <p className="text-sm text-mgx-text-muted">
                This project doesn't have a preview available.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
