'use client'

import { useEffect, useState, type RefObject } from 'react'
import { Activity } from 'lucide-react'
import type { ModelViewerRef } from './ModelViewer'
import { formatNumber } from '@/lib/utils'

interface StatsOverlayProps {
  viewerRef: RefObject<ModelViewerRef | null>
  storedTriangleCount?: number
}

interface Stats {
  fps: number
  drawCalls: number
  triangles: number
  vertices: number
}

export default function StatsOverlay({ viewerRef, storedTriangleCount }: StatsOverlayProps) {
  const [stats, setStats] = useState<Stats>({ fps: 0, drawCalls: 0, triangles: 0, vertices: 0 })

  useEffect(() => {
    const id = setInterval(() => {
      const v = viewerRef.current
      if (!v) return
      setStats({
        fps: v.getFPS(),
        drawCalls: v.getDrawCalls(),
        triangles: v.getTriangleCount(),
        vertices: v.getVertexCount(),
      })
    }, 500)
    return () => clearInterval(id)
  }, [viewerRef])

  const fpsColor =
    stats.fps >= 50 ? 'text-green-400' :
    stats.fps >= 25 ? 'text-yellow-400' :
    'text-red-400'

  return (
    <div className="bg-zinc-900/90 backdrop-blur-md border border-zinc-700/60 rounded-xl p-3 w-48 font-mono text-xs">
      <div className="flex items-center gap-1.5 text-zinc-500 mb-2.5">
        <Activity className="h-3 w-3" />
        <span className="uppercase tracking-widest text-[10px] font-semibold">Performance</span>
      </div>

      <div className="space-y-1.5">
        <Row label="FPS">
          <span className={fpsColor}>{stats.fps}</span>
        </Row>
        <Row label="Draw Calls">
          <span className="text-zinc-300">{stats.drawCalls}</span>
        </Row>
        <Row label="Triangles">
          <span className="text-zinc-300">{formatNumber(stats.triangles)}</span>
        </Row>
        <Row label="Vertices">
          <span className="text-zinc-300">{formatNumber(stats.vertices)}</span>
        </Row>

        {storedTriangleCount != null && storedTriangleCount > 0 && (
          <>
            <div className="border-t border-zinc-800 my-1.5" />
            <Row label="Stored">
              <span className="text-zinc-500">{formatNumber(storedTriangleCount)}</span>
            </Row>
          </>
        )}
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-600">{label}</span>
      {children}
    </div>
  )
}
