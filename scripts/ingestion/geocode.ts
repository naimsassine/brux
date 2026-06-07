import OpenAI from "openai"
import { fetchWithRetry } from "./fetch-retry"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

async function extractLocation(title: string, summary: string | null): Promise<string | null> {
  const text = summary ? `${title}\n${summary}` : title
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You extract the most specific Brussels location from a news headline and summary.
Return ONLY the place name (street, landmark, neighborhood, building, etc.) in its original language.
If the article has no specific location within Brussels, return the word: none`,
      },
      { role: "user", content: text },
    ],
    temperature: 0,
    max_tokens: 30,
  })
  const result = response.choices[0].message.content?.trim() ?? "none"
  return result.toLowerCase() === "none" ? null : result
}

async function nominatimGeocode(location: string): Promise<{ lat: number; lng: number } | null> {
  const query = encodeURIComponent(`${location}, Brussels, Belgium`)
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=be`
  // Nominatim enforces 1 req/s — wait 1s before each call to stay compliant
  await new Promise((r) => setTimeout(r, 1000))
  const res = await fetchWithRetry(url, {
    headers: { "User-Agent": "Brux-Dashboard/1.0 (civic data aggregator)" },
  })
  if (!res.ok) return null
  const data = await res.json()
  if (!data[0]) return null
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }
}

export async function extractAndGeocodeLocation(
  title: string,
  summary: string | null,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const location = await extractLocation(title, summary)
    if (!location) return null
    return await nominatimGeocode(location)
  } catch {
    return null
  }
}
