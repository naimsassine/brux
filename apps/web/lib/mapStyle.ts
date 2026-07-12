/**
 * BRUX base-map styles — hand-written against the OpenMapTiles vector schema
 * served by OpenFreeMap, so every variant reuses the exact same tiles + glyphs
 * the app already loaded (no key, no new dependency). Only the base map
 * (streets / water / buildings / labels) is styled here — all BRUX overlay
 * layers are added on top at runtime.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  To switch the look, change ACTIVE below to one of:                       │
 * │    "blueprint" | "darkMatter" | "bruxNoir" | "positron" | "navigator"     │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

const ACTIVE: PaletteName = "navigator"

// ───────────────────────────────────────────────────────────────────────────

type PaletteName = "blueprint" | "darkMatter" | "bruxNoir" | "positron" | "navigator"

interface Palette {
  bg: string
  water: string
  waterway: string
  land: string
  building: string
  buildingLine: string
  boundary: string
  minor: string
  secondary: string
  primary: string
  motorway: string
  rail: string
  placeMajor: string
  placeMinor: string
  road: string
  waterLabel: string
  halo: string
  // stylistic flags
  glow: boolean // blurred glow underlay beneath motorways
  uppercaseLabels: boolean // uppercase + wide tracking (HUD feel)
  dashedRail: boolean
  dashedBoundary: boolean
  buildingOutline: boolean // true = hollow wireframe, false = flat fill

  // ── optional richer fields (Google-Maps-style legibility) ──
  parkFill?: string // green for wood / parks
  grassFill?: string // lighter green for grass / meadow
  residentialFill?: string // subtle built-up-area tint
  casings?: boolean // draw a darker outline beneath each road (road hierarchy pop)
  casingMinor?: string
  casingMain?: string // secondary / primary casing
  casingMotorway?: string
}

const PALETTES: Record<PaletteName, Palette> = {
  // ── Deep navy + cyan sci-fi HUD (the one you liked first) ──
  blueprint: {
    bg: "#06111c", water: "#0a2233", waterway: "#123b52", land: "#081724",
    building: "#0b1e2c", buildingLine: "#153c50", boundary: "#2c6480",
    minor: "#173d50", secondary: "#1f5a73", primary: "#2b7d9e", motorway: "#38bdf8",
    rail: "#1c4257",
    placeMajor: "#9bdcef", placeMinor: "#5fa8c2", road: "#4d8ba3",
    waterLabel: "#3f8aa6", halo: "#04101a",
    glow: true, uppercaseLabels: true, dashedRail: true, dashedBoundary: true,
    buildingOutline: true,
  },

  // ── Neutral near-black, restrained greys (CARTO "Dark Matter" vibe) ──
  darkMatter: {
    bg: "#12151a", water: "#0c0e12", waterway: "#1a2733", land: "#171a1f",
    building: "#1b1f26", buildingLine: "#232830", boundary: "#3a4048",
    minor: "#262b33", secondary: "#333a44", primary: "#495260", motorway: "#6d7885",
    rail: "#2a3038",
    placeMajor: "#c2cad4", placeMinor: "#7d8794", road: "#5a636e",
    waterLabel: "#4a5560", halo: "#05070a",
    glow: false, uppercaseLabels: false, dashedRail: false, dashedBoundary: true,
    buildingOutline: false,
  },

  // ── Seamless with the app chrome: exact bg + brand blues, muted (no cyan pop) ──
  bruxNoir: {
    bg: "#080c12", water: "#0b131d", waterway: "#16283a", land: "#0a0f16",
    building: "#0d141d", buildingLine: "#1c2a3a", boundary: "#243044",
    minor: "#16202e", secondary: "#1c2a3a", primary: "#2b4058", motorway: "#3d5573",
    rail: "#1c2a3a",
    placeMajor: "#8ba0b8", placeMinor: "#6e7f96", road: "#4a5a6e",
    waterLabel: "#3d4f64", halo: "#04070c",
    glow: false, uppercaseLabels: true, dashedRail: false, dashedBoundary: true,
    buildingOutline: true,
  },

  // ── Airy light-grey minimal (CARTO "Positron" vibe) ──
  positron: {
    bg: "#f5f6f7", water: "#c9dce8", waterway: "#9dbcd0", land: "#ecefe9",
    building: "#e4e6e3", buildingLine: "#d0d3ce", boundary: "#bfc3c0",
    minor: "#e6e8ea", secondary: "#d6d9dc", primary: "#c2c6cb", motorway: "#adb3ba",
    rail: "#c0c4c8",
    placeMajor: "#3a4048", placeMinor: "#6a7078", road: "#7a8088",
    waterLabel: "#5a7a90", halo: "#ffffff",
    glow: false, uppercaseLabels: false, dashedRail: false, dashedBoundary: true,
    buildingOutline: true,
  },

  // ── Dark, but colourful & legible like Google Maps: green parks, blue water,
  //    a real road hierarchy with casings, amber motorways. ──
  navigator: {
    bg: "#1b2230", // dark slate land
    water: "#17516f", // real blue water
    waterway: "#1d5f80",
    land: "#1b2230",
    building: "#28313f", buildingLine: "#323d4d", boundary: "#4a5568",
    // road *fills* (centre), casings add the outline
    minor: "#3b4556", secondary: "#4c5768", primary: "#5d6a7e", motorway: "#e0a94f",
    rail: "#39424f",
    placeMajor: "#eaeef4", placeMinor: "#aeb8c6", road: "#8b96a6",
    waterLabel: "#79aecb", halo: "#0d1119",
    glow: false, uppercaseLabels: false, dashedRail: false, dashedBoundary: true,
    buildingOutline: false,
    // richer fields
    parkFill: "#1f3a2c", // dark green woods / parks
    grassFill: "#244430", // slightly brighter green
    residentialFill: "#212a3a", // built-up areas a touch lighter than open land
    casings: true,
    casingMinor: "#252d3a",
    casingMain: "#2b3543",
    casingMotorway: "#7a5a22",
  },
}

// ───────────────────────────────────────────────────────────────────────────

const OFM_TILES = "https://tiles.openfreemap.org/planet"
const OFM_GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf"

// Zoom-interpolated line widths (thin when zoomed out, fat when zoomed in)
const w = (stops: [number, number][]) =>
  ["interpolate", ["linear"], ["zoom"], ...stops.flat()] as any

const NAME = ["coalesce", ["get", "name:en"], ["get", "name:latin"], ["get", "name"]] as any
const NOT_TUNNEL = ["match", ["get", "brunnel"], ["bridge", "tunnel"], false, true] as any

// Road tiers: fill width + a slightly wider casing width beneath it.
const ROAD_TIERS = [
  {
    id: "minor",
    classes: ["minor", "service", "track", "path", "pedestrian"],
    fillW: w([[13, 0.3], [16, 1.2], [20, 6]]),
    caseW: w([[14, 1.0], [16, 2.4], [20, 8]]),
    minzoom: 13,
  },
  {
    id: "secondary-tertiary",
    classes: ["secondary", "tertiary", "street"],
    fillW: w([[10, 0.4], [14, 1.6], [18, 9]]),
    caseW: w([[11, 1.2], [14, 2.9], [18, 12]]),
    minzoom: 0,
    casingKey: "casingMain" as const,
    colorKey: "secondary" as const,
  },
  {
    id: "primary",
    classes: ["primary", "trunk"],
    fillW: w([[8, 0.5], [12, 1.4], [14, 3], [18, 13]]),
    caseW: w([[8, 1.3], [12, 2.8], [14, 4.6], [18, 16]]),
    minzoom: 0,
    casingKey: "casingMain" as const,
    colorKey: "primary" as const,
  },
  {
    id: "motorway",
    classes: ["motorway"],
    fillW: w([[5, 0.5], [10, 1.6], [14, 4], [18, 16]]),
    caseW: w([[6, 1.3], [10, 3.2], [14, 6], [18, 20]]),
    minzoom: 0,
    casingKey: "casingMotorway" as const,
    colorKey: "motorway" as const,
  },
] as const

function makeStyle(C: Palette): any {
  const roundCap = { "line-cap": "round", "line-join": "round" }
  const labelCase = C.uppercaseLabels ? { "text-transform": "uppercase" } : {}
  const roadFilter = (classes: readonly string[]) =>
    ["all", NOT_TUNNEL, ["match", ["get", "class"], [...classes], true, false]]

  // ── Land / green / water ──
  const landLayers: any[] = [
    { id: "background", type: "background", paint: { "background-color": C.bg } },
    ...(C.residentialFill ? [{
      id: "landuse-residential", type: "fill", source: "openmaptiles", "source-layer": "landuse",
      filter: ["match", ["get", "class"], ["residential", "commercial", "industrial"], true, false],
      paint: { "fill-color": C.residentialFill },
    }] : []),
    {
      id: "water", type: "fill", source: "openmaptiles", "source-layer": "water",
      filter: ["!=", ["get", "brunnel"], "tunnel"],
      paint: { "fill-color": C.water },
    },
    {
      id: "landcover-wood", type: "fill", source: "openmaptiles", "source-layer": "landcover",
      filter: ["==", ["get", "class"], "wood"],
      paint: { "fill-color": C.parkFill ?? C.land, "fill-opacity": 0.7 },
    },
    {
      id: "landcover-grass", type: "fill", source: "openmaptiles", "source-layer": "landcover",
      filter: ["match", ["get", "class"], ["grass", "park"], true, false],
      paint: { "fill-color": C.grassFill ?? C.land, "fill-opacity": 0.65 },
    },
    {
      id: "park", type: "fill", source: "openmaptiles", "source-layer": "park",
      paint: { "fill-color": C.parkFill ?? C.land, "fill-opacity": 0.55 },
    },
    {
      id: "waterway", type: "line", source: "openmaptiles", "source-layer": "waterway",
      paint: { "line-color": C.waterway, "line-width": w([[10, 0.6], [16, 2.4]]) },
    },
  ]

  // ── Buildings ──
  const buildingLayer: any = {
    id: "building", type: "fill", source: "openmaptiles", "source-layer": "building",
    minzoom: 13,
    paint: {
      "fill-color": C.building,
      "fill-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0, 15, C.buildingOutline ? 0.55 : 0.7],
      ...(C.buildingOutline ? { "fill-outline-color": C.buildingLine } : {}),
    },
  }

  // ── Rail ──
  const railLayer: any = {
    id: "rail", type: "line", source: "openmaptiles", "source-layer": "transportation",
    filter: ["all", NOT_TUNNEL, ["match", ["get", "class"], ["rail", "transit"], true, false]],
    minzoom: 11,
    paint: {
      "line-color": C.rail, "line-width": w([[11, 0.6], [18, 2.5]]),
      ...(C.dashedRail ? { "line-dasharray": [3, 3] } : {}),
    },
  }

  // ── Roads: casing then fill, per tier, ascending importance ──
  const roadLayers: any[] = []
  for (const t of ROAD_TIERS) {
    const fillColor = (C as any)[(t as any).colorKey ?? "minor"] as string
    const casingColor = (C as any)[(t as any).casingKey ?? "casingMinor"] as string | undefined
    if (C.casings && casingColor) {
      roadLayers.push({
        id: `road-${t.id}-casing`, type: "line", source: "openmaptiles", "source-layer": "transportation",
        filter: roadFilter(t.classes), minzoom: t.id === "minor" ? 14 : t.minzoom, layout: roundCap,
        paint: { "line-color": casingColor, "line-width": t.caseW },
      })
    }
    // motorway glow (only for glow palettes) sits just under the motorway fill
    if (t.id === "motorway" && C.glow) {
      roadLayers.push({
        id: "road-motorway-glow", type: "line", source: "openmaptiles", "source-layer": "transportation",
        filter: roadFilter(t.classes),
        paint: {
          "line-color": C.motorway, "line-width": w([[6, 1.5], [12, 6], [16, 20]]),
          "line-opacity": 0.18, "line-blur": w([[6, 1], [16, 8]]),
        },
      })
    }
    roadLayers.push({
      id: `road-${t.id}`, type: "line", source: "openmaptiles", "source-layer": "transportation",
      filter: roadFilter(t.classes), minzoom: t.minzoom, layout: roundCap,
      paint: {
        "line-color": fillColor, "line-width": t.fillW,
        ...(t.id === "motorway" && C.glow ? { "line-opacity": 0.9 } : {}),
      },
    })
  }

  // ── Boundaries ──
  const boundaryLayer: any = {
    id: "boundary", type: "line", source: "openmaptiles", "source-layer": "boundary",
    filter: ["all", [">=", ["get", "admin_level"], 3], ["<=", ["get", "admin_level"], 8], ["!=", ["get", "maritime"], 1]],
    paint: {
      "line-color": C.boundary, "line-width": w([[6, 0.4], [14, 1.4]]), "line-opacity": 0.5,
      ...(C.dashedBoundary ? { "line-dasharray": [2, 3] } : {}),
    },
  }

  // ── Labels ──
  const labelLayers: any[] = [
    {
      id: "label-road", type: "symbol", source: "openmaptiles", "source-layer": "transportation_name",
      minzoom: 13,
      filter: ["match", ["get", "class"], ["primary", "secondary", "tertiary", "trunk", "motorway"], true, false],
      layout: {
        "text-field": NAME, "text-font": ["Noto Sans Regular"],
        "text-size": w([[13, 9], [18, 12]]), "text-letter-spacing": 0.08,
        "symbol-placement": "line", ...labelCase,
      },
      paint: { "text-color": C.road, "text-halo-color": C.halo, "text-halo-width": 1.4 },
    },
    {
      id: "label-water", type: "symbol", source: "openmaptiles", "source-layer": "water_name",
      layout: { "text-field": NAME, "text-font": ["Noto Sans Regular"], "text-size": 11, "text-letter-spacing": 0.05 },
      paint: { "text-color": C.waterLabel, "text-halo-color": C.halo, "text-halo-width": 1.2 },
    },
    {
      id: "label-place-minor", type: "symbol", source: "openmaptiles", "source-layer": "place",
      filter: ["match", ["get", "class"], ["town", "village", "suburb", "neighbourhood", "quarter"], true, false],
      layout: {
        "text-field": NAME, "text-font": ["Noto Sans Regular"],
        "text-size": w([[9, 10], [15, 14]]), "text-letter-spacing": 0.12, ...labelCase,
      },
      paint: { "text-color": C.placeMinor, "text-halo-color": C.halo, "text-halo-width": 1.6 },
    },
    {
      id: "label-place-major", type: "symbol", source: "openmaptiles", "source-layer": "place",
      filter: ["match", ["get", "class"], ["city", "country", "state"], true, false],
      layout: {
        "text-field": NAME, "text-font": ["Noto Sans Regular"],
        "text-size": w([[3, 12], [10, 20]]), "text-letter-spacing": 0.18, ...labelCase,
      },
      paint: { "text-color": C.placeMajor, "text-halo-color": C.halo, "text-halo-width": 1.8 },
    },
  ]

  return {
    version: 8,
    name: `BRUX ${ACTIVE}`,
    glyphs: OFM_GLYPHS,
    sources: { openmaptiles: { type: "vector", url: OFM_TILES } },
    layers: [...landLayers, buildingLayer, railLayer, ...roadLayers, boundaryLayer, ...labelLayers],
  }
}

export const bruxBlueprintStyle: any = makeStyle(PALETTES[ACTIVE])
