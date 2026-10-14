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

  // Review is a separate trust boundary: only supported vehicle fields may pass to garage.
  function validateCandidate(input={}){
    const fields={},errors={};
    for(const key of ['brandName','modelName','year','vin','plateNumber']){
      const value=String(input?.[key]??'').trim();
      if(!value)continue;
      if(key==='brandName'||key==='modelName'){
        if(value.length>80||/[\u0000-\u001f\u007f<>]/u.test(value)){errors[key]='INVALID_NAME';continue;}
        fields[key]=value.replace(/\s+/g,' ');
      }else if(key==='year'){
        if(!/^\d{4}$/.test(value)||Number(value)<1950||Number(value)>new Date().getFullYear()+1){errors[key]='INVALID_YEAR';continue;}
        fields.year=value;
      }else if(key==='vin'){
        const vin=value.toUpperCase().replace(/\s+/g,'');
        if(!validVin(vin)){errors[key]='INVALID_VIN';continue;}
        fields.vin=vin;
      }else if(key==='plateNumber'){
        const plate=value.toUpperCase().replace(/\s+/g,' ');
        if(plate.length>24||!/^[A-ZА-ЯЁӘҒҚҢӨҰҮҺІ0-9 -]{4,24}$/u.test(plate)){errors[key]='INVALID_PLATE';continue;}
        fields.plateNumber=plate;
      }
    }
    if(fields.modelName&&!fields.brandName)errors.brandName='BRAND_REQUIRED';
    if(!Object.keys(fields).length&&!Object.keys(errors).length)errors._form='NO_FIELDS';
    return {ok:Object.keys(errors).length===0,fields,errors};
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
  window.KaretaDocumentOCR=Object.freeze({available,parseText,recognize,validateCandidate});
})();
