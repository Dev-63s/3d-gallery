'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { loadZipFromUrl } from '@/lib/three/zipLoader'
import Spinner from '@/components/ui/Spinner'

// ── Public settings contract ──────────────────────────────────

export interface ViewerSettings {
  wireframe: boolean
  autoRotate: boolean
  environment: 'studio' | 'outdoor' | 'dark'
  doubleSided: boolean
  lightAngle: number      // 0–360 deg: 0=left, 90=front, 180=right, 270=back
  lightIntensity: number  // multiplier 0–2, default 1.0
  animationIndex: number  // -1 = paused/none, ≥0 = clip index
  animationSpeed: number  // 0.25–2.0
}

// ── API exposed to parent via onRef callback ──────────────────

export interface ModelViewerRef {
  captureScreenshot: () => string | null
  getTriangleCount: () => number
  getVertexCount: () => number
  getDrawCalls: () => number
  getFPS: () => number
  getAzimuth: () => number  // radians, relative to initial camera position after model load
  getAnimationNames: () => string[]
}

// ── Environment presets ───────────────────────────────────────

// IBL (RoomEnvironment) handles the soft ambient fill.
// ambient = AmbientLight fill for unlit/FBX materials; dir = key shadow caster only.
const ENV_PRESETS = {
  studio:  { bg: 0x2a2a2e, hemi: 2.2, dir: 2.0, ibl: 0.8 },
  outdoor: { bg: 0x87ceeb, hemi: 2.8, dir: 2.8, ibl: 0.8 },
  dark:    { bg: 0x080810, hemi: 0.8, dir: 1.2, ibl: 0.3 },
} as const

interface ModelViewerProps {
  modelUrl: string
  settings: ViewerSettings
  onLoad?: (triangleCount: number, vertexCount: number) => void
  onAnimationsLoaded?: (names: string[]) => void
  onError?: (message: string) => void
  onRef?: (api: ModelViewerRef | null) => void
}

