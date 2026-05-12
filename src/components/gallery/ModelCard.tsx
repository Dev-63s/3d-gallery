import Link from 'next/link'
import Image from 'next/image'
import { Eye, HardDrive, Triangle, Box } from 'lucide-react'
import type { Model } from '@/types'
import { formatBytes, formatNumber, getThumbnailPublicUrl } from '@/lib/utils'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!

interface ModelCardProps {
  model: Model
}

export default function ModelCard({ model }: ModelCardProps) {
  const thumbnailUrl = getThumbnailPublicUrl(SUPABASE_URL, model.thumbnail_path)

  return (
    <Link
      href={`/model/${model.id}`}
      className="group block bg-zinc-900 rounded-xl overflow-hidden ring-1 ring-zinc-800 hover:ring-brand-500 transition-all duration-200"
    >
      {/* Thumbnail */}
      <div className="relative aspect-square bg-zinc-950 overflow-hidden">
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt={model.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Box className="h-16 w-16 text-zinc-700" />
          </div>
        )}
        {/* Format badge */}
        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-zinc-300 text-[10px] font-mono uppercase px-1.5 py-0.5 rounded">
          {model.original_format}
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="text-white font-medium text-sm truncate leading-snug">{model.name}</h3>
        {model.profiles?.username && (
          <p className="text-zinc-500 text-xs mt-0.5 truncate">by {model.profiles.username}</p>
        )}
        {model.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {model.tags.slice(0, 3).map(tag => (
              <span key={tag} className="bg-zinc-800 text-zinc-400 text-[10px] px-1.5 py-0.5 rounded-full">{tag}</span>
            ))}
            {model.tags.length > 3 && (
              <span className="text-zinc-600 text-[10px] py-0.5">+{model.tags.length - 3}</span>
            )}
          </div>
        )}
        <div className="flex items-center gap-3 mt-2.5 text-zinc-500 text-xs">
          <span className="flex items-center gap-1 shrink-0">
            <Eye className="h-3 w-3" />
            {formatNumber(model.view_count)}
          </span>
          <span className="flex items-center gap-1 shrink-0">
            <HardDrive className="h-3 w-3" />
            {formatBytes(model.file_size)}
          </span>
          {model.triangle_count > 0 && (
            <span className="flex items-center gap-1 shrink-0">
              <Triangle className="h-3 w-3" />
              {formatNumber(model.triangle_count)}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
