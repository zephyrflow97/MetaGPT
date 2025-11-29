'use client'

import { ProgressInfo, AgentState } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Loader2, User } from 'lucide-react'

interface ProgressBarProps {
  progress: ProgressInfo | null
  agentStates: AgentState[]
  isGenerating: boolean
  currentTask?: string  // 当前任务描述
}

/**
 * 当前工作状态指示器
 * 
 * 显示当前活跃的 Agent 和正在执行的任务
 * 不使用线性进度条，因为 MetaGPT 中任务可以在多个 Agent 之间动态分配
 */
export function ProgressBar({ progress, agentStates, isGenerating, currentTask }: ProgressBarProps) {
  if (!isGenerating) return null

  // 找出当前活跃的 Agent
  const activeAgents = agentStates.filter(a => a.state === 'active')
  const currentAgentName = progress?.currentAgent || (activeAgents.length > 0 ? activeAgents[0].name : null)

  return (
    <div className="bg-mgx-surface rounded-xl border border-mgx-border p-4 mb-4 animate-in slide-in-from-top duration-300">
      {/* 当前工作状态 */}
      <div className="flex items-center gap-3">
        {/* 活跃 Agent 头像 */}
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-mgx-primary/20 flex items-center justify-center">
            <User className="w-5 h-5 text-mgx-primary" />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-mgx-success border-2 border-mgx-surface flex items-center justify-center">
            <Loader2 className="w-2.5 h-2.5 text-white animate-spin" />
          </div>
        </div>

        {/* 工作状态文本 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-mgx-text">
              {currentAgentName ? (
                <>
                  <span className="text-mgx-primary">{currentAgentName}</span> is working
                </>
              ) : (
                'AI Team is working'
              )}
            </span>
            <span className="flex gap-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-mgx-primary animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-mgx-primary animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-mgx-primary animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          </div>
          
          {/* 当前任务描述（如果有） */}
          {currentTask && (
            <p className="text-xs text-mgx-text-muted mt-0.5 truncate">
              {currentTask}
            </p>
          )}
        </div>

        {/* 活跃 Agent 列表 */}
        {activeAgents.length > 0 && (
          <div className="flex -space-x-2">
            {activeAgents.slice(0, 3).map((agent) => (
              <div
                key={agent.name}
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium',
                  'bg-mgx-primary text-white border-2 border-mgx-surface',
                  'ring-2 ring-mgx-primary/30'
                )}
                title={agent.name}
              >
                {agent.name.charAt(0)}
              </div>
            ))}
            {activeAgents.length > 3 && (
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium bg-mgx-surface-light text-mgx-text-muted border-2 border-mgx-surface">
                +{activeAgents.length - 3}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
