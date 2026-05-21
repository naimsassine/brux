"use client"

import { useEffect, useRef, useState } from "react"

const CAMERAS = [
  { id: "grand-place", label: "Grand Place" },
  { id: "brouckere",   label: "De Brouckère" },
]

function MiniStream({
  cam,
  onExpand,
}: {
  cam: (typeof CAMERAS)[0]
  onExpand: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef   = useRef<any>(null)
  const [status, setStatus] = useState<"loading" | "live" | "error">("loading")

  useEffect(() => {
    let destroyed = false

    async function init() {
      try {
        const res = await fetch(`/api/webcam?cam=${cam.id}`)
        if (!res.ok) { setStatus("error"); return }
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
            if (!destroyed) setStatus("live")
          })
          hls.on(Hls.Events.ERROR, (_: any, data: any) => {
            if (data.fatal && !destroyed) setStatus("error")
          })
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = streamUrl
          video.addEventListener("loadedmetadata", () => {
            video.play().catch(() => {})
            if (!destroyed) setStatus("live")
          })
        } else {
          setStatus("error")
        }
      } catch {
        if (!destroyed) setStatus("error")
      }
    }

    init()

    return () => {
      destroyed = true
      hlsRef.current?.destroy()
      hlsRef.current = null
    }
  }, [cam.id])

  return (
    <div
      className="relative cursor-pointer group flex-shrink-0"
      style={{ aspectRatio: "16/9" }}
      onClick={onExpand}
    >
      {/* Placeholder while loading / error */}
      {status !== "live" && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0e15]">
          <span className="font-mono text-[9px] tracking-widest uppercase"
            style={{ color: status === "error" ? "#ef4444" : "#3d4f64" }}>
            {status === "error" ? "UNAVAILABLE" : "CONNECTING…"}
          </span>
        </div>
      )}

      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        muted
        playsInline
        style={{ opacity: status === "live" ? 1 : 0 }}
      />

      {/* Bottom label bar */}
      <div className="absolute bottom-0 inset-x-0 flex items-center justify-between px-2 py-1.5 bg-gradient-to-t from-black/75 to-transparent">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="font-mono text-[9px] tracking-[.15em] uppercase text-white/90">
            {cam.label}
          </span>
        </div>
        <span className="font-mono text-[8px] tracking-widest text-white/40 opacity-0 group-hover:opacity-100 transition-opacity">
          ⛶ EXPAND
        </span>
      </div>

      {/* Hover border */}
      <div className="absolute inset-0 border border-transparent group-hover:border-red-500/40 transition-colors pointer-events-none" />
    </div>
  )
}

export default function PersistentWebcams({
  onExpand,
}: {
  onExpand: (camId: string) => void
}) {
  return (
    <>
      {CAMERAS.map((cam) => (
        <div
          key={cam.id}
          className="overflow-hidden border border-[#1c2a3a]/80 shadow-2xl backdrop-blur-sm"
          style={{ width: 240, background: "rgba(8,12,18,0.55)" }}
        >
          <MiniStream cam={cam} onExpand={() => onExpand(cam.id)} />
        </div>
      ))}
    </>
  )
}
