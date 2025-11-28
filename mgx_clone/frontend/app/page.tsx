'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { ChatArea } from '@/components/ChatArea'
import { CodePreview } from '@/components/CodePreview'
import { Message, Project, FileInfo } from '@/lib/types'
import { generateClientId } from '@/lib/utils'

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null)
  const [fileContent, setFileContent] = useState<string>('')
  const [projectFiles, setProjectFiles] = useState<FileInfo[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const clientIdRef = useRef<string>(generateClientId())
  const messageIdCounter = useRef<number>(0)

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
    const newMessage: Message = {
      id: generateMessageId(),
      type: data.type,
      agent: data.agent || 'System',
      content: data.content,
      timestamp: new Date().toISOString(),
      projectId: data.project_id,
    }

    if (data.type === 'agent_message' || data.type === 'status') {
      setMessages((prev) => [...prev, newMessage])
    } else if (data.type === 'complete') {
      setMessages((prev) => [...prev, newMessage])
      setIsGenerating(false)
      fetchProjects()
      if (data.project_id) {
        loadProjectDetails(data.project_id)
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
      const [projectRes, filesRes] = await Promise.all([
        fetch(`http://localhost:8000/api/projects/${projectId}`),
        fetch(`http://localhost:8000/api/projects/${projectId}/files`),
      ])

      const project = await projectRes.json()
      const filesData = await filesRes.json()

      setCurrentProject(project)
      setProjectFiles(filesData.files || [])
      setShowPreview(true)
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

  const handleSendMessage = (content: string) => {
    if (!content.trim() || isGenerating) return

    // Add user message
    const userMessage: Message = {
      id: generateMessageId(),
      type: 'user',
      agent: 'User',
      content,
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMessage])

    // Extract project name from content or use default
    const projectName = content.length > 30 
      ? content.substring(0, 30) + '...'
      : content

    // Send to WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setIsGenerating(true)
      wsRef.current.send(
        JSON.stringify({
          type: 'create_project',
          name: projectName,
          requirement: content,
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
          setMessages([])
          setCurrentProject(null)
          setShowPreview(false)
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
          />
        )}
      </div>
    </div>
  )
}

