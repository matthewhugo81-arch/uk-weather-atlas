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

Opening Station Rankings filters the map to exactly the selected Top 5 / Top 10 list, with numbered markers matching the list and the corresponding weather variable. Changes to metric, count, network and refreshed data update both views together. Closing the panel restores the previous observation variable, age limit and precipitation period, and the full map. UKV contours remain independent. Searches and map-click selection stay within the displayed ranking while it is open.

Collapsed sidebar panel with Top 5 / Top 10 lists. Current temperature, wind, gusts and one-hour precipitation use reports no older than two hours. Transmitted Tmin/Tmax, 24-hour precipitation and snow depth use a 24-hour report window. Each land station contributes its latest eligible reading, with its timestamp and network. Selecting a result plots that variable and opens the station.

Rankings cover reporting UK/Ireland land stations, not every town. They follow the selected network. Summary periods and gust conventions can differ between services. Rainfall lists use precipitation water equivalent; weather codes do not measure snowfall amounts. Snow depth is ranked only when numerically reported, while snow/ice conditions are listed by report recency.

## Hosting

GitHub Pages serves the map from `main` → `/docs`. Run `npm run build:pages` after changing browser assets and commit the updated `docs/` files; pushes to the configured source automatically publish them. The Pages build keeps relative asset URLs, excludes the Worker and hosting metadata, and points observation requests to the original Sites backend. There are no credentials in the browser build.

The observation backend remains hosted by Sites and must be public for shared visitors. It permits browser API access from `https://matthewhugo81-arch.github.io` without credentials. GitHub Pages cannot run the OGIMET Worker itself. `.openai/hosting.json` identifies the existing Sites project and contains no credentials. Backend changes still require a separate Sites deployment.

## Data

### Three-hour observation playback

**Look back**, beneath Maximum observation age, selects live reports or one, two or three hours back. Back/forward buttons step one hour; Play loops oldest to latest every 1.8 seconds, Pause holds the view, and Live returns to current reports. The map extent and selected variable stay in place. Map markers, the regional table, rankings, station details, original reports and marine positions all use the selected snapshot. The age limit is relative to that snapshot's UTC time. Historical snapshots are reconstructed from report timestamps, not from what had already arrived at OGIMET at the time.

The API returns three `history` frames with `hoursBack`, `asOf` and `stations`, anchored to `fetchedAt`. No report after a historical cutoff is included. SYNOP downloads cover 27 hours and METAR/marine nine hours, preserving the existing 24-hour/six-hour windows at the oldest cutoff. The shorter SYNOP retry is retained when daily retrieval fails, with an explicit warning about missing older summaries. History needs no extra downloads when stepping or playing. Automatic observation refresh pauses during history/playback; manual refresh reanchors the frames and stops playback. Reload starts live, and hiding the tab pauses playback.

Enabled UKV isobars follow the selected UTC hour. These are forecast values for each valid hour, not archived model runs. Unavailable hours clear the overlay instead of substituting a different hour. The shared backend downloads four past hours (one spare for cache/hour boundaries), the current hour and six future hours in its existing cached grid requests.

### Optional UKV pressure overlay

Enable **UKV MSLP isobars** in the **Model overlay** panel. Choose 2 or 4 hPa spacing and adjust opacity. Geographic Leaflet polylines and labels stay attached to the map during zoom and pan. The controls are collapsed until opened. Reports refresh in place every ten minutes; map position, observation, network, age, precipitation period and value-label settings also survive manual reloads.

The shared backend requests `pressure_msl` explicitly from Open-Meteo's `ukmo_uk_deterministic_2km` model, with no fallback to the global or seamless model. The free UKV feed has an additional publication delay of about four hours. The overlay displays the selected UTC forecast hour and its retrieval time, separately from station observation times. It checks for new data every three hours while enabled and visible, including after returning to a background tab.

For a broad pressure overview within the free API quota, values are sampled at 1° spacing (381 locations within the UKV domain), using the returned model-cell coordinates. This is not a native-resolution 2 km contour product. Missing cells are left blank. The complete grid and hourly frames are cached on the backend per edge and in the browser for three hours, including across page reloads; an update failure may retain a saved forecast only when it contains the selected hour, with an explicit warning and a maximum retrieval age of six hours. Concurrent visitors share an in-flight request and the edge cache. Daily quota errors back off until midnight UTC; other failures back off for 15 minutes. The pressure overlay needs no credentials.

UKV pressure data and derived contours are provided under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), attributed to the Met Office and Open-Meteo. The free API is for non-commercial use. See [Open-Meteo UKMO documentation](https://open-meteo.com/en/docs/ukmo-api) and [API terms](https://open-meteo.com/en/terms).

SYNOP downloads cover 27 hours; METAR and marine downloads cover nine hours to support playback. Each view retains at most 24 hours of SYNOP and six hours of METAR/marine reports. Marine coverage is 47.5–62.5°N, 17°W–6°E. Reports are cached for up to ten minutes. Missing observations are never invented or changed to measured zeros. See `SOURCES.md` and the on-site coverage notes for full caveats and third-party attribution.
