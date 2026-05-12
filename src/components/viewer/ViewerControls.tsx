'use client'

import { useRef } from 'react'
import { Grid2X2, RotateCw, Sun, Layers, Lightbulb, Play, Pause, Clapperboard } from 'lucide-react'
import type { ViewerSettings } from './ModelViewer'

interface ViewerControlsProps {
  settings: ViewerSettings
  onChange: (settings: ViewerSettings) => void
  cameraAzimuth: number  // radians, relative to initial position
  animationNames: string[]
}

function Toggle({
  checked,
  onToggle,
}: {
  checked: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${
        checked ? 'bg-brand-500' : 'bg-zinc-700'
      }`}
      aria-pressed={checked}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
          checked ? 'translate-x-4' : ''
        }`}
      />
    </button>
  )
}

// ── Full-circle light-direction dial ─────────────────────────
// Dot = light position (world space, moves only when dragged)
// NESW labels = model orientation (rotate with camera orbit)
// angle: 0=W(left), 90=N(front/top), 180=E(right), 270=S(back/bottom)

const W = 160, H = 160, CX = 80, CY = 80, R = 60, LR = 38

const NESW = [
  { label: 'N', a: 90  },
  { label: 'E', a: 180 },
  { label: 'S', a: 270 },
  { label: 'W', a: 0   },
] as const

function LightDial({ angle, onChange, azimuth }: { angle: number; onChange: (a: number) => void; azimuth: number }) {
  const svgRef = useRef<SVGSVGElement>(null)

  const toHandle = (a: number) => {
    const r = (a / 180) * Math.PI
    return { x: CX - R * Math.cos(r), y: CY - R * Math.sin(r) }
  }

  const eventToAngle = (clientX: number, clientY: number): number => {
    const svg = svgRef.current
    if (!svg) return angle
    const rect = svg.getBoundingClientRect()
    const mx = (clientX - rect.left) * (W / rect.width)
    const my = (clientY - rect.top) * (H / rect.height)
    const a = Math.atan2(CY - my, CX - mx) * 180 / Math.PI
    return Math.round(((a % 360) + 360) % 360)
  }

  const { x: hx, y: hy } = toHandle(angle)
  // Compass labels rotate opposite to camera orbit so they track model orientation
  const compassRotDeg = -(azimuth * 180 / Math.PI)

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="w-full cursor-pointer select-none touch-none"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        onChange(eventToAngle(e.clientX, e.clientY))
      }}
      onPointerMove={(e) => {
        if (e.buttons === 0) return
        onChange(eventToAngle(e.clientX, e.clientY))
      }}
    >
      {/* Outer track */}
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="#3f3f46" strokeWidth="2.5" />

      {/* Dashed spoke — behind everything */}
      <line x1={CX} y1={CY} x2={hx} y2={hy}
        stroke="#6366f1" strokeWidth="1" strokeDasharray="3 2" opacity={0.35}
      />

      {/* NESW compass — rotates with camera to show model orientation */}
      <g transform={`rotate(${compassRotDeg}, ${CX}, ${CY})`}>
        {NESW.map(({ label, a }) => {
          const r2 = (a / 180) * Math.PI
          const lx = CX - LR * Math.cos(r2)
          const ly = CY - LR * Math.sin(r2)
          return (
            <text
              key={label}
              x={lx} y={ly}
              textAnchor="middle"
              dominantBaseline="central"
              fill={label === 'N' ? '#a1a1aa' : '#52525b'}
              fontSize="9"
              fontFamily="ui-monospace,monospace"
              fontWeight={label === 'N' ? '700' : '400'}
              // Counter-rotate each label so text stays upright as compass spins
              transform={`rotate(${-compassRotDeg}, ${lx}, ${ly})`}
            >
              {label}
            </text>
          )
        })}

        {/* Subtle tick marks at NESW on the inner ring */}
        {NESW.map(({ label, a }) => {
          const r2 = (a / 180) * Math.PI
          const inner = 12, outer = 18
          return (
            <line key={label}
              x1={CX - inner * Math.cos(r2)} y1={CY - inner * Math.sin(r2)}
              x2={CX - outer * Math.cos(r2)} y2={CY - outer * Math.sin(r2)}
              stroke={label === 'N' ? '#71717a' : '#3f3f46'}
              strokeWidth={label === 'N' ? 1.5 : 1}
              strokeLinecap="round"
            />
          )
        })}
      </g>

      {/* Center pivot */}
      <circle cx={CX} cy={CY} r={2.5} fill="#52525b" />

      {/* Handle — light position, only moves when dragged */}
      <circle cx={hx} cy={hy} r={11} fill="#6366f1" opacity={0.15} />
      <circle cx={hx} cy={hy} r={6} fill="#6366f1" />
      <circle cx={hx} cy={hy} r={2.5} fill="white" opacity={0.8} />
    </svg>
  )
}

