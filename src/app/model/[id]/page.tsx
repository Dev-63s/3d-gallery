import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import ViewerScene from '@/components/viewer/ViewerScene'
import type { Model } from '@/types'

interface PageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('models')
    .select('name, description')
    .eq('id', params.id)
    .single()

  return {
    title: data ? `${data.name} — 3D Gallery` : '3D Gallery',
    description: data?.description ?? undefined,
  }
}

export default async function ModelPage({ params }: PageProps) {
  const supabase = await createClient()

  const { data: model, error } = await supabase
    .from('models')
    .select('*, profiles(username, avatar_url)')
    .eq('id', params.id)
    .single()

  if (error || !model) notFound()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isOwner = user?.id === model.owner_id

  return <ViewerScene model={model as Model} isOwner={isOwner} />
}
