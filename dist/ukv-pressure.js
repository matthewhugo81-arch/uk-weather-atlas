'use strict';
globalThis.WeatherPressureLayer = {attach(map) {
  const core=UKVPressure, $=id=>document.getElementById(id);
  const toggle=$('ukv-mslp'), status=$('ukv-status'), options=$('ukv-options'), caption=$('ukv-map-caption');
  const cacheKey='ukv-pressure-grid-v1', settingsKey='ukv-pressure-settings-v1', attemptKey='ukv-pressure-attempt-v1';
  const read=key=>{try{return JSON.parse(localStorage.getItem(key));}catch{return null;}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
  let bundle=read(cacheKey), pending=false, lines=[], lastFrame=null, retryAt=0, lastError='';
  const pane=map.createPane('ukvPressure');pane.style.zIndex='325';pane.style.pointerEvents='none';
  const labelPane=map.createPane('ukvPressureLabels');labelPane.style.zIndex='350';labelPane.style.pointerEvents='none';
  const renderer=L.svg({pane:'ukvPressure'}), layer=L.layerGroup(), labels=L.layerGroup();
  const attribution='UKV: <a href="https://open-meteo.com/en/docs/ukmo-api">Met Office / Open-Meteo</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>';
  const stamp=t=>new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(t))+' UTC';
  function saveSettings(){write(settingsKey,{enabled:toggle.checked,interval:Number($('ukv-interval').value),opacity:Number($('ukv-opacity').value)});}
  function clear(){layer.clearLayers();labels.clearLayers();lines=[];lastFrame=null;caption.hidden=true;}
  function placeLabels() {
    labels.clearLayers();if(!toggle.checked||!lines.length)return;
    const size=map.getSize(), occupied=[];
    const mapRect=map.getContainer().getBoundingClientRect();
    const blockers=[...document.querySelectorAll('.map-heading,.map-tools,.map-bottom')].map(el=>el.getBoundingClientRect());
    for(const line of lines) {
      let travelled=170, previous=null;
      for(let i=1;i<line.latlngs.length;i++) {
        const a=map.latLngToContainerPoint(line.latlngs[i-1]),b=map.latLngToContainerPoint(line.latlngs[i]);
        if((a.x<0&&b.x<0)||(a.x>size.x&&b.x>size.x)||(a.y<0&&b.y<0)||(a.y>size.y&&b.y>size.y)){previous=null;continue;}
        const length=a.distanceTo(b), steps=Math.max(1,Math.ceil(length/100));
        for(let j=1;j<=steps;j++) {
          const f=j/steps,p=L.point(a.x+(b.x-a.x)*f,a.y+(b.y-a.y)*f);
          if(previous)travelled+=previous.distanceTo(p);previous=p;
          if(travelled<170||p.x<45||p.x>size.x-45||p.y<45||p.y>size.y-45||occupied.some(q=>Math.abs(q.x-p.x)<75&&Math.abs(q.y-p.y)<32))continue;
          if(blockers.some(r=>p.x+mapRect.left>r.left-24&&p.x+mapRect.left<r.right+24&&p.y+mapRect.top>r.top-12&&p.y+mapRect.top<r.bottom+12))continue;
          occupied.push(p);travelled=0;
          L.marker(map.containerPointToLatLng(p),{pane:'ukvPressureLabels',interactive:false,keyboard:false,icon:L.divIcon({className:'ukv-pressure-label',html:String(line.level),iconSize:[42,20],iconAnchor:[21,10]})}).addTo(labels);
        }
      }
    }
  }
  function draw() {
    if(!toggle.checked)return;
    const frame=core.frame(bundle);
    if(!frame){clear();return false;}
    const key=bundle.fetchedAt+':'+frame.validTime+':'+$('ukv-interval').value;
    if(lastFrame!==key) {
      layer.clearLayers();lines=core.contours(frame.points,core.GRID.rows,core.GRID.columns,Number($('ukv-interval').value));
      for(const line of lines) {
        const base={renderer,pane:'ukvPressure',interactive:false,smoothFactor:0.3};
        L.polyline(line.latlngs,{...base,color:'#ffffff',weight:4,opacity:0.85,className:'ukv-isobar-halo'}).addTo(layer);
        L.polyline(line.latlngs,{...base,color:'#344e63',weight:1.5,opacity:1,className:'ukv-isobar'}).addTo(layer);
      }
      lastFrame=key;placeLabels();
    }
    caption.hidden=false;caption.textContent='UKV MSLP · '+stamp(frame.validTime*1000)+' · '+$('ukv-interval').value+' hPa isobars';
    status.textContent='Valid '+stamp(frame.validTime*1000)+'. Retrieved '+stamp(bundle.fetchedAt)+'.';
    return true;
  }
  async function update() {
    if(!toggle.checked||pending||document.hidden)return;
    const shared=read(cacheKey);if(shared?.fetchedAt>(bundle?.fetchedAt||0))bundle=shared;
    const shown=draw(), now=Date.now();
    if(shown&&now-bundle.fetchedAt<core.HOUR)return;
    if(now<retryAt){status.textContent=(shown?status.textContent+' Saved forecast; update unavailable. ':'UKV layer unavailable. ')+lastError;return;}
    // Share a brief request lock/backoff across tabs, including full page reloads.
    const attempt=read(attemptKey);
    if(Number.isFinite(attempt)&&now-attempt<5*60000){status.textContent+=(shown?' ':'')+'Pressure update is waiting; it will retry automatically.';return;}
    write(attemptKey,now);pending=true;status.textContent=shown?'Updating UKV pressure… Saved forecast remains visible.':'Loading UKV pressure…';
    try {
      const next=await core.load();
      if(!core.frame(next))throw Error('No current UKV pressure forecast is available.');
      bundle=next;write(cacheKey,bundle);retryAt=0;lastError='';
      if(toggle.checked)draw();
    } catch(error) {
      retryAt=Date.now()+5*60000;lastError=error.message;
      if(toggle.checked){const retained=draw();status.textContent=(retained?status.textContent+' Saved forecast; update unavailable. ': 'UKV layer unavailable. ')+error.message;}
    } finally {pending=false;}
  }
  function change() {
    saveSettings();options.hidden=!toggle.checked;status.hidden=!toggle.checked;
    if(toggle.checked){layer.addTo(map);labels.addTo(map);map.attributionControl.addAttribution(attribution);update();placeLabels();}
    else {map.removeLayer(layer);map.removeLayer(labels);map.attributionControl.removeAttribution(attribution);caption.hidden=true;}
  }
  const saved=read(settingsKey);
  toggle.checked=saved?.enabled===true;
  if([2,4].includes(saved?.interval))$('ukv-interval').value=String(saved.interval);
  if(saved?.opacity>=30&&saved.opacity<=100)$('ukv-opacity').value=String(saved.opacity);
  function opacity(){pane.style.opacity=labelPane.style.opacity=Number($('ukv-opacity').value)/100;saveSettings();}
  toggle.addEventListener('change',change);
  $('ukv-interval').addEventListener('change',()=>{saveSettings();draw();});
  $('ukv-opacity').addEventListener('input',opacity);
  map.on('moveend zoomend resize',placeLabels);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)update();});
  setInterval(update,60000);
  opacity();change();
}};
