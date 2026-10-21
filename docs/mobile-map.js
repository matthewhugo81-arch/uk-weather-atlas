/* Phone presentation. Desktop elements are restored to their original positions. */
(() => {
  const phone=matchMedia('(max-width:680px), (max-width:1000px) and (max-height:500px) and (pointer:coarse)');
  const byId=id=>document.getElementById(id),body=document.body;
  let ready=false,active=null,baseView='map',bar,nav,sheet,content,close,rankBar,periodWrap;
  const homes=new Map();
  const panels={filters:document.querySelector('.controls'),rankings:document.querySelector('.rankings'),station:document.querySelector('.detail'),key:document.querySelector('.map-bottom')};
  const names={map:'Map',table:'Table',filters:'Filters',rankings:'Rankings',station:'Station',key:'Key / info'};
  function move(element,parent){
    if(!homes.has(element)){const anchor=document.createComment('phone layout home');element.before(anchor);homes.set(element,anchor);}
    parent.append(element);
  }
  function sync(){
    if(!ready||!phone.matches)return;
    baseView=byId('atlas-table-panel').hidden?'map':'table';
    const ranking=byId('rankings-panel').open;
    rankBar.hidden=!ranking;
    rankBar.firstChild.textContent=ranking?byId('map-title').textContent.trim():'';
    // Choosing another variable already exits rankings in the observation controller.
    byId('variable').disabled=false;
    close.textContent='Done · back to '+baseView;
    nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.panel===(active||baseView))));
    sheet.hidden=!active;
    document.querySelector('.workspace').inert=!!active;
  }
  function show(name){
    if(!ready||!phone.matches)return;
    const focused=document.activeElement;
    if(focused?.matches('input,select'))focused.blur();
    const wasOpen=!!active;
    active=name;
    for(const [key,panel] of Object.entries(panels)){
      panel.classList.toggle('phone-panel-open',key===name);
      panel.inert=key!==name;
    }
    if(name){
      byId('phone-sheet-title').textContent=names[name];
      content.scrollTop=0;
      if(name==='rankings'&&!byId('rankings-panel').open)byId('rankings-panel').open=true;
    }
    sync();
    if(!name&&wasOpen)nav.querySelector(`[data-panel="${baseView}"]`).focus({preventScroll:true});
  }
  function setView(view){
    byId(view==='table'?'atlas-table-view':'atlas-map-view').click();
    show(null);
  }
  function endRanking(){
    if(!byId('rankings-panel').open)return;
    byId('rankings-panel').open=false;
    restoreRankingView();render();sync();
  }
  function fitPhone(){
    map.stop();map.invalidateSize();
    map.fitBounds([[49.5,-11.5],[61.2,2.5]],{paddingTopLeft:[18,65],paddingBottomRight:[18,85],animate:false});
  }
  function fitRanking(){
    if(!rankingReadings?.size)return;
    map.fitBounds(stations().map(s=>[s.lat,s.lon]),{paddingTopLeft:[30,65],paddingBottomRight:[30,85],maxZoom:7,animate:false});
  }
  function setup(){
    if(ready)return;
    ready=true;
    bar=document.createElement('div');bar.className='phone-observation';
    bar.innerHTML='<div class="phone-variable"><label for="variable">Observation</label></div>';
    document.querySelector('.topbar').after(bar);
    rankBar=document.createElement('div');rankBar.className='phone-ranking-status';rankBar.hidden=true;
    rankBar.innerHTML='<span></span><button type="button">Show all stations ×</button>';
    rankBar.querySelector('button').onclick=()=>{endRanking();if(active==='rankings')show(null);};
    bar.after(rankBar);
    nav=document.createElement('nav');nav.className='phone-nav';nav.setAttribute('aria-label','Weather Atlas views');
    for(const [key,title] of Object.entries(names)){
      const button=document.createElement('button');button.type='button';button.textContent=title;button.dataset.panel=key;
      button.onclick=()=>{
        if(key==='map'){endRanking();setView('map');}
        else if(key==='table')setView('table');
        else show(active===key?null:key);
      };
      nav.append(button);
    }
    sheet=document.createElement('section');sheet.className='phone-sheet';sheet.hidden=true;sheet.setAttribute('aria-labelledby','phone-sheet-title');
    sheet.innerHTML='<header class="phone-sheet-heading"><strong id="phone-sheet-title"></strong><button type="button" class="phone-close"></button></header><div class="phone-sheet-content"></div>';
    content=sheet.lastElementChild;close=sheet.querySelector('button');close.onclick=()=>show(null);
    body.append(nav,sheet);
    periodWrap=byId('period-wrap');
    const observer=new MutationObserver(sync);
    for(const id of ['map-title','point-count','detail-content'])observer.observe(byId(id),{childList:true});
    observer.observe(byId('atlas-table-panel'),{attributes:true,attributeFilter:['hidden']});
    const sizeObserver=new ResizeObserver(()=>{if(phone.matches)map.invalidateSize({pan:false});});
    sizeObserver.observe(byId('map'));
    // Safari's keyboard changes the visual viewport without changing 100dvh.
    const viewport=window.visualViewport;
    function keyboardLayout(){
      body.classList.toggle('phone-keyboard',phone.matches&&viewport&&innerHeight-viewport.height>120);
      if(viewport){body.style.setProperty('--phone-visible-height',viewport.height+'px');body.style.setProperty('--phone-visible-top',viewport.offsetTop+'px');}
    }
    viewport?.addEventListener('resize',keyboardLayout);viewport?.addEventListener('scroll',keyboardLayout);keyboardLayout();
  }
  function layout(){
    if(phone.matches){
      setup();body.classList.add('phone-layout');
      move(byId('variable'),bar.firstElementChild);move(periodWrap,bar);
      for(const panel of Object.values(panels))move(panel,content);
      move(document.querySelector('.sidebar-footer'),panels.key);
      show(null);requestAnimationFrame(()=>{if(savedView?.center||viewReady)map.invalidateSize({pan:false});else fitPhone();});
    }else if(ready){
      active=null;sheet.hidden=true;body.classList.remove('phone-layout');
      for(const [element,anchor] of homes)anchor.after(element);
      for(const panel of Object.values(panels)){panel.inert=false;panel.classList.remove('phone-panel-open');}
      document.querySelector('.workspace').inert=false;
      byId('variable').disabled=byId('rankings-panel').open;
      requestAnimationFrame(()=>map.invalidateSize({pan:false}));
    }
    declutter();
  }
  const originalSelectStation=selectStation;
  selectStation=function(...args){const station=originalSelectStation(...args);if(phone.matches)show('station');return station;};
  const originalRankingChange=changeRanking;
  function onRankingChange(){
    if(!phone.matches)return originalRankingChange();
    render();search();fitRanking();sync();
  }
  byId('rankings-panel').removeEventListener('toggle',originalRankingChange);
  byId('rankings-panel').addEventListener('toggle',onRankingChange);
  byId('rank-metric').onchange=onRankingChange;byId('rank-limit').onchange=onRankingChange;
  const originalFit=byId('fit-uk').onclick;
  byId('fit-uk').onclick=()=>phone.matches?fitPhone():originalFit();
  byId('clear-selection').addEventListener('click',()=>{if(phone.matches)show(null);});
  document.addEventListener('click',e=>{
    if(!phone.matches||!ready)return;
    if(e.target.closest('#atlas-map-view,#atlas-table-view'))show(null);
    if(e.target.closest('.atlas-back-to-table'))setView('table');
  });
  document.addEventListener('keydown',e=>{if(phone.matches&&active&&e.key==='Escape')show(null);});
  // Only visible, on-map labels participate; off-screen labels cannot hide visible ones.
  let labelFrame=0;
  function declutter(){
    cancelAnimationFrame(labelFrame);
    labelFrame=requestAnimationFrame(()=>{
      const boxes=[],bounds=byId('map').getBoundingClientRect();
      document.querySelectorAll('.point-label').forEach(label=>{
        label.style.visibility='';if(!phone.matches)return;
        const r=label.getBoundingClientRect();
        if(r.right<bounds.left||r.left>bounds.right||r.bottom<bounds.top||r.top>bounds.bottom)return;
        if(boxes.some(b=>r.left<b.right+3&&r.right>b.left-3&&r.top<b.bottom+3&&r.bottom>b.top-3))label.style.visibility='hidden';else boxes.push(r);
      });
    });
  }
  map.on('moveend zoomend',declutter);
  new MutationObserver(declutter).observe(document.querySelector('.leaflet-tooltip-pane'),{childList:true});
  phone.addEventListener('change',layout);layout();
})();
