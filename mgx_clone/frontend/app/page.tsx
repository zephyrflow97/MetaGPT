'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { ChatArea } from '@/components/ChatArea'
import { CodePreview } from '@/components/CodePreview'
import { Message, Project, FileInfo, ConversationMode } from '@/lib/types'
import { generateClientId } from '@/lib/utils'

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)  // Track currently active project (viewing or generating)
  const [showPreview, setShowPreview] = useState(false)
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [projectFiles, setProjectFiles] = useState<FileInfo[]>([])
  const [conversationMode, setConversationMode] = useState<ConversationMode>('new_project')
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

  // Load projects on mount
  useEffect(() => {
    fetchProjects()
  }, [])

  // Connect WebSocket - handle React Strict Mode double mount
  useEffect(() => {
    let isMounted = true
    let ws: WebSocket | null = null

    const connect = () => {
      if (!isMounted) return
      
      const wsUrl = `ws://localhost:8000/ws/chat/${clientIdRef.current}`
      ws = new WebSocket(wsUrl)

      ws.onopen = () => {
        if (isMounted) {
          console.log('WebSocket connected')
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
  }, [])

  const handleWebSocketMessage = (data: any) => {
    const messageProjectId = data.project_id
    const conversationRound = data.conversation_round
    
    const newMessage: Message = {
      id: generateMessageId(),
      type: data.type,
      agent: data.agent || 'System',
      content: data.content,
      timestamp: new Date().toISOString(),
      projectId: messageProjectId,
      conversationRound: conversationRound,
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
    } else if (data.type === 'status' && (data.status === 'continuing' || data.status === 'regenerating')) {
      // Continuing conversation on existing project
      activeProjectIdRef.current = messageProjectId
      setActiveProjectId(messageProjectId)
      setMessages((prev) => [...prev, newMessage])
    } else if (data.type === 'agent_message' || data.type === 'status') {
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
      // Don't clear active project for continued conversations - keep it selected
      fetchProjects()
      if (messageProjectId) {
        loadProjectDetails(messageProjectId)
      }
    } else if (data.type === 'error') {
      setMessages((prev) => [...prev, newMessage])
      setIsGenerating(false)
    }
  }

  const fetchProjects = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/projects')
      const data = await response.json()
      setProjects(data.projects || [])
    } catch (error) {
      console.error('Failed to fetch projects:', error)
    }
  }

  const loadProjectDetails = async (projectId: string) => {
    try {
      const [projectRes, filesRes, messagesRes] = await Promise.all([
        fetch(`http://localhost:8000/api/projects/${projectId}`),
        fetch(`http://localhost:8000/api/projects/${projectId}/files`),
        fetch(`http://localhost:8000/api/projects/${projectId}/messages`),
      ])

      const project = await projectRes.json()
      const filesData = await filesRes.json()
      const messagesData = await messagesRes.json()

      setCurrentProject(project)
      currentProjectRef.current = project  // Keep ref in sync
      setProjectFiles(filesData.files || [])
      
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
    } catch (error) {
      console.error('Failed to load project details:', error)
    }
  }

  const loadFileContent = async (file: FileInfo) => {
    if (!currentProject) return

    try {
      const response = await fetch(
        `http://localhost:8000/api/projects/${currentProject.id}/files/${file.path}`
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
    if (!content.trim() || isGenerating) return

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
      wsRef.current.send(
        JSON.stringify({
          type: 'regenerate_project',
          project_id: currentProject.id,
        })
      )
    }
  }

  const handleSelectProject = (project: Project) => {
    loadProjectDetails(project.id)
  }

  const handleDownloadProject = async () => {
    if (!currentProject) return
    window.open(
      `http://localhost:8000/api/projects/${currentProject.id}/download`,
      '_blank'
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
          }
        }}
      />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat Area */}
        <ChatArea
          messages={messages}
          isGenerating={isGenerating}
          onSendMessage={handleSendMessage}
          showPreview={showPreview}
          currentProject={currentProject}
          onRegenerate={handleRegenerateProject}
          conversationMode={conversationMode}
        />

        {/* Code Preview */}
        {showPreview && currentProject && (
          <CodePreview
            project={currentProject}
            files={projectFiles}
            selectedFile={selectedFile}
            fileContent={fileContent}
            onSelectFile={loadFileContent}
            onDownload={handleDownloadProject}
            onClose={() => setShowPreview(false)}
            onFileContentChange={handleFileContentChange}
          />
        )}
      </div>
    </div>
  )
}

