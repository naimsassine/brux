"use client"

import React, { useEffect, useRef } from "react"
import type { ItemType, TabType, DateRange } from "../lib/filters"
import { getDateBounds } from "../lib/filters"
import { bruxBlueprintStyle } from "../lib/mapStyle"
import type { TrafficAlert } from "../app/api/traffic/route"

interface MetroLine {
  id: string
  color: string
  stops: { ref: string; name: string; lat: number; lng: number }[]
  vehicles: { lat: number; lng: number; direction: string }[]
}

interface Props {
  selectedCommune: number | null
  onSelectCommune: (id: number | null) => void
  typeColors: Record<ItemType, string>
  trafficColor: string
  showMetro: boolean
  showBusNetwork: boolean
  showRailNetwork: boolean
  showPoliticalSites: boolean
  showBikeFlow: boolean
  showVillo: boolean
  showAir: boolean
  activeTab: TabType
  dateRange: DateRange
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function buildPopupHtml(props: any, typeColors: Record<string, string>): string {
  const color = typeColors[props.type] ?? "#888"
  const meta = [props.type?.toUpperCase(), props.communeName?.toUpperCase()].filter(Boolean).join(" · ")
  return `
    <div style="font-family:ui-monospace,SFMono-Regular,'SF Mono',monospace;max-width:240px;padding:2px 0">
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:${color};margin-bottom:6px">${escapeHtml(meta)}</div>
      <div style="font-size:12px;font-weight:500;line-height:1.45;color:#c9d1d9;margin-bottom:5px;font-family:-apple-system,sans-serif">${escapeHtml(props.title ?? "")}</div>
      <div style="font-size:9px;color:#3d4f64;text-transform:uppercase;letter-spacing:.1em">${escapeHtml(props.sourceName ?? "")}</div>
    </div>
  `
}

function makeHospitalImage(cssSize: number): ImageData {
  const px = cssSize * 2
  const canvas = document.createElement("canvas")
  canvas.width = px
  canvas.height = px
  const ctx = canvas.getContext("2d")!
  const r = px / 2

  ctx.beginPath()
  ctx.arc(r, r, r, 0, Math.PI * 2)
  ctx.fillStyle = "#dc2626"
  ctx.fill()

  ctx.fillStyle = "#ffffff"
  const size = px * 0.55
  const thick = px * 0.20
  ctx.fillRect(r - size / 2, r - thick / 2, size, thick)
  ctx.fillRect(r - thick / 2, r - size / 2, thick, size)

  ctx.beginPath()
  ctx.arc(r, r, r - 2, 0, Math.PI * 2)
  ctx.strokeStyle = "#ffffff"
  ctx.lineWidth = 3
  ctx.stroke()

  return ctx.getImageData(0, 0, px, px)
}

// Water-fountain marker: azure disc with a white water droplet.
function makeFountainImage(cssSize: number): ImageData {
  const px = cssSize * 2
  const canvas = document.createElement("canvas")
  canvas.width = px
  canvas.height = px
  const ctx = canvas.getContext("2d")!
  const r = px / 2

  // Disc
  ctx.beginPath()
  ctx.arc(r, r, r, 0, Math.PI * 2)
  ctx.fillStyle = "#0891b2"
  ctx.fill()

  // White droplet (teardrop: pointed top, rounded bottom)
  const dh = px * 0.26 // half-height of the drop
  const dw = px * 0.2 // half-width
  ctx.fillStyle = "#ffffff"
  ctx.beginPath()
  ctx.moveTo(r, r - dh)
  ctx.bezierCurveTo(r + dw, r - dh * 0.1, r + dw, r + dh * 0.7, r, r + dh)
  ctx.bezierCurveTo(r - dw, r + dh * 0.7, r - dw, r - dh * 0.1, r, r - dh)
  ctx.closePath()
  ctx.fill()

  // White border ring
  ctx.beginPath()
  ctx.arc(r, r, r - 2, 0, Math.PI * 2)
  ctx.strokeStyle = "#ffffff"
  ctx.lineWidth = 3
  ctx.stroke()

  return ctx.getImageData(0, 0, px, px)
}

// Parking marker: blue rounded square with a white "P".
function makeParkingImage(cssSize: number): ImageData {
  const px = cssSize * 2
  const canvas = document.createElement("canvas")
  canvas.width = px
  canvas.height = px
  const ctx = canvas.getContext("2d")!

  ctx.beginPath()
  ;(ctx as any).roundRect(1.5, 1.5, px - 3, px - 3, px * 0.24)
  ctx.fillStyle = "#2563eb"
  ctx.fill()
  ctx.strokeStyle = "#ffffff"
  ctx.lineWidth = 3
  ctx.stroke()

  ctx.fillStyle = "#ffffff"
  ctx.font = `700 ${px * 0.62}px -apple-system, system-ui, sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("P", px / 2, px / 2 + px * 0.04)

  return ctx.getImageData(0, 0, px, px)
}

// Glass-recycling marker: green disc with a white bottle silhouette.
function makeGlassImage(cssSize: number): ImageData {
  const px = cssSize * 2
  const canvas = document.createElement("canvas")
  canvas.width = px
  canvas.height = px
  const ctx = canvas.getContext("2d")!
  const r = px / 2

  ctx.beginPath()
  ctx.arc(r, r, r, 0, Math.PI * 2)
  ctx.fillStyle = "#16a34a"
  ctx.fill()

  // Bottle (white): neck + rounded body
  const top = r - px * 0.26
  ctx.fillStyle = "#ffffff"
  ctx.beginPath()
  ;(ctx as any).roundRect(r - px * 0.07, top, px * 0.14, px * 0.14, px * 0.02) // neck
  ctx.fill()
  ctx.beginPath()
  ;(ctx as any).roundRect(r - px * 0.15, top + px * 0.12, px * 0.3, px * 0.36, px * 0.07) // body
  ctx.fill()

  ctx.beginPath()
  ctx.arc(r, r, r - 2, 0, Math.PI * 2)
  ctx.strokeStyle = "#ffffff"
  ctx.lineWidth = 3
  ctx.stroke()

  return ctx.getImageData(0, 0, px, px)
}

// Public-toilet marker: violet disc with white "WC".
function makeToiletImage(cssSize: number): ImageData {
  const px = cssSize * 2
  const canvas = document.createElement("canvas")
  canvas.width = px
  canvas.height = px
  const ctx = canvas.getContext("2d")!
  const r = px / 2

  ctx.beginPath()
  ctx.arc(r, r, r, 0, Math.PI * 2)
  ctx.fillStyle = "#7c3aed"
  ctx.fill()

  ctx.fillStyle = "#ffffff"
  ctx.font = `700 ${px * 0.42}px -apple-system, system-ui, sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  ctx.fillText("WC", r, r + px * 0.03)

  ctx.beginPath()
  ctx.arc(r, r, r - 2, 0, Math.PI * 2)
  ctx.strokeStyle = "#ffffff"
  ctx.lineWidth = 3
  ctx.stroke()

  return ctx.getImageData(0, 0, px, px)
}

// Villo availability gauge: a rectangular bar of 5 segment "lights" that fill
// according to bikes/capacity. `idx` is the number of lit half-segments (0–10),
// so idx=5 → 2.5 lights lit. Lit colour reflects the fill level (red→amber→green).
function makeVilloGaugeImage(idx: number): ImageData {
  const scale = 2
  const cellW = 10, gap = 2, padX = 4, padY = 4, cellH = 12
  const cssW = padX * 2 + 5 * cellW + 4 * gap // 66
  const cssH = padY * 2 + cellH // 20
  const W = cssW * scale, H = cssH * scale
  const canvas = document.createElement("canvas")
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")!
  ctx.scale(scale, scale)

  // Container
  ctx.beginPath()
  ;(ctx as any).roundRect(0.5, 0.5, cssW - 1, cssH - 1, 4)
  ctx.fillStyle = "#0d1117"
  ctx.fill()
  ctx.strokeStyle = "#243044"
  ctx.lineWidth = 1
  ctx.stroke()

  const pct = idx / 10
  const litColor = pct < 0.34 ? "#ef4444" : pct < 0.67 ? "#f59e0b" : "#22c55e"

  for (let i = 0; i < 5; i++) {
    const x = padX + i * (cellW + gap)
    const y = padY
    // Unlit base cell
    ctx.beginPath()
    ;(ctx as any).roundRect(x, y, cellW, cellH, 2)
    ctx.fillStyle = "#1c2a3a"
    ctx.fill()
    // Lit portion (full cell, or left half for the .5 case)
    let fillW = 0
    if (idx >= 2 * i + 2) fillW = cellW
    else if (idx === 2 * i + 1) fillW = cellW / 2
    if (fillW > 0) {
      ctx.save()
      ctx.beginPath()
      ;(ctx as any).roundRect(x, y, cellW, cellH, 2)
      ctx.clip()
      ctx.fillStyle = litColor
      ctx.fillRect(x, y, fillW, cellH)
      ctx.restore()
    }
  }
  return ctx.getImageData(0, 0, W, H)
}

// Soft puffy cloud built from overlapping blurred circles, in `color`.
// Rendered semi-transparent (via icon-opacity) so the map shows through.
function makeCloudImage(cssSize: number, color: string): ImageData {
  const px = cssSize * 2
  const canvas = document.createElement("canvas")
  canvas.width = px
  canvas.height = px
  const ctx = canvas.getContext("2d")!
  ctx.filter = `blur(${px * 0.05}px)` // soft cloud edges
  ctx.fillStyle = color
  // A cluster of lobes forming a rounded cloud silhouette.
  const lobes: [number, number, number][] = [
    [0.34, 0.58, 0.2],
    [0.5, 0.46, 0.26],
    [0.66, 0.58, 0.2],
    [0.44, 0.64, 0.18],
    [0.58, 0.64, 0.18],
  ]
  for (const [x, y, r] of lobes) {
    ctx.beginPath()
    ctx.arc(px * x, px * y, px * r, 0, Math.PI * 2)
    ctx.fill()
  }
  return ctx.getImageData(0, 0, px, px)
}


// Renders at 2× resolution so it appears crisp when addImage is called with { pixelRatio: 2 }
function makeBelgianFlagImage(cssSize: number): ImageData {
  const px = cssSize * 2
  const canvas = document.createElement("canvas")
  canvas.width = px
  canvas.height = px
  const ctx = canvas.getContext("2d")!
  const r = px / 2

  ctx.beginPath()
  ctx.arc(r, r, r, 0, Math.PI * 2)
  ctx.clip()

  const w = px / 3
  ctx.fillStyle = "#1a1a1a"
  ctx.fillRect(0, 0, w, px)
  ctx.fillStyle = "#FFD700"
  ctx.fillRect(w, 0, w, px)
  ctx.fillStyle = "#CC0000"
  ctx.fillRect(w * 2, 0, w, px)

  // White border ring
  ctx.beginPath()
  ctx.arc(r, r, r - 2, 0, Math.PI * 2)
  ctx.strokeStyle = "#ffffff"
  ctx.lineWidth = 3
  ctx.stroke()

  return ctx.getImageData(0, 0, px, px)
}

export default function MapView({ selectedCommune, onSelectCommune, typeColors, trafficColor, showMetro, showBusNetwork, showRailNetwork, showPoliticalSites, showBikeFlow, showVillo, showAir, activeTab, dateRange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const metroIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const bikeFlowIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const villoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const airIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const trafficIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const itemsAbortRef = useRef<AbortController | null>(null)
  const PopupCtorRef = useRef<any>(null)
  const pinnedPopupRef = useRef<any>(null)
  const clickHandledRef = useRef(false)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    let map: any

    import("maplibre-gl").then((maplibre) => {
      PopupCtorRef.current = maplibre.Popup
      map = new maplibre.Map({
        container: containerRef.current!,
        style: bruxBlueprintStyle,
        center: [4.3517, 50.8503],
        zoom: 12.5,
      })

      mapRef.current = map

      map.on("load", () => {
        let activePopup: any = null

        map.on("click", () => {
          if (clickHandledRef.current) { clickHandledRef.current = false; return }
          pinnedPopupRef.current?.remove()
          pinnedPopupRef.current = null
        })

        map.on("mouseenter", "items-circles", (e: any) => {
          if (!e.features?.length) return
          map.getCanvas().style.cursor = "pointer"
          if (pinnedPopupRef.current) return
          const props = e.features[0].properties
          activePopup?.remove()
          activePopup = new maplibre.Popup({ closeButton: false, offset: 8, maxWidth: "280px" })
            .setLngLat(e.lngLat)
            .setHTML(buildPopupHtml(props, typeColors))
            .addTo(map)
        })

        map.on("mouseleave", "items-circles", () => {
          map.getCanvas().style.cursor = ""
          if (pinnedPopupRef.current) return
          activePopup?.remove()
          activePopup = null
        })

        map.on("click", "items-circles", (e: any) => {
          if (!e.features?.length) return
          clickHandledRef.current = true
          activePopup?.remove()
          activePopup = null
          pinnedPopupRef.current?.remove()
          const props = e.features[0].properties
          pinnedPopupRef.current = new maplibre.Popup({ closeButton: true, offset: 8, maxWidth: "280px" })
            .setLngLat(e.lngLat)
            .setHTML(buildPopupHtml(props, typeColors))
            .addTo(map)
          pinnedPopupRef.current.on("close", () => { pinnedPopupRef.current = null })
        })

        // Police stations — always visible, no toggle
        map.addSource("police-stations", { type: "geojson", data: "/police-stations.geojson" })

        map.loadImage("/police_logo.webp").then(({ data: image }: any) => {
          map.addImage("police-icon", image, { pixelRatio: 4 })
          map.addLayer({
            id: "police-icons",
            type: "symbol",
            source: "police-stations",
            layout: {
              "icon-image": "police-icon",
              "icon-size": 0.1,
              "icon-allow-overlap": true,
            },
          })

          let policePopup: any = null
          const policeHtml = (p: any) => `
                <div style="font-family:ui-monospace,monospace;padding:2px 0">
                  <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#60a5fa;margin-bottom:6px">POLICE</div>
                  <div style="font-size:12px;font-weight:600;color:#c9d1d9;margin-bottom:3px;font-family:-apple-system,sans-serif">${escapeHtml(p.name)}</div>
                  <div style="font-size:10px;color:#6e7f96;font-family:-apple-system,sans-serif">${escapeHtml(p.zone)}</div>
                </div>`
          map.on("mouseenter", "police-icons", (e: any) => {
            if (!e.features?.length || !PopupCtorRef.current) return
            map.getCanvas().style.cursor = "pointer"
            if (pinnedPopupRef.current) return
            const p = e.features[0].properties
            policePopup?.remove()
            policePopup = new PopupCtorRef.current({ closeButton: false, offset: 14, maxWidth: "220px" })
              .setLngLat(e.lngLat)
              .setHTML(policeHtml(p))
              .addTo(map)
          })
          map.on("mouseleave", "police-icons", () => {
            map.getCanvas().style.cursor = ""
            if (pinnedPopupRef.current) return
            policePopup?.remove()
            policePopup = null
          })
          map.on("click", "police-icons", (e: any) => {
            if (!e.features?.length || !PopupCtorRef.current) return
            clickHandledRef.current = true
            policePopup?.remove()
            policePopup = null
            pinnedPopupRef.current?.remove()
            const p = e.features[0].properties
            pinnedPopupRef.current = new PopupCtorRef.current({ closeButton: true, offset: 14, maxWidth: "220px" })
              .setLngLat(e.lngLat)
              .setHTML(policeHtml(p))
              .addTo(map)
            pinnedPopupRef.current.on("close", () => { pinnedPopupRef.current = null })
          })
        }).catch((e: any) => console.error("[police] image load error", e))

        // Hospitals — always visible, no toggle
        map.addSource("hospitals", { type: "geojson", data: "/hospitals.geojson" })
        map.addImage("hospital-icon", makeHospitalImage(20), { pixelRatio: 2 })
        map.addLayer({
          id: "hospital-icons",
          type: "symbol",
          source: "hospitals",
          layout: {
            "icon-image": "hospital-icon",
            "icon-size": 1,
            "icon-allow-overlap": true,
          },
        })

        let hospitalPopup: any = null
        const hospitalHtml = (p: any) => `
              <div style="font-family:ui-monospace,monospace;padding:2px 0">
                <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#f87171;margin-bottom:6px">HOSPITAL</div>
                <div style="font-size:12px;font-weight:600;color:#c9d1d9;margin-bottom:3px;font-family:-apple-system,sans-serif">${escapeHtml(p.name)}</div>
                <div style="font-size:10px;color:#6e7f96;font-family:-apple-system,sans-serif">${escapeHtml(p.address)}</div>
              </div>`
        map.on("mouseenter", "hospital-icons", (e: any) => {
          if (!e.features?.length || !PopupCtorRef.current) return
          map.getCanvas().style.cursor = "pointer"
          if (pinnedPopupRef.current) return
          const p = e.features[0].properties
          hospitalPopup?.remove()
          hospitalPopup = new PopupCtorRef.current({ closeButton: false, offset: 14, maxWidth: "220px" })
            .setLngLat(e.lngLat)
            .setHTML(hospitalHtml(p))
            .addTo(map)
        })
        map.on("mouseleave", "hospital-icons", () => {
          map.getCanvas().style.cursor = ""
          if (pinnedPopupRef.current) return
          hospitalPopup?.remove()
          hospitalPopup = null
        })
        map.on("click", "hospital-icons", (e: any) => {
          if (!e.features?.length || !PopupCtorRef.current) return
          clickHandledRef.current = true
          hospitalPopup?.remove()
          hospitalPopup = null
          pinnedPopupRef.current?.remove()
          const p = e.features[0].properties
          pinnedPopupRef.current = new PopupCtorRef.current({ closeButton: true, offset: 14, maxWidth: "220px" })
            .setLngLat(e.lngLat)
            .setHTML(hospitalHtml(p))
            .addTo(map)
          pinnedPopupRef.current.on("close", () => { pinnedPopupRef.current = null })
        })

        // Drinking-water fountains (City of Brussels) — always visible, no toggle
        map.addSource("water-fountains", { type: "geojson", data: "/water-fountains.geojson" })
        map.addImage("fountain-icon", makeFountainImage(15), { pixelRatio: 2 })
        map.addLayer({
          id: "fountain-icons",
          type: "symbol",
          source: "water-fountains",
          layout: {
            "icon-image": "fountain-icon",
            "icon-size": 1,
            "icon-allow-overlap": false,
          },
        })

        let fountainPopup: any = null
        const fountainHtml = (p: any) => {
          const loc = [p.address_fr, p.territory_fr].filter(Boolean).join(" · ")
          return `
              <div style="font-family:ui-monospace,monospace;padding:2px 0">
                <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#22d3ee;margin-bottom:6px">💧 DRINKING WATER</div>
                <div style="font-size:12px;font-weight:600;color:#c9d1d9;margin-bottom:3px;font-family:-apple-system,sans-serif">${escapeHtml(p.name_fr ?? "")}</div>
                <div style="font-size:10px;color:#6e7f96;margin-bottom:4px;font-family:-apple-system,sans-serif">${escapeHtml(loc)}</div>
                <div style="font-size:9px;color:#3d4f64;text-transform:uppercase;letter-spacing:.08em">${escapeHtml(p.access_type_fr ?? "")} · free</div>
              </div>`
        }
        map.on("mouseenter", "fountain-icons", (e: any) => {
          if (!e.features?.length || !PopupCtorRef.current) return
          map.getCanvas().style.cursor = "pointer"
          if (pinnedPopupRef.current) return
          const p = e.features[0].properties
          fountainPopup?.remove()
          fountainPopup = new PopupCtorRef.current({ closeButton: false, offset: 12, maxWidth: "230px" })
            .setLngLat(e.lngLat)
            .setHTML(fountainHtml(p))
            .addTo(map)
        })
        map.on("mouseleave", "fountain-icons", () => {
          map.getCanvas().style.cursor = ""
          if (pinnedPopupRef.current) return
          fountainPopup?.remove()
          fountainPopup = null
        })
        map.on("click", "fountain-icons", (e: any) => {
          if (!e.features?.length || !PopupCtorRef.current) return
          clickHandledRef.current = true
          fountainPopup?.remove()
          fountainPopup = null
          pinnedPopupRef.current?.remove()
          const p = e.features[0].properties
          pinnedPopupRef.current = new PopupCtorRef.current({ closeButton: true, offset: 12, maxWidth: "230px" })
            .setLngLat(e.lngLat)
            .setHTML(fountainHtml(p))
            .addTo(map)
          pinnedPopupRef.current.on("close", () => { pinnedPopupRef.current = null })
        })

        // ── Simple always-on POI layers (parking / glass banks / toilets) ──
        // Each: canvas icon + geojson source + symbol layer + hover/click popups.
        const addPoiLayer = (opts: {
          id: string
          data: string
          image: ImageData
          iconSize?: number
          minzoom?: number
          html: (p: any) => string
        }) => {
          map.addSource(opts.id, { type: "geojson", data: opts.data })
          map.addImage(`${opts.id}-icon`, opts.image, { pixelRatio: 2 })
          map.addLayer({
            id: `${opts.id}-icons`,
            type: "symbol",
            source: opts.id,
            ...(opts.minzoom ? { minzoom: opts.minzoom } : {}),
            layout: {
              "icon-image": `${opts.id}-icon`,
              "icon-size": opts.iconSize ?? 1,
              "icon-allow-overlap": false,
            },
          })

          let poiPopup: any = null
          map.on("mouseenter", `${opts.id}-icons`, (e: any) => {
            if (!e.features?.length || !PopupCtorRef.current) return
            map.getCanvas().style.cursor = "pointer"
            if (pinnedPopupRef.current) return
            poiPopup?.remove()
            poiPopup = new PopupCtorRef.current({ closeButton: false, offset: 12, maxWidth: "240px" })
              .setLngLat(e.lngLat)
              .setHTML(opts.html(e.features[0].properties))
              .addTo(map)
          })
          map.on("mouseleave", `${opts.id}-icons`, () => {
            map.getCanvas().style.cursor = ""
            if (pinnedPopupRef.current) return
            poiPopup?.remove()
            poiPopup = null
          })
          map.on("click", `${opts.id}-icons`, (e: any) => {
            if (!e.features?.length || !PopupCtorRef.current) return
            clickHandledRef.current = true
            poiPopup?.remove()
            poiPopup = null
            pinnedPopupRef.current?.remove()
            pinnedPopupRef.current = new PopupCtorRef.current({ closeButton: true, offset: 12, maxWidth: "240px" })
              .setLngLat(e.lngLat)
              .setHTML(opts.html(e.features[0].properties))
              .addTo(map)
            pinnedPopupRef.current.on("close", () => { pinnedPopupRef.current = null })
          })
        }

        const poiHeader = (icon: string, label: string, color: string) =>
          `<div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:${color};margin-bottom:6px">${icon} ${label}</div>`
        const poiTitle = (t: string) =>
          `<div style="font-size:12px;font-weight:600;color:#c9d1d9;margin-bottom:3px;font-family:-apple-system,sans-serif">${escapeHtml(t)}</div>`
        const poiSub = (t: string) =>
          t ? `<div style="font-size:10px;color:#6e7f96;margin-bottom:4px;font-family:-apple-system,sans-serif">${escapeHtml(t)}</div>` : ""
        const poiMeta = (t: string) =>
          t ? `<div style="font-size:9px;color:#3d4f64;text-transform:uppercase;letter-spacing:.08em">${escapeHtml(t)}</div>` : ""

        // Public parkings
        addPoiLayer({
          id: "parking",
          data: "/parkings.geojson",
          image: makeParkingImage(15),
          html: (p) => {
            const cap = p.capacity ? `${p.capacity} spaces` : ""
            const disabled = p.disabledcapacity > 0 ? `♿ ${p.disabledcapacity}` : ""
            const meta = [p.operator_fr, cap, disabled].filter(Boolean).join(" · ")
            return `<div style="font-family:ui-monospace,monospace;padding:2px 0">
              ${poiHeader("🅿", "Parking", "#60a5fa")}${poiTitle(p.name_fr ?? "")}${poiSub(p.adressee ?? "")}${poiMeta(meta)}</div>`
          },
        })

        // Glass recycling banks (minzoom keeps the 1000+ pins from carpeting the city)
        addPoiLayer({
          id: "glass",
          data: "/glass-banks.geojson",
          image: makeGlassImage(12),
          minzoom: 13,
          html: (p) => {
            const loc = [p.address_fr, p.municipality_fr].filter(Boolean).join(" · ")
            return `<div style="font-family:ui-monospace,monospace;padding:2px 0">
              ${poiHeader("♺", "Glass recycling", "#4ade80")}${poiTitle(p.category_fr ?? "Glass bank")}${poiSub(loc)}</div>`
          },
        })

        // Public toilets
        addPoiLayer({
          id: "toilet",
          data: "/toilets.geojson",
          image: makeToiletImage(14),
          html: (p) => {
            const loc = [p.address_fr, p.municipality_fr].filter(Boolean).join(" · ")
            return `<div style="font-family:ui-monospace,monospace;padding:2px 0">
              ${poiHeader("🚻", "Public toilet", "#a78bfa")}${poiTitle(p.address_fr ?? "Public toilet")}${poiSub(p.territory_fr ?? p.municipality_fr ?? "")}${poiMeta(p.openinghours ?? "")}</div>`
          },
        })
      })

      map.on("click", "commune-fill", (e: any) => {
        const communeId = e.features?.[0]?.properties?.id
        if (communeId) {
          clickHandledRef.current = true
          onSelectCommune(Number(communeId))
        }
      })
    })

    return () => {
      stopMetroAnimation()
      stopAirAnimation()
      map?.remove()
      mapRef.current = null
    }
  }, [])