export default function ViewerControls({ settings, onChange, cameraAzimuth, animationNames }: ViewerControlsProps) {
  const patch = (partial: Partial<ViewerSettings>) => onChange({ ...settings, ...partial })

  return (
    <div className="bg-zinc-900/90 backdrop-blur-md border border-zinc-700/60 rounded-xl p-4 space-y-4 w-48 text-sm select-none">
      <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-widest">
        Display
      </p>

      {/* Wireframe */}
      <label className="flex items-center justify-between cursor-pointer">
        <span className="flex items-center gap-2 text-zinc-300">
          <Grid2X2 className="h-3.5 w-3.5 text-zinc-400" />
          Wireframe
        </span>
        <Toggle
          checked={settings.wireframe}
          onToggle={() => patch({ wireframe: !settings.wireframe })}
        />
      </label>

      {/* Auto-rotate */}
      <label className="flex items-center justify-between cursor-pointer">
        <span className="flex items-center gap-2 text-zinc-300">
          <RotateCw className="h-3.5 w-3.5 text-zinc-400" />
          Auto-Rotate
        </span>
        <Toggle
          checked={settings.autoRotate}
          onToggle={() => patch({ autoRotate: !settings.autoRotate })}
        />
      </label>

      {/* Textures (double-sided) */}
      <div>
        <label className="flex items-center justify-between cursor-pointer">
          <span className="flex items-center gap-2 text-zinc-300">
            <Layers className="h-3.5 w-3.5 text-zinc-400" />
            Textures
          </span>
          <Toggle
            checked={settings.doubleSided}
            onToggle={() => patch({ doubleSided: !settings.doubleSided })}
          />
        </label>
        <p className="text-zinc-600 text-[10px] mt-1 pl-5">
          {settings.doubleSided ? 'Double Sided' : 'Single Sided'}
        </p>
      </div>

      {/* Environment */}
      <div>
        <p className="flex items-center gap-2 text-zinc-300 mb-2">
          <Sun className="h-3.5 w-3.5 text-zinc-400" />
          Environment
        </p>
        <div className="grid grid-cols-3 gap-1 mb-1.5">
          {(['studio', 'outdoor', 'dark'] as const).map((env) => (
            <button
              key={env}
              type="button"
              onClick={() => patch({ environment: env })}
              className={`py-1.5 rounded-lg text-xs capitalize font-medium transition-colors ${
                settings.environment === env
                  ? 'bg-brand-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
              }`}
            >
              {env}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-1">
          {([1, 2, 3] as const).map((n) => {
            const key = `skybox${n}` as const
            const active = settings.environment === key
            return (
              <button
                key={n}
                type="button"
                onClick={() => patch({ environment: key })}
                className={`relative overflow-hidden rounded-lg aspect-square transition-all ${
                  active ? 'ring-2 ring-brand-500' : 'ring-1 ring-zinc-700 hover:ring-zinc-500'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/skyboxes/skybox${n}/py.png`} alt={`Sky ${n}`} className="w-full h-full object-cover" />
                <span className="absolute bottom-0 left-0 right-0 text-[9px] text-center bg-black/50 text-zinc-300 py-0.5">
                  Sky {n}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Light direction + intensity */}
      <div className="space-y-2">
        <p className="flex items-center gap-2 text-zinc-300">
          <Lightbulb className="h-3.5 w-3.5 text-zinc-400" />
          Light
        </p>
        <LightDial
          angle={settings.lightAngle}
          onChange={(a) => patch({ lightAngle: a })}
          azimuth={cameraAzimuth}
        />
        {/* Intensity slider */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-zinc-500 uppercase tracking-widest">Intensity</span>
            <span className="text-zinc-400 font-mono">{settings.lightIntensity.toFixed(1)}</span>
          </div>
          <input
            type="range"
            min={0.5} max={1} step={0.05}
            value={settings.lightIntensity}
            onChange={(e) => patch({ lightIntensity: parseFloat(e.target.value) })}
            className="w-full h-1 rounded-full appearance-none cursor-pointer bg-zinc-700 accent-brand-500"
          />
        </div>
      </div>

      {/* Animation — only shown when the model has animation clips */}
      {animationNames.length > 0 && (
        <div className="space-y-2 pt-3 border-t border-zinc-700/60">
          <p className="flex items-center gap-2 text-zinc-300">
            <Clapperboard className="h-3.5 w-3.5 text-zinc-400" />
            Animation
          </p>

          {/* Play / Pause */}
          <button
            type="button"
            onClick={() => patch({ animationIndex: settings.animationIndex >= 0 ? -1 : 0 })}
            className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
          >
            {settings.animationIndex >= 0
              ? <><Pause className="h-3 w-3" /> Pause</>
              : <><Play  className="h-3 w-3" /> Play</>
            }
          </button>

          {/* Clip picker — only when more than one clip */}
          {animationNames.length > 1 && (
            <div className="grid grid-cols-1 gap-1 max-h-28 overflow-y-auto">
              {animationNames.map((name, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => patch({ animationIndex: i })}
                  className={`py-1.5 px-2 rounded-lg text-xs text-left truncate transition-colors ${
                    settings.animationIndex === i
                      ? 'bg-brand-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
                  }`}
                >
                  {name || `Clip ${i + 1}`}
                </button>
              ))}
            </div>
          )}

          {/* Speed slider */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-zinc-500 uppercase tracking-widest">Speed</span>
              <span className="text-zinc-400 font-mono">{settings.animationSpeed.toFixed(2)}×</span>
            </div>
            <input
              type="range"
              min={0.25} max={2} step={0.05}
              value={settings.animationSpeed}
              onChange={(e) => patch({ animationSpeed: parseFloat(e.target.value) })}
              className="w-full h-1 rounded-full appearance-none cursor-pointer bg-zinc-700 accent-brand-500"
            />
          </div>
        </div>
      )}
    </div>
  )
}
