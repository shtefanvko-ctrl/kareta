(() => {
  'use strict';

  const state = window.KaretaOnboardingState;
  if (!state) throw new Error('KaretaOnboardingState is required');

  const listeners = new Set();
  const ARRAY_FIELDS = Object.freeze(['specTags', 'serviceTags']);

  function copy(value){
    if (!value || typeof value !== 'object') return {};
    try { return JSON.parse(JSON.stringify(value)); } catch (_error) { return { ...value }; }
  }

  function cleanString(value){ return String(value == null ? '' : value).trim(); }

  function cleanList(value){
    const source = Array.isArray(value) ? value : (value == null || value === '' ? [] : [value]);
    return Array.from(new Set(source.map(cleanString).filter(Boolean)));
  }

  function normalizePatch(patch = {}, previous = state.read()){
    const rawRole = patch.role || patch.entryRole || previous.role || previous.entryRole || 'client';
    const next = { ...patch, role:state.role(rawRole), entryRole:state.role(rawRole) };
    ARRAY_FIELDS.forEach(field => {
      if (Object.prototype.hasOwnProperty.call(patch, field)) next[field] = cleanList(patch[field]);
    });
    if (Object.prototype.hasOwnProperty.call(patch, 'city')) next.city = cleanString(patch.city);
    if (Object.prototype.hasOwnProperty.call(patch, 'brand')) next.brand = cleanString(patch.brand);
    if (Object.prototype.hasOwnProperty.call(patch, 'phone')) next.phone = cleanString(patch.phone);
    if (Object.prototype.hasOwnProperty.call(patch, 'stage')) next.stage = cleanString(patch.stage) || 'role';
    return next;
  }

  function read(){ return copy(state.read()); }

  function emit(next, previous, meta){
    const detail = Object.freeze({ next:copy(next), previous:copy(previous), meta:Object.freeze({ ...(meta || {}) }) });
    listeners.forEach(listener => { try { listener(detail); } catch (_error) {} });
    window.dispatchEvent(new CustomEvent('kareta:onboarding-draft', { detail }));
  }

  function patch(values = {}, meta = {}){
    const previous = state.read();
    const normalized = normalizePatch(values, previous);
    const next = state.write({
      ...normalized,
      draftRevision:Number(previous.draftRevision || 0) + 1,
      draftSource:cleanString(meta.source || normalized.draftSource || 'unknown') || 'unknown',
      draftUpdatedAt:new Date().toISOString()
    });
    emit(next, previous, meta);
    return copy(next);
  }

  function replace(values = {}, meta = {}){
    const previous = state.read();
    const normalized = normalizePatch(values, {});
    const next = state.write({
      ...normalized,
      draftRevision:Number(previous.draftRevision || 0) + 1,
      draftSource:cleanString(meta.source || 'replace') || 'replace',
      draftUpdatedAt:new Date().toISOString()
    });
    emit(next, previous, meta);
    return copy(next);
  }

  function setRole(value, meta = {}){
    const role = state.role(value);
    return patch({ role, entryRole:role, pending:true }, { source:meta.source || 'role-selection' });
  }

  function setStage(stage, meta = {}){
    const values = { stage:cleanString(stage) || 'role', pending:true };
    if (meta.surface) values.flowSurface = cleanString(meta.surface);
    return patch(values, { source:meta.source || 'stage-change' });
  }

  function currentRole(){
    const flow = state.read();
    return state.role(flow.role || flow.entryRole || window._karetaCookieRole || 'client');
  }

  function subscribe(listener){
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function audit(){
    const flow = state.read();
    return {
      ok:true,
      role:currentRole(),
      stage:String(flow.stage || 'role'),
      revision:Number(flow.draftRevision || 0),
      source:String(flow.draftSource || ''),
      completed:state.isDone(),
      keys:Object.keys(flow).sort()
    };
  }

  const api = Object.freeze({ read, patch, replace, setRole, setStage, currentRole, subscribe, audit });
  window.KaretaOnboardingProfileDraft = api;

  // Compatibility contract for page modules migrated from the legacy app.js globals.
  window.getEntryFlow = read;
  window.setEntryFlow = function(values){ return patch(values, { source:'legacy-global' }); };
})();
