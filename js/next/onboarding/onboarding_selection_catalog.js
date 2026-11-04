(function(){
  'use strict';

  const cityIcons = Object.freeze({
    'Усть-Каменогорск': '🏔',
    'Риддер': '⛏',
    'Семей': '🌉',
    'Алматы': '🌆',
    'Астана': '🏙',
    'Шымкент': '☀️',
    'Караганда': '⚡',
    'Павлодар': '🌊'
  });

  const cityRecords = Object.freeze([
    Object.freeze({id:'almaty',name:'Алматы'}),
    Object.freeze({id:'astana',name:'Астана'}),
    Object.freeze({id:'shymkent',name:'Шымкент'}),
    Object.freeze({id:'karaganda',name:'Караганда'}),
    Object.freeze({id:'ust-kamenogorsk',name:'Усть-Каменогорск'}),
    Object.freeze({id:'semey',name:'Семей'}),
    Object.freeze({id:'pavlodar',name:'Павлодар'}),
    Object.freeze({id:'ridder',name:'Риддер'})
  ]);
  const cities = Object.freeze(cityRecords.map(row=>row.name));

  // Approximate WGS84 centers are for city browsing only, never user/provider identity.
  const cityCenters=Object.freeze({
    'Алматы':Object.freeze({latitude:43.252,longitude:76.911}),
    'Астана':Object.freeze({latitude:51.180,longitude:71.446}),
    'Шымкент':Object.freeze({latitude:42.310,longitude:69.600}),
    'Караганда':Object.freeze({latitude:49.802,longitude:73.102}),
    'Усть-Каменогорск':Object.freeze({latitude:49.971,longitude:82.606}),
    'Семей':Object.freeze({latitude:50.421,longitude:80.250}),
    'Павлодар':Object.freeze({latitude:52.276,longitude:76.969}),
    'Риддер':Object.freeze({latitude:50.34524,longitude:83.515621})
  });
  const cityAliases=Object.freeze({'өскемен':'Усть-Каменогорск','oskemen':'Усть-Каменогорск','семей':'Семей','semey':'Семей','алматы':'Алматы','almaty':'Алматы','астана':'Астана','astana':'Астана','шымкент':'Шымкент','shymkent':'Шымкент','қарағанды':'Караганда','karaganda':'Караганда','павлодар':'Павлодар','pavlodar':'Павлодар','риддер':'Риддер','ridder':'Риддер'});
  const resolveCityName=value=>{
    const name=String(value||'').trim(),lower=name.toLocaleLowerCase('ru-RU');
    return cityAliases[lower]||cities.find(city=>city.toLocaleLowerCase('ru-RU')===lower)||'';
  };
  const resolveCityId=value=>{
    const name=resolveCityName(value);
    return cityRecords.find(row=>row.name===name)?.id||'';
  };
  const resolveCityCenter=value=>{
    const key=resolveCityName(value);
    return key&&cityCenters[key]?{...cityCenters[key],city:key,precision:'city',source:'GeoNames'}:null;
  };

  const brands = Object.freeze([
    ['Toyota','TO'],['Hyundai','HY'],['Kia','KI'],['Lexus','LX'],
    ['BMW','BM'],['Mercedes','MB'],['Nissan','NS'],['Mitsubishi','MI'],
    ['Lada','LA'],['Chevrolet','CH'],['Volkswagen','VW'],['Honda','HO'],
    ['Subaru','SU'],['Mazda','MZ'],['Haval','HV'],['Geely','GE'],
    ['Audi','AU'],['Skoda','SK'],['Chery','CR'],['Opel','OP']
  ].map(row => Object.freeze(row.slice())));

  window.KaretaOnboardingSelectionCatalog = Object.freeze({
    cities,
    cityRecords,
    cityIcons,
    resolveCityId,
    resolveCityCenter,
    brands,
    audit(){
      return {
        cities: cities.length,
        brands: brands.length,
        uniqueCities: new Set(cities).size === cities.length,
        uniqueBrands: new Set(brands.map(row => row[0])).size === brands.length
      };
    }
  });
})();