export default function ModelViewer({
  modelUrl, settings, onLoad, onAnimationsLoaded, onError, onRef,
}: ModelViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef  = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef     = useRef<THREE.Scene | null>(null)
  const cameraRef    = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef  = useRef<OrbitControls | null>(null)
  const modelRef     = useRef<THREE.Object3D | null>(null)
  const settingsRef  = useRef(settings)
  const keyLightRef      = useRef<THREE.DirectionalLight | null>(null)
  const hemiLightRef     = useRef<THREE.HemisphereLight | null>(null)
  const azimuthOffsetRef = useRef<number>(0)
  const rafRef           = useRef<number>(0)
  const fpsRef       = useRef<number>(0)
  const trianglesRef = useRef<number>(0)
  const drawCallsRef = useRef<number>(0)
  const verticesRef  = useRef<number>(0)
  const mixerRef          = useRef<THREE.AnimationMixer | null>(null)
  const animationClipsRef = useRef<THREE.AnimationClip[]>([])
  const currentActionRef  = useRef<THREE.AnimationAction | null>(null)
  const clockRef          = useRef(new THREE.Clock())
  const [loading, setLoading]     = useState(true)
  const [loadPct, setLoadPct]     = useState(0)
  const [loadError, setLoadError] = useState<string | null>(null)

  // ── Publish API to parent via onRef (avoids forwardRef + dynamic() issues) ──

  settingsRef.current = settings

  const onRefRef = useRef(onRef)
  onRefRef.current = onRef

  useEffect(() => {
    const api: ModelViewerRef = {
      captureScreenshot() {
        const r = rendererRef.current
        const s = sceneRef.current
        const c = cameraRef.current
        if (!r || !s || !c) return null
        r.render(s, c)
        return r.domElement.toDataURL('image/jpeg', 0.85)
      },
      getTriangleCount() { return trianglesRef.current },
      getVertexCount()   { return verticesRef.current },
      getDrawCalls()     { return drawCallsRef.current },
      getFPS()           { return Math.round(fpsRef.current) },
      getAzimuth()          { return (controlsRef.current?.getAzimuthalAngle() ?? 0) - azimuthOffsetRef.current },
      getAnimationNames()   { return animationClipsRef.current.map(c => c.name) },
    }
    onRefRef.current?.(api)
    return () => { onRefRef.current?.(null) }
  }, []) // register once; refs always read latest values

  // ── React to settings changes (no re-mount needed) ────────

  // Wireframe
  useEffect(() => {
    modelRef.current?.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      const mats = Array.isArray(child.material) ? child.material : [child.material]
      mats.forEach((m) => { m.wireframe = settings.wireframe })
    })
  }, [settings.wireframe])

  // Auto-rotate
  useEffect(() => {
    if (controlsRef.current) controlsRef.current.autoRotate = settings.autoRotate
  }, [settings.autoRotate])

  // Double-sided
  useEffect(() => {
    modelRef.current?.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      const mats = Array.isArray(child.material) ? child.material : [child.material]
      mats.forEach((m) => { m.side = settings.doubleSided ? THREE.DoubleSide : THREE.FrontSide })
    })
  }, [settings.doubleSided])

  // Light angle — rotates key light around Y axis in the XZ plane
  useEffect(() => {
    const kl = keyLightRef.current
    if (!kl) return
    const rad    = (settings.lightAngle / 180) * Math.PI
    const length = kl.position.length() || Math.sqrt(50)
    kl.position.set(-length * Math.cos(rad), kl.position.y, length * Math.sin(rad))
    kl.shadow.camera.updateProjectionMatrix()
  }, [settings.lightAngle])

  // Light intensity multiplier
  useEffect(() => {
    if (!keyLightRef.current) return
    const { dir } = ENV_PRESETS[settings.environment]
    keyLightRef.current.intensity = dir * settings.lightIntensity
  }, [settings.lightIntensity, settings.environment])

  // Animation clip selection
  useEffect(() => {
    const mixer = mixerRef.current
    if (!mixer) return
    currentActionRef.current?.stop()
    currentActionRef.current = null
    if (settings.animationIndex < 0) return
    const clip = animationClipsRef.current[settings.animationIndex]
    if (!clip) return
    const action = mixer.clipAction(clip)
    action.setEffectiveTimeScale(settings.animationSpeed)
    action.play()
    currentActionRef.current = action
  }, [settings.animationIndex]) // eslint-disable-line react-hooks/exhaustive-deps

  // Animation speed
  useEffect(() => {
    currentActionRef.current?.setEffectiveTimeScale(settings.animationSpeed)
  }, [settings.animationSpeed])

  // Environment preset
  useEffect(() => {
    if (!sceneRef.current) return
    const { bg, hemi, dir, ibl } = ENV_PRESETS[settings.environment]
    sceneRef.current.background = new THREE.Color(bg)
    sceneRef.current.environmentIntensity = ibl
    if (hemiLightRef.current) hemiLightRef.current.intensity = hemi
    if (keyLightRef.current) keyLightRef.current.intensity = dir * settings.lightIntensity
  }, [settings.environment]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Full scene initialization ─────────────────────────────

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // ── Renderer ──
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
    })
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.NeutralToneMapping
    renderer.toneMappingExposure = 1.2
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // ── IBL (image-based lighting) — soft even fill from all directions ──
    const pmrem = new THREE.PMREMGenerator(renderer)
    const iblTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    pmrem.dispose()

    // ── Scene ──
    const { bg, hemi: hemiInt, dir: dirInt, ibl: iblInt } = ENV_PRESETS[settings.environment]
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(bg)
    scene.environment = iblTexture
    scene.environmentIntensity = iblInt
    sceneRef.current = scene

    // ── Camera ──
    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.01, 10_000)
    camera.position.set(3, 2, 3)
    cameraRef.current = camera

    // ── Lights ──
    // HemisphereLight: sky light from above + ground bounce — keeps all faces visible at any rotation
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444466, hemiInt)
    scene.add(hemiLight)
    hemiLightRef.current = hemiLight

    // Key light: shadow caster only — IBL handles diffuse fill
    const keyLight = new THREE.DirectionalLight(0xffffff, dirInt)
    keyLight.name = 'key'
    keyLight.position.set(5, 8, 5)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.set(2048, 2048)
    keyLight.shadow.camera.near = 0.1
    keyLight.shadow.camera.far = 10_000
    scene.add(keyLight)
    keyLightRef.current = keyLight

    // ── Grid ──
    const grid = new THREE.GridHelper(10, 20, 0x333333, 0x1f1f1f)
    scene.add(grid)

    // ── Controls ──
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.05
    controls.autoRotate = settings.autoRotate
    controls.autoRotateSpeed = 1.5
    controls.minDistance = 0.05
    controls.maxDistance = 5_000
    controlsRef.current = controls

    // ── Load Model ──
    const onModelLoaded = (model: THREE.Group, animations: THREE.AnimationClip[] = []) => {
      let triCount = 0
      const uniquePositions = new Set<string>()
      model.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return
        const geo = child.geometry
        triCount += geo.index
          ? geo.index.count / 3
          : (geo.attributes.position?.count ?? 0) / 3
        const pos = geo.attributes.position
        if (pos) {
          const arr = pos.array as Float32Array
          for (let i = 0; i < arr.length; i += 3) {
            uniquePositions.add(
              `${(arr[i] * 1e3) | 0},${(arr[i + 1] * 1e3) | 0},${(arr[i + 2] * 1e3) | 0}`
            )
          }
        }
        child.castShadow = true
        child.receiveShadow = true
        // Apply current doubleSided setting immediately on load
        const side = settingsRef.current.doubleSided ? THREE.DoubleSide : THREE.FrontSide
        const mats = Array.isArray(child.material) ? child.material : [child.material]
        mats.forEach((m) => { m.side = side })
      })
      verticesRef.current = uniquePositions.size

      const box    = new THREE.Box3().setFromObject(model)
      const center = box.getCenter(new THREE.Vector3())
      const size   = box.getSize(new THREE.Vector3())
      model.position.sub(center)
      grid.position.y = -size.y / 2

      const maxDim = Math.max(size.x, size.y, size.z) || 1
      const fovRad = camera.fov * (Math.PI / 180)
      const dist   = (maxDim / 2) / Math.tan(fovRad / 2) * 1.5
      camera.position.set(dist * 0.7, dist * 0.35, dist * 0.7)
      camera.near   = dist / 1000
      camera.far    = dist * 1000
      camera.updateProjectionMatrix()
      controls.maxDistance = dist * 10
      controls.target.set(0, 0, 0)
      controls.update()
      azimuthOffsetRef.current = controls.getAzimuthalAngle()

      // Fit shadow camera frustum to the model so shadows don't clip when rotating the light
      const shadowPad = maxDim * 1.2
      const kl = keyLightRef.current
      if (kl) {
        kl.shadow.camera.left   = -shadowPad
        kl.shadow.camera.right  =  shadowPad
        kl.shadow.camera.top    =  shadowPad
        kl.shadow.camera.bottom = -shadowPad
        kl.shadow.camera.near   =  dist * 0.01
        kl.shadow.camera.far    =  dist * 4
        kl.position.setLength(dist * 1.5)
        kl.shadow.camera.updateProjectionMatrix()
      }

      scene.add(model)
      modelRef.current = model

      // ── Animation mixer ──
      if (animations.length > 0) {
        animationClipsRef.current = animations
        const mixer = new THREE.AnimationMixer(model)
        mixerRef.current = mixer
        const idx = settingsRef.current.animationIndex
        const clip = animations[idx >= 0 ? idx : 0]
        if (idx >= 0 && clip) {
          const action = mixer.clipAction(clip)
          action.setEffectiveTimeScale(settingsRef.current.animationSpeed)
          action.play()
          currentActionRef.current = action
        }
        onAnimationsLoaded?.(animations.map(a => a.name))
      }

      setLoading(false)
      onLoad?.(Math.round(triCount), uniquePositions.size)
    }

    const onProgress = (xhr: ProgressEvent) => {
      if (xhr.total > 0) setLoadPct(Math.round((xhr.loaded / xhr.total) * 100))
    }

    const onLoadError = (err: unknown) => {
      console.error('Loader error:', err)
      setLoading(false)
      const msg = 'Failed to load 3D model.'
      setLoadError(msg)
      onError?.(msg)
    }

    let zipCleanup: (() => void) | null = null
    const urlLower = modelUrl.toLowerCase()

    if (urlLower.endsWith('.fbx')) {
      new FBXLoader().load(modelUrl, (fbx) => onModelLoaded(fbx, fbx.animations), onProgress, onLoadError)
    } else if (urlLower.endsWith('.zip')) {
      loadZipFromUrl(modelUrl)
        .then(({ manager, gltfUrl, cleanup }) => {
          zipCleanup = cleanup
          new GLTFLoader(manager).load(
            gltfUrl,
            (gltf) => onModelLoaded(gltf.scene, gltf.animations),
            onProgress,
            onLoadError,
          )
        })
        .catch(onLoadError)
    } else {
      new GLTFLoader().load(
        modelUrl,
        (gltf) => onModelLoaded(gltf.scene, gltf.animations),
        onProgress,
        onLoadError,
      )
    }

    // ── Render loop ──
    let fpsFrames = 0
    let fpsStart  = performance.now()

    function animate() {
      rafRef.current = requestAnimationFrame(animate)
      controls.update()
      if (mixerRef.current) mixerRef.current.update(clockRef.current.getDelta())
      renderer.render(scene, camera)

      trianglesRef.current = renderer.info.render.triangles
      drawCallsRef.current = renderer.info.render.calls

      fpsFrames++
      const now     = performance.now()
      const elapsed = now - fpsStart
      if (elapsed >= 1000) {
        fpsRef.current = (fpsFrames * 1000) / elapsed
        fpsFrames = 0
        fpsStart  = now
      }
    }
    animate()

    // ── Resize ──
    const resizeObserver = new ResizeObserver(() => {
      const w = container.clientWidth
      const h = container.clientHeight
      if (w === 0 || h === 0) return
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    })
    resizeObserver.observe(container)

    return () => {
      cancelAnimationFrame(rafRef.current)
      resizeObserver.disconnect()
      controls.dispose()
      mixerRef.current?.stopAllAction()
      mixerRef.current = null
      animationClipsRef.current = []
      currentActionRef.current = null
      renderer.dispose()
      keyLightRef.current = null
      hemiLightRef.current = null
      zipCleanup?.()
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
    }
  }, [modelUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={containerRef} className="relative w-full h-full bg-zinc-950">
      {loading && !loadError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-950 z-10 pointer-events-none">
          <Spinner size="lg" />
          <p className="text-zinc-400 text-sm">
            {loadPct > 0 ? `Loading… ${loadPct}%` : 'Preparing viewer…'}
          </p>
        </div>
      )}
      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950 z-10">
          <p className="text-red-400 text-sm">{loadError}</p>
        </div>
      )}
    </div>
  )
}
