import test from 'node:test';
import assert from 'node:assert/strict';
import {observationHistory} from '../src/decoder.mjs';
import '../dist/observation-history.js';
import '../dist/rankings.js';
import '../dist/mslp-core.js';

const now=Date.UTC(2026,9,23,1,15)/1000;
const directory=[{id:'03772',wmo:'03772',icao:'EGLL',name:'Heathrow',lat:51.48,lon:-.45,inScope:true,end:'----'}];
const syn=(time,groups)=>({id:'03772',kind:'SYNOP',time,raw:'AAXX 23011 03772 27580 82705 '+groups+'='});
const met=(time,temp)=>({id:'EGLL',kind:'METAR',time,raw:`METAR EGLL 230115Z 24012KT CAVOK ${temp}/05 Q1010=`});

test('hourly snapshots cross midnight, exclude future reports and retain partial readings',()=>{
 const feeds={SYNOP:[syn(now-3*3600,'10150 333 91012'),syn(now-2*3600,'10130'),syn(now-3600,'10110'),syn(now-3600+1,'10250'),syn(now,'10090')],METAR:[met(now-2*3600,14),met(now,10)]};
 const history=observationHistory(directory,feeds,now);
 assert.deepEqual(history.map(f=>f.asOf),[now-3600,now-7200,now-10800]);
 assert.deepEqual(history.map(f=>f.stations[0].fields.temperature.SYNOP.value),[11,13,15]);
 assert.equal(history[0].stations[0].fields.temperature.METAR.value,14);
 assert.equal(history[0].stations[0].fields.gust.SYNOP.time,now-10800);
 for(const frame of history)for(const s of frame.stations){
  for(const r of Object.values(s.reports))assert.ok(r.time<=frame.asOf);
  for(const values of Object.values(s.fields))for(const r of Object.values(values))assert.ok(r.time<=frame.asOf);
 }
 assert.equal(history[0].stations[0].reports.SYNOP.time,now-3600);
 const bundle={fetchedAt:now,stations:[],history};
 const selected=WeatherHistory.frame(bundle,3);
 assert.equal(WeatherHistory.time(bundle,3,now+600),now-10800);
 assert.equal(WeatherRankings.rank(selected.stations,WeatherRankings.definitions.warmest,{now:selected.asOf}).rows[0].reading.value,15);
 assert.equal(WeatherHistory.frame(bundle,0),bundle);
 assert.equal(WeatherHistory.frame({stations:[]},3),null);
 assert.equal(WeatherHistory.frame(bundle,4),null);
});

test('oldest frame retains full six-hour METAR and 24-hour SYNOP age windows',()=>{
 const asOf=now-10800;
 const history=observationHistory(directory,{SYNOP:[syn(asOf-86400,'10150')],METAR:[met(asOf-21600,14)]},now);
 assert.equal(history[2].stations[0].fields.temperature.METAR.time,asOf-21600);
 assert.equal(history[2].stations[0].fields.temperature.SYNOP.time,asOf-86400);
 assert.equal(history[0].stations.length,0);
});

test('marine snapshots rewind coordinates and never carry values between positions',()=>{
 const ship=(time,pos,groups)=>({id:'CALL1',kind:'SHIP',time,raw:`BBXX CALL1 23011 ${pos} 46/// ${groups}=`});
 const history=observationHistory([],{SHIP:[ship(now-10800,'99540 70090','/27008 10125'),ship(now-7200,'99542 70092','///// 40123'),ship(now,'99390 70700','/27008 10150')]},now);
 assert.equal(history[2].stations[0].lon,-9);
 assert.equal(history[2].stations[0].fields.temperature.SHIP.value,12.5);
 assert.equal(history[1].stations[0].lon,-9.2);
 assert.equal(history[1].stations[0].fields.temperature,undefined);
});

test('UKV selects the historical valid hour without treating retrieval time as forecast time',()=>{
 const core=UKVPressure,realNow=now*1000,base=Math.floor(realNow/core.HOUR)*3600;
 const bundle={version:1,model:core.MODEL,fetchedAt:realNow,samples:core.locations().map(p=>({...p,times:[base-10800,base-7200,base-3600,base],values:[1000,1004,1008,1012]}))};
 for(let back=0;back<=3;back++){
  const frame=core.frame(bundle,realNow,realNow-back*core.HOUR);
  assert.equal(frame.validTime,base-back*3600);
  assert.equal(frame.points[0].value,1012-back*4);
 }
 assert.equal(core.frame(bundle,realNow,realNow-4*core.HOUR),null);
 assert.equal(core.frame({...bundle,fetchedAt:realNow-4*core.HOUR},realNow,realNow-core.HOUR),null);
});
