<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
type Metrics={hostname:string;cpuCores:number;load1:number|null;memoryTotalBytes:number|null;memoryAvailableBytes:number|null;diskFreeBytes:number|null}
type Machine={role:string;id:string;name:string;status:string;ready:boolean;metrics:Metrics|null;lastSeen:string|null;availableCpu:number;availableMemoryBytes:number;activeTasks:number;reserveCpu:number;reserveMemoryBytes:number}
type Task={id:string;nodeId:string;status:string;result:Metrics|null}
type Fleet={nodes:Machine[];tasks:Task[];total:number;online:number;ready:number;dispatchEnabled:boolean}
const data=ref<Fleet|null>(null),error=ref(''),token=ref(''),target=ref(''),notice=ref(''),sending=ref(false)
let timer:ReturnType<typeof setInterval>|undefined,controller:AbortController|undefined
const size=(n:number|null|undefined)=>n==null?'Недоступно':(n/1024**3).toFixed(2)+' ГБ'
const statuses:Record<string,string>={queued:'В очереди',running:'Выполняется',completed:'Завершена',unknown:'Результат неизвестен · повтор заблокирован',expired:'Истекло время ожидания'}
async function refresh(){
 controller?.abort();const current=new AbortController();controller=current
 const timeout=setTimeout(()=>current.abort(),2500)
 try{const response=await fetch('/api/fleet',{cache:'no-store',signal:current.signal});if(!response.ok)throw new Error('HTTP '+response.status)
 const value=await response.json() as Fleet;if(!Array.isArray(value.nodes)||!Array.isArray(value.tasks))throw new Error('Invalid registry')
 if(controller!==current)return;data.value=value;error.value=''
 }catch{if(controller!==current)return;data.value=null;error.value='Реестр машин недоступен'}finally{clearTimeout(timeout)}
}
async function submit(){
 sending.value=true;notice.value='';const credential=token.value;token.value=''
 const timeout=new AbortController(),handle=setTimeout(()=>timeout.abort(),5000)
 try{const response=await fetch('/api/tasks',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+credential},body:JSON.stringify({kind:'system-probe',nodeId:target.value}),signal:timeout.signal})
 if(!response.ok)throw new Error(response.status===401?'Ключ оператора не принят':'Задача не принята: HTTP '+response.status)
 notice.value='Диагностика поставлена в очередь';await refresh()
 }catch(e){notice.value=e instanceof Error&&e.name!=='AbortError'?e.message:'Ответ не подтверждён. Проверьте очередь перед повтором.'}finally{clearTimeout(handle);sending.value=false}
}
onMounted(()=>{void refresh();timer=setInterval(()=>void refresh(),3000)})
onUnmounted(()=>{if(timer)clearInterval(timer);controller?.abort();controller=undefined;token.value=''})
</script>
<template>
<section class="fleet" aria-labelledby="fleet-title">
<h2 id="fleet-title">МАШИНЫ И ЗАДАЧИ</h2>
<p v-if="data">Всего машин: <b>{{data.total}}</b> · На связи: <b>{{data.online}}</b> · Готовы к задаче: <b>{{data.ready}}</b></p>
<p v-if="error" role="alert">{{error}}. Доступные ресурсы не подтверждены.</p>
<p v-if="data && !data.nodes.some(n=>n.role!=='coordinator')">Рабочие машины ещё не зарегистрированы. Локальная система выше — координатор; для выполнения задач нужен агент.</p>
<div v-if="data" class="fleet-grid">
<article v-for="node in data.nodes" :key="node.id" class="machine">
<h3>{{node.name || node.id}}</h3><p><strong :class="node.status==='online'?'connected':'disconnected'">{{node.status==='online'?'На связи':'Нет связи'}}</strong> · {{node.id}}</p>
<template v-if="node.status==='online'">
<p>CPU: {{node.metrics?.cpuCores ?? '—'}} ядер · load: {{node.metrics?.load1 ?? '—'}}</p>
<p>Бюджет CPU: {{node.availableCpu.toFixed(1)}} · RAM: {{size(node.availableMemoryBytes)}}</p>
<p>RAM всего: {{size(node.metrics?.memoryTotalBytes)}} · доступно ОС: {{size(node.metrics?.memoryAvailableBytes)}}</p>
<p>Свободно на диске: {{size(node.metrics?.diskFreeBytes)}}</p>
<p>Активных задач: {{node.activeTasks}} · {{node.role==='coordinator'?'Координатор · задачи не принимает':node.ready?'Готова принимать задачу':'Ожидание ресурсов или завершения задачи'}}</p>
</template><p v-else>Ресурсы исключены из распределения.</p>
<p class="hint">Резерв: {{node.reserveCpu}} CPU / {{size(node.reserveMemoryBytes)}} RAM</p>
<p class="hint">Последняя связь: {{node.lastSeen ? new Date(node.lastSeen).toLocaleString() : 'Нет связи с начала запуска координатора'}}</p>
<p class="hint">GPU/VRAM: сбор не подключён</p>
</article></div>
<p class="hint">Бюджет учитывает резерв, load average и принятые задачи. Это оценка допуска, а не ограничение CPU средствами ОС. Связь старше 35 секунд считается потерянной.</p>
<form v-if="data?.dispatchEnabled" @submit.prevent="submit" class="task-form">
<label>Машина<select v-model="target"><option value="">Автоматически по свободным ресурсам</option><option v-for="node in data.nodes.filter(n=>n.role!=='coordinator')" :key="node.id" :value="node.id">{{node.name || node.id}}</option></select></label>
<label>Ключ оператора<input v-model="token" type="password" autocomplete="off" required aria-label="Ключ оператора"></label>
<button :disabled="sending || !token" type="submit">{{sending?'Отправка…':'Запустить диагностику'}}</button>
</form>
<p v-else-if="data" class="hint">Выдача задач выключена: настройте реестр, сертификаты и ключ оператора.</p>
<p class="hint">Доступная задача: сбор системных метрик (1 CPU / 16 МиБ). Задача ждёт подходящего агента; произвольные команды и Scion пока не подключены.</p>
<p v-if="notice" role="status">{{notice}}</p>
<ul v-if="data?.tasks.length" class="task-list"><li v-for="task in [...data.tasks].reverse()" :key="task.id"><b>{{statuses[task.status] || task.status}}</b> · {{task.nodeId || 'Ожидает подходящую машину'}} · {{task.id.slice(0,8)}}<span v-if="task.result"> · Результат: {{task.result.hostname}}, {{task.result.cpuCores}} CPU</span></li></ul>
<p class="hint">Очередь диагностик хранится до перезапуска координатора. Неизвестный результат не запускается повторно автоматически.</p>
</section>
</template>
<style scoped>
.fleet{margin-top:28px;padding-top:16px;border-top:1px solid #243650}.fleet-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,340px),1fr));gap:18px}.machine{min-width:0;overflow-wrap:anywhere}.machine h3{margin-top:0}.connected{color:#3ee9aa}.disconnected{color:#ff9999}.task-form{display:flex;flex-wrap:wrap;gap:14px;align-items:end;margin:20px 0}.task-form label{display:flex;flex-direction:column;gap:8px;flex:1;min-width:min(100%,240px)}input,select,button{font:inherit;min-height:44px;border:1px solid #41608a;border-radius:8px;background:#13233a;color:#eaf1ff;padding:10px;max-width:100%;min-width:0}button{cursor:pointer;background:#24529b}button:disabled{opacity:.5;cursor:default}.task-list{padding-left:20px;overflow-wrap:anywhere}.task-list li{margin:12px 0}h3{color:#b6d5ff}
</style>