  // Re-fetch map items when tab or date range changes (skip for traffic tab)
  useEffect(() => {
    if (activeTab === "traffic") return

    const run = () => {
      const m = mapRef.current
      if (m?.isStyleLoaded()) fetchAndRenderItems(m, typeColors, activeTab as ItemType, dateRange, itemsAbortRef)
    }

    const map = mapRef.current
    if (!map) {
      // Map not yet initialized — wait for it (same pattern as metro/bus/rail)
      const wait = setInterval(() => {
        if (mapRef.current?.isStyleLoaded()) { clearInterval(wait); run() }
      }, 200)
      return () => clearInterval(wait)
    }

    if (map.isStyleLoaded()) run()
    else map.once("load", run)
  }, [activeTab, dateRange])

  // Traffic alerts: always shown on map, poll every 2 minutes
  useEffect(() => {
    const runTraffic = () => {
      const map = mapRef.current
      if (map?.isStyleLoaded()) fetchAndRenderTraffic(map, trafficColor, PopupCtorRef, pinnedPopupRef, clickHandledRef)
    }

    if (!mapRef.current) {
      const wait = setInterval(() => {
        if (mapRef.current?.isStyleLoaded()) {
          clearInterval(wait)
          runTraffic()
          trafficIntervalRef.current = setInterval(runTraffic, 120_000)
        }
      }, 200)
      return () => clearInterval(wait)
    }

    runTraffic()
    trafficIntervalRef.current = setInterval(runTraffic, 120_000)

    return () => {
      if (trafficIntervalRef.current) clearInterval(trafficIntervalRef.current)
    }
  }, [])

