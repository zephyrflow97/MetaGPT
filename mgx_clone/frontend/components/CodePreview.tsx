'use client'

import { useState, useCallback, useRef, useMemo } from 'react'
import Editor, { OnMount } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import {
  X,
  Download,
  FileCode,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Eye,
  Code2,
  ExternalLink,
  Save,
  Edit3,
  Lock,
  Loader2,
  AlertCircle,
  Share2,
  Tag,
} from 'lucide-react'
import { Project, FileInfo } from '@/lib/types'
import { cn, getFileLanguage, truncateText } from '@/lib/utils'
import { getApiBase, getPreviewUrl } from '@/lib/config'
import { ShareDialog } from './ShareDialog'
import { TagSelector } from './TagSelector'
import { TagManager } from './TagManager'

const API_BASE = getApiBase()

interface CodePreviewProps {
  project: Project
  files: FileInfo[]
  selectedFile: FileInfo | null
  fileContent: string
  onSelectFile: (file: FileInfo) => void
  onDownload: () => void
  onClose: () => void
  onFileContentChange?: (content: string) => void
  isLoading?: boolean
  totalFiles?: number
  isTruncated?: boolean
}

export function CodePreview({
  project,
  files,
  selectedFile,
  fileContent,
  onSelectFile,
  onDownload,
  onClose,
  onFileContentChange,
  isLoading = false,
  totalFiles,
  isTruncated = false,
}: CodePreviewProps) {
  const [viewMode, setViewMode] = useState<'code' | 'preview'>('code')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['/']))
  const [isEditing, setIsEditing] = useState(false)
  const [editedContent, setEditedContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [showTagManager, setShowTagManager] = useState(false)
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)

  // Memoize file tree to avoid rebuilding on every render
  const fileTree = useMemo(() => buildFileTree(files), [files])

  const toggleFolder = (path: string) => {
    const newExpanded = new Set(expandedFolders)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setExpandedFolders(newExpanded)
  }

  // Check if preview is available (HTML file exists)
  const hasPreviewableContent =
    files.some((f) => f.extension === '.html') && project.workspace_path

  // Handle editor mount
  const handleEditorMount: OnMount = useCallback((editor) => {
    editorRef.current = editor
  }, [])

  // Handle content change in editor
  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      setEditedContent(value)
      setHasUnsavedChanges(value !== fileContent)
    }
  }, [fileContent])

  // Toggle edit mode
  const handleToggleEdit = useCallback(() => {
    if (isEditing && hasUnsavedChanges) {
      // Ask confirmation before discarding changes
      if (!confirm('You have unsaved changes. Discard them?')) {
        return
      }
    }
    setIsEditing(!isEditing)
    setEditedContent(fileContent)
    setHasUnsavedChanges(false)
  }, [isEditing, hasUnsavedChanges, fileContent])

  // Save file
  const handleSave = useCallback(async () => {
    if (!selectedFile || !hasUnsavedChanges) return
    
    setIsSaving(true)
    try {
      const response = await fetch(
        `${API_BASE}/api/projects/${project.id}/files/${selectedFile.path}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: editedContent }),
        }
      )
      
      if (response.ok) {
        setHasUnsavedChanges(false)
        // Notify parent to refresh content
        onFileContentChange?.(editedContent)
      } else {
        const error = await response.json()
        alert(`Failed to save: ${error.detail || 'Unknown error'}`)
      }
    } catch (error) {
      alert(`Failed to save: ${error}`)
    } finally {
      setIsSaving(false)
    }
  }, [selectedFile, hasUnsavedChanges, editedContent, project.id, onFileContentChange])

  // Keyboard shortcut for save
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      if (isEditing && hasUnsavedChanges) {
        handleSave()
      }
    }
  }, [isEditing, hasUnsavedChanges, handleSave])

  return (
    <div className="w-1/2 h-full bg-mgx-surface border-l border-mgx-border flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-mgx-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-mgx-accent" />
            <h3 className="text-sm font-medium text-mgx-text">
              {truncateText(project.name, 25)}
            </h3>
          </div>
          {/* View Mode Toggle */}
          <div className="flex items-center bg-mgx-bg rounded-lg p-1">
            <button
              onClick={() => setViewMode('code')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors',
                viewMode === 'code'
                  ? 'bg-mgx-surface-light text-mgx-text'
                  : 'text-mgx-text-muted hover:text-mgx-text'
              )}
            >
              <Code2 className="w-3.5 h-3.5" />
              Code
            </button>
            {hasPreviewableContent && (
              <button
                onClick={() => setViewMode('preview')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors',
                  viewMode === 'preview'
                    ? 'bg-mgx-surface-light text-mgx-text'
                    : 'text-mgx-text-muted hover:text-mgx-text'
                )}
              >
                <Eye className="w-3.5 h-3.5" />
                Preview
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Edit/Save buttons for code mode */}
          {viewMode === 'code' && selectedFile && (
            <>
              {isEditing ? (
                <>
                  <button
                    onClick={handleSave}
                    disabled={!hasUnsavedChanges || isSaving}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      hasUnsavedChanges && !isSaving
                        ? 'bg-mgx-success/10 text-mgx-success hover:bg-mgx-success/20'
                        : 'bg-mgx-surface-light text-mgx-text-muted cursor-not-allowed'
                    )}
                  >
                    {isSaving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={handleToggleEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                             bg-mgx-surface-light text-mgx-text-muted hover:text-mgx-text
                             text-xs font-medium transition-colors"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Read Only
                  </button>
                </>
              ) : (
                <button
                  onClick={handleToggleEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                           bg-mgx-accent/10 text-mgx-accent hover:bg-mgx-accent/20
                           text-xs font-medium transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit
                </button>
              )}
            </>
          )}
          <button
            onClick={() => setShowTagManager(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                     bg-mgx-surface-light text-mgx-text-muted hover:text-mgx-accent
                     text-xs font-medium transition-colors"
            title="Manage Tags"
          >
            <Tag className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowShareDialog(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                     bg-mgx-accent/10 text-mgx-accent hover:bg-mgx-accent/20
                     text-xs font-medium transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share
          </button>
          <button
            onClick={onDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                     bg-mgx-primary/10 text-mgx-primary hover:bg-mgx-primary/20
                     text-xs font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-mgx-text-muted hover:text-mgx-text
                     hover:bg-mgx-surface-light transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Tags for current project */}
      <div className="px-4 py-2 border-b border-mgx-border bg-mgx-bg">
        <TagSelector project={project} />
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {viewMode === 'code' ? (
          <>
            {/* File Explorer */}
            <div className="w-56 border-r border-mgx-border overflow-y-auto">
              <div className="p-2">
                <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-mgx-text-muted">
                  <FolderOpen className="w-4 h-4" />
                  <span className="font-medium">Files</span>
                  <span className="text-mgx-text-muted/60">
                    ({files.length}{isTruncated && totalFiles ? `/${totalFiles}` : ''})
                  </span>
                  {isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                </div>
                
                {/* Truncation warning */}
                {isTruncated && (
                  <div className="mx-2 mb-2 px-2 py-1.5 bg-mgx-warning/10 border border-mgx-warning/20 rounded-lg">
                    <div className="flex items-center gap-1.5 text-xs text-mgx-warning">
                      <AlertCircle className="w-3 h-3" />
                      <span>Showing {files.length} of {totalFiles} files</span>
                    </div>
                  </div>
                )}
                
                {isLoading && files.length === 0 ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 text-mgx-text-muted animate-spin" />
                  </div>
                ) : (
                  <FileTreeView
                    tree={fileTree}
                    selectedFile={selectedFile}
                    expandedFolders={expandedFolders}
                    onSelectFile={onSelectFile}
                    onToggleFolder={toggleFolder}
                    level={0}
                  />
                )}
              </div>
            </div>

            {/* Code Editor */}
            <div className="flex-1 flex flex-col" onKeyDown={handleKeyDown}>
              {selectedFile ? (
                <>
                  {/* File Tab */}
                  <div className="flex items-center gap-2 px-4 py-2 border-b border-mgx-border bg-mgx-bg">
                    <FileIcon extension={selectedFile.extension} />
                    <span className="text-xs text-mgx-text">{selectedFile.name}</span>
                    {hasUnsavedChanges && (
                      <span className="w-2 h-2 rounded-full bg-mgx-warning" title="Unsaved changes" />
                    )}
                    <span className="text-xs text-mgx-text-muted ml-auto">
                      {isEditing ? '✏️ Editing' : '🔒 Read Only'} • {getFileLanguage(selectedFile.extension)}
                    </span>
                  </div>
                  {/* Monaco Editor */}
                  <div className="flex-1">
                    <Editor
                      height="100%"
                      language={getFileLanguage(selectedFile.extension)}
                      value={isEditing ? editedContent : fileContent}
                      theme="vs-dark"
                      onMount={handleEditorMount}
                      onChange={isEditing ? handleEditorChange : undefined}
                      options={{
                        readOnly: !isEditing,
                        minimap: { enabled: false },
                        fontSize: 13,
                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        wordWrap: 'on',
                        padding: { top: 16 },
                        renderValidationDecorations: isEditing ? 'on' : 'off',
                        cursorStyle: isEditing ? 'line' : 'line-thin',
                        cursorBlinking: isEditing ? 'blink' : 'solid',
                      }}
                    />
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <FileCode className="w-12 h-12 text-mgx-text-muted/30 mx-auto mb-3" />
                    <p className="text-sm text-mgx-text-muted">
                      Select a file to view its content
                    </p>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          /* Preview Mode */
          <div className="flex-1 bg-white">
            {project.workspace_path ? (
              <iframe
                src={getPreviewUrl(project.id)}
                className="w-full h-full border-0"
                title="Project Preview"
              />
            ) : (
              <div className="flex items-center justify-center h-full bg-mgx-bg">
                <div className="text-center">
                  <Eye className="w-12 h-12 text-mgx-text-muted/30 mx-auto mb-3" />
                  <p className="text-sm text-mgx-text-muted">
                    Preview not available
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <ShareDialog
        isOpen={showShareDialog}
        project={project}
        onClose={() => setShowShareDialog(false)}
      />
      <TagManager
        isOpen={showTagManager}
        onClose={() => setShowTagManager(false)}
      />
    </div>
  )
}

// Helper Components

interface FileTreeNode {
  name: string
  path: string
  isFolder: boolean
  children?: FileTreeNode[]
  file?: FileInfo
}

function buildFileTree(files: FileInfo[]): FileTreeNode[] {
  const root: FileTreeNode = { name: '/', path: '/', isFolder: true, children: [] }

  files.forEach((file) => {
    const parts = file.path.split('/')
    let current = root

    parts.forEach((part, index) => {
      if (!part) return

      const isLast = index === parts.length - 1
      const existingChild = current.children?.find((c) => c.name === part)

      if (existingChild) {
        current = existingChild
      } else {
        const newNode: FileTreeNode = {
          name: part,
          path: parts.slice(0, index + 1).join('/'),
          isFolder: !isLast,
          children: isLast ? undefined : [],
          file: isLast ? file : undefined,
        }
        current.children?.push(newNode)
        current = newNode
      }
    })
  })

  return root.children || []
}

interface FileTreeViewProps {
  tree: FileTreeNode[]
  selectedFile: FileInfo | null
  expandedFolders: Set<string>
  onSelectFile: (file: FileInfo) => void
  onToggleFolder: (path: string) => void
  level: number
}

function FileTreeView({
  tree,
  selectedFile,
  expandedFolders,
  onSelectFile,
  onToggleFolder,
  level,
}: FileTreeViewProps) {
  // Sort: folders first, then files
  const sorted = [...tree].sort((a, b) => {
    if (a.isFolder && !b.isFolder) return -1
    if (!a.isFolder && b.isFolder) return 1
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="space-y-0.5">
      {sorted.map((node) => (
        <div key={node.path}>
          {node.isFolder ? (
            <>
              <button
                onClick={() => onToggleFolder(node.path)}
                className="w-full flex items-center gap-1.5 px-2 py-1 rounded-md
                         hover:bg-mgx-surface-light text-left transition-colors"
                style={{ paddingLeft: `${level * 12 + 8}px` }}
              >
                {expandedFolders.has(node.path) ? (
                  <ChevronDown className="w-3.5 h-3.5 text-mgx-text-muted" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-mgx-text-muted" />
                )}
                <FolderOpen className="w-4 h-4 text-mgx-warning" />
                <span className="text-xs text-mgx-text truncate">{node.name}</span>
              </button>
              {expandedFolders.has(node.path) && node.children && (
                <FileTreeView
                  tree={node.children}
                  selectedFile={selectedFile}
                  expandedFolders={expandedFolders}
                  onSelectFile={onSelectFile}
                  onToggleFolder={onToggleFolder}
                  level={level + 1}
                />
              )}
            </>
          ) : (
            <button
              onClick={() => node.file && onSelectFile(node.file)}
              className={cn(
                'w-full flex items-center gap-1.5 px-2 py-1 rounded-md text-left transition-colors',
                selectedFile?.path === node.file?.path
                  ? 'bg-mgx-primary/10 text-mgx-primary'
                  : 'hover:bg-mgx-surface-light text-mgx-text'
              )}
              style={{ paddingLeft: `${level * 12 + 24}px` }}
            >
              <FileIcon extension={node.file?.extension || ''} />
              <span className="text-xs truncate">{node.name}</span>
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

function FileIcon({ extension }: { extension: string }) {
  const getColor = () => {
    switch (extension) {
      case '.py':
        return 'text-yellow-400'
      case '.js':
      case '.jsx':
        return 'text-yellow-300'
      case '.ts':
      case '.tsx':
        return 'text-blue-400'
      case '.html':
        return 'text-orange-400'
      case '.css':
        return 'text-blue-300'
      case '.json':
        return 'text-yellow-200'
      case '.md':
        return 'text-gray-400'
      default:
        return 'text-mgx-text-muted'
    }
  }

  return <FileCode className={cn('w-4 h-4', getColor())} />
}

