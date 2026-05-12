"use client"

import { useEffect, useRef } from "react"
import type { ItemType } from "../lib/filters"

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
  showMetro: boolean
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
  const meta = [props.type, props.communeName].filter(Boolean).join(" · ")
  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:240px;padding:2px 4px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:${color};margin-bottom:5px">${escapeHtml(meta)}</div>
      <div style="font-size:13px;font-weight:500;line-height:1.4;color:#111;margin-bottom:3px">${escapeHtml(props.title ?? "")}</div>
      <div style="font-size:11px;color:#9ca3af">${escapeHtml(props.sourceName ?? "")}</div>
    </div>
  `
}

export default function MapView({ selectedCommune, onSelectCommune, typeColors, showMetro }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const metroIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    let map: any

    import("maplibre-gl").then((maplibre) => {
      map = new maplibre.Map({
        container: containerRef.current!,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [4.3517, 50.8503],
        zoom: 11,
      })

      mapRef.current = map

      map.on("load", () => {
        fetchAndRenderItems(map, typeColors)

        // Hover popup
        let activePopup: any = null

        map.on("mouseenter", "items-circles", (e: any) => {
          if (!e.features?.length) return
          map.getCanvas().style.cursor = "pointer"
          const props = e.features[0].properties
          activePopup?.remove()
          activePopup = new maplibre.Popup({ closeButton: false, offset: 8, maxWidth: "280px" })
            .setLngLat(e.lngLat)
            .setHTML(buildPopupHtml(props, typeColors))
            .addTo(map)
        })

        map.on("mouseleave", "items-circles", () => {
          map.getCanvas().style.cursor = ""
          activePopup?.remove()
          activePopup = null
        })
      })

      map.on("click", "commune-fill", (e: any) => {
        const communeId = e.features?.[0]?.properties?.id
        if (communeId) onSelectCommune(Number(communeId))
      })
    })

    return () => {
      map?.remove()
      mapRef.current = null
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
      return
    }

    run()
    metroIntervalRef.current = setInterval(run, 15000)

    return () => {
      if (metroIntervalRef.current) clearInterval(metroIntervalRef.current)
    }
  }, [showMetro])

  return <div ref={containerRef} className="flex-1" />
}

async function fetchAndRenderItems(map: any, typeColors: Record<string, string>) {
  const params = new URLSearchParams()
  params.set("limit", "200")

  const res = await fetch(`/api/items?${params}`)
  const data = await res.json()

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
    if (map.getSource("metro-vehicles")) {
      map.getSource("metro-vehicles").setData(vehiclesGeojson)
    }
    return
  }

  map.addSource("metro-lines", { type: "geojson", data: linesGeojson })
  map.addSource("metro-vehicles", { type: "geojson", data: vehiclesGeojson })

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

  try {
    map.addLayer(linesLayer, "items-circles")
  } catch {
    try { map.addLayer(linesLayer) } catch {}
  }

  try {
    map.addLayer({
      id: "metro-vehicles",
      type: "circle",
      source: "metro-vehicles",
      paint: {
        "circle-radius": 9,
        "circle-color": ["get", "color"],
        "circle-stroke-width": 2,
        "circle-stroke-color": "#fff",
        "circle-opacity": 1,
      },
    })
  } catch {}

  try {
    map.addLayer({
      id: "metro-vehicle-labels",
      type: "symbol",
      source: "metro-vehicles",
      layout: {
        "text-field": ["get", "lineId"],
        "text-size": 9,
        "text-font": ["Noto Sans Regular"],
        "text-anchor": "center",
      },
      paint: { "text-color": "#fff" },
    })
  } catch {}
}
