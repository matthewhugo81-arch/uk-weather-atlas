import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeMetar,decodeSynop,parseCSV,parseDirectory,combineReports} from '../src/decoder.mjs';
const time=Date.UTC(2026,9,7,20)/1000;
const metar=raw=>decodeMetar({id:'EGLL',kind:'METAR',time,raw});
const synop=raw=>decodeSynop({id:'03772',kind:'SYNOP',time,raw});
test('METAR separates QNH, retains qualifiers and excludes trend forecasts',()=>{
 const r=metar('METAR EGLL 072000Z 24012G24KT 9999 -RA BKN012 M02/M04 Q0998 TEMPO 2000 SN OVC004=');
 assert.equal(r.temperature.value,-2);assert.equal(r.dewpoint.value,-4);
 assert.equal(r.qnh.value,998);assert.equal(r.pressure_msl,undefined);
 assert.equal(r.visibility.value,10);assert.equal(r.visibility.qualifier,'≥');
 assert.equal(r.weather.code,'-RA');assert.equal(r.metar_cloud.value,'BKN');
 assert.ok(Math.abs(r.gust.value-27.6187)<.001);assert.equal(r.humidity.derived,true);
 assert.equal(r.temperature.time,time);assert.ok(r.temperature.raw.includes('TEMPO'));
});
test('CAVOK is not a numerical cloud amount, missing wind gusts stay missing',()=>{
 const r=metar('EGLL 072000Z VRB02KT CAVOK 12/08 Q1018=');
 assert.equal(r.metar_cloud.value,'CAVOK');assert.equal(r.cloud,undefined);
 assert.equal(r.direction.value,'VRB');assert.equal(r.gust,undefined);
 assert.equal(r.visibility.value,10);assert.equal(r.weather.code,'CAVOK');
});
test('METAR poor visibility is less than 50m, obscured cloud and missing temperature survive',()=>{
 const r=metar('EGLL 072000Z 00000KT 0000 FG VV/// ///// Q1005=');
 assert.equal(r.visibility.value,.05);assert.equal(r.visibility.qualifier,'<');
 assert.equal(r.metar_cloud.value,'Obscured');assert.equal(r.temperature,undefined);
 assert.equal(r.humidity,undefined);assert.equal(r.direction.note,'Calm');
});
test('SYNOP decodes pressure, cloud, wind units, current weather and hourly trace',()=>{
 const r=synop('AAXX 07201 03772 27580 82705 10126 20120 39980 40123 72300 333 69905 91012 91120=');
 assert.equal(r.temperature.value,12.6);assert.equal(r.dewpoint.value,12);
 assert.equal(r.surface_pressure.value,998);assert.equal(r.pressure_msl.value,1012.3);
 assert.equal(r.cloud.value,8);assert.equal(r.direction.value,270);
 assert.ok(Math.abs(r.wind.value-11.18468)<.001);
 assert.equal(r.weather.table,'4680');assert.equal(r.weather.code,23);
 assert.equal(r.precip_1h.value,0);assert.equal(r.precip_1h.qualifier,'trace');
 assert.ok(Math.abs(r.gust.value-26.84323)<.001); // 910, not the different 911 period
});
test('SYNOP preserves tenths, accumulation period and missing groups',()=>{
 const r=synop('AAXX 07204 03772 11590 9//// 11025 29086 49985 60021=');
 assert.equal(r.temperature.value,-2.5);assert.equal(r.humidity.value,86);
 assert.equal(r.humidity.derived,undefined);assert.equal(r.dewpoint,undefined);
 assert.equal(r.cloud.value,'Obscured');assert.equal(r.wind,undefined);
 assert.equal(r.precip_6h.value,2);assert.equal(r.precip_6h.hours,6);
 assert.equal(r.visibility.value,.05);assert.equal(r.visibility.qualifier,'<');
 assert.equal(r.pressure_msl.value,998.5);
 assert.equal(synop('AAXX 07204 03772 21580 80000 333 69915=').precip_1h.value,.1);
});
test('SYNOP radiation and unknown wind units are never invented as rain or gusts',()=>{
 const r=synop('AAXX 0720/ 03772 27580 82705 10126 333 55055 60005 91012=');
 assert.equal(r.wind,undefined);assert.equal(r.gust,undefined);assert.equal(r.precip_1h,undefined);
});
test('CSV handles NIL and rejects HTML failures',()=>{
 const rows=parseCSV('EGLL,2026,10,07,20,00,METAR EGLL 072000Z NIL=\nEGKK,2026,10,07,20,00,METAR EGKK 072000Z 00000KT CAVOK 12/10 Q1010=','METAR');
 assert.equal(rows.length,2);assert.equal(rows[0].nil,true);assert.equal(rows[0].time,time);
 assert.throws(()=>parseCSV('<html>Unavailable</html>','METAR'));
});
test('partial updates retain earlier observations with their original times',()=>{
 const info={id:'03772',wmo:'03772',icao:'EGLL',lat:51.48,lon:-.45,inScope:true,end:'----'};
 const syn=(raw,offset)=>({id:'03772',kind:'SYNOP',raw,time:time+offset});
 const result=combineReports([info],{SYNOP:[
  syn('AAXX 07191 03772 27580 82705 10126 333 60055 91012=',-3600),
  syn('AAXX 07201 03772 27580 82705 10136=',0)
 ],METAR:[{id:'EGLL',kind:'METAR',time,raw:'METAR EGLL 072000Z 20003KT CAVOK 14/10 Q1010='}]},time);
 assert.equal(result.stations.length,1);const s=result.stations[0];
 assert.equal(s.fields.temperature.SYNOP.value,13.6);assert.equal(s.fields.temperature.METAR.value,14);
 assert.equal(s.fields.gust.SYNOP.time,time-3600);assert.equal(s.fields.precip_1h.SYNOP.time,time-3600);
 assert.deepEqual(result.unmapped,[]);
});
test('SYNOP 24-hour total has tenths precision and special trace or threshold codes',()=>{
 assert.equal(synop('AAXX 07201 03772 27580 82705 333 70079=').precip_24h.value,7.9);
 assert.equal(synop('AAXX 07201 03772 27580 82705 333 79999=').precip_24h.qualifier,'trace');
 assert.equal(synop('AAXX 07201 03772 27580 82705 333 79998=').precip_24h.qualifier,'≥');
});
test('directory reads DMS and HTML attributes containing angle brackets',()=>{
 const cells=['0-20000-0-03772','03772','EGLL','HEATHROW','United Kingdom','51-28-40N','00-27-01W','25','1948-01-01','----'];
 const html='<table><tr>'+cells.map(c=>`<td><span title="<b>station</b>">${c}</span></td>`).join('')+'</tr></table>';
 const [s]=parseDirectory(html);assert.equal(s.icao,'EGLL');assert.ok(Math.abs(s.lat-51.47778)<.0001);assert.ok(s.lon<0);assert.equal(s.inScope,true);
});
