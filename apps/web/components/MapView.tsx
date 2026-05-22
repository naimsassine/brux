"use client"

import React, { useEffect, useRef } from "react"
import type { ItemType, TabType, DateRange } from "../lib/filters"
import { getDateBounds } from "../lib/filters"
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

export default function MapView({ selectedCommune, onSelectCommune, typeColors, trafficColor, showMetro, showBusNetwork, showRailNetwork, showPoliticalSites, activeTab, dateRange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const metroIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
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
        style: "https://tiles.openfreemap.org/styles/liberty",
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
          metroIntervalRef.current = setInterval(() => fetchAndRenderMetro(mapRef.current), 15000)
        }
      }, 200)
      return () => clearInterval(wait)
    }

    run()
    metroIntervalRef.current = setInterval(run, 15000)

    return () => {
      if (metroIntervalRef.current) clearInterval(metroIntervalRef.current)
    }
  }, [showMetro])

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
  const layerIds = ["metro-lines", "metro-vehicles", "metro-vehicle-labels"]
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
  "metro-lines",
  "eu-sites-circles",
  "eu-sites-labels",
  "be-sites-icons",
  "traffic-alerts",
  "items-circles",
  "metro-vehicles",
  "metro-vehicle-labels",
]
function lowestCustomLayer(map: any): string | undefined {
  return ABOVE_NETWORK_LAYERS.find((id) => map.getLayer(id))
}

function addMetroLayersToMap(map: any) {
  if (!map.getLayer("metro-lines")) {
    const linesLayer = {
      id: "metro-lines",
      type: "line" as const,
      source: "metro-lines",
      layout: { "line-join": "round" as const, "line-cap": "round" as const },
      paint: {
        "line-color": ["get", "color"] as any,
        "line-width": 4,
        "line-opacity": 0.85,
      },
    }
    // Always insert below vehicles — even if vehicles already exist (e.g. after a re-add)
    const beforeId = map.getLayer("metro-vehicles") ? "metro-vehicles"
      : map.getLayer("items-circles") ? "items-circles"
      : undefined
    map.addLayer(linesLayer, beforeId)
  }

  if (!map.getLayer("metro-vehicles")) {
    map.addLayer({
      id: "metro-vehicles",
      type: "circle",
      source: "metro-vehicles",
      paint: {
        "circle-radius": 10,
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
    return
  }

  map.addSource("metro-lines", { type: "geojson", data: linesGeojson })
  map.addSource("metro-vehicles", { type: "geojson", data: vehiclesGeojson })
  addMetroLayersToMap(map)
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
