"use client"

import { useEffect, useRef, useState } from "react"

interface Props {
  onClose: () => void
}

export default function Webcam({ onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let destroyed = false

    async function init() {
      try {
        const res = await fetch("/api/webcam")
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
          // Safari native HLS
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
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative bg-black rounded-xl overflow-hidden shadow-2xl"
        style={{ width: 720, maxWidth: "95vw" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white text-sm font-medium">Grand Place — Live</span>
            <span className="text-gray-500 text-xs">bruxelles.be</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
        </div>

        {/* Video */}
        <div className="relative bg-black" style={{ aspectRatio: "16/9" }}>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
              Connecting to stream…
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center text-red-400 text-sm">
              {error}
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
