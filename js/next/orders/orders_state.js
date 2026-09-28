(() => {
  'use strict';

  const initialState = Object.freeze({
    phase:'idle',
    orders:Object.freeze([]),
    error:null,
    requestId:0,
    receivedAt:0,
  });

  let state = initialState;
  const listeners = new Set();

  function emit(){
    listeners.forEach(listener => {
      try { listener(state); } catch (_error) {}
    });
  }

  function replace(patch){
    state = Object.freeze({ ...state, ...patch });
    emit();
    return state;
  }

  function begin(){
    const requestId = state.requestId + 1;
    replace({ phase:'loading', error:null, requestId });
    return requestId;
  }

  function resolve(requestId, snapshot){
    if (requestId !== state.requestId) return false;
    const orders = Object.freeze(Array.isArray(snapshot && snapshot.orders) ? [...snapshot.orders] : []);
    replace({
      phase:orders.length ? 'ready' : 'empty',
      orders,
      error:null,
      receivedAt:Number(snapshot && snapshot.receivedAt || Date.now()),
    });
    return true;
  }

  function reject(requestId, error){
    if (requestId !== state.requestId) return false;
    replace({
      phase:'error',
      orders:Object.freeze([]),
      error:Object.freeze({
        message:String(error && error.message || 'Не удалось загрузить заказы'),
        status:Number(error && error.status || 0),
      }),
    });
    return true;
  }

  function reset(){
    state = Object.freeze({ ...initialState, requestId:state.requestId + 1 });
    emit();
  }

  function subscribe(listener){
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    listener(state);
    return () => listeners.delete(listener);
  }

  window.KaretaOrdersState = Object.freeze({
    begin,
    resolve,
    reject,
    reset,
    subscribe,
    getSnapshot:() => state,
  });
})();
