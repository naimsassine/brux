export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"

// Brussels + surrounding airspace bounding box (~60 km radius)
const BBOX = { lamin: 50.45, lomin: 3.7, lamax: 51.15, lomax: 5.0 }

// State vector array indices per OpenSky docs
const IDX = {
  icao24: 0, callsign: 1, originCountry: 2, lon: 5, lat: 6,
  baroAlt: 7, onGround: 8, velocity: 9, trueTrack: 10, verticalRate: 11, geoAlt: 13,
}

export async function GET() {
  const clientId = process.env.OPENSKY_CLIENT_ID
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.json([], { status: 500 })
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")
  const { lamin, lomin, lamax, lomax } = BBOX
  const url = `https://opensky-network.org/api/states/all?lamin=${lamin}&lomin=${lomin}&lamax=${lamax}&lomax=${lomax}`

  let data: any
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Basic ${auth}` },
      cache: "no-store",
    })
    if (!res.ok) return NextResponse.json([])
    data = await res.json()
  } catch {
    return NextResponse.json([])
  }

  const flights = (data.states ?? [])
    .filter((s: any[]) =>
      s[IDX.lon] != null &&
      s[IDX.lat] != null &&
      !s[IDX.onGround]
    )
    .map((s: any[]) => ({
      icao24: s[IDX.icao24] as string,
      callsign: ((s[IDX.callsign] as string | null) ?? "").trim(),
      originCountry: s[IDX.originCountry] as string,
      lat: s[IDX.lat] as number,
      lng: s[IDX.lon] as number,
      altitudeM: (s[IDX.baroAlt] ?? s[IDX.geoAlt] ?? 0) as number,
      velocityMs: (s[IDX.velocity] ?? 0) as number,
      heading: (s[IDX.trueTrack] ?? 0) as number,
      verticalRateMs: s[IDX.verticalRate] as number | null,
    }))

  return NextResponse.json(flights, { headers: { "Cache-Control": "no-store" } })
}