  // Metro layer: initial load + polling
  useEffect(() => {
    const map = mapRef.current

    if (metroIntervalRef.current) {
      clearInterval(metroIntervalRef.current)
      metroIntervalRef.current = null
    }

    if (!showMetro) {
      if (map?.isStyleLoaded()) clearMetroLayers(map)
      return
    }

    const run = () => {
      if (map?.isStyleLoaded()) fetchAndRenderMetro(map)
    }

    if (!map) {
      const wait = setInterval(() => {
        if (mapRef.current?.isStyleLoaded()) {
          clearInterval(wait)
          fetchAndRenderMetro(mapRef.current)
          metroIntervalRef.current = setInterval(() => fetchAndRenderMetro(mapRef.current), 30000)
        }
      }, 200)
      return () => clearInterval(wait)
    }

    run()
    metroIntervalRef.current = setInterval(run, 30000)

    return () => {
      if (metroIntervalRef.current) clearInterval(metroIntervalRef.current)
    }
  }, [showMetro])


  // Bike/scooter flow heatmap: poll once an hour (data isn't more granular than we need)
  useEffect(() => {
    if (bikeFlowIntervalRef.current) {
      clearInterval(bikeFlowIntervalRef.current)
      bikeFlowIntervalRef.current = null
    }

    if (!showBikeFlow) {
      if (mapRef.current?.isStyleLoaded()) clearBikeFlowLayers(mapRef.current)
      return
    }

    const run = () => {
      if (mapRef.current?.isStyleLoaded()) fetchAndRenderBikeFlow(mapRef.current, PopupCtorRef, pinnedPopupRef, clickHandledRef)
    }

    if (!mapRef.current) {
      const wait = setInterval(() => {
        if (mapRef.current?.isStyleLoaded()) {
          clearInterval(wait)
          run()
          bikeFlowIntervalRef.current = setInterval(run, 3600000)
        }
      }, 200)
      return () => clearInterval(wait)
    }

    run()
    bikeFlowIntervalRef.current = setInterval(run, 3600000)

    return () => {
      if (bikeFlowIntervalRef.current) clearInterval(bikeFlowIntervalRef.current)
    }
  }, [showBikeFlow])

