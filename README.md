# BRUX 2.0

A live **situational-awareness dashboard for Brussels** — a dark, ops-center style map + feed that pulls together news, events, roadworks, traffic, public transport, and a growing set of real-time city sensors into one screen.

> 2.0 is a big visual and data upgrade: a bespoke map style, animated transit, six new city datasets, and three new live-sensor layers.

---

## ✨ What's new in 2.0

### 🗺️ A bespoke base map ("Navigator")
The base map is no longer a stock style — it's a **hand-written MapLibre style** tuned for Brussels, built on the same free OpenFreeMap vector tiles (no API key, no new dependency). It gives the map Google-Maps-style legibility on a dark canvas:

- **Green parks & woods**, **blue water**, and a subtle warm tint on built-up blocks
- A real **road hierarchy** — thin minor streets → fat primaries → **amber motorways**, each with a darker "casing" outline so big roads pop
- Bright, readable labels that sit cleanly over the dark field

The style system is **palette-driven**: `apps/web/lib/mapStyle.ts` defines five looks — `navigator` (default), `blueprint` (cyan HUD), `darkMatter`, `bruxNoir`, and `positron` — switchable with a single `ACTIVE` constant.

### 🚇 Animated metro
Metro lines got a glow-up: a **soft neon glow underlay**, a crisp colored core, and **white dashes that flow along the track** for a live sense of movement. Live train positions are shown as **pulsing "sonar" dots**. All driven by one `requestAnimationFrame` loop with proper cleanup.

### 📍 New static datasets (always-on markers)
Six City-of-Brussels open datasets, served as static GeoJSON from `apps/web/public/` and rendered as custom canvas icons with hover/click popups:

| Layer | Icon | Count |
|---|---|---|
| 💧 Drinking-water fountains | azure droplet | 48 |
| 🅿 Public parkings | blue "P" square | 28 |
| ♺ Glass recycling banks | green bottle | 1035¹ |
| 🚻 Public toilets | violet "WC" | 22 |

¹ shown from zoom 13 so the 1000+ pins don't carpet the city. (These join the existing police stations, hospitals, and EU / Belgian political sites.)

### 📡 New live-sensor layers (real-time APIs)
Three new toggleable layers backed by the **Brussels Open Data** platform (Opendatasoft), each proxied through a Next.js API route (CORS-safe, edge-cacheable) and polled client-side:

| Layer | What it shows | Source route | Refresh |
|---|---|---|---|
| **BIKE FLOW** | Bike/scooter passages — a **hybrid heatmap** (smooth glow when zoomed out → labeled hotspot circles up close), weighted by last-hour count | `/api/bike-flow` | hourly |
| **VILLO** | Villo bike-share availability as a **5-light gauge** that fills by `bikes ÷ capacity` (red → amber → green) | `/api/villo` | 60 s |
| **AIR PM2.5** | Fine-particulate air quality as **drifting, breathing clouds** (green = clean → grey → dark), semi-transparent over each station | `/api/air-quality` | 10 min |

### 🧹 Removed
The **Flights** (OpenSky) layer was retired.

---

## 🏗️ Architecture

A **Turborepo** monorepo:

```
brux/
├── apps/web/          → Next.js 14 (App Router) — UI + API routes
├── packages/db/       → Drizzle ORM + Postgres/PostGIS schema
├── scripts/ingestion/ → tsx scripts that populate the DB (news, events, roadworks)
└── docker-compose.yml → local PostGIS database
```

Data reaches the map two ways:

1. **Batch-ingested → Postgres** (news, events, roadworks). Ingestion scripts fetch/translate/geocode and upsert into a single polymorphic `items` table; the UI reads it via `/api/items`.
2. **Live-proxied → fetched per request** (traffic, metro, bike-flow, villo, air-quality, roadworks, webcams). A Next.js API route fetches the upstream source, normalizes it, and returns JSON with a CDN `Cache-Control` header — so many visitors share one cached response instead of each hammering the upstream API. No background job required.

The map itself is one client component (`apps/web/components/MapView.tsx`) that lazy-loads MapLibre GL JS and layers everything on top as GeoJSON sources — static files for the always-on POIs, live API fetches for the sensor layers.

---

## 🧰 Tech stack

- **Next.js 14** (App Router, React 18) · **TypeScript**
- **MapLibre GL JS** + **OpenFreeMap** vector tiles (custom style)
- **Tailwind CSS** (dark ops-center theme)
- **Drizzle ORM** + **Postgres / PostGIS** (Neon in production)
- **Turborepo** · deployed on **Vercel**

---

## 🚀 Running locally

```bash
# 1. Start the database (PostGIS)
docker compose up -d

# 2. Configure env
cp .env.example .env          # set DATABASE_URL and any API keys

# 3. Install & migrate
npm install
npm run db:migrate

# 4. (optional) Populate the DB with news / events / roadworks
npm run ingest:news
npm run ingest:events
npm run ingest:roadworks

# 5. Run the app
npm run dev                   # http://localhost:3000
```

> The live-sensor and static-POI layers work without the database or any ingestion — they read directly from public files and public APIs.

---

## 🗂️ Project structure

```
apps/web/
├── app/
│   ├── page.tsx                  # dashboard shell + filter state
│   └── api/                      # traffic · metro · roadworks · alerts · webcam
│       ├── bike-flow/            # NEW — bike/scooter flow sensors
│       ├── villo/                # NEW — Villo bike-share availability
│       └── air-quality/          # NEW — PM2.5 air quality
├── components/
│   ├── MapView.tsx               # MapLibre map + all overlay layers & animations
│   ├── FilterBar.tsx             # feed tabs + layer toggles
│   ├── Feed.tsx · Webcam.tsx · WeatherWidget.tsx …
├── lib/
│   └── mapStyle.ts               # NEW — palette-driven custom base-map styles
└── public/                       # static GeoJSON overlays
    ├── water-fountains.geojson   # NEW
    ├── parkings.geojson          # NEW
    ├── glass-banks.geojson       # NEW
    ├── toilets.geojson           # NEW
    └── police-stations · hospitals · eu-sites · bus-network · rail-network …
```

---

## 📊 Data sources

- **Brussels Open Data** (opendata.bruxelles.be, Opendatasoft) — fountains, parkings, glass banks, toilets, bike/scooter flow, Villo, PM2.5 air quality
- **Brussels Mobility** — live traffic timeline & roadworks
- **STIB/MIVB** — metro lines & vehicles
- **OpenFreeMap / OpenStreetMap** — base-map vector tiles
- News/events — regional RSS feeds & Visit Brussels

_City data © their respective providers · base map © OpenStreetMap contributors._
