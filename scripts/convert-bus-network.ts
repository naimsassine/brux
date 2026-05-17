/**
 * Converts STIB bus network GML (EPSG:3035) to GeoJSON (WGS84).
 * Run once: npx tsx scripts/convert-bus-network.ts
 * Output: apps/web/public/bus-network.geojson
 */

import * as fs from "fs"
import * as path from "path"
import proj4 from "proj4"

// EPSG:3035 — ETRS89 Lambert Azimuthal Equal Area (used by INSPIRE datasets)
proj4.defs(
  "EPSG:3035",
  "+proj=laea +lat_0=52 +lon_0=10 +x_0=4321000 +y_0=3210000 +ellps=GRS80 +units=m +no_defs"
)
const toWgs84 = proj4("EPSG:3035", "WGS84")

function convertPosList(posList: string): [number, number][] {
  const nums = posList.trim().split(/\s+/).map(Number)
  const coords: [number, number][] = []
  for (let i = 0; i < nums.length - 1; i += 2) {
    // EPSG:3035 GML axis order is Northing (Y) then Easting (X); proj4 wants [x, y]
    const [lng, lat] = toWgs84.forward([nums[i + 1], nums[i]])
    coords.push([lng, lat])
  }
  return coords
}

function parseGml(gml: string) {
  const features: any[] = []
  const linkPattern = /<tn-ro:RoadLink[^>]*gml:id="([^"]+)"[^>]*>([\s\S]*?)<\/tn-ro:RoadLink>/g

  let match: RegExpExecArray | null
  while ((match = linkPattern.exec(gml)) !== null) {
    const id = match[1]
    const block = match[2]

    const posListMatch = block.match(/<gml:posList[^>]*>([\s\S]*?)<\/gml:posList>/)
    if (!posListMatch) continue

    const coordinates = convertPosList(posListMatch[1])
    if (coordinates.length < 2) continue

    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates },
      properties: { id },
    })
  }

  return features
}

const gmlPath = path.resolve("TN.RoadTransportNetwork.gml")
const outPath = path.resolve("apps/web/public/bus-network.geojson")

console.log("Reading GML file...")
const gml = fs.readFileSync(gmlPath, "utf-8")

console.log("Parsing and reprojecting features...")
const features = parseGml(gml)
console.log(`  Converted ${features.length} road links`)

const geojson = { type: "FeatureCollection", features }
fs.writeFileSync(outPath, JSON.stringify(geojson))
console.log(`Written to ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(0)} KB)`)
