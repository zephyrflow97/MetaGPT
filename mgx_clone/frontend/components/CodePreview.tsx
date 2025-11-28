'use client'

import { useState } from 'react'
import Editor from '@monaco-editor/react'
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
} from 'lucide-react'
import { Project, FileInfo } from '@/lib/types'
import { cn, getFileLanguage, truncateText } from '@/lib/utils'

interface CodePreviewProps {
  project: Project
  files: FileInfo[]
  selectedFile: FileInfo | null
  fileContent: string
  onSelectFile: (file: FileInfo) => void
  onDownload: () => void
  onClose: () => void
}

export function CodePreview({
  project,
  files,
  selectedFile,
  fileContent,
  onSelectFile,
  onDownload,
  onClose,
}: CodePreviewProps) {
  const [viewMode, setViewMode] = useState<'code' | 'preview'>('code')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['/']))

  // Organize files into folder structure
  const fileTree = buildFileTree(files)

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
                  <span className="text-mgx-text-muted/60">({files.length})</span>
                </div>
                <FileTreeView
                  tree={fileTree}
                  selectedFile={selectedFile}
                  expandedFolders={expandedFolders}
                  onSelectFile={onSelectFile}
                  onToggleFolder={toggleFolder}
                  level={0}
                />
              </div>
            </div>

            {/* Code Editor */}
            <div className="flex-1 flex flex-col">
              {selectedFile ? (
                <>
                  {/* File Tab */}
                  <div className="flex items-center gap-2 px-4 py-2 border-b border-mgx-border bg-mgx-bg">
                    <FileIcon extension={selectedFile.extension} />
                    <span className="text-xs text-mgx-text">{selectedFile.name}</span>
                    <span className="text-xs text-mgx-text-muted ml-auto">
                      {getFileLanguage(selectedFile.extension)}
                    </span>
                  </div>
                  {/* Monaco Editor */}
                  <div className="flex-1">
                    <Editor
                      height="100%"
                      language={getFileLanguage(selectedFile.extension)}
                      value={fileContent}
                      theme="vs-dark"
                      options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        fontSize: 13,
                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                        lineNumbers: 'on',
                        scrollBeyondLastLine: false,
                        wordWrap: 'on',
                        padding: { top: 16 },
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
                src={`http://localhost:8000/preview/${project.id}/`}
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

