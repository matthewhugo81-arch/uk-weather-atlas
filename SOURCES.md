# UK Weather Atlas — observation data

This site plots land-station observations received by OGIMET. It does not use model data, interpolation, or a forecast grid. Coverage is the OGIMET United Kingdom reporting region within 49.7–61.2°N and 8.4°W–2.2°E. Only stations with a mapped identifier and a usable report in the past six hours are returned; the user may apply a shorter age limit.

## Data sources and cache

- [OGIMET SYNOP download documentation](https://www.ogimet.com/getsynop_help.html.en)
- [OGIMET METAR download documentation](https://www.ogimet.com/getmetar_help.phtml.en)
- [OGIMET UK station directory](https://www.ogimet.com/display_stations.php?lang=en&tipo=AND&estado=United%20Kingdom)
- [OGIMET terms and attribution](https://www.ogimet.com/license.phtml)

The server fetches both countrywide feeds for six hours, at most once per ten-minute cache window per running cache instance. It deduplicates concurrent requests and caches the station directory for one day. The bundled directory was retrieved on 7 October 2026 and is used with a visible warning if live directory retrieval fails. Source failures are explicit; no sample data is substituted. Observations belong to their originating meteorological services. The map links to OGIMET and retains each report verbatim.

## Decoding

- [Met Office METAR decoding guide](https://docs.mavis.metoffice.gov.uk/guidance/metar-decode/)
- [British Antarctic Survey pymetdecoder](https://github.com/antarctica/pymetdecoder), used to check SYNOP code tables. Contains public sector information licensed under the [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/), © UK Research and Innovation / British Antarctic Survey.

The limited JavaScript decoder supports common UK METAR and land SYNOP groups. It retains unsupported information in raw reports rather than guessing. Tests use constructed reports to exercise code-table boundaries and missing values. METAR trends and remarks are excluded from the observed fields.

METAR QNH, SYNOP sea-level pressure and station pressure remain separate. Total SYNOP cloud is in oktas; METAR cloud remains categorical. CAVOK, NSC and NCD never become zero total cloud. Humidity calculated from temperature and dew point is marked derived. SYNOP 910ff gusts retain their preceding ten-minute period; 911ff gusts with a different period are not substituted. Precipitation remains a water-equivalent accumulation with its original period and timestamp, including trace and threshold qualifiers.

Partial reports do not erase earlier readings. Each variable retains its last decoded value and original time; the selected age limit applies to that individual reading. Different networks at the same station are combined by OGIMET's WMO/ICAO metadata, and the freshest eligible reading is used. Every derived value uses temperature and dew point from the same report. The SYNOP 24-hour group 7RRRR follows [WMO Manual on Codes](https://www.eoas.ubc.ca/courses/atsc303/Instruments/wmo_guides/wmo_306-vI1_en-2013.pdf), including 9998 (999.8 mm or more) and 9999 (trace).

## Other assets

Leaflet 1.9.4 (BSD-2-Clause), with its license in `dist/vendor/LEAFLET-LICENSE.txt`. Geography is from [Natural Earth](https://www.naturalearthdata.com/) (public domain). No external basemap requests or browser-side weather API calls are required.

## Ireland and marine coverage (8 October 2026)

The country feeds and directory now include United Kingdom and Ireland. Nearby marine reports are obtained using [OGIMET SHIP selection](https://www.ogimet.com/getsynop_help.phtml) and [BUOY download](https://www.ogimet.com/getbuoy_help.phtml.en). Global marine downloads are filtered to 47.5–62.5°N, 17°W–6°E. The live BUOY CSV contains leading latitude/longitude fields; these are cross-checked against the encoded position.

BBXX and ZZYY positions use their reported quadrants. ZZYY section boundaries and sea-surface temperature follow [Fisheries and Oceans Canada FM18](https://www.dfo-mpo.gc.ca/science/data-donnees/gts-smt/codes/18-xii-eng.html). Numeric marine identifiers are displayed as buoys/platforms, and callsigns as ships. Each marine identifier uses only its latest report and position; earlier measurements are not carried along a moving track. Unknown/missing fields remain in the original report.

Wind arrows show flow toward the downwind direction (reported meteorological from-direction plus 180°). Calm is an open circle; variable wind is a double arrow. Degree values remain meteorological from-directions.

## Observation-field audit (8 October 2026)

Audited 24 hours of current OGIMET UK and Ireland SYNOP reports against the [WMO FM12 reference](https://met.nps.edu/~bcreasey/mr3222/files/helpful/DecodeLandSynopticCode.pdf), [CEDA code tables](https://artefacts.ceda.ac.uk/badc_datadocs/surface/code.html), BAS pymetdecoder and [JMA FM18 BUOY](https://www.data.jma.go.jp/goos/data/rrtdb/in-situ/code/buoy.html). Field fixtures include actual OGIMET summaries, not model forecasts.

Land SYNOP downloads now cover 24 hours; METAR and marine downloads remain six hours. Extrema and grass minima are transmitted summary values. Their observation period is decided nationally and is not encoded in the groups: the UI deliberately retains report time without claiming every 06/18 UTC report covers the same interval. Daily sunshine/radiation have their encoded 24-hour period, hourly sunshine/radiation their one-hour period. Radiation is accumulated energy in kJ/m², with 24-hour J/cm² converted by a factor of 10.

Decoded additions include temperature extremes, grass minima, 3/24-hour pressure changes, tendency code, past weather codes, low/middle cloud amount, low/middle/high cloud type codes, cloud-base ranges, individual SYNOP and METAR layers, METAR ceilings/vertical visibility/RVR/wind variation/recent weather/wind shear, sunshine, common radiation groups, reporting-period gusts, ground/snow state and depth, waves, swell and marine wet-bulb temperature. 911ff gusts stay separate from 910ff gusts; 907tt supplies the period when present. The menu is populated from fields actually present in the fetched window. Regional/national groups and subsurface ocean profiles remain accessible as clearly labelled original codes rather than unverified physical values. No claim is made that all possible national or special WMO extensions have been numerically decoded.

Only sites with an eligible reading are plotted; unavailable data do not produce value labels. Dark map mode changes the local geography, controls and legend without sending map requests to a third-party basemap service.
