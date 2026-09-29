(() => {
  'use strict';

  const api=window.KaretaClientCabinetApi;
  if(!api) throw new Error('KaretaClientCabinetApi is required before first_vehicle_flow.js');

  const RELEASE='first-vehicle-v4-visual-picker';
  const BODY_TYPES=Object.freeze([
    {id:'sedan',label:'Седан',icon:'sedan'},
    {id:'suv',label:'Кроссовер',icon:'suv'},
    {id:'hatchback',label:'Хэтчбек',icon:'hatch'},
    {id:'wagon',label:'Универсал',icon:'wagon'},
    {id:'coupe',label:'Купе',icon:'coupe'},
    {id:'minivan',label:'Минивэн',icon:'van'},
    {id:'pickup',label:'Пикап',icon:'pickup'},
    {id:'other',label:'Другой',icon:'car'}
  ]);
  const PENDING_KEY='kareta.firstVehicle.pendingIntro.v1';
  const DRAFT_PREFIX='kareta.firstVehicle.draft.v1:';
  const EDIT_DRAFT_PREFIX='kareta.vehicle.edit.draft.v1:';
  const PROMPT_PREFIX='kareta.firstVehicle.prompt.v1:';
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const normalizeText=value=>String(value??'').trim().replace(/\s+/g,' ');
  const normalizeVin=value=>String(value??'').toUpperCase().replace(/\s+/g,'').replace(/[^A-HJ-NPR-Z0-9]/g,'').slice(0,17);
  const normalizePlate=value=>String(value??'').toUpperCase().replace(/\s+/g,' ').trimStart().slice(0,24);
  const currentYear=()=>new Date().getFullYear();

  const CATALOG=Object.freeze([
    {id:'toyota',name:'Toyota',popular:true,models:[
      {id:'camry',name:'Camry',generations:[['XV30',2001,2006],['XV40',2006,2011],['XV50',2011,2018],['XV70',2017,2024],['XV80',2024,2030]]},
      {id:'corolla',name:'Corolla'}, {id:'rav4',name:'RAV4'}, {id:'land-cruiser',name:'Land Cruiser'}, {id:'prado',name:'Land Cruiser Prado'}, {id:'highlander',name:'Highlander'}, {id:'hilux',name:'Hilux'}]},
    {id:'lexus',name:'Lexus',popular:true,models:[{id:'rx',name:'RX'},{id:'lx',name:'LX'},{id:'gx',name:'GX'},{id:'es',name:'ES'},{id:'nx',name:'NX'},{id:'is',name:'IS'}]},
    {id:'hyundai',name:'Hyundai',popular:true,models:[{id:'accent',name:'Accent'},{id:'elantra',name:'Elantra'},{id:'sonata',name:'Sonata'},{id:'tucson',name:'Tucson'},{id:'santa-fe',name:'Santa Fe'},{id:'palisade',name:'Palisade'}]},
    {id:'kia',name:'Kia',popular:true,models:[{id:'rio',name:'Rio'},{id:'cerato',name:'Cerato'},{id:'k5',name:'K5'},{id:'sportage',name:'Sportage'},{id:'sorento',name:'Sorento'},{id:'carnival',name:'Carnival'}]},
    {id:'chevrolet',name:'Chevrolet',popular:true,models:[{id:'cobalt',name:'Cobalt'},{id:'nexia',name:'Nexia'},{id:'malibu',name:'Malibu'},{id:'tracker',name:'Tracker'},{id:'captiva',name:'Captiva'},{id:'tahoe',name:'Tahoe'}]},
    {id:'lada',name:'LADA',popular:true,models:[{id:'granta',name:'Granta'},{id:'vesta',name:'Vesta'},{id:'niva',name:'Niva'},{id:'largus',name:'Largus'},{id:'priora',name:'Priora'},{id:'kalina',name:'Kalina'}]},
    {id:'volkswagen',name:'Volkswagen',popular:true,models:[{id:'polo',name:'Polo'},{id:'passat',name:'Passat'},{id:'tiguan',name:'Tiguan'},{id:'touareg',name:'Touareg'},{id:'golf',name:'Golf'},{id:'jetta',name:'Jetta'}]},
    {id:'nissan',name:'Nissan',popular:true,models:[{id:'qashqai',name:'Qashqai'},{id:'x-trail',name:'X-Trail'},{id:'murano',name:'Murano'},{id:'patrol',name:'Patrol'},{id:'teana',name:'Teana'},{id:'almera',name:'Almera'}]},
    {id:'honda',name:'Honda',models:[{id:'cr-v',name:'CR-V'},{id:'accord',name:'Accord'},{id:'civic',name:'Civic'},{id:'pilot',name:'Pilot'},{id:'fit',name:'Fit'}]},
    {id:'mazda',name:'Mazda',models:[{id:'3',name:'3'},{id:'6',name:'6'},{id:'cx-5',name:'CX-5'},{id:'cx-7',name:'CX-7'},{id:'cx-9',name:'CX-9'}]},
    {id:'mitsubishi',name:'Mitsubishi',models:[{id:'outlander',name:'Outlander'},{id:'pajero',name:'Pajero'},{id:'pajero-sport',name:'Pajero Sport'},{id:'lancer',name:'Lancer'},{id:'asx',name:'ASX'}]},
    {id:'subaru',name:'Subaru',models:[{id:'forester',name:'Forester'},{id:'outback',name:'Outback'},{id:'legacy',name:'Legacy'},{id:'impreza',name:'Impreza'},{id:'xv',name:'XV'}]},
    {id:'renault',name:'Renault',models:[{id:'logan',name:'Logan'},{id:'duster',name:'Duster'},{id:'sandero',name:'Sandero'},{id:'kaptur',name:'Kaptur'},{id:'koleos',name:'Koleos'}]},
    {id:'skoda',name:'Škoda',models:[{id:'octavia',name:'Octavia'},{id:'rapid',name:'Rapid'},{id:'kodiaq',name:'Kodiaq'},{id:'superb',name:'Superb'},{id:'karoc',name:'Karoq'}]},
    {id:'ford',name:'Ford',models:[{id:'focus',name:'Focus'},{id:'mondeo',name:'Mondeo'},{id:'kuga',name:'Kuga'},{id:'explorer',name:'Explorer'},{id:'transit',name:'Transit'}]},
    {id:'mercedes-benz',name:'Mercedes-Benz',models:[{id:'c-class',name:'C-Class'},{id:'e-class',name:'E-Class'},{id:'s-class',name:'S-Class'},{id:'gle',name:'GLE'},{id:'glc',name:'GLC'},{id:'g-class',name:'G-Class'}]},
    {id:'bmw',name:'BMW',models:[{id:'3-series',name:'3 Series'},{id:'5-series',name:'5 Series'},{id:'7-series',name:'7 Series'},{id:'x3',name:'X3'},{id:'x5',name:'X5'},{id:'x6',name:'X6'}]},
    {id:'audi',name:'Audi',models:[{id:'a4',name:'A4'},{id:'a6',name:'A6'},{id:'a8',name:'A8'},{id:'q5',name:'Q5'},{id:'q7',name:'Q7'},{id:'q8',name:'Q8'}]},
    {id:'geely',name:'Geely',models:[{id:'coolray',name:'Coolray'},{id:'atlas',name:'Atlas'},{id:'tugella',name:'Tugella'},{id:'emgrand',name:'Emgrand'}]},
    {id:'chery',name:'Chery',models:[{id:'tiggo-4',name:'Tiggo 4'},{id:'tiggo-7',name:'Tiggo 7'},{id:'tiggo-8',name:'Tiggo 8'},{id:'arrizo-8',name:'Arrizo 8'}]},
    {id:'haval',name:'Haval',models:[{id:'jolion',name:'Jolion'},{id:'f7',name:'F7'},{id:'dargo',name:'Dargo'},{id:'h9',name:'H9'}]},
    {id:'jac',name:'JAC',models:[{id:'s3',name:'S3'},{id:'s5',name:'S5'},{id:'js4',name:'JS4'},{id:'js6',name:'JS6'},{id:'t8',name:'T8'}]},
    {id:'byd',name:'BYD',models:[{id:'song-plus',name:'Song Plus'},{id:'han',name:'Han'},{id:'seal',name:'Seal'},{id:'atto-3',name:'Atto 3'}]},
    {id:'suzuki',name:'Suzuki',models:[{id:'vitara',name:'Vitara'},{id:'grand-vitara',name:'Grand Vitara'},{id:'sx4',name:'SX4'},{id:'jimny',name:'Jimny'}]},
    {id:'peugeot',name:'Peugeot',models:[{id:'206',name:'206'},{id:'307',name:'307'},{id:'308',name:'308'},{id:'408',name:'408'},{id:'3008',name:'3008'}]},
    {id:'opel',name:'Opel',models:[{id:'astra',name:'Astra'},{id:'vectra',name:'Vectra'},{id:'zafira',name:'Zafira'},{id:'insignia',name:'Insignia'}]},
    {id:'land-rover',name:'Land Rover',models:[{id:'range-rover',name:'Range Rover'},{id:'range-rover-sport',name:'Range Rover Sport'},{id:'discovery',name:'Discovery'},{id:'defender',name:'Defender'}]},
    {id:'range-rover',name:'Range Rover',models:[{id:'range-rover',name:'Range Rover'},{id:'sport',name:'Sport'},{id:'evoque',name:'Evoque'},{id:'velar',name:'Velar'}]},
    {id:'volvo',name:'Volvo',models:[{id:'xc40',name:'XC40'},{id:'xc60',name:'XC60'},{id:'xc90',name:'XC90'},{id:'s60',name:'S60'},{id:'s90',name:'S90'}]},
    {id:'tesla',name:'Tesla',models:[{id:'model-3',name:'Model 3'},{id:'model-y',name:'Model Y'},{id:'model-s',name:'Model S'},{id:'model-x',name:'Model X'}]},
    {id:'porsche',name:'Porsche',models:[{id:'cayenne',name:'Cayenne'},{id:'macan',name:'Macan'},{id:'panamera',name:'Panamera'},{id:'911',name:'911'}]},
    {id:'jeep',name:'Jeep',models:[{id:'grand-cherokee',name:'Grand Cherokee'},{id:'wrangler',name:'Wrangler'},{id:'compass',name:'Compass'}]},
    {id:'infiniti',name:'Infiniti',models:[{id:'qx50',name:'QX50'},{id:'qx60',name:'QX60'},{id:'qx80',name:'QX80'},{id:'q50',name:'Q50'}]},
    {id:'jaguar',name:'Jaguar',models:[{id:'f-pace',name:'F-Pace'},{id:'e-pace',name:'E-Pace'},{id:'xe',name:'XE'},{id:'xf',name:'XF'}]},
    {id:'cadillac',name:'Cadillac',models:[{id:'escalade',name:'Escalade'},{id:'xt5',name:'XT5'},{id:'xt6',name:'XT6'}]},
    {id:'mini',name:'MINI',models:[{id:'cooper',name:'Cooper'},{id:'countryman',name:'Countryman'},{id:'clubman',name:'Clubman'}]},
    {id:'citroen',name:'Citroen',models:[{id:'c3',name:'C3'},{id:'c4',name:'C4'},{id:'c5-aircross',name:'C5 Aircross'}]},
    {id:'fiat',name:'Fiat',models:[{id:'500',name:'500'},{id:'doblo',name:'Doblo'},{id:'ducato',name:'Ducato'}]},
    {id:'gaz',name:'ГАЗ',models:[{id:'gazelle',name:'Газель'},{id:'sobol',name:'Соболь'},{id:'volga',name:'Волга'}]},
    {id:'uaz',name:'УАЗ',models:[{id:'patriot',name:'Patriot'},{id:'hunter',name:'Hunter'},{id:'profi',name:'Profi'}]}
  ]);

  const state={root:null,sourceRoot:null,data:null,step:0,success:null,onReturn:null,mode:'manual',saving:false,autoScheduled:false,editVehicleId:'',editLegacyBrandName:'',serverRevision:0,serverStatus:'',serverUpdatedAt:0,serverLoaded:false,serverSaving:false,serverSavePending:false,serverSaveTimer:0,serverConflict:false,serverDraftSignature:'',serverBackoffUntil:0};
  let sessionEpoch=0;

  function identity(){return window.KaretaIdentity?.snapshot?.()||{};}
  function scopeKey(detail={}){
    const snap=detail.identity||identity();
    const user=detail.user||window.KaretaNext?.state?.user||{};
    const raw=snap.person?.id||snap.account?.id||snap.context?.personId||snap.context?.accountId||user.id||user.phone||'client';
    return String(raw).replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,120)||'client';
  }
  const sameSession=(epoch,owner)=>epoch===sessionEpoch&&owner===scopeKey();
  const draftKey=()=>state.editVehicleId?`${EDIT_DRAFT_PREFIX}${scopeKey()}:${state.editVehicleId}`:DRAFT_PREFIX+scopeKey();
  const promptKey=()=>PROMPT_PREFIX+scopeKey();
  function readJson(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch(_e){return null}}
  function readDraft(){return {...defaultDraft(),...(readJson(draftKey())||{})};}
  function defaultDraft(){return {step:2,brandId:'',brandName:'',modelId:'',modelName:'',customModelName:'',year:'',generation:'',bodyType:'',vin:'',plateNumber:'',engineVolume:'',fuelType:'',engine:'',mileage:'',isDefault:false,serverRevision:0};}
  function draftSignature(draft={}){const stable={...draft};delete stable.updatedAt;delete stable.serverRevision;return JSON.stringify(stable);}
  function writeDraft(patch={}){const next={...readDraft(),...patch,serverRevision:state.serverRevision,updatedAt:Date.now()};try{localStorage.setItem(draftKey(),JSON.stringify(next));}catch(_e){}if(!state.editVehicleId)scheduleServerDraft();return next;}
  function clearDraft(){try{localStorage.removeItem(draftKey());}catch(_e){}}
  function markPrompt(value){try{localStorage.setItem(promptKey(),String(value));}catch(_e){}}
  function promptStatus(){try{return localStorage.getItem(promptKey())||'';}catch(_e){return''}}
  function setPendingIntro(){try{sessionStorage.setItem(PENDING_KEY,scopeKey());}catch(_e){}}
  function consumePendingIntro(){try{const value=sessionStorage.getItem(PENDING_KEY);if(!value||value!==scopeKey())return false;sessionStorage.removeItem(PENDING_KEY);return true;}catch(_e){return false}}

  function serverPayload(result){return result?.payload?.data||result?.data||null;}
  function serverTime(value){const t=Date.parse(String(value||''));return Number.isFinite(t)?t:0;}
  function applyServerState(data={},options={}){
    state.serverLoaded=true;state.serverRevision=Math.max(0,Number(data.revision||0)||0);state.serverStatus=String(data.status||'');state.serverUpdatedAt=serverTime(data.updatedAt);state.serverConflict=false;
    if(state.serverStatus==='completed')markPrompt('completed');else if(state.serverStatus==='dismissed')markPrompt('dismissed');
    if(options.restoreDraft!==false&&!state.editVehicleId&&data.draft&&typeof data.draft==='object'&&Object.keys(data.draft).length){
      const local=readJson(draftKey()),localBaseRevision=Math.max(0,Number(local?.serverRevision||0)||0);
      if(!local||state.serverRevision>localBaseRevision){const restored={...defaultDraft(),...data.draft,serverRevision:state.serverRevision,updatedAt:Date.now()};try{localStorage.setItem(draftKey(),JSON.stringify(restored));}catch(_e){}}
    }
    return data;
  }
  async function loadServerFirstEntry(options={}){
    if(typeof api.firstEntryCurrent!=='function')return null;
    const epoch=sessionEpoch,owner=scopeKey();
    try{const result=await api.firstEntryCurrent({force:true,dedupe:false,...options});if(result?.ok&&sameSession(epoch,owner)){return applyServerState(serverPayload(result)||{});}return null;}catch(_e){return null;}
  }
  function scheduleServerDraft(delay=1400){
    if(state.editVehicleId||typeof api.saveFirstEntryDraft!=='function')return;
    state.serverSavePending=true;if(state.serverSaveTimer)clearTimeout(state.serverSaveTimer);
    const backoff=Math.max(0,state.serverBackoffUntil-Date.now());
    state.serverSaveTimer=setTimeout(()=>{state.serverSaveTimer=0;flushServerDraft();},Math.max(delay,backoff));
  }
  async function flushServerDraft(){
    if(state.editVehicleId||typeof api.saveFirstEntryDraft!=='function')return false;
    if(Date.now()<state.serverBackoffUntil){scheduleServerDraft(state.serverBackoffUntil-Date.now());return false;}
    if(state.serverSaving){state.serverSavePending=true;return false;}
    const epoch=sessionEpoch,owner=scopeKey(),draft=readDraft(),signature=draftSignature(draft);
    if(signature===state.serverDraftSignature){state.serverSavePending=false;return true;}
    state.serverSaving=true;state.serverSavePending=false;
    try{
      const result=await api.saveFirstEntryDraft({expectedRevision:state.serverRevision,currentStep:Math.max(1,Math.min(3,Number(draft.step||state.step||2)||2)),draft});
      if(!sameSession(epoch,owner))return false;
      const data=serverPayload(result);
      if(result?.ok&&data){applyServerState(data,{restoreDraft:false});state.serverDraftSignature=signature;state.serverBackoffUntil=0;return true;}
      if(Number(result?.status||result?.payload?.meta?.httpStatus||0)===429){state.serverBackoffUntil=Date.now()+Math.max(5000,Number(result?.retryAfter||0)*1000);state.serverSavePending=true;return false;}
      if(result?.payload?.error==='revision_conflict'&&data){applyServerState(data,{restoreDraft:false});state.serverConflict=true;state.serverSavePending=true;return false;}
      return false;
    }catch(_e){return false;}finally{if(sameSession(epoch,owner)){state.serverSaving=false;if(state.serverSavePending)scheduleServerDraft(Math.max(1800,state.serverBackoffUntil-Date.now()));}}
  }
  async function dismissServerFirstEntry(){
    if(typeof api.dismissFirstEntry!=='function')return false;
    const epoch=sessionEpoch,owner=scopeKey();
    try{
      const result=await api.dismissFirstEntry({});
      const data=serverPayload(result);
      if(result?.ok&&data&&sameSession(epoch,owner)){applyServerState(data,{restoreDraft:false});return true;}
    }catch(_e){}
    return false;
  }

  function currentRole(detail={}){
    const snap=detail.identity||identity();
    const explicit=detail?.result?.selectedRole||detail?.result?.entryRole||detail.user?.entry_role||detail.user?.role||'';
    if(explicit)return String(explicit).toLowerCase();
    if(snap?.authenticated)return String(snap.compatibilityRole||'').toLowerCase();
    return String(window.KaretaNavigationCore?.interfaceRole?.()||window.KaretaRoleAccess?.currentRole?.()||'').toLowerCase();
  }
  function clientContextReady(detail={}){
    const snap=detail.identity||identity();
    if(!snap?.authenticated)return currentRole(detail)==='client';
    return currentRole(detail)==='client'&&String(snap.context?.type||'').toLowerCase()==='personal';
  }
  async function maybeScheduleFirstEntry(detail={}){
    if(state.autoScheduled||!clientContextReady(detail))return false;
    const epoch=sessionEpoch,owner=scopeKey(detail);
    state.autoScheduled=true;
    const server=await loadServerFirstEntry();
    if(!sameSession(epoch,owner))return false;
    if(server){
      if(server.hasVehicles||server.status==='completed'){markPrompt('completed');state.autoScheduled=false;return false;}
      if(server.status==='dismissed'){markPrompt('dismissed');state.autoScheduled=false;return false;}
    }else if(promptStatus()){state.autoScheduled=false;return false;}
    let result;
    try{result=await api.get({cacheTtlMs:0,force:true,dedupe:false});}catch(_e){if(sameSession(epoch,owner))state.autoScheduled=false;return false;}
    if(!sameSession(epoch,owner))return false;
    if(!result?.ok){state.autoScheduled=false;return false;}
    const payload=result.payload?.data||result.payload||{},vehicles=payload.vehicles||[],archived=payload.archivedVehicles||[];
    if(payload.firstEntry&&typeof payload.firstEntry==='object')applyServerState(payload.firstEntry);
    if(vehicles.length||archived.length){markPrompt('completed');state.autoScheduled=false;return false;}
    if(state.serverStatus==='dismissed'){markPrompt('dismissed');state.autoScheduled=false;return false;}
    setPendingIntro();
    window.setTimeout(()=>{
      if(!sameSession(epoch,owner))return;
      if(!clientContextReady()){state.autoScheduled=false;return;}
      if(window.KaretaRouteRuntime?.navigate)window.KaretaRouteRuntime.navigate('cabinetGarage',{source:'first-vehicle-entry',force:true});
      else location.hash='#/cabinet/garage';
    },260);
    return true;
  }

  function brandByName(name){const needle=normalizeText(name).toLocaleLowerCase('ru-RU');return CATALOG.find(x=>x.name.toLocaleLowerCase('ru-RU')===needle)||null;}
  function vehicleToDraft(vehicle={}){
    const brand=brandByName(vehicle.brand||''),model=brand?modelByName(brand,vehicle.model||''):null;
    const legacyBrand=Boolean(!brand&&normalizeText(vehicle.brand)),custom=Boolean(brand&&vehicle.model&&!model);
    const fuel=normalizeText(vehicle.fuel_type??vehicle.fuelType??'');
    const volume=normalizeText(vehicle.engine_volume??vehicle.engineVolume??'');
    return {...defaultDraft(),step:2,brandId:legacyBrand?'legacy-edit':(brand?.id||''),brandName:brand?.name||normalizeText(vehicle.brand),modelId:legacyBrand?'legacy-edit':(custom?'custom':(model?.id||'')),modelName:legacyBrand?normalizeText(vehicle.model):(model?.name||''),customModelName:custom?normalizeText(vehicle.model):'',year:String(vehicle.year_label??vehicle.year??''),generation:normalizeText(vehicle.generation),bodyType:normalizeText(vehicle.body_type??vehicle.bodyType??''),vin:normalizeVin(vehicle.vin),plateNumber:normalizePlate(vehicle.plate),engineVolume:volume,fuelType:fuel,engine:[volume,fuel].filter(Boolean).join(' '),mileage:String(Math.max(0,Number(vehicle.mileage_km??vehicle.mileageKm??0)||0)),isDefault:Boolean(Number(vehicle.is_default??vehicle.isDefault??0))};
  }
  function brandById(id){return CATALOG.find(x=>x.id===id)||null;}
  function isLegacyEditBrand(draft){return Boolean(state.editVehicleId&&state.editLegacyBrandName&&draft.brandId==='legacy-edit'&&normalizeText(draft.brandName).toLocaleLowerCase('ru-RU')===state.editLegacyBrandName.toLocaleLowerCase('ru-RU'));}
  function modelByName(brand,name){const needle=normalizeText(name).toLocaleLowerCase('ru-RU');return brand?.models?.find(x=>x.name.toLocaleLowerCase('ru-RU')===needle)||null;}
  function generationOptions(draft){
    const brand=brandById(draft.brandId),model=brand?.models?.find(x=>x.id===draft.modelId);
    const year=Number(draft.year||0);
    const rows=(model?.generations||[]).filter(item=>!year||(year>=item[1]&&year<=item[2])).map(item=>item[0]);
    return [...new Set(rows)];
  }
  function finalModel(draft){return draft.modelId==='custom'?normalizeText(draft.customModelName):normalizeText(draft.modelName);}
  function vehicleTitle(draft){return [normalizeText(draft.brandName),finalModel(draft)].filter(Boolean).join(' ')||'Автомобиль';}

  function carIcon(){return '<svg viewBox="0 0 96 64" aria-hidden="true"><path d="M18 39 24 23c2-5 6-8 12-8h24c6 0 10 3 12 8l6 16"/><path d="M12 39h72v12a5 5 0 0 1-5 5h-5v-7H22v7h-5a5 5 0 0 1-5-5V39Z"/><path d="M26 39h44M25 46h8M63 46h8"/><circle cx="29" cy="46" r="2"/><circle cx="67" cy="46" r="2"/></svg>';}
  function successIcon(){return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12 2.7 2.7L16.5 9"/></svg>';}
  function steps(active){const rows=[1,2,3];return `<div class="kmo-stepper k-first-vehicle-steps" aria-label="Прогресс добавления автомобиля">${rows.map((n,index)=>`${index?'<i aria-hidden="true"></i>':''}<span class="${n===active?'is-active':''}${n<active?' is-done':''}" aria-current="${n===active?'step':'false'}">${n}</span>`).join('')}</div>`;}
  function flowHeader(step){return `<header class="k-first-vehicle-header"><div class="k-first-vehicle-brand-row"><span aria-hidden="true"></span><img class="k-first-vehicle-logo" src="/assets/onboarding/kareta_logo_full.png" alt="KARETA.KZ Автосервис"><span aria-hidden="true"></span></div>${steps(step)}</header>`;}
  function errorLine(name){return `<small class="k-first-vehicle-error" data-fv-error="${name}" aria-live="polite"></small>`;}
  function intro(){return `${flowHeader(1)}<div class="k-first-vehicle-copy"><h1>Ваш первый автомобиль</h1><p>Сейчас нужна только минимальная карточка. Подробные данные автомобиля можно заполнить позже в гараже.</p></div><section class="k-first-vehicle-card k-first-vehicle-intro-card"><div class="k-first-vehicle-illustration">${carIcon()}</div><ul><li>Марка, модель и год выбираются карточками</li><li>Тип кузова — одним нажатием</li><li>VIN, госномер и пробег можно указать сразу или позже</li><li>Автомобиль сразу появится в гараже и заявках</li></ul></section><div class="k-first-vehicle-actions"><button class="k-first-vehicle-primary" type="button" data-first-vehicle-next>Заполнить автомобиль</button><button class="k-first-vehicle-secondary" type="button" data-first-vehicle-later>Сделать позже</button></div>`;}
  function bodyIcon(type){
    const paths={
      sedan:'M5 15h14l-2-5-3-2H9l-2 2-2 5Zm2 0v2m10-2v2M8 10h8',
      suv:'M4 15h16l-1-6-3-2H8L5 9l-1 6Zm3 0v2m10-2v2M7 9h10',
      hatch:'M5 15h14l-1-6-4-2H9L6 9l-1 6Zm2 0v2m10-2v2',
      wagon:'M4 15h16l-1-6-2-2H7L5 9l-1 6Zm3 0v2m10-2v2M7 9h10',
      coupe:'M5 15h14l-2-5-4-2h-3l-3 2-2 5Zm2 0v2m10-2v2',
      van:'M4 15h16V8l-3-2H7L4 9v6Zm3 0v2m10-2v2M8 8h7',
      pickup:'M4 15h16v-5h-6l-2-3H7L4 10v5Zm3 0v2m10-2v2',
      car:'M5 15h14l-2-5-3-2H9l-2 2-2 5Zm2 0v2m10-2v2'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[type]||paths.car}"/></svg>`;
  }
  function yearOptions(selected){
    const out=[];for(let y=currentYear()+1;y>=1950;y--)out.push(y);
    return [...new Set(out)];
  }
  function primaryChoice(draft){const vehicles=state.data?.vehicles||[],isEditingPrimary=state.editVehicleId&&Boolean(draft.isDefault);if(!vehicles.length||isEditingPrimary)return'';return `<label class="k-first-vehicle-primary-choice"><input type="checkbox" data-first-vehicle-default ${draft.isDefault?'checked':''}><span><b>Сделать основным автомобилем</b><small>Он будет автоматически выбран при создании новой заявки.</small></span></label>`;}
  function basic(draft){
    const brand=brandById(draft.brandId)||brandByName(draft.brandName),legacyBrand=isLegacyEditBrand(draft),models=brand?.models||[];
    const gens=generationOptions(draft),canSave=Boolean((brand||legacyBrand)&&finalModel(draft)&&draft.year);
    const brands=CATALOG.slice().sort((a,b)=>Number(b.popular)-Number(a.popular)||a.name.localeCompare(b.name,'ru'));
    const brandTiles=brands.map(x=>{const logo=window.KaretaVisualAssets?.brandLogo?.(x.name)||'';return `<button type="button" class="k-fv-picker-tile k-fv-brand-tile${draft.brandId===x.id?' is-selected':''}" data-fv-brand="${esc(x.id)}" aria-pressed="${draft.brandId===x.id?'true':'false'}">${logo?`<img src="${esc(logo)}" alt="">`:`<span class="k-fv-brand-fallback">${esc(x.name.slice(0,2).toUpperCase())}</span>`}<b>${esc(x.name)}</b></button>`;}).join('');
    const modelTiles=brand?models.map(x=>`<button type="button" class="k-fv-picker-tile k-fv-model-tile${draft.modelId===x.id?' is-selected':''}" data-fv-model="${esc(x.id)}"><span>${carIcon()}</span><b>${esc(x.name)}</b></button>`).join(''):'';
    const yearTiles=yearOptions(draft.year).map(y=>`<button type="button" class="k-fv-year-chip${String(draft.year)===String(y)?' is-selected':''}" data-fv-year="${y}">${y}</button>`).join('');
    const bodyTiles=BODY_TYPES.map(x=>`<button type="button" class="k-fv-body-tile${draft.bodyType===x.id?' is-selected':''}" data-fv-body="${esc(x.id)}"><span>${bodyIcon(x.icon)}</span><b>${esc(x.label)}</b></button>`).join('');
    return `${flowHeader(2)}<div class="k-first-vehicle-copy"><h1>${state.editVehicleId?'Автомобиль':'Добавьте автомобиль'}</h1><p>Выберите основные данные. Остальное можно добавить сейчас или позже в гараже.</p></div>
      <form class="k-first-vehicle-card k-first-vehicle-form k-first-vehicle-picker-form" data-first-vehicle-form="basic" novalidate>
        <input type="hidden" name="brandName" value="${esc(draft.brandName)}"><input type="hidden" name="modelName" value="${esc(draft.modelName)}"><input type="hidden" name="year" value="${esc(draft.year)}"><input type="hidden" name="generation" value="${esc(draft.generation)}"><input type="hidden" name="bodyType" value="${esc(draft.bodyType)}">
        <section class="k-fv-picker-block"><header><span>1</span><div><h2>Марка</h2><p>${draft.brandName?esc(draft.brandName):'Выберите логотип'}</p></div></header><div class="k-fv-picker-rail k-fv-brand-rail">${brandTiles}</div>${errorLine('brandName')}</section>
        <section class="k-fv-picker-block${brand||legacyBrand?'':' is-disabled'}"><header><span>2</span><div><h2>Модель</h2><p>${finalModel(draft)?esc(finalModel(draft)):(brand?'Выберите модель':'Сначала выберите марку')}</p></div></header>
          ${brand?`<div class="k-fv-picker-rail k-fv-model-rail">${modelTiles}<button type="button" class="k-fv-picker-tile k-fv-model-tile is-custom${draft.modelId==='custom'?' is-selected':''}" data-fv-model="custom"><span>+</span><b>Другая</b></button></div>`:legacyBrand?`<div class="k-fv-custom-row"><input name="legacyModelName" value="${esc(draft.modelName)}" placeholder="Модель автомобиля"></div>`:''}
          ${draft.modelId==='custom'?`<div class="k-fv-custom-row"><input name="customModelName" value="${esc(draft.customModelName)}" maxlength="80" placeholder="Название модели"></div>`:''}${errorLine('modelName')}${errorLine('customModelName')}
        </section>
        <section class="k-fv-picker-block"><header><span>3</span><div><h2>Год выпуска</h2><p>${draft.year?esc(draft.year):'Прокрутите и выберите'}</p></div></header><div class="k-fv-year-rail">${yearTiles}</div>${errorLine('year')}</section>
        <section class="k-fv-picker-block"><header><span>4</span><div><h2>Тип кузова</h2><p>${BODY_TYPES.find(x=>x.id===draft.bodyType)?.label||'Необязательно'}</p></div></header><div class="k-fv-body-grid">${bodyTiles}</div></section>
        ${gens.length?`<section class="k-fv-picker-block k-fv-generation-block"><header><span>+</span><div><h2>Поколение</h2><p>Определили по модели и году</p></div></header><div class="k-fv-generation-row">${gens.map(x=>`<button type="button" class="${draft.generation===x?'is-selected':''}" data-fv-generation="${esc(x)}">${esc(x)}</button>`).join('')}<button type="button" class="${!draft.generation?'is-selected':''}" data-fv-generation="">Не знаю</button></div></section>`:''}
        <details class="k-fv-extra" ${draft.vin||draft.plateNumber||draft.mileage?'open':''}><summary><span>Дополнительно</span><small>VIN, госномер, пробег</small></summary><div class="k-fv-extra-grid"><label><span>VIN</span><input name="vin" value="${esc(draft.vin)}" maxlength="17" placeholder="17 символов"></label><label><span>Госномер</span><input name="plateNumber" value="${esc(draft.plateNumber)}" maxlength="24" placeholder="123 ABC 16"></label><label><span>Пробег, км</span><input name="mileage" type="number" min="0" inputmode="numeric" value="${esc(draft.mileage)}" placeholder="0"></label></div></details>
      </form>
      ${primaryChoice(draft)}<div class="k-first-vehicle-actions"><button class="k-first-vehicle-primary" type="button" data-first-vehicle-confirm ${canSave?'':'disabled'}>Продолжить</button><small class="k-first-vehicle-submit-error" data-fv-submit-error aria-live="polite"></small></div>`;
  }
  function isPrimaryDraft(draft){return (state.data?.vehicles||[]).length===0||Boolean(draft.isDefault);}
  function reviewCard(draft,{success=false}={}){
    const primary=isPrimaryDraft(draft);
    return `<article class="k-first-vehicle-review-card${success?' is-success':''}"><div class="k-first-vehicle-car-visual">${carIcon()}</div><div class="k-first-vehicle-review-head"><div><h2>${esc(vehicleTitle(draft))}</h2><p>${esc([draft.year,draft.generation,BODY_TYPES.find(x=>x.id===draft.bodyType)?.label].filter(Boolean).join(' · '))}</p></div>${primary?'<b>Основной автомобиль</b>':''}</div><p class="k-first-vehicle-review-meta">${esc([draft.plateNumber?('Госномер: '+draft.plateNumber):'',draft.vin?('VIN: '+draft.vin):'',Number(draft.mileage)>0?(Number(draft.mileage).toLocaleString('ru-RU')+' км'):''].filter(Boolean).join(' · ')||'Карточка готова. Дополнительные характеристики можно заполнить позже в гараже.')}</p></article>`;
  }
  function confirm(draft){const editing=Boolean(state.editVehicleId);return `${flowHeader(3)}<div class="k-first-vehicle-copy"><h1>Подтвердите автомобиль</h1><p>Проверьте минимальную карточку перед сохранением в гараж.</p></div><section class="k-first-vehicle-card k-first-vehicle-review">${reviewCard(draft)}</section><div class="k-first-vehicle-actions"><button class="k-first-vehicle-primary" type="button" data-first-vehicle-save ${state.saving?'disabled aria-busy="true"':''}>${state.saving?'Сохраняем…':(editing?'Подтвердить изменения':'Подтвердить и добавить')}</button><button class="k-first-vehicle-secondary is-bordered" type="button" data-first-vehicle-edit-basic>Изменить данные</button><small class="k-first-vehicle-submit-error" data-fv-submit-error aria-live="polite"></small></div>`;}
  function success(draft){const editing=Boolean(state.editVehicleId);return `${flowHeader(3)}<section class="k-first-vehicle-success"><div class="k-first-vehicle-success-icon">${successIcon()}</div><h1>${editing?'Автомобиль обновлён':'Автомобиль добавлен'}</h1><p>${editing?`Данные ${esc(vehicleTitle(draft))} сохранены`:`${esc(vehicleTitle(draft))} теперь находится в вашем гараже`}</p>${reviewCard(draft,{success:true})}</section><div class="k-first-vehicle-actions k-first-vehicle-success-actions">${editing?'':`<button class="k-first-vehicle-primary" type="button" data-first-vehicle-create-request>Создать заявку</button>`}<button class="k-first-vehicle-secondary is-bordered" type="button" data-first-vehicle-to-garage>Перейти в гараж</button>${editing?'':`<button class="k-first-vehicle-secondary" type="button" data-first-vehicle-home>На главную</button>`}</div>`;}

  function emptyGarage(){const draft=readDraft(),hasDraft=Boolean(draft.brandName||draft.modelName||draft.year||draft.vin||draft.plateNumber);return `<section class="k-first-vehicle-empty" data-first-vehicle-empty><div class="k-first-vehicle-empty-visual">${carIcon()}</div><span>МОЙ ГАРАЖ</span><h2>В гараже пока нет автомобилей</h2><p>Добавьте автомобиль, чтобы быстрее оформлять заявки и хранить историю обслуживания.</p><button class="k-btn k-btn-primary" type="button" data-garage-add-vehicle>${hasDraft?'Продолжить добавление':'Добавить автомобиль'}</button></section>`;}

  function ensureSurfaceRoot(){
    let root=document.getElementById('k-first-vehicle-layer');
    if(!root){
      root=document.createElement('section');
      root.id='k-first-vehicle-layer';
      root.className='k-page k-client-cabinet-page k-first-vehicle-page';
      root.dataset.firstVehicleSurface='';
      root.hidden=true;
      root.setAttribute('aria-hidden','true');
      const fab=document.getElementById('k-mobile-fab-stack');
      const host=fab?.parentNode||document.getElementById('k-app')||document.body;
      if(fab&&fab.parentNode===host)host.insertBefore(root,fab);else host.appendChild(root);
    }
    root.classList.add('k-page','k-client-cabinet-page','k-first-vehicle-page');
    return root;
  }
  function activateSurface(){
    const root=state.root||ensureSurfaceRoot();
    state.root=root;
    root.hidden=false;root.setAttribute('aria-hidden','false');
    document.documentElement.classList.add('k-first-vehicle-active');document.body?.classList.add('k-first-vehicle-active');
  }
  function deactivateSurface(){
    document.documentElement.classList.remove('k-first-vehicle-active');document.body?.classList.remove('k-first-vehicle-active');
    const root=state.root||document.getElementById('k-first-vehicle-layer');
    if(root){root.hidden=true;root.setAttribute('aria-hidden','true');root.replaceChildren();}
    state.root=null;state.sourceRoot=null;
  }
  function render(){if(!state.root)return;activateSurface();const draft=readDraft();state.root.innerHTML=`<div class="k-first-vehicle-shell" data-first-vehicle-shell>${state.success?success(state.success):state.step===1?intro():state.step===2?basic(draft):confirm(draft)}</div>`;bind();}
  function setError(name,message=''){state.root?.querySelector(`[data-fv-error="${name}"]`)?.replaceChildren(document.createTextNode(message));const input=state.root?.querySelector(`[name="${name}"]`);if(input)input.classList.toggle('is-invalid',Boolean(message));}
  function syncBasic(form){
    const brandInput=form.elements.brandName,brandValue=normalizeText(brandInput?.value),brand=brandByName(brandValue);const previous=readDraft();
    const legacyBrand=Boolean(state.editVehicleId&&state.editLegacyBrandName&&brandValue.toLocaleLowerCase('ru-RU')===state.editLegacyBrandName.toLocaleLowerCase('ru-RU'));
    const patch={brandName:brand?.name||brandValue,brandId:brand?.id||(legacyBrand?'legacy-edit':''),year:String(form.elements.year?.value||''),generation:String(form.elements.generation?.value||''),bodyType:String(form.elements.bodyType?.value||previous.bodyType||''),vin:normalizeVin(form.elements.vin?.value??previous.vin),plateNumber:normalizePlate(form.elements.plateNumber?.value??previous.plateNumber),mileage:String(Math.max(0,Number(form.elements.mileage?.value??previous.mileage??0)||0))};
    if((brand&&brand.id!==previous.brandId)||(!legacyBrand&&!brand&&previous.brandId)){patch.modelId='';patch.modelName='';patch.customModelName='';patch.generation='';}
    const modelValue=normalizeText(form.elements.modelName?.value);
    if(previous.modelId==='custom'||form.elements.customModelName){patch.modelId='custom';patch.modelName='';patch.customModelName=normalizeText(form.elements.customModelName?.value||previous.customModelName);}else if(brand){const model=modelByName(brand,modelValue);patch.modelId=model?.id||'';patch.modelName=model?.name||modelValue;patch.customModelName='';}else if(legacyBrand){patch.modelId='legacy-edit';patch.modelName=normalizeText(form.elements.legacyModelName?.value||modelValue||previous.modelName);patch.customModelName='';}
    return writeDraft(patch);
  }
  function validateBasic(){const form=state.root?.querySelector('[data-first-vehicle-form="basic"]');if(!form)return false;const draft=syncBasic(form);['brandName','modelName','customModelName','year'].forEach(x=>setError(x,''));const brand=brandById(draft.brandId),legacyBrand=isLegacyEditBrand(draft);let ok=true;if(!brand&&!legacyBrand){setError('brandName','Выберите марку автомобиля');ok=false;}const model=finalModel(draft);if(!model){setError(draft.modelId==='custom'?'customModelName':'modelName','Выберите модель автомобиля');ok=false;}else if(!legacyBrand&&draft.modelId!=='custom'&&!modelByName(brand,draft.modelName)){setError('modelName','Выберите модель автомобиля');ok=false;}const year=Number(draft.year);if(!/^\d{4}$/.test(String(draft.year))||year<1950||year>currentYear()+1){setError('year','Укажите корректный год выпуска');ok=false;}return ok;}
  function go(step){state.step=Math.max(1,Math.min(3,Number(step)||1));writeDraft({step:state.step});render();state.root?.scrollTo?.({top:0,behavior:'smooth'});}
  function leaveToGarage(){deactivateSurface();state.onReturn?.();}
  function navigate(hash){deactivateSurface();if(String(location.hash)!==hash)location.hash=hash;else window.KaretaRouteRuntime?.transition?.(window.KaretaRouteRegistry?.keyFromHash?.(hash)||'home',{source:'first-vehicle',force:true});}
  async function save(){if(state.saving)return;const epoch=sessionEpoch,owner=scopeKey(),draft=readDraft();if(!validateBasicFallback(draft)){go(2);return;}state.saving=true;render();const editing=Boolean(state.editVehicleId),vehicle={flowVersion:RELEASE,id:state.editVehicleId||undefined,brandId:draft.brandId,modelId:draft.modelId,brand:draft.brandName,model:finalModel(draft),title:vehicleTitle(draft),year:Number(draft.year),generation:draft.generation,bodyType:draft.bodyType,vin:draft.vin,plate:draft.plateNumber,mileageKm:Number(draft.mileage||0),engineType:draft.fuelType,engineVolume:draft.engineVolume,fuelType:draft.fuelType,isDefault:(state.data?.vehicles||[]).length===0||Boolean(draft.isDefault)};let result;try{result=await api.saveVehicle(vehicle);}catch(error){result={ok:false,payload:{message:error?.message||`Не удалось ${editing?'сохранить':'добавить'} автомобиль`}};}if(!sameSession(epoch,owner))return;state.saving=false;if(!result?.ok){render();const error=result?.payload?.error||'';const message=result?.payload?.message||({vehicle_duplicate_vin:'Этот автомобиль уже добавлен в ваш гараж',vehicle_duplicate_plate:'Автомобиль с таким госномером уже есть в гараже',invalid_vehicle_vin:'VIN должен содержать 17 символов'}[error]||`Не удалось ${editing?'сохранить':'добавить'} автомобиль`);const out=state.root?.querySelector('[data-fv-submit-error]');if(out)out.textContent=message;return;}const created=result.payload?.vehicle||vehicle;state.success={...draft,id:created.id||state.editVehicleId||'',brandName:created.brand||draft.brandName,modelName:created.model||draft.modelName,year:created.year||created.year_label||draft.year,generation:created.generation||draft.generation,bodyType:created.bodyType??created.body_type??draft.bodyType,plateNumber:created.plate||draft.plateNumber,vin:created.vin||draft.vin,mileage:created.mileageKm??created.mileage_km??draft.mileage,engineVolume:created.engineVolume??created.engine_volume??draft.engineVolume,fuelType:created.fuelType??created.fuel_type??draft.fuelType,isDefault:Boolean(Number(created.isDefault??created.is_default??vehicle.isDefault))};clearDraft();if(!editing){markPrompt('completed');state.serverStatus='completed';state.serverConflict=false;}window.KaretaApiClient?.invalidate?.('client.cabinet');window.KaretaApiClient?.invalidate?.('client.first-entry');render();window.KaretaToast?.success?.(editing?'Автомобиль обновлён':'Автомобиль добавлен');}
  function validateBasicFallback(d){const brand=brandById(d.brandId),legacyBrand=isLegacyEditBrand(d),model=finalModel(d),year=Number(d.year);return Boolean((brand||legacyBrand)&&model&&/^\d{4}$/.test(String(d.year))&&year>=1950&&year<=currentYear()+1);}

  function bind(){const root=state.root;if(!root||root.dataset.firstVehicleBound==='1')return;root.dataset.firstVehicleBound='1';const click=async event=>{
    const brandButton=event.target.closest('[data-fv-brand]');if(brandButton){const brand=brandById(brandButton.dataset.fvBrand);if(brand){writeDraft({brandId:brand.id,brandName:brand.name,modelId:'',modelName:'',customModelName:'',generation:''});render();}return;}
    const modelButton=event.target.closest('[data-fv-model]');if(modelButton){const draft=readDraft(),brand=brandById(draft.brandId),id=String(modelButton.dataset.fvModel||'');if(id==='custom'){writeDraft({modelId:'custom',modelName:'',customModelName:'',generation:''});render();return;}const model=brand?.models?.find(x=>x.id===id);if(model){writeDraft({modelId:model.id,modelName:model.name,customModelName:'',generation:''});render();}return;}
    const yearButton=event.target.closest('[data-fv-year]');if(yearButton){writeDraft({year:String(yearButton.dataset.fvYear||''),generation:''});render();return;}
    const bodyButton=event.target.closest('[data-fv-body]');if(bodyButton){writeDraft({bodyType:String(bodyButton.dataset.fvBody||'')});render();return;}
    const generationButton=event.target.closest('[data-fv-generation]');if(generationButton){writeDraft({generation:String(generationButton.dataset.fvGeneration||'')});render();return;}
    if(event.target.closest('[data-first-vehicle-later]')){const epoch=sessionEpoch,owner=scopeKey();markPrompt('dismissed');clearDraft();await dismissServerFirstEntry();if(sameSession(epoch,owner))navigate('#/home');return;}
    if(event.target.closest('[data-first-vehicle-next]')){if(state.step===1){go(2);return;}return;}
    if(event.target.closest('[data-first-vehicle-confirm]')){if(state.step===2&&validateBasic()){go(3);return;}return;}
    if(event.target.closest('[data-first-vehicle-edit-basic]')){go(2);return;}
    if(event.target.closest('[data-first-vehicle-save]')){await save();return;}
    if(event.target.closest('[data-first-vehicle-create-request]')){const v=state.success||{};try{sessionStorage.setItem('kareta.request.prefill',JSON.stringify({vehicleId:v.id||'',clientVehicleId:v.id||'',clientCar:vehicleTitle(v),source:'first_vehicle_success'}));}catch(_e){}navigate('#/orders/new');return;}
    if(event.target.closest('[data-first-vehicle-to-garage]')){state.success=null;leaveToGarage();return;}
    if(event.target.closest('[data-first-vehicle-home]')){navigate('#/home');return;}
  };
    const input=event=>{if(event.target.matches('[data-first-vehicle-default]')){writeDraft({isDefault:Boolean(event.target.checked)});render();return;}const form=event.target.closest('form');if(!form)return;if(form.dataset.firstVehicleForm==='basic'){
      const before=readDraft();const next=syncBasic(form);if(event.target.name==='brandName'&&brandByName(event.target.value)&&next.brandId!==before.brandId){render();return;}if(event.target.name==='modelName'){const value=normalizeText(event.target.value);if(value==='Моей модели нет'){writeDraft({modelId:'custom',modelName:''});render();return;}const brand=brandById(next.brandId);if(brand&&modelByName(brand,value)&&next.modelId!==before.modelId){render();return;}}if(event.target.name==='year'&&event.type==='change'){render();return;}const button=root.querySelector('[data-first-vehicle-confirm]');if(button&&state.step===2)button.disabled=!((brandById(next.brandId)||isLegacyEditBrand(next))&&finalModel(next)&&next.year);
    }};
    root.addEventListener('click',click);root.addEventListener('input',input);root.addEventListener('change',input);
  }

  function start({root,startStep=2,data={},onReturn=null,mode='manual',vehicle=null}={}){state.sourceRoot=root||null;state.root=ensureSurfaceRoot();if(!state.root)return false;state.data=data||{};state.onReturn=typeof onReturn==='function'?onReturn:null;state.mode=mode;state.success=null;state.saving=false;state.editVehicleId=mode==='edit'?String(vehicle?.id||''):'';const flowRoot=state.root,epoch=sessionEpoch,owner=scopeKey();if(!state.editVehicleId&&!state.serverLoaded)loadServerFirstEntry().then(()=>{if(sameSession(epoch,owner)&&state.root===flowRoot&&state.step>=2)render();});state.editLegacyBrandName=state.editVehicleId&&!brandByName(vehicle?.brand||'')?normalizeText(vehicle?.brand):'';state.step=startStep===1&&!state.editVehicleId?1:2;if(state.editVehicleId){const stored=readJson(draftKey());if(!stored)writeDraft({...vehicleToDraft(vehicle),step:state.step});else writeDraft({step:state.step});}else writeDraft({step:state.step});render();return true;}

  window.addEventListener('kareta:session-confirmed',event=>{window.setTimeout(()=>maybeScheduleFirstEntry(event.detail||{}),0);});

  window.addEventListener('kareta:session-anonymous',()=>{
    sessionEpoch+=1;
    deactivateSurface();
    try{sessionStorage.removeItem(PENDING_KEY);}catch(_error){}
    if(state.serverSaveTimer)clearTimeout(state.serverSaveTimer);
    Object.assign(state,{data:null,success:null,onReturn:null,saving:false,autoScheduled:false,editVehicleId:'',editLegacyBrandName:'',serverLoaded:false,serverRevision:0,serverStatus:'',serverUpdatedAt:0,serverSaving:false,serverSavePending:false,serverSaveTimer:0,serverConflict:false,serverDraftSignature:'',serverBackoffUntil:0});
  });

  window.addEventListener('hashchange',()=>{if(!String(location.hash||'').startsWith('#/cabinet/garage'))deactivateSurface();});
  window.addEventListener('kareta:context-changed',event=>{if(currentRole(event.detail||{})!=='client')deactivateSurface();window.setTimeout(()=>maybeScheduleFirstEntry(event.detail||{}),80);});

  window.KaretaFirstVehicleFlow=Object.freeze({CATALOG,emptyGarage,start,consumePendingIntro,maybeScheduleFirstEntry,readDraft,clearDraft,scopeKey,loadServerFirstEntry,flushServerDraft,deactivateSurface});
})();
