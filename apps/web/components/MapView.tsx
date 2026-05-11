"use client"

import { useEffect, useRef } from "react"
import type { ItemType, DateRange } from "../lib/filters"
import { getDateBounds } from "../lib/filters"

interface MetroLine {
  id: string
  color: string
  stops: { ref: string; name: string; lat: number; lng: number }[]
  vehicles: { lat: number; lng: number; direction: string }[]
}

interface Props {
  activeTypes: ItemType[]
  selectedCommune: number | null
  onSelectCommune: (id: number | null) => void
  dateRange: DateRange
  typeColors: Record<ItemType, string>
  showMetro: boolean
}

export default function MapView({ activeTypes, selectedCommune, onSelectCommune, dateRange, typeColors, showMetro }: Props) {
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
        fetchAndRenderItems(map, activeTypes, dateRange, typeColors)
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

  // Re-render civic items when filters change
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    fetchAndRenderItems(map, activeTypes, dateRange, typeColors)
  }, [activeTypes.join(","), dateRange])

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

    // Wait for map to be ready on first load
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

async function fetchAndRenderItems(
  map: any,
  activeTypes: ItemType[],
  dateRange: DateRange,
  typeColors: Record<string, string>
) {
  const params = new URLSearchParams()
  activeTypes.forEach((t) => params.append("type", t))
  params.set("limit", "200")
  const { dateFrom, dateTo } = getDateBounds(dateRange, activeTypes)
  if (dateFrom) params.set("dateFrom", dateFrom)
  if (dateTo) params.set("dateTo", dateTo)

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
  // Build line GeoJSON
  const lineFeatures = lines.map((line) => ({
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: line.stops.map((s) => [s.lng, s.lat]),
    },
    properties: { lineId: line.id, color: line.color },
  }))

  // Build vehicle GeoJSON — skip any features with missing coordinates
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

  console.log("[metro] renderMetroLayers — vehicles total:", vehicleFeatures.length, "| sources exist:", !!map.getSource("metro-lines"), !!map.getSource("metro-vehicles"), "| layers exist:", !!map.getLayer("metro-vehicles"))

  // Update existing sources if already initialised
  if (map.getSource("metro-lines")) {
    map.getSource("metro-lines").setData(linesGeojson)
    if (map.getSource("metro-vehicles")) {
      map.getSource("metro-vehicles").setData(vehiclesGeojson)
    }
    return
  }

  map.addSource("metro-lines", { type: "geojson", data: linesGeojson })
  map.addSource("metro-vehicles", { type: "geojson", data: vehiclesGeojson })

  // Each addLayer is independent — one failing must not block the others
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

  // Try to place lines below civic items; fall back to top of stack
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
