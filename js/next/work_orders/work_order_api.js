(() => {
  'use strict';
  function post(api, action, payload){
    const body=window.KaretaFormContract?.prepare?.('workOrder',payload||{})?.compatPayload||payload||{};
    return api.request('api/db.php', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action,...body}), cacheTtlMs:0, dedupe:false });
  }
  async function detail(api,id,options={}){ return api.request(`api/db.php?action=workOrders.detail&id=${encodeURIComponent(id)}`, {cacheTtlMs:5000,force:true,...options}); }
  const checklistToggle=(api,payload)=>post(api,'workOrders.checklist.toggle',payload);
  const mediaSave=(api,payload)=>post(api,'workOrders.media.save',payload);
  const publicationPrepare=(api,payload)=>post(api,'workOrders.publication.prepare',payload);
  const workflow=(api,orderId,options={})=>api.get(`/api/db.php?action=stoWorkflow.get&orderId=${encodeURIComponent(orderId)}`,{force:true,...options});
  const workflowTransition=(api,payload)=>post(api,'stoWorkflow.transition',payload);
  const workflowApproval=(api,payload)=>post(api,'stoWorkflow.approval',payload);
  const acceptOrder=(api,payload)=>post(api,'masterOrder.accept',payload);
  const saveDiagnostics=(api,payload)=>post(api,'masterOrder.diagnostics.save',payload);
  const requestExtraWork=(api,payload)=>post(api,'masterOrder.extraWork.request',payload);
  const skipExtraWork=(api,payload)=>post(api,'masterOrder.estimate.skip',payload);
  const decideExtraWork=(api,payload)=>post(api,'clientOrder.extraWork.decide',payload);
  const reservePart=(api,payload)=>post(api,'masterOrder.parts.reserve',payload);
  const completeParts=(api,payload)=>post(api,'masterOrder.parts.complete',payload);
  const completeWork=(api,payload)=>post(api,'masterOrder.work.complete',payload);
  const saveQuality=(api,payload)=>post(api,'masterOrder.quality.save',payload);
  const configureWarranty=(api,payload)=>post(api,'masterOrder.warranty.configure',payload);
  const prepareHandover=(api,payload)=>post(api,'masterOrder.handover.prepare',payload);
  const publicationConsent=(api,payload)=>post(api,'clientOrder.publication.consent',payload);
  const confirmHandover=(api,payload)=>post(api,'clientOrder.handover.confirm',payload);
  const reserveInventory=(api,payload)=>post(api,'masterOrder.inventory.reserve',payload);
  const returnInventory=(api,payload)=>post(api,'masterOrder.inventory.return',payload);
  const saveFinanceSettings=(api,payload)=>post(api,'masterOrder.finance.settings.save',payload);
  const saveCost=(api,payload)=>post(api,'masterOrder.cost.save',payload);
  const deleteCost=(api,payload)=>post(api,'masterOrder.cost.delete',payload);
  const submitWarrantyClaim=(api,payload)=>post(api,'clientOrder.warrantyClaim.submit',payload);
  const decideWarrantyClaim=(api,payload)=>post(api,'masterOrder.warrantyClaim.decide',payload);
  const inspectWarrantyClaim=(api,payload)=>post(api,'masterOrder.warrantyClaim.inspect',payload);
  const startWarrantyRepair=(api,payload)=>post(api,'masterOrder.warrantyClaim.startRepair',payload);
  const completeWarrantyRepair=(api,payload)=>post(api,'masterOrder.warrantyClaim.completeRepair',payload);
  const warrantyQuality=(api,payload)=>post(api,'masterOrder.warrantyClaim.quality',payload);
  const confirmWarrantyReturn=(api,payload)=>post(api,'clientOrder.warrantyClaim.confirm',payload);
  const addStage=(api,payload)=>post(api,'orders.addStage',payload);
  const addPart=(api,payload)=>post(api,'orders.addPart',payload);
  const startTimer=(api,payload)=>post(api,'workTimers.start',payload);
  const stopTimer=(api,payload)=>post(api,'workTimers.stop',payload);
  window.KaretaWorkOrderApi=Object.freeze({detail,checklistToggle,mediaSave,publicationPrepare,workflow,workflowTransition,workflowApproval,acceptOrder,saveDiagnostics,requestExtraWork,skipExtraWork,decideExtraWork,reservePart,completeParts,completeWork,saveQuality,configureWarranty,prepareHandover,publicationConsent,confirmHandover,reserveInventory,returnInventory,saveFinanceSettings,saveCost,deleteCost,submitWarrantyClaim,decideWarrantyClaim,inspectWarrantyClaim,startWarrantyRepair,completeWarrantyRepair,warrantyQuality,confirmWarrantyReturn,addStage,addPart,startTimer,stopTimer});
})();