  // Villo bike-share availability: poll every 60s (availability changes fast)
  useEffect(() => {
    if (villoIntervalRef.current) {
      clearInterval(villoIntervalRef.current)
      villoIntervalRef.current = null
    }
    if (!showVillo) {
      if (mapRef.current?.isStyleLoaded()) clearVilloLayers(mapRef.current)
      return
    }
    const run = () => {
      if (mapRef.current?.isStyleLoaded()) fetchAndRenderVillo(mapRef.current, PopupCtorRef, pinnedPopupRef, clickHandledRef)
    }
    if (!mapRef.current) {
      const wait = setInterval(() => {
        if (mapRef.current?.isStyleLoaded()) {
          clearInterval(wait)
          run()
          villoIntervalRef.current = setInterval(run, 60000)
        }
      }, 200)
      return () => clearInterval(wait)
    }
    run()
    villoIntervalRef.current = setInterval(run, 60000)
    return () => {
      if (villoIntervalRef.current) clearInterval(villoIntervalRef.current)
    }
  }, [showVillo])

  // Air quality (PM2.5) clouds: poll every 10 min (data is hourly)
  useEffect(() => {
    if (airIntervalRef.current) {
      clearInterval(airIntervalRef.current)
      airIntervalRef.current = null
    }
    if (!showAir) {
      if (mapRef.current?.isStyleLoaded()) clearAirLayers(mapRef.current)
      return
    }
    const run = () => {
      if (mapRef.current?.isStyleLoaded()) fetchAndRenderAir(mapRef.current, PopupCtorRef, pinnedPopupRef, clickHandledRef)
    }
    if (!mapRef.current) {
      const wait = setInterval(() => {
        if (mapRef.current?.isStyleLoaded()) {
          clearInterval(wait)
          run()
          airIntervalRef.current = setInterval(run, 600000)
        }
      }, 200)
      return () => clearInterval(wait)
    }
    run()
    airIntervalRef.current = setInterval(run, 600000)
    return () => {
      if (airIntervalRef.current) clearInterval(airIntervalRef.current)
    }
  }, [showAir])

  // Rail (tram + metro) network layer
  useEffect(() => {
    const apply = () => {
      const map = mapRef.current
      if (!map?.isStyleLoaded()) return
      if (!showRailNetwork) {
        if (map.getLayer("rail-network")) map.removeLayer("rail-network")
        if (map.getSource("rail-network")) map.removeSource("rail-network")
        return
      }
      if (!map.getSource("rail-network")) {
        map.addSource("rail-network", { type: "geojson", data: "/rail-network.geojson" })
      }
      if (!map.getLayer("rail-network")) {
        map.addLayer(
          {
            id: "rail-network",
            type: "line" as const,
            source: "rail-network",
            layout: { "line-join": "round" as const, "line-cap": "round" as const },
            paint: { "line-color": "#7c3aed", "line-width": 2, "line-opacity": 0.6 },
          },
          lowestCustomLayer(map),
        )
      }
    }

    const map = mapRef.current
    if (!map) {
      const wait = setInterval(() => {
        if (mapRef.current?.isStyleLoaded()) { clearInterval(wait); apply() }
      }, 200)
      return () => clearInterval(wait)
    }
    if (map.isStyleLoaded()) apply()
    else map.once("load", apply)
  }, [showRailNetwork])

  // Bus network layer
  useEffect(() => {
    const apply = () => {
      const map = mapRef.current
      if (!map?.isStyleLoaded()) return
      if (!showBusNetwork) {
        if (map.getLayer("bus-network")) map.removeLayer("bus-network")
        if (map.getSource("bus-network")) map.removeSource("bus-network")
        return
      }
      if (!map.getSource("bus-network")) {
        map.addSource("bus-network", { type: "geojson", data: "/bus-network.geojson" })
      }
      if (!map.getLayer("bus-network")) {
        map.addLayer(
          {
            id: "bus-network",
            type: "line" as const,
            source: "bus-network",
            layout: { "line-join": "round" as const, "line-cap": "round" as const },
            paint: { "line-color": "#16a34a", "line-width": 1.5, "line-opacity": 0.5 },
          },
          lowestCustomLayer(map),
        )
      }
    }

    const map = mapRef.current
    if (!map) {
      const wait = setInterval(() => {
        if (mapRef.current?.isStyleLoaded()) { clearInterval(wait); apply() }
      }, 200)
      return () => clearInterval(wait)
    }
    if (map.isStyleLoaded()) apply()
    else map.once("load", apply)
  }, [showBusNetwork])

