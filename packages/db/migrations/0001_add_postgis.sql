-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add geometry column to communes (boundaries loaded separately from GeoJSON)
ALTER TABLE communes
  ADD COLUMN IF NOT EXISTS boundary geometry(MultiPolygon, 4326);

-- Spatial index on commune boundaries
CREATE INDEX IF NOT EXISTS communes_boundary_idx
  ON communes USING GIST (boundary);

-- Spatial index on items lat/lng
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326)
  GENERATED ALWAYS AS (
    CASE WHEN lat IS NOT NULL AND lng IS NOT NULL
      THEN ST_SetSRID(ST_MakePoint(lng, lat), 4326)
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS items_geom_idx ON items USING GIST (geom);
