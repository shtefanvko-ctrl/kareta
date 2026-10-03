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

  const cities = Object.freeze([
    'Алматы','Астана','Шымкент','Караганда',
    'Усть-Каменогорск','Семей','Павлодар','Риддер'
  ]);

  // Approximate city browsing centers, not user/provider coordinates.
  // GeoNames, CC BY 4.0; inspected 2026-10-03. Sources recorded in Geo changelog.
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
  const resolveCityCenter=value=>{
    const name=String(value||'').trim(),key=cityAliases[name.toLocaleLowerCase('ru-RU')]||cities.find(city=>city.toLocaleLowerCase('ru-RU')===name.toLocaleLowerCase('ru-RU'));
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
    cityIcons,
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

