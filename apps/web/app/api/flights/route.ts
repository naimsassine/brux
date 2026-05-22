export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"

// ~50 NM radius around Brussels centre covers all approach/departure corridors
const API_URL = "https://api.adsb.lol/v2/point/50.8503/4.3517/50"

export interface Flight {
  icao24: string
  callsign: string | null
  registration: string | null
  type: string | null
  lat: number
  lng: number
  altitude: number | null  // feet
  speed: number | null     // knots
  heading: number | null   // degrees, clockwise from north
  verticalRate: number | null  // ft/min
}

export async function GET() {
  try {
    const res = await fetch(API_URL, {
      headers: {
        Accept: "application/json",
        "User-Agent": "brux-dashboard/1.0",
      },
      cache: "no-store",
    })
    if (!res.ok) {
      console.error("[flights] upstream error", res.status)
      return NextResponse.json({ error: "upstream failed" }, { status: 502 })
    }

    const data = await res.json()
    const ac: any[] = data.ac ?? []

    const flights: Flight[] = ac
      .filter((a) => a.lat != null && a.lon != null && a.alt_baro !== "ground" && (typeof a.alt_baro === "number" ? a.alt_baro : 0) > 500)
      .map((a) => ({
        icao24: a.hex,
        callsign: (a.flight ?? "").trim() || null,
        registration: a.r ?? null,
        type: a.t ?? null,
        lat: a.lat,
        lng: a.lon,
        altitude: typeof a.alt_baro === "number" ? a.alt_baro : null,
        speed: a.gs ?? null,
        heading: a.track ?? null,
        verticalRate: a.baro_rate ?? null,
      }))

    console.log(`[flights] ${flights.length} airborne aircraft`)

    return NextResponse.json(flights, {
      headers: { "Cache-Control": "s-maxage=30, stale-while-revalidate=15" },
    })
  } catch (e) {
    console.error("[flights]", e)
    return NextResponse.json({ error: "internal error" }, { status: 500 })
  }
}
