'use strict';
globalThis.WeatherRankings={
 definitions:{
  warmest:{label:'Warmest now',key:'temperature',order:'desc',minutes:120,map:'temperature'},
  coolest:{label:'Coolest now',key:'temperature',order:'asc',minutes:120,map:'temperature'},
  windiest:{label:'Windiest now · mean wind',key:'wind',order:'desc',minutes:120,map:'wind'},
  gustiest:{label:'Highest gusts now',key:'gust',order:'desc',minutes:120,map:'gust'},
  minimum:{label:'Lowest reported Tmin',key:'temperature_min',order:'asc',minutes:1440,map:'temperature_min'},
  maximum:{label:'Highest reported Tmax',key:'temperature_max',order:'desc',minutes:1440,map:'temperature_max'},
  rain24:{label:'Wettest · 24-hour precipitation',key:'precip_24h',order:'desc',minutes:1440,map:'precipitation',period:24},
  rain1:{label:'Wettest · last reported hour',key:'precip_1h',order:'desc',minutes:120,map:'precipitation',period:1},
  snow:{label:'Deepest reported snow',key:'snow_depth',order:'desc',minutes:1440,map:'snow_depth'},
  snowing:{label:'Snow / ice reported now',key:'weather',order:'recent',minutes:120,map:'weather',condition:true}
 },
 rank(stations,definition,{network='all',limit=5,now=Date.now()/1000}={}){
  const rows=[];for(const station of stations||[]){if(station.type==='buoy'||station.type==='ship')continue;
   const candidates=Object.values(station.fields[definition.key]||{}).filter(r=>(network==='all'||r.source===network)&&r.time<=now+120&&r.time>=now-definition.minutes*60).sort((a,b)=>b.time-a.time||(a.source==='SYNOP'?-1:1));
   const reading=candidates[0];if(!reading)continue;
   if(definition.condition){if(reading.value!=='Snow / ice')continue;}else if(typeof reading.value!=='number'||!Number.isFinite(reading.value))continue;
   // A measured zero rainfall remains valid; zero depth is not measurable snow cover.
   if(definition.key==='snow_depth'&&reading.value<=0)continue;
   rows.push({station,reading});
  }
  rows.sort((a,b)=>definition.order==='recent'?b.reading.time-a.reading.time||a.station.name.localeCompare(b.station.name):(definition.order==='asc'?a.reading.value-b.reading.value:b.reading.value-a.reading.value)||b.reading.time-a.reading.time||a.station.name.localeCompare(b.station.name));
  return {rows:rows.slice(0,limit),eligible:rows.length};
 }
};
