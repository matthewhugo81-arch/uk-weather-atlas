import test from 'node:test';import assert from 'node:assert/strict';
import {parseCSV,parseDirectory,marinePosition,decodeMarine,combineMarine} from '../src/decoder.mjs';
import '../dist/wind-symbols.js';
const time=Date.UTC(2026,9,8,5)/1000;
const report=(raw,id='62029',kind='BUOY',extra={})=>({raw,id,kind,time,...extra});
test('arrows indicate flow, while calm and variable stay distinct',()=>{
 assert.equal(WeatherWind.rotation(0),180);assert.equal(WeatherWind.rotation(90),270);assert.equal(WeatherWind.rotation(270),90);assert.equal(WeatherWind.rotation(360),180);
 assert.equal(WeatherWind.kind({value:0,note:'Calm'}),'calm');assert.equal(WeatherWind.kind({value:'VRB'}),'variable');assert.equal(WeatherWind.kind(null),'missing');assert.match(WeatherWind.glyph({value:270}),/rotate\(90 13 13\)/);
});
test('BBXX position, units and sea temperature decode from original report',()=>{
 const r=report('BBXX 62029 08051 99540 70090 46/// /27008 10125 20110 40123 22200 00153=');
 assert.deepEqual(marinePosition(r),{lat:54,lon:-9});const fields=decodeMarine(r);
 assert.equal(fields.direction.value,270);assert.ok(Math.abs(fields.wind.value-17.8955)<.001);assert.equal(fields.temperature.value,12.5);assert.equal(fields.pressure_msl.value,1012.3);assert.equal(fields.sea_temperature.value,15.3);assert.equal(fields.wind.raw,r.raw);
 assert.equal(marinePosition(report('BBXX 62029 08051 99/// 7//// 46/// /27008=')),null);
});
test('BUOY CSV location cross-check and ZZYY section boundaries prevent false readings',()=>{
 const raw='ZZYY 0062029 08106 05001 754000 009000 6//3/ 111// 02708 10125 20110 40123 22209 00153 10000 33300 88870 20000 33030=';
 const [r]=parseCSV('LATITUD,LONGITUD,ESTACION,ANO,MES,DIA,HORA,MINUTO,PARTE\n54.000,-9.000,0062029,2026,10,08,05,00,'+raw,'BUOY');
 assert.deepEqual(marinePosition(r),{lat:54,lon:-9});const fields=decodeMarine(r);assert.equal(fields.temperature.value,12.5);assert.equal(fields.dewpoint.value,11);assert.equal(fields.sea_temperature.value,15.3);assert.equal(fields.pressure_msl.value,1012.3);assert.ok(fields.humidity.derived);assert.equal(marinePosition({...r,csvLat:52}),null);
});
test('marine sites use latest report location and do not carry values along a ship track',()=>{
 const early=report('BBXX CALL1 08041 99540 70090 46/// /27008 10125=','CALL1','SHIP',{time:time-3600});
 const late=report('BBXX CALL1 08051 99542 70092 46/// ///// 40123=','CALL1','SHIP');
 const r=combineMarine([early,late],time);assert.equal(r.stations.length,1);assert.equal(r.stations[0].lon,-9.2);assert.equal(r.stations[0].fields.temperature,undefined);assert.equal(r.stations[0].fields.pressure_msl.SHIP.time,time);
 const outside=report('BBXX CALL1 08051 99390 70700 46/// /27008 10125=','CALL1','SHIP');assert.equal(combineMarine([early,outside],time).stations.length,0);
});
test('leading zero buoy identifiers merge and Irish directory entries are in scope',()=>{
 const a=report('BBXX 62029 08041 99540 70090 46/// /27008 10125=','62029','SHIP',{time:time-3600});
 const b=report('ZZYY 0062029 08106 05001 754000 009000 111// 40123=','0062029');assert.equal(combineMarine([a,b],time).stations.length,1);
 const cells=['0-20000-0-03951','03951','EICK','CORK','Ireland','51-50-50N','08-29-29W','155','1957-01-01','----'];const [s]=parseDirectory('<tr>'+cells.map(c=>'<td>'+c+'</td>').join('')+'</tr>');assert.equal(s.country,'Ireland');assert.equal(s.inScope,true);
});
