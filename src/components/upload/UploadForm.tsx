'use client'

import { useState, useRef, useCallback, KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileBox, CheckCircle, AlertCircle, Globe, Lock, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { generateThumbnail } from '@/lib/three/thumbnail'
import { validateZipHasGltf } from '@/lib/three/zipLoader'
import { formatBytes } from '@/lib/utils'
import Spinner from '@/components/ui/Spinner'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB (Supabase free tier limit)
const ALLOWED_EXT = ['glb', 'gltf', 'fbx', 'zip']

type Status = 'idle' | 'processing' | 'uploading' | 'success' | 'error'

interface UploadFormProps {
  userId: string
}

export default function UploadForm({ userId }: UploadFormProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState('')
  const [error, setError] = useState<string | null>(null)

  const validateAndSetFile = useCallback(
    async (selected: File) => {
      const ext = selected.name.split('.').pop()?.toLowerCase() ?? ''
      if (!ALLOWED_EXT.includes(ext)) {
        setError('Only .glb, .gltf, .fbx, and .zip (GLTF) files are supported.')
        return
      }
      if (selected.size > MAX_FILE_SIZE) {
        setError(`File exceeds 50 MB limit (${formatBytes(selected.size)}).`)
        return
      }
      if (ext === 'zip') {
        try {
          await validateZipHasGltf(selected)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Invalid zip file.')
          return
        }
      }
      setError(null)
      setFile(selected)
      if (!name) setName(selected.name.replace(/\.(glb|gltf|fbx|zip)$/i, ''))
    },
    [name]
  )

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) validateAndSetFile(f)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) validateAndSetFile(f)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !name.trim()) return

    setError(null)
    setStatus('processing')
    setProgress(10)
    setProgressLabel('Processing 3D model…')

    try {
      const supabase = createClient()

      // ── Step 1: generate thumbnail + triangle count ──────────
      let thumbnailBlob: Blob | null = null
      let triangleCount = 0
      try {
        const result = await generateThumbnail(file)
        thumbnailBlob = result.blob
        triangleCount = result.triangleCount
      } catch (err) {
        console.warn('Thumbnail generation failed, continuing without it:', err)
      }

      setProgress(35)
      setStatus('uploading')
      setProgressLabel('Uploading model file…')

      // ── Step 2: upload model to Storage ─────────────────────
      const uuid = crypto.randomUUID()
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'glb'
      const modelPath = `${userId}/${uuid}.${ext}`
      const thumbnailPath = `${userId}/${uuid}.jpg`

      const { error: modelErr } = await supabase.storage
        .from('models')
        .upload(modelPath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType:
            ext === 'fbx' ? 'application/octet-stream' :
            ext === 'glb' ? 'model/gltf-binary' : 'model/gltf+json',
        })
      if (modelErr) throw modelErr

      setProgress(65)
      setProgressLabel('Uploading thumbnail…')

      // ── Step 3: upload thumbnail ─────────────────────────────
      let uploadedThumbnailPath: string | null = null
      if (thumbnailBlob) {
        const { error: thumbErr } = await supabase.storage
          .from('thumbnails')
          .upload(thumbnailPath, thumbnailBlob, {
            cacheControl: '3600',
            upsert: false,
            contentType: 'image/jpeg',
          })
        if (!thumbErr) uploadedThumbnailPath = thumbnailPath
      }

      setProgress(82)
      setProgressLabel('Saving model record…')

      // ── Step 4: insert DB record ─────────────────────────────
      const { data: model, error: dbErr } = await supabase
        .from('models')
        .insert({
          owner_id: userId,
          name: name.trim(),
          description: description.trim() || null,
          file_path: modelPath,
          file_size: file.size,
          original_format: ext as 'glb' | 'gltf' | 'fbx' | 'zip',
          triangle_count: triangleCount,
          thumbnail_path: uploadedThumbnailPath,
          tags,
          is_public: isPublic,
        })
        .select('id')
        .single()
      if (dbErr) throw dbErr

      setProgress(100)
      setStatus('success')
      setTimeout(() => router.push(`/model/${model.id}`), 800)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed. Please try again.'
      setError(msg)
      setStatus('error')
      setProgress(0)
    }
  }

  const busy = status === 'processing' || status === 'uploading'

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => !busy && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
          file
            ? 'border-brand-500 bg-brand-500/5'
            : 'border-zinc-700 hover:border-zinc-500 bg-zinc-800/40'
        } ${busy ? 'cursor-default pointer-events-none' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".glb,.gltf,.fbx,.zip"
          onChange={handleFileChange}
          className="hidden"
        />
        {file ? (
          <div className="flex flex-col items-center gap-2">
            <FileBox className="h-12 w-12 text-brand-400" />
            <p className="text-white font-medium">{file.name}</p>
            <p className="text-zinc-400 text-sm">{formatBytes(file.size)}</p>
            {!busy && <p className="text-zinc-600 text-xs">Click to replace</p>}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Upload className="h-12 w-12 text-zinc-600" />
            <p className="text-white font-medium">Drop your 3D model here</p>
            <p className="text-zinc-400 text-sm">or click to browse</p>
            <p className="text-zinc-600 text-xs mt-1">GLB · GLTF · FBX · ZIP (animated GLTF) · Max 50 MB</p>
          </div>
        )}
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1.5">
          Model name <span className="text-red-400">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My awesome model"
          required
          disabled={busy}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1.5">
          Description <span className="text-zinc-600">(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A brief description of your model…"
          rows={3}
          disabled={busy}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none disabled:opacity-50"
        />
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-1.5">
          Tags <span className="text-zinc-600">(optional)</span>
        </label>
        <div className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-brand-500">
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {tags.map(tag => (
              <span key={tag} className="inline-flex items-center gap-1 bg-zinc-700 text-zinc-200 text-xs px-2 py-0.5 rounded-full">
                {tag}
                <button type="button" onClick={() => setTags(t => t.filter(x => x !== tag))} disabled={busy} className="text-zinc-400 hover:text-white">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
          <input
            type="text"
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                const t = tagInput.trim().toLowerCase().replace(/,/g, '')
                if (t && !tags.includes(t) && tags.length < 10) setTags(prev => [...prev, t])
                setTagInput('')
              } else if (e.key === 'Backspace' && !tagInput) {
                setTags(t => t.slice(0, -1))
              }
            }}
            placeholder={tags.length === 0 ? 'Type a tag and press Enter…' : ''}
            disabled={busy}
            className="bg-transparent text-white text-sm placeholder-zinc-500 outline-none w-full"
          />
        </div>
        <p className="text-zinc-600 text-xs mt-1">Press Enter or comma to add · max 10 tags</p>
      </div>

      {/* Visibility */}
      <div className="flex items-center justify-between bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3">
        <div className="flex items-center gap-3">
          {isPublic
            ? <Globe className="h-4 w-4 text-brand-400 shrink-0" />
            : <Lock className="h-4 w-4 text-zinc-400 shrink-0" />
          }
          <div>
            <p className="text-sm font-medium text-zinc-200">
              {isPublic ? 'Public' : 'Private'}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {isPublic
                ? 'Visible to everyone in the gallery'
                : 'Only visible to you via direct link'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsPublic(v => !v)}
          disabled={busy}
          className={`relative w-9 h-5 rounded-full transition-colors shrink-0 disabled:opacity-50 ${
            isPublic ? 'bg-brand-500' : 'bg-zinc-700'
          }`}
          aria-pressed={isPublic}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
              isPublic ? 'translate-x-4' : ''
            }`}
          />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Progress bar */}
      {busy && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400 flex items-center gap-2">
              <Spinner size="sm" />
              {progressLabel}
            </span>
            <span className="text-zinc-500 tabular-nums">{progress}%</span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Success */}
      {status === 'success' && (
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-green-400 text-sm">
          <CheckCircle className="h-4 w-4 shrink-0" />
          Upload successful! Redirecting to viewer…
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={!file || !name.trim() || busy || status === 'success'}
        className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors"
      >
        {busy ? 'Uploading…' : 'Upload Model'}
      </button>
    </form>
  )
}
