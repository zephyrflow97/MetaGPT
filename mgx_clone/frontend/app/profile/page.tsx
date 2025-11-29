'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { User, Lock, Save, Loader2, ArrowLeft, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'

export default function ProfilePage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading, updateProfile, changePassword } = useAuth()
  
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPasswords, setShowPasswords] = useState(false)
  
  const [profileMessage, setProfileMessage] = useState({ type: '', text: '' })
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' })
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [isSavingPassword, setIsSavingPassword] = useState(false)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isAuthenticated, isLoading, router])

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name || '')
      setAvatarUrl(user.avatar_url || '')
    }
  }, [user])

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileMessage({ type: '', text: '' })
    setIsSavingProfile(true)

    try {
      await updateProfile({
        display_name: displayName || undefined,
        avatar_url: avatarUrl || undefined
      })
      setProfileMessage({ type: 'success', text: 'Profile updated successfully!' })
    } catch (err) {
      setProfileMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update profile' })
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordMessage({ type: '', text: '' })

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Passwords do not match' })
      return
    }

    if (newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 8 characters' })
      return
    }

    setIsSavingPassword(true)

    try {
      await changePassword(currentPassword, newPassword)
      setPasswordMessage({ type: 'success', text: 'Password changed successfully!' })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPasswordMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to change password' })
    } finally {
      setIsSavingPassword(false)
    }
  }

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-mgx-bg-primary flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-mgx-accent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-mgx-bg-primary">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-mgx-text-secondary hover:text-mgx-text-primary mb-8 transition-colors"
        >
          <ArrowLeft size={20} />
          Back to Home
        </Link>

        <h1 className="text-3xl font-bold text-mgx-text-primary mb-8">Profile Settings</h1>

        {/* Profile Section */}
        <div className="bg-mgx-bg-secondary border border-mgx-border rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <User className="text-mgx-accent" size={24} />
            <h2 className="text-xl font-semibold text-mgx-text-primary">Profile Information</h2>
          </div>

          <form onSubmit={handleProfileSubmit} className="space-y-4">
            {profileMessage.text && (
              <div className={`p-3 rounded-lg text-sm ${
                profileMessage.type === 'success' 
                  ? 'bg-green-500/10 border border-green-500/30 text-green-400' 
                  : 'bg-red-500/10 border border-red-500/30 text-red-400'
              }`}>
                {profileMessage.text}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-mgx-text-secondary mb-2">
                Email
              </label>
              <input
                type="email"
                value={user.email}
                disabled
                className="w-full px-4 py-3 bg-mgx-bg-tertiary border border-mgx-border rounded-lg
                           text-mgx-text-muted cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-mgx-text-muted">Email cannot be changed</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-mgx-text-secondary mb-2">
                Username
              </label>
              <input
                type="text"
                value={user.username}
                disabled
                className="w-full px-4 py-3 bg-mgx-bg-tertiary border border-mgx-border rounded-lg
                           text-mgx-text-muted cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-mgx-text-muted">Username cannot be changed</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-mgx-text-secondary mb-2">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How you want to be called"
                className="w-full px-4 py-3 bg-[#1a1a2e] border border-mgx-border rounded-lg
                           text-white placeholder-gray-500
                           focus:outline-none focus:ring-2 focus:ring-mgx-accent focus:border-transparent
                           transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-mgx-text-secondary mb-2">
                Avatar URL
              </label>
              <input
                type="url"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://example.com/avatar.jpg"
                className="w-full px-4 py-3 bg-[#1a1a2e] border border-mgx-border rounded-lg
                           text-white placeholder-gray-500
                           focus:outline-none focus:ring-2 focus:ring-mgx-accent focus:border-transparent
                           transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isSavingProfile}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-mgx-accent hover:bg-mgx-accent-hover
                         disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
            >
              {isSavingProfile ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Save Changes
                </>
              )}
            </button>
          </form>
        </div>

        {/* Password Section */}
        <div className="bg-mgx-bg-secondary border border-mgx-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <Lock className="text-mgx-accent" size={24} />
            <h2 className="text-xl font-semibold text-mgx-text-primary">Change Password</h2>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            {passwordMessage.text && (
              <div className={`p-3 rounded-lg text-sm ${
                passwordMessage.type === 'success' 
                  ? 'bg-green-500/10 border border-green-500/30 text-green-400' 
                  : 'bg-red-500/10 border border-red-500/30 text-red-400'
              }`}>
                {passwordMessage.text}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-mgx-text-secondary mb-2">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showPasswords ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-[#1a1a2e] border border-mgx-border rounded-lg
                             text-white placeholder-gray-500
                             focus:outline-none focus:ring-2 focus:ring-mgx-accent focus:border-transparent
                             transition-colors pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                >
                  {showPasswords ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-mgx-text-secondary mb-2">
                New Password
              </label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-3 bg-[#1a1a2e] border border-mgx-border rounded-lg
                           text-white placeholder-gray-500
                           focus:outline-none focus:ring-2 focus:ring-mgx-accent focus:border-transparent
                           transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-mgx-text-secondary mb-2">
                Confirm New Password
              </label>
              <input
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-4 py-3 bg-[#1a1a2e] border border-mgx-border rounded-lg
                           text-white placeholder-gray-500
                           focus:outline-none focus:ring-2 focus:ring-mgx-accent focus:border-transparent
                           transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isSavingPassword}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-mgx-accent hover:bg-mgx-accent-hover
                         disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
            >
              {isSavingPassword ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Lock size={18} />
                  Update Password
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

