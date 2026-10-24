import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const coreSource=fs.readFileSync('dist/mslp-core.js','utf8');
const cacheSource=fs.readFileSync('src/pressure-cache.mjs','utf8');
function harness(entries,fetcher){
 const cache={match:async k=>entries.get(k.url)?.clone(),put:async(k,v)=>entries.set(k.url,v.clone())};
 const ctx=vm.createContext({Date,URLSearchParams,AbortSignal,Request,Response,fetch:fetcher,observationCache:async()=>cache,cachedJSON:async(c,k)=>{const r=await c.match(k);return r?await r.json():null;}});
 vm.runInContext(coreSource+'\n'+cacheSource,ctx);return ctx;
}
test('concurrent visitors and fresh isolates reuse one complete UKV grid',async()=>{
 let calls=0;const entries=new Map();
 const fetcher=async url=>{calls++;const q=new URL(url).searchParams;const lat=q.get('latitude').split(',').map(Number),lon=q.get('longitude').split(',').map(Number);return new Response(JSON.stringify(lat.map((v,i)=>({latitude:v,longitude:lon[i],hourly_units:{pressure_msl:'hPa'},hourly:{time:[Math.floor(Date.now()/3600000)*3600],pressure_msl:[1012]}}))));};
 const ctx=harness(entries,fetcher);
 await Promise.all([ctx.pressureData('https://test'),ctx.pressureData('https://test')]);assert.equal(calls,5);
 await harness(entries,fetcher).pressureData('https://test');assert.equal(calls,5);
});
test('daily limits persist a midnight backoff across visitors and isolates',async()=>{
 let calls=0;const entries=new Map(),fetcher=async()=>{calls++;return new Response(JSON.stringify({reason:'Daily API request limit exceeded. Please try again tomorrow.'}),{status:429});};
 for(let i=0;i<2;i++)await assert.rejects(harness(entries,fetcher).pressureData('https://test'),e=>/daily allowance/.test(e.message)&&new Date(e.retryAt).getUTCHours()===0);
 assert.equal(calls,1);
});
