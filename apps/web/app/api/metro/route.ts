import { NextResponse } from "next/server"

const METRO_LINES = ["1", "2", "5", "6"]
const DIRECTIONS = ["TERMINAL_A", "TERMINAL_B"] as const
const STIB_BASE = "https://api.stib-mivb.be/b2c/api"
const SUBSCRIPTION_KEY = process.env.STIB_SUBSCRIPTION_KEY!

const STIB_HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/json",
  "Ocp-Apim-Subscription-Key": SUBSCRIPTION_KEY,
  Origin: "https://www.stib-mivb.be",
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
}

// Module-level token cache — survives across requests in the same process
let cachedToken: string | null = null
let tokenExpiresAt = 0

async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) return cachedToken

  const res = await fetch(`${STIB_BASE}/authentication/device/`, {
    headers: STIB_HEADERS,
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`STIB auth failed: ${res.status}`)

  const data = await res.json()
  cachedToken = data.TOKEN
  tokenExpiresAt = Date.now() + (data.EXPIRES_IN ?? 3600) * 1000
  return cachedToken!
}

interface StibStop {
  REFERENCE: string
  NAME: string
  LATLNG: { LAT: number; LNG: number }
}

interface StibVehicle {
  REFERENCE: string
  RELATIVE_POSITION: number
}

interface StibResponse {
  LINE: {
    LINE_ID: string
    BACK_COLOR: string
    STOPS: StibStop[]
    POSITION_VEHICLE: StibVehicle[] | null
  }
}

async function fetchLine(token: string, lineId: string, direction: string): Promise<StibResponse | null> {
  try {
    const res = await fetch(
      `${STIB_BASE}/network/line/v3/${lineId}?direction=${direction}&language=fr&app_language=fr`,
      {
        method: "POST",
        headers: { ...STIB_HEADERS, Authorization: token },
        body: "{}",
        cache: "no-store",
      }
    )
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function GET() {
  let token: string
  try {
    token = await getToken()
  } catch (e) {
    return NextResponse.json({ error: "Failed to authenticate with STIB" }, { status: 502 })
  }

  const fetches = await Promise.allSettled(
    METRO_LINES.flatMap((lineId) =>
      DIRECTIONS.map((dir) =>
        fetchLine(token, lineId, dir).then((data) => ({ lineId, dir, data }))
      )
    )
  )

  const lines: Record<string, {
    id: string
    color: string
    stops: { ref: string; name: string; lat: number; lng: number }[]
    vehicles: { lat: number; lng: number; direction: string }[]
  }> = {}

  for (const result of fetches) {
    if (result.status !== "fulfilled" || !result.value.data) continue
    const { lineId, dir, data } = result.value
    const raw = data.LINE

    if (!lines[lineId]) {
      lines[lineId] = {
        id: lineId,
        color: raw.BACK_COLOR,
        stops: raw.STOPS
          .filter((s) => s.LATLNG?.LAT != null && s.LATLNG?.LNG != null)
          .map((s) => ({
            ref: s.REFERENCE,
            name: s.NAME,
            lat: s.LATLNG.LAT,
            lng: s.LATLNG.LNG,
          })),
        vehicles: [],
      }
    }

    const stopsByRef = Object.fromEntries(
      raw.STOPS
        .filter((s) => s.LATLNG?.LAT != null && s.LATLNG?.LNG != null)
        .map((s, i) => [s.REFERENCE, { idx: i, lat: s.LATLNG.LAT, lng: s.LATLNG.LNG }])
    )

    for (const v of raw.POSITION_VEHICLE ?? []) {
      const entry = stopsByRef[v.REFERENCE]
      if (!entry) continue

      let lat = entry.lat
      let lng = entry.lng

      if (v.RELATIVE_POSITION === -1 && entry.idx > 0) {
        const prev = raw.STOPS[entry.idx - 1]
        if (prev.LATLNG?.LAT == null || prev.LATLNG?.LNG == null) continue
        lat = (entry.lat + prev.LATLNG.LAT) / 2
        lng = (entry.lng + prev.LATLNG.LNG) / 2
      }

      lines[lineId].vehicles.push({ lat, lng, direction: dir })
    }
  }

  return NextResponse.json(Object.values(lines), {
    headers: { "Cache-Control": "no-store" },
  })
}
