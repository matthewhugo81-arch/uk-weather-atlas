import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const originalFetch=globalThis.fetch,originalCaches=Object.getOwnPropertyDescriptor(globalThis,'caches');
const directory=JSON.parse(fs.readFileSync('src/stations.json','utf8'));
let sequence=0;
async function freshWorker(){return (await import(`../dist/server/index.js?test=${++sequence}`)).default;}
function installSources(){let calls=0;globalThis.fetch=async url=>{calls++;if(String(url).includes('display_stations'))return new Response('Unavailable',{status:503});const d=new Date(),fields=[d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate(),d.getUTCHours(),d.getUTCMinutes()].map((v,i)=>String(v).padStart(i===0?4:2,'0'));const raw=String(url).includes('getsynop')?`03772,${fields.join(',')},AAXX ${fields[2]}${fields[3]}4 03772 25983 03106 10104 20073 30115 40145=`:`EGLL,${fields.join(',')},METAR EGLL ${fields[2]}${fields[3]}${fields[4]}Z 31007KT 9999 NCD 11/06 Q1015=`;return new Response(raw);};return ()=>calls;}
function installCache(open){Object.defineProperty(globalThis,'caches',{configurable:true,value:{get default(){throw Error('caches.default is disabled in dispatch namespace');},open}});}
test.after(()=>{globalThis.fetch=originalFetch;if(originalCaches)Object.defineProperty(globalThis,'caches',originalCaches);else delete globalThis.caches;});
test('public observation API allows the GitHub map origin without granting credentials',async()=>{
 installCache(async()=>null);installSources();const worker=await freshWorker();
 for(const origin of ['https://matthewhugo81-arch.github.io','https://other.example']){
  const response=await worker.fetch(new Request('https://weather.test/api/observations',{headers:{Origin:origin}}));
  assert.equal(response.status,200);assert.equal(response.headers.get('Vary'),'Origin');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin==='https://matthewhugo81-arch.github.io'?origin:null);
  assert.equal(response.headers.get('Access-Control-Allow-Credentials'),null);
 }
});
test('dispatch cache restrictions do not stop observations; named cache survives new worker',async()=>{
 const entries=new Map(),pending=[];let opened='';const calls=installSources();
 installCache(async name=>{opened=name;return {match:async key=>entries.get(key.url)?.clone(),put:async(key,response)=>entries.set(key.url,response.clone())};});
 entries.set('https://weather.test/_cache/ogimet-stations-v4',new Response(JSON.stringify(directory)));
 const ctx={waitUntil:p=>pending.push(p)},request=new Request('https://weather.test/api/observations');
 const worker=await freshWorker();let response=await worker.fetch(request,{},ctx);const data=await response.json();
 assert.equal(response.status,200);assert.equal(data.success,true);assert.equal(data.stations.length,1);assert.equal(data.sources.METAR.ok,true);assert.equal(data.sources.SYNOP.ok,true);assert.equal(opened,'uk-ireland-observation-fields-v7');assert.equal(calls(),6);
 await Promise.all(pending);response=await (await freshWorker()).fetch(request,{},ctx);assert.equal(response.status,200);assert.equal(calls(),6,'a new worker should reuse the named cache');
});
test('cache read/write or open failure cannot suppress valid feed data',async()=>{
 for(const open of [async()=>{throw Error('cache disabled');},async()=>({match:async()=>{throw Error('read failed');},put:async()=>{throw Error('write failed');}})]){
  const pending=[];installCache(open);const calls=installSources();const worker=await freshWorker();const request=new Request('https://weather.test/api/observations');
  const response=await worker.fetch(request,{}, {waitUntil:p=>pending.push(p)});const data=await response.json();await Promise.all(pending);
  assert.equal(response.status,200);assert.equal(data.stations.length,1);assert.equal(calls(),8);
  assert.equal((await worker.fetch(request)).status,200);assert.equal(calls(),8,'memory cache still limits source requests');
 }
});

test('daily SYNOP failure falls back to nine hours and still returns the timeline',async()=>{
 installCache(async()=>null);installSources();const normal=globalThis.fetch;let fallbacks=0;
 const timestamp=s=>Date.UTC(+s.slice(0,4),+s.slice(4,6)-1,+s.slice(6,8),+s.slice(8,10),+s.slice(10,12));
 globalThis.fetch=async url=>{
  const u=new URL(url);
  if(u.pathname.endsWith('/getsynop')&&u.searchParams.has('state')){
   const hours=(timestamp(u.searchParams.get('end'))-timestamp(u.searchParams.get('begin')))/3600000;
   if(hours>24)throw Error('daily query timeout');
   assert.equal(hours,9);fallbacks++;
  }
  return normal(url);
 };
 const response=await (await freshWorker()).fetch(new Request('https://weather.test/api/observations'));
 const data=await response.json();assert.equal(response.status,200);assert.equal(fallbacks,2);
 assert.equal(data.sources.SYNOP.ok,true);assert.ok(data.stations[0].fields.temperature.SYNOP);
 assert.equal(data.warnings.filter(w=>w.includes('daily SYNOP retrieval failed')).length,2);
 assert.deepEqual(data.history.map(f=>f.asOf),[1,2,3].map(n=>data.fetchedAt-n*3600));
});
