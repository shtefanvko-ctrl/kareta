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
