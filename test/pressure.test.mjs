import test from 'node:test';
import assert from 'node:assert/strict';
import '../dist/mslp-core.js';
const core=globalThis.UKVPressure;

test('geographic isobars interpolate a known east-west pressure gradient',()=>{
  const points=[];
  for(let lat=50;lat<=52;lat++)for(let lon=-2;lon<=0;lon++)points.push({lat,lon,value:1001+(lon+2)*4});
  const lines=core.contours(points,3,3,2);
  assert.deepEqual(lines.map(l=>l.level),[1002,1004,1006,1008]);
  for(const line of lines){assert.equal(line.latlngs[0][0],50);assert.equal(line.latlngs.at(-1)[0],52);for(const [lat,lon]of line.latlngs){assert.ok(lat>=50&&lat<=52);assert.equal(lon,-2+(line.level-1001)/4);}}
});

test('closed pressure systems remain closed and missing cells are never bridged',()=>{
  const points=[];
  for(let y=0;y<3;y++)for(let x=0;x<3;x++)points.push({lat:50+y,lon:-2+x,value:x===1&&y===1?996:1004});
  const closed=core.contours(points,3,3,2).find(line=>line.level===1000);
  assert.deepEqual(closed.latlngs[0],closed.latlngs.at(-1));
  points[4]=null;assert.deepEqual(core.contours(points,3,3,2),[]);
});

test('UKV domain clipping and explicit model selection cannot fall back to global forecasts',()=>{
  assert.equal(core.inDomain(51.5,-.1),true);
  assert.equal(core.inDomain(40,-30),false);
  const points=core.locations().filter(p=>p.inside);
  assert.ok(points.length<384&&points.length>300);
  const url=new URL(core.requestURL(points.slice(0,2),Date.UTC(2026,9,11,14)/1000));
  assert.equal(url.searchParams.get('models'),'ukmo_uk_deterministic_2km');
  assert.equal(url.searchParams.get('hourly'),'pressure_msl');
  assert.equal(url.searchParams.get('cell_selection'),'nearest');
  assert.equal(url.searchParams.get('start_hour'),'2026-10-11T10:00');
  assert.equal(url.searchParams.get('end_hour'),'2026-10-11T16:00');
});

test('only the current forecast hour is drawn; nulls and expired bundles stay missing',()=>{
  const now=Date.UTC(2026,9,11,14,30), time=Math.floor(now/core.HOUR)*3600;
  const bundle={version:1,model:core.MODEL,fetchedAt:now, samples:core.locations().map(p=>({lat:p.lat,lon:p.lon,times:[time,time+3600],values:[1012,1014]}))};
  bundle.samples[0].values[0]=null;
  assert.equal(core.frame(bundle,now).points[0],null);
  assert.equal(core.frame(bundle,now).points[1].value,1012);
  assert.equal(core.frame(bundle,now+core.HOUR).points[1].value,1014);
  assert.equal(core.frame(bundle,now+2*core.HOUR),null);
  assert.equal(core.frame({...bundle,model:'ukmo_seamless'},now),null);
  assert.equal(core.frame({...bundle,fetchedAt:now-4*core.HOUR},now),null);
});

test('bad units, shifted coordinates and throttling abort the grid download',async()=>{
  const now=Date.UTC(2026,9,11,14);
  await assert.rejects(core.load(async()=>({ok:false,status:429}),now),/busy/);
  function response(url,change){const q=new URL(url).searchParams,lats=q.get('latitude').split(',').map(Number),lons=q.get('longitude').split(',').map(Number);return {ok:true,json:async()=>lats.map((lat,i)=>change({latitude:lat,longitude:lons[i],hourly_units:{pressure_msl:'hPa'},hourly:{time:[now/1000],pressure_msl:[1012]}}))};}
  await assert.rejects(core.load(async url=>response(url,r=>({...r,hourly_units:{pressure_msl:'Pa'}})),now),/format/);
  await assert.rejects(core.load(async url=>response(url,r=>({...r,latitude:r.latitude+1})),now),/coordinates/);
  const bundle=await core.load(async url=>response(url,r=>r),now);
  assert.equal(core.frame(bundle,now).points.filter(Boolean).length,core.locations().filter(p=>p.inside).length);
});