  // Political sites (EU + Belgian) — togglable
  useEffect(() => {
    const MARKER_R = 10

    const removeLayers = (map: any) => {
      for (const id of ["eu-sites-circles", "eu-sites-labels", "be-sites-icons"]) {
        if (map.getLayer(id)) map.removeLayer(id)
      }
      for (const id of ["eu-sites", "be-sites"]) {
        if (map.getSource(id)) map.removeSource(id)
      }
    }

    const apply = () => {
      const map = mapRef.current
      if (!map?.isStyleLoaded()) return

      if (!showPoliticalSites) { removeLayers(map); return }

      // — EU sites —
      if (!map.getSource("eu-sites")) {
        map.addSource("eu-sites", { type: "geojson", data: "/eu-sites.geojson" })
      }
      if (!map.getLayer("eu-sites-circles")) {
        map.addLayer({
          id: "eu-sites-circles",
          type: "circle",
          source: "eu-sites",
          paint: {
            "circle-radius": MARKER_R,
            "circle-color": "#003399",
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffcc00",
            "circle-opacity": 0.95,
          },
        })

        let euPopup: any = null
        const euHtml = (p: any) => `
              <div style="font-family:ui-monospace,monospace;padding:2px 0">
                <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#60a5fa;margin-bottom:6px">EU INSTITUTION</div>
                <div style="font-size:12px;font-weight:600;color:#c9d1d9;margin-bottom:4px;font-family:-apple-system,sans-serif">${escapeHtml(p.name)}</div>
                <div style="font-size:10px;color:#6e7f96;font-family:-apple-system,sans-serif">${escapeHtml(p.description)}</div>
              </div>`
        map.on("mouseenter", "eu-sites-circles", (e: any) => {
          if (!e.features?.length || !PopupCtorRef.current) return
          map.getCanvas().style.cursor = "pointer"
          if (pinnedPopupRef.current) return
          const p = e.features[0].properties
          euPopup?.remove()
          euPopup = new PopupCtorRef.current({ closeButton: false, offset: 12, maxWidth: "240px" })
            .setLngLat(e.lngLat)
            .setHTML(euHtml(p))
            .addTo(map)
        })
        map.on("mouseleave", "eu-sites-circles", () => {
          map.getCanvas().style.cursor = ""
          if (pinnedPopupRef.current) return
          euPopup?.remove()
          euPopup = null
        })
        map.on("click", "eu-sites-circles", (e: any) => {
          if (!e.features?.length || !PopupCtorRef.current) return
          clickHandledRef.current = true
          euPopup?.remove()
          euPopup = null
          pinnedPopupRef.current?.remove()
          const p = e.features[0].properties
          pinnedPopupRef.current = new PopupCtorRef.current({ closeButton: true, offset: 12, maxWidth: "240px" })
            .setLngLat(e.lngLat)
            .setHTML(euHtml(p))
            .addTo(map)
          pinnedPopupRef.current.on("close", () => { pinnedPopupRef.current = null })
        })
      }
      if (!map.getLayer("eu-sites-labels")) {
        map.addLayer({
          id: "eu-sites-labels",
          type: "symbol",
          source: "eu-sites",
          layout: {
            "text-field": "★",
            "text-size": 13,
            "text-font": ["Noto Sans Regular"],
            "text-anchor": "center",
            "text-allow-overlap": false,
            "text-ignore-placement": false,
            "text-optional": true,
          },
          paint: { "text-color": "#ffcc00" },
        })
      }

      // — Belgian political sites —
      if (!map.hasImage("belgian-flag")) {
        map.addImage("belgian-flag", makeBelgianFlagImage(MARKER_R * 2), { pixelRatio: 2 } as any)
      }
      if (!map.getSource("be-sites")) {
        map.addSource("be-sites", { type: "geojson", data: "/belgian-political-sites.geojson" })
      }
      if (!map.getLayer("be-sites-icons")) {
        map.addLayer({
          id: "be-sites-icons",
          type: "symbol",
          source: "be-sites",
          layout: {
            "icon-image": "belgian-flag",
            "icon-size": 1,
            "icon-allow-overlap": true,
          },
        })

        let bePopup: any = null
        const beHtml = (p: any) => `
              <div style="font-family:ui-monospace,monospace;padding:2px 0">
                <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#f87171;margin-bottom:6px">BELGIAN POLITICS</div>
                <div style="font-size:12px;font-weight:600;color:#c9d1d9;margin-bottom:4px;font-family:-apple-system,sans-serif">${escapeHtml(p.name)}</div>
                <div style="font-size:10px;color:#6e7f96;font-family:-apple-system,sans-serif">${escapeHtml(p.description)}</div>
              </div>`
        map.on("mouseenter", "be-sites-icons", (e: any) => {
          if (!e.features?.length || !PopupCtorRef.current) return
          map.getCanvas().style.cursor = "pointer"
          if (pinnedPopupRef.current) return
          const p = e.features[0].properties
          bePopup?.remove()
          bePopup = new PopupCtorRef.current({ closeButton: false, offset: 14, maxWidth: "240px" })
            .setLngLat(e.lngLat)
            .setHTML(beHtml(p))
            .addTo(map)
        })
        map.on("mouseleave", "be-sites-icons", () => {
          map.getCanvas().style.cursor = ""
          if (pinnedPopupRef.current) return
          bePopup?.remove()
          bePopup = null
        })
        map.on("click", "be-sites-icons", (e: any) => {
          if (!e.features?.length || !PopupCtorRef.current) return
          clickHandledRef.current = true
          bePopup?.remove()
          bePopup = null
          pinnedPopupRef.current?.remove()
          const p = e.features[0].properties
          pinnedPopupRef.current = new PopupCtorRef.current({ closeButton: true, offset: 14, maxWidth: "240px" })
            .setLngLat(e.lngLat)
            .setHTML(beHtml(p))
            .addTo(map)
          pinnedPopupRef.current.on("close", () => { pinnedPopupRef.current = null })
        })
      }
    }

    const map = mapRef.current
    if (!map) {
      const wait = setInterval(() => {
        if (mapRef.current?.isStyleLoaded()) { clearInterval(wait); apply() }
      }, 200)
      return () => clearInterval(wait)
    }
    if (map.isStyleLoaded()) apply()
    else map.once("load", apply)
  }, [showPoliticalSites])

  return <div ref={containerRef} className="flex-1" />
}

async function fetchAndRenderItems(
  map: any,
  typeColors: Record<string, string>,
  activeTab: ItemType,
  dateRange: DateRange,
  abortRef: React.MutableRefObject<AbortController | null>,
) {
  abortRef.current?.abort()
  const controller = new AbortController()
  abortRef.current = controller

  const params = new URLSearchParams()
  params.set("type", activeTab)
  params.set("limit", "500")
  const { dateFrom, dateTo } = getDateBounds(dateRange, [activeTab])
  if (dateFrom) params.set("dateFrom", dateFrom)
  if (dateTo) params.set("dateTo", dateTo)

  let res: Response
  try {
    res = await fetch(`/api/items?${params}`, { signal: controller.signal })
  } catch {
    return
  }
  if (controller.signal.aborted) return
  const data = await res.json()
  if (controller.signal.aborted) return

  const features = data
    .filter((item: any) => item.lat && item.lng)
    .map((item: any) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [item.lng, item.lat] },
      properties: { ...item },
    }))

  const geojson = { type: "FeatureCollection", features }

  if (map.getSource("items")) {
    map.getSource("items").setData(geojson)
    return
  }

  map.addSource("items", { type: "geojson", data: geojson })
  map.addLayer({
    id: "items-circles",
    type: "circle",
    source: "items",
    paint: {
      "circle-radius": 6,
      "circle-color": [
        "match",
        ["get", "type"],
        "news", typeColors.news,
        "event", typeColors.event,
        "roadwork", typeColors.roadwork,
        "#aaa",
      ],
      "circle-opacity": 0.85,
      "circle-stroke-width": 1,
      "circle-stroke-color": "#fff",
    },
  })
}

async function fetchAndRenderMetro(map: any) {
  if (!map) return
  try {
    const res = await fetch("/api/metro")
    if (!res.ok) { console.error("[metro] API error", res.status); return }
    const lines: MetroLine[] = await res.json()
    console.log("[metro] lines:", lines.map(l => `${l.id}(${l.vehicles.length}v)`).join(", "))
    renderMetroLayers(map, lines)
  } catch (e) {
    console.error("[metro] fetch/render error", e)
  }
}

function clearMetroLayers(map: any) {
  stopMetroAnimation()
  const layerIds = [
    "metro-lines-glow", "metro-lines", "metro-lines-flow",
    "metro-vehicles-pulse", "metro-vehicles", "metro-vehicle-labels",
  ]
  for (const id of layerIds) {
    if (map.getLayer(id)) map.removeLayer(id)
  }
  const sourceIds = ["metro-lines", "metro-vehicles"]
  for (const id of sourceIds) {
    if (map.getSource(id)) map.removeSource(id)
  }
}

