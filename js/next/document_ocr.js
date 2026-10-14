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


  const nativeAvailable=()=>Boolean(window.KaretaMobile?.available?.()
    &&window.KaretaMobile?.supports?.('documentOcr')===true
    &&typeof window.KaretaMobile?.recognizeDocumentImage==='function');
  const browserAvailable=()=>typeof window.TextDetector==='function'&&typeof createImageBitmap==='function';
  const nativeCatalog=()=>Array.isArray(window.KaretaFirstVehicleFlow?.CATALOG)
    ?window.KaretaFirstVehicleFlow.CATALOG.map(brand=>({
      name:String(brand.name||''),models:(brand.models||[]).map(model=>({name:String(model.name||'')}))
    })):[];

  async function imageBase64(file){
    let bitmap=null,preview=null,objectUrl='';
    try{
      if(typeof createImageBitmap==='function')bitmap=await createImageBitmap(file);
      else {
        if(typeof Image!=='function')throw new Error('DOCUMENT_IMAGE_DECODE_UNAVAILABLE');
        preview=new Image();
        objectUrl=URL.createObjectURL(file);
        await new Promise((resolve,reject)=>{
          preview.onload=resolve;
          preview.onerror=()=>reject(new Error('DOCUMENT_IMAGE_DECODE_FAILED'));
          preview.src=objectUrl;
        });
      }
      const width=bitmap?.width||preview?.naturalWidth||0,height=bitmap?.height||preview?.naturalHeight||0;
      if(!width||!height||width>10000||height>10000)throw new Error('DOCUMENT_IMAGE_INVALID');
      const canvas=document.createElement('canvas');
      const ratio=Math.min(1,1600/Math.max(width,height));
      canvas.width=Math.max(1,Math.round(width*ratio));
      canvas.height=Math.max(1,Math.round(height*ratio));
      try{
        const ctx=canvas.getContext('2d',{alpha:false});
        if(!ctx)throw new Error('DOCUMENT_CANVAS_UNAVAILABLE');
        ctx.drawImage(bitmap||preview,0,0,canvas.width,canvas.height);
        const data=canvas.toDataURL('image/jpeg',0.78);
        const encoded=data.startsWith('data:image/jpeg;base64,')?data.slice(23):'';
        if(!encoded||encoded.length>1900000)throw new Error('DOCUMENT_IMAGE_TOO_LARGE');
        return encoded;
      }finally{canvas.width=0;canvas.height=0;}
    }finally{
      bitmap?.close?.();
      if(objectUrl)URL.revokeObjectURL(objectUrl);
    }
  }

  async function recognizeNative(photos,{signal}={}){
    const values=[],catalog=nativeCatalog();
    for(const side of ['front','rear']){
      if(signal?.aborted||!photos?.[side])throw new Error('DOCUMENT_OCR_CANCELLED');
      const image=await imageBase64(photos[side]);
      if(signal?.aborted)throw new Error('DOCUMENT_OCR_CANCELLED');
      const response=await window.KaretaMobile.recognizeDocumentImage(image,catalog);
      if(signal?.aborted)throw new Error('DOCUMENT_OCR_CANCELLED');
      if(!response||typeof response.fields!=='object'||Array.isArray(response.fields))
        throw new Error('DOCUMENT_NATIVE_INVALID_RESPONSE');
      values.push(response.fields);
    }
    const fields={};
    for(const key of ['brandName','modelName','year','vin','plateNumber']){
      const unique=new Set(values.map(side=>String(side[key]||'').trim()).filter(Boolean));
      if(unique.size===1)fields[key]=[...unique][0];
    }
    return {engine:'native-mlkit-latin',fields};
  }

  const available=()=>nativeAvailable()||browserAvailable();
  async function recognize(photos,{signal}={}){
    if(nativeAvailable()){
      try{return await recognizeNative(photos,{signal});}
      catch(error){
        if(signal?.aborted||!browserAvailable())throw error;
      }
    }
    if(!browserAvailable())throw new Error('DOCUMENT_OCR_UNAVAILABLE');
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
