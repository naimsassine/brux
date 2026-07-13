export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"

// Opendatasoft "Explore v2.1" dataset — live bike/scooter counter sensors
// managed by Brussels Mobility. ~17 fixed sensors, no API key required.
const DATASET =
  "flux-velos-et-trottinettes-en-temps-reel-capteurs-geres-par-bruxelles-mobilite"
const SOURCE_URL =
  `https://opendata.bruxelles.be/api/explore/v2.1/catalog/datasets/${DATASET}/records?limit=100`

export interface BikeSensor {
  feature: string
  lat: number
  lng: number
  address: string | null
  commune: string | null
  hourCnt: number // passages in the last hour (the "live pulse")
  dayCnt: number // passages so far today
  yearCnt: number // passages so far this year
  lastCountAt: string | null // timestamp of the last measurement
}

export async function GET() {
  try {
    const res = await fetch(SOURCE_URL, { cache: "no-store" })
    if (!res.ok) return NextResponse.json([], { status: 502 })
    const data = await res.json()

    const sensors: BikeSensor[] = (data.results ?? [])
      .filter((r: any) => r?.geo_point_2d?.lat != null && r?.geo_point_2d?.lon != null)
      .map((r: any) => ({
        feature: r.feature ?? r.id,
        lat: r.geo_point_2d.lat,
        lng: r.geo_point_2d.lon,
        address: r.adresse_fr ?? null,
        commune: r.commune ?? null,
        hourCnt: Number(r.data_hour_cnt ?? 0),
        dayCnt: Number(r.data_day_cnt ?? 0),
        yearCnt: Number(r.data_year_cnt ?? 0),
        lastCountAt: r.data_cnt_time ?? null,
      }))

    return NextResponse.json(sensors, {
      headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=60" },
    })
  } catch {
    return NextResponse.json([], { status: 502 })
  }
}
