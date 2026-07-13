export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"

// Opendatasoft "Explore v2.1" — real-time Villo bike-share availability (RBC).
// ~345 stations; the API caps `limit` at 100, so we page through it.
const DATASET = "disponibilite-en-temps-reel-des-velos-villo-rbc"
const BASE =
  `https://opendata.bruxelles.be/api/explore/v2.1/catalog/datasets/${DATASET}/records`

export interface VilloStation {
  number: string
  name: string
  address: string | null
  commune: string | null
  bikes: number // bikes available to take
  freeStands: number // empty docks
  capacity: number // total docks
  lat: number
  lng: number
}

function normalize(r: any): VilloStation | null {
  if (r?.geo_point_2d?.lat == null || r?.geo_point_2d?.lon == null) return null
  return {
    number: r.number,
    name: r.name_fr ?? r.name_nl ?? r.number,
    address: r.address_fr ?? null,
    commune: r.mu_fr ?? null,
    bikes: Number(r.available_bikes ?? 0),
    freeStands: Number(r.available_bike_stands ?? 0),
    capacity: Number(r.bike_stands ?? 0),
    lat: r.geo_point_2d.lat,
    lng: r.geo_point_2d.lon,
  }
}

export async function GET() {
  try {
    // First page tells us the total so we can fan out the rest in parallel.
    const first = await fetch(`${BASE}?limit=100&offset=0`, { cache: "no-store" })
    if (!first.ok) return NextResponse.json([], { status: 502 })
    const firstData = await first.json()
    const total = Math.min(firstData.total_count ?? 0, 600) // safety cap

    const offsets: number[] = []
    for (let o = 100; o < total; o += 100) offsets.push(o)
    const rest = await Promise.all(
      offsets.map((o) =>
        fetch(`${BASE}?limit=100&offset=${o}`, { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : { results: [] }))
          .catch(() => ({ results: [] })),
      ),
    )

    const stations = [firstData, ...rest]
      .flatMap((d: any) => d.results ?? [])
      .map(normalize)
      .filter(Boolean)

    return NextResponse.json(stations, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" },
    })
  } catch {
    return NextResponse.json([], { status: 502 })
  }
}
