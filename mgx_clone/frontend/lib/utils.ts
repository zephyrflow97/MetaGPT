import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateClientId(): string {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDate(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) {
    return 'Today'
  } else if (days === 1) {
    return 'Yesterday'
  } else if (days < 7) {
    return `${days} days ago`
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }
}

export function getAgentColor(agent: string): string {
  const agentLower = agent.toLowerCase()
  if (agentLower.includes('teamleader') || agentLower.includes('mike')) {
    return 'agent-teamleader'
  } else if (agentLower.includes('productmanager') || agentLower.includes('alice')) {
    return 'agent-productmanager'
  } else if (agentLower.includes('architect') || agentLower.includes('bob')) {
    return 'agent-architect'
  } else if (agentLower.includes('engineer') || agentLower.includes('alex')) {
    return 'agent-engineer'
  } else if (agentLower.includes('dataanalyst') || agentLower.includes('david')) {
    return 'agent-dataanalyst'
  }
  return 'agent-system'
}

export function getFileLanguage(extension: string): string {
  const languageMap: Record<string, string> = {
    '.py': 'python',
    '.js': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.jsx': 'javascript',
    '.html': 'html',
    '.css': 'css',
    '.json': 'json',
    '.md': 'markdown',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.sh': 'shell',
    '.sql': 'sql',
    '.go': 'go',
    '.rs': 'rust',
    '.java': 'java',
    '.cpp': 'cpp',
    '.c': 'c',
    '.h': 'c',
    '.hpp': 'cpp',
  }
  return languageMap[extension] || 'plaintext'
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + '...'
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return 'text-mgx-success'
    case 'running':
      return 'text-mgx-accent'
    case 'failed':
      return 'text-mgx-error'
    case 'pending':
      return 'text-mgx-warning'
    default:
      return 'text-mgx-text-muted'
  }
}

export function getStatusIcon(status: string): string {
  switch (status) {
    case 'completed':
      return '✓'
    case 'running':
      return '⟳'
    case 'failed':
      return '✗'
    case 'pending':
      return '○'
    default:
      return '•'
  }
}

