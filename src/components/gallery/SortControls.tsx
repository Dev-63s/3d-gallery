'use client'

import type { SortOption } from '@/types'

interface SortControlsProps {
  sort: SortOption
  onChange: (sort: SortOption) => void
  total: number
}

const OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'most_viewed', label: 'Most Viewed' },
]

export default function SortControls({ sort, onChange, total }: SortControlsProps) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-zinc-500 text-sm">{total} model{total !== 1 ? 's' : ''}</p>
      <div className="flex items-center gap-1.5">
        <span className="text-zinc-500 text-sm mr-1">Sort:</span>
        {OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onChange(value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              sort === value
                ? 'bg-brand-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
