/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // 环境变量配置
  env: {
    // 后端 API 地址，默认使用相对路径（通过 rewrites 代理）
    NEXT_PUBLIC_API_BASE: process.env.NEXT_PUBLIC_API_BASE || '',
    // WebSocket 使用动态地址
    NEXT_PUBLIC_WS_HOST: process.env.NEXT_PUBLIC_WS_HOST || '',
  },
  
  async rewrites() {
    // 后端地址，支持环境变量配置
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000'
    
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/ws/:path*',
        destination: `${backendUrl}/ws/:path*`,
      },
      {
        source: '/preview/:path*',
        destination: `${backendUrl}/preview/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
