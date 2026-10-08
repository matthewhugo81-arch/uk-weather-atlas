import fs from 'node:fs';
import path from 'node:path';

// GitHub Pages serves the map; the existing Worker supplies live observations.
fs.mkdirSync('docs', {recursive: true});
for (const item of fs.readdirSync('dist', {withFileTypes: true})) {
  if (['server', '.openai'].includes(item.name)) continue;
  fs.cpSync(path.join('dist', item.name), path.join('docs', item.name), {recursive: true});
}
const app = fs.readFileSync('dist/app.js', 'utf8').replace("fetch('/api/observations'", "fetch('https://uk-weather-atlas.matthugo81.chatgpt.site/api/observations'");
fs.writeFileSync('docs/app.js', app);
fs.writeFileSync('docs/.nojekyll', '');
console.log('GitHub Pages assets built in docs/');
