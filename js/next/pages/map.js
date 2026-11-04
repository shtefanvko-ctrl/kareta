(() => {
  'use strict';
  if (window.KaretaMapPages) return;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const valid = p => p && p.latitude !== null && p.longitude !== null &&
    String(p.latitude).trim() !== '' && String(p.longitude).trim() !== '' &&
    Number.isFinite(Number(p.latitude)) && Number.isFinite(Number(p.longitude)) &&
    Math.abs(Number(p.latitude)) <= 90 && Math.abs(Number(p.longitude)) <= 180;
  const cities = () => Array.isArray(window.KaretaOnboardingSelectionCatalog?.cities)
    ? window.KaretaOnboardingSelectionCatalog.cities : [];
  const cityCenter = city => {
    const p = window.KaretaOnboardingSelectionCatalog?.resolveCityCenter?.(city);
    return valid(p) ? {latitude:Number(p.latitude),longitude:Number(p.longitude)} : null;
  };
  const types = {
    all:'master,sto,organization,organization_unit,shop',
    master:'master', sto:'sto,organization,organization_unit', shop:'shop', mobile:'master,sto'
  };
  const normalize = value => String(value || '').trim().toLocaleLowerCase('ru-RU');
  const dist = km => Number.isFinite(Number(km)) && km !== null
    ? (Number(km) < 1 ? Math.round(Number(km)*1000)+' м' : Number(km).toFixed(1)+' км')
    : '';
  function pointActions(p) {
    const owner = String(p.ownerType || ''), id = encodeURIComponent(String(p.ownerId || ''));
    if (!id || id === 'undefined') return [];
    if (owner === 'master' || owner === 'sto') {
      const kind = owner === 'master' ? 'master' : 'sto';
      const out = [{label:'Профиль',href:`#/masters/profile/${kind}/${id}`}];
      if (kind === 'master') out.push({label:'Записаться',href:`#/masters/book/master/${id}`,primary:true});
      return out;
    }
    if (owner === 'shop') return [{label:'Запчасти',href:'#/parts'}];
    return [];
  }
  function publicPoint(row) {
    if (!row || !valid(row)) return null;
    if (!['master','sto','organization','organization_unit','shop'].includes(String(row.ownerType))) return null;
    return {
      id:String(row.id || ''), ownerType:String(row.ownerType), ownerId:String(row.ownerId || ''),
      label:String(row.label || 'Объект'), kind:String(row.kind || ''), city:String(row.city || ''),
      address:String(row.address || ''), latitude:Number(row.latitude), longitude:Number(row.longitude),
      distanceKm:row.distanceKm == null || !Number.isFinite(Number(row.distanceKm)) ? null : Number(row.distanceKm),
      verifiedAt:row.verifiedAt || null
    };
  }
  function categoryMatch(p, category) {
    if (category === 'mobile') return p.kind === 'mobile_origin';
    if (category === 'master') return p.ownerType === 'master';
    if (category === 'sto') return ['sto','organization','organization_unit'].includes(p.ownerType);
    if (category === 'shop') return p.ownerType === 'shop';
    return true;
  }
  function renderMap() {
    return `<section class="k-page k-gis-page" data-gis-page aria-label="ГИС-карта KARETA">
      <header class="k-gis-page__heading"><div><small>KARETA · ГИС</small><h1>Карта услуг</h1></div><a href="#/masters">Каталог мастеров</a></header>
      <div class="k-gis-page__toolbar">
        <label class="k-gis-page__search"><span>Поиск</span><input type="search" data-gis-search autocomplete="off" placeholder="Название, услуга или адрес"></label>
        <label><span>Город</span><select data-gis-city aria-label="Выбрать город"></select></label>
        <button type="button" data-gis-location>⌖ <span>Моё место</span></button>
        <button type="button" data-gis-filter-toggle aria-expanded="false" aria-controls="k-gis-extra">Фильтры</button>
      </div>
      <div class="k-gis-page__filters" id="k-gis-extra" data-gis-filters hidden>
        <label><span>Категория</span><select data-gis-category>
          <option value="all">Все</option><option value="master">Мастера</option>
          <option value="sto">СТО</option><option value="shop">Магазины</option>
          <option value="mobile">Выездные специалисты</option></select></label>
        <label><span>Радиус</span><select data-gis-radius>
          <option value="5">5 км</option><option value="10">10 км</option>
          <option value="20" selected>20 км</option><option value="50">50 км</option>
          <option value="100">100 км</option></select></label>
        <label class="k-gis-page__check"><input type="checkbox" data-gis-verified> Только с подтверждённой геоточкой</label>
      </div>
      <p class="k-gis-page__status" role="status" aria-live="polite" data-gis-status>Загрузка карты…</p>
      <div class="k-gis-page__body">
        <aside class="k-gis-page__results" aria-label="Результаты поиска">
          <div class="k-gis-page__result-heading"><b>Объекты</b><span data-gis-count>0</span></div>
          <div data-gis-results><p>Загрузка…</p></div>
        </aside>
        <div class="k-gis-page__canvas" data-gis-canvas aria-label="Интерактивная карта"></div>
      </div>
      <p class="k-gis-page__note">Расстояния — по прямой. «Маршрут» открывает внешнюю карту, а не встроенную пошаговую навигацию. Показываются только опубликованные точные координаты.</p>
    </section>`;
  }

  function mountMap(context = {}) {
    const root=document.querySelector('[data-gis-page]');
    if (!root) return () => {};
    const $=selector=>root.querySelector(selector);
    const cityNode=$('[data-gis-city]'), searchNode=$('[data-gis-search]');
    const categoryNode=$('[data-gis-category]'), radiusNode=$('[data-gis-radius]');
    const verifiedNode=$('[data-gis-verified]'), statusNode=$('[data-gis-status]');
    const resultsNode=$('[data-gis-results]'), countNode=$('[data-gis-count]');
    const canvas=$('[data-gis-canvas]'), locationNode=$('[data-gis-location]');
    const filterNode=$('[data-gis-filters]'), filterToggle=$('[data-gis-filter-toggle]');
    const params=new URLSearchParams(String(location.hash || '').split('?')[1] || '');
    let city=params.get('city') || '', center=null, userPoint=null, records=[], geo=null;
    let disposed=false, controller=null, sequence=0, timer=0, searchTimer=0, selected=params.get('point') || '';
    let latestCenter=null, failure='', loaded=false;
    const cache=new Map();
    const setStatus=(message,isError=false)=>{statusNode.textContent=message;statusNode.dataset.error=isError?'1':'0';};
    const makeUrl=()=>{
      const query=new URLSearchParams();
      if (city) query.set('city',city);
      if (categoryNode.value !== 'all') query.set('type',categoryNode.value);
      if (Number(radiusNode.value)!==20) query.set('radius',radiusNode.value);
      if (searchNode.value.trim()) query.set('q',searchNode.value.trim().slice(0,100));
      if (verifiedNode.checked) query.set('verified','1');
      if (selected) query.set('point',selected);
      history.replaceState(history.state,'',`#/map?${query.toString()}`);
    };
    const names=cities();
    const available=names.filter(name=>typeof name==='string' && cityCenter(name));
    if (!city || !available.includes(city)) {
      try { const saved=JSON.parse(localStorage.getItem('kareta.home.location.v1') || 'null');city=available.includes(saved?.city)?saved.city:''; } catch (_error) {}
    }
    if (!city) city=available[0] || '';
    cityNode.innerHTML=available.map(name=>`<option value="${esc(name)}">${esc(name)}</option>`).join('');
    cityNode.value=city;
    if (Object.hasOwn(types,params.get('type') || '')) categoryNode.value=params.get('type');
    if ([5,10,20,50,100].includes(Number(params.get('radius')))) radiusNode.value=params.get('radius');
    if (params.get('q')) searchNode.value=params.get('q').slice(0,100);
    verifiedNode.checked=params.get('verified')==='1';
    center=cityCenter(city);
    latestCenter=center;

    function filtered() {
      const q=normalize(searchNode.value), category=categoryNode.value;
      return records.filter(p=>categoryMatch(p,category))
        .filter(p=>!verifiedNode.checked || !!p.verifiedAt)
        .filter(p=>!q || normalize([p.label,p.city,p.address,p.kind].join(' ')).includes(q))
        .slice(0,50);
    }
    function draw() {
      if (disposed) return;
      const items=filtered(), list=items.map(p=>{
        const label=p.ownerType==='shop'?'Магазин':p.ownerType==='master'?'Мастер':'СТО';
        return `<button type="button" class="k-gis-page__item${p.id===selected?' is-selected':''}" data-gis-item="${esc(p.id)}">
          <small>${esc(label)} ${p.verifiedAt?'· подтверждённая точка':''}</small><b>${esc(p.label)}</b>
          <span>${esc([p.city,p.address].filter(Boolean).join(', '))}</span>
          ${p.distanceKm!==null ? `<em>${esc(dist(p.distanceKm))} по прямой</em>` : ''}
        </button>`;
      }).join('');
      resultsNode.innerHTML=list || `<p class="k-gis-page__empty">${esc(failure || (loaded?'Нет публичных точек для выбранных условий.':'Загрузка публичных точек…'))}</p>`;
      countNode.textContent=String(items.length);
      geo?.setPoints?.([...(userPoint?[userPoint]:[]),...items.map(p=>({
        ...p,kind:p.ownerType,actions:pointActions(p),route:true
      }))],failure || (items.length?'':'В выбранной области пока нет опубликованных точек.'));
      if (selected && items.some(p=>p.id===selected)) geo?.select?.(selected);
    }
    const updateViewport=v=>{
      if (disposed || !v || !valid({latitude:v.lat,longitude:v.lng})) return;
      latestCenter={latitude:v.lat,longitude:v.lng};
      clearTimeout(timer);timer=setTimeout(()=>load(),420);
    };
    const onSelect=p=>{
      selected=p?.user?'':String(p?.id||'');
      root.querySelectorAll('[data-gis-item]').forEach(el=>el.classList.toggle('is-selected',el.dataset.gisItem===selected));
      makeUrl();
    };
    async function load() {
      if (disposed || !latestCenter) return;
      controller?.abort();controller=new AbortController();const request=++sequence;
      const where=latestCenter,radius=Number(radiusNode.value) || 20;
      const key=[where.latitude.toFixed(3),where.longitude.toFixed(3),radius].join(':');
      failure='';setStatus('Загрузка опубликованных геоточек…');
      try {
        let points,cacheItem=cache.get(key);
        if (cacheItem && Date.now()-cacheItem.at<20000) points=cacheItem.points;
        else {
          const q=new URLSearchParams({action:'nearby',lat:String(where.latitude),lng:String(where.longitude),
            radiusKm:String(radius),limit:'50',types:types.all});
          const response=await fetch('/api/geo.php?'+q.toString(),{
            method:'GET',credentials:'same-origin',signal:controller.signal,headers:{Accept:'application/json'}
          });
          if (!response.ok) throw new Error('HTTP '+response.status);
          const payload=await response.json();
          if (payload?.ok!==true || !Array.isArray(payload.items) || payload.meta?.visibility!=='exact_only')
            throw new Error('Некорректный контракт Geo API');
          points=payload.items.map(publicPoint).filter(Boolean);
          cache.set(key,{at:Date.now(),points});
          if(cache.size>12)cache.delete(cache.keys().next().value);
        }
        if (disposed || request!==sequence) return;
        records=points;loaded=true;setStatus(points.length?`Найдено публичных точек: ${points.length}`:'Публичных точек в этом радиусе нет.');
        draw();
      } catch(error) {
        if (disposed || request!==sequence || error?.name==='AbortError') return;
        records=[];loaded=true;failure='Серверный Geo API недоступен или вернул ошибку. Данные не подменяются.';
        setStatus(`${failure} (${String(error?.message||'ошибка').slice(0,80)})`,true);draw();
      }
    }
    const changeCity=()=>{
      city=cityNode.value;center=cityCenter(city);latestCenter=center;selected='';
      if (!center){setStatus('Для города не подтверждён картографический центр.',true);return;}
      geo?.open?.({host:canvas,center,points:userPoint?[userPoint]:[],title:city,onViewportChange:updateViewport,onSelect});
      makeUrl();load();
    };
    const changeQuery=()=>{selected='';makeUrl();draw();};
    const changeFilter=()=>{selected='';makeUrl();load();};
    const detect=async()=>{
      locationNode.disabled=true;setStatus('Определяем местоположение по вашему разрешению…');
      try {
        const p=await window.KaretaMobile?.bestLocation?.({enableHighAccuracy:false,timeout:10000});
        if (!valid(p)) throw new Error('Координаты недоступны');
        if (disposed) return;
        userPoint={id:'user',label:'Вы здесь',latitude:Number(p.latitude),longitude:Number(p.longitude),user:true,route:false};
        latestCenter={latitude:userPoint.latitude,longitude:userPoint.longitude};
        selected='';geo?.open?.({host:canvas,center:latestCenter,points:[userPoint],onViewportChange:updateViewport,onSelect,title:'Рядом с вами'});
        load();
      } catch(error) {if(!disposed)setStatus('Геопозиция не получена. Выберите город вручную.',true);}
      finally {locationNode.disabled=false;}
    };
    const clickResult=e=>{const item=e.target.closest('[data-gis-item]');if(item)geo?.select?.(item.dataset.gisItem);};
    const toggle=()=>{filterNode.hidden=!filterNode.hidden;filterToggle.setAttribute('aria-expanded',String(!filterNode.hidden));};
    const input=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(changeQuery,250);};
    resultsNode.addEventListener('click',clickResult);
    cityNode.addEventListener('change',changeCity);
    categoryNode.addEventListener('change',changeFilter);
    radiusNode.addEventListener('change',changeFilter);
    verifiedNode.addEventListener('change',changeQuery);
    searchNode.addEventListener('input',input);
    filterToggle.addEventListener('click',toggle);
    locationNode.addEventListener('click',detect);

    (async()=>{
      try {
        if (!center) throw new Error('Нет подтверждённого центра города');
        geo=await window.KaretaMobile?.loadGeoMap?.();
        if (disposed) return;
        if (!geo?.open || !geo?.setPoints) throw new Error('Картографический модуль недоступен');
        geo.open({host:canvas,center,points:[],title:city,onViewportChange:updateViewport,onSelect});
        makeUrl();await load();
      } catch(error) {if(!disposed)setStatus(String(error?.message||'Карта недоступна'),true);}
    })();
    return ()=>{
      disposed=true;sequence++;controller?.abort();clearTimeout(timer);clearTimeout(searchTimer);
      resultsNode.removeEventListener('click',clickResult);cityNode.removeEventListener('change',changeCity);
      categoryNode.removeEventListener('change',changeFilter);radiusNode.removeEventListener('change',changeFilter);
      verifiedNode.removeEventListener('change',changeQuery);searchNode.removeEventListener('input',input);
      filterToggle.removeEventListener('click',toggle);locationNode.removeEventListener('click',detect);
      geo?.close?.();
    };
  }
  window.KaretaMapPages=Object.freeze({renderMap,mountMap});
})();
