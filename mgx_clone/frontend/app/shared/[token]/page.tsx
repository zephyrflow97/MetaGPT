'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { Sparkles, FileCode, Download, Eye, Lock, Loader2, ChevronRight, ChevronDown, File, Folder } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { Project, FileInfo } from '@/lib/types'

const API_BASE = 'http://localhost:8000/api'

interface FileNode {
  name: string
  path: string
  isDir: boolean
  children: FileNode[]
}

function buildFileTree(files: FileInfo[]): FileNode[] {
  const root: FileNode[] = []
  const map = new Map<string, FileNode>()

  // Sort files to ensure directories come before their contents
  const sortedFiles = [...files].sort((a, b) => a.path.localeCompare(b.path))

  for (const file of sortedFiles) {
    const parts = file.path.split('/')
    let currentLevel = root
    let currentPath = ''

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      currentPath = currentPath ? `${currentPath}/${part}` : part
      const isLast = i === parts.length - 1

      let node = map.get(currentPath)
      if (!node) {
        node = {
          name: part,
          path: currentPath,
          isDir: !isLast,
          children: []
        }
        map.set(currentPath, node)
        currentLevel.push(node)
      }
      currentLevel = node.children
    }
  }

  return root
}

function FileTreeNode({ 
  node, 
  selectedFile, 
  onSelect, 
  level = 0 
}: { 
  node: FileNode
  selectedFile: string | null
  onSelect: (path: string) => void
  level?: number
}) {
  const [isExpanded, setIsExpanded] = useState(level < 2)

  if (node.isDir) {
    return (
      <div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center gap-1 px-2 py-1 hover:bg-mgx-bg-tertiary rounded text-left"
          style={{ paddingLeft: `${level * 12 + 8}px` }}
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Folder size={14} className="text-yellow-400" />
          <span className="text-sm text-mgx-text-secondary truncate">{node.name}</span>
        </button>
        {isExpanded && (
          <div>
            {node.children.map((child) => (
              <FileTreeNode
                key={child.path}
                node={child}
                selectedFile={selectedFile}
                onSelect={onSelect}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <button
      onClick={() => onSelect(node.path)}
      className={`w-full flex items-center gap-2 px-2 py-1 rounded text-left ${
        selectedFile === node.path ? 'bg-mgx-accent/20 text-mgx-accent' : 'hover:bg-mgx-bg-tertiary text-mgx-text-secondary'
      }`}
      style={{ paddingLeft: `${level * 12 + 8}px` }}
    >
      <File size={14} />
      <span className="text-sm truncate">{node.name}</span>
    </button>
  )
}

export default function SharedProjectPage() {
  const params = useParams()
  const shareToken = params.token as string
  const { token: authToken, isAuthenticated } = useAuth()
  
  const [project, setProject] = useState<Project | null>(null)
  const [shareInfo, setShareInfo] = useState<{ is_public: boolean; view_count: number } | null>(null)
  const [files, setFiles] = useState<FileInfo[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requiresAuth, setRequiresAuth] = useState(false)

  const fileTree = useMemo(() => buildFileTree(files), [files])

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

      // Fetch files
      const filesResponse = await fetch(`${API_BASE}/shared/${shareToken}/files`, { headers })
      if (filesResponse.ok) {
        const filesData = await filesResponse.json()
        setFiles(filesData.files || [])
      }
    } catch (err) {
      setError('Failed to load shared project')
    } finally {
      setIsLoading(false)
    }
  }

  const loadFileContent = async (path: string) => {
    if (!project) return

    try {
      const response = await fetch(
        `${API_BASE}/projects/${project.id}/files/${encodeURIComponent(path)}`
      )
      if (response.ok) {
        const data = await response.json()
        setFileContent(data.content)
        setSelectedFile(path)
      }
    } catch (err) {
      console.error('Failed to load file:', err)
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
              <FileCode className="w-8 h-8 text-mgx-text-muted" />
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
    <div className="min-h-screen bg-mgx-bg-primary flex flex-col">
      {/* Header */}
      <header className="border-b border-mgx-border bg-mgx-bg-secondary px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-mgx-accent" />
              <span className="text-xl font-bold text-mgx-text-primary">MGX Clone</span>
            </Link>
            <span className="text-mgx-text-muted">|</span>
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-mgx-text-muted" />
              <span className="text-sm text-mgx-text-muted">
                Shared Project • {shareInfo?.view_count || 0} views
              </span>
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
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex">
        {/* Sidebar - File Tree */}
        <div className="w-64 border-r border-mgx-border bg-mgx-bg-secondary p-4 overflow-y-auto">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-mgx-text-primary truncate">
              {project?.name}
            </h2>
            <p className="text-sm text-mgx-text-muted truncate mt-1">
              {project?.requirement}
            </p>
          </div>
          
          <div className="border-t border-mgx-border pt-4">
            <h3 className="text-xs font-semibold text-mgx-text-muted uppercase mb-2">Files</h3>
            <div className="space-y-0.5">
              {fileTree.map((node) => (
                <FileTreeNode
                  key={node.path}
                  node={node}
                  selectedFile={selectedFile}
                  onSelect={loadFileContent}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Main Content - Code Preview */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedFile ? (
            <>
              <div className="border-b border-mgx-border bg-mgx-bg-secondary px-4 py-2 flex items-center justify-between">
                <span className="text-sm text-mgx-text-secondary">{selectedFile}</span>
              </div>
              <div className="flex-1 overflow-auto bg-mgx-bg-primary p-4">
                <pre className="text-sm text-mgx-text-primary font-mono whitespace-pre-wrap">
                  {fileContent}
                </pre>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <FileCode className="w-16 h-16 text-mgx-text-muted mx-auto mb-4" />
                <h3 className="text-lg font-medium text-mgx-text-primary mb-2">
                  Select a file to view
                </h3>
                <p className="text-sm text-mgx-text-muted">
                  Choose a file from the sidebar to preview its contents
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

