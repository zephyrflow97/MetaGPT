import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MGX Clone - AI-Powered Development',
  description: 'Create applications with natural language using MetaGPT multi-agent system',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="gradient-bg antialiased">
        {children}
      </body>
    </html>
  )
}

