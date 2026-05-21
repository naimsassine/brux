"use client"

import { useEffect, useRef, useState } from "react"

const CAMERAS = [
  { id: "grand-place", label: "Grand Place" },
  { id: "brouckere",   label: "Place de Brouckère" },
]

interface Props {
  initialCam?: string
  onClose: () => void
}

export default function Webcam({ initialCam, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<any>(null)
  const [activeCam, setActiveCam] = useState(initialCam ?? CAMERAS[0].id)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let destroyed = false

    setError(null)
    setLoading(true)

    hlsRef.current?.destroy()
    hlsRef.current = null
    if (videoRef.current) videoRef.current.src = ""

    async function init() {
      try {
        const res = await fetch(`/api/webcam?cam=${activeCam}`)
        if (!res.ok) { setError("Could not load stream"); setLoading(false); return }
        const { streamUrl } = await res.json()
        if (destroyed) return

        const video = videoRef.current
        if (!video) return

        const Hls = (await import("hls.js")).default

        if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: false })
          hlsRef.current = hls
          hls.loadSource(streamUrl)
          hls.attachMedia(video)
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(() => {})
            setLoading(false)
          })
          hls.on(Hls.Events.ERROR, (_: any, data: any) => {
            if (data.fatal) setError("Stream unavailable")
          })
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = streamUrl
          video.addEventListener("loadedmetadata", () => { video.play().catch(() => {}); setLoading(false) })
        } else {
          setError("HLS not supported in this browser")
          setLoading(false)
        }
      } catch {
        if (!destroyed) { setError("Failed to load stream"); setLoading(false) }
      }
    }

    init()

    return () => {
      destroyed = true
      hlsRef.current?.destroy()
      hlsRef.current = null
    }
  }, [activeCam])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative overflow-hidden shadow-2xl border border-[#1c2a3a]"
        style={{ width: 720, maxWidth: "95vw", background: "#080c12" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-10 border-b border-[#1c2a3a] bg-[#0d1117]">
          <div className="flex items-center gap-3">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
            {CAMERAS.map((cam) => (
              <button
                key={cam.id}
                onClick={() => setActiveCam(cam.id)}
                className="font-mono text-[9px] tracking-[.15em] uppercase transition-colors"
                style={{
                  color:        activeCam === cam.id ? "#c9d1d9" : "#3d4f64",
                  borderBottom: activeCam === cam.id ? "1px solid #ef4444" : "1px solid transparent",
                  paddingBottom: "1px",
                }}
              >
                {cam.label}
              </button>
            ))}
            <span className="font-mono text-[9px] text-[#1c2a3a] tracking-widest">BRUXELLES.BE</span>
          </div>
          <button
            onClick={onClose}
            className="font-mono text-[10px] text-[#3d4f64] hover:text-white transition-colors tracking-widest"
          >
            ✕ CLOSE
          </button>
        </div>

        {/* Video */}
        <div className="relative bg-black" style={{ aspectRatio: "16/9" }}>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center font-mono text-[10px] text-[#3d4f64] tracking-widest">
              CONNECTING…
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center font-mono text-[10px] text-red-500 tracking-widest">
              STREAM UNAVAILABLE
            </div>
          )}
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            muted
            playsInline
            style={{ display: error ? "none" : "block" }}
          />
        </div>
      </div>
    </div>
  )
}
