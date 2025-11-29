'use client'

import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/lib/auth-context'
import { User, LogOut, Settings, ChevronDown } from 'lucide-react'
import Link from 'next/link'

export function UserMenu() {
  const { user, logout, isAuthenticated } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!isAuthenticated || !user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="px-4 py-2 text-sm text-mgx-text-secondary hover:text-mgx-text-primary transition-colors"
        >
          Sign In
        </Link>
        <Link
          href="/register"
          className="px-4 py-2 text-sm bg-mgx-accent hover:bg-mgx-accent-hover text-white rounded-lg transition-colors"
        >
          Sign Up
        </Link>
      </div>
    )
  }

  const displayName = user.display_name || user.username
  const initials = displayName.substring(0, 2).toUpperCase()

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-mgx-bg-secondary transition-colors"
      >
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={displayName}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-mgx-accent flex items-center justify-center text-white text-sm font-medium">
            {initials}
          </div>
        )}
        <span className="text-sm text-mgx-text-primary hidden sm:block">
          {displayName}
        </span>
        <ChevronDown size={16} className={`text-mgx-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 bottom-full mb-2 w-56 bg-[#1a1a2e] border border-mgx-border rounded-lg shadow-xl z-50">
          <div className="p-3 border-b border-mgx-border bg-[#1a1a2e] rounded-t-lg">
            <p className="text-sm font-medium text-mgx-text-primary">{displayName}</p>
            <p className="text-xs text-mgx-text-muted truncate">{user.email}</p>
          </div>
          
          <div className="p-1 bg-[#1a1a2e] rounded-b-lg">
            <Link
              href="/profile"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-3 py-2 text-sm text-mgx-text-secondary hover:text-mgx-text-primary hover:bg-[#252542] rounded-md transition-colors"
            >
              <User size={16} />
              Profile Settings
            </Link>
            
            <button
              onClick={() => {
                logout()
                setIsOpen(false)
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-[#252542] rounded-md transition-colors"
            >
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

