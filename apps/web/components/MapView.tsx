"use client"

import React, { useEffect, useRef } from "react"
import type { ItemType, DateRange } from "../lib/filters"
import { getDateBounds } from "../lib/filters"

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
  showBusNetwork: boolean
  showRailNetwork: boolean
  activeTab: ItemType
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
  const meta = [props.type, props.communeName].filter(Boolean).join(" · ")
  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:240px;padding:2px 4px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:${color};margin-bottom:5px">${escapeHtml(meta)}</div>
      <div style="font-size:13px;font-weight:500;line-height:1.4;color:#111;margin-bottom:3px">${escapeHtml(props.title ?? "")}</div>
      <div style="font-size:11px;color:#9ca3af">${escapeHtml(props.sourceName ?? "")}</div>
    </div>
  `
}

export default function MapView({ selectedCommune, onSelectCommune, typeColors, showMetro, showBusNetwork, showRailNetwork, activeTab, dateRange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const metroIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const itemsAbortRef = useRef<AbortController | null>(null)

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

  // Re-fetch map items when tab or date range changes
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const run = () => {
      if (map.isStyleLoaded()) fetchAndRenderItems(map, typeColors, activeTab, dateRange, itemsAbortRef)
    }

    if (map.isStyleLoaded()) {
      run()
    } else {
      map.once("load", run)
    }
  }, [activeTab, dateRange])

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
        map.addLayer({
          id: "rail-network",
          type: "line" as const,
          source: "rail-network",
          layout: { "line-join": "round" as const, "line-cap": "round" as const },
          paint: { "line-color": "#7c3aed", "line-width": 2, "line-opacity": 0.6 },
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
        map.addLayer({
          id: "bus-network",
          type: "line" as const,
          source: "bus-network",
          layout: { "line-join": "round" as const, "line-cap": "round" as const },
          paint: { "line-color": "#16a34a", "line-width": 1.5, "line-opacity": 0.5 },
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
  }, [showBusNetwork])

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
    try {
      map.addLayer(linesLayer, "items-circles")
    } catch {
      try { map.addLayer(linesLayer) } catch {}
    }
  }

  if (!map.getLayer("metro-vehicles")) {
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
  }

  if (!map.getLayer("metro-vehicle-labels")) {
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
    // Re-add any layers that may have been dropped (e.g. after a style tile reload)
    addMetroLayersToMap(map)
    return
  }

  map.addSource("metro-lines", { type: "geojson", data: linesGeojson })
  map.addSource("metro-vehicles", { type: "geojson", data: vehiclesGeojson })
  addMetroLayersToMap(map)
}
