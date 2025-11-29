'use client'

import { useState, useEffect } from 'react'
import { X, Link2, Copy, Check, Globe, Lock, Loader2, Trash2 } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { getApiBase } from '@/lib/config'
import { Project, ShareInfo } from '@/lib/types'

interface ShareDialogProps {
  isOpen: boolean
  project: Project | null
  onClose: () => void
}

const API_BASE = getApiBase() + '/api'

export function ShareDialog({ isOpen, project, onClose }: ShareDialogProps) {
  const { token, isAuthenticated } = useAuth()
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null)
  const [isPublic, setIsPublic] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen && project && token) {
      fetchShareInfo()
    }
  }, [isOpen, project, token])

  const fetchShareInfo = async () => {
    if (!project || !token) return
    
    setIsLoading(true)
    setError('')
    
    try {
      const response = await fetch(`${API_BASE}/projects/${project.id}/share`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.shared) {
          setShareInfo(data.share)
          setIsPublic(data.share.is_public)
        } else {
          setShareInfo(null)
        }
      }
    } catch (err) {
      console.error('Failed to fetch share info:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const createOrUpdateShare = async () => {
    if (!project || !token) return
    
    setIsLoading(true)
    setError('')
    
    try {
      const response = await fetch(`${API_BASE}/projects/${project.id}/share`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ is_public: isPublic })
      })
      
      if (response.ok) {
        const data = await response.json()
        setShareInfo(data)
      } else {
        const err = await response.json()
        setError(err.detail || 'Failed to create share link')
      }
    } catch (err) {
      setError('Failed to create share link')
    } finally {
      setIsLoading(false)
    }
  }

  const removeShare = async () => {
    if (!project || !token || !shareInfo) return
    
    setIsLoading(true)
    setError('')
    
    try {
      const response = await fetch(`${API_BASE}/projects/${project.id}/share`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (response.ok) {
        setShareInfo(null)
      } else {
        const err = await response.json()
        setError(err.detail || 'Failed to remove share')
      }
    } catch (err) {
      setError('Failed to remove share')
    } finally {
      setIsLoading(false)
    }
  }

  // 前端自己拼接分享链接，使用当前访问的域名
  const getShareUrl = () => {
    if (!shareInfo) return ''
    // 使用 window.location.origin 获取当前访问地址（支持公网部署）
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `${origin}/shared/${shareInfo.share_token}`
  }

  const copyToClipboard = async () => {
    if (!shareInfo) return
    
    try {
      await navigator.clipboard.writeText(getShareUrl())
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  if (!isOpen) return null

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-mgx-bg-secondary border border-mgx-border rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-mgx-text-primary">Share Project</h2>
            <button onClick={onClose} className="text-mgx-text-muted hover:text-mgx-text-primary transition-colors">
              <X size={20} />
            </button>
          </div>
          <p className="text-mgx-text-secondary">
            Please sign in to share your projects.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-mgx-bg-secondary border border-mgx-border rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link2 className="text-mgx-accent" size={24} />
            <h2 className="text-xl font-semibold text-mgx-text-primary">Share Project</h2>
          </div>
          <button onClick={onClose} className="text-mgx-text-muted hover:text-mgx-text-primary transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Project Name */}
        {project && (
          <div className="mb-6 p-3 bg-mgx-bg-tertiary rounded-lg">
            <p className="text-sm text-mgx-text-muted">Project</p>
            <p className="text-mgx-text-primary font-medium truncate">{project.name}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Share Options */}
        <div className="space-y-4 mb-6">
          <div className="flex items-center justify-between p-4 bg-mgx-bg-tertiary rounded-lg">
            <div className="flex items-center gap-3">
              {isPublic ? (
                <Globe className="text-green-400" size={20} />
              ) : (
                <Lock className="text-yellow-400" size={20} />
              )}
              <div>
                <p className="text-mgx-text-primary font-medium">
                  {isPublic ? 'Public Link' : 'Private Link'}
                </p>
                <p className="text-xs text-mgx-text-muted">
                  {isPublic 
                    ? 'Anyone with the link can view' 
                    : 'Only logged-in users can view'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsPublic(!isPublic)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                isPublic ? 'bg-green-500' : 'bg-mgx-border'
              }`}
            >
              <span
                className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  isPublic ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Share Link */}
        {shareInfo && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-mgx-text-secondary mb-2">
              Share Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={getShareUrl()}
                readOnly
                className="flex-1 px-4 py-2 bg-mgx-bg-tertiary border border-mgx-border rounded-lg
                           text-mgx-text-primary text-sm"
              />
              <button
                onClick={copyToClipboard}
                className="px-4 py-2 bg-mgx-accent hover:bg-mgx-accent-hover text-white rounded-lg
                           flex items-center gap-2 transition-colors"
              >
                {isCopied ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>
            <p className="mt-2 text-xs text-mgx-text-muted">
              Views: {shareInfo.view_count}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {shareInfo ? (
            <>
              <button
                onClick={createOrUpdateShare}
                disabled={isLoading}
                className="flex-1 py-3 bg-mgx-accent hover:bg-mgx-accent-hover disabled:opacity-50
                           text-white font-medium rounded-lg flex items-center justify-center gap-2
                           transition-colors"
              >
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : 'Update Share'}
              </button>
              <button
                onClick={removeShare}
                disabled={isLoading}
                className="px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400
                           rounded-lg flex items-center justify-center transition-colors"
              >
                <Trash2 size={18} />
              </button>
            </>
          ) : (
            <button
              onClick={createOrUpdateShare}
              disabled={isLoading}
              className="w-full py-3 bg-mgx-accent hover:bg-mgx-accent-hover disabled:opacity-50
                         text-white font-medium rounded-lg flex items-center justify-center gap-2
                         transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Link2 size={18} />
                  Create Share Link
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

