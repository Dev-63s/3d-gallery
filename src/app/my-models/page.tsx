import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Upload, Lock, Globe } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import ModelCard from '@/components/gallery/ModelCard'
import type { Model } from '@/types'

export const metadata = { title: 'My Models — 3D Gallery' }

export default async function MyModelsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login?redirectTo=/my-models')

  const { data: models } = await supabase
    .from('models')
    .select('*, profiles(username, avatar_url)')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  const list = (models as Model[]) ?? []
  const publicCount  = list.filter(m => m.is_public).length
  const privateCount = list.filter(m => !m.is_public).length

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">My Models</h1>
          <p className="text-zinc-500 mt-1.5">
            {list.length === 0
              ? 'No models yet'
              : `${list.length} model${list.length !== 1 ? 's' : ''} — ${publicCount} public, ${privateCount} private`}
          </p>
        </div>
        <Link
          href="/upload"
          className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shrink-0"
        >
          <Upload className="h-4 w-4" />
          Upload
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="text-center py-32 space-y-4">
          <p className="text-zinc-500">You haven&apos;t uploaded any models yet.</p>
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <Upload className="h-4 w-4" />
            Upload your first model
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {list.map((model) => (
            <div key={model.id} className="relative">
              <ModelCard model={model} />
              {/* Visibility badge overlaid on top-left of thumbnail */}
              <div className="absolute top-2 left-2 pointer-events-none">
                {model.is_public ? (
                  <span className="inline-flex items-center gap-1 bg-black/60 backdrop-blur-sm text-brand-300 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded">
                    <Globe className="h-2.5 w-2.5" />
                    Public
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 bg-black/60 backdrop-blur-sm text-zinc-300 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded">
                    <Lock className="h-2.5 w-2.5" />
                    Private
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
