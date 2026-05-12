// CLIENT-SIDE ONLY — never import from a Server Component or API route.
// Uses browser APIs: document, HTMLCanvasElement, WebGL.

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { loadZipFromFile } from './zipLoader'

export interface ThumbnailResult {
  blob: Blob
  triangleCount: number
}

export async function generateThumbnail(file: File): Promise<ThumbnailResult> {
  const objectUrl = URL.createObjectURL(file)

  try {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 512

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
    renderer.setSize(512, 512)
    renderer.setPixelRatio(1)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.NeutralToneMapping
    renderer.toneMappingExposure = 1.4

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x2a2a2e)

    // IBL for MeshStandard (GLB) materials
    const pmrem = new THREE.PMREMGenerator(renderer)
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environmentIntensity = 0.8
    pmrem.dispose()

    // Strong lights so FBX (MeshPhong/Lambert) materials are fully visible
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444466, 2.5))
    const key = new THREE.DirectionalLight(0xffffff, 2.5)
    key.position.set(5, 8, 5)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0x88aaff, 0.6)
    fill.position.set(-4, 2, -4)
    scene.add(fill)

    const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 100_000)

    // Load model
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    let model: THREE.Group

    if (ext === 'zip') {
      const { manager, gltfUrl, cleanup } = await loadZipFromFile(file)
      try {
        const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
          new GLTFLoader(manager).load(gltfUrl, resolve as any, undefined, reject)
        })
        model = gltf.scene
      } finally {
        cleanup()
      }
    } else if (ext === 'fbx') {
      // LoadingManager waits for the FBX AND all its embedded/async textures before resolving
      model = await new Promise<THREE.Group>((resolve, reject) => {
        let fbxResult: THREE.Group | null = null
        let settled = false

        const finish = () => {
          if (!settled && fbxResult) { settled = true; resolve(fbxResult) }
        }

        const manager = new THREE.LoadingManager()
        manager.onLoad = finish
        // Ignore individual texture errors — just render with what loaded
        manager.onError = () => {}

        new FBXLoader(manager).load(objectUrl, (fbx) => {
          fbxResult = fbx
          // If manager has no pending items it won't fire onLoad, so resolve after a tick
          setTimeout(finish, 150)
        }, undefined, reject)

        // Hard timeout: proceed after 8 s regardless (handles external texture paths)
        setTimeout(finish, 8000)
      })

      // Fix FBX materials that still render black after texture load
      model.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return
        const mats = Array.isArray(child.material) ? child.material : [child.material]
        mats.forEach((m) => {
          const mat = m as THREE.MeshPhongMaterial
          // vertexColors=true but no color attribute → renders black
          if (mat.vertexColors && !child.geometry.attributes.color) {
            mat.vertexColors = false
          }
          // Near-black color with no texture (external texture failed) → warm neutral
          if (mat.color && !mat.map) {
            const { r, g, b } = mat.color
            if (r < 0.15 && g < 0.15 && b < 0.15) mat.color.set(0xccbbaa)
          }
          mat.needsUpdate = true
        })
      })
    } else {
      const loader = new GLTFLoader()
      const gltf = await new Promise<{ scene: THREE.Group }>((resolve, reject) => {
        loader.load(objectUrl, resolve as any, undefined, reject)
      })
      model = gltf.scene
    }

    scene.add(model)

    // Count triangles
    let triangleCount = 0
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const geo = (child as THREE.Mesh).geometry
        triangleCount += geo.index
          ? geo.index.count / 3
          : (geo.attributes.position?.count ?? 0) / 3
      }
    })

    // Center and fit camera
    const box = new THREE.Box3().setFromObject(model)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    model.position.sub(center)

    const maxDim = Math.max(size.x, size.y, size.z)
    if (maxDim > 0) {
      const fovRad = camera.fov * (Math.PI / 180)
      const dist = (maxDim / 2) / Math.tan(fovRad / 2) * 1.5
      camera.position.set(dist * 0.7, dist * 0.35, dist * 0.7)
      camera.near = dist / 1000
      camera.far = dist * 1000
      camera.updateProjectionMatrix()
    }
    camera.lookAt(0, 0, 0)

    renderer.render(scene, camera)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Canvas toBlob returned null'))),
        'image/jpeg',
        0.85
      )
    })

    renderer.dispose()

    return { blob, triangleCount: Math.round(triangleCount) }
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
