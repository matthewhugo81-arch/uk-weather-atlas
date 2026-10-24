'use strict';
/* Optional table view. Uses the existing Atlas data/readers; never retrieves observations.
   DOM status observers are a read-only bridge, so app.js and its map handlers stay untouched. */
(() => {
  const regions = {
    land:'All land stations', scotland:'Scotland', north:'Northern England', wales:'Wales',
    midlands:'Midlands', south:'Southern England', ni:'Northern Ireland', ireland:'Republic of Ireland',
    iom:'Isle of Man', channel:'Channel Islands', marine:'Nearby seas', other:'Other / unassigned land'
  };
  const collator = new Intl.Collator('en-GB', {numeric:true, sensitivity:'base'});
  // Readings are stored in mph. Only the regional table's displayed speeds are converted.
  const windFactors=Object.freeze({mph:1,'km/h':1.609344,kt:1.609344/1.852});
  const isWindVariable=key=>key==='wind'||key==='gust';
  function convertWindValue(value,unit='mph'){
    return typeof value==='number'&&Number.isFinite(value)?value*(windFactors[unit]??1):value;
  }
  function inRing(x,y,ring) {
    let inside=false;
    for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
      const [xi,yi]=ring[i], [xj,yj]=ring[j];
      const cross=(x-xi)*(yj-yi)-(y-yi)*(xj-xi);
      if(Math.abs(cross)<1e-10&&x>=Math.min(xi,xj)&&x<=Math.max(xi,xj)&&y>=Math.min(yi,yj)&&y<=Math.max(yi,yj))return true;
      if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
    }
    return inside;
  }
  function segmentKm(x,y,a,b) {
    const k=111.32*Math.cos(y*Math.PI/180), ax=(a[0]-x)*k, ay=(a[1]-y)*111.32;
    const dx=(b[0]-a[0])*k,dy=(b[1]-a[1])*111.32;
    const t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy||1)));
    return Math.hypot(ax+t*dx,ay+t*dy);
  }
  function regionFor(station,boundaries) {
    if(station.type==='buoy'||station.type==='ship')return 'marine';
    const country=String(station.country||'').toLowerCase(), icao=String(station.icao||'').toUpperCase();
    if(country==='ireland'||country==='republic of ireland')return 'ireland';
    if(country==='isle of man'||icao==='EGNS'||['03204','03207','03208'].includes(station.wmo))return 'iom';
    if(['jersey','guernsey','channel islands'].includes(country)||/^EGJ[ABJ]$/.test(icao)||['03894','03895','03896'].includes(station.wmo))return 'channel';
    const x=station.lon,y=station.lat;
    if(!Number.isFinite(x)||!Number.isFinite(y))return 'other';
    const nearby=[];
    for(const feature of boundaries?.features||[]) {
      const [west,south,east,north]=feature.bounds;
      if(x>=west&&x<=east&&y>=south&&y<=north&&inRing(x,y,feature.rings[0])&&!feature.rings.slice(1).some(r=>inRing(x,y,r)))return feature.region;
      // Coast-clipped polygons and rounded station coordinates may differ slightly.
      const dx=Math.max(west-x,0,x-east)*111.32*Math.cos(y*Math.PI/180);
      const dy=Math.max(south-y,0,y-north)*111.32;
      if(Math.hypot(dx,dy)<=2)nearby.push(feature);
    }
    let best=2,found='other';
    for(const feature of nearby)for(const ring of feature.rings)for(let i=1;i<ring.length;i++) {
      const d=segmentKm(x,y,ring[i-1],ring[i]);
      if(d<best){best=d;found=feature.region;}
    }
    return found;
  }
  function matchesRegion(region,choice) {return choice==='land'?region!=='marine':region===choice;}
  function sortRows(rows,key='name',direction='asc') {
    const sign=direction==='desc'?-1:1;
    const value=row=>key==='name'?row.station.name:key==='elevation'?row.station.elevation:key==='time'?row.reading?.time:row.reading?.value;
    const missing=v=>v===null||v===undefined||typeof v==='number'&&!Number.isFinite(v);
    return [...rows].sort((a,b)=>{
      const av=value(a),bv=value(b),am=missing(av),bm=missing(bv);
      if(am!==bm)return am?1:-1; // Missing values remain last in either direction.
      const diff=am?0:typeof av==='number'&&typeof bv==='number'?av-bv:collator.compare(String(av),String(bv));
      // Trace is not dry: separate it from measured zero without inventing an amount.
      const trace=key==='value'&&av===0&&bv===0?Number(a.reading?.qualifier==='trace')-Number(b.reading?.qualifier==='trace'):0;
      return sign*(diff||trace)||collator.compare(a.station.name,b.station.name)||collator.compare(a.station.id,b.station.id);
    });
  }
  globalThis.WeatherRegionalTable={regions,inRing,regionFor,matchesRegion,sortRows,convertWindValue,isWindVariable};
  if(typeof document==='undefined')return;
  const byId=id=>document.getElementById(id), shell=document.querySelector('.map-shell');
  if(!shell||typeof getReading!=='function')return;
  const css=document.createElement('link');css.rel='stylesheet';css.href='regional-table.css?v=20261024-wind-units';document.head.append(css);
  let active=false,boundaries=null,boundaryTask=null,boundaryError='',region='land',sortKey='name',sortDirection='asc',windUnit='mph',frame=0;
  let regionCache=new WeakMap();
  try{const saved=localStorage.getItem('atlas-table-region-v1');if(Object.hasOwn(regions,saved))region=saved;}catch{}
  const label=document.querySelector('label[for="variable"]'),heading=document.createElement('div');
  heading.className='atlas-observation-heading';label.before(heading);heading.append(label);label.textContent='Observation';
  const switcher=document.createElement('div');switcher.className='atlas-view-switch';switcher.setAttribute('role','group');switcher.setAttribute('aria-label','Observation view');
  switcher.innerHTML='<button type="button" id="atlas-map-view" aria-pressed="true">Map</button><button type="button" id="atlas-table-view" aria-pressed="false" aria-controls="atlas-table-panel">Table</button>';
  heading.append(switcher);
  const panel=document.createElement('section');panel.id='atlas-table-panel';panel.className='atlas-table-panel';panel.hidden=true;panel.setAttribute('aria-label','Regional station observations');
  panel.innerHTML=`<header class="atlas-table-heading"><div><p class="eyebrow">REGIONAL OBSERVATIONS</p><h2 id="atlas-table-title">Station table</h2></div><div class="atlas-table-filters"><label class="atlas-wind-unit-label" id="atlas-wind-unit-label" for="atlas-wind-unit" hidden>Wind units<select id="atlas-wind-unit" aria-label="Wind speed units for table"><option value="mph">MPH (default)</option><option value="km/h">km/h</option><option value="kt">Knots (kt)</option></select></label><label class="atlas-region-label" for="atlas-region">Region<select id="atlas-region">${Object.entries(regions).map(([key,text])=>`<option value="${key}">${text}</option>`).join('')}</select></label></div></header>
    <p id="atlas-table-status" class="atlas-table-status" role="status"></p><p class="atlas-swipe-hint">Swipe the table sideways for all columns.</p>
    <p id="atlas-table-warning" class="atlas-table-warning" role="status" hidden></p>
    <button type="button" id="atlas-region-retry" class="atlas-region-retry" hidden>Retry regional boundaries</button>
    <div class="atlas-table-scroll" tabindex="0" role="region" aria-label="Station readings, scroll for more rows"><table class="atlas-observation-table"><caption class="atlas-sr-only" id="atlas-table-caption">Station observations. Activate a column heading to sort.</caption><thead><tr>
    <th scope="col" data-sort="name" aria-sort="ascending"><button type="button">Station <span aria-hidden="true">↑</span></button></th>
    <th scope="col" data-sort="elevation"><button type="button">Elevation <span class="atlas-th-unit">m</span><span aria-hidden="true">↕</span></button></th>
    <th scope="col" data-sort="value"><button type="button"><span id="atlas-value-heading">Value</span> <span aria-hidden="true">↕</span></button></th>
    <th scope="col" data-sort="time"><button type="button">Report time <span class="atlas-th-unit">UTC</span><span aria-hidden="true">↕</span></button></th>
    </tr></thead><tbody id="atlas-table-body"></tbody></table></div>
    <footer class="atlas-table-footer"><p id="atlas-table-note"></p><details><summary>Regional grouping &amp; reading times</summary><p>Northern England combines the North East, North West, and Yorkshire and the Humber. Midlands combines East and West Midlands. Southern England includes the East of England, London, South East and South West. Scotland and Wales follow national boundaries. Northern Ireland, the Republic of Ireland, Crown Dependencies and marine sites are separate.</p><p>Regional assignment uses bundled, generalised ONS December 2024 boundaries, with a maximum 2 km coastal tolerance for rounded station coordinates. Unmatched land sites remain in Other / unassigned land; they are not silently dropped. Small offshore rocks are omitted from the boundary asset.</p><p>Each value retains its own original report time and network. A missing value is —, not zero. Report times for temperature extremes are not the times when the extremes occurred; their measurement periods can differ. SYNOP MSLP and METAR QNH remain separate. The table adds no observation downloads.</p><p>Contains OS data © Crown copyright and database right 2024. Contains National Statistics data © Crown copyright and database right 2024. <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" target="_blank" rel="noreferrer">Open Government Licence v3.0</a>.</p></details></footer>`;
  shell.append(panel);byId('atlas-region').value=region;
  const back=document.createElement('button');back.type='button';back.className='atlas-back-to-table';back.textContent='↑ Back to table';back.hidden=true;
  document.querySelector('.detail-heading').append(back);
  back.onclick=()=>{panel.scrollIntoView({block:'start'});byId('atlas-region').focus({preventScroll:true});};
  function queue(){if(!active||frame)return;frame=requestAnimationFrame(()=>{frame=0;draw();});}
  async function loadBoundaries(){
    if(boundaries||boundaryTask)return boundaryTask;
    boundaryError='';
    boundaryTask=(async()=>{
      try{
        const response=await fetch('regional-boundaries.json?v=20261012-1',{signal:AbortSignal.timeout(15000)});
        if(!response.ok)throw Error('HTTP '+response.status);
        const result=await response.json();
        if(result.version!==1||!Array.isArray(result.features)||!result.features.length)throw Error('Invalid boundary file');
        boundaries=result;regionCache=new WeakMap();
      }catch(error){boundaryError='Regional boundaries could not load. The map is unaffected; retry to enable regional grouping.';}
      finally{boundaryTask=null;queue();}
    })();return boundaryTask;
  }
  function location(s){if(!regionCache.has(s))regionCache.set(s,regionFor(s,boundaries));return regionCache.get(s);}
  function setView(table){
    active=table;panel.hidden=!table;shell.classList.toggle('atlas-table-active',table);
    byId('atlas-map-view').setAttribute('aria-pressed',String(!table));byId('atlas-table-view').setAttribute('aria-pressed',String(table));
    for(const child of shell.children)if(child!==panel)child.inert=table;
    back.hidden=!table;
    if(table){loadBoundaries();draw();}
    // The map keeps its original dimensions under the panel; no resize/recentre is needed.
  }
  function draw(){
    if(!active)return;
    const v=V[variable],showWindUnits=isWindVariable(variable),displayUnit=showWindUnits?windUnit:v.unit,unit=displayUnit?` (${displayUnit})`:'',title=v.label+(variable==='precipitation'?` · ${period}h`:'');
    byId('atlas-wind-unit-label').hidden=!showWindUnits;
    byId('atlas-table-title').textContent=title+unit;
    byId('atlas-value-heading').textContent=title+unit;
    byId('atlas-table-caption').textContent=`${regions[region]} · ${title}${unit}. Activate a column heading to sort.`;
    const warning=[!byId('notice').hidden?byId('notice').textContent:'',boundaryError].filter(Boolean).join(' ');
    byId('atlas-table-warning').textContent=warning;byId('atlas-table-warning').hidden=!warning;
    byId('atlas-region-retry').hidden=!boundaryError;
    const body=byId('atlas-table-body'),scroll=panel.querySelector('.atlas-table-scroll');
    const focused=document.activeElement?.dataset?.tableStation,scrollTop=scroll.scrollTop;
    let rows=[];
    if(boundaries)rows=stations().map(station=>({station,reading:getReading(station),region:location(station)})).filter(row=>matchesRegion(row.region,region));
    rows=sortRows(rows,sortKey,sortDirection);
    const readings=rows.filter(row=>row.reading),networkLabel=network==='all'?'Combined networks':network;
    const ranking=rankingReadings?' · Station ranking active — close Station rankings for all sites.':'';
    byId('atlas-table-status').textContent=!boundaries?(boundaryError?'Regional grouping unavailable.':'Loading regional boundaries…'):!data?byId('load-status').textContent:`${regions[region]} · ${readings.length} readings / ${rows.length} sites · ${networkLabel} · age ≤ ${maxAge/60}h${hoursBack?' · History: '+utc(viewTime()):''}${ranking}`;
    byId('atlas-table-note').textContent=v.note+' Select a station for its report. All times UTC; — means no eligible reading.';
    body.innerHTML=rows.map(({station:s,reading:r,region:area})=>`<tr${s.id===selectedId?' class="atlas-selected-row"':''}><th scope="row"><button type="button" class="atlas-station-link" data-table-station="${esc(s.id)}"${s.id===selectedId?' aria-current="true"':''}>${esc(s.name)}</button><small>${esc([s.wmo,s.icao].filter(Boolean).join(' / ')||s.reportId||'')}${region==='land'?' · '+esc(regions[area]):''}</small></th><td>${Number.isFinite(s.elevation)?esc(String(s.elevation)):'—'}</td><td class="atlas-reading">${r?`<span class="atlas-value-dot" aria-hidden="true" style="background:${colour(r)}"></span>${esc(showWindUnits&&typeof r.value==='number'&&Number.isFinite(r.value)?(r.qualifier||'')+convertWindValue(r.value,windUnit).toFixed(v.dec??1):format(r,variable,true))}${r.derived?'<small>derived</small>':''}`:'<span class="atlas-missing" title="No reading for the selected network and age limit">—</span>'}</td><td>${r?`<time datetime="${new Date(r.time*1000).toISOString()}">${esc(utc(r.time).replace(' UTC',''))}</time><small>${esc(r.source)} · ${age(r.time)} min old${hoursBack?' at selected time':''}</small>`:'—'}</td></tr>`).join('');
    if(!rows.length){const message=!boundaries?(boundaryError?'Retry regional boundaries, or return to Map.':'Preparing the regional table…'):!data?'No observations loaded. Use Refresh reports.':(network==='BUOY'||network==='SHIP')&&region!=='marine'?'This network contains marine sites. Choose Nearby seas, or switch to Combined for land stations.':rankingReadings?'No ranked sites in this region. Close Station rankings to see all eligible sites.':'No reporting stations match this region, network and age limit.';body.innerHTML=`<tr><td colspan="4" class="atlas-table-empty">${esc(message)}</td></tr>`;}
    scroll.scrollTop=scrollTop;
    if(focused)Array.from(body.querySelectorAll('[data-table-station]')).find(b=>b.dataset.tableStation===focused)?.focus({preventScroll:true});
    for(const th of panel.querySelectorAll('[data-sort]')){
      const chosen=th.dataset.sort===sortKey;if(chosen)th.setAttribute('aria-sort',sortDirection==='asc'?'ascending':'descending');else th.removeAttribute('aria-sort');
      th.querySelector('[aria-hidden]').textContent=chosen?(sortDirection==='asc'?'↑':'↓'):'↕';
    }
  }
  byId('atlas-map-view').onclick=()=>setView(false);byId('atlas-table-view').onclick=()=>setView(true);
  byId('atlas-wind-unit').onchange=e=>{if(Object.hasOwn(windFactors,e.target.value)){windUnit=e.target.value;draw();}};
  byId('atlas-region').onchange=e=>{region=e.target.value;panel.querySelector('.atlas-table-scroll').scrollTop=0;try{localStorage.setItem('atlas-table-region-v1',region);}catch{}draw();};
  byId('atlas-region-retry').onclick=()=>{loadBoundaries();draw();};
  for(const th of panel.querySelectorAll('[data-sort]'))th.querySelector('button').onclick=()=>{
    const key=th.dataset.sort;sortDirection=key===sortKey?(sortDirection==='asc'?'desc':'asc'):key==='value'||key==='time'?'desc':'asc';sortKey=key;draw();
  };
  byId('atlas-table-body').onclick=e=>{
    const button=e.target.closest('[data-table-station]');if(!button)return;
    try{selectStation(button.dataset.tableStation,false);draw();const detail=document.querySelector('.detail');detail.scrollIntoView({block:'nearest'});const title=byId('detail-content').querySelector('h2');title?.setAttribute('tabindex','-1');title?.focus({preventScroll:true});}
    catch(error){byId('atlas-table-warning').textContent=error.message;byId('atlas-table-warning').hidden=false;}
  };
  // Existing render()/refresh() already update these nodes, including failed refreshes.
  // Do not wrap or replace map rendering, station selection, refresh, or ranking handlers.
  const observer=new MutationObserver(queue);
  for(const id of ['point-count','load-status','notice','detail-content'])observer.observe(byId(id),{childList:true,subtree:true,characterData:true,attributes:id==='notice',attributeFilter:id==='notice'?['hidden']:undefined});
  window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
})();
