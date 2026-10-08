# UK Weather Atlas

Actual observations for the UK, Republic of Ireland and nearby seas, from OGIMET METAR, SYNOP, SHIP and BUOY reports. Includes an interactive map, observed-field menus, wind arrows, dark map mode and Top 5 / Top 10 station rankings.

GitHub website: https://matthewhugo81-arch.github.io/uk-weather-atlas/

Original site and observation backend: https://uk-weather-atlas.matthugo81.chatgpt.site/

## Run locally

Requires Node.js 22 or newer. There are no npm runtime dependencies.

```sh
npm run build
npm test
npm run dev
```

Open http://127.0.0.1:4173/. The preview provides `/api/observations`; opening `dist/index.html` directly will not provide the backend.

## Structure

- `src/decoder.mjs`: explicit observational decoding; timestamps, raw reports, code tables and missing values remain intact.
- `src/worker.mjs`: backend OGIMET downloads and caching.
- `src/stations.json`: fallback UK/Ireland station directory.
- `dist/`: browser source and bundled Leaflet/geography assets.
- `scripts/build.mjs`: generates the self-contained Cloudflare-compatible Worker at `dist/server/index.js`.
- `test/`: report decoding, cache fallback and ranking tests.
- `SOURCES.md`: provenance, attribution and decoding limitations.

## Rankings

Collapsed sidebar panel with Top 5 / Top 10 lists. Current temperature, wind, gusts and one-hour precipitation use reports no older than two hours. Transmitted Tmin/Tmax, 24-hour precipitation and snow depth use a 24-hour report window. Each land station contributes its latest eligible reading, with its timestamp and network. Selecting a result plots that variable and opens the station.

Rankings cover reporting UK/Ireland land stations, not every town. They follow the selected network. Summary periods and gust conventions can differ between services. Rainfall lists use precipitation water equivalent; weather codes do not measure snowfall amounts. Snow depth is ranked only when numerically reported, while snow/ice conditions are listed by report recency.

## Hosting

GitHub Pages serves the map from `main` → `/docs`. Run `npm run build:pages` after changing browser assets and commit the updated `docs/` files; pushes to the configured source automatically publish them. The Pages build keeps relative asset URLs, excludes the Worker and hosting metadata, and points observation requests to the original Sites backend. There are no credentials in the browser build.

The observation backend remains hosted by Sites and must be public for shared visitors. It permits browser API access from `https://matthewhugo81-arch.github.io` without credentials. GitHub Pages cannot run the OGIMET Worker itself. `.openai/hosting.json` identifies the existing Sites project and contains no credentials. Backend changes still require a separate Sites deployment.

## Data

SYNOP downloads cover 24 hours; METAR and marine downloads cover six hours. Marine coverage is 47.5–62.5°N, 17°W–6°E. Reports are cached for up to ten minutes. Missing observations are never invented or changed to measured zeros. See `SOURCES.md` and the on-site coverage notes for full caveats and third-party attribution.
