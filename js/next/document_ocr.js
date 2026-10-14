(() => {
  'use strict';
  // Browser OCR is optional and local only. No API uploads, raw owner data or image persistence.
  const norm=value=>String(value||'').normalize('NFKC').toUpperCase().replace(/\s+/g,' ').trim();
  const one=values=>{const v=[...new Set(values.filter(Boolean))];return v.length===1?v[0]:'';};
  const validVin=value=>/^[A-HJ-NPR-Z0-9]{17}$/.test(value);
  const capture=(lines,pattern)=>lines.flatMap(line=>Array.from(line.matchAll(pattern),m=>m[1]||''));
  const hasWord=(line,word)=>{
    const escaped=norm(word).replace(/[.*+?^$()|[\]\\{}]/g,'\\$&').replace(/\s+/g,'\\s+');
    return new RegExp('(?:^|[^A-ZА-ЯЁ0-9])'+escaped+'(?=$|[^A-ZА-ЯЁ0-9])','u').test(line);
  };
  function parseText(raw,catalog=[]){
    const lines=(Array.isArray(raw)?raw:[raw]).flatMap(x=>String(x||'').split(/\r?\n/)).map(norm).filter(Boolean).slice(0,200);
    const around=pattern=>lines.filter((line,index)=>pattern.test(line)||(index>0&&pattern.test(lines[index-1])&&line.length<90));
    const year=one(capture(around(/ГОД\s*ВЫПУСКА|ШЫҒАРЫЛҒАН|YEAR\s*(?:OF\s*)?(?:MANUFACTURE|PRODUCTION)/u),/\b((?:19[5-9]\d|20\d{2}))\b/g).filter(y=>Number(y)<=new Date().getFullYear()+1));
    const vinLines=around(/\bVIN\b|ИДЕНТИФИКАЦИОНН|СӘЙКЕСТЕНДІРУ/u);
    const vins=one(capture(vinLines,/\b([A-HJ-NPR-Z0-9]{17})\b/g).filter(validVin))
      ||one(capture(lines,/\b([A-HJ-NPR-Z0-9]{17})\b/g).filter(validVin));
    const plateMatch=/\b(?:KZ[\s-]*)?(\d{3}[\s-]*[A-Z]{2,3}[\s-]*\d{2})\b/g;
    const plateLines=around(/ГОС\s*НОМЕР|ГОСУДАРСТВЕН|МЕМЛЕКЕТТІК\s*НӨМІР|REGISTRATION\s*NUMBER/u);
    const plate=one(capture(plateLines,plateMatch).map(x=>x.replace(/[\s-]+/g,'')))
      ||one(capture(lines,plateMatch).map(x=>x.replace(/[\s-]+/g,'')));
    const brands=(Array.isArray(catalog)?catalog:[]).filter(b=>b?.name&&lines.some(line=>hasWord(line,b.name)));
    const brand=brands.length===1?brands[0]:null;
    const models=brand?(brand.models||[]).filter(m=>m?.name&&lines.some(line=>hasWord(line,m.name)
      &&(hasWord(line,brand.name)||/\bMODEL\b|МОДЕЛЬ|ҮЛГІ/u.test(line)))):[];
    const model=models.length===1?models[0]:null;
    const fields={};
    if(brand)fields.brandName=brand.name;
    if(model)fields.modelName=model.name;
    if(year)fields.year=year;
    if(vins)fields.vin=vins;
    if(plate)fields.plateNumber=plate;
    return fields;
  }
  const available=()=>typeof window.TextDetector==='function'&&typeof createImageBitmap==='function';
  async function recognize(photos,{signal}={}){
    if(!available())throw new Error('DOCUMENT_OCR_UNAVAILABLE');
    const detector=new window.TextDetector(),recognized=[];
    for(const side of ['front','rear']){
      if(signal?.aborted||!photos?.[side])throw new Error('DOCUMENT_OCR_CANCELLED');
      const bitmap=await createImageBitmap(photos[side]);
      try{
        const rows=await detector.detect(bitmap);
        recognized.push((Array.isArray(rows)?rows:[]).map(x=>String(x?.rawValue||'')).join('\n'));
      }finally{bitmap.close?.();}
    }
    if(signal?.aborted)throw new Error('DOCUMENT_OCR_CANCELLED');
    // Only supported vehicle fields leave this module. Raw document text is discarded.
    return {engine:'browser-text-detector',fields:parseText(recognized,window.KaretaFirstVehicleFlow?.CATALOG||[])};
  }
  window.KaretaDocumentOCR=Object.freeze({available,parseText,recognize});
})();
