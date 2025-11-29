'use client'

import { AgentState } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Check, Loader2, Clock, Users, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

interface AgentStatusPanelProps {
  agentStates: AgentState[]
  isGenerating: boolean
}

// Agent icons mapping
const AGENT_ICONS: Record<string, string> = {
  'Team Leader': '👨‍💼',
  'Product Manager': '📋',
  'Architect': '🏗️',
  'Engineer': '👨‍💻',
  'Data Analyst': '📊',
}

export function AgentStatusPanel({ agentStates, isGenerating }: AgentStatusPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  if (!isGenerating && agentStates.length === 0) return null

  const activeAgents = agentStates.filter(a => a.state === 'active').length
  const completedAgents = agentStates.filter(a => a.state === 'completed').length

  return (
    <div className="bg-mgx-surface rounded-xl border border-mgx-border overflow-hidden animate-in slide-in-from-right duration-300">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-mgx-surface-light transition-colors"
      >
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-mgx-accent" />
          <span className="text-sm font-medium text-mgx-text">AI Team Status</span>
          {isGenerating && (
            <span className="flex items-center gap-1 text-xs text-mgx-primary bg-mgx-primary/10 px-2 py-0.5 rounded-full">
              <Loader2 className="w-3 h-3 animate-spin" />
              Working
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-mgx-text-muted">
            {completedAgents}/{agentStates.length} completed
          </span>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-mgx-text-muted" />
          ) : (
            <ChevronDown className="w-4 h-4 text-mgx-text-muted" />
          )}
        </div>
      </button>

      {/* Agent List */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-2">
          {agentStates.map((agent, idx) => (
            <div
              key={agent.name}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg transition-all duration-300',
                agent.state === 'active' && 'bg-mgx-primary/10 border border-mgx-primary/20',
                agent.state === 'completed' && 'bg-mgx-success/5 border border-mgx-success/10',
                agent.state === 'pending' && 'bg-mgx-surface-light/50'
              )}
              style={{ 
                animationDelay: `${idx * 100}ms`,
              }}
            >
              {/* Agent Avatar */}
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all',
                agent.state === 'active' && 'bg-mgx-primary/20',
                agent.state === 'completed' && 'bg-mgx-success/20',
                agent.state === 'pending' && 'bg-mgx-surface-light opacity-50'
              )}>
                {AGENT_ICONS[agent.name] || '🤖'}
              </div>

              {/* Agent Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'text-sm font-medium transition-colors',
                    agent.state === 'active' && 'text-mgx-primary',
                    agent.state === 'completed' && 'text-mgx-success',
                    agent.state === 'pending' && 'text-mgx-text-muted'
                  )}>
                    {agent.name}
                  </span>
                  {agent.state === 'active' && (
                    <Loader2 className="w-3 h-3 text-mgx-primary animate-spin" />
                  )}
                </div>
                <p className={cn(
                  'text-xs truncate transition-colors',
                  agent.state === 'pending' ? 'text-mgx-text-muted/50' : 'text-mgx-text-muted'
                )}>
                  {agent.description}
                </p>
              </div>

              {/* Status Icon */}
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center transition-all',
                agent.state === 'completed' && 'bg-mgx-success text-white',
                agent.state === 'active' && 'bg-mgx-primary text-white',
                agent.state === 'pending' && 'bg-mgx-surface-light text-mgx-text-muted'
              )}>
                {agent.state === 'completed' ? (
                  <Check className="w-3 h-3" />
                ) : agent.state === 'active' ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Clock className="w-3 h-3" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

