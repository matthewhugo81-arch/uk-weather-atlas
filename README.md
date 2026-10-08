# UK Weather Atlas

Actual observations for the UK, Republic of Ireland and nearby seas, from OGIMET METAR, SYNOP, SHIP and BUOY reports. Includes an interactive map, observed-field menus, wind arrows, dark map mode and Top 5 / Top 10 station rankings.

Live site: https://uk-weather-atlas.matthugo81.chatgpt.site/

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

GitHub stores the source. The current live site remains hosted by Sites; this repository does not enable GitHub Pages or automatic deployment. The site requires a Worker/backend for OGIMET access, so static GitHub Pages alone will not run the observation API. Build output can be deployed to a compatible Cloudflare Worker after configuring that hosting separately. `.openai/hosting.json` identifies the existing Sites project and contains no credentials.

## Data

SYNOP downloads cover 24 hours; METAR and marine downloads cover six hours. Marine coverage is 47.5–62.5°N, 17°W–6°E. Reports are cached for up to ten minutes. Missing observations are never invented or changed to measured zeros. See `SOURCES.md` and the on-site coverage notes for full caveats and third-party attribution.
