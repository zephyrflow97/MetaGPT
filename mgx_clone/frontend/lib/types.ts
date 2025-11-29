// Message types including clarification for user interaction
export type MessageType = 
  | 'user' 
  | 'agent_message' 
  | 'status' 
  | 'error' 
  | 'complete' 
  | 'progress' 
  | 'agent_status'
  | 'clarification'      // Agent asking user for clarification
  | 'user_response'      // User's response to clarification
  | 'response_received'  // Acknowledgment that response was received
  | 'question_timeout'   // Clarification question timed out
  | 'reply_to_human'     // Agent reporting progress to user

export interface Message {
  id: string
  type: MessageType
  agent: string
  content: string
  timestamp: string
  projectId?: string
  conversationRound?: number
  canRetry?: boolean
  // Clarification-specific fields
  questionId?: string
  questionType?: 'inline' | 'modal'
  options?: string[]
  skipped?: boolean
}

export type ConversationMode = 'new_project' | 'continue_conversation' | 'regenerate'

export interface Project {
  id: string
  name: string
  requirement: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'deleted'
  workspace_path?: string
  user_id?: string
  created_at: string
  updated_at: string
}

// User and Authentication types
export interface User {
  id: string
  email: string
  username: string
  display_name?: string
  avatar_url?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AuthResponse extends User {
  access_token: string
  token_type: string
}

export interface LoginRequest {
  email_or_username: string
  password: string
}

export interface RegisterRequest {
  email: string
  username: string
  password: string
  display_name?: string
}

// Share types
export interface ShareInfo {
  id: string
  project_id: string
  share_token: string
  is_public: boolean
  expires_at?: string
  view_count: number
  created_at: string
  share_url: string
}

// Tag types
export interface Tag {
  id: string
  user_id: string
  name: string
  color: string
  created_at: string
}

export interface FileInfo {
  name: string
  path: string
  size: number
  extension: string
}

export interface ProjectFile {
  content: string
  path: string
  binary?: boolean
}

export type AgentType = 
  | 'TeamLeader'
  | 'ProductManager'
  | 'Architect'
  | 'Engineer'
  | 'DataAnalyst'
  | 'System'
  | 'User'

// Template related types
export interface ProjectTemplate {
  id: string
  name: string
  description: string
  icon: string
  category: string
  default_features: string[]
  suggested_features: string[]
}

export interface TemplateCategory {
  id: string
  name: string
  icon: string
  description: string
}

// Progress tracking types
export interface ProgressInfo {
  current: number
  total: number
  percentage: number
  currentAgent?: string
  currentTask?: string  // 当前任务描述
}

export interface AgentState {
  name: string
  state: 'pending' | 'active' | 'completed'
  description: string
}

// Pending clarification question from Agent
export interface PendingQuestion {
  questionId: string
  projectId: string
  agent: string
  content: string
  questionType: 'inline' | 'modal'
  options?: string[]
  timestamp: string
}

// WebSocket message types for clarification
export interface ClarificationMessage {
  type: 'clarification'
  agent: string
  content: string
  project_id: string
  question_id: string
  question_type: 'inline' | 'modal'
  options?: string[]
}

export interface UserResponseMessage {
  type: 'user_response'
  question_id: string
  project_id: string
  response: string
}

export interface SkipQuestionMessage {
  type: 'skip_question'
  question_id: string
}

