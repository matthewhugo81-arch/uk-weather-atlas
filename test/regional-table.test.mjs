import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
await import('../dist/regional-table.js');
const {regionFor,matchesRegion,sortRows,inRing,convertWindValue,isWindVariable}=globalThis.WeatherRegionalTable;
const boundaries=JSON.parse(fs.readFileSync('dist/regional-boundaries.json','utf8'));
const station=(name,lat,lon,extra={})=>({id:name,name,lat,lon,country:'United Kingdom',type:'land',...extra});
const cases=[
 ['Hawarden',53.178,-2.978,'wales'],['Wrexham',53.046,-2.993,'wales'],['Cardiff',51.396,-3.343,'wales'],
 ['Carlisle',54.938,-2.810,'north'],['Berwick',55.770,-2.006,'north'],['Eskdalemuir',55.311,-3.206,'scotland'],
 ['Glasgow',55.87,-4.433,'scotland'],['Sumburgh',59.878,-1.296,'scotland'],['Stornoway',58.214,-6.325,'scotland'],
 ['Manchester',53.354,-2.275,'north'],['Leeds Bradford',53.866,-1.661,'north'],['Humberside',53.574,-0.350,'north'],
 ['Waddington',53.166,-0.524,'midlands'],['Nottingham',52.953,-1.15,'midlands'],['Shrewsbury',52.708,-2.755,'midlands'],
 ['Bristol',51.383,-2.719,'south'],['Marham',52.649,0.551,'south'],['Norwich',52.676,1.283,'south'],['Heathrow',51.477,-0.461,'south'],
 ['Belfast',54.657,-6.216,'ni']
];
for(const [name,lat,lon,expected]of cases)test(`ONS region: ${name} -> ${expected}`,()=>assert.equal(regionFor(station(name,lat,lon),boundaries),expected));
test('marine and Crown Dependencies are not assigned to neighbouring mainland regions',()=>{
 assert.equal(regionFor(station('ship',55,-5,{type:'ship'}),boundaries),'marine');
 assert.equal(regionFor(station('Dublin',53.43,-6.27,{country:'Ireland'}),boundaries),'ireland');
 assert.equal(regionFor(station('Ronaldsway',54.08,-4.62,{icao:'EGNS'}),boundaries),'iom');
 assert.equal(regionFor(station('Jersey',49.21,-2.19,{icao:'EGJJ'}),boundaries),'channel');
 assert.equal(regionFor(station('Elsewhere',0,0),boundaries),'other');
});
test('land selection excludes all marine reports, and regions remain disjoint',()=>{
 assert.equal(matchesRegion('marine','land'),false);assert.equal(matchesRegion('other','land'),true);
 assert.equal(matchesRegion('north','wales'),false);assert.equal(matchesRegion('wales','wales'),true);
});
test('ring test includes boundary points and excludes exterior',()=>{
 const ring=[[0,0],[2,0],[2,2],[0,2],[0,0]];
 assert.equal(inRing(1,1,ring),true);assert.equal(inRing(2,1,ring),true);assert.equal(inRing(3,1,ring),false);
});
const row=(name,value,time=100,elevation=100,qualifier='')=>({station:{name,id:name,elevation},reading:value===null?null:{value,time,qualifier}});
test('numeric sorting is numeric, missing-last, stable and non-mutating',()=>{
 const rows=[row('Warm',12),row('Cold',-2),row('Missing',null),row('Mild',9),row('Equal',9)];
 assert.deepEqual(sortRows(rows,'value','desc').map(r=>r.station.name),['Warm','Equal','Mild','Cold','Missing']);
 assert.deepEqual(sortRows(rows,'value','asc').map(r=>r.station.name),['Cold','Equal','Mild','Warm','Missing']);
 assert.equal(rows[0].station.name,'Warm');
});
test('trace is distinct from zero; categorical values and observation times sort safely',()=>{
 assert.deepEqual(sortRows([row('Trace',0,100,10,'trace'),row('Dry',0)],'value','asc').map(r=>r.station.name),['Dry','Trace']);
 assert.deepEqual(sortRows([row('Later',1,200),row('Earlier',1,100),row('Missing',null)],'time','desc').map(r=>r.station.name),['Later','Earlier','Missing']);
 assert.equal(sortRows([row('Rain','Rain / drizzle'),row('Fog','Fog / mist')],'value','asc')[0].station.name,'Fog');
 assert.equal(sortRows([row('No height',1,100,null),row('Low',1,100,-4)],'elevation','asc')[1].station.name,'No height');
});
test('table wind conversions use precise factors without altering stored mph readings',()=>{
 const original=48.3;
 assert.equal(convertWindValue(original,'mph'),original);
 assert.equal(convertWindValue(original,'km/h').toFixed(1),'77.7');
 assert.equal(convertWindValue(original,'kt').toFixed(1),'42.0');
 assert.equal(convertWindValue(0,'kt'),0);
 assert.equal(convertWindValue(null,'km/h'),null);
 assert.equal(original,48.3);
 assert.equal(isWindVariable('wind'),true);
 assert.equal(isWindVariable('gust'),true);
 assert.equal(isWindVariable('temperature'),false);
});
test('wind sorting remains valid after unit selection because conversion is monotonic',()=>{
 const rows=[row('A',48.3),row('B',33.4),row('C',null)];
 assert.deepEqual(sortRows(rows,'value','desc').map(r=>r.station.name),['A','B','C']);
 assert.ok(convertWindValue(rows[0].reading.value,'km/h')>convertWindValue(rows[1].reading.value,'km/h'));
 assert.ok(convertWindValue(rows[0].reading.value,'kt')>convertWindValue(rows[1].reading.value,'kt'));
});
test('browser assets are present in both source and Pages without core map changes',()=>{
 for(const file of ['regional-table.js','regional-table.css','regional-boundaries.json'])assert.equal(fs.readFileSync('dist/'+file,'utf8'),fs.readFileSync('docs/'+file,'utf8'));
 for(const dir of ['dist','docs']){assert.match(fs.readFileSync(dir+'/index.html','utf8'),/regional-table\.js\?v=/);assert.match(fs.readFileSync(dir+'/regional-table.js','utf8'),/id="atlas-wind-unit"/);}
 assert.ok(boundaries.features.length>5);
});
