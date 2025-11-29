'use client'

import { AgentState } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Loader2, Users, ChevronDown, ChevronUp, Info } from 'lucide-react'
import { useState } from 'react'

interface AgentStatusPanelProps {
  agentStates: AgentState[]
  isGenerating: boolean
  currentTask?: string  // 当前任务描述
}

// Agent icons mapping (using actual role names from MetaGPT)
const AGENT_ICONS: Record<string, string> = {
  'Mike': '👨‍💼',      // Team Leader
  'Mia': '📋',         // Product Manager
  'Alex': '👨‍💻',      // Engineer
  'Archer': '🏗️',     // Architect
  'Dino': '📊',        // Data Analyst
  // Fallback for role names
  'Team Leader': '👨‍💼',
  'Product Manager': '📋',
  'Architect': '🏗️',
  'Engineer': '👨‍💻',
  'Data Analyst': '📊',
}

// Agent role descriptions
const AGENT_ROLES: Record<string, string> = {
  'Mike': 'Team Leader',
  'Mia': 'Product Manager',
  'Alex': 'Engineer',
  'Archer': 'Architect',
  'Dino': 'Data Analyst',
}

export function AgentStatusPanel({ agentStates, isGenerating, currentTask }: AgentStatusPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)
  const [showInfo, setShowInfo] = useState(false)
  
  // 只显示实际出现的 Agent（不显示默认列表）
  // MetaGPT 会根据任务复杂度动态分配 Agent
  const displayAgents = agentStates

  if (!isGenerating && displayAgents.length === 0) return null

  const activeAgents = displayAgents.filter(a => a.state === 'active')

  return (
    <div className="bg-mgx-surface rounded-xl border border-mgx-border overflow-hidden animate-in slide-in-from-right duration-300">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-mgx-surface-light transition-colors"
      >
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-mgx-accent" />
          <span className="text-sm font-medium text-mgx-text">AI Team</span>
          {isGenerating && (
            <span className="flex items-center gap-1 text-xs text-mgx-primary bg-mgx-primary/10 px-2 py-0.5 rounded-full">
              <Loader2 className="w-3 h-3 animate-spin" />
              Working
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-mgx-text-muted" />
          ) : (
            <ChevronDown className="w-4 h-4 text-mgx-text-muted" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Info Banner - 解释 Agent 分配机制 */}
          {isGenerating && displayAgents.length === 0 && (
            <div className="p-3 bg-mgx-primary/5 rounded-lg border border-mgx-primary/10">
              <div className="flex items-start gap-2">
                <Loader2 className="w-4 h-4 text-mgx-primary animate-spin mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-mgx-text">Mike is analyzing your request...</p>
                  <p className="text-xs text-mgx-text-muted mt-1">
                    The team leader will assign appropriate agents based on task complexity.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Current Task (if available) */}
          {currentTask && (
            <div className="p-2 bg-mgx-accent/5 rounded-lg border border-mgx-accent/10">
              <p className="text-xs text-mgx-text-muted">Current Task:</p>
              <p className="text-sm text-mgx-text mt-0.5 line-clamp-2">{currentTask}</p>
            </div>
          )}

          {/* Agent List - 只显示实际参与的 Agent */}
          {displayAgents.length > 0 && (
            <div className="space-y-2">
              {displayAgents.map((agent, idx) => (
                <div
                  key={agent.name}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg transition-all duration-300',
                    agent.state === 'active' && 'bg-mgx-primary/10 border border-mgx-primary/20 shadow-sm',
                    agent.state !== 'active' && 'bg-mgx-surface-light/30 border border-transparent'
                  )}
                >
                  {/* Agent Avatar */}
                  <div className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all shrink-0',
                    agent.state === 'active' && 'bg-mgx-primary/20 scale-105',
                    agent.state !== 'active' && 'bg-mgx-surface-light'
                  )}>
                    {AGENT_ICONS[agent.name] || '🤖'}
                  </div>

                  {/* Agent Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'text-sm font-medium transition-colors',
                        agent.state === 'active' && 'text-mgx-primary',
                        agent.state !== 'active' && 'text-mgx-text'
                      )}>
                        {agent.name}
                      </span>
                      <span className="text-xs text-mgx-text-muted">
                        {AGENT_ROLES[agent.name] || ''}
                      </span>
                    </div>
                    {agent.description && (
                      <p className={cn(
                        'text-xs mt-0.5 truncate',
                        agent.state === 'active' ? 'text-mgx-text-muted' : 'text-mgx-text-muted/60'
                      )}>
                        {agent.description}
                      </p>
                    )}
                  </div>

                  {/* Active Indicator */}
                  {agent.state === 'active' && (
                    <div className="shrink-0">
                      <Loader2 className="w-4 h-4 text-mgx-primary animate-spin" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Info tooltip about agent assignment */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowInfo(!showInfo); }}
            className="flex items-center gap-1 text-xs text-mgx-text-muted hover:text-mgx-text transition-colors"
          >
            <Info className="w-3 h-3" />
            <span>Why don't I see all agents?</span>
          </button>
          
          {showInfo && (
            <div className="p-3 bg-mgx-surface-light rounded-lg text-xs text-mgx-text-muted space-y-2">
              <p>
                <strong className="text-mgx-text">Smart Assignment:</strong> Mike (Team Leader) analyzes each task and assigns only the necessary agents.
              </p>
              <p>
                <strong className="text-mgx-text">Simple tasks</strong> (calculator, todo app) → Alex (Engineer) directly
              </p>
              <p>
                <strong className="text-mgx-text">Complex tasks</strong> → Full team: Mia (PRD) → Archer (Design) → Alex (Code)
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
