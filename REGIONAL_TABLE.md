# Regional observation table — 12 October 2026

## Use

Select **Table** beside the existing Observation selector. Choose a region in the table header. The original selector, reporting network, maximum age and precipitation period drive both views. Select a column heading to sort; select it again to reverse direction. Missing values stay last and are never treated as zero. Station names open the existing station detail; **Back to table** returns to the listing. Map remains the default after a page reload; the selected region is remembered where browser storage is available.

Scotland, Northern England, Wales, Midlands and Southern England are included. Northern England combines ONS North East, North West and Yorkshire and the Humber; Midlands combines East and West Midlands; Southern England includes the East of England, London, South East and South West. Northern Ireland, Ireland, Crown Dependencies and nearby marine observations have separate choices. Unmatched land sites are retained under Other / unassigned land. An open Station rankings panel still limits both views to the active ranking, explicitly identified above the table.

The table uses each reading's timestamp, original network, qualifiers and units. Summary report times are not the time of a temperature extreme. MSLP and QNH remain separate. Rows without the selected variable show an em dash; their report-time cell does not borrow the time of another observation.

## Isolation and performance

`regional-table.js` adds the view controls and a separate panel over the existing map area. It reads the existing `stations()`, `getReading()`, `format()`, `colour()` and station selection functions. A read-only MutationObserver on existing status/detail nodes keeps it synchronized with refreshes and filtering. It does not replace any map, ranking, refresh or selection handler. The map remains mounted at its original dimensions, inert and visually hidden under the table, avoiding zoom or centre drift on return.

Original `app.js`, `style.css`, mobile controls, decoder and backend are unchanged in each build. The only existing files changed are the two HTML entrypoints, adding the new script. New assets are mirrored in `dist/` and `docs/`. The geographical lookup loads only on the first Table selection, from the same website; there are no extra observation downloads, dependencies or scheduled jobs. Failure to load regional geography offers a retry and does not prevent use of the map. Existing feed warnings are mirrored in the table.

## Geographic reference

ONS December 2024 BGC England Regions and UK Countries:
- https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Regions_December_2024_Boundaries_EN_BGC/FeatureServer
- https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Countries_December_2024_Boundaries_UK_BGC/FeatureServer

`scripts/build-regional-boundaries.py INPUT_DIRECTORY` creates the bundled lookup from `regions.json` and `countries.json`. Build-time dependency: Shapely 2.1.2. There is no browser geometry service call. Boundaries are generalized for station grouping, not drawn on the map; the nearest coastal polygon may be used only within 2 km. Very small rocks without a nearby directory station are omitted. Crown Dependency identifiers are explicit. Unexpected positions remain unassigned rather than being guessed from latitude bands.

Contains OS data © Crown copyright and database right 2024. Contains National Statistics data © Crown copyright and database right 2024. Open Government Licence v3.0.

## Verification

`npm test`: 59 passing tests (33 existing plus 26 regional-table tests). Geographic border cases include Hawarden, Berwick, Carlisle, Eskdalemuir, Humberside and Waddington. Tests cover numeric/category/time sorting, trace versus dry, missing-last ordering, region separation and matching source/Pages assets.

Headless Chromium checks at 1440×1000, 768×1024 and 390×844 used controlled observation fixtures, not live measurements. They checked switching, sorting, field-specific UTC times, station details, rainfall periods, summary-age changes, networks, missing readings and marine empty states. There were no JavaScript exceptions or additional observation requests. Map dimensions and return position were retained. Cropped map-area screenshots matched the pre-change baseline pixel-for-pixel. External live-feed availability is not established by fixture tests; the existing feed implementation is untouched.

## Rollback

The complete pre-change repository is preserved at branch `backup/atlas-before-regional-tables-2026-10-12`, commit `dfcd9971fd9b1cc0286c409586e458564b9469cf`.

Revert the single **Add reversible regional observation table** release commit on `main` to undo the feature while retaining repository history. GitHub Pages will republish the reverted entrypoints. Review conflicts if other work has subsequently changed the same files; do not force-reset `main`. The backup branch is an additional recovery reference and must not be used as a development branch. Selecting **Map** is also an immediate way to leave the table without changing the deployment.
