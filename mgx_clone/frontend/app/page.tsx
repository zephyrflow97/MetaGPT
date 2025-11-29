'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sidebar } from '@/components/Sidebar'
import { ChatArea } from '@/components/ChatArea'
import { CodePreview } from '@/components/CodePreview'
import { TemplateSelector } from '@/components/TemplateSelector'
import { ProgressBar } from '@/components/ProgressBar'
import { AgentStatusPanel } from '@/components/AgentStatusPanel'
import { ClarificationDialog } from '@/components/ClarificationDialog'
import { Message, Project, FileInfo, ConversationMode, ProgressInfo, AgentState, ProjectTemplate, PendingQuestion } from '@/lib/types'
import { generateClientId } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import { getApiBase, getWsUrl } from '@/lib/config'
import { Sparkles, ArrowRight, LogIn, UserPlus } from 'lucide-react'

// 获取 API 基础地址
const API_BASE = getApiBase()

export default function Home() {
  const router = useRouter()
  const { token, isAuthenticated, isLoading: authLoading } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)  // Track currently active project (viewing or generating)
  const [showPreview, setShowPreview] = useState(false)
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [projectFiles, setProjectFiles] = useState<FileInfo[]>([])
  const [totalFilesCount, setTotalFilesCount] = useState<number>(0)
  const [isFilesTruncated, setIsFilesTruncated] = useState(false)
  const [conversationMode, setConversationMode] = useState<ConversationMode>('new_project')
  const [showTemplateSelector, setShowTemplateSelector] = useState(false)
  const [progressInfo, setProgressInfo] = useState<ProgressInfo | null>(null)
  const [agentStates, setAgentStates] = useState<AgentState[]>([])
  const [failedProjectId, setFailedProjectId] = useState<string | null>(null)
  const [isLoadingProject, setIsLoadingProject] = useState(false)
  const [pendingQuestion, setPendingQuestion] = useState<PendingQuestion | null>(null)
  const [showClarificationDialog, setShowClarificationDialog] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const clientIdRef = useRef<string>(generateClientId())
  const messageIdCounter = useRef<number>(0)
  const activeProjectIdRef = useRef<string | null>(null)  // Ref for WebSocket callback access
  const currentProjectRef = useRef<Project | null>(null)  // Ref for WebSocket callback access

  // Generate unique message ID
  const generateMessageId = () => {
    messageIdCounter.current += 1
    return `${Date.now()}-${messageIdCounter.current}-${Math.random().toString(36).substring(2, 9)}`
  }

  // Load projects when auth state changes
  useEffect(() => {
    fetchProjects()
  }, [token])

  // Connect WebSocket - handle React Strict Mode double mount
  // Reconnect when token changes
  useEffect(() => {
    let isMounted = true
    let ws: WebSocket | null = null

    const connect = () => {
      if (!isMounted) return
      
      // Build WebSocket URL with optional token (支持公网访问)
      let wsUrl = getWsUrl(`/ws/chat/${clientIdRef.current}`)
      if (token) {
        wsUrl += `?token=${encodeURIComponent(token)}`
      }
      ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        if (isMounted) {
          console.log('WebSocket connected', token ? '(authenticated)' : '(anonymous)')
          wsRef.current = ws
        }
      }

      ws.onmessage = (event) => {
        if (isMounted) {
          const data = JSON.parse(event.data)
          handleWebSocketMessage(data)
        }
      }

      ws.onclose = () => {
        if (isMounted) {
          console.log('WebSocket disconnected')
          wsRef.current = null
          // Reconnect after 3 seconds
          setTimeout(connect, 3000)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
      }
    }

    connect()

    return () => {
      isMounted = false
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close()
      }
      wsRef.current = null
    }
  }, [token])

  const handleWebSocketMessage = (data: any) => {
    const messageProjectId = data.project_id
    const conversationRound = data.conversation_round
    
    // Handle progress updates
    if (data.type === 'progress') {
      if (data.progress) {
        // Convert snake_case to camelCase for currentAgent
        setProgressInfo({
          current: data.progress.current,
          total: data.progress.total,
          percentage: data.progress.percentage,
          currentAgent: data.progress.current_agent,  // Map snake_case to camelCase
        })
      }
      if (data.agent_states) {
        setAgentStates(data.agent_states)
      }
      return  // Don't create a message for progress updates
    }
    
    // Handle agent status updates
    if (data.type === 'agent_status') {
      if (data.agent_states) {
        setAgentStates(data.agent_states)
      }
      return  // Don't create a message for agent status updates
    }
    
    // Handle task updates from MetaGPT Plan (key for tracking agent work)
    if (data.type === 'task_update') {
      console.log('[task_update] Received:', data)
      if (data.progress) {
        setProgressInfo({
          current: data.progress.current,
          total: data.progress.total,
          percentage: data.progress.percentage,
          currentAgent: data.current_assignee || data.progress.current_agent,
          currentTask: data.instruction,  // 当前任务描述
        })
      }
      if (data.agent_states) {
        setAgentStates(data.agent_states)
      }
      return  // Don't create a message for task updates
    }
    
    // Handle clarification request from Agent
    if (data.type === 'clarification') {
      console.log('[clarification] Received:', data)
      const question: PendingQuestion = {
        questionId: data.question_id,
        projectId: messageProjectId,
        agent: data.agent || 'System',
        content: data.content,
        questionType: data.question_type || 'inline',
        options: data.options,
        timestamp: new Date().toISOString(),
      }
      console.log('[clarification] Setting pendingQuestion:', question)
      setPendingQuestion(question)
      
      // Show modal dialog for 'modal' type, otherwise handle inline
      if (data.question_type === 'modal') {
        setShowClarificationDialog(true)
      }
      
      // Also add as a message for display in chat
      const clarificationMessage: Message = {
        id: generateMessageId(),
        type: 'clarification',
        agent: data.agent || 'System',
        content: data.content,
        timestamp: new Date().toISOString(),
        projectId: messageProjectId,
        questionId: data.question_id,
        questionType: data.question_type || 'inline',
        options: data.options,
      }
      setMessages((prev) => [...prev, clarificationMessage])
      return
    }
    
    // Handle response acknowledgment
    if (data.type === 'response_received') {
      setPendingQuestion(null)
      setShowClarificationDialog(false)
      return
    }
    
    // Handle question timeout
    if (data.type === 'question_timeout') {
      setPendingQuestion(null)
      setShowClarificationDialog(false)
      const timeoutMessage: Message = {
        id: generateMessageId(),
        type: 'status',
        agent: 'System',
        content: data.content || 'Question timed out, using default behavior',
        timestamp: new Date().toISOString(),
        projectId: messageProjectId,
      }
      setMessages((prev) => [...prev, timeoutMessage])
      return
    }
    
    const newMessage: Message = {
      id: generateMessageId(),
      type: data.type,
      agent: data.agent || 'System',
      content: data.content,
      timestamp: new Date().toISOString(),
      projectId: messageProjectId,
      conversationRound: conversationRound,
      canRetry: data.can_retry,
    }

    // Only add message if it belongs to the currently active project
    // When status message arrives with project_id, set it as active project
    if (data.type === 'status' && messageProjectId && data.status === 'created') {
      // New project started - set as active and clear old messages (keep user message)
      activeProjectIdRef.current = messageProjectId
      setActiveProjectId(messageProjectId)
      // Refresh projects list to show the new project in sidebar
      fetchProjects()
      setMessages((prev) => {
        // Keep only the last user message (the requirement that started this project)
        const userMessages = prev.filter(m => m.type === 'user')
        const lastUserMessage = userMessages[userMessages.length - 1]
        return lastUserMessage ? [lastUserMessage, newMessage] : [newMessage]
      })
    } else if (data.type === 'status' && (data.status === 'continuing' || data.status === 'regenerating' || data.status === 'retrying')) {
      // Continuing conversation on existing project
      activeProjectIdRef.current = messageProjectId
      setActiveProjectId(messageProjectId)
      setMessages((prev) => [...prev, newMessage])
    } else if (data.type === 'agent_message' || data.type === 'status' || data.type === 'reply_to_human') {
      // Only add if matches active project (use ref for latest value in closure)
      setMessages((prev) => {
        // Check if this message belongs to our active session
        if (!messageProjectId || messageProjectId === activeProjectIdRef.current) {
          return [...prev, newMessage]
        }
        return prev
      })
    } else if (data.type === 'complete') {
      setMessages((prev) => [...prev, newMessage])
      setIsGenerating(false)
      setProgressInfo(null)  // Clear progress
      setAgentStates([])  // Clear agent states
      setFailedProjectId(null)  // Clear failed project
      setPendingQuestion(null)  // Clear any pending questions
      // Don't clear active project for continued conversations - keep it selected
      fetchProjects()
      if (messageProjectId) {
        loadProjectDetails(messageProjectId)
      }
    } else if (data.type === 'error') {
      setMessages((prev) => [...prev, newMessage])
      setIsGenerating(false)
      setProgressInfo(null)
      setPendingQuestion(null)  // Clear any pending questions
      // Track failed project for retry
      if (data.can_retry && messageProjectId) {
        setFailedProjectId(messageProjectId)
      }
    }
  }

  const fetchProjects = async () => {
    try {
      const headers: HeadersInit = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      const response = await fetch(`${API_BASE}/api/projects`, { headers })
      const data = await response.json()
      setProjects(data.projects || [])
    } catch (error) {
      console.error('Failed to fetch projects:', error)
    }
  }

  const loadProjectDetails = async (projectId: string) => {
    setIsLoadingProject(true)
    try {
      // Load project and messages first (fast), files can be slightly delayed
      const [projectRes, messagesRes] = await Promise.all([
        fetch(`${API_BASE}/api/projects/${projectId}`),
        fetch(`${API_BASE}/api/projects/${projectId}/messages`),
      ])

      const project = await projectRes.json()
      const messagesData = await messagesRes.json()

      // Update UI immediately with project and messages
      setCurrentProject(project)
      currentProjectRef.current = project  // Keep ref in sync
      
      // Load saved messages and add user's original requirement as first message
      const savedMessages: Message[] = []
      
      // Add original user requirement as first message
      if (project.requirement) {
        savedMessages.push({
          id: `user-${project.id}`,
          type: 'user',
          agent: 'User',
          content: project.requirement,
          timestamp: project.created_at,
          projectId: project.id,
          conversationRound: 1,
        })
      }
      
      // Add saved agent messages (including user messages from multi-turn)
      if (messagesData.messages && messagesData.messages.length > 0) {
        messagesData.messages.forEach((msg: any) => {
          savedMessages.push({
            id: msg.id,
            type: msg.message_type,
            agent: msg.agent,
            content: msg.content,
            timestamp: msg.created_at,
            projectId: msg.project_id,
            conversationRound: msg.conversation_round || 1,
          })
        })
      }
      
      // Only update messages if not currently generating another project
      if (!isGenerating) {
        setMessages(savedMessages)
        activeProjectIdRef.current = projectId
        setActiveProjectId(projectId)
      }
      setShowPreview(true)
      
      // Set conversation mode based on project status
      setConversationMode(project.status === 'completed' ? 'continue_conversation' : 'new_project')
      
      // Load files in background (non-blocking)
      fetch(`${API_BASE}/api/projects/${projectId}/files`)
        .then(res => res.json())
        .then(filesData => {
          setProjectFiles(filesData.files || [])
          setTotalFilesCount(filesData.total || filesData.files?.length || 0)
          setIsFilesTruncated(filesData.truncated || false)
        })
        .catch(err => console.error('Failed to load files:', err))
        .finally(() => setIsLoadingProject(false))
    } catch (error) {
      console.error('Failed to load project details:', error)
      setIsLoadingProject(false)
    }
  }

  const loadFileContent = async (file: FileInfo) => {
    if (!currentProject) return

    try {
      const response = await fetch(
        `${API_BASE}/api/projects/${currentProject.id}/files/${file.path}`
      )
      const data = await response.json()
      setFileContent(data.content)
      setSelectedFile(file)
    } catch (error) {
      console.error('Failed to load file content:', error)
    }
  }

  const handleFileContentChange = useCallback((newContent: string) => {
    setFileContent(newContent)
  }, [])

  const handleSendMessage = (content: string) => {
    if (!content.trim()) return
    
    // If there's a pending question, treat this as a response to it
    if (pendingQuestion) {
      handleClarificationResponse(pendingQuestion.questionId, content)
      return
    }
    
    // Normal message flow - don't send if generating (unless responding to question)
    if (isGenerating) return

    // Add user message
    const userMessage: Message = {
      id: generateMessageId(),
      type: 'user',
      agent: 'User',
      content,
      timestamp: new Date().toISOString(),
      projectId: currentProjectRef.current?.id,
    }
    setMessages((prev) => [...prev, userMessage])

    // Send to WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setIsGenerating(true)
      
      // Check if we should continue conversation on existing project
      if (currentProjectRef.current && currentProjectRef.current.status === 'completed') {
        // Continue conversation
        wsRef.current.send(
          JSON.stringify({
            type: 'continue_conversation',
            project_id: currentProjectRef.current.id,
            message: content,
          })
        )
      } else {
        // Create new project
        const projectName = content.length > 30 
          ? content.substring(0, 30) + '...'
          : content
        wsRef.current.send(
          JSON.stringify({
            type: 'create_project',
            name: projectName,
            requirement: content,
          })
        )
      }
    }
  }

  const handleRegenerateProject = () => {
    if (!currentProject || isGenerating) return

    // Add regenerate message
    const regenMessage: Message = {
      id: generateMessageId(),
      type: 'user',
      agent: 'User',
      content: '🔄 Regenerate project',
      timestamp: new Date().toISOString(),
      projectId: currentProject.id,
    }
    setMessages((prev) => [...prev, regenMessage])

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setIsGenerating(true)
      setAgentStates([])  // Reset agent states
      setProgressInfo(null)  // Reset progress
      wsRef.current.send(
        JSON.stringify({
          type: 'regenerate_project',
          project_id: currentProject.id,
        })
      )
    }
  }

  const handleRetryProject = (projectId: string) => {
    if (isGenerating) return

    // Add retry message
    const retryMessage: Message = {
      id: generateMessageId(),
      type: 'user',
      agent: 'User',
      content: '🔄 Retry project generation',
      timestamp: new Date().toISOString(),
      projectId: projectId,
    }
    setMessages((prev) => [...prev, retryMessage])

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setIsGenerating(true)
      setFailedProjectId(null)
      setAgentStates([])
      setProgressInfo(null)
      wsRef.current.send(
        JSON.stringify({
          type: 'retry_project',
          project_id: projectId,
        })
      )
    }
  }

  const handleTemplateSelect = (
    template: ProjectTemplate, 
    features: string[], 
    customRequirements: string, 
    projectName: string
  ) => {
    if (isGenerating) return

    // Add user message showing template selection
    const userMessage: Message = {
      id: generateMessageId(),
      type: 'user',
      agent: 'User',
      content: `📋 Create from template: ${template.name}\n\nProject: ${projectName}\nFeatures: ${features.join(', ')}${customRequirements ? `\n\nAdditional: ${customRequirements}` : ''}`,
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMessage])

    // Send to WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setIsGenerating(true)
      setShowTemplateSelector(false)
      setAgentStates([])
      setProgressInfo(null)
      wsRef.current.send(
        JSON.stringify({
          type: 'create_from_template',
          template_id: template.id,
          name: projectName,
          features: features,
          custom_requirements: customRequirements,
        })
      )
    }
  }

  const handleSelectProject = (project: Project) => {
    loadProjectDetails(project.id)
  }

  // Handle user response to clarification question
  const handleClarificationResponse = (questionId: string, response: string) => {
    console.log('[handleClarificationResponse] Called with:', { questionId, response, pendingQuestion })
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('[handleClarificationResponse] WebSocket not open!')
      return
    }
    
    // Add user response as a message
    const responseMessage: Message = {
      id: generateMessageId(),
      type: 'user_response',
      agent: 'User',
      content: response,
      timestamp: new Date().toISOString(),
      projectId: pendingQuestion?.projectId,
      questionId: questionId,
    }
    setMessages((prev) => [...prev, responseMessage])
    
    const payload = {
      type: 'user_response',
      question_id: questionId,
      project_id: pendingQuestion?.projectId,
      response: response,
    }
    console.log('[handleClarificationResponse] Sending:', payload)
    
    // Send response to server
    wsRef.current.send(JSON.stringify(payload))
    
    // Clear pending question (will be confirmed by server)
    setPendingQuestion(null)
    setShowClarificationDialog(false)
  }

  // Handle skipping a clarification question
  const handleSkipQuestion = (questionId: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    
    // Add skip message
    const skipMessage: Message = {
      id: generateMessageId(),
      type: 'user_response',
      agent: 'User',
      content: '[Skipped - using default]',
      timestamp: new Date().toISOString(),
      projectId: pendingQuestion?.projectId,
      questionId: questionId,
      skipped: true,
    }
    setMessages((prev) => [...prev, skipMessage])
    
    // Send skip to server
    wsRef.current.send(
      JSON.stringify({
        type: 'skip_question',
        question_id: questionId,
      })
    )
    
    // Clear pending question
    setPendingQuestion(null)
    setShowClarificationDialog(false)
  }

  const handleDownloadProject = async () => {
    if (!currentProject) return
    window.open(
      `${API_BASE}/api/projects/${currentProject.id}/download`,
      '_blank'
    )
  }

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-mgx-bg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-mgx-accent mx-auto mb-4"></div>
          <p className="text-mgx-muted">Loading...</p>
        </div>
      </div>
    )
  }

  // Show login required page if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-mgx-bg via-mgx-sidebar to-mgx-bg">
        <div className="max-w-md w-full mx-4">
          <div className="bg-mgx-card rounded-2xl shadow-2xl border border-mgx-border p-8">
            {/* Logo & Title */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-mgx-accent to-purple-600 mb-4">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-mgx-text mb-2">
                Welcome to MGX Clone
              </h1>
              <p className="text-mgx-muted">
                AI-powered code generation platform
              </p>
            </div>

            {/* Description */}
            <div className="mb-8 p-4 bg-mgx-sidebar rounded-xl border border-mgx-border">
              <p className="text-sm text-mgx-muted text-center">
                Please log in to create and manage your AI-generated projects.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Link
                href="/login"
                className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-gradient-to-r from-mgx-accent to-purple-600 hover:from-mgx-accent/90 hover:to-purple-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-mgx-accent/20"
              >
                <LogIn className="w-5 h-5" />
                Sign In
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/register"
                className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-mgx-sidebar hover:bg-mgx-hover text-mgx-text border border-mgx-border rounded-xl font-medium transition-all"
              >
                <UserPlus className="w-5 h-5" />
                Create Account
              </Link>
            </div>

            {/* Footer */}
            <p className="text-xs text-mgx-muted text-center mt-6">
              Built with MetaGPT • Powered by AI
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        projects={projects}
        currentProject={currentProject}
        onSelectProject={handleSelectProject}
        onNewChat={() => {
          if (!isGenerating) {
            setMessages([])
            setCurrentProject(null)
            currentProjectRef.current = null
            activeProjectIdRef.current = null
            setActiveProjectId(null)
            setShowPreview(false)
            setConversationMode('new_project')
            setProgressInfo(null)
            setAgentStates([])
            setFailedProjectId(null)
          }
        }}
        onOpenTemplates={() => setShowTemplateSelector(true)}
      />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat Area with Progress */}
        <div className={`flex flex-col overflow-hidden ${showPreview && currentProject && !isGenerating ? 'w-1/2' : 'flex-1'}`}>
          {/* Progress Bar - Shows during generation, fixed at top */}
          {isGenerating && (
            <div className="shrink-0 px-6 pt-4 pb-2 border-b border-mgx-border/50 bg-mgx-bg/95 backdrop-blur-sm sticky top-0 z-10">
              <ProgressBar
                progress={progressInfo}
                agentStates={agentStates}
                isGenerating={isGenerating}
                currentTask={progressInfo?.currentTask}
              />
            </div>
          )}
          
          {/* Chat Area */}
          <ChatArea
            messages={messages}
            isGenerating={isGenerating}
            onSendMessage={handleSendMessage}
            showPreview={showPreview}
            currentProject={currentProject}
            onRegenerate={handleRegenerateProject}
            onRetry={failedProjectId ? () => handleRetryProject(failedProjectId) : undefined}
            conversationMode={conversationMode}
            pendingQuestion={pendingQuestion}
            onSkipQuestion={pendingQuestion ? () => handleSkipQuestion(pendingQuestion.questionId) : undefined}
            currentAgent={progressInfo?.currentAgent}
          />
        </div>

        {/* Agent Status Panel - Shows during generation */}
        {isGenerating && (
          <div className="w-80 shrink-0 border-l border-mgx-border bg-mgx-bg/95 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4">
              <AgentStatusPanel
                agentStates={agentStates}
                isGenerating={isGenerating}
                currentTask={progressInfo?.currentTask}
              />
            </div>
          </div>
        )}

        {/* Code Preview */}
        {showPreview && currentProject && !isGenerating && (
          <CodePreview
            project={currentProject}
            files={projectFiles}
            selectedFile={selectedFile}
            fileContent={fileContent}
            onSelectFile={loadFileContent}
            onDownload={handleDownloadProject}
            onClose={() => setShowPreview(false)}
            onFileContentChange={handleFileContentChange}
            isLoading={isLoadingProject}
            totalFiles={totalFilesCount}
            isTruncated={isFilesTruncated}
          />
        )}
      </div>

      {/* Template Selector Modal */}
      <TemplateSelector
        isOpen={showTemplateSelector}
        onClose={() => setShowTemplateSelector(false)}
        onSelectTemplate={handleTemplateSelect}
      />

      {/* Clarification Dialog for modal-type questions */}
      <ClarificationDialog
        isOpen={showClarificationDialog}
        question={pendingQuestion}
        onRespond={handleClarificationResponse}
        onSkip={handleSkipQuestion}
        onClose={() => setShowClarificationDialog(false)}
      />
    </div>
  )
}

