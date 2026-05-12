import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import UploadForm from '@/components/upload/UploadForm'

export const metadata = { title: 'Upload Model — 3D Gallery' }

export default async function UploadPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login?redirectTo=/upload')

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-white mb-1">Upload Model</h1>
      <p className="text-zinc-500 mb-8">
        A thumbnail and triangle count are extracted automatically.
      </p>
      <UploadForm userId={user.id} />
    </div>
  )
}
