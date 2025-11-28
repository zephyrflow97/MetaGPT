'use client'

import { useState } from 'react'
import { Plus, MessageSquare, FolderOpen, ChevronDown, Sparkles } from 'lucide-react'
import { Project } from '@/lib/types'
import { cn, formatDate, getStatusColor, getStatusIcon, truncateText } from '@/lib/utils'

interface SidebarProps {
  projects: Project[]
  currentProject: Project | null
  onSelectProject: (project: Project) => void
  onNewChat: () => void
}

export function Sidebar({
  projects,
  currentProject,
  onSelectProject,
  onNewChat,
}: SidebarProps) {
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(true)

  // Group projects by date
  const groupedProjects = projects.reduce((acc, project) => {
    const dateKey = formatDate(project.created_at)
    if (!acc[dateKey]) {
      acc[dateKey] = []
    }
    acc[dateKey].push(project)
    return acc
  }, {} as Record<string, Project[]>)

  return (
    <div className="w-72 bg-mgx-surface border-r border-mgx-border flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-mgx-border">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-mgx-primary to-mgx-accent flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-mgx-text">MGX Clone</h1>
            <p className="text-xs text-mgx-text-muted">Powered by MetaGPT</p>
          </div>
        </div>

        {/* New Chat Button */}
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 
                   bg-mgx-primary hover:bg-mgx-primary-hover rounded-lg
                   text-white font-medium transition-all duration-200
                   hover:shadow-lg hover:shadow-mgx-primary/25"
        >
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </div>

      {/* Projects List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          <button
            onClick={() => setIsProjectsExpanded(!isProjectsExpanded)}
            className="w-full flex items-center justify-between px-3 py-2 
                     text-mgx-text-muted hover:text-mgx-text rounded-lg
                     hover:bg-mgx-surface-light transition-colors"
          >
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4" />
              <span className="text-sm font-medium">Projects</span>
              <span className="text-xs bg-mgx-surface-light px-2 py-0.5 rounded-full">
                {projects.length}
              </span>
            </div>
            <ChevronDown
              className={cn(
                'w-4 h-4 transition-transform',
                isProjectsExpanded ? 'rotate-0' : '-rotate-90'
              )}
            />
          </button>

          {isProjectsExpanded && (
            <div className="mt-1 space-y-1">
              {Object.entries(groupedProjects).map(([date, dateProjects]) => (
                <div key={date}>
                  <div className="px-3 py-1.5 text-xs text-mgx-text-muted font-medium">
                    {date}
                  </div>
                  {dateProjects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => onSelectProject(project)}
                      className={cn(
                        'w-full flex items-start gap-3 px-3 py-2 rounded-lg text-left',
                        'hover:bg-mgx-surface-light transition-colors',
                        currentProject?.id === project.id && 'bg-mgx-surface-light'
                      )}
                    >
                      <MessageSquare className="w-4 h-4 mt-0.5 text-mgx-text-muted flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-mgx-text truncate">
                            {truncateText(project.name, 20)}
                          </span>
                          <span className={cn('text-xs', getStatusColor(project.status))}>
                            {getStatusIcon(project.status)}
                          </span>
                        </div>
                        <p className="text-xs text-mgx-text-muted truncate mt-0.5">
                          {truncateText(project.requirement, 30)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ))}

              {projects.length === 0 && (
                <div className="px-3 py-8 text-center">
                  <MessageSquare className="w-8 h-8 text-mgx-text-muted mx-auto mb-2 opacity-50" />
                  <p className="text-sm text-mgx-text-muted">No projects yet</p>
                  <p className="text-xs text-mgx-text-muted mt-1">
                    Start by creating a new project
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-mgx-border">
        <div className="flex items-center gap-2 text-xs text-mgx-text-muted">
          <div className="w-2 h-2 rounded-full bg-mgx-success animate-pulse" />
          <span>Connected to MetaGPT</span>
        </div>
      </div>
    </div>
  )
}

