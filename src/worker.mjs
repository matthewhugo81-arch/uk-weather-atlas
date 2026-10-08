let memoryData=null,expires=0,pending=null,directoryCache=null,directoryExpires=0;
const ua='UKWeatherAtlas/2.0 (personal station observation map)';
async function sourceText(url){const response=await fetch(url,{headers:{'User-Agent':ua,'Accept':'text/plain,text/html;q=0.8'},signal:AbortSignal.timeout(25000)});if(!response.ok)throw Error(`OGIMET responded ${response.status}`);return response.text();}
function stamp(date){return date.toISOString().replace(/[-:T]/g,'').slice(0,12);}
// Dispatch namespaces disable caches.default. Use an isolated named cache instead.
async function observationCache(){try{return typeof caches==='undefined'?null:await caches.open('uk-ireland-observation-fields-v5');}catch(e){console.warn('Observation cache unavailable:',e.message);return null;}}
async function cachedJSON(cache,key){if(!cache)return null;try{const hit=await cache.match(key);return hit?await hit.json():null;}catch(e){console.warn('Observation cache read failed:',e.message);return null;}}
function cacheJSON(cache,key,value,ttl,ctx){if(!cache)return;const task=(async()=>{try{await cache.put(key,new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json','Cache-Control':`public,max-age=${ttl}`}}));}catch(e){console.warn('Observation cache write failed:',e.message);}})();if(typeof ctx?.waitUntil==='function')ctx.waitUntil(task);}
async function observationData(origin,ctx){
 const now=Date.now();if(memoryData&&now<expires)return memoryData;if(pending)return pending;
 pending=(async()=>{
  const edgeCache=await observationCache(),key=new Request(origin+'/_cache/ogimet-observations-v5');
  const hit=await cachedJSON(edgeCache,key);if(hit?.success&&Array.isArray(hit.stations)&&Number.isFinite(hit.nextRefreshAt)){expires=Math.min(now+600000,hit.nextRefreshAt*1000);if(expires>now){memoryData=hit;return memoryData;}}
  const warnings=[];let directory=directoryCache||STATION_DIRECTORY;
  if(now>directoryExpires){try{const dk=new Request(origin+'/_cache/ogimet-stations-v4');const cached=await cachedJSON(edgeCache,dk);if(Array.isArray(cached)&&cached.some(s=>s.country==='Ireland'))directory=cached;else{const rows=await Promise.all(['United Kingdom','Ireland'].map(async country=>{const parsed=parseDirectory(await sourceText(`https://www.ogimet.com/display_stations.php?lang=en&tipo=AND&estado=${encodeURIComponent(country)}`));if(parsed.length<(country==='Ireland'?10:30))throw Error('Station directory incomplete');return parsed;}));directory=rows.flat();cacheJSON(edgeCache,dk,directory,86400,ctx);}directoryCache=directory;directoryExpires=now+86400000;}catch(e){console.warn('OGIMET station directory unavailable:',e.message);warnings.push('The live station directory is unavailable; using the bundled UK and Ireland directory from 8 October 2026.');directoryExpires=now+600000;}}
  const start=stamp(new Date(now-6*3600000)),end=stamp(new Date(now)),feeds={},sources={};
  const query=`begin=${start}&end=${end}&lang=eng&header=yes`;
  const summaryQuery=`begin=${stamp(new Date(now-24*3600000))}&end=${end}&lang=eng&header=yes`;
  const jobs=['SYNOP','METAR'].flatMap(kind=>['United Kingdom','Ireland'].map(country=>({kind,country,url:`https://www.ogimet.com/cgi-bin/get${kind.toLowerCase()}?${kind==='SYNOP'?summaryQuery:query}&state=${encodeURIComponent(country)}`})));
  jobs.push({kind:'SHIP',country:'Nearby seas',url:`https://www.ogimet.com/cgi-bin/getsynop?${query}&ship=yes`},{kind:'BUOY',country:'Nearby seas',url:`https://www.ogimet.com/cgi-bin/getbuoy?${query}`});
  const results=await Promise.all(jobs.map(async job=>{try{return {...job,ok:true,reports:parseCSV(await sourceText(job.url),job.kind)};}catch(e){return {...job,ok:false,reports:[],error:e.message};}}));
  for(const result of results){feeds[result.kind]??=[];feeds[result.kind].push(...result.reports);sources[result.kind]??={ok:false,reportCount:0,feeds:[]};sources[result.kind].ok ||= result.ok;sources[result.kind].reportCount+=result.reports.length;sources[result.kind].feeds.push({country:result.country,url:result.url,ok:result.ok,error:result.error});if(!result.ok)warnings.push(`${result.country} ${result.kind} reports could not be retrieved from OGIMET.`);}
  const data=combineReports(directory,{SYNOP:feeds.SYNOP,METAR:feeds.METAR},now/1000),marine=combineMarine([...feeds.SHIP,...feeds.BUOY],now/1000);data.stations.push(...marine.stations);if(data.unmapped.length)warnings.push(`${data.unmapped.length} land-station identifiers could not be matched to coordinates and are not plotted.`);
  const success=Object.values(sources).some(s=>s.ok),ttl=success?(warnings.length?300:600):60;
  memoryData={...data,unpositionedMarine:marine.unpositioned.length,fetchedAt:Math.floor(now/1000),nextRefreshAt:Math.floor(now/1000)+ttl,sources,warnings,registryCount:directory.length,provider:'OGIMET',scope:'UK, Ireland and nearby seas (marine: 47.5–62.5°N, 17°W–6°E)',success};expires=now+ttl*1000;
  if(success)cacheJSON(edgeCache,key,memoryData,ttl,ctx);
  return memoryData;
 })().finally(()=>{pending=null;});return pending;
}
export default {async fetch(request,env,ctx={waitUntil:()=>{}}){
 const url=new URL(request.url);if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 if(url.pathname==='/api/observations'){
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
  if(request.headers.get('Origin')==='https://matthewhugo81-arch.github.io')headers['Access-Control-Allow-Origin']='https://matthewhugo81-arch.github.io';
  try{const data=await observationData(url.origin,ctx);return new Response(request.method==='HEAD'?null:JSON.stringify(data),{status:data.success?200:502,headers});}catch(e){console.error('Observation pipeline failed:',e.message);return new Response(JSON.stringify({error:'Observations are temporarily unavailable. Please try again shortly.'}),{status:502,headers});}
 }
 const path=url.pathname==='/'?'/index.html':url.pathname,asset=ASSETS[path];if(!asset)return new Response('Not found',{status:404});
 const body=asset.base64?Uint8Array.from(atob(asset.data),c=>c.charCodeAt(0)):asset.data;
 return new Response(request.method==='HEAD'?null:body,{headers:{'Content-Type':asset.type,'Cache-Control':'public,max-age=300','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'}});
}};
