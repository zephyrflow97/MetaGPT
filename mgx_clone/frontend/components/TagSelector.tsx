'use client'

import { useState, useEffect } from 'react'
import { Tag, Plus, X, Check, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { getApiBase } from '@/lib/config'
import { Tag as TagType, Project } from '@/lib/types'

interface TagSelectorProps {
  project: Project | null
  onTagsChange?: () => void
}

const API_BASE = getApiBase() + '/api'

export function TagSelector({ project, onTagsChange }: TagSelectorProps) {
  const { token, isAuthenticated } = useAuth()
  const [allTags, setAllTags] = useState<TagType[]>([])
  const [projectTags, setProjectTags] = useState<TagType[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (project && token) {
      fetchTags()
      fetchProjectTags()
    }
  }, [project, token])

  const fetchTags = async () => {
    if (!token) return

    try {
      const response = await fetch(`${API_BASE}/tags`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setAllTags(data.tags || [])
      }
    } catch (err) {
      console.error('Failed to fetch tags:', err)
    }
  }

  const fetchProjectTags = async () => {
    if (!project || !token) return

    try {
      const response = await fetch(`${API_BASE}/projects/${project.id}/tags`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (response.ok) {
        const data = await response.json()
        setProjectTags(data.tags || [])
      }
    } catch (err) {
      console.error('Failed to fetch project tags:', err)
    }
  }

  const addTagToProject = async (tagId: string) => {
    if (!project || !token) return

    setIsLoading(true)
    try {
      const response = await fetch(`${API_BASE}/projects/${project.id}/tags/${tagId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        fetchProjectTags()
        onTagsChange?.()
      }
    } catch (err) {
      console.error('Failed to add tag:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const removeTagFromProject = async (tagId: string) => {
    if (!project || !token) return

    setIsLoading(true)
    try {
      const response = await fetch(`${API_BASE}/projects/${project.id}/tags/${tagId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        fetchProjectTags()
        onTagsChange?.()
      }
    } catch (err) {
      console.error('Failed to remove tag:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const isTagSelected = (tagId: string) => {
    return projectTags.some((t) => t.id === tagId)
  }

  if (!isAuthenticated || !project) {
    return null
  }

  return (
    <div className="relative">
      {/* Current Tags */}
      <div className="flex flex-wrap gap-2 items-center">
        {projectTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
            <button
              onClick={() => removeTagFromProject(tag.id)}
              className="hover:bg-white/20 rounded-full p-0.5 transition-colors"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs
                     bg-mgx-bg-tertiary text-mgx-text-muted hover:text-mgx-text-secondary
                     border border-mgx-border hover:border-mgx-accent/30 transition-colors"
        >
          <Plus size={12} />
          Add Tag
        </button>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-2 w-48 bg-mgx-bg-secondary border border-mgx-border
                          rounded-lg shadow-xl z-20 overflow-hidden">
            <div className="p-2 border-b border-mgx-border">
              <p className="text-xs text-mgx-text-muted font-medium">Select Tags</p>
            </div>
            <div className="max-h-48 overflow-y-auto p-1">
              {allTags.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-mgx-text-muted">
                  No tags available
                </div>
              ) : (
                allTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => {
                      if (isTagSelected(tag.id)) {
                        removeTagFromProject(tag.id)
                      } else {
                        addTagToProject(tag.id)
                      }
                    }}
                    disabled={isLoading}
                    className="w-full flex items-center justify-between px-3 py-2
                               hover:bg-mgx-bg-tertiary rounded-md transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: tag.color }}
                      />
                      <span className="text-sm text-mgx-text-primary">{tag.name}</span>
                    </div>
                    {isTagSelected(tag.id) && (
                      <Check size={16} className="text-mgx-accent" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

