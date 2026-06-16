#!/usr/bin/env node
// Generates pre-tiled UK ground hazard GeoJSON for DroneChecker.
// Output: ../hazard-tiles/v1/{lat}_{lng}.geojson
// Run: npm run generate   (from the scripts/ directory)
// Safe to re-run — skips already-completed hazard types and merges new data.

'use strict';

const fs = require('fs');
const path = require('path');
const osmtogeojson = require('osmtogeojson');

const TILE_SIZE  = 0.25;
const COORD_DP   = 5;
const UK_BBOX    = '49.5,-8.2,58.8,1.8';
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

const tiles = {}; // key → Feature[]
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── helpers ───────────────────────────────────────────────────────────────────

function roundN(n) { return Math.round(n * Math.pow(10, COORD_DP)) / Math.pow(10, COORD_DP); }
function roundCoords(c) {
  if (typeof c[0] === 'number') return [roundN(c[0]), roundN(c[1])];
  return c.map(roundCoords);
}

function featureBbox(f) {
  const pts = [];
  function collect(c) {
    if (!Array.isArray(c)) return;
    if (typeof c[0] === 'number') { pts.push(c); return; }
    c.forEach(collect);
  }
  if (f.geometry?.coordinates) collect(f.geometry.coordinates);
  if (!pts.length) return null;
  return [Math.min(...pts.map(p=>p[0])), Math.min(...pts.map(p=>p[1])),
          Math.max(...pts.map(p=>p[0])), Math.max(...pts.map(p=>p[1]))];
}

function intersectingTileKeys(bbox) {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const keys = [];
  const sLat = Math.floor(minLat * 4) / 4, nLat = Math.floor(maxLat * 4) / 4;
  const wLng = Math.floor(minLng * 4) / 4, eLng = Math.floor(maxLng * 4) / 4;
  for (let la = sLat; la <= nLat + 0.001; la = Math.round((la + TILE_SIZE) * 1000) / 1000)
    for (let lo = wLng; lo <= eLng + 0.001; lo = Math.round((lo + TILE_SIZE) * 1000) / 1000)
      keys.push(`${la}_${lo}`);
  return keys;
}

// ── Overpass fetch ────────────────────────────────────────────────────────────

async function fetchOverpass(hazardKey, queryLines) {
  const body = `[out:json][timeout:180][bbox:${UK_BBOX}];\n(\n${queryLines}\n);\nout body;\n>;\nout skel qt;`;
  let rateLimits = 0;

  for (const url of [OVERPASS, FALLBACK]) {
    const label = url.includes('kumi') ? 'fallback' : 'primary';
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        const wait = 15000 * attempt;
        console.log(`  Retry ${attempt} on ${label} in ${wait/1000}s…`);
        await sleep(wait);
      }
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(body),
          signal: AbortSignal.timeout(210_000),
        });
        if (res.status === 429) {
          rateLimits++;
          const wait = Math.min(60_000 * rateLimits, 300_000);
          console.log(`  Rate limited — waiting ${wait/1000}s…`);
          await sleep(wait);
          if (attempt === 2) break; // give up on this endpoint, try the other
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
  throw new Error('All Overpass endpoints exhausted (rate-limited or unreachable)');
}

// ── Feature → tiles ───────────────────────────────────────────────────────────

function addFeaturesToTiles(features, hazardKey) {
  let tileEntries = 0;
  for (const f of features) {
    if (!f.geometry) continue;
    const bbox = featureBbox(f);
    if (!bbox) continue;
    const p = f.properties || {};
    const slim = {
      type: 'Feature', id: f.id,
      properties: { hazard: hazardKey, name: p.name || p.operator || null },
      geometry: { type: f.geometry.type, coordinates: roundCoords(f.geometry.coordinates) },
    };
    for (const k of intersectingTileKeys(bbox)) {
      if (!tiles[k]) tiles[k] = [];
      // Deduplicate by id+hazard within a tile
      if (f.id && tiles[k].some(x => x.id === f.id && x.properties.hazard === hazardKey)) continue;
      tiles[k].push(slim);
      tileEntries++;
    }
  }
  console.log(`  → ${features.length} features, ${tileEntries} tile-entries, ${Object.keys(tiles).length} tiles total`);
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Accumulate: load existing tiles and manifest
  const manifestPath = path.join(OUTPUT_DIR, 'manifest.json');
  let completedKeys = new Set();

  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    completedKeys = new Set(manifest.completedKeys || []);
    if (completedKeys.size) {
      console.log(`Resuming — already have: ${[...completedKeys].join(', ')}`);
      const existingFiles = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.geojson'));
      console.log(`Loading ${existingFiles.length} existing tile files…`);
      for (const f of existingFiles) {
        const data = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, f), 'utf8'));
        tiles[f.replace('.geojson', '')] = data.features || [];
      }
    }
  }

  const newlyCompleted = [];

  for (const [i, { key, query }] of HAZARD_TYPES.entries()) {
    if (completedKeys.has(key)) {
      console.log(`\n[${i+1}/${HAZARD_TYPES.length}] ${key} — already done, skipping`);
      continue;
    }
    const queryLines = query.split(';').filter(Boolean).map(q => q.trim() + ';').join('\n');
    console.log(`\n[${i+1}/${HAZARD_TYPES.length}] ${key}`);
    try {
      const osmJson = await fetchOverpass(key, queryLines);
      const geojson = osmtogeojson(osmJson);
      addFeaturesToTiles(geojson.features, key);
      newlyCompleted.push(key);
    } catch (err) {
      console.error(`  SKIPPED ${key}: ${err.message}`);
    }
    await sleep(8_000);
  }

  const allCompleted = [...completedKeys, ...newlyCompleted];

  if (!Object.keys(tiles).length) {
    console.log('\nNo tile data — nothing written.');
    return;
  }

  // Write tile files
  const keys = Object.keys(tiles);
  console.log(`\nWriting ${keys.length} tile files…`);
  let written = 0;
  for (const k of keys) {
    fs.writeFileSync(path.join(OUTPUT_DIR, `${k}.geojson`),
      JSON.stringify({ type: 'FeatureCollection', features: tiles[k] }));
    if (++written % 100 === 0) process.stdout.write(`  ${written}/${keys.length}\r`);
  }

  fs.writeFileSync(manifestPath, JSON.stringify({
    generated: new Date().toISOString(),
    tileCount: keys.length,
    tileSize: TILE_SIZE,
    completedKeys: allCompleted,
  }));

  console.log(`\nDone — ${written} tiles written`);
  console.log(`Completed: ${allCompleted.join(', ')}`);

  const remaining = HAZARD_TYPES.map(h => h.key).filter(k => !allCompleted.includes(k));
  if (remaining.length) {
    console.log(`Still needed: ${remaining.join(', ')}`);
    console.log('Run `npm run generate` again when Overpass is less busy (early morning works well).');
  } else {
    console.log('\nAll types complete — run: firebase deploy --only hosting');
  }
}

main().catch(err => { console.error(err); process.exit(1); });
