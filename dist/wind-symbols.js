'use strict';
globalThis.WeatherWind={
 kind(reading){return !reading?'missing':reading.note==='Calm'?'calm':typeof reading.value==='number'?'arrow':'variable';},
 rotation(degrees){return ((degrees+180)%360+360)%360;},
 glyph(reading){const kind=this.kind(reading);if(kind==='arrow')return `<svg viewBox="0 0 26 26" aria-hidden="true"><g transform="rotate(${this.rotation(reading.value)} 13 13)"><path d="M13 22V4M7 10l6-6 6 6" fill="none" stroke="white" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M13 22V4M7 10l6-6 6 6" fill="none" stroke="#145968" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></g></svg>`;if(kind==='calm')return '<svg viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="5" fill="white" stroke="#145968" stroke-width="2"/></svg>';if(kind==='variable')return '<span class="wind-variable" aria-hidden="true">↔</span>';return '<svg viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="3" fill="#b8c5cb" stroke="white" stroke-width="1"/></svg>';}
};
