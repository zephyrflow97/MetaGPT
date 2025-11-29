'use client'

import { useState, useEffect, useRef } from 'react'
import { X, HelpCircle, Send, SkipForward, Loader2 } from 'lucide-react'
import { PendingQuestion } from '@/lib/types'

interface ClarificationDialogProps {
  isOpen: boolean
  question: PendingQuestion | null
  onRespond: (questionId: string, response: string) => void
  onSkip: (questionId: string) => void
  onClose: () => void
}

export function ClarificationDialog({
  isOpen,
  question,
  onRespond,
  onSkip,
  onClose,
}: ClarificationDialogProps) {
  const [response, setResponse] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Reset state when question changes
  useEffect(() => {
    setResponse('')
    setIsSubmitting(false)
  }, [question?.questionId])

  const handleSubmit = async () => {
    if (!question || !response.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      onRespond(question.questionId, response.trim())
      setResponse('')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSkip = () => {
    if (!question || isSubmitting) return
    setIsSubmitting(true)
    onSkip(question.questionId)
    setIsSubmitting(false)
  }

  const handleOptionSelect = (option: string) => {
    if (!question || isSubmitting) return
    setIsSubmitting(true)
    onRespond(question.questionId, option)
    setIsSubmitting(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  if (!isOpen || !question) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-mgx-card border border-mgx-border rounded-xl p-6 w-full max-w-lg mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-mgx-accent/20 rounded-lg">
              <HelpCircle className="text-mgx-accent" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-mgx-text">
                Agent Question
              </h2>
              <p className="text-sm text-mgx-muted">
                {question.agent} needs your input
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-mgx-muted hover:text-mgx-text transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Question Content */}
        <div className="mb-6 p-4 bg-mgx-sidebar rounded-lg border border-mgx-border">
          <p className="text-mgx-text whitespace-pre-wrap">{question.content}</p>
        </div>

        {/* Options (if provided) */}
        {question.options && question.options.length > 0 && (
          <div className="mb-6">
            <p className="text-sm font-medium text-mgx-muted mb-3">
              Quick options:
            </p>
            <div className="flex flex-wrap gap-2">
              {question.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleOptionSelect(option)}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-mgx-hover hover:bg-mgx-accent/20 
                             text-mgx-text text-sm rounded-lg border border-mgx-border
                             transition-colors disabled:opacity-50"
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Custom Response Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-mgx-muted mb-2">
            Your response:
          </label>
          <textarea
            ref={inputRef}
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your answer here..."
            disabled={isSubmitting}
            className="w-full h-24 px-4 py-3 bg-mgx-sidebar border border-mgx-border rounded-lg
                       text-mgx-text placeholder:text-mgx-muted
                       focus:outline-none focus:ring-2 focus:ring-mgx-accent/50
                       resize-none disabled:opacity-50"
          />
          <p className="mt-1 text-xs text-mgx-muted">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleSkip}
            disabled={isSubmitting}
            className="px-4 py-3 bg-mgx-hover hover:bg-mgx-border text-mgx-muted
                       rounded-lg flex items-center justify-center gap-2 transition-colors
                       disabled:opacity-50"
          >
            <SkipForward size={18} />
            Skip (use default)
          </button>
          <button
            onClick={handleSubmit}
            disabled={!response.trim() || isSubmitting}
            className="flex-1 py-3 bg-mgx-accent hover:bg-mgx-accent/90 disabled:opacity-50
                       text-white font-medium rounded-lg flex items-center justify-center gap-2
                       transition-colors"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send size={18} />
                Send Response
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

