// Shared per-edge cache and single-flight request prevent each visitor downloading a grid.
let pressureBundle=null, pressurePending=null, pressureFailure=null;
async function pressureData(origin) {
 const core=globalThis.UKVPressure, now=Date.now();
 const cache=await observationCache(), key=new Request(origin+'/_cache/ukv-pressure-v1');
 const failureKey=new Request(origin+'/_cache/ukv-pressure-backoff-v1');
 const cached=await cachedJSON(cache,key);
 if(cached?.fetchedAt>(pressureBundle?.fetchedAt||0))pressureBundle=cached;
 if(core.frame(pressureBundle,now)&&now-pressureBundle.fetchedAt<3*core.HOUR)return pressureBundle;
 if(pressurePending)return pressurePending;
 const savedFailure=await cachedJSON(cache,failureKey);
 if(pressurePending)return pressurePending;
 if(savedFailure?.retryAt>now)pressureFailure=savedFailure;
 if(pressureFailure?.retryAt>now){
  if(core.frame(pressureBundle,now))return {...pressureBundle,warning:pressureFailure.message,retryAt:pressureFailure.retryAt};
  throw Object.assign(Error(pressureFailure.message),{retryAt:pressureFailure.retryAt});
 }
 pressurePending=(async()=>{
  try {
   const next=await core.load(fetch,now);
   if(!core.frame(next,now))throw Error('No current UKV pressure forecast is available.');
   pressureBundle=next;pressureFailure=null;
   if(cache)try{await cache.put(key,new Response(JSON.stringify(next),{headers:{'Cache-Control':'public,max-age=21600'}}));}catch{}
   return next;
  } catch(e) {
   pressureFailure={message:e.message,retryAt:e.retryAt||now+15*60000};
   if(cache)try{await cache.put(failureKey,new Response(JSON.stringify(pressureFailure),{headers:{'Cache-Control':'public,max-age='+Math.ceil((pressureFailure.retryAt-now)/1000)}}));}catch{}
   if(core.frame(pressureBundle,now))return {...pressureBundle,warning:pressureFailure.message,retryAt:pressureFailure.retryAt};
   throw Object.assign(e,{retryAt:pressureFailure.retryAt});
  }
 })().finally(()=>{pressurePending=null;});
 return pressurePending;
}