// Returns the id of the bottom-most custom layer that should sit above bus/rail lines,
// so that network lines are always inserted below everything else we own.
const ABOVE_NETWORK_LAYERS = [
  "metro-lines-glow",
  "metro-lines",
  "metro-lines-flow",
  "eu-sites-circles",
  "eu-sites-labels",
  "be-sites-icons",
  "traffic-alerts",
  "items-circles",
  "metro-vehicles-pulse",
  "metro-vehicles",
  "metro-vehicle-labels",
]
function lowestCustomLayer(map: any): string | undefined {
  return ABOVE_NETWORK_LAYERS.find((id) => map.getLayer(id))
}

// ── Metro animation (flowing dashes along the lines + pulsing train dots) ──
// Single requestAnimationFrame loop; id kept at module scope since there's one map.
let metroAnimId: number | null = null

// Classic "marching dashes" sequence — stepping through these offsets makes the
// dashed overlay appear to flow along the track.
const METRO_DASH_SEQ: number[][] = [
  [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5],
  [3, 4, 0], [0, 0.5, 4, 2.5], [0, 1, 4, 2], [0, 1.5, 4, 1.5], [0, 2, 4, 1], [0, 2.5, 4, 0.5],
]

function startMetroAnimation(map: any) {
  if (metroAnimId != null) return // already running
  let step = -1
  const loop = (ts: number) => {
    // Stop the loop if the metro layers are gone (toggled off / map removed)
    if (!map.getLayer || !map.getLayer("metro-lines-flow")) { metroAnimId = null; return }

    // Flowing dashes
    const newStep = Math.floor((ts / 90) % METRO_DASH_SEQ.length)
    if (newStep !== step) {
      map.setPaintProperty("metro-lines-flow", "line-dasharray", METRO_DASH_SEQ[newStep])
      step = newStep
    }

    // Pulsing "sonar" ring around each train (expands + fades on a 1.6s cycle)
    if (map.getLayer("metro-vehicles-pulse")) {
      const p = (ts % 1600) / 1600
      map.setPaintProperty("metro-vehicles-pulse", "circle-radius", 7 + p * 16)
      map.setPaintProperty("metro-vehicles-pulse", "circle-stroke-opacity", 0.55 * (1 - p))
    }

    metroAnimId = requestAnimationFrame(loop)
  }
  metroAnimId = requestAnimationFrame(loop)
}

function stopMetroAnimation() {
  if (metroAnimId != null) { cancelAnimationFrame(metroAnimId); metroAnimId = null }
}

function addMetroLayersToMap(map: any) {
  // Line layers sit below the item markers; the vehicle dots sit on top.
  const lineBeforeId = map.getLayer("metro-vehicles-pulse") ? "metro-vehicles-pulse"
    : map.getLayer("items-circles") ? "items-circles"
    : undefined
  const roundLine = { "line-join": "round" as const, "line-cap": "round" as const }

  // Blurred glow underlay — gives the line a soft neon halo
  if (!map.getLayer("metro-lines-glow")) {
    map.addLayer({
      id: "metro-lines-glow",
      type: "line" as const,
      source: "metro-lines",
      layout: roundLine,
      paint: {
        "line-color": ["get", "color"] as any,
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 4, 13, 10, 16, 18] as any,
        "line-opacity": 0.22,
        "line-blur": ["interpolate", ["linear"], ["zoom"], 10, 2, 16, 6] as any,
      },
    }, lineBeforeId)
  }

  // Crisp coloured core
  if (!map.getLayer("metro-lines")) {
    map.addLayer({
      id: "metro-lines",
      type: "line" as const,
      source: "metro-lines",
      layout: roundLine,
      paint: {
        "line-color": ["get", "color"] as any,
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 2.5, 13, 5, 16, 9] as any,
        "line-opacity": 0.95,
      },
    }, lineBeforeId)
  }

  // Animated white dashes flowing along the core (dasharray driven by the RAF loop)
  if (!map.getLayer("metro-lines-flow")) {
    map.addLayer({
      id: "metro-lines-flow",
      type: "line" as const,
      source: "metro-lines",
      layout: roundLine,
      paint: {
        "line-color": "#ffffff",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.6, 13, 3, 16, 5] as any,
        "line-opacity": 0.5,
        "line-dasharray": [0, 4, 3] as any,
      },
    }, lineBeforeId)
  }

  // Expanding "sonar" pulse ring behind each train
  if (!map.getLayer("metro-vehicles-pulse")) {
    map.addLayer({
      id: "metro-vehicles-pulse",
      type: "circle",
      source: "metro-vehicles",
      paint: {
        "circle-radius": 8,
        "circle-color": ["get", "color"],
        "circle-opacity": 0,
        "circle-stroke-color": ["get", "color"],
        "circle-stroke-width": 2,
        "circle-stroke-opacity": 0.5,
      },
    })
  }

  if (!map.getLayer("metro-vehicles")) {
    map.addLayer({
      id: "metro-vehicles",
      type: "circle",
      source: "metro-vehicles",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 5, 14, 7, 16, 9] as any,
        "circle-color": ["get", "color"],
        "circle-stroke-width": 2,
        "circle-stroke-color": "#fff",
        "circle-opacity": 1,
      },
    })
  }

  if (!map.getLayer("metro-vehicle-labels")) {
    map.addLayer({
      id: "metro-vehicle-labels",
      type: "symbol",
      source: "metro-vehicles",
      layout: {
        "text-field": ["get", "lineId"],
        "text-size": 9,
        "text-font": ["Noto Sans Regular"],
        "text-anchor": "center",
        "text-allow-overlap": false,
        "text-ignore-placement": false,
        "text-optional": true,
        "text-padding": 2,
      },
      paint: { "text-color": "#fff" },
    })
  }
}

function renderMetroLayers(map: any, lines: MetroLine[]) {
  const lineFeatures = lines.map((line) => ({
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: line.stops.map((s) => [s.lng, s.lat]),
    },
    properties: { lineId: line.id, color: line.color },
  }))

  const vehicleFeatures = lines.flatMap((line) =>
    line.vehicles
      .filter((v) => v.lat != null && v.lng != null)
      .map((v) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [v.lng, v.lat] },
        properties: { lineId: line.id, color: line.color },
      }))
  )

  const linesGeojson = { type: "FeatureCollection", features: lineFeatures }
  const vehiclesGeojson = { type: "FeatureCollection", features: vehicleFeatures }

  if (map.getSource("metro-lines")) {
    map.getSource("metro-lines").setData(linesGeojson)
    map.getSource("metro-vehicles")?.setData(vehiclesGeojson)
    addMetroLayersToMap(map)
    startMetroAnimation(map)
    return
  }

  map.addSource("metro-lines", { type: "geojson", data: linesGeojson })
  map.addSource("metro-vehicles", { type: "geojson", data: vehiclesGeojson })
  addMetroLayersToMap(map)
  startMetroAnimation(map)
}

// ── Villo bike-share: rectangular count badges, coloured by availability ──
function clearVilloLayers(map: any) {
  if (map.getLayer("villo-badges")) map.removeLayer("villo-badges")
  if (map.getSource("villo")) map.removeSource("villo")
}

