'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Model, SortOption } from '@/types'

export function useModels(sort: SortOption = 'newest', search = '', activeTags: string[] = []) {
  const [models, setModels] = useState<Model[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchModels = useCallback(async () => {
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const orderColumn = sort === 'newest' ? 'created_at' : 'view_count'

    let query = supabase
      .from('models')
      .select('*, profiles(username, avatar_url)')
      .eq('is_public', true)
      .order(orderColumn, { ascending: false })
      .limit(60)

    if (search.trim()) {
      query = query.or(`name.ilike.%${search.trim()}%,description.ilike.%${search.trim()}%`)
    }
    if (activeTags.length > 0) {
      query = query.contains('tags', activeTags)
    }

    const { data, error } = await query

    if (error) {
      setError(error.message)
    } else {
      setModels((data as Model[]) ?? [])
    }
    setLoading(false)
  }, [sort, search, activeTags])

  useEffect(() => {
    fetchModels()
  }, [fetchModels])

  return { models, loading, error, refetch: fetchModels }
}
