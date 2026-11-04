(() => {
  'use strict';

  const ui = window.KaretaPageUI;
  if (!ui) throw new Error('KaretaPageUI is required before pages/diagnostics.js');
  const esc = ui.escHtml;

  function renderDiagnostics(){
    return `<section class="k-page k-diagnostics-page" data-page="diagnostics">
      <header class="k-r84-workspace-head k-diagnostics-head">
        <span>ДИАГНОСТИКА АВТОМОБИЛЯ</span>
        <h1>ELM327 · Bluetooth OBD-II</h1>
        <p>Подключение адаптера, чтение основных параметров и кодов неисправностей. Сессии сохраняются офлайн и синхронизируются с KARETA.KZ после появления сети.</p>
      </header>

      <div class="k-obd-status-grid">
        <article class="k-obd-card">
          <div class="k-obd-card-head"><strong>Приложение</strong><span data-obd-native class="k-obd-chip">Проверка…</span></div>
          <p data-obd-native-text>Проверяем Native API.</p>
        </article>
        <article class="k-obd-card">
          <div class="k-obd-card-head"><strong>Bluetooth</strong><span data-obd-bt class="k-obd-chip">—</span></div>
          <p data-obd-device>Адаптер не выбран.</p>
        </article>
        <article class="k-obd-card">
          <div class="k-obd-card-head"><strong>Офлайн</strong><span data-obd-offline class="k-obd-chip">0</span></div>
          <p>Несинхронизированные диагностические сессии.</p>
        </article>
      </div>

      <article class="k-obd-panel k-obd-vehicle-panel">
        <div class="k-obd-panel-head">
          <div><span>0</span><h2>Автомобиль</h2></div>
          <a class="k-btn" href="#/cabinet/garage">Мой гараж</a>
        </div>
        <div class="k-obd-vehicle-current" data-obd-vehicle-current>
          <p class="k-obd-muted">Загружаем автомобили…</p>
        </div>
        <div class="k-obd-vehicle-list" data-obd-vehicle-list hidden></div>
      </article>

      <article class="k-obd-panel k-obd-live-panel">
        <div class="k-obd-panel-head">
          <div><span>LIVE</span><h2>Параметры двигателя</h2></div>
          <div class="k-obd-actions">
            <button type="button" class="k-btn" data-obd-reconnect>Переподключить</button>
            <button type="button" class="k-btn k-btn-primary" data-obd-live-start disabled>Старт</button>
            <button type="button" class="k-btn" data-obd-live-stop disabled>Стоп</button>
          </div>
        </div>
        <div class="k-obd-live-grid">
          <article><small>ОБОРОТЫ</small><strong data-obd-live-rpm>—</strong><span>об/мин</span></article>
          <article><small>СКОРОСТЬ</small><strong data-obd-live-speed>—</strong><span>км/ч</span></article>
          <article><small>ОЖ</small><strong data-obd-live-coolant>—</strong><span>°C</span></article>
          <article><small>НАПРЯЖЕНИЕ</small><strong data-obd-live-voltage>—</strong><span>V</span></article>
        </div>
        <p class="k-obd-live-state" data-obd-live-state>Live-режим остановлен.</p>
      </article>

      <div class="k-obd-layout">
        <article class="k-obd-panel">
          <div class="k-obd-panel-head">
            <div><span>1</span><h2>ELM327</h2></div>
            <button type="button" class="k-btn" data-obd-settings>Bluetooth</button>
          </div>
          <p class="k-obd-muted">Сначала выполните сопряжение ELM327 в настройках Android. KARETA показывает уже сопряжённые Bluetooth-устройства.</p>
          <div class="k-obd-actions">
            <button type="button" class="k-btn k-btn-primary" data-obd-devices>Выбрать ELM327</button>
            <button type="button" class="k-btn" data-obd-init disabled>Инициализировать</button>
            <button type="button" class="k-btn" data-obd-disconnect disabled>Отключить</button>
          </div>
          <div class="k-obd-devices" data-obd-device-list hidden></div>
        </article>

        <article class="k-obd-panel">
          <div class="k-obd-panel-head"><div><span>2</span><h2>Диагностика</h2></div><span data-obd-online class="k-obd-chip">Сеть</span></div>
          <div class="k-obd-diagnostic-grid">
            <button type="button" class="k-obd-action" data-obd-snapshot disabled><b>Быстрая диагностика</b><small>RPM · скорость · температура · напряжение · DTC · VIN</small></button>
            <button type="button" class="k-obd-action" data-obd-command="03" disabled><b>Ошибки DTC</b><small>Mode 03 · сохранённые коды</small></button>
            <button type="button" class="k-obd-action" data-obd-command="0902" disabled><b>VIN</b><small>Mode 09 PID 02</small></button>
            <button type="button" class="k-obd-action" data-obd-command="ATRV" disabled><b>Напряжение</b><small>Напряжение питания адаптера</small></button>
          </div>

          <div class="k-obd-command">
            <input type="text" maxlength="32" placeholder="OBD / AT команда, например 010C" data-obd-custom>
            <button type="button" class="k-btn" data-obd-send disabled>Отправить</button>
          </div>
        </article>
      </div>

      <article class="k-obd-panel k-obd-result-panel">
        <div class="k-obd-panel-head">
          <div><span>3</span><h2>Результат</h2></div>
          <button type="button" class="k-btn" data-obd-sync>Синхронизировать</button>
        </div>
        <div class="k-obd-dtc-list" data-obd-dtc-list hidden></div>
        <pre class="k-obd-result" data-obd-result>Подключите ELM327 и запустите диагностику.</pre>
      </article>

      <article class="k-obd-panel">
        <div class="k-obd-panel-head"><div><span>4</span><h2>История</h2></div><button type="button" class="k-btn" data-obd-history-refresh>Обновить</button></div>
        <div class="k-obd-history" data-obd-history><p class="k-obd-muted">История загружается…</p></div>
      </article>
    </section>`;
  }

  function mountDiagnostics(context={}){
    const root=document.querySelector('[data-page="diagnostics"]');
    if(!root)return;

    const mobile=window.KaretaMobile;
    const q=s=>root.querySelector(s);
    const qa=s=>Array.from(root.querySelectorAll(s));
    const nativeChip=q('[data-obd-native]');
    const nativeText=q('[data-obd-native-text]');
    const btChip=q('[data-obd-bt]');
    const deviceText=q('[data-obd-device]');
    const offlineChip=q('[data-obd-offline]');
    const onlineChip=q('[data-obd-online]');
    const result=q('[data-obd-result]');
    const deviceList=q('[data-obd-device-list]');
    const initBtn=q('[data-obd-init]');
    const disconnectBtn=q('[data-obd-disconnect]');
    const snapshotBtn=q('[data-obd-snapshot]');
    const sendBtn=q('[data-obd-send]');
    const custom=q('[data-obd-custom]');
    const vehicleCurrent=q('[data-obd-vehicle-current]');
    const vehicleList=q('[data-obd-vehicle-list]');
    const dtcList=q('[data-obd-dtc-list]');
    const liveStart=q('[data-obd-live-start]');
    const liveStop=q('[data-obd-live-stop]');
    const liveState=q('[data-obd-live-state]');
    const liveRpm=q('[data-obd-live-rpm]');
    const liveSpeed=q('[data-obd-live-speed]');
    const liveCoolant=q('[data-obd-live-coolant]');
    const liveVoltage=q('[data-obd-live-voltage]');
    let connected=false;
    let ready=false;
    let currentAdapter=null;
    let selectedVehicle=null;
    let vehicles=[];
    let liveTimer=0;
    let liveBusy=false;
    let liveFailures=0;

    const setResult=value=>{
      result.textContent=typeof value==='string'?value:JSON.stringify(value,null,2);
    };
    const vehicleTitle=v=>String(v?.title||[v?.brand,v?.model,v?.year_label||v?.year].filter(Boolean).join(' ')||'Автомобиль');
    const vehicleMeta=v=>[v?.vin,v?.plate||v?.plate_number,v?.mileage_km?String(v.mileage_km)+' км':''].filter(Boolean).join(' · ');

    function renderVehicleChoice(){
      if(!vehicles.length){
        vehicleCurrent.innerHTML='<p class="k-obd-muted">В гараже пока нет автомобиля. Диагностику можно выполнить, но сохранение и синхронизация истории требуют привязки к автомобилю.</p>';
        vehicleList.hidden=true;
        return;
      }
      if(!selectedVehicle)selectedVehicle=vehicles.find(v=>v.is_default||v.isDefault||v.primary)||vehicles[0];
      vehicleCurrent.innerHTML=`<button type="button" class="k-obd-selected-vehicle" data-obd-vehicle-toggle>
        <span><b>${esc(vehicleTitle(selectedVehicle))}</b><small>${esc(vehicleMeta(selectedVehicle)||'Выбран для диагностической истории')}</small></span>
        <em>Изменить</em>
      </button>`;
      vehicleList.innerHTML=vehicles.map(v=>`<button type="button" class="k-obd-vehicle-option ${String(v.id)===String(selectedVehicle?.id)?'is-active':''}" data-obd-vehicle-id="${esc(v.id||'')}">
        <span><b>${esc(vehicleTitle(v))}</b><small>${esc(vehicleMeta(v)||'Автомобиль из гаража')}</small></span>
        <em>${String(v.id)===String(selectedVehicle?.id)?'Выбрано':'Выбрать'}</em>
      </button>`).join('');
    }

    async function loadVehicles(){
      try{
        const api=window.KaretaClientCabinetApi;
        if(!api?.get){renderVehicleChoice();return;}
        const response=await api.get({cacheTtlMs:0,force:true,dedupe:false});
        const payload=response?.payload?.data||response?.payload||{};
        vehicles=Array.isArray(payload.vehicles)?payload.vehicles.filter(v=>String(v?.status||'active')!=='archived'):[];
        let remembered='';
        try{remembered=sessionStorage.getItem('kareta.obd.vehicleId')||'';}catch(_){}
        selectedVehicle=vehicles.find(v=>String(v.id)===remembered)||vehicles.find(v=>v.is_default||v.isDefault||v.primary)||vehicles[0]||null;
        renderVehicleChoice();
      }catch(_){
        vehicleCurrent.innerHTML='<p class="k-obd-muted">Не удалось загрузить гараж. Диагностика доступна, но история не будет сохранена или синхронизирована без vehicleId.</p>';
      }
    }

    const dtcSystem=code=>{
      const c=String(code||'').charAt(0);
      return c==='P'?'Силовой агрегат':c==='C'?'Шасси':c==='B'?'Кузов':c==='U'?'Сеть/связь':'OBD-II';
    };
    function renderDtc(codes){
      const list=Array.isArray(codes)?codes.filter(Boolean):[];
      if(!list.length){dtcList.hidden=true;dtcList.innerHTML='';return;}
      dtcList.hidden=false;
      dtcList.innerHTML=`<div class="k-obd-dtc-head"><b>Найдены коды неисправностей</b><span>${list.length}</span></div>
        <div class="k-obd-dtc-grid">${list.map(code=>`<article><strong>${esc(code)}</strong><span>${esc(dtcSystem(code))}</span><a href="#/assistant" data-obd-dtc-help="${esc(code)}">Разобрать ошибку</a></article>`).join('')}</div>`;
    }

    function renderLive(data={}){
      const fmt=(v,d=0)=>v===null||v===undefined||Number.isNaN(Number(v))?'—':Number(v).toFixed(d);
      liveRpm.textContent=fmt(data.rpm,0);
      liveSpeed.textContent=fmt(data.speedKph,0);
      liveCoolant.textContent=fmt(data.coolantC,0);
      liveVoltage.textContent=fmt(data.voltageV,1);
      liveState.textContent='Обновлено '+new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
    }

    async function pollLive(){
      if(!ready||!mobile?.available?.()||liveBusy)return;
      liveBusy=true;
      try{
        const data=await mobile.elmLiveSnapshot();
        liveFailures=0;
        renderLive(data||{});
      }catch(error){
        liveFailures+=1;
        liveState.textContent='Live: '+(error.message||String(error));
        if(liveFailures>=3)stopLive();
      }finally{liveBusy=false;}
    }

    function startLive(){
      if(!ready||liveTimer)return;
      liveFailures=0;
      liveStart.disabled=true;
      liveStop.disabled=false;
      liveState.textContent='Live-режим запущен…';
      pollLive();
      liveTimer=window.setInterval(pollLive,1600);
    }

    function stopLive(){
      if(liveTimer){window.clearInterval(liveTimer);liveTimer=0;}
      liveBusy=false;
      liveStart.disabled=!ready;
      liveStop.disabled=true;
      liveState.textContent='Live-режим остановлен.';
    }


    const setDiagnosticReady=value=>{
      ready=!!value;
      snapshotBtn.disabled=!ready;
      sendBtn.disabled=!ready;
      liveStart.disabled=!ready||!!liveTimer;
      qa('[data-obd-command]').forEach(button=>button.disabled=!ready);
      if(!ready)stopLive();
    };
    const setConnected=value=>{
      connected=!!value;
      initBtn.disabled=!connected;
      disconnectBtn.disabled=!connected;
      if(!connected)setDiagnosticReady(false);
      btChip.textContent=ready?'Готово':connected?'Адаптер':'Не подключено';
      btChip.classList.toggle('is-ok',connected);
    };
    const updateNetwork=()=>{
      const online=navigator.onLine;
      onlineChip.textContent=online?'Онлайн':'Офлайн';
      onlineChip.classList.toggle('is-ok',online);
      onlineChip.classList.toggle('is-warn',!online);
    };
    const updateOffline=async()=>{
      if(!mobile?.available?.())return;
      try{
        const state=await mobile.offlineState();
        offlineChip.textContent=String(state.count||0);
        offlineChip.classList.toggle('is-warn',Number(state.count||0)>0);
      }catch(_){}
    };

    async function refreshStatus(){
      updateNetwork();
      if(!mobile?.available?.()){
        nativeChip.textContent='Только Android';
        nativeChip.classList.add('is-warn');
        nativeText.textContent='ELM327 доступен в приложении KARETA.KZ - Автосервис. В обычном браузере раздел работает только как история диагностики.';
        setConnected(false);
        return;
      }
      nativeChip.textContent='Native API';
      nativeChip.classList.add('is-ok');
      nativeText.textContent='Bluetooth и офлайн-хранилище доступны.';
      try{
        const status=await mobile.elmStatus();
        if(!status.permission){
          try{
            const permission=await mobile.requestPermission('bluetooth');
            if(permission?.granted===false){
              btChip.textContent='Нужно разрешение';
              btChip.classList.add('is-warn');
            }
          }catch(_){}
        }
        setConnected(!!status.connected);
        setDiagnosticReady(!!status.ready);
        btChip.textContent=status.ready?'Готово':status.connected?'Адаптер':'Не подключено';
        if(status.lastError&&!status.ready) nativeText.textContent='ELM327: '+status.lastError;
        if(status.address){
          currentAdapter={name:status.name||'ELM327',address:status.address};
          deviceText.textContent=`${currentAdapter.name} · ${currentAdapter.address}`;
        }else{
          deviceText.textContent=status.enabled?'Адаптер не выбран.':'Bluetooth выключен.';
        }
      }catch(error){setResult(error.message||String(error));}
      await updateOffline();
    }

    async function listDevices(){
      if(!mobile?.available?.())return;
      try{
        try{
          const permission=await mobile.requestPermission('bluetooth');
          if(permission?.granted===false){
            setResult('Подтвердите системное разрешение Bluetooth, затем снова нажмите «Выбрать ELM327».');
            return;
          }
        }catch(_){}
        const payload=await mobile.elmDevices();
        const devices=Array.isArray(payload.devices)?payload.devices:[];
        deviceList.hidden=false;
        if(!devices.length){
          deviceList.innerHTML='<p class="k-obd-muted">Нет сопряжённых устройств. Откройте Bluetooth и выполните сопряжение ELM327.</p>';
          return;
        }
        devices.sort((a,b)=>Number(!!b.likelyElm)-Number(!!a.likelyElm));
        deviceList.innerHTML=devices.map(d=>`<button type="button" class="k-obd-device-row" data-obd-address="${esc(d.address||'')}" data-obd-name="${esc(d.name||'Bluetooth')}"><span><b>${esc(d.name||'Bluetooth')}</b><small>${esc(d.address||'')}</small></span><em>${d.likelyElm?'ELM/OBD':'Bluetooth'}</em></button>`).join('');
      }catch(error){setResult(error.message||String(error));}
    }

    async function connect(address,name){
      setResult('Подключение к '+name+'…');
      try{
        await mobile.elmConnect(address);
        currentAdapter={address,name};
        deviceText.textContent=`${name} · ${address}`;
        setConnected(true);
        deviceList.hidden=true;
        setResult('Соединение установлено. Выполняется инициализация ELM327…');
        const init=await mobile.elmInit();
        setDiagnosticReady(!!init?.vehicleConnected);
        btChip.textContent=init?.vehicleConnected?'Готово':'Адаптер';
        setResult({connected:true,ready:!!init?.vehicleConnected,adapter:currentAdapter,initialization:init});
      }catch(error){
        setConnected(false);
        setResult('Ошибка подключения: '+(error.message||String(error)));
      }
    }

    function parseVin(raw){
      const hex=String(raw||'').replace(/[^0-9A-F]/gi,'');
      const idx=hex.indexOf('4902');
      if(idx<0)return '';
      let data=hex.slice(idx+4).replace(/^01/,'');
      let out='';
      for(let i=0;i+1<data.length;i+=2){
        const n=parseInt(data.slice(i,i+2),16);
        if(n>=32&&n<=126)out+=String.fromCharCode(n);
      }
      return out.replace(/[^A-HJ-NPR-Z0-9]/gi,'').slice(0,17);
    }

    const queuedVehicleId=item=>String(
      item?.payload?.vehicleId ?? item?.payload?.carId ?? item?.payload?.autoId ?? item?.payload?.elmVehicleId ?? ''
    ).trim();

    async function saveOffline(snapshot){
      if(!mobile?.available?.())return null;
      const vehicleId=String(selectedVehicle?.id||'').trim();
      if(!vehicleId){
        return {skipped:true,code:'VEHICLE_ID_REQUIRED'};
      }
      const payload={
        kind:'obd_session',
        capturedAt:Date.now(),
        adapter:currentAdapter||{},
        vehicleId,
        vin:snapshot?.vin||parseVin(snapshot?.vinRaw),
        dtc:{raw:snapshot?.dtcRaw||'',codes:Array.isArray(snapshot?.dtcCodes)?snapshot.dtcCodes:[]},
        snapshot
      };
      const item=await mobile.offlineEnqueue(payload);
      await updateOffline();
      return item;
    }

    async function syncOffline(){
      if(!navigator.onLine || !mobile?.available?.())return false;
      try{
        const state=await mobile.offlineState();
        if(!Number(state.count||0))return true;
        const drained=await mobile.offlineDrain();
        const items=Array.isArray(drained.items)?drained.items:[];
        if(!items.length)return true;
        const eligible=items.filter(item=>queuedVehicleId(item)!=='');
        const blocked=items.length-eligible.length;
        if(!eligible.length){
          if(blocked) setResult(blocked+' локальных диагностических сессий не синхронизированы: отсутствует vehicleId. Привяжите автомобиль и повторите диагностику.');
          return false;
        }
        const response=await fetch('/api/obd.php?action=sync',{
          method:'POST',credentials:'same-origin',
          headers:{'Content-Type':'application/json','Accept':'application/json'},
          body:JSON.stringify({items:eligible})
        });
        const payload=await response.json();
        if(!response.ok||!payload.ok)throw new Error(payload.code||'SYNC_FAILED');
        await mobile.offlineAcknowledge(eligible);
        await updateOffline();
        await loadHistory();
        if(blocked){
          setResult('Синхронизировано '+eligible.length+' сессий. '+blocked+' старых локальных записей без vehicleId оставлены на устройстве.');
        }
        return blocked===0;
      }catch(error){
        await updateOffline();
        setResult('Сессия сохранена офлайн. Синхронизация будет повторена: '+(error.message||String(error)));
        return false;
      }
    }

    async function runSnapshot(){
      if(!ready)return;
      snapshotBtn.disabled=true;
      setResult('Читаем основные параметры автомобиля…');
      try{
        const snapshot=await mobile.elmSnapshot();
        const saved=await saveOffline(snapshot);
        renderLive(snapshot);
        renderDtc(snapshot?.dtcCodes||[]);
        if(saved?.skipped){
          setResult({snapshot,warning:'Диагностика выполнена, но история не сохранена: сначала добавьте или выберите автомобиль.'});
        }else{
          setResult(snapshot);
          if(navigator.onLine)await syncOffline();
        }
      }catch(error){setResult(error.message||String(error));}
      finally{snapshotBtn.disabled=!ready;}
    }

    async function runCommand(command){
      if(!ready||!command)return;
      setResult('Команда '+command+'…');
      try{setResult(await mobile.elmCommand(command,3500));}
      catch(error){setResult(error.message||String(error));}
    }

    async function loadHistory(){
      try{
        const vehicleQuery=selectedVehicle?.id?'&vehicleId='+encodeURIComponent(selectedVehicle.id):'';
        const response=await fetch('/api/obd.php?action=history&limit=30'+vehicleQuery,{credentials:'same-origin',headers:{Accept:'application/json'}});
        const payload=await response.json();
        const rows=Array.isArray(payload.sessions)?payload.sessions:[];
        q('[data-obd-history]').innerHTML=rows.length?rows.map(row=>`<article class="k-obd-history-row"><div><b>${esc(row.vin||'Диагностическая сессия')}</b><small>${esc(row.adapterName||'ELM327')} · ${esc(row.capturedAt||'')}</small></div><button type="button" class="k-btn" data-obd-history-id="${esc(row.id||'')}">Данные</button><script type="application/json" data-obd-history-json="${esc(row.id||'')}">${JSON.stringify(row).replace(/</g,'\\u003c')}</script></article>`).join(''):'<p class="k-obd-muted">Синхронизированных сессий пока нет.</p>';
      }catch(_){
        q('[data-obd-history]').innerHTML='<p class="k-obd-muted">История недоступна без сети.</p>';
      }
    }

    const click=async event=>{
      const vehicleToggle=event.target.closest('[data-obd-vehicle-toggle]');
      if(vehicleToggle){vehicleList.hidden=!vehicleList.hidden;return;}
      const vehicleOption=event.target.closest('[data-obd-vehicle-id]');
      if(vehicleOption){
        selectedVehicle=vehicles.find(v=>String(v.id)===String(vehicleOption.dataset.obdVehicleId||''))||selectedVehicle;
        try{sessionStorage.setItem('kareta.obd.vehicleId',String(selectedVehicle?.id||''));}catch(_){}
        vehicleList.hidden=true;
        renderVehicleChoice();
        await loadHistory();
        return;
      }
      if(event.target.closest('[data-obd-live-start]')){startLive();return;}
      if(event.target.closest('[data-obd-live-stop]')){stopLive();return;}
      if(event.target.closest('[data-obd-reconnect]')){
        if(!mobile?.available?.())return;
        stopLive();
        setResult('Переподключение к последнему ELM327…');
        try{
          const status=await mobile.elmReconnectLast();
          currentAdapter={name:status?.name||'ELM327',address:status?.address||''};
          setConnected(true);
          deviceText.textContent=[currentAdapter.name,currentAdapter.address].filter(Boolean).join(' · ');
          const init=await mobile.elmInit();
          setDiagnosticReady(!!init?.vehicleConnected);
          btChip.textContent=init?.vehicleConnected?'Готово':'Адаптер';
          setResult({connected:true,ready:!!init?.vehicleConnected,reconnected:true,adapter:currentAdapter,initialization:init});
        }catch(error){setConnected(false);setResult('Не удалось переподключиться: '+(error.message||String(error)));}
        return;
      }
      const dtcHelp=event.target.closest('[data-obd-dtc-help]');
      if(dtcHelp){
        try{sessionStorage.setItem('kareta_assistant_problem','Код OBD-II '+String(dtcHelp.dataset.obdDtcHelp||'')+'. Объясни возможные причины и порядок диагностики.');}catch(_){}
        location.hash='#/assistant';
        return;
      }
      const device=event.target.closest('[data-obd-address]');
      if(device){await connect(device.dataset.obdAddress||'',device.dataset.obdName||'ELM327');return;}
      if(event.target.closest('[data-obd-devices]')){await listDevices();return;}
      if(event.target.closest('[data-obd-settings]')){try{await mobile?.openBluetoothSettings?.();}catch(_){}return;}
      if(event.target.closest('[data-obd-init]')){
        try{
          const init=await mobile.elmInit();
          setDiagnosticReady(!!init?.vehicleConnected);
          btChip.textContent=init?.vehicleConnected?'Готово':'Адаптер';
          setResult(init);
        }catch(e){setDiagnosticReady(false);setResult(e.message||String(e));}
        return;
      }
      if(event.target.closest('[data-obd-disconnect]')){try{await mobile.elmDisconnect();}catch(_){}setConnected(false);deviceText.textContent='Адаптер отключён.';return;}
      if(event.target.closest('[data-obd-snapshot]')){await runSnapshot();return;}
      const command=event.target.closest('[data-obd-command]');
      if(command){await runCommand(command.dataset.obdCommand||'');return;}
      if(event.target.closest('[data-obd-send]')){await runCommand((custom.value||'').trim());return;}
      if(event.target.closest('[data-obd-sync]')){await syncOffline();return;}
      if(event.target.closest('[data-obd-history-refresh]')){await loadHistory();return;}
      const history=event.target.closest('[data-obd-history-id]');
      if(history){
        const node=root.querySelector(`[data-obd-history-json="${CSS.escape(history.dataset.obdHistoryId||'')}"]`);
        try{setResult(JSON.parse(node?.textContent||'{}'));}catch(_){}
      }
    };

    root.addEventListener('click',click);
    const online=()=>{updateNetwork();syncOffline();};
    const offline=()=>updateNetwork();
    window.addEventListener('online',online);
    window.addEventListener('offline',offline);

    loadVehicles().then(loadHistory);
    refreshStatus();
    if(navigator.onLine)syncOffline();

    const cleanup=()=>{
      stopLive();
      root.removeEventListener('click',click);
      window.removeEventListener('online',online);
      window.removeEventListener('offline',offline);
    };
    context.lifecycle?.addCleanup?.(cleanup);
    return cleanup;
  }

  window.KaretaDiagnosticsPages=Object.freeze({renderDiagnostics,mountDiagnostics});
})();
