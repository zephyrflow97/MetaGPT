'use client'

import { ProgressInfo, AgentState } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Check, Loader2, Clock } from 'lucide-react'

interface ProgressBarProps {
  progress: ProgressInfo | null
  agentStates: AgentState[]
  isGenerating: boolean
}

export function ProgressBar({ progress, agentStates, isGenerating }: ProgressBarProps) {
  if (!isGenerating && !progress) return null

  return (
    <div className="bg-mgx-surface rounded-xl border border-mgx-border p-4 mb-4 animate-in slide-in-from-top duration-300">
      {/* Progress Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 text-mgx-primary animate-spin" />
          <span className="text-sm font-medium text-mgx-text">
            {progress?.currentAgent 
              ? `${progress.currentAgent} is working...`
              : 'Starting project generation...'}
          </span>
        </div>
        <span className="text-sm text-mgx-text-muted">
          {progress ? `${progress.percentage}%` : '0%'}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-mgx-surface-light rounded-full overflow-hidden mb-4">
        <div 
          className="h-full bg-gradient-to-r from-mgx-primary to-mgx-accent rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress?.percentage || 0}%` }}
        />
      </div>

      {/* Agent Status - Horizontal scrollable timeline */}
      {agentStates.length > 0 && (
        <div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-mgx-border scrollbar-track-transparent">
          {/* Agent Timeline */}
          <div className="flex items-start gap-1 min-w-max px-2">
            {agentStates.map((agent, idx) => (
              <div 
                key={agent.name} 
                className="flex items-center"
              >
                {/* Agent Node */}
                <div className="flex flex-col items-center">
                  {/* Agent Icon */}
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300',
                    agent.state === 'completed' && 'bg-mgx-success text-white',
                    agent.state === 'active' && 'bg-mgx-primary text-white animate-pulse',
                    agent.state === 'pending' && 'bg-mgx-surface-light text-mgx-text-muted border border-mgx-border'
                  )}>
                    {agent.state === 'completed' ? (
                      <Check className="w-4 h-4" />
                    ) : agent.state === 'active' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Clock className="w-3 h-3" />
                    )}
                  </div>
                  
                  {/* Agent Name - No truncation */}
                  <span className={cn(
                    'text-xs mt-1 text-center transition-colors duration-300 whitespace-nowrap px-1',
                    agent.state === 'completed' && 'text-mgx-success',
                    agent.state === 'active' && 'text-mgx-primary font-medium',
                    agent.state === 'pending' && 'text-mgx-text-muted'
                  )}>
                    {agent.name}
                  </span>
                </div>
                
                {/* Connector Line (except for last) */}
                {idx < agentStates.length - 1 && (
                  <div className={cn(
                    'w-8 h-0.5 mx-1 mt-[-12px] transition-colors duration-300',
                    agentStates[idx + 1]?.state !== 'pending' 
                      ? 'bg-mgx-primary' 
                      : 'bg-mgx-border'
                  )} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
