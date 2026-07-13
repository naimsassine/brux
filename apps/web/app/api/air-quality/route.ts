export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"

// Opendatasoft "Explore v2.1" — hourly PM2.5 fine-particulate concentration (RBC).
// The dataset is an hourly time-series for ~6 monitoring stations, so we sort by
// timestamp desc and keep the latest reading per station.
const DATASET = "real-time-air-quality-pm25-fine-particulate-matter"
const URL =
  `https://opendata.bruxelles.be/api/explore/v2.1/catalog/datasets/${DATASET}/records?limit=100&order_by=timestamp%20desc`

export interface AirStation {
  code: string
  name: string
  commune: string | null
  value: number // PM2.5 µg/m³ (hourly mean)
  timestamp: string | null
  lat: number
  lng: number
}

export async function GET() {
  try {
    const res = await fetch(URL, { cache: "no-store" })
    if (!res.ok) return NextResponse.json([], { status: 502 })
    const data = await res.json()

    const latestByStation = new Map<string, AirStation>()
    for (const r of data.results ?? []) {
      if (r?.geo_point?.lat == null || r?.geo_point?.lon == null) continue
      const code = r.ab_eoi_code ?? r.device_id
      if (latestByStation.has(code)) continue // results are already newest-first
      latestByStation.set(code, {
        code,
        name: r.ab_name ?? code,
        commune: r.nom_commune ?? null,
        value: Number(r.value ?? 0),
        timestamp: r.timestamp ?? null,
        lat: r.geo_point.lat,
        lng: r.geo_point.lon,
      })
    }

    return NextResponse.json([...latestByStation.values()], {
      headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=300" },
    })
  } catch {
    return NextResponse.json([], { status: 502 })
  }
}
