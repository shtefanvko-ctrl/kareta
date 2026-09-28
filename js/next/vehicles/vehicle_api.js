(() => {
  'use strict';
  const post=(api,action,payload)=>api.request('api/db.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...payload}),cacheTtlMs:0,dedupe:false});
  const detail=(api,id,options={})=>api.request(`api/db.php?action=vehicles.detail&id=${encodeURIComponent(id)}`,{cacheTtlMs:5000,force:true,...options});
  const saveRecommendation=(api,payload)=>post(api,'vehicles.recommendation.save',payload);
  const saveIssue=(api,payload)=>post(api,'vehicles.issue.save',payload);
  const saveMileage=(api,payload)=>post(api,'vehicles.mileage.save',payload);
  window.KaretaVehicleApi=Object.freeze({detail,saveRecommendation,saveIssue,saveMileage});
})();
