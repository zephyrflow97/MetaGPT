/**
 * 前端配置文件
 * 支持公网访问模式
 */

// 判断是否在浏览器环境
const isBrowser = typeof window !== 'undefined'

/**
 * 获取 API 基础地址
 * - 开发环境: 使用相对路径，通过 Next.js rewrites 代理
 * - 生产环境: 可通过环境变量配置
 */
export function getApiBase(): string {
  // 如果设置了环境变量，使用环境变量
  if (process.env.NEXT_PUBLIC_API_BASE) {
    return process.env.NEXT_PUBLIC_API_BASE
  }
  // 默认使用相对路径（通过 Next.js rewrites 代理到后端）
  return ''
}

/**
 * 获取 WebSocket 地址
 * 自动检测当前页面的 host，支持公网访问
 */
export function getWsUrl(path: string): string {
  // 如果设置了环境变量，使用环境变量
  if (process.env.NEXT_PUBLIC_WS_HOST) {
    const protocol = isBrowser && window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${process.env.NEXT_PUBLIC_WS_HOST}${path}`
  }
  
  // 在浏览器环境，使用当前页面的 host
  if (isBrowser) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    // WebSocket 直接连接后端（因为 Next.js 的 rewrites 不支持 WebSocket）
    // 需要使用与 API 相同的 host，但端口是后端端口
    const host = window.location.host
    
    // 如果是开发环境（前端 3000，后端 8000），需要替换端口
    if (host.includes(':3000')) {
      return `${protocol}//${host.replace(':3000', ':8000')}${path}`
    }
    
    // 生产环境或反向代理环境，使用相同 host
    return `${protocol}//${host}${path}`
  }
  
  // 服务端渲染时的默认值
  return `ws://localhost:8000${path}`
}

/**
 * 获取预览 URL
 */
export function getPreviewUrl(projectId: string): string {
  const apiBase = getApiBase()
  if (apiBase) {
    return `${apiBase}/preview/${projectId}/`
  }
  
  // 使用相对路径
  if (isBrowser) {
    const host = window.location.host
    const protocol = window.location.protocol
    
    // 开发环境需要替换端口
    if (host.includes(':3000')) {
      return `${protocol}//${host.replace(':3000', ':8000')}/preview/${projectId}/`
    }
    
    return `/preview/${projectId}/`
  }
  
  return `http://localhost:8000/preview/${projectId}/`
}

// 导出常量
export const API_BASE = getApiBase()

