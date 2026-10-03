(() => {
  'use strict';
  if (window.__KARETA_GEO_MAP_MODULE__) return;
  window.__KARETA_GEO_MAP_MODULE__ = { loadedAt:Date.now() };

  const config = Object.freeze({
    tileUrl:String(window.KARETA_GEO_MAP_CONFIG?.tileUrl || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'),
    attributionLabel:String(window.KARETA_GEO_MAP_CONFIG?.attributionLabel || '© OpenStreetMap contributors'),
    attributionUrl:String(window.KARETA_GEO_MAP_CONFIG?.attributionUrl || 'https://www.openstreetmap.org/copyright'),
    minZoom:Math.max(3,Number(window.KARETA_GEO_MAP_CONFIG?.minZoom || 8)),
    maxZoom:Math.min(19,Number(window.KARETA_GEO_MAP_CONFIG?.maxZoom || 17)),
    defaultZoom:Number(window.KARETA_GEO_MAP_CONFIG?.defaultZoom || 13)
  });
  const release=String(window.KARETA_NEXT_ASSET_VERSION||'next');
  let dialog=null,state=null,drag=null,tileRenderSeq=0;

  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
  const coordinate=value=>value==null||(typeof value==='string'&&!value.trim())?NaN:Number(value);
  const validPoint=point=>{
    const lat=coordinate(point?.latitude??point?.lat),lng=coordinate(point?.longitude??point?.lng);
    return Number.isFinite(lat)&&Number.isFinite(lng)&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180;
  };
  const normalizePoint=(point,index)=>({
    id:String(point?.id||('point_'+index)),
    label:String(point?.label||point?.name||'Точка'),
    address:String(point?.address||''),
    city:String(point?.city||''),
    distanceKm:Number.isFinite(Number(point?.distanceKm))?Number(point.distanceKm):null,
    radiusKm:Number.isFinite(Number(point?.radiusKm))?Math.max(0,Number(point.radiusKm)):0,
    latitude:Number(point?.latitude??point?.lat),
    longitude:Number(point?.longitude??point?.lng),
    kind:String(point?.kind||'point'),
    user:point?.user===true,
    route:point?.route!==false,
    actions:(Array.isArray(point?.actions)?point.actions:[]).slice(0,3).map(action=>({
      label:String(action?.label||'').slice(0,40),
      href:String(action?.href||'').startsWith('#/')?String(action.href):'',
      primary:action?.primary===true
    })).filter(action=>action.label&&action.href)
  });

  function ensureStyle(){
    const path='/css/next/geo_map.css';
    if(Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some(node=>{try{return new URL(node.href,location.href).pathname===path;}catch(_e){return false;}}))return;
    const link=document.createElement('link');
    link.rel='stylesheet';
    link.href=path+'?v='+encodeURIComponent(release);
    link.dataset.karetaGeoMapStyle='1';
    document.head.appendChild(link);
  }

  function world(lat,lng,zoom){
    const n=Math.pow(2,zoom),safeLat=clamp(Number(lat),-85.05112878,85.05112878),rad=safeLat*Math.PI/180;
    return {
      x:((Number(lng)+180)/360)*n*256,
      y:(1-Math.log(Math.tan(rad)+1/Math.cos(rad))/Math.PI)/2*n*256
    };
  }
  function fromWorld(x,y,zoom){
    const n=Math.pow(2,zoom),lng=x/(n*256)*360-180,v=Math.PI*(1-2*y/(n*256)),lat=180/Math.PI*Math.atan(Math.sinh(v));
    return {lat:clamp(lat,-85.05112878,85.05112878),lng:((lng+540)%360)-180};
  }
  function centerOf(points){
    if(!points.length)return {latitude:49.9483,longitude:82.6285};
    const source=points.filter(p=>!p.user);
    const rows=source.length?source:points;
    return {latitude:rows.reduce((a,p)=>a+p.latitude,0)/rows.length,longitude:rows.reduce((a,p)=>a+p.longitude,0)/rows.length};
  }
  function fitZoom(points,width,height){
    if(points.length<2)return clamp(config.defaultZoom,config.minZoom,config.maxZoom);
    for(let zoom=config.maxZoom;zoom>=config.minZoom;zoom--){
      const rows=points.map(p=>world(p.latitude,p.longitude,zoom)),xs=rows.map(p=>p.x),ys=rows.map(p=>p.y);
      if(Math.max(...xs)-Math.min(...xs)<=Math.max(120,width-96)&&Math.max(...ys)-Math.min(...ys)<=Math.max(120,height-120))return zoom;
    }
    return config.minZoom;
  }
  function tileUrl(z,x,y){
    return config.tileUrl.replace('{z}',String(z)).replace('{x}',String(x)).replace('{y}',String(y));
  }
  function distanceText(value){
    if(!Number.isFinite(Number(value)))return '';
    const km=Number(value);
    return km<1?Math.max(50,Math.round(km*1000/50)*50)+' м':km.toLocaleString('ru-RU',{minimumFractionDigits:km<10?1:0,maximumFractionDigits:km<10?1:0})+' км';
  }

  function tileStatusText(){
    const lang=String(document.documentElement?.lang||'ru').split('-')[0];
    const text={
      ru:['Подложка загружается…','Часть карты не загрузилась. Точки и адреса доступны.','Подложка недоступна. Точки и адреса доступны.'],
      kk:['Карта жүктелуде…','Картаның бір бөлігі жүктелмеді. Нүктелер мен мекенжайлар қолжетімді.','Карта қолжетімсіз. Нүктелер мен мекенжайлар қолжетімді.'],
      en:['Loading map…','Some map tiles failed. Points and addresses remain available.','Map tiles unavailable. Points and addresses remain available.']
    }[lang]||['Loading map…','Some map tiles failed. Points and addresses remain available.','Map tiles unavailable. Points and addresses remain available.'];
    if(!state)return '';
    if(state.tileFailed)return text[state.tileLoaded?1:2];
    return state.tileLoaded?'':text[0];
  }
  function updateTileStatus(){
    if(!state||!dialog?.open)return;
    const node=dialog.querySelector('[data-geo-map-status]');
    if(node){node.textContent=tileStatusText();node.hidden=!node.textContent;}
  }

  function ensureDialog(){
    if(dialog?.isConnected)return dialog;
    ensureStyle();
    dialog=document.createElement('dialog');
    dialog.className='k-geo-map-dialog';
    dialog.innerHTML=`<div class="k-geo-map-shell">
      <header><div><small>КАРТА KARETA</small><h2 data-geo-map-title>Рядом</h2></div><button type="button" data-geo-map-close aria-label="Закрыть">×</button></header>
      <div class="k-geo-map-viewport" data-geo-map-viewport>
        <div class="k-geo-map-tiles" data-geo-map-tiles></div>
        <div class="k-geo-map-markers" data-geo-map-markers></div>
        <div class="k-geo-map-controls"><button type="button" data-geo-map-zoom="1" aria-label="Приблизить">+</button><button type="button" data-geo-map-zoom="-1" aria-label="Отдалить">−</button></div>
        <div class="k-geo-map-attribution" data-geo-map-attribution><a href="${esc(config.attributionUrl)}" target="_blank" rel="noopener noreferrer">${esc(config.attributionLabel)}</a></div>
      </div>
      <section class="k-geo-map-detail" data-geo-map-detail><b>Выберите точку на карте</b><span>Адрес и маршрут появятся здесь.</span></section>
      <footer><span data-geo-map-count></span><span data-geo-map-status role="status" aria-live="polite"></span><button type="button" data-geo-map-close>Закрыть</button></footer>
    </div>`;
    document.body.appendChild(dialog);
    dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    dialog.addEventListener('click',async event=>{
      if(event.target.closest('[data-geo-map-close]')){close();return;}
      const zoom=event.target.closest('[data-geo-map-zoom]');
      if(zoom&&state){state.zoom=clamp(state.zoom+Number(zoom.dataset.geoMapZoom||0),config.minZoom,config.maxZoom);render();return;}
      const cluster=event.target.closest('[data-geo-map-cluster]');
      if(cluster&&state){const item=state.clusters?.get(cluster.dataset.geoMapCluster);if(item){state.center={lat:item.latitude,lng:item.longitude};state.zoom=clamp(state.zoom+2,config.minZoom,config.maxZoom);state.selected='';render();}return;}
      const marker=event.target.closest('[data-geo-map-point]');
      if(marker&&state){selectPoint(marker.dataset.geoMapPoint);return;}
      const action=event.target.closest('[data-geo-map-action]');
      if(action){close();return;}
      const route=event.target.closest('[data-geo-map-route]');
      if(route&&state){const point=state.points.find(p=>p.id===route.dataset.geoMapRoute);if(point)await openRoute(point);}
    });
    const tileLayer=dialog.querySelector('[data-geo-map-tiles]');
    const tileResult=event=>{
      if(!state||!dialog?.open||String(event.target?.dataset?.geoTileRender)!==String(tileRenderSeq))return;
      if(event.type==='load')state.tileLoaded+=1;
      else state.tileFailed+=1;
      updateTileStatus();
    };
    tileLayer.addEventListener('load',tileResult,true);
    tileLayer.addEventListener('error',tileResult,true);
    const viewport=dialog.querySelector('[data-geo-map-viewport]');
    viewport.addEventListener('pointerdown',event=>{
      if(!state||event.target.closest('button,a'))return;
      viewport.setPointerCapture?.(event.pointerId);
      drag={id:event.pointerId,x:event.clientX,y:event.clientY,centerWorld:world(state.center.lat,state.center.lng,state.zoom)};
      viewport.classList.add('is-dragging');
    });
    viewport.addEventListener('pointermove',event=>{
      if(!drag||event.pointerId!==drag.id)return;
      const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
      dialog.querySelector('[data-geo-map-tiles]').style.transform=`translate(${dx}px,${dy}px)`;
      dialog.querySelector('[data-geo-map-markers]').style.transform=`translate(${dx}px,${dy}px)`;
    });
    const finishDrag=event=>{
      if(!drag||event.pointerId!==drag.id||!state)return;
      const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
      state.center=fromWorld(drag.centerWorld.x-dx,drag.centerWorld.y-dy,state.zoom);
      drag=null;viewport.classList.remove('is-dragging');render();
    };
    viewport.addEventListener('pointerup',finishDrag);
    viewport.addEventListener('pointercancel',finishDrag);
    return dialog;
  }

  function selectPoint(id){
    if(!state||!dialog)return;
    const point=state.points.find(p=>p.id===id);if(!point)return;
    state.selected=id;
    dialog.querySelectorAll('[data-geo-map-point]').forEach(node=>node.classList.toggle('is-selected',node.dataset.geoMapPoint===id));
    const detail=dialog.querySelector('[data-geo-map-detail]'),where=[point.city,point.address].filter(Boolean).join(' · '),distance=distanceText(point.distanceKm);
    const actions=point.actions.map(action=>`<a class="${action.primary?'is-primary':''}" data-geo-map-action href="${esc(action.href)}">${esc(action.label)}</a>`).join('');
    const route=point.route&&!point.user?`<button type="button" data-geo-map-route="${esc(point.id)}">Маршрут</button>`:'';
    detail.innerHTML=`<div class="k-geo-map-detail__copy"><small>${point.user?'ВАША ТОЧКА':esc(point.kind.toUpperCase())}</small><b>${esc(point.label)}</b><span>${esc([distance,where].filter(Boolean).join(' · ')||'Координаты подтверждены')}</span></div><div class="k-geo-map-detail__actions">${actions}${route}</div>`;
  }
  async function openRoute(point){
    if(window.KaretaMobile?.openBestMap)return window.KaretaMobile.openBestMap(point.label,point.latitude,point.longitude);
    const url=`https://www.openstreetmap.org/?mlat=${encodeURIComponent(point.latitude)}&mlon=${encodeURIComponent(point.longitude)}#map=16/${encodeURIComponent(point.latitude)}/${encodeURIComponent(point.longitude)}`;
    window.open(url,'_blank','noopener,noreferrer');
  }

  function render(){
    if(!state||!dialog?.open)return;
    const viewport=dialog.querySelector('[data-geo-map-viewport]'),tiles=dialog.querySelector('[data-geo-map-tiles]'),markers=dialog.querySelector('[data-geo-map-markers]');
    tiles.style.transform='';markers.style.transform='';
    tileRenderSeq+=1;state.tileLoaded=0;state.tileFailed=0;updateTileStatus();
    const width=Math.max(280,viewport.clientWidth||320),height=Math.max(260,viewport.clientHeight||320),zoom=state.zoom,center=world(state.center.lat,state.center.lng,zoom),n=Math.pow(2,zoom);
    const minX=Math.floor((center.x-width/2)/256)-1,maxX=Math.floor((center.x+width/2)/256)+1,minY=Math.max(0,Math.floor((center.y-height/2)/256)-1),maxY=Math.min(n-1,Math.floor((center.y+height/2)/256)+1);
    const tileHtml=[];
    for(let ty=minY;ty<=maxY;ty++)for(let tx=minX;tx<=maxX;tx++){
      const wrapped=((tx%n)+n)%n,left=tx*256-(center.x-width/2),top=ty*256-(center.y-height/2);
      tileHtml.push(`<img src="${esc(tileUrl(zoom,wrapped,ty))}" alt="" data-geo-tile-render="${tileRenderSeq}" draggable="false" loading="eager" referrerpolicy="strict-origin-when-cross-origin" style="left:${left}px;top:${top}px" width="256" height="256">`);
    }
    tiles.innerHTML=tileHtml.join('');
    const visible=state.points.map((point,index)=>{const p=world(point.latitude,point.longitude,zoom),left=width/2+(p.x-center.x),top=height/2+(p.y-center.y);return {point,index,left,top};}).filter(item=>item.left>=-40&&item.left<=width+40&&item.top>=-40&&item.top<=height+40);
    const userItems=visible.filter(item=>item.point.user),providerItems=visible.filter(item=>!item.point.user),clusterSize=zoom>=config.maxZoom?1:52,buckets=new Map();
    providerItems.forEach(item=>{const key=clusterSize===1?item.point.id:(Math.floor(item.left/clusterSize)+':'+Math.floor(item.top/clusterSize));const list=buckets.get(key)||[];list.push(item);buckets.set(key,list);});
    state.clusters=new Map();
    const markerHtml=[];
    userItems.forEach(item=>{if(item.point.radiusKm>0){const metersPerPixel=Math.max(0.01,156543.03392*Math.cos(item.point.latitude*Math.PI/180)/Math.pow(2,zoom)),radiusPx=clamp(item.point.radiusKm*1000/metersPerPixel,8,2200);markerHtml.push(`<div class="k-geo-map-radius" style="left:${item.left}px;top:${item.top}px;width:${radiusPx*2}px;height:${radiusPx*2}px" aria-hidden="true"></div>`);}const selected=state.selected===item.point.id?' is-selected':'';markerHtml.push(`<button type="button" class="k-geo-map-marker is-user${selected}" data-geo-map-point="${esc(item.point.id)}" style="left:${item.left}px;top:${item.top}px" title="${esc(item.point.label)}"><span>●</span></button>`);});
    let clusterIndex=0;
    buckets.forEach(items=>{
      if(items.length===1){const item=items[0],selected=state.selected===item.point.id?' is-selected':'';markerHtml.push(`<button type="button" class="k-geo-map-marker${selected}" data-geo-map-point="${esc(item.point.id)}" style="left:${item.left}px;top:${item.top}px" title="${esc(item.point.label)}"><span>•</span></button>`);return;}
      const id='cluster_'+(clusterIndex++),latitude=items.reduce((sum,item)=>sum+item.point.latitude,0)/items.length,longitude=items.reduce((sum,item)=>sum+item.point.longitude,0)/items.length,left=items.reduce((sum,item)=>sum+item.left,0)/items.length,top=items.reduce((sum,item)=>sum+item.top,0)/items.length;
      state.clusters.set(id,{latitude,longitude,count:items.length});
      markerHtml.push(`<button type="button" class="k-geo-map-cluster" data-geo-map-cluster="${id}" style="left:${left}px;top:${top}px" title="Показать ${items.length} точек"><span>${items.length}</span></button>`);
    });
    markers.innerHTML=markerHtml.join('');
  }

  function open(options={}){
    const points=(Array.isArray(options.points)?options.points:[]).filter(validPoint).slice(0,50).map(normalizePoint);
    if(!points.length)throw new Error('GEO_MAP_POINTS_REQUIRED');
    const dlg=ensureDialog(),title=String(options.title||'Рядом'),center=validPoint(options.center)?normalizePoint(options.center,-1):centerOf(points);
    state={points,center:{lat:center.latitude,lng:center.longitude},zoom:config.defaultZoom,selected:'',clusters:new Map()};
    dlg.querySelector('[data-geo-map-title]').textContent=title;
    dlg.querySelector('[data-geo-map-count]').textContent=points.length+' точек';
    dlg.querySelector('[data-geo-map-detail]').innerHTML='<b>Выберите точку на карте</b><span>Адрес и маршрут появятся здесь.</span>';
    try{dlg.showModal();}catch(_error){dlg.setAttribute('open','');}
    requestAnimationFrame(()=>{if(!state||!dlg.open)return;const viewport=dlg.querySelector('[data-geo-map-viewport]');state.zoom=fitZoom(points,viewport.clientWidth||320,viewport.clientHeight||320);render();});
    return {ok:true,count:points.length};
  }
  function close(){if(!dialog)return;try{dialog.close();}catch(_error){dialog.removeAttribute('open');}state=null;drag=null;}

  window.KaretaGeoMap=Object.freeze({open,close,config:()=>({...config}),audit:()=>({ok:true,lazy:true,loaded:true,tileUrl:config.tileUrl})});
})();