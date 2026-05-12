// CLIENT-SIDE ONLY — uses browser APIs (fetch, URL.createObjectURL).

import JSZip from 'jszip'
import * as THREE from 'three'

export interface ZipGltfResult {
  manager: THREE.LoadingManager
  gltfUrl: string
  cleanup: () => void
}

async function buildZipResult(zip: JSZip): Promise<ZipGltfResult> {
  const gltfEntry = Object.values(zip.files).find(
    f => !f.dir && f.name.toLowerCase().endsWith('.gltf')
  )
  if (!gltfEntry) throw new Error('No .gltf file found inside zip.')

  const urlMap = new Map<string, string>()
  await Promise.all(
    Object.values(zip.files)
      .filter(f => !f.dir)
      .map(async f => {
        const blob = await f.async('blob')
        const blobUrl = URL.createObjectURL(blob)
        urlMap.set(f.name, blobUrl)
        const basename = f.name.split('/').pop()!
        if (!urlMap.has(basename)) urlMap.set(basename, blobUrl)
      })
  )

  const gltfUrl = urlMap.get(gltfEntry.name)!

  const manager = new THREE.LoadingManager()
  manager.setURLModifier(href => {
    if (href.startsWith('blob:') || href.startsWith('data:')) return href
    const basename = href.split('/').pop()!
    return urlMap.get(href) ?? urlMap.get(basename) ?? href
  })

  const cleanup = () => urlMap.forEach(u => URL.revokeObjectURL(u))

  return { manager, gltfUrl, cleanup }
}

/** Load a zip from a remote URL (used in the viewer). */
export async function loadZipFromUrl(url: string): Promise<ZipGltfResult> {
  const res = await fetch(url)
  const buf = await res.arrayBuffer()
  const zip = await JSZip.loadAsync(buf)
  return buildZipResult(zip)
}

/** Load a zip from a File object (used in upload/thumbnail). */
export async function loadZipFromFile(file: File): Promise<ZipGltfResult> {
  const buf = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(buf)
  return buildZipResult(zip)
}

/** Validate that a zip File contains exactly one .gltf entry. */
export async function validateZipHasGltf(file: File): Promise<void> {
  const buf = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(buf)
  const gltfFiles = Object.values(zip.files).filter(
    f => !f.dir && f.name.toLowerCase().endsWith('.gltf')
  )
  if (gltfFiles.length === 0) throw new Error('Zip must contain a .gltf file.')
  if (gltfFiles.length > 1) throw new Error('Zip contains multiple .gltf files — include only one.')
}