async function fetchAndRenderVillo(
  map: any,
  PopupCtorRef: React.MutableRefObject<any>,
  pinnedPopupRef: React.MutableRefObject<any>,
  clickHandledRef: React.MutableRefObject<boolean>,
) {
  try {
    const res = await fetch("/api/villo")
    if (!res.ok) return
    const stations: any[] = await res.json()

    const features = stations.map((s) => {
      // fraction of capacity that's available → 0–10 lit half-segments (idx=5 ⇒ 2.5 lights)
      const ratio = s.capacity > 0 ? s.bikes / s.capacity : 0
      const gaugeIdx = Math.max(0, Math.min(10, Math.round(ratio * 10)))
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [s.lng, s.lat] },
        properties: { ...s, gaugeIdx },
      }
    })
    const geojson = { type: "FeatureCollection", features }

    if (map.getSource("villo")) {
      map.getSource("villo").setData(geojson)
      return
    }

    // 11 gauge frames: villo-gauge-0 (empty) … villo-gauge-10 (full)
    for (let i = 0; i <= 10; i++) {
      const id = `villo-gauge-${i}`
      if (!map.hasImage(id)) map.addImage(id, makeVilloGaugeImage(i), { pixelRatio: 2 })
    }

    map.addSource("villo", { type: "geojson", data: geojson })
    map.addLayer({
      id: "villo-badges",
      type: "symbol",
      source: "villo",
      minzoom: 13,
      layout: {
        "icon-image": ["concat", "villo-gauge-", ["to-string", ["get", "gaugeIdx"]]] as any,
        "icon-size": 0.9,
        "icon-allow-overlap": false,
      },
    })

    const villoHtml = (p: any) => `
      <div style="font-family:ui-monospace,monospace;padding:2px 0">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#fb7185;margin-bottom:6px">🚲 VILLO STATION</div>
        <div style="font-size:12px;font-weight:600;color:#c9d1d9;margin-bottom:4px;font-family:-apple-system,sans-serif">${escapeHtml(p.name ?? "")}</div>
        <div style="font-size:11px;color:#c9d1d9;font-family:-apple-system,sans-serif">
          <b style="color:#4ade80">${p.bikes}</b> bikes · <b style="color:#60a5fa">${p.freeStands}</b> free docks
        </div>
        <div style="font-size:9px;color:#6e7f96;margin-top:2px;text-transform:uppercase;letter-spacing:.08em">${escapeHtml(p.address ?? "")} · cap ${p.capacity}</div>
      </div>`
    let villoPopup: any = null
    map.on("mouseenter", "villo-badges", (e: any) => {
      if (!e.features?.length || !PopupCtorRef.current) return
      map.getCanvas().style.cursor = "pointer"
      if (pinnedPopupRef.current) return
      villoPopup?.remove()
      villoPopup = new PopupCtorRef.current({ closeButton: false, offset: 10, maxWidth: "230px" })
        .setLngLat(e.lngLat).setHTML(villoHtml(e.features[0].properties)).addTo(map)
    })
    map.on("mouseleave", "villo-badges", () => {
      map.getCanvas().style.cursor = ""
      if (pinnedPopupRef.current) return
      villoPopup?.remove()
      villoPopup = null
    })
    map.on("click", "villo-badges", (e: any) => {
      if (!e.features?.length || !PopupCtorRef.current) return
      clickHandledRef.current = true
      villoPopup?.remove()
      villoPopup = null
      pinnedPopupRef.current?.remove()
      pinnedPopupRef.current = new PopupCtorRef.current({ closeButton: true, offset: 10, maxWidth: "230px" })
        .setLngLat(e.lngLat).setHTML(villoHtml(e.features[0].properties)).addTo(map)
      pinnedPopupRef.current.on("close", () => { pinnedPopupRef.current = null })
    })
  } catch (e) {
    console.error("[villo]", e)
  }
}

// ── Air quality (PM2.5): drifting, breathing coloured clouds over each station ──
let airAnimId: number | null = null
function startAirAnimation(map: any) {
  if (airAnimId != null) return
  const loop = (ts: number) => {
    if (!map.getLayer || !map.getLayer("air-clouds")) { airAnimId = null; return }
    const t = ts / 1000
    map.setPaintProperty("air-clouds", "icon-translate", [Math.sin(t * 0.5) * 5, Math.cos(t * 0.33) * 4])
    map.setPaintProperty("air-clouds", "icon-opacity", 0.5 + Math.sin(t * 0.8) * 0.08)
    airAnimId = requestAnimationFrame(loop)
  }
  airAnimId = requestAnimationFrame(loop)
}
function stopAirAnimation() {
  if (airAnimId != null) { cancelAnimationFrame(airAnimId); airAnimId = null }
}

function clearAirLayers(map: any) {
  stopAirAnimation()
  if (map.getLayer("air-clouds")) map.removeLayer("air-clouds")
  if (map.getSource("air")) map.removeSource("air")
}

function airQualityLabel(v: number): string {
  if (v <= 10) return "Good"
  if (v <= 20) return "Fair"
  if (v <= 25) return "Moderate"
  if (v <= 50) return "Poor"
  return "Very poor"
}

async function fetchAndRenderAir(
  map: any,
  PopupCtorRef: React.MutableRefObject<any>,
  pinnedPopupRef: React.MutableRefObject<any>,
  clickHandledRef: React.MutableRefObject<boolean>,
) {
  try {
    const res = await fetch("/api/air-quality")
    if (!res.ok) return
    const stations: any[] = await res.json()

    const features = stations.map((s) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.lng, s.lat] },
      properties: { ...s },
    }))
    const geojson = { type: "FeatureCollection", features }

    if (map.getSource("air")) {
      map.getSource("air").setData(geojson)
      startAirAnimation(map)
      return
    }

    // green = clean, grey = moderate, dark = polluted
    if (!map.hasImage("cloud-green")) map.addImage("cloud-green", makeCloudImage(60, "#4ade80"), { pixelRatio: 2 })
    if (!map.hasImage("cloud-grey")) map.addImage("cloud-grey", makeCloudImage(60, "#94a3b8"), { pixelRatio: 2 })
    if (!map.hasImage("cloud-dark")) map.addImage("cloud-dark", makeCloudImage(60, "#334155"), { pixelRatio: 2 })

    map.addSource("air", { type: "geojson", data: geojson })
    map.addLayer({
      id: "air-clouds",
      type: "symbol",
      source: "air",
      layout: {
        // ≤10 µg/m³ green, ≤25 grey, else dark
        "icon-image": ["step", ["get", "value"], "cloud-green", 10, "cloud-grey", 25, "cloud-dark"] as any,
        "icon-size": ["interpolate", ["linear"], ["zoom"], 9, 0.8, 12, 1.7, 15, 3.2] as any,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
      paint: {
        "icon-opacity": 0.5,
        "icon-translate-anchor": "viewport",
      },
    }, map.getLayer("police-icons") ? "police-icons" : undefined)

    const airHtml = (p: any) => `
      <div style="font-family:ui-monospace,monospace;padding:2px 0">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#94a3b8;margin-bottom:6px">☁ AIR QUALITY · PM2.5</div>
        <div style="font-size:12px;font-weight:600;color:#c9d1d9;margin-bottom:4px;font-family:-apple-system,sans-serif">${escapeHtml(p.name ?? "")}</div>
        <div style="font-size:11px;color:#c9d1d9;font-family:-apple-system,sans-serif">
          <b>${p.value}</b> µg/m³ · ${escapeHtml(airQualityLabel(Number(p.value)))}
        </div>
      </div>`
    let airPopup: any = null
    map.on("mouseenter", "air-clouds", (e: any) => {
      if (!e.features?.length || !PopupCtorRef.current) return
      map.getCanvas().style.cursor = "pointer"
      if (pinnedPopupRef.current) return
      airPopup?.remove()
      airPopup = new PopupCtorRef.current({ closeButton: false, offset: 8, maxWidth: "230px" })
        .setLngLat(e.lngLat).setHTML(airHtml(e.features[0].properties)).addTo(map)
    })
    map.on("mouseleave", "air-clouds", () => {
      map.getCanvas().style.cursor = ""
      if (pinnedPopupRef.current) return
      airPopup?.remove()
      airPopup = null
    })
    map.on("click", "air-clouds", (e: any) => {
      if (!e.features?.length || !PopupCtorRef.current) return
      clickHandledRef.current = true
      airPopup?.remove()
      airPopup = null
      pinnedPopupRef.current?.remove()
      pinnedPopupRef.current = new PopupCtorRef.current({ closeButton: true, offset: 8, maxWidth: "230px" })
        .setLngLat(e.lngLat).setHTML(airHtml(e.features[0].properties)).addTo(map)
      pinnedPopupRef.current.on("close", () => { pinnedPopupRef.current = null })
    })

    startAirAnimation(map)
  } catch (e) {
    console.error("[air]", e)
  }
}

function clearBikeFlowLayers(map: any) {
  for (const id of ["bike-flow-heat", "bike-flow-points", "bike-flow-labels"]) {
    if (map.getLayer(id)) map.removeLayer(id)
  }
  if (map.getSource("bike-flow")) map.removeSource("bike-flow")
}

