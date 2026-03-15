# Boundary Preprocessing

`korea-drilldown-svg-map` ships processed Korea administrative boundary assets under `data/boundaries`.

## Regenerate the bundle

Install `mapshaper` first:

```bash
pnpm add -D mapshaper
```

Run the preprocessing script with a raw source file:

```bash
pnpm preprocess:boundaries -- --input ../path/to/HangJeongDong_ver20260201.geojson
```

You can also use an environment variable:

```bash
BOUNDARY_SOURCE_PATH=../path/to/HangJeongDong_ver20260201.geojson pnpm preprocess:boundaries
```

## Outputs

- `data/boundaries/sido/all.topo.json`
  - Nationwide `시/도` boundaries
- `data/boundaries/sgg/all.topo.json`
  - Nationwide `시/군/구` boundaries
- `data/boundaries/sgg/by-sido/{sidoCode}.topo.json`
  - Per-`시/도` `시/군/구` bundles for lazy drill-down loading
- `data/boundaries/dong/all.topo.json`
  - Simplified `읍면동/동` bundle for future extensions
- `data/boundaries/regions.json`
  - Region metadata for selectors and code lookups

## Public asset copy

To serve the packaged data from a web app:

```bash
pnpm copy:boundaries ./public/boundaries
```

## Notes

- The script clears `data/boundaries` before regenerating assets.
- TopoJSON files expose a single `regions` object.
- Field names are normalized to:
  - `code`
  - `name`
  - `level`
  - `label`
  - `sidoCode`
  - `sidoName`
  - `sggCode`
  - `sggName`
  - `code10` (`dong` only)
- Simplification levels are tuned for mobile-first rendering and can be adjusted in `scripts/preprocess-boundaries.mjs`.
- Confirm the redistribution policy of your raw boundary dataset before publishing regenerated files.
