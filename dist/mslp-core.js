'use strict';
// Geographic contours use sampled UKV values, never station observations.
globalThis.UKVPressure = (() => {
  const MODEL = 'ukmo_uk_deterministic_2km';
  const HOUR = 3600000;
  const GRID = {south:47.5, west:-17, rows:16, columns:24, step:1};
  function inDomain(lat, lon) {
    // UKV's spherical Lambert azimuthal equal-area grid, with a 4 km edge margin.
    const rad=Math.PI/180, p=lat*rad, p0=54.9*rad, dl=(lon+2.5)*rad;
    const k=Math.sqrt(2/(1+Math.sin(p0)*Math.sin(p)+Math.cos(p0)*Math.cos(p)*Math.cos(dl)));
    const x=6371229*k*Math.cos(p)*Math.sin(dl);
    const y=6371229*k*(Math.cos(p0)*Math.sin(p)-Math.sin(p0)*Math.cos(p)*Math.cos(dl));
    return x>=-1154000 && x<=920000 && y>=-1032000 && y<=898000;
  }
  function locations() {
    return Array.from({length:GRID.rows*GRID.columns}, (_, index) => {
      const lat=GRID.south+Math.floor(index/GRID.columns)*GRID.step;
      const lon=GRID.west+(index%GRID.columns)*GRID.step;
      return {index,lat,lon,inside:inDomain(lat,lon)};
    });
  }
  function requestURL(points, validTime) {
    // Include one spare past hour when cached observations straddle an hour change.
    const start=new Date(validTime*1000-4*HOUR).toISOString().slice(0,16);
    const end=new Date(validTime*1000+6*HOUR).toISOString().slice(0,16);
    const query=new URLSearchParams({latitude:points.map(p=>p.lat).join(','),longitude:points.map(p=>p.lon).join(','),models:MODEL,hourly:'pressure_msl',start_hour:start,end_hour:end,timeformat:'unixtime',cell_selection:'nearest'});
    return 'https://api.open-meteo.com/v1/forecast?'+query;
  }
  async function load(fetcher=fetch, now=Date.now()) {
    const validTime=Math.floor(now/HOUR)*3600, points=locations();
    const included=points.filter(p=>p.inside), samples=Array(points.length).fill(null);
    // Each location counts towards the free API quota. One grid uses <384 locations.
    // Fetch sequential batches, and reuse the complete bundle for an hour.
    for(let offset=0;offset<included.length;offset+=80) {
      const batch=included.slice(offset,offset+80);
      const response=await fetcher(requestURL(batch,validTime), {signal:AbortSignal.timeout(30000)});
      if(!response.ok){
        let reason='';try{reason=(await response.json()).reason||'';}catch{}
        const daily=response.status===429&&/daily/i.test(reason);
        const error=Error(daily?'The UKV provider’s daily allowance is exhausted; retrying after midnight UTC.':response.status===429?'The pressure feed is busy. Please try again later.':'The UKV pressure feed is temporarily unavailable.');
        error.retryAt=daily?Date.UTC(new Date(now).getUTCFullYear(),new Date(now).getUTCMonth(),new Date(now).getUTCDate()+1):now+15*60000;
        throw error;
      }
      const body=await response.json(), records=Array.isArray(body)?body:[body];
      if(records.length!==batch.length)throw Error('The UKV pressure grid is incomplete.');
      records.forEach((record,i)=>{
        const requested=batch[i];
        if(record.hourly_units?.pressure_msl!=='hPa' || !Array.isArray(record.hourly?.time) || !Array.isArray(record.hourly?.pressure_msl))throw Error('The UKV pressure feed returned an unexpected format.');
        if(!Number.isFinite(record.latitude)||!Number.isFinite(record.longitude)||Math.abs(record.latitude-requested.lat)>.1||Math.abs(record.longitude-requested.lon)>.15)throw Error('The UKV grid coordinates could not be verified.');
        samples[requested.index]={lat:record.latitude,lon:record.longitude,times:record.hourly.time,values:record.hourly.pressure_msl};
      });
    }
    return {version:1,model:MODEL,fetchedAt:now,validTime,samples};
  }
  function frame(bundle, now=Date.now(), selectedTime=now) {
    if(bundle?.version!==1||bundle.model!==MODEL||!Array.isArray(bundle.samples)||bundle.samples.length!==GRID.rows*GRID.columns||!Number.isFinite(bundle.fetchedAt)||bundle.fetchedAt>now+60000||now-bundle.fetchedAt>6*HOUR)return null;
    // Cache freshness uses the real clock; the selected hour can be in the past.
    const validTime=Math.floor(selectedTime/HOUR)*3600;
    const points=bundle.samples.map(sample=>{
      if(!sample||!Array.isArray(sample.times)||!Array.isArray(sample.values))return null;
      const value=sample.values[sample.times.indexOf(validTime)];
      return Number.isFinite(value)&&value>850&&value<1100&&Number.isFinite(sample.lat)&&Number.isFinite(sample.lon)?{lat:sample.lat,lon:sample.lon,value}:null;
    });
    return points.filter(Boolean).length>=points.length/2?{validTime,points}:null;
  }
  function contours(points, rows=GRID.rows, columns=GRID.columns, interval=2) {
    const values=points.filter(Boolean).map(p=>p.value).filter(Number.isFinite);
    if(!values.length||!Number.isFinite(interval)||interval<=0)return [];
    const result=[];
    for(let level=Math.ceil(Math.min(...values)/interval)*interval;level<=Math.max(...values);level+=interval) {
      const segments=[];
      for(let row=0;row<rows-1;row++)for(let col=0;col<columns-1;col++) {
        const cell=[points[row*columns+col],points[row*columns+col+1],points[(row+1)*columns+col+1],points[(row+1)*columns+col]];
        if(cell.some(p=>!p||!Number.isFinite(p.value)))continue;
        const cuts=[];
        for(let edge=0;edge<4;edge++) {
          const a=cell[edge],b=cell[(edge+1)%4];
          if((a.value>=level)===(b.value>=level))continue;
          const t=(level-a.value)/(b.value-a.value);
          cuts.push([a.lat+t*(b.lat-a.lat),a.lon+t*(b.lon-a.lon)]);
        }
        if(cuts.length===2)segments.push(cuts);
        else if(cuts.length===4) {
          const centre=cell.reduce((sum,p)=>sum+p.value,0)/4;
          if((centre>=level)===(cell[0].value>=level))segments.push([cuts[0],cuts[1]],[cuts[2],cuts[3]]);
          else segments.push([cuts[0],cuts[3]],[cuts[1],cuts[2]]);
        }
      }
      const key=p=>p.map(n=>n.toFixed(6)).join(','), nodes=new Map(), edges=[];
      for(const [a,b]of segments) {
        const ka=key(a),kb=key(b);if(ka===kb)continue;
        const index=edges.length;edges.push({a,b,ka,kb,used:false});
        for(const k of [ka,kb]){if(!nodes.has(k))nodes.set(k,[]);nodes.get(k).push(index);}
      }
      function walk(start,index) {
        const line=[];let current=start;
        while(index!==undefined) {
          const edge=edges[index];if(edge.used)break;edge.used=true;
          const forward=edge.ka===current;
          if(!line.length)line.push(forward?edge.a:edge.b);
          line.push(forward?edge.b:edge.a);current=forward?edge.kb:edge.ka;
          index=nodes.get(current).find(i=>!edges[i].used);
        }
        if(line.length>1)result.push({level,latlngs:line});
      }
      for(const [k,indices]of nodes)if(indices.length===1&&!edges[indices[0]].used)walk(k,indices[0]);
      edges.forEach((edge,i)=>{if(!edge.used)walk(edge.ka,i);});
    }
    return result;
  }
  return {MODEL,HOUR,GRID,inDomain,locations,requestURL,load,frame,contours};
})();
