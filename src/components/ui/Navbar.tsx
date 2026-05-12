'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Box, Upload, LogOut, LogIn, UserPlus, Library } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'

export default function Navbar() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <nav className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link
            href="/"
            className="flex items-center gap-2 text-white font-bold text-lg hover:text-brand-400 transition-colors"
          >
            <Box className="h-6 w-6 text-brand-500" />
            3D Gallery
          </Link>

          {!loading && (
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <Link
                    href="/my-models"
                    className="flex items-center gap-1.5 text-[#8F847E] hover:text-white text-sm transition-colors"
                  >
                    <Library className="h-4 w-4" />
                    My Models
                  </Link>
                  <Link
                    href="/upload"
                    className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Upload className="h-4 w-4" />
                    Upload
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 text-[#8F847E] hover:text-white text-sm transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/auth/login"
                    className="flex items-center gap-1.5 text-zinc-400 hover:text-white text-sm transition-colors"
                  >
                    <LogIn className="h-4 w-4" />
                    Login
                  </Link>
                  <Link
                    href="/auth/register"
                    className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    <UserPlus className="h-4 w-4" />
                    Register
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
