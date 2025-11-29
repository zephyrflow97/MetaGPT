'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, Bot, User, AlertCircle, CheckCircle2, RefreshCw, MessageSquarePlus, RotateCcw, HelpCircle, SkipForward } from 'lucide-react'
import { Message, ConversationMode, Project, PendingQuestion } from '@/lib/types'
import { cn, formatTimestamp, getAgentColor } from '@/lib/utils'

interface ChatAreaProps {
  messages: Message[]
  isGenerating: boolean
  onSendMessage: (content: string) => void
  showPreview: boolean
  currentProject?: Project | null
  onRegenerate?: () => void
  onRetry?: () => void
  conversationMode?: ConversationMode
  pendingQuestion?: PendingQuestion | null
  onSkipQuestion?: () => void
}

export function ChatArea({
  messages,
  isGenerating,
  onSendMessage,
  showPreview,
  currentProject,
  onRegenerate,
  onRetry,
  conversationMode = 'new_project',
  pendingQuestion,
  onSkipQuestion,
}: ChatAreaProps) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  
  // Check if we're in continue conversation mode
  const isContinueMode = currentProject && currentProject.status === 'completed'
  
  // Check if we're answering a question
  const isAnsweringQuestion = !!pendingQuestion

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`
    }
  }, [input])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Allow submission when answering a question OR when not generating
    if (input.trim() && (isAnsweringQuestion || !isGenerating)) {
      onSendMessage(input.trim())
      setInput('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const getMessageIcon = (type: string, agent: string) => {
    if (type === 'user' || type === 'user_response') {
      return <User className="w-4 h-4" />
    } else if (type === 'error') {
      return <AlertCircle className="w-4 h-4" />
    } else if (type === 'complete') {
      return <CheckCircle2 className="w-4 h-4" />
    } else if (type === 'clarification') {
      return <HelpCircle className="w-4 h-4" />
    }
    return <Bot className="w-4 h-4" />
  }

  return (
    <div className="flex flex-col h-full transition-all duration-300 flex-1">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-mgx-primary/20 to-mgx-accent/20 
                          flex items-center justify-center mb-6 animate-float">
              <Sparkles className="w-10 h-10 text-mgx-primary" />
            </div>
            <h2 className="text-2xl font-semibold text-mgx-text mb-3">
              What would you like to build?
            </h2>
            <p className="text-mgx-text-muted text-center max-w-md mb-8">
              Describe your project in natural language and watch our AI team bring it to life.
            </p>
            
            {/* Quick Starters */}
            <div className="grid grid-cols-2 gap-3 max-w-lg">
              {[
                'Create a 2048 game with smooth animations',
                'Build a todo app with local storage',
                'Make a weather dashboard with API integration',
                'Design a portfolio website template',
              ].map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => setInput(prompt)}
                  className="px-4 py-3 text-left text-sm text-mgx-text-muted
                           bg-mgx-surface hover:bg-mgx-surface-light rounded-xl
                           border border-mgx-border hover:border-mgx-primary/50
                           transition-all duration-200"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => {
              // Check if we need to show a round separator
              const prevMessage = index > 0 ? messages[index - 1] : null
              const showRoundSeparator = prevMessage && 
                message.conversationRound && 
                prevMessage.conversationRound && 
                message.conversationRound > prevMessage.conversationRound

              return (
                <div key={message.id}>
                  {/* Round separator */}
                  {showRoundSeparator && (
                    <div className="flex items-center gap-3 my-6">
                      <div className="flex-1 h-px bg-mgx-border" />
                      <span className="text-xs font-medium text-mgx-text-muted px-3 py-1 bg-mgx-surface rounded-full">
                        Round {message.conversationRound}
                      </span>
                      <div className="flex-1 h-px bg-mgx-border" />
                    </div>
                  )}
                  
                  <div
                    className={cn(
                      'message-animate',
                      (message.type === 'user' || message.type === 'user_response') ? 'flex justify-end' : 'flex justify-start'
                    )}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div
                      className={cn(
                        'max-w-[85%] rounded-2xl px-4 py-3',
                        (message.type === 'user' || message.type === 'user_response')
                          ? 'bg-mgx-primary text-white rounded-br-sm'
                          : message.type === 'error'
                          ? 'bg-mgx-error/10 border border-mgx-error/30 text-mgx-error rounded-bl-sm'
                          : message.type === 'complete'
                          ? 'bg-mgx-success/10 border border-mgx-success/30 text-mgx-success rounded-bl-sm'
                          : message.type === 'clarification'
                          ? 'bg-amber-500/10 border border-amber-500/30 rounded-bl-sm'
                          : 'bg-mgx-surface-light border border-mgx-border rounded-bl-sm'
                      )}
                    >
                      {(message.type !== 'user' && message.type !== 'user_response') && (
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className={cn(
                              'w-6 h-6 rounded-full flex items-center justify-center text-white text-xs',
                              message.type === 'clarification' ? 'bg-amber-500' : getAgentColor(message.agent)
                            )}
                          >
                            {getMessageIcon(message.type, message.agent)}
                          </div>
                          <span className="text-xs font-medium text-mgx-text-muted">
                            {message.agent}
                            {message.type === 'clarification' && ' is asking a question'}
                          </span>
                          <span className="text-xs text-mgx-text-muted opacity-60">
                            {formatTimestamp(message.timestamp)}
                          </span>
                        </div>
                      )}
                      <div className={cn(
                        'text-sm whitespace-pre-wrap break-words',
                        (message.type === 'user' || message.type === 'user_response') ? 'text-white' : 'text-mgx-text'
                      )}>
                        {message.content}
                      </div>
                      
                      {/* Quick options for clarification messages */}
                      {message.type === 'clarification' && message.options && message.options.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {message.options.map((option, idx) => (
                            <button
                              key={idx}
                              onClick={() => onSendMessage(option)}
                              disabled={!pendingQuestion || pendingQuestion.questionId !== message.questionId}
                              className="px-3 py-1.5 text-xs font-medium
                                       bg-amber-500/20 hover:bg-amber-500/30 
                                       text-amber-600 dark:text-amber-400 rounded-lg
                                       transition-all duration-200
                                       disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                      )}
                      
                      {/* Retry button for error messages */}
                      {message.type === 'error' && message.canRetry && onRetry && (
                        <button
                          onClick={onRetry}
                          disabled={isGenerating}
                          className="mt-3 flex items-center gap-2 px-4 py-2 
                                   bg-mgx-error/10 hover:bg-mgx-error/20 
                                   text-mgx-error rounded-lg text-sm font-medium
                                   transition-all duration-200 border border-mgx-error/20
                                   disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Retry Generation
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Typing Indicator */}
            {isGenerating && (
              <div className="flex justify-start message-animate">
                <div className="bg-mgx-surface-light border border-mgx-border rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-mgx-accent typing-dot" />
                      <div className="w-2 h-2 rounded-full bg-mgx-accent typing-dot" />
                      <div className="w-2 h-2 rounded-full bg-mgx-accent typing-dot" />
                    </div>
                    <span className="text-xs text-mgx-text-muted">
                      AI team is working...
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-mgx-border p-4">
        {/* Question answering mode indicator */}
        {isAnsweringQuestion && pendingQuestion && (
          <div className="mb-3">
            <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-2">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-amber-500" />
                <span className="text-sm text-mgx-text">
                  <span className="font-medium">{pendingQuestion.agent}</span> is waiting for your answer
                </span>
              </div>
              {onSkipQuestion && (
                <button
                  onClick={onSkipQuestion}
                  className="flex items-center gap-1 px-3 py-1 text-xs font-medium
                           text-mgx-text-muted hover:text-mgx-text
                           bg-mgx-surface hover:bg-mgx-surface-light
                           rounded-lg transition-all duration-200"
                >
                  <SkipForward className="w-3 h-3" />
                  Skip (use default)
                </button>
              )}
            </div>
          </div>
        )}
        
        {/* Continue mode indicator (only show when not answering a question) */}
        {isContinueMode && !isGenerating && !isAnsweringQuestion && (
          <div className="mb-3">
            <div className="flex items-center justify-between bg-mgx-accent/10 border border-mgx-accent/20 rounded-xl px-4 py-2">
              <div className="flex items-center gap-2">
                <MessageSquarePlus className="w-4 h-4 text-mgx-accent" />
                <span className="text-sm text-mgx-text">
                  Continuing on <span className="font-medium">{currentProject?.name}</span>
                </span>
              </div>
              {onRegenerate && (
                <button
                  onClick={onRegenerate}
                  className="flex items-center gap-1 px-3 py-1 text-xs font-medium
                           text-mgx-text-muted hover:text-mgx-text
                           bg-mgx-surface hover:bg-mgx-surface-light
                           rounded-lg transition-all duration-200"
                >
                  <RefreshCw className="w-3 h-3" />
                  Regenerate
                </button>
              )}
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className={cn(
            "relative flex items-end gap-3 bg-mgx-surface rounded-2xl border transition-all duration-200",
            isAnsweringQuestion 
              ? "border-amber-500/50 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-500/20"
              : "border-mgx-border focus-within:border-mgx-primary/50 focus-within:ring-2 focus-within:ring-mgx-primary/20"
          )}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isAnsweringQuestion 
                ? "Type your answer here..." 
                : isContinueMode 
                  ? "Describe what you want to change or add..." 
                  : "Describe your project..."
              }
              disabled={isGenerating && !isAnsweringQuestion}
              rows={1}
              className="flex-1 bg-transparent text-mgx-text placeholder-mgx-text-muted
                       px-4 py-3 resize-none outline-none text-sm
                       disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={!input.trim() || (isGenerating && !isAnsweringQuestion)}
              className={cn(
                'flex items-center justify-center w-10 h-10 rounded-xl mr-2 mb-2',
                'transition-all duration-200',
                input.trim() && (!isGenerating || isAnsweringQuestion)
                  ? isAnsweringQuestion
                    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/25'
                    : 'bg-mgx-primary hover:bg-mgx-primary-hover text-white shadow-lg shadow-mgx-primary/25'
                  : 'bg-mgx-surface-light text-mgx-text-muted cursor-not-allowed'
              )}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-mgx-text-muted text-center mt-2">
            {isAnsweringQuestion 
              ? "Press Enter to send your answer"
              : isContinueMode 
                ? "Your message will modify the existing project"
                : "Press Enter to send, Shift+Enter for new line"
            }
          </p>
        </form>
      </div>
    </div>
  )
}

