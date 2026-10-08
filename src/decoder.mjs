// Limited, explicit decoding of observational groups only. Unsupported groups remain in raw reports.
// Tables checked against WMO FM-12 and BAS pymetdecoder (OGL v3); see SOURCES.md.
const number = s => /^\d+$/.test(s ?? '') ? Number(s) : null;
const finite = v => typeof v === 'number' && Number.isFinite(v);
const rhFrom = (t,d) => Math.min(100,Math.max(0,100*Math.exp(17.625*d/(243.04+d)-17.625*t/(243.04+t))));
export function parseDirectory(html){
 const strip=s=>s.replace(/<(?:[^>"']|"[^"]*"|'[^']*')*>/g,' ').replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(+n)).replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();
 const coord=s=>{const m=s.match(/^(\d+)-(\d+)(?:-(\d+))?([NSEW])$/);return m?(+m[1]+m[2]/60+(m[3]||0)/3600)*(/[SW]/.test(m[4])?-1:1):null;};
 const rows=[];
 for(const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)){
  const c=[...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(x=>strip(x[1]));
  if(c.length!==10||!['United Kingdom','Ireland'].includes(c[4]))continue;
  const wmo=/^\d{5}$/.test(c[1])?c[1]:null,icao=/^[A-Z]{4}$/.test(c[2])?c[2]:null,lat=coord(c[5]),lon=coord(c[6]);
  if((!wmo&&!icao)||!finite(lat)||!finite(lon))continue;
  rows.push({id:wmo||icao,wmo,icao,name:c[3],country:c[4],type:'land',lat,lon,inScope:lat>=49.7&&lat<=61.2&&lon>=-11&&lon<=2.2,elevation:Number(c[7])||0,wigos:c[0],start:c[8],end:c[9]});
 }
 const result=new Map();
 for(const row of rows){const old=result.get(row.id);if(!old||(row.end==='----'&&old.end!=='----')||(row.end===old.end&&row.start>old.start))result.set(row.id,row);}
 return [...result.values()];
}
export function parseCSV(text,kind){
 if(/<!doctype|<html/i.test(text))throw Error('OGIMET returned a web page instead of report data');
 const result=[];
 for(const line of text.split(/\r?\n/)){
  const buoy=line.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(.+)$/);
  const row=kind==='BUOY'&&buoy?buoy[3]:line;
  const m=row.match(/^([^,]+),(\d{4}),(\d{2}),(\d{2}),(\d{2}),(\d{2}),(.*)$/);
  if(!m)continue;const time=Date.UTC(+m[2],+m[3]-1,+m[4],+m[5],+m[6])/1000,raw=m[7].trim();
  if(!Number.isFinite(time)||!raw)continue;
  result.push({id:m[1],time,raw,kind,nil:/\bNIL\b/.test(raw),...(kind==='BUOY'&&buoy?{csvLat:+buoy[1],csvLon:+buoy[2]}:{})});
 }
 if(!result.length&&!/ESTACION|WMO|No data|No hay|No reports/i.test(text))throw Error('Unrecognised OGIMET response');
 return result;
}
function field(report,value,unit,extra={}){return {value,unit,time:report.time,source:report.kind,raw:report.raw,...extra};}
function put(out,key,report,value,unit,extra={}){if(value!==null&&value!==undefined&&!(typeof value==='number'&&!Number.isFinite(value)))out[key]=field(report,value,unit,extra);}
function temp(group){return /^[12][01]\d{3}$/.test(group||'')?(group[1]==='1'?-1:1)*Number(group.slice(2))/10:null;}
function pressure(group){if(!/^[34]\d{4}$/.test(group||''))return null;const p=Number(group.slice(1))/10;return p<500?p+1000:p;}
const cloudRanges=['0–50 m','50–100 m','100–200 m','200–300 m','300–600 m','600–1,000 m','1,000–1,500 m','1,500–2,000 m','2,000–2,500 m','≥2,500 m / no cloud'];
function layerHeight(code){const n=number(code);if(n===null)return null;if(n===0)return {value:30,qualifier:'<'};if(n<=50)return {value:n*30};if(n<=55)return null;if(n<=80)return {value:(n-50)*300};if(n<=88)return {value:(n-80)*1500+9000};if(n===89)return {value:21000,qualifier:'>'};return {value:cloudRanges[n-90]};}
function pressureChange(r,out,s){if(!/^5[0-8]\d{3}$/.test(s))return;const a=+s[1],n=+s.slice(2)/10;put(out,'pressure_change_3h',r,a>=5?-n:n,'hPa',{hours:3,note:'Pressure change over preceding 3 hours'});put(out,'pressure_tendency',r,a,'code',{table:'0200',code:a,note:'WMO pressure-tendency code 0200; sign and shape of the preceding 3-hour pressure trace'});}
function decodeSeaGroups(r,out,groups,buoy=false){
 let swell=null;
 for(const s of groups){
  if(/^0[0-7]\d{3}$/.test(s)&&(!buoy||+s[1]<=1))put(out,'sea_temperature',r,(+s[1]%2?-1:1)*+s.slice(2)/10,'°C',{note:'Reported sea-surface temperature'});
  else if(/^[12][\d/]{4}$/.test(s)&&(!buoy||s[0]==='1')){const key=s[0]==='1'?'wave':'wind_wave',pp=number(s.slice(1,3)),hh=number(s.slice(3));if(pp!==null&&pp!==99)put(out,key+'_period',r,pp,'s');if(hh!==null&&hh!==99)put(out,key+'_height',r,hh*.5,'m',{note:s[0]==='1'?'Instrumental wave height':'Visually estimated wind-wave height'});}
  else if(buoy&&/^20\d{3}$/.test(s))put(out,'wave_period',r,+s.slice(2)/10,'s',{note:'BUOY instrumental period with tenths precision'});
  else if(buoy&&/^21\d{3}$/.test(s))put(out,'wave_height',r,+s.slice(2)/10,'m',{note:'BUOY instrumental height with tenths precision'});
  else if(/^3[\d/]{4}$/.test(s))swell=s;
  else if(/^[45][\d/]{4}$/.test(s)&&!buoy){const k=s[0]==='4'?'swell_1':'swell_2',pp=number(s.slice(1,3)),hh=number(s.slice(3)),dd=number(swell?.slice(s[0]==='4'?1:3,s[0]==='4'?3:5));if(pp!==null&&pp!==99)put(out,k+'_period',r,pp,'s');if(hh!==null&&hh!==99)put(out,k+'_height',r,hh*.5,'m');if(dd!==null&&dd<=36)put(out,k+'_direction',r,dd*10,'°',{note:'Direction swell comes from'});}
  else if(/^70\d{3}$/.test(s)&&out.wave_height)put(out,'wave_height',r,+s.slice(2)/10,'m',{note:'Instrumental wave height with tenths precision'});
  else if(/^8[0156]\d{3}$/.test(s)&&!buoy)put(out,'wet_bulb',r,([1,6].includes(+s[1])?-1:1)*+s.slice(2)/10,'°C',{note:'Reported marine wet-bulb temperature'});
  else if(/^6[1-5]\d{2}[0-4]$/.test(s)&&!buoy){put(out,'ice_accretion',r,+s.slice(2,4),'cm',{note:'Ice accretion on ship; raw group '+s});}
 }
}
function expandSynop(r,out,g,a,factor,indicator){
 const h=number(indicator?.[2]);if(h!==null)put(out,'cloud_base_range',r,cloudRanges[h],'',{table:'1600',code:h});
 let section=1,radiationHours=null,lastRadiation=-1,gustWindow=null;const layers=[],supplementary=[],sea=[];
 for(let i=a+5;i<g.length;i++){
  const s=g[i];if(['333','444','555'].includes(s)){section=+s[0];radiationHours=null;continue;}if(/^222/.test(s)){section=2;continue;}
  if(section===2){sea.push(s);continue;}
  if(section===1){
   pressureChange(r,out,s);
   if(/^4[12578]\d{3}$/.test(s)){const level={1:1000,2:925,5:500,7:700,8:850}[s[1]];put(out,'geopotential',r,level+' hPa · height code '+s.slice(2),'',{note:'SYNOP pressure-level geopotential group '+s+'. Height code retains its level-specific encoding, separate from sea-level pressure.'});}
   if(/^7[\d/]{4}$/.test(s)){const automatic=indicator[1]==='7';for(const [key,pos]of [['past_weather_1',3],['past_weather_2',4]]){const n=number(s[pos]);if(n!==null)put(out,key,r,n,'code',{table:automatic?'4531':'4561',code:n,note:'Past-weather category, WMO table '+(automatic?'4531':'4561')+'; period depends on synoptic hour'});}}
   if(/^8[\d/]{4}$/.test(s)){const n=number(s[1]);if(n!==null&&n<=8)put(out,'low_mid_cloud',r,n,'oktas');for(const [key,pos,table]of [['low_cloud_type',2,'0513'],['mid_cloud_type',3,'0515'],['high_cloud_type',4,'0509']]){const n=number(s[pos]);if(n!==null)put(out,key,r,n,'code',{table,code:n,note:'WMO cloud-type table '+table});}}
  }else if(section===3){
   if(/^55[\d/]{3}$/.test(s)){radiationHours=s[2]==='3'?1:24;lastRadiation=-1;if(/^55[012]\d{2}$|^553\d{2}$/.test(s))put(out,'sunshine_'+radiationHours+'h',r,+s.slice(radiationHours===1?3:2)/10,'h',{hours:radiationHours,note:`Sunshine duration over ${radiationHours} hours ending at report time`});continue;}
   if(radiationHours&&/^[0-6]\d{4}$/.test(s)&&+s[0]>lastRadiation&&s[0]!=='6'){lastRadiation=+s[0];const names=['net','net','global','diffuse','downward_longwave','upward_longwave','shortwave'],value=(s[0]==='1'?-1:1)*+s.slice(1)*(radiationHours===24?10:1);put(out,'radiation_'+names[+s[0]]+'_'+radiationHours+'h',r,value,'kJ/m²',{hours:radiationHours,note:`Accumulated radiation over ${radiationHours} hours; not instantaneous irradiance`});continue;}
   if(radiationHours&&/^6[\d/]{4}$/.test(s))supplementary.push('333 '+s+' (after '+radiationHours+'h radiation indicator)');radiationHours=null;
   if(/^[12][01]\d{3}$/.test(s))put(out,s[0]==='1'?'temperature_max':'temperature_min',r,temp(s),'°C',{note:'Reported SYNOP '+(s[0]==='1'?'maximum':'minimum')+' temperature. Reporting period follows the national station schedule; the group does not encode its duration.'});
   else if(/^3[\d/][01]\d{2}$/.test(s)){put(out,'grass_min',r,(s[2]==='1'?-1:1)*+s.slice(3),'°C',{note:'Reported grass minimum temperature; whole-degree precision, period follows national schedule'});}
   if(/^3[\d/][\d/]{3}$/.test(s)&&number(s[1])!==null)put(out,'ground_state',r,+s[1],'code',{table:'0901',code:+s[1]});
   if(/^4[\d/][\d/]{3}$/.test(s)){const state=number(s[1]),depth=number(s.slice(2));if(state!==null)put(out,'snow_state',r,state,'code',{table:'0975',code:state});if(depth!==null&&depth>0&&depth<=997)put(out,'snow_depth',r,depth===997?.5:depth,'cm',{qualifier:depth===997?'<':''});else if(depth===998)put(out,'snow_depth',r,'Discontinuous cover','');else if(depth===999)put(out,'snow_depth',r,'Measurement impossible','');}
   if(/^5[89]\d{3}$/.test(s))put(out,'pressure_change_24h',r,(s[1]==='9'?-1:1)*+s.slice(2)/10,'hPa',{hours:24,note:'Pressure change over preceding 24 hours'});
   if(/^8[\d/]{4}$/.test(s)){layers.push(s);const ht=layerHeight(s.slice(3));if(ht){const previous=out.cloud_layer_base;if(!previous||typeof ht.value==='number'&&(typeof previous.value!=='number'||ht.value<previous.value))put(out,'cloud_layer_base',r,ht.value,typeof ht.value==='number'?'m':'',{...ht,note:'Lowest reported SYNOP layer base, WMO table 1677'});}}
   if(/^907\d{2}$/.test(s)){const n=+s.slice(3);gustWindow=n<=60?`${n*6} minutes`:'WMO duration code '+n;}
   if(/^911\d{2}$/.test(s)&&factor!==null)put(out,'gust_period',r,+s.slice(3)*factor,'mph',{note:'Maximum gust over '+(gustWindow||'the synoptic reporting period')+' preceding observation'});
   if(!/^[1234678][\d/]{4}$|^55[0123]\d{2}$|^5[89]\d{3}$|^9(?:10|11|07)\d{2}$/.test(s))supplementary.push('333 '+s);
  }else if(section===4||section===5){if(/[0-9]/.test(s))supplementary.push(section===4?'444 '+s:'555 '+s);}
 }
 if(layers.length)put(out,'cloud_layers',r,layers.join(' · '),'',{shortValue:layers.length+' layers',note:'SYNOP layer groups 8NsChshs: amount, genus and base-height code. / means unavailable; original groups retained.'});
 if(supplementary.length)put(out,'supplementary',r,supplementary.join(' · '),'',{shortValue:supplementary.length+' groups',note:'Supplementary or national groups retained as transmitted. These groups need their regional code tables; they are not guessed as physical measurements.'});
 decodeSeaGroups(r,out,sea);
}
function visibility(code){const v=number(code);if(v===null||v>=51&&v<=55)return null;if(v===0)return {value:.1,qualifier:'<'};if(v<=50)return {value:v/10};if(v<=80)return {value:v-50};if(v<=88)return {value:(v-74)*5};if(v===89)return {value:70,qualifier:'>'};const a=[.05,.05,.2,.5,1,2,4,10,20,50];return v<=99?{value:a[v-90],qualifier:v===90?'<':v===99?'≥':''}:null;}
function precip(group){if(!/^6\d{4}$/.test(group))return null;const n=Number(group.slice(1,4)),hours=[null,6,12,18,24,1,2,3,9,15][+group[4]];if(!hours)return null;return {value:n<=989?n:n===990?0:(n-990)/10,hours,qualifier:n===989?'≥':n===990?'trace':''};}
function synopWeather(code,table){
 // A broad category is shown together with the original code and table, never a METAR code translation.
 if(table==='4680'){
  if(code>=20&&code<=29)return 'Recent weather';if(code>=30&&code<=35)return 'Fog / mist';if(code>=40&&code<=48)return 'Precipitation';if(code>=50&&code<=68)return 'Rain / drizzle';if(code>=70&&code<=78||code>=85&&code<=87)return 'Snow / ice';if(code>=80&&code<=84)return 'Showers';if(code>=89)return 'Storm / hail';if([10,11,12].includes(code))return 'Fog / mist';if(code<=4)return 'No significant weather';return 'Other weather';
 }
 if(code>=20&&code<=29)return 'Recent weather';if(code>=40&&code<=49||[10,11,12].includes(code))return 'Fog / mist';if(code>=50&&code<=69)return 'Rain / drizzle';if(code>=70&&code<=79||code>=83&&code<=86)return 'Snow / ice';if(code>=80&&code<=82)return 'Showers';if(code>=87)return 'Storm / hail';if(code===17)return 'Thunderstorm nearby';if(code<=3)return 'No significant weather';return 'Other weather';
}
export function decodeSynop(r){
 const out={};if(r.nil)return out;const g=r.raw.replace(/=/g,'').trim().split(/\s+/),a=g.indexOf('AAXX');if(a<0||g[a+2]!==r.id||g.length<a+5)return out;
 const iw=number(g[a+1]?.slice(-1)),factor=iw===0||iw===1?2.236936:iw===3||iw===4?1.150779:null;
 const indicator=g[a+3],nwind=g[a+4],ix=number(indicator?.[1]),cloud=number(nwind?.[0]),dd=number(nwind?.slice(1,3));let ff=number(nwind?.slice(3));
 if(ff===99&&/^00\d{3}$/.test(g[a+5]))ff=Number(g[a+5].slice(2));
 if(factor!==null&&ff!==null)put(out,'wind',r,ff*factor,'mph',{note:[0,3].includes(iw)?'Estimated wind speed':'Reported mean wind'});
 if(dd!==null&&dd<=36)put(out,'direction',r,dd*10,'°',{note:dd===0?'Calm':'Direction wind comes from'});
 if(dd===99)put(out,'direction',r,'VRB','',{note:'Variable or indeterminate direction'});
 if(cloud!==null&&cloud<=8)put(out,'cloud',r,cloud,'oktas');else if(cloud===9)put(out,'cloud',r,'Obscured','');
 const vis=visibility(indicator?.slice(3));if(vis)put(out,'visibility',r,vis.value,'km',{qualifier:vis.qualifier||''});
 let section=1,skipRadiation=false;
 for(let i=a+5;i<g.length;i++){
  const s=g[i];if(s==='333'){section=3;continue;}if(s==='555'){section=5;continue;}if(s==='444'||s.startsWith('222')){section=0;continue;}
  if(section===1){
   if(/^1[01]\d{3}$/.test(s))put(out,'temperature',r,temp(s),'°C');
   else if(/^2[01]\d{3}$/.test(s))put(out,'dewpoint',r,temp(s),'°C');
   else if(/^29\d{3}$/.test(s)&&Number(s.slice(2))<=100)put(out,'humidity',r,Number(s.slice(2)),'%',{note:'Reported relative humidity'});
   else if(/^3\d{4}$/.test(s))put(out,'surface_pressure',r,pressure(s),'hPa');
   else if(/^4[09]\d{3}$/.test(s))put(out,'pressure_msl',r,pressure(s),'hPa');
   else if(/^7\d{2}[\d/]{2}$/.test(s)){const code=Number(s.slice(1,3)),table=[5,6,7].includes(ix)?'4680':'4677';put(out,'weather',r,synopWeather(code,table),'',{code,table,note:`WMO table ${table}, code ${String(code).padStart(2,'0')}`});}
  }
  // Radiation following 55 groups can also begin with 6; never interpret it as precipitation.
  if(section===3&&/^55[\d/]{3}$/.test(s)){skipRadiation=true;continue;}
  if(section===3&&skipRadiation&&/^[0-6][\d/]{4}$/.test(s)){skipRadiation=false;continue;}
  skipRadiation=false;
  const ir=number(indicator?.[0]);
  if((section===1&&[0,1].includes(ir)||section===3&&[0,2].includes(ir))&&/^6\d{4}$/.test(s)){
   const p=precip(s);if(p)put(out,`precip_${p.hours}h`,r,p.value,'mm',{qualifier:p.qualifier,note:`Accumulation over ${p.hours} ${p.hours===1?'hour':'hours'} ending at observation time`,hours:p.hours});
  }
  if(section===3&&/^910\d{2}$/.test(s)&&factor!==null)put(out,'gust',r,Number(s.slice(3))*factor,'mph',{note:'Maximum gust in preceding 10 minutes'});
  if(section===3&&/^7\d{4}$/.test(s)){const n=Number(s.slice(1));put(out,'precip_24h',r,n===9999?0:n/10,'mm',{qualifier:n===9999?'trace':n===9998?'≥':'',hours:24,note:'Accumulation over 24 hours ending at observation time'});}
 }
 expandSynop(r,out,g,a,factor,indicator);
 if(!out.humidity&&out.temperature&&out.dewpoint)put(out,'humidity',r,rhFrom(out.temperature.value,out.dewpoint.value),'%',{derived:true,note:'Derived from reported temperature and dew point (Magnus formula)'});
 return out;
}
export function marinePosition(r){
 const g=r.raw.replace(/=/g,'').trim().split(/\s+/),a=g.findIndex(x=>x==='BBXX'||x==='ZZYY');if(a<0)return null;
 let lat,lon,q;
 if(g[a]==='BBXX'){
  const x=g[a+3]?.match(/^99(\d{3})$/),y=g[a+4]?.match(/^([1357])(\d{4})$/);if(!x||!y)return null;lat=+x[1]/10;lon=+y[2]/10;q=y[1];
 }else{
  const x=g[a+4]?.match(/^([1357])(\d{3}[\d/]{2})$/),y=g[a+5]?.match(/^(\d{4}[\d/]{2})$/);if(!x||!y)return null;lat=+x[2].replaceAll('/','0')/1000;lon=+y[1].replaceAll('/','0')/1000;q=x[1];
 }
 if(lat>90||lon>180)return null;if(['3','5'].includes(q))lat=-lat;if(['5','7'].includes(q))lon=-lon;
 if(finite(r.csvLat)&&(Math.abs(r.csvLat-lat)>.011||Math.abs(r.csvLon-lon)>.011))return null;
 return {lat,lon};
}
export function inMarineRegion(p){return p&&p.lat>=47.5&&p.lat<=62.5&&p.lon>=-17&&p.lon<=6;}
export function decodeMarine(r){
 const out={},g=r.raw.replace(/=/g,'').trim().split(/\s+/),a=g.findIndex(x=>x==='BBXX'||x==='ZZYY');if(r.nil||a<0)return out;
 if(g[a]==='BBXX'){
  const fake={...r,raw:`AAXX ${g[a+2]} ${r.id} ${g.slice(a+5).join(' ')}`};Object.assign(out,decodeSynop(fake));
  for(const v of Object.values(out))v.raw=r.raw;
  const i=g.findIndex((s,j)=>j>a+4&&/^222[\d/]{2}$/.test(s)),s=g[i+1];if(i>=0&&/^0[01]\d{3}$/.test(s))put(out,'sea_temperature',r,(s[1]==='1'?-1:1)*Number(s.slice(2))/10,'°C',{note:'Reported sea-surface temperature'});
 }else{
  const iw=number(g[a+3]?.slice(-1)),factor=[0,1].includes(iw)?2.236936:[3,4].includes(iw)?1.150779:null;let section=0;
  for(let i=a+6;i<g.length;i++){const s=g[i];if(/^111[\d/]{2}$/.test(s)){section=1;continue;}if(/^222[\d/]{2}$/.test(s)){section=2;continue;}if(/^333|^444|^555/.test(s)){section=0;continue;}
   if(section===1){
    if(/^0[\d/]{4}$/.test(s)){const dd=number(s.slice(1,3)),ff=number(s.slice(3));if(factor!==null&&ff!==null)put(out,'wind',r,ff*factor,'mph',{note:'BUOY reported wind'});if(dd!==null&&dd<=36)put(out,'direction',r,dd*10,'°',{note:dd===0?'Calm':'Direction wind comes from'});if(dd===99)put(out,'direction',r,'VRB','');}
    else if(/^1[01]\d{3}$/.test(s))put(out,'temperature',r,temp(s),'°C');
    else if(/^2[01]\d{3}$/.test(s))put(out,'dewpoint',r,temp(s),'°C');
    else if(/^29\d{3}$/.test(s)&&+s.slice(2)<=100)put(out,'humidity',r,+s.slice(2),'%');
    else if(/^3\d{4}$/.test(s))put(out,'surface_pressure',r,pressure(s),'hPa');
    else if(/^4\d{4}$/.test(s))put(out,'pressure_msl',r,pressure(s),'hPa');
    pressureChange(r,out,s);
   }else if(section===2&&/^0[01]\d{3}$/.test(s))put(out,'sea_temperature',r,(s[1]==='1'?-1:1)*Number(s.slice(2))/10,'°C',{note:'Reported sea-surface temperature'});
  }
  let marineSection=0;const sea=[],profile=[];for(const s of g.slice(a+6)){if(/^111/.test(s)){marineSection=1;continue;}if(/^222/.test(s)){marineSection=2;continue;}if(/^333/.test(s)){marineSection=3;continue;}if(/^444|^555/.test(s)){marineSection=4;continue;}if(marineSection===2)sea.push(s);else if(marineSection===3)profile.push(s);}
  decodeSeaGroups(r,out,sea,true);if(profile.length)put(out,'ocean_profile',r,profile.join(' '),'',{shortValue:'Profile',note:'Original BUOY subsurface temperature, salinity or current-profile groups. Depths and quality flags are retained in the raw report.'});
  if(!out.humidity&&out.temperature&&out.dewpoint)put(out,'humidity',r,rhFrom(out.temperature.value,out.dewpoint.value),'%',{derived:true,note:'Derived from reported temperature and dew point (Magnus formula)'});
 }
 return out;
}
export function combineMarine(reports,now=Date.now()/1000){
 const latest=new Map(),unpositioned=new Set();for(const r of reports){if(r.nil||r.time>now+120||r.time<now-21600)continue;const key=r.id.replace(/^0+(?=\d{5,}$)/,'');if(!latest.has(key)||latest.get(key).time<=r.time)latest.set(key,r);}
 const stations=[];for(const [key,r]of latest){const p=marinePosition(r);if(!p){unpositioned.add(key);continue;}if(!inMarineRegion(p))continue;const source=/^\d+$/.test(key)||r.raw.includes('ZZYY')?'BUOY':'SHIP',fields=decodeMarine({...r,kind:source});
  stations.push({id:'marine:'+key,wmo:/^\d+$/.test(key)?key:null,icao:null,reportId:r.id,name:source==='BUOY'?'Buoy / platform '+key:'Ship '+key,type:source==='BUOY'?'buoy':'ship',country:'Nearby seas',...p,positionTime:r.time,elevation:null,reports:{[source]:{time:r.time,raw:r.raw,id:r.id}},fields:Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,{[source]:v}]))});
 }
 return {stations,unpositioned:[...unpositioned]};
}
const wxNames={DZ:'Drizzle',RA:'Rain',SN:'Snow',SG:'Snow grains',PL:'Ice pellets',GR:'Hail',GS:'Small hail / snow pellets',UP:'Unidentified precipitation',BR:'Mist',FG:'Fog',FU:'Smoke',VA:'Volcanic ash',DU:'Dust',SA:'Sand',HZ:'Haze',PO:'Dust whirls',SQ:'Squalls',FC:'Funnel cloud',SS:'Sandstorm',DS:'Duststorm'};
export function decodeMetar(r){
 const out={};if(r.nil)return out;
 // Explicitly exclude TREND forecasts and remarks from observed meteorological elements.
 const raw=r.raw.split(/\s(?:TEMPO|BECMG|NOSIG|RMK|PROB\d{2}|FM\d{4})\b/)[0].replace(/=/g,'');
 const wind=raw.match(/\b(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?(KT|MPS|KMH)\b/);
 if(wind){const factor={KT:1.150779,MPS:2.236936,KMH:.621371}[wind[4]];put(out,'wind',r,+wind[2]*factor,'mph',{note:'METAR reported mean wind'});put(out,'direction',r,wind[1]==='VRB'?'VRB':+wind[1],wind[1]==='VRB'?'':'°',{note:+wind[2]===0?'Calm':'Direction wind comes from'});if(wind[3])put(out,'gust',r,+wind[3]*factor,'mph',{note:'METAR reported gust; absent gust groups are not zero'});}
 const td=raw.match(/\s(M?\d{2}|\/\/|XX)\/(M?\d{2}|\/\/|XX)(?=\s|$)/);
 if(td){const t=s=>/^M?\d{2}$/.test(s)?Number(s.replace('M','-')):null;put(out,'temperature',r,t(td[1]),'°C');put(out,'dewpoint',r,t(td[2]),'°C');}
 const q=raw.match(/\bQ(\d{4})\b/),alt=raw.match(/\bA(\d{4})\b/);if(q||alt)put(out,'qnh',r,q?+q[1]:+alt[1]/100*33.8638867,'hPa',{note:'Altimeter setting (QNH), not SYNOP mean sea-level pressure'});
 const vis=raw.match(/(?:KT|MPS|KMH)\s+(?:\d{3}V\d{3}\s+)?(\d{4})(?:NDV)?\b/);if(vis)put(out,'visibility',r,vis[1]==='9999'?10:vis[1]==='0000'?.05:+vis[1]/1000,'km',{qualifier:vis[1]==='9999'?'≥':vis[1]==='0000'?'<':''});
 const clouds=[...raw.matchAll(/\b(FEW|SCT|BKN|OVC)(\d{3}|\/\/\/)(CB|TCU)?/g)].map(m=>({cover:m[1],height:m[2]==='///'?null:Number(m[2])*100,kind:m[3]||''}));
 const special=raw.match(/\b(CAVOK|NCD|NSC|SKC|CLR)\b/);const obscured=/\bVV(?:\d{3}|\/\/\/)/.test(raw);
 if(clouds.length){const order=['FEW','SCT','BKN','OVC'];const top=clouds.reduce((a,b)=>order.indexOf(b.cover)>order.indexOf(a.cover)?b:a).cover;put(out,'metar_cloud',r,top,'',{note:clouds.map(c=>`${c.cover} ${c.height===null?'height not reported':c.height+' ft'}`).join(' · ')});}
 else if(special)put(out,'metar_cloud',r,special[1],'',{note:['NSC','CAVOK'].includes(special[1])?'No significant low cloud; this does not mean a cloudless sky':special[1]==='NCD'?'No cloud detected by sensor; this does not measure total cloud cover':'Reported clear sky'});
 else if(obscured)put(out,'metar_cloud',r,'Obscured','');
 if(special?.[1]==='CAVOK')put(out,'visibility',r,10,'km',{qualifier:'≥'});
 const tokens=raw.split(/\s+/).filter(s=>/^(?:[+-]|VC)?(?:MI|PR|BC|DR|BL|SH|TS|FZ)?(?:DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PO|SQ|FC|SS|DS){1,3}$/.test(s));
 if(tokens.length){const joined=tokens.join(' ');const category=/TS|FC/.test(joined)?'Storm / hail':/GR|GS/.test(joined)?'Storm / hail':/SN|SG|PL|IC/.test(joined)?'Snow / ice':/SH/.test(joined)?'Showers':/RA|DZ/.test(joined)?'Rain / drizzle':/FG|BR/.test(joined)?'Fog / mist':/UP/.test(joined)?'Precipitation':'Other weather';put(out,'weather',r,category,'',{code:joined,table:'METAR',note:joined});}
 else if(special?.[1]==='CAVOK')put(out,'weather',r,'No significant weather','',{code:'CAVOK',table:'METAR',note:'No aviation-significant weather reported (CAVOK)'});
 if(clouds.length){const heights=clouds.filter(c=>c.height!==null);if(heights.length)put(out,'metar_cloud_base',r,Math.min(...heights.map(c=>c.height)),'ft',{note:'Lowest reported METAR cloud-layer base above aerodrome'});const ceilings=heights.filter(c=>['BKN','OVC'].includes(c.cover));if(ceilings.length)put(out,'ceiling',r,Math.min(...ceilings.map(c=>c.height)),'ft',{note:'Lowest BKN or OVC base; not total cloud amount'});put(out,'metar_layers',r,clouds.map(c=>c.cover+' '+(c.height===null?'///':c.height+' ft')+(c.kind?' '+c.kind:'')).join(' · '),'',{shortValue:clouds.length+' layers'});}
 const vv=raw.match(/\bVV(\d{3})\b/);if(vv){put(out,'vertical_visibility',r,+vv[1]*100,'ft');put(out,'ceiling',r,+vv[1]*100,'ft',{note:'Vertical visibility in obscuration'});}
 const windRange=raw.match(/\b(\d{3})V(\d{3})\b/);if(windRange)put(out,'wind_variation',r,windRange[1]+'–'+windRange[2]+'°','',{note:'Reported variation of wind direction, from which wind blows'});
 const rvrs=[...raw.matchAll(/\bR(\d{2}[LCR]?)\/([MP]?\d{4})(?:V([MP]?\d{4}))?(FT)?(?:\/([UDN]))?\b/g)];if(rvrs.length)put(out,'runway_visibility',r,rvrs.map(m=>'R'+m[1]+' '+m[2]+(m[3]?'–'+m[3]:'')+' '+(m[4]?'ft':'m')+(m[5]?' '+m[5]:'')).join(' · '),'',{shortValue:rvrs.length+' runways',note:'Runway visual range: M below, P above; U increasing, D decreasing, N steady. Individual runway values retained.'});
 const recent=[...raw.matchAll(/\bRE([A-Z]{2,8})\b/g)].map(m=>m[1]);if(recent.length)put(out,'recent_weather',r,recent.join(' · '),'',{note:'METAR recent weather codes, separate from current weather'});
 const shear=[...raw.matchAll(/\bWS (ALL RWY|R\d{2}[LCR]?)\b/g)].map(m=>m[1]);if(shear.length)put(out,'wind_shear',r,shear.join(' · '),'',{note:'Reported runway wind shear'});
 if(tokens.length)put(out,'weather_codes',r,tokens.join(' '),'',{note:'Exact observed METAR weather codes; trends excluded'});
 // An absent present-weather group is retained as unreported; no inferred zero/clear condition.
 if(out.temperature&&out.dewpoint)put(out,'humidity',r,rhFrom(out.temperature.value,out.dewpoint.value),'%',{derived:true,note:'Derived from reported temperature and dew point (Magnus formula)'});
 return out;
}
export function combineReports(directory,feeds,now=Date.now()/1000){
 const byWmo=new Map(directory.filter(s=>s.wmo).map(s=>[s.wmo,s])),byIcao=new Map();for(const s of directory.filter(s=>s.icao)){const old=byIcao.get(s.icao);if(!old||s.end==='----')byIcao.set(s.icao,s);}
 const stations=new Map(),unmapped=new Set(),counts={SYNOP:0,METAR:0,NIL:0};
 for(const [kind,reports] of Object.entries(feeds))for(const r of [...reports].sort((a,b)=>a.time-b.time)){
  if(r.time>now+120||r.time<now-(kind==='SYNOP'?24:6)*3600)continue;const info=(kind==='SYNOP'?byWmo:byIcao).get(r.id);if(!info){unmapped.add(`${kind}:${r.id}`);continue;}
  if(info.inScope===false)continue;if(r.nil){counts.NIL++;continue;}const fields=kind==='SYNOP'?decodeSynop(r):decodeMetar(r);if(!Object.keys(fields).length)continue;
  counts[kind]++;let station=stations.get(info.id);if(!station){station={...info,reports:{},fields:{}};stations.set(info.id,station);}station.reports[kind]={time:r.time,raw:r.raw,id:r.id};
  // Partial SYNOP messages omit fields. Keep each last decoded observation with its own time.
  for(const [key,value]of Object.entries(fields)){station.fields[key]??={};station.fields[key][kind]=value;}
 }
 return {stations:[...stations.values()],unmapped:[...unmapped],counts};
}

