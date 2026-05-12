import GalleryGrid from '@/components/gallery/GalleryGrid'

export default function GalleryPage() {
  return (
    <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-10 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">3D Gallery</h1>
        <p className="text-zinc-500 mt-1.5">Explore and interact with community 3D models</p>
      </div>
      <GalleryGrid />
    </div>
  )
}
