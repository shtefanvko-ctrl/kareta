<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
type System = { hostname: string; memoryTotalBytes: number|null; memoryAvailableBytes: number|null; load1: number|null; diskTotalBytes: number|null; diskFreeBytes: number|null; timestamp: string }
const info = ref<System|null>(null)
const error = ref('')
let timer: ReturnType<typeof setInterval>|undefined
let controller: AbortController|undefined
const size = (n:number|null|undefined) => n == null ? 'Недоступно' : (n / 1024**3).toFixed(1) + ' ГБ'
async function refresh() {
  controller?.abort()
  const current = new AbortController()
  controller = current
  try {
    const response = await fetch('/api/system', {signal:current.signal, cache:'no-store'})
    if (!response.ok) throw new Error('HTTP ' + response.status)
    info.value = await response.json() as System
    error.value = ''
  } catch(e) {
    if (current.signal.aborted) return
    error.value = e instanceof Error ? e.message : 'Ошибка соединения'
    info.value = null
  }
}
onMounted(() => { void refresh(); timer = setInterval(() => void refresh(), 3000) })
onUnmounted(() => { if(timer) clearInterval(timer); controller?.abort() })
</script>
<template>
<main>
<header><div><small>LOCAL · UBUNTU</small><h1>🚘 KARETA <span>CONTROL CENTER</span></h1></div><div class="badge" :class="{offline:!!error}">{{ error ? '● OFFLINE' : info ? '● ONLINE' : '◌ CONNECTING' }}</div></header>
<p class="sub">Карта системы · Мониторинг в реальном времени · Только чтение</p>
<div v-if="error" role="alert" class="alert">Нет соединения с локальным Go API: {{error}}</div>
<section class="grid">
<article><div class="icon">🖥️</div><h2>СИСТЕМА</h2><p>Хост: {{info?.hostname ?? '—'}}</p><p>Load average (1 мин): <b>{{info?.load1 ?? '—'}}</b></p><p class="hint">Не процент загрузки CPU</p></article>
<article><div class="icon">🧠</div><h2>ОПЕРАТИВНАЯ ПАМЯТЬ</h2><p>Всего: <b>{{size(info?.memoryTotalBytes)}}</b></p><p>Доступно: <b>{{size(info?.memoryAvailableBytes)}}</b></p></article>
<article><div class="icon">💾</div><h2>СИСТЕМНЫЙ ДИСК /</h2><p>Всего: <b>{{size(info?.diskTotalBytes)}}</b></p><p>Свободно: <b>{{size(info?.diskFreeBytes)}}</b></p></article>
<article class="disabled"><div class="icon">🤖</div><h2>АГЕНТЫ</h2><p>Scion · Codex</p><p class="hint">Адаптеры ещё не подключены</p></article>
<article class="disabled"><div class="icon">🦙</div><h2>OLLAMA</h2><p>Локальные модели</p><p class="hint">Подключение в следующем инкременте</p></article>
<article class="disabled"><div class="icon">🚘</div><h2>KARETA</h2><p>GitHub · PHP · MySQL</p><p class="hint">Подключение в следующем инкременте</p></article>
</section>
<footer>Обновление каждые 3 секунды · {{info?.timestamp ?? 'Нет данных'}} · Без системных команд</footer>
</main>
</template>
<style>
:root{font-family:Inter,system-ui,Arial,sans-serif;color:#eaf1ff;background:#09101d;font-synthesis:none}*{box-sizing:border-box}body{margin:0}main{max-width:1320px;margin:auto;padding:32px}header{display:flex;justify-content:space-between;align-items:center;gap:20px;border-bottom:1px solid #243650;padding-bottom:22px}small{color:#69a8ff;letter-spacing:3px}h1{margin:8px 0 0;font-size:clamp(22px,3vw,36px)}h1 span{color:#60a5fa}.badge{color:#3ee9aa;background:#133b32;border:1px solid #236b57;border-radius:40px;padding:12px 18px;font-weight:700}.badge.offline{color:#ff9999;background:#402020}.sub{color:#93a8c7;margin:22px 0 28px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}article{background:linear-gradient(145deg,#17253c,#101c2e);border:1px solid #2c4365;border-radius:18px;padding:24px;min-height:205px}article.disabled{opacity:.6}h2{font-size:16px;letter-spacing:1px;color:#b6d5ff}.icon{font-size:30px}p{color:#c3d1e8}b{color:#fff}.hint{color:#879ab5;font-size:13px}.alert{border:1px solid #aa4444;color:#ffaaaa;padding:12px;border-radius:8px}footer{margin-top:28px;color:#8195b2;font-size:13px}@media(max-width:800px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){.grid{grid-template-columns:1fr}main{padding:18px}header{align-items:flex-start;flex-direction:column}}
</style>