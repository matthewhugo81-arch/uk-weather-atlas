/* Phone presentation only. Existing observation controls and handlers are reused. */
(() => {
  const phone=matchMedia('(max-width:680px)'),body=document.body;
  const variable=document.getElementById('variable'),anchor=document.createComment('desktop observation selector');
  variable.before(anchor);
  const bar=document.createElement('div');bar.className='phone-observation';
  const label=document.createElement('label');label.htmlFor='variable';label.textContent='Observation';bar.append(label);
  document.querySelector('.topbar').after(bar);
  const nav=document.createElement('nav');nav.className='phone-nav';nav.setAttribute('aria-label','Weather Atlas panels');
  const panels={filters:document.querySelector('.controls'),rankings:document.querySelector('.rankings'),station:document.querySelector('.detail'),key:document.querySelector('.map-bottom')};
  const names={map:'Map',filters:'Search / filters',rankings:'Rankings',station:'Station',key:'Key / info'};
  const close=document.createElement('button');close.className='phone-close';close.type='button';close.textContent='Done · back to map';
  document.body.append(nav,close);
  const footer=document.querySelector('.sidebar-footer'),footerAnchor=document.createComment('desktop sources');footer.before(footerAnchor);
  let active='map',returnFocus=null;
  function show(name,focus=false){
    if(!phone.matches)return;
    if(active==='map')returnFocus=document.activeElement;
    active=name;body.dataset.phonePanel=name;
    if(name==='rankings')document.getElementById('rankings-panel').open=true;
    for(const [key,panel] of Object.entries(panels)){
      panel.inert=key!==name;
      panel.classList.toggle('phone-panel-open',key===name);
    }
    nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.panel===name)));
    if(name==='map'){returnFocus?.focus?.({preventScroll:true});}
    else if(focus){(name==='filters'?document.getElementById('search'):close).focus({preventScroll:true});}
  }
  for(const [key,title] of Object.entries(names)){
    const button=document.createElement('button');button.type='button';button.textContent=title;button.dataset.panel=key;
    button.onclick=()=>show(active===key?'map':key,true);nav.append(button);
  }
  close.onclick=()=>show('map');
  document.addEventListener('keydown',e=>{if(phone.matches&&e.key==='Escape'){show('map');}});
  // Only a station selection opens the panel; background refreshes keep the map open.
  const originalSelectStation=selectStation;
  selectStation=function(...args){
    const station=originalSelectStation(...args);
    if(phone.matches)show('station');
    return station;
  };
  document.getElementById('clear-selection').addEventListener('click',()=>show('map'));
  document.addEventListener('click',e=>{
    if(e.target.closest('#atlas-map-view,#atlas-table-view'))show('map');
    if(e.target.closest('.atlas-back-to-table'))show('map');
  });
  function layout(){
    if(phone.matches){bar.append(variable);panels.key.append(footer);show('map');}
    else{anchor.after(variable);footerAnchor.after(footer);delete body.dataset.phonePanel;for(const panel of Object.values(panels)){panel.inert=false;panel.classList.remove('phone-panel-open');}}
    requestAnimationFrame(()=>{map.invalidateSize();if(phone.matches)fitUK();});
  }
  // Keep value labels readable at phone scale; all station markers remain selectable.
  let labelFrame=0;
  function declutter(){
    cancelAnimationFrame(labelFrame);
    labelFrame=requestAnimationFrame(()=>{
      const boxes=[];
      document.querySelectorAll('.point-label').forEach(label=>{
        label.style.visibility='';
        if(!phone.matches)return;
        const r=label.getBoundingClientRect();
        if(boxes.some(b=>r.left<b.right+3&&r.right>b.left-3&&r.top<b.bottom+3&&r.bottom>b.top-3))label.style.visibility='hidden';
        else boxes.push(r);
      });
    });
  }
  map.on('moveend zoomend',declutter);
  new MutationObserver(declutter).observe(document.querySelector('.leaflet-tooltip-pane'),{childList:true});
  phone.addEventListener('change',()=>{layout();declutter();});layout();
})();
