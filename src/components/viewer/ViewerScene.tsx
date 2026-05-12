'use client'

import dynamic from 'next/dynamic'
import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  Eye, HardDrive, Triangle, Circle, Calendar, User,
  Trash2, AlertTriangle, Globe, Lock,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatBytes, formatNumber, formatDate } from '@/lib/utils'
import type { Model } from '@/types'
import type { ModelViewerRef, ViewerSettings } from './ModelViewer'
import ViewerControls from './ViewerControls'
import StatsOverlay from './StatsOverlay'
import Spinner from '@/components/ui/Spinner'

// Dynamic import prevents Three.js from being server-rendered
const ModelViewer = dynamic(() => import('./ModelViewer'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-zinc-950">
      <Spinner size="lg" />
    </div>
  ),
})

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

interface ViewerSceneProps {
  model: Model
  isOwner: boolean
}

export default function ViewerScene({ model, isOwner }: ViewerSceneProps) {
  const router = useRouter()
  const viewerRef = useRef<ModelViewerRef | null>(null)
  const viewIncrementedRef = useRef(false)
  const [settings, setSettings] = useState<ViewerSettings>({
    wireframe: false,
    autoRotate: false,
    environment: 'studio',
    doubleSided: false,
    lightAngle: 45,
    lightIntensity: 1.0,
    animationIndex: -1,
    animationSpeed: 1.0,
  })
  const [animationNames, setAnimationNames] = useState<string[]>([])
  const [viewCount, setViewCount] = useState(model.view_count)
  const [isPublic, setIsPublic] = useState(model.is_public)
  const [togglingVisibility, setTogglingVisibility] = useState(false)
  const [tags, setTags] = useState<string[]>(model.tags ?? [])
  const [editingTags, setEditingTags] = useState(false)
  const [tagDraft, setTagDraft] = useState('')
  const [savingTags, setSavingTags] = useState(false)
  const [loadedTriangleCount, setLoadedTriangleCount] = useState(0)
  const [loadedVertexCount, setLoadedVertexCount] = useState(0)
  const [cameraAzimuth, setCameraAzimuth] = useState(0)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const modelUrl = `${SUPABASE_URL}/storage/v1/object/public/models/${model.file_path}`

  // Poll camera azimuth for compass indicator
  useEffect(() => {
    const id = setInterval(() => {
      const v = viewerRef.current
      if (!v) return
      setCameraAzimuth(v.getAzimuth())
    }, 50)
    return () => clearInterval(id)
  }, [])

  // Increment view count once per visit, skip for the model owner
  useEffect(() => {
    if (isOwner || viewIncrementedRef.current) return
    viewIncrementedRef.current = true
    const supabase = createClient()
    supabase.rpc('increment_view_count', { model_id: model.id })
      .then(() => setViewCount(c => c + 1))
  }, [model.id, isOwner])

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setDeleting(true)
    try {
      const supabase = createClient()
      await supabase.storage.from('models').remove([model.file_path])
      if (model.thumbnail_path) {
        await supabase.storage.from('thumbnails').remove([model.thumbnail_path])
      }
      await supabase.from('models').delete().eq('id', model.id)
      router.push('/')
      router.refresh()
    } catch {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const openTagEditor = () => {
    setTagDraft(tags.join(', '))
    setEditingTags(true)
  }

  const cancelTagEdit = () => setEditingTags(false)

  const handleSaveTags = async () => {
    const next = tagDraft
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0)
      .filter((t, i, a) => a.indexOf(t) === i) // dedupe
      .slice(0, 10)
    setSavingTags(true)
    const supabase = createClient()
    const { error } = await supabase.from('models').update({ tags: next }).eq('id', model.id)
    if (!error) { setTags(next); setEditingTags(false) }
    setSavingTags(false)
  }

  const handleToggleVisibility = async () => {
    setTogglingVisibility(true)
    const next = !isPublic
    const supabase = createClient()
    const { error } = await supabase
      .from('models')
      .update({ is_public: next })
      .eq('id', model.id)
    if (!error) setIsPublic(next)
    setTogglingVisibility(false)
  }

  return (
    <div className="flex flex-col lg:flex-row" style={{ height: 'calc(100vh - 64px)' }}>
      {/* ── Three.js canvas ──────────────────────────────────── */}
      <div className="relative flex-1 min-h-0 min-w-0">
        <ModelViewer
          modelUrl={modelUrl}
          settings={settings}
          onLoad={(tri, vtx) => { setLoadedTriangleCount(tri); setLoadedVertexCount(vtx) }}
          onAnimationsLoaded={(names) => {
            setAnimationNames(names)
            if (names.length > 0) setSettings(s => ({ ...s, animationIndex: 0 }))
          }}
          onRef={(api) => { viewerRef.current = api }}
        />

        {/* Floating overlay panels (top-right) */}
        <div className="absolute top-4 right-4 flex flex-col gap-3 z-10 pointer-events-auto">
          <ViewerControls settings={settings} onChange={setSettings} cameraAzimuth={cameraAzimuth} animationNames={animationNames} />
          <StatsOverlay
            viewerRef={viewerRef}
            storedTriangleCount={model.triangle_count}
          />
        </div>
      </div>

      {/* ── Sidebar ───────────────────────────────────────────── */}
      <aside className="w-full lg:w-80 shrink-0 bg-zinc-900 border-t border-zinc-800 lg:border-t-0 lg:border-l overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Title + author */}
          <div>
            <div className="flex items-start gap-2">
              <h1 className="text-xl font-bold text-white leading-snug">{model.name}</h1>
              {!isPublic && (
                <span className="inline-flex items-center gap-1 bg-zinc-800 text-zinc-400 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded mt-1 shrink-0">
                  <Lock className="h-2.5 w-2.5" />
                  Private
                </span>
              )}
            </div>
            {model.profiles?.username && (
              <p className="flex items-center gap-1.5 text-zinc-400 text-sm mt-1.5">
                <User className="h-3.5 w-3.5" />
                {model.profiles.username}
              </p>
            )}
          </div>

          {/* Description */}
          {model.description && (
            <p className="text-zinc-400 text-sm leading-relaxed">{model.description}</p>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <StatCard icon={<Eye className="h-3.5 w-3.5" />} label="Views">
              {formatNumber(viewCount)}
            </StatCard>
            <StatCard icon={<HardDrive className="h-3.5 w-3.5" />} label="Size">
              {formatBytes(model.file_size)}
            </StatCard>
            <StatCard icon={<Triangle className="h-3.5 w-3.5" />} label="Triangles">
              {formatNumber(loadedTriangleCount > 0 ? loadedTriangleCount : model.triangle_count)}
            </StatCard>
            <StatCard icon={<Circle className="h-3.5 w-3.5" />} label="Vertices">
              {loadedVertexCount > 0 ? formatNumber(loadedVertexCount) : '—'}
            </StatCard>
            <StatCard icon={<Calendar className="h-3.5 w-3.5" />} label="Uploaded">
              <span className="text-xs">{formatDate(model.created_at)}</span>
            </StatCard>
          </div>

          {/* Format badge + tags */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-block bg-zinc-800 text-zinc-400 text-[11px] font-mono uppercase px-2 py-1 rounded">
              {model.original_format}
            </span>
            {tags.map(tag => (
              <span key={tag} className="bg-zinc-800 text-zinc-400 text-[11px] px-2 py-1 rounded">
                {tag}
              </span>
            ))}
          </div>

          {/* Owner actions */}
          {isOwner && (
            <div className="pt-4 border-t border-zinc-800 space-y-2">
              <p className="text-zinc-600 text-[10px] uppercase tracking-widest font-semibold">
                Owner actions
              </p>

              {/* Tags editor */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-zinc-500 text-xs">Tags</p>
                  {!editingTags && (
                    <button
                      onClick={openTagEditor}
                      className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
                    >
                      Edit
                    </button>
                  )}
                </div>

                {editingTags ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={tagDraft}
                      onChange={e => setTagDraft(e.target.value)}
                      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                        if (e.key === 'Enter') handleSaveTags()
                        if (e.key === 'Escape') cancelTagEdit()
                      }}
                      placeholder="e.g. character, sci-fi, rigged"
                      autoFocus
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-white text-xs placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <p className="text-zinc-600 text-[10px]">Separate tags with commas · max 10</p>
                    <div className="flex gap-2">
                      <button
                        onClick={cancelTagEdit}
                        className="flex-1 py-1.5 rounded-lg text-xs bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveTags}
                        disabled={savingTags}
                        className="flex-1 py-1.5 rounded-lg text-xs bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50 transition-colors"
                      >
                        {savingTags ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1 min-h-[24px]">
                    {tags.length > 0 ? tags.map(tag => (
                      <span key={tag} className="bg-zinc-800 text-zinc-400 text-[10px] px-2 py-0.5 rounded-full">
                        {tag}
                      </span>
                    )) : (
                      <span className="text-zinc-600 text-xs">No tags yet</span>
                    )}
                  </div>
                )}
              </div>

              {/* Visibility toggle */}
              <button
                onClick={handleToggleVisibility}
                disabled={togglingVisibility}
                className="w-full flex items-center justify-between bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-sm py-2.5 px-3 rounded-lg transition-colors disabled:opacity-50"
              >
                <span className="flex items-center gap-2 text-zinc-300">
                  {isPublic
                    ? <Globe className="h-3.5 w-3.5 text-brand-400" />
                    : <Lock className="h-3.5 w-3.5 text-zinc-400" />
                  }
                  {isPublic ? 'Public' : 'Private'}
                </span>
                <span className="text-zinc-500 text-xs">
                  {togglingVisibility ? 'Saving…' : 'Click to change'}
                </span>
              </button>

              {confirmDelete ? (
                <div className="space-y-2">
                  <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-xs">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    This will permanently delete the model and its thumbnail. Are you sure?
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmDelete(false)}
                      className="flex-1 py-2 rounded-lg text-sm bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex-1 py-2 rounded-lg text-sm bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                    >
                      {deleting ? <Spinner size="sm" /> : <Trash2 className="h-3.5 w-3.5" />}
                      {deleting ? 'Deleting…' : 'Confirm Delete'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleDelete}
                  className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm py-2 rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Model
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}

function StatCard({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-zinc-800 rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-zinc-500 text-[11px] mb-1">
        {icon}
        {label}
      </div>
      <p className="text-white font-semibold text-sm">{children}</p>
    </div>
  )
}
