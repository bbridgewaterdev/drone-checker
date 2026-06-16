#!/usr/bin/env node
// Generates pre-tiled UK ground hazard GeoJSON for DroneChecker.
// Output: ../hazard-tiles/v1/{lat}_{lng}.geojson
// Run: npm run generate   (from the scripts/ directory)

'use strict';

const fs = require('fs');
const path = require('path');
const osmtogeojson = require('osmtogeojson');

const TILE_SIZE  = 0.25;   // degrees — ~16-28km per tile across the UK
const COORD_DP   = 5;      // 5 decimal places ≈ 1m accuracy, saves ~20% vs OSM default
const UK_BBOX    = '49.5,-8.2,58.8,1.8'; // S,W,N,E
const OUTPUT_DIR = path.join(__dirname, '..', 'hazard-tiles', 'v1');
const OVERPASS   = 'https://overpass-api.de/api/interpreter';
const FALLBACK   = 'https://overpass.kumi.systems/api/interpreter';

const HAZARD_TYPES = [
  { key: 'school',   query: 'way["amenity"="school"];relation["amenity"="school"];' },
  { key: 'railway',  query: 'way["railway"="rail"];' },
  { key: 'nt',       query: 'way["operator"="National Trust"];relation["operator"="National Trust"];' },
  { key: 'prison',   query: 'way["amenity"="prison"];relation["amenity"="prison"];' },
  { key: 'military', query: 'way["landuse"="military"];relation["landuse"="military"];' },
  { key: 'hospital', query: 'way["amenity"="hospital"];relation["amenity"="hospital"];' },
  { key: 'nature',   query: 'way["leisure"="nature_reserve"];relation["leisure"="nature_reserve"];' },
  { key: 'heritage', query: 'way["historic"="monument"];way["historic"="castle"];relation["historic"="castle"];' },
  { key: 'police',   query: 'way["amenity"="police"];' },
];

// tiles accumulator: key → Feature[]
const tiles = {};

// ── helpers ──────────────────────────────────────────────────────────────────

function tileKey(lat, lng) {
  const tl = Math.floor(lat * 4) / 4;   // floor to nearest 0.25
  const tg = Math.floor(lng * 4) / 4;
  return `${tl}_${tg}`;
}

function roundN(n) {
  const f = Math.pow(10, COORD_DP);
  return Math.round(n * f) / f;
}

function roundCoords(c) {
  if (typeof c[0] === 'number') return [roundN(c[0]), roundN(c[1])];
  return c.map(roundCoords);
}

function featureBbox(feature) {
  const pts = [];
  function collect(c) {
    if (!Array.isArray(c)) return;
    if (typeof c[0] === 'number') { pts.push(c); return; }
    c.forEach(collect);
  }
  if (feature.geometry && feature.geometry.coordinates)
    collect(feature.geometry.coordinates);
  if (!pts.length) return null;
  return [
    Math.min(...pts.map(p => p[0])),
    Math.min(...pts.map(p => p[1])),
    Math.max(...pts.map(p => p[0])),
    Math.max(...pts.map(p => p[1])),
  ];
}

function intersectingTileKeys(bbox) {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const keys = [];
  const sLat = Math.floor(minLat * 4) / 4;
  const nLat = Math.floor(maxLat * 4) / 4;
  const wLng = Math.floor(minLng * 4) / 4;
  const eLng = Math.floor(maxLng * 4) / 4;
  for (let la = sLat; la <= nLat + 0.001; la = Math.round((la + TILE_SIZE) * 1000) / 1000) {
    for (let lo = wLng; lo <= eLng + 0.001; lo = Math.round((lo + TILE_SIZE) * 1000) / 1000) {
      keys.push(`${la}_${lo}`);
    }
  }
  return keys;
}

// ── Overpass fetch with retry ─────────────────────────────────────────────────

async function fetchOverpass(hazardKey, queryLines) {
  const body = `[out:json][timeout:180][bbox:${UK_BBOX}];\n(\n${queryLines}\n);\nout body;\n>;\nout skel qt;`;

  for (const url of [OVERPASS, FALLBACK]) {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        const wait = 15000 * attempt;
        console.log(`  Retry ${attempt} on ${url.includes('kumi') ? 'fallback' : 'primary'} in ${wait/1000}s…`);
        await sleep(wait);
      }
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(body),
          signal: AbortSignal.timeout(200_000),
        });
        if (res.status === 429) {
          console.log('  Rate limited — waiting 60s…');
          await sleep(60_000);
          continue;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        console.log(`  ✓ ${json.elements.length} elements`);
        return json;
      } catch (err) {
        console.error(`  ✗ ${err.message}`);
        if (attempt === 2 && url === FALLBACK) throw err;
      }
    }
  }
}

// ── Feature → tiles ───────────────────────────────────────────────────────────

function addFeaturesToTiles(features, hazardKey) {
  let tileEntries = 0;
  for (const f of features) {
    if (!f.geometry) continue;
    const bbox = featureBbox(f);
    if (!bbox) continue;

    const keys = intersectingTileKeys(bbox);
    const p = f.properties || {};
    const slim = {
      type: 'Feature',
      id: f.id,
      properties: {
        hazard: hazardKey,
        name:   p.name || p.operator || null,
      },
      geometry: {
        type:        f.geometry.type,
        coordinates: roundCoords(f.geometry.coordinates),
      },
    };

    for (const k of keys) {
      if (!tiles[k]) tiles[k] = [];
      tiles[k].push(slim);
      tileEntries++;
    }
  }
  const tileCount = Object.keys(tiles).length;
  console.log(`  → ${features.length} features into ${tileCount} tiles (${tileEntries} tile-entries total)`);
}

// ── main ──────────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const { key, query } of HAZARD_TYPES) {
    const queryLines = query.split(';').filter(Boolean).map(q => q.trim() + ';').join('\n');
    console.log(`\n[${HAZARD_TYPES.indexOf(HAZARD_TYPES.find(h => h.key === key)) + 1}/${HAZARD_TYPES.length}] ${key}`);
    try {
      const osmJson = await fetchOverpass(key, queryLines);
      const geojson = osmtogeojson(osmJson);
      addFeaturesToTiles(geojson.features, key);
    } catch (err) {
      console.error(`  SKIPPED ${key}: ${err.message}`);
    }
    await sleep(5_000); // respectful delay between queries
  }

  // Write tile files
  const keys = Object.keys(tiles);
  console.log(`\nWriting ${keys.length} tile files…`);
  let written = 0;
  for (const k of keys) {
    const file = path.join(OUTPUT_DIR, `${k}.geojson`);
    fs.writeFileSync(file, JSON.stringify({ type: 'FeatureCollection', features: tiles[k] }));
    written++;
    if (written % 50 === 0) process.stdout.write(`  ${written}/${keys.length}\r`);
  }

  // Manifest — lets the app verify tiles are present
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'manifest.json'),
    JSON.stringify({ generated: new Date().toISOString(), tileCount: keys.length, tileSize: TILE_SIZE })
  );

  console.log(`\nDone — ${written} tiles written to ${OUTPUT_DIR}`);
  console.log('Next: firebase deploy --only hosting');
}

main().catch(err => { console.error(err); process.exit(1); });
