(() => {
  'use strict';
  const STAGES = Object.freeze([
    {key:'draft',label:'Черновик',progress:5},
    {key:'new',label:'Опубликована',progress:14},
    {key:'waiting_responses',label:'Отклики',progress:28},
    {key:'accepted',label:'Исполнитель выбран',progress:42},
    {key:'assigned',label:'Диагностика',progress:55},
    {key:'in_progress',label:'В работе',progress:72},
    {key:'completed',label:'Готово',progress:90},
    {key:'paid',label:'Оплачено',progress:96},
    {key:'closed',label:'Закрыто',progress:100}
  ]);
  const aliases=Object.freeze({cancelled:'closed',warranty_return:'in_progress'});
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const stageIndex=status=>Math.max(0,STAGES.findIndex(s=>s.key===(aliases[status]||status)));
  const stageFor=status=>STAGES[stageIndex(status)]||STAGES[1];
  const progressFor=status=>stageFor(status).progress;
  function renderPipeline(status,{compact=false}={}){
    const current=stageIndex(status);
    return `<div class="k-workflow-pipeline ${compact?'is-compact':''}" aria-label="Этапы заявки">${STAGES.map((s,i)=>`<div class="k-workflow-step ${i<current?'is-done':i===current?'is-current':''}"><span>${i<current?'✓':i+1}</span><small>${esc(s.label)}</small></div>`).join('')}</div>`;
  }
  function timelineFromOrder(order={}){
    const created=order.createdAt||order.created_at||'Сегодня';
    const status=aliases[order.status]||order.status||'new';
    const current=stageIndex(status);
    return STAGES.slice(0,current+1).map((s,i)=>({
      key:s.key,label:s.label,date:i===0?created:(i===current?'Текущий этап':'Завершено'),active:i===current
    })).reverse();
  }
  function renderTimeline(order={}){
    return `<ol class="k-workflow-timeline">${timelineFromOrder(order).map(item=>`<li class="${item.active?'is-active':''}"><span></span><div><strong>${esc(item.label)}</strong><small>${esc(item.date)}</small></div></li>`).join('')}</ol>`;
  }
  window.KaretaWorkflowEngine=Object.freeze({STAGES,stageFor,stageIndex,progressFor,renderPipeline,timelineFromOrder,renderTimeline});
})();
