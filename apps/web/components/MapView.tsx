"use client"

import { useEffect, useRef } from "react"
import type { ItemType } from "../app/page"

// MapLibre is loaded client-side only (no SSR)
interface Props {
  activeTypes: ItemType[]
  selectedCommune: number | null
  onSelectCommune: (id: number | null) => void
  typeColors: Record<ItemType, string>
}

export default function MapView({ activeTypes, selectedCommune, onSelectCommune, typeColors }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    let map: any

    import("maplibre-gl").then((maplibre) => {
      map = new maplibre.Map({
        container: containerRef.current!,
        // Free OSM-based style — no API key needed
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [4.3517, 50.8503], // Brussels center
        zoom: 11,
      })

      mapRef.current = map

      map.on("load", () => {
        // Fetch commune GeoJSON boundaries and add to map
        fetch("https://data.gov.be/api/3/action/datastore_search?resource_id=bf59cc60-2be4-4e00-9abc-90cc95ea0da4")
          .then((r) => r.json())
          .catch(() => null) // gracefully skip if unavailable

        // Add items as circles
        fetchAndRenderItems(map, maplibre, activeTypes, typeColors)
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

  // Re-render items when filter changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return

    import("maplibre-gl").then((maplibre) => {
      fetchAndRenderItems(map, maplibre, activeTypes, typeColors)
    })
  }, [activeTypes.join(",")])

  return <div ref={containerRef} className="flex-1" />
}

async function fetchAndRenderItems(map: any, maplibre: any, activeTypes: string[], typeColors: Record<string, string>) {
  const params = new URLSearchParams()
  activeTypes.forEach((t) => params.append("type", t))
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
