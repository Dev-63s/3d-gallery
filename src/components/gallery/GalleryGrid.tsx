'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Upload, Search, X } from 'lucide-react'
import { useModels } from '@/hooks/useModels'
import { useAuth } from '@/hooks/useAuth'
import ModelCard from './ModelCard'
import SortControls from './SortControls'
import Spinner from '@/components/ui/Spinner'
import type { SortOption } from '@/types'

export default function GalleryGrid() {
  const [sort, setSort] = useState<SortOption>('newest')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [activeTags, setActiveTags] = useState<string[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { models, loading, error } = useModels(sort, search, activeTags)
  const { user } = useAuth()

  // Debounce search 300 ms
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setSearch(searchInput), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchInput])

  // Collect unique tags from loaded models for the filter row
  const allTags = Array.from(new Set(models.flatMap(m => m.tags ?? []))).sort()

  const toggleTag = (tag: string) =>
    setActiveTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])

  const hasFilters = !!searchInput || activeTags.length > 0
  const clearFilters = () => { setSearchInput(''); setSearch(''); setActiveTags([]) }

  return (
    <div>
      {/* Search bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
        <input
          type="text"
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          placeholder="Search by name or description…"
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-10 py-2.5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
        />
        {searchInput && (
          <button onClick={() => setSearchInput('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Tag filter chips — only shown once models with tags are loaded */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                activeTags.includes(tag)
                  ? 'bg-brand-500 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Sort row */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <SortControls sort={sort} onChange={setSort} total={models.length} />
        {hasFilters && (
          <button onClick={clearFilters} className="text-xs text-zinc-500 hover:text-white flex items-center gap-1 shrink-0">
            <X className="h-3 w-3" /> Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-32">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <div className="text-center py-32 text-red-400 text-sm">{error}</div>
      ) : models.length === 0 ? (
        <div className="text-center py-32 space-y-4">
          <p className="text-zinc-500">{hasFilters ? 'No models match your search.' : 'No models yet.'}</p>
          {!hasFilters && (user ? (
            <Link href="/upload" className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors">
              <Upload className="h-4 w-4" />
              Upload the first model
            </Link>
          ) : (
            <Link href="/auth/register" className="text-brand-400 hover:text-brand-300 text-sm">
              Sign up to upload
            </Link>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {models.map((model) => (
            <ModelCard key={model.id} model={model} />
          ))}
        </div>
      )}
    </div>
  )
}
