(() => { 'use strict';
 const TYPES=Object.freeze(['person','organization','vehicle','work_request','work_order','service','product','conversation','calendar_event','payment','notification']);
 const normalize=(type,raw={})=>Object.freeze({type:String(type||raw.type||'entity'),key:String(raw.key||raw.id||''),title:String(raw.title||raw.name||''),status:String(raw.status||'active'),payload:Object.freeze({...raw})});
 window.KaretaDomainModel=Object.freeze({TYPES,normalize,ref:(type,key)=>`${type}:${key}`});
})();
