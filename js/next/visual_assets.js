(() => {
  'use strict';
  const base='/assets/reference';
  const ready=document.documentElement.dataset.referenceAssets==='1';
  const ext=document.documentElement.dataset.referenceAssetsExt||'png';
  const asset=(group,name)=>`${base}/${group}/${name}.${ext}`;

  const automotive=Object.freeze({
    toyota_camry:asset('automotive','toyota_camry'),lexus_is:asset('automotive','lexus_is'),
    kia_sedan:asset('automotive','kia_sedan'),hyundai_tucson:asset('automotive','hyundai_tucson'),
    brake_discs:asset('automotive','brake_discs'),oil_filters:asset('automotive','oil_filters'),
    brake_pads:asset('automotive','brake_pads'),shock_absorber:asset('automotive','shock_absorber'),
    air_filter:asset('automotive','air_filter'),spark_plugs:asset('automotive','spark_plugs'),
    service_station:asset('automotive','service_station')
  });

  const brands=Object.freeze({
    toyota:'Toyota',lexus:'Lexus',kia:'Kia',hyundai:'Hyundai',bmw:'BMW',mercedes_benz:'Mercedes-Benz',audi:'Audi',
    volkswagen:'Volkswagen',nissan:'Nissan',honda:'Honda',mazda:'Mazda',subaru:'Subaru',mitsubishi:'Mitsubishi',ford:'Ford',
    chevrolet:'Chevrolet',tesla:'Tesla',porsche:'Porsche',land_rover:'Land Rover',range_rover:'Range Rover',volvo:'Volvo',skoda:'Skoda',
    renault:'Renault',peugeot:'Peugeot',chery:'Chery',haval:'Haval',geely:'Geely',byd:'BYD',suzuki:'Suzuki',
    jeep:'Jeep',cadillac:'Cadillac',infiniti:'Infiniti',mini:'Mini',jaguar:'Jaguar',fiat:'Fiat',citroen:'Citroen',opel:'Opel'
  });

  const key=v=>String(v||'').trim().toLowerCase().replace(/ё/g,'е').replace(/mercedes(?:-benz)?/,'mercedes_benz').replace(/land\s*rover/,'land_rover').replace(/range\s*rover/,'range_rover').replace(/[^a-z0-9_]+/g,'_').replace(/^_|_$/g,'');
  const brandLogo=v=>{const k=key(v);return ready&&Object.hasOwn(brands,k)?asset('brands',k):''};

  const vehicleFallback=Object.freeze({
    toyota:'/assets/vehicles/toyota_camry_r62u.svg',
    kia:'/assets/vehicles/kia_rio_r62u.svg',
    hyundai:'/assets/vehicles/hyundai_tucson_r62u.svg'
  });
  const vehicleImage=v=>{
    const k=key(v);
    if(ready)return ({toyota:automotive.toyota_camry,lexus:automotive.lexus_is,kia:automotive.kia_sedan,hyundai:automotive.hyundai_tucson})[k]||'';
    return vehicleFallback[k]||'';
  };

  const partImage=v=>{
    if(!ready)return '';
    const k=key(v);
    if(/brake.*pad|pad.*brake|колод/.test(k))return automotive.brake_pads;
    if(/brake|тормоз/.test(k))return automotive.brake_discs;
    if(/oil.*filter|масл.*фильтр/.test(k))return automotive.oil_filters;
    if(/air.*filter|воздуш.*фильтр/.test(k))return automotive.air_filter;
    if(/spark|свеч/.test(k))return automotive.spark_plugs;
    if(/suspension|shock|амортиз|ходов/.test(k))return automotive.shock_absorber;
    return '';
  };

  window.KaretaVisualAssets=Object.freeze({
    ready,base,automotive,brands,key,brandLogo,vehicleImage,partImage,
    stationImage:ready?automotive.service_station:''
  });
})();