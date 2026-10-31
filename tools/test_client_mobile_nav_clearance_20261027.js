'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const files=[
 'css/next/client_surface_layout.css',
 'css/routes/client_guard_postlude.css',
 'css/runtime_boot_bundle.css'
];
const expectedMargin='margin-bottom: var(--k-client-page-bottom-gap, 43px) !important;';
const mobileContract=/@media\s*\(max-width:\s*767px\)\s*\{\s*html\[data-user-role="client"\]\s*\{\s*--k-client-page-bottom-gap:\s*0px;/;
for(const file of files){
 const content=fs.readFileSync(path.join(root,file),'utf8');
 assert.ok(content.includes(expectedMargin),file+' must use the canonical client margin variable');
 assert.ok(mobileContract.test(content),file+' must set mobile-only gap to zero for client');
 assert.ok(!content.includes('margin-bottom: 43px !important;'),file+' still hardcodes the duplicate bottom gap');
 assert.equal((content.match(/--k-client-page-bottom-gap:\s*0px;/g)||[]).length,1,file+' has repeated footer rules');
}
const source=fs.readFileSync(path.join(root,files[0]),'utf8');
assert.ok(source.includes('--k-client-page-gutter'),'source still owns only client geometry');
assert.ok(!mobileContract.test(source.replaceAll('html[data-user-role="client"]','html[data-user-role="master"]')),'master must not receive client footer');
console.log('PASS client mobile nav gap: source and both bundles match; desktop fallback 43px; master excluded');