// Hybrid render of the Brussels-Mobility bike/scooter counters:
//   • zoomed out → a smooth heat glow weighted by last-hour passages
//   • zoomed in  → labelled hotspot circles (radius + colour by count)
// The two crossfade around zoom 13–15. Count breakpoints (~0/30/80/170) come
// from the live data range (hourly counts run ~14–171).
async function fetchAndRenderBikeFlow(
  map: any,
  PopupCtorRef: React.MutableRefObject<any>,
  pinnedPopupRef: React.MutableRefObject<any>,
  clickHandledRef: React.MutableRefObject<boolean>,
) {
  try {
    const res = await fetch("/api/bike-flow")
    if (!res.ok) return
    const sensors: any[] = await res.json()

    const features = sensors.map((s) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [s.lng, s.lat] },
      properties: {
        feature: s.feature,
        address: s.address,
        commune: s.commune,
        hourCnt: s.hourCnt,
        dayCnt: s.dayCnt,
        yearCnt: s.yearCnt,
      },
    }))
    const geojson = { type: "FeatureCollection", features }

    if (map.getSource("bike-flow")) {
      map.getSource("bike-flow").setData(geojson)
      return
    }

    map.addSource("bike-flow", { type: "geojson", data: geojson })

    // Heat glow — visible when zoomed out, fades away by ~zoom 15
    map.addLayer({
      id: "bike-flow-heat",
      type: "heatmap",
      source: "bike-flow",
      maxzoom: 16,
      paint: {
        "heatmap-weight": ["interpolate", ["linear"], ["get", "hourCnt"], 0, 0, 30, 0.35, 80, 0.7, 170, 1],
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 10, 0.9, 15, 2.2],
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 10, 16, 13, 30, 15, 48],
        "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0.9, 15, 0],
        "heatmap-color": [
          "interpolate", ["linear"], ["heatmap-density"],
          0, "rgba(8,12,18,0)",
          0.15, "rgba(34,211,238,0.45)",  // cyan
          0.4, "rgba(74,222,128,0.7)",    // green
          0.7, "rgba(250,204,21,0.85)",   // yellow
          1, "rgba(239,68,68,0.95)",      // red
        ],
      },
    })

    // Hotspot circles — fade in as the heat fades out
    map.addLayer({
      id: "bike-flow-points",
      type: "circle",
      source: "bike-flow",
      paint: {
        "circle-radius": [
          "interpolate", ["linear"], ["zoom"],
          12, ["interpolate", ["linear"], ["get", "hourCnt"], 0, 3, 170, 11],
          17, ["interpolate", ["linear"], ["get", "hourCnt"], 0, 7, 170, 30],
        ],
        "circle-color": [
          "interpolate", ["linear"], ["get", "hourCnt"],
          0, "#22d3ee", 30, "#4ade80", 80, "#facc15", 170, "#ef4444",
        ],
        "circle-opacity": ["interpolate", ["linear"], ["zoom"], 13.5, 0, 15, 0.9],
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#0b0f16",
        "circle-stroke-opacity": ["interpolate", ["linear"], ["zoom"], 13.5, 0, 15, 0.9],
      },
    })

    // Count labels on the circles
    map.addLayer({
      id: "bike-flow-labels",
      type: "symbol",
      source: "bike-flow",
      minzoom: 13.5,
      layout: {
        "text-field": ["to-string", ["get", "hourCnt"]],
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 14, 9, 17, 13],
        "text-allow-overlap": false,
      },
      paint: {
        "text-color": "#ffffff",
        "text-halo-color": "#0b0f16",
        "text-halo-width": 1.4,
        "text-opacity": ["interpolate", ["linear"], ["zoom"], 14, 0, 15, 1],
      },
    })

    const bikeHtml = (p: any) => {
      const loc = [p.address, p.commune].filter(Boolean).join(" · ")
      return `
        <div style="font-family:ui-monospace,monospace;padding:2px 0">
          <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#f97316;margin-bottom:6px">🚲 BIKE / SCOOTER FLOW</div>
          <div style="font-size:12px;font-weight:600;color:#c9d1d9;margin-bottom:4px;font-family:-apple-system,sans-serif">${escapeHtml(loc || p.feature)}</div>
          <div style="font-size:11px;color:#c9d1d9;font-family:-apple-system,sans-serif">
            <b style="color:#f97316">${p.hourCnt}</b> in the last hour
          </div>
          <div style="font-size:9px;color:#6e7f96;margin-top:2px;text-transform:uppercase;letter-spacing:.08em">
            ${Number(p.dayCnt).toLocaleString()} today · ${Number(p.yearCnt).toLocaleString()} this year
          </div>
        </div>`
    }
    let bikePopup: any = null
    map.on("mouseenter", "bike-flow-points", (e: any) => {
      if (!e.features?.length || !PopupCtorRef.current) return
      map.getCanvas().style.cursor = "pointer"
      if (pinnedPopupRef.current) return
      bikePopup?.remove()
      bikePopup = new PopupCtorRef.current({ closeButton: false, offset: 12, maxWidth: "250px" })
        .setLngLat(e.lngLat).setHTML(bikeHtml(e.features[0].properties)).addTo(map)
    })
    map.on("mouseleave", "bike-flow-points", () => {
      map.getCanvas().style.cursor = ""
      if (pinnedPopupRef.current) return
      bikePopup?.remove()
      bikePopup = null
    })
    map.on("click", "bike-flow-points", (e: any) => {
      if (!e.features?.length || !PopupCtorRef.current) return
      clickHandledRef.current = true
      bikePopup?.remove()
      bikePopup = null
      pinnedPopupRef.current?.remove()
      pinnedPopupRef.current = new PopupCtorRef.current({ closeButton: true, offset: 12, maxWidth: "250px" })
        .setLngLat(e.lngLat).setHTML(bikeHtml(e.features[0].properties)).addTo(map)
      pinnedPopupRef.current.on("close", () => { pinnedPopupRef.current = null })
    })
  } catch (e) {
    console.error("[bike-flow]", e)
  }
}

async function fetchAndRenderTraffic(
  map: any,
  trafficColor: string,
  PopupCtorRef: React.MutableRefObject<any>,
  pinnedPopupRef: React.MutableRefObject<any>,
  clickHandledRef: React.MutableRefObject<boolean>,
) {
  try {
    const res = await fetch("/api/traffic")
    if (!res.ok) return
    const alerts: TrafficAlert[] = await res.json()

    const features = alerts
      .filter((a) => a.lat !== null && a.lng !== null)
      .map((a) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [a.lng!, a.lat!] },
        properties: { id: a.id, content: a.content, location: a.location, createdAt: a.createdAt },
      }))

    const geojson = { type: "FeatureCollection", features }

    if (map.getSource("traffic-alerts")) {
      map.getSource("traffic-alerts").setData(geojson)
      return
    }

    map.addSource("traffic-alerts", { type: "geojson", data: geojson })
    map.addLayer({
      id: "traffic-alerts",
      type: "circle",
      source: "traffic-alerts",
      paint: {
        "circle-radius": 10,
        "circle-color": trafficColor,
        "circle-opacity": 0.9,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#fff",
      },
    })
    map.addLayer({
      id: "traffic-alerts-labels",
      type: "symbol",
      source: "traffic-alerts",
      layout: {
        "text-field": "⚠",
        "text-size": 11,
        "text-font": ["Noto Sans Regular"],
        "text-anchor": "center",
      },
      paint: { "text-color": "#fff" },
    })

    let trafficPopup: any = null
    const trafficHtml = (p: any) => `
          <div style="font-family:ui-monospace,monospace;padding:2px 0">
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:${trafficColor};margin-bottom:6px">
              TRAFFIC · ${escapeHtml((p.location ?? "Brussels").toUpperCase())}
            </div>
            <div style="font-size:12px;color:#c9d1d9;line-height:1.5;font-family:-apple-system,sans-serif">${escapeHtml(p.content)}</div>
          </div>`
    map.on("mouseenter", "traffic-alerts", (e: any) => {
      if (!e.features?.length || !PopupCtorRef.current) return
      map.getCanvas().style.cursor = "pointer"
      if (pinnedPopupRef.current) return
      const p = e.features[0].properties
      trafficPopup?.remove()
      trafficPopup = new PopupCtorRef.current({ closeButton: false, offset: 12, maxWidth: "280px" })
        .setLngLat(e.lngLat)
        .setHTML(trafficHtml(p))
        .addTo(map)
    })
    map.on("mouseleave", "traffic-alerts", () => {
      map.getCanvas().style.cursor = ""
      if (pinnedPopupRef.current) return
      trafficPopup?.remove()
      trafficPopup = null
    })
    map.on("click", "traffic-alerts", (e: any) => {
      if (!e.features?.length || !PopupCtorRef.current) return
      clickHandledRef.current = true
      trafficPopup?.remove()
      trafficPopup = null
      pinnedPopupRef.current?.remove()
      const p = e.features[0].properties
      pinnedPopupRef.current = new PopupCtorRef.current({ closeButton: true, offset: 12, maxWidth: "280px" })
        .setLngLat(e.lngLat)
        .setHTML(trafficHtml(p))
        .addTo(map)
      pinnedPopupRef.current.on("close", () => { pinnedPopupRef.current = null })
    })
  } catch (e) {
    console.error("[traffic map]", e)
  }
}
