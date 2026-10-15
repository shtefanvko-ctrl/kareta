#!/usr/bin/env node
'use strict';
// Standalone browser/viewport smoke for diagnostic UI only. NOT authenticated s.kareta.kz E2E.
const fs=require('node:fs'),path=require('node:path');
const dir=path.resolve(__dirname,'..');
const target=process.argv[2];
if(!target){console.error('Usage: node tools/render_diagnostics_mobile_fixture_20261015.js <output.html>');process.exit(2)}
const escapeScript=s=>s.replace(/<\/script/gi,'<\\/script');
const css=fs.readFileSync(path.join(dir,'css/next/diagnostics.css'),'utf8');
const page=fs.readFileSync(path.join(dir,'js/next/pages/diagnostics.js'),'utf8');
const script='window.KaretaPageUI={escHtml:x=>String(x??" ").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\\\"":"&quot;"}[c]||c))};window.KaretaMobile={available:()=>false};';
const html='<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DIAGNOSTICS VISUAL SMOKE</title><style>*{box-sizing:border-box}html,body{margin:0;min-width:0;background:#f4f6f9;color:#17212b;font:14px/1.5 system-ui,sans-serif}main{max-width:100%;padding:12px}.k-btn{font:inherit;display:inline-flex;align-items:center;justify-content:center;min-height:38px;padding:8px 12px;border:1px solid #e5e7eb;background:white;color:#17212b;border-radius:10px;text-decoration:none;white-space:normal}.k-btn-primary{background:#ff5a19;color:#fff;border-color:#ff5a19}button{font:inherit;cursor:pointer}button:disabled{cursor:not-allowed;opacity:.55}[hidden]{display:none!important}'+css+'</style></head><body><main id="screen"></main><script>'+escapeScript(script)+'</script><script>'+escapeScript(page)+'</script><script>document.getElementById("screen").innerHTML=window.KaretaDiagnosticsPages.renderDiagnostics();requestAnimationFrame(()=>{document.body.dataset.overflow=document.documentElement.scrollWidth>innerWidth?"FAIL":"PASS";document.title="VISUAL_"+document.body.dataset.overflow+"_"+innerWidth})</script></body></html>';
fs.mkdirSync(path.dirname(target),{recursive:true});
fs.writeFileSync(target,html,'utf8');
console.log('DIAGNOSTICS_VISUAL_FIXTURE='+target);
