(() => {
  'use strict';
  const registry=new Map();
  const records=new Map();
  const renders=new Map();
  const editing=new Set();
  const busy=new Set();
  const icon=name=>window.KaretaUIIcons?.svg?.(name)||'';
  const esc=value=>window.KaretaUIKit?.esc?.(value)??String(value??'');
  const normalizeSpan=value=>Math.max(1,Math.min(4,Number(value||1)));
  const currentContext=()=>window.KaretaIdentity?.snapshot?.()?.context||window.KaretaNext?.state?.context||null;
  const capabilities=()=>new Set(window.KaretaIdentity?.snapshot?.()?.capabilities||window.KaretaNext?.state?.capabilities||[]);
  const contextKind=context=>{
    const c=context||currentContext()||{};
    const type=String(c.type||c.contextType||'').toLowerCase();
    const key=String(c.key||c.contextKey||'').toLowerCase();
    const profile=String(c.profileType||c.profile_type||'').toLowerCase();
    if(type==='organization'||key.includes('organization')||key.includes('org_'))return 'organization';
    if(profile==='master'||key.includes('master'))return 'master';
    if(profile==='seller'||key.includes('seller'))return 'seller';
    if(type==='system'||key.includes('admin'))return 'admin';
    return 'personal';
  };
  const contextKey=context=>String((context||currentContext()||{}).key||(context||{}).contextKey||'').slice(0,128);
  const scopeKey=(dashboardKey,kind,key)=>`${kind}|${key}|${dashboardKey}`;
  const normalizeLayout=layout=>{
    if(!layout||typeof layout!=='object')return null;
    const order=[...new Set((Array.isArray(layout.order)?layout.order:[]).map(String).filter(Boolean))];
    const spans={};Object.entries(layout.spans||{}).forEach(([key,value])=>{if(key)spans[String(key)]=normalizeSpan(value);});
    return {order,spans};
  };
  const getRecord=(dashboardKey,kind,key)=>{
    const scope=scopeKey(dashboardKey,kind,key);
    if(!records.has(scope))records.set(scope,{dashboardKey,contextKind:kind,contextKey:key,layout:null,revision:0,updatedAt:null});
    return records.get(scope);
  };
  function allowed(widget,context){
    const caps=capabilities();const kind=contextKind(context);
    if(Array.isArray(widget.contextKinds)&&widget.contextKinds.length&&!widget.contextKinds.includes(kind))return false;
    if(Array.isArray(widget.all)&&widget.all.some(cap=>!caps.has(cap)&&!caps.has('*')))return false;
    if(Array.isArray(widget.any)&&widget.any.length&&!widget.any.some(cap=>caps.has(cap)||caps.has('*')))return false;
    return true;
  }
  function register(widget){
    if(!widget||!widget.key||typeof widget.render!=='function')throw new Error('dashboard_widget_invalid');
    registry.set(String(widget.key),Object.freeze({span:1,minSpan:1,...widget}));
  }
  function resolveLayout(dashboardKey,widgets,record){
    const saved=record?.layout;
    const order=Array.isArray(saved?.order)?saved.order:[];
    const byKey=new Map(widgets.map(item=>[item.key,item]));const resolved=[];
    order.forEach(key=>{if(byKey.has(key)){resolved.push(byKey.get(key));byKey.delete(key);}});
    byKey.forEach(item=>resolved.push(item));
    return resolved.map(item=>({...item,span:normalizeSpan(saved?.spans?.[item.key]||item.span)}));
  }
  async function loadLayout(dashboardKey,contextKindValue,contextKeyValue=''){
    const kind=contextKindValue||contextKind();const key=contextKeyValue||contextKey();const record=getRecord(dashboardKey,kind,key);
    try{
      const url=`/api/dashboard_preferences.php?dashboardKey=${encodeURIComponent(dashboardKey)}&contextKind=${encodeURIComponent(kind)}&contextKey=${encodeURIComponent(key)}`;
      const response=await fetch(url,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
      if(!response.ok||!String(response.headers.get('content-type')||'').includes('application/json'))return record.layout;
      const data=await response.json();
      if(data.ok){record.layout=normalizeLayout(data.layout);record.revision=Math.max(0,Number(data.revision)||0);record.updatedAt=data.updatedAt||null;}
      return record.layout;
    }catch{return record.layout;}
  }
  async function persist(record,action='save'){
    const scope=scopeKey(record.dashboardKey,record.contextKind,record.contextKey);if(busy.has(scope))throw new Error('dashboard_save_in_progress');busy.add(scope);
    try{
      const response=await fetch('/api/dashboard_preferences.php',{method:'POST',credentials:'same-origin',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({action,dashboardKey:record.dashboardKey,contextKind:record.contextKind,contextKey:record.contextKey,layout:record.layout,expectedRevision:record.revision})});
      const data=String(response.headers.get('content-type')||'').includes('application/json')?await response.json():{ok:false,error:'dashboard_invalid_response'};
      if(response.status===409){record.layout=normalizeLayout(data.layout);record.revision=Math.max(0,Number(data.revision)||0);const error=new Error('dashboard_revision_conflict');error.code='dashboard_revision_conflict';throw error;}
      if(!response.ok||data.ok===false)throw new Error(data.error||`dashboard_http_${response.status}`);
      record.layout=normalizeLayout(data.layout);record.revision=Math.max(0,Number(data.revision)||0);record.updatedAt=data.updatedAt||null;
      window.dispatchEvent(new CustomEvent('kareta:dashboard-layout-saved',{detail:{dashboardKey:record.dashboardKey,contextKind:record.contextKind,contextKey:record.contextKey,revision:record.revision,action}}));
      return record.layout;
    }finally{busy.delete(scope);}
  }
  async function saveLayout(dashboardKey,contextKindValue,layout,contextKeyValue=''){
    const record=getRecord(dashboardKey,contextKindValue||contextKind(),contextKeyValue||contextKey());record.layout=normalizeLayout(layout);return persist(record,'save');
  }
  async function resetLayout(dashboardKey,contextKindValue,contextKeyValue=''){
    const record=getRecord(dashboardKey,contextKindValue||contextKind(),contextKeyValue||contextKey());await persist(record,'reset');return null;
  }
  function controls(widget,index,total){return `<div class="k-dashboard-widget__controls" aria-label="Настройка виджета"><button type="button" data-dashboard-move="prev" ${index===0?'disabled':''} aria-label="Переместить влево">←</button><button type="button" data-dashboard-move="next" ${index===total-1?'disabled':''} aria-label="Переместить вправо">→</button><button type="button" data-dashboard-span="down" ${widget.span<=1?'disabled':''} aria-label="Уменьшить ширину">−</button><span>${widget.span}/4</span><button type="button" data-dashboard-span="up" ${widget.span>=4?'disabled':''} aria-label="Увеличить ширину">＋</button></div>`;}
  function renderWidget(widget,data,context,isEditing,index,total){
    const body=widget.render(data,context);
    return `<article class="k-dashboard-widget ${isEditing?'is-editing':''}" data-dashboard-widget="${esc(widget.key)}" style="--widget-span:${normalizeSpan(widget.span)}"><header class="k-dashboard-widget__head"><div>${icon(widget.icon||'dashboard')}<span><b>${esc(widget.title||widget.key)}</b>${widget.subtitle?`<small>${esc(widget.subtitle)}</small>`:''}</span></div>${isEditing?controls(widget,index,total):(widget.href?`<a href="${esc(widget.href)}" aria-label="Открыть ${esc(widget.title||widget.key)}">${icon('chevronRight')}</a>`:'')}</header><div class="k-dashboard-widget__body">${body}</div></article>`;
  }
  function render(dashboardKey,data={},options={}){
    const context=options.context||currentContext();const kind=contextKind(context);const key=options.contextKey||contextKey(context);const scope=scopeKey(dashboardKey,kind,key);const record=getRecord(dashboardKey,kind,key);
    const requested=(options.widgets||[]).map(widgetKey=>registry.get(widgetKey)).filter(Boolean).filter(widget=>allowed(widget,context));const widgets=resolveLayout(dashboardKey,requested,record);const isEditing=editing.has(scope);renders.set(scope,{dashboardKey,data,options:{...options,context,contextKey:key}});
    const personalized=options.personalizable!==false;
    return `<section class="k-dashboard ${isEditing?'is-editing':''}" data-dashboard="${esc(dashboardKey)}" data-context-kind="${esc(kind)}" data-context-key="${esc(key)}"><div class="k-dashboard-toolbar">${personalized?`<button type="button" class="k-dashboard-tool" data-dashboard-edit aria-pressed="${isEditing?'true':'false'}">${icon('settings')}<span>${isEditing?'Готово':'Настроить'}</span></button><button type="button" class="k-dashboard-tool" data-dashboard-reset ${record.layout?'':'disabled'}>${icon('refresh')}<span>Сбросить</span></button>`:''}<small data-dashboard-revision>Версия ${record.revision}</small></div><div class="k-dashboard-grid">${widgets.map((widget,index)=>renderWidget(widget,data,context,isEditing,index,widgets.length)).join('')}</div></section>`;
  }
  function rerender(node){
    const dashboardKey=node.dataset.dashboard;const kind=node.dataset.contextKind;const key=node.dataset.contextKey;const cached=renders.get(scopeKey(dashboardKey,kind,key));if(cached)node.outerHTML=render(cached.dashboardKey,cached.data,cached.options);
  }
  async function mutate(node,button){
    const dashboardKey=node.dataset.dashboard;const kind=node.dataset.contextKind;const key=node.dataset.contextKey;const scope=scopeKey(dashboardKey,kind,key);const cached=renders.get(scope);const record=getRecord(dashboardKey,kind,key);if(!cached)return;
    const context=cached.options.context;const widgets=resolveLayout(dashboardKey,(cached.options.widgets||[]).map(widgetKey=>registry.get(widgetKey)).filter(Boolean).filter(widget=>allowed(widget,context)),record);const widgetNode=button.closest('[data-dashboard-widget]');const widgetKey=widgetNode?.dataset.dashboardWidget;const index=widgets.findIndex(widget=>widget.key===widgetKey);if(index<0)return;
    const order=widgets.map(widget=>widget.key);const spans={...(record.layout?.spans||{})};
    if(button.dataset.dashboardMove){const target=button.dataset.dashboardMove==='prev'?index-1:index+1;if(target<0||target>=order.length)return;[order[index],order[target]]=[order[target],order[index]];}
    if(button.dataset.dashboardSpan){const widget=widgets[index];spans[widgetKey]=normalizeSpan(widget.span+(button.dataset.dashboardSpan==='up'?1:-1));}
    record.layout={order,spans};rerender(node);
    try{await persist(record,'save');const fresh=document.querySelector(`[data-dashboard="${CSS.escape(dashboardKey)}"][data-context-key="${CSS.escape(key)}"]`);if(fresh)rerender(fresh);window.KaretaToast?.success?.('Расположение виджетов сохранено');}
    catch(error){const fresh=document.querySelector(`[data-dashboard="${CSS.escape(dashboardKey)}"][data-context-key="${CSS.escape(key)}"]`);if(fresh)rerender(fresh);window.KaretaToast?.error?.(error.code==='dashboard_revision_conflict'?'Настройки изменились в другой вкладке. Загружена актуальная версия.':'Не удалось сохранить виджеты');}
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-dashboard-edit],[data-dashboard-reset],[data-dashboard-move],[data-dashboard-span]');if(!button)return;const node=button.closest('[data-dashboard]');if(!node)return;const scope=scopeKey(node.dataset.dashboard,node.dataset.contextKind,node.dataset.contextKey);
    if(button.matches('[data-dashboard-edit]')){editing.has(scope)?editing.delete(scope):editing.add(scope);rerender(node);return;}
    if(button.matches('[data-dashboard-reset]')){button.disabled=true;const record=getRecord(node.dataset.dashboard,node.dataset.contextKind,node.dataset.contextKey);resetLayout(record.dashboardKey,record.contextKind,record.contextKey).then(()=>{const fresh=document.querySelector(`[data-dashboard="${CSS.escape(record.dashboardKey)}"][data-context-key="${CSS.escape(record.contextKey)}"]`);if(fresh)rerender(fresh);window.KaretaToast?.success?.('Стандартное расположение восстановлено');}).catch(error=>{const fresh=document.querySelector(`[data-dashboard="${CSS.escape(record.dashboardKey)}"][data-context-key="${CSS.escape(record.contextKey)}"]`);if(fresh)rerender(fresh);window.KaretaToast?.error?.(error.code==='dashboard_revision_conflict'?'Настройки обновлены в другой вкладке':'Не удалось сбросить виджеты');});return;}
    mutate(node,button);
  });
  async function mount(root,dashboardKey,options={}){
    if(!root)return;const context=options.context||currentContext();const kind=contextKind(context);const key=options.contextKey||contextKey(context);await loadLayout(dashboardKey,kind,key);if(typeof options.render==='function')root.innerHTML=options.render();root.dispatchEvent(new CustomEvent('kareta:dashboard-ready',{bubbles:true,detail:{dashboardKey,contextKind:kind,contextKey:key}}));
  }
  window.KaretaDashboardEngine=Object.freeze({register,render,mount,loadLayout,saveLayout,resetLayout,contextKind,contextKinds:['personal','master','seller','organization','admin'],contextKey,allowed});
})();
