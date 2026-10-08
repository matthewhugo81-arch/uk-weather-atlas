import fs from 'node:fs';import path from 'node:path';
fs.mkdirSync('dist/.openai',{recursive:true});fs.copyFileSync('.openai/hosting.json','dist/.openai/hosting.json');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.txt':'text/plain; charset=utf-8'};
const assets={};function walk(dir){for(const ent of fs.readdirSync(dir,{withFileTypes:true})){if(['server','.openai'].includes(ent.name))continue;const p=path.join(dir,ent.name);if(ent.isDirectory())walk(p);else{const ext=path.extname(p),key='/'+path.relative('dist',p).split(path.sep).join('/');if(!types[ext])continue;assets[key]={type:types[ext],data:fs.readFileSync(p,ext==='.png'?'base64':'utf8'),base64:ext==='.png'};}}}walk('dist');
const decoder=fs.readFileSync('src/decoder.mjs','utf8').replaceAll('export function ','function '),worker=fs.readFileSync('src/worker.mjs','utf8'),stations=fs.readFileSync('src/stations.json','utf8');
fs.mkdirSync('dist/server',{recursive:true});fs.writeFileSync('dist/server/index.js',`const ASSETS=${JSON.stringify(assets)};\nconst STATION_DIRECTORY=${stations};\n${decoder}\n${worker}`);
console.log(`Worker built: ${Object.keys(assets).length} assets, ${fs.statSync('dist/server/index.js').size} bytes`);
