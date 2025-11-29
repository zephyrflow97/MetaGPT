'use client'

import { useState, useEffect } from 'react'
import { Tag, Plus, X, Edit2, Trash2, Check, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { getApiBase } from '@/lib/config'
import { Tag as TagType } from '@/lib/types'

interface TagManagerProps {
  isOpen: boolean
  onClose: () => void
  onTagsChange?: () => void
}

const API_BASE = getApiBase() + '/api'

const PRESET_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // yellow
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
]

export function TagManager({ isOpen, onClose, onTagsChange }: TagManagerProps) {
  const { token, isAuthenticated } = useAuth()
  const [tags, setTags] = useState<TagType[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0])
  const [editingTag, setEditingTag] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen && token) {
      fetchTags()
    }
  }, [isOpen, token])

  const fetchTags = async () => {
    if (!token) return

    setIsLoading(true)
    try {
      const response = await fetch(`${API_BASE}/tags`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setTags(data.tags || [])
      }
    } catch (err) {
      console.error('Failed to fetch tags:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const createTag = async () => {
    if (!token || !newTagName.trim()) return

    setError('')
    try {
      const response = await fetch(`${API_BASE}/tags`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: newTagName.trim(), color: newTagColor })
      })

      if (response.ok) {
        setNewTagName('')
        setNewTagColor(PRESET_COLORS[0])
        fetchTags()
        onTagsChange?.()
      } else {
        const err = await response.json()
        setError(err.detail || 'Failed to create tag')
      }
    } catch (err) {
      setError('Failed to create tag')
    }
  }

  const updateTag = async (tagId: string) => {
    if (!token || !editName.trim()) return

    try {
      const response = await fetch(`${API_BASE}/tags/${tagId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: editName.trim(), color: editColor })
      })

      if (response.ok) {
        setEditingTag(null)
        fetchTags()
        onTagsChange?.()
      }
    } catch (err) {
      console.error('Failed to update tag:', err)
    }
  }

  const deleteTag = async (tagId: string) => {
    if (!token) return

    if (!confirm('Are you sure you want to delete this tag? It will be removed from all projects.')) {
      return
    }

    try {
      const response = await fetch(`${API_BASE}/tags/${tagId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        fetchTags()
        onTagsChange?.()
      }
    } catch (err) {
      console.error('Failed to delete tag:', err)
    }
  }

  const startEditing = (tag: TagType) => {
    setEditingTag(tag.id)
    setEditName(tag.name)
    setEditColor(tag.color)
  }

  if (!isOpen) return null

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-mgx-bg-secondary border border-mgx-border rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-mgx-text-primary">Manage Tags</h2>
            <button onClick={onClose} className="text-mgx-text-muted hover:text-mgx-text-primary transition-colors">
              <X size={20} />
            </button>
          </div>
          <p className="text-mgx-text-secondary">
            Please sign in to manage tags.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-mgx-bg-secondary border border-mgx-border rounded-xl p-6 w-full max-w-md mx-4 shadow-2xl max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Tag className="text-mgx-accent" size={24} />
            <h2 className="text-xl font-semibold text-mgx-text-primary">Manage Tags</h2>
          </div>
          <button onClick={onClose} className="text-mgx-text-muted hover:text-mgx-text-primary transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Create New Tag */}
        <div className="mb-6 p-4 bg-mgx-bg-tertiary rounded-lg">
          <h3 className="text-sm font-medium text-mgx-text-secondary mb-3">Create New Tag</h3>
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="Tag name"
              className="flex-1 px-3 py-2 bg-mgx-bg-primary border border-mgx-border rounded-lg
                         text-mgx-text-primary placeholder-mgx-text-muted text-sm
                         focus:outline-none focus:ring-2 focus:ring-mgx-accent focus:border-transparent"
            />
            <button
              onClick={createTag}
              disabled={!newTagName.trim()}
              className="px-4 py-2 bg-mgx-accent hover:bg-mgx-accent-hover disabled:opacity-50
                         text-white rounded-lg flex items-center gap-2 transition-colors"
            >
              <Plus size={18} />
            </button>
          </div>
          <div className="flex gap-2">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setNewTagColor(color)}
                className={`w-6 h-6 rounded-full transition-transform ${
                  newTagColor === color ? 'ring-2 ring-white ring-offset-2 ring-offset-mgx-bg-tertiary scale-110' : ''
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>

        {/* Tags List */}
        <div className="flex-1 overflow-y-auto">
          <h3 className="text-sm font-medium text-mgx-text-secondary mb-3">Your Tags</h3>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-mgx-accent" />
            </div>
          ) : tags.length === 0 ? (
            <div className="text-center py-8">
              <Tag className="w-12 h-12 text-mgx-text-muted mx-auto mb-3" />
              <p className="text-mgx-text-muted">No tags yet</p>
              <p className="text-sm text-mgx-text-muted mt-1">Create your first tag above</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tags.map((tag) => (
                <div
                  key={tag.id}
                  className="flex items-center justify-between p-3 bg-mgx-bg-tertiary rounded-lg"
                >
                  {editingTag === tag.id ? (
                    <div className="flex-1 flex items-center gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="flex-1 px-2 py-1 bg-mgx-bg-primary border border-mgx-border rounded
                                   text-mgx-text-primary text-sm
                                   focus:outline-none focus:ring-2 focus:ring-mgx-accent"
                      />
                      <div className="flex gap-1">
                        {PRESET_COLORS.map((color) => (
                          <button
                            key={color}
                            onClick={() => setEditColor(color)}
                            className={`w-5 h-5 rounded-full ${
                              editColor === color ? 'ring-2 ring-white' : ''
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <button
                        onClick={() => updateTag(tag.id)}
                        className="p-1 text-green-400 hover:text-green-300"
                      >
                        <Check size={18} />
                      </button>
                      <button
                        onClick={() => setEditingTag(null)}
                        className="p-1 text-mgx-text-muted hover:text-mgx-text-secondary"
                      >
                        <X size={18} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="text-mgx-text-primary">{tag.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEditing(tag)}
                          className="p-1 text-mgx-text-muted hover:text-mgx-text-secondary transition-colors"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => deleteTag(tag.id)}
                          className="p-1 text-mgx-text-muted hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

