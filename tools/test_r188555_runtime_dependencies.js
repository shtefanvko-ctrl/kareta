'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

function registryOrder(){
  const source=read('inc/asset_registry.php');
  const chain=[
    'js/next/runtime_logger.js','js/next/runtime_dependencies.js','js/next/route_registry.js',
    'js/next/dynamic_navigation.js','js/next/role_access.js','js/next/context_manager.js',
    'js/next/navigation_core.js','js/next/shell_nav.js','js/next/shell_menu.js',
    'js/next/route_lifecycle.js','js/next/route_runtime.js','js/next/route_asset_loader.js','js/next/app_next.js'
  ];
  let previous=-1;
  for(const asset of chain){
    const index=source.indexOf(`'${asset}'`);
    assert(index>=0,`asset missing from registry: ${asset}`);
    assert(index>previous,`invalid runtime order near ${asset}`);
    previous=index;
  }
  assert(source.includes('data-kareta-script-order'),'script order marker missing');
  assert(source.includes('data-kareta-release'),'script release marker missing');
}

function deferredModule(file,expectedName,missingNames){
  const calls=[];
  const document={currentScript:{src:`https://kareta.kz/${file}?v=test`}};
  const window={
    KaretaRuntimeDependencies:{
      missing:dependencies=>dependencies.filter(name=>missingNames.includes(name)),
      deferScript:(name,dependencies,source)=>{calls.push({name,dependencies,source});return true;},
    },
  };
  vm.runInNewContext(read(file),{window,document},{filename:file});
  assert(calls.length===1,`${file} did not defer exactly once`);
  assert(calls[0].name===expectedName,`${file} deferred as ${calls[0].name}`);
  assert(calls[0].source.includes(file),`${file} lost its retry URL`);
}

function dependencyCoordinator(){
  const release='20260806-r188555-runtime-dependency-bootstrap';
  const listeners={};
  const scripts=[
    {src:`https://kareta.kz/js/next/runtime_logger.js?v=${release}`,dataset:{karetaRelease:release,karetaScriptOrder:'0'}},
    {src:`https://kareta.kz/js/next/runtime_dependencies.js?v=${release}`,dataset:{karetaRelease:release,karetaScriptOrder:'1'}},
    {src:`https://kareta.kz/js/next/app_next.js?v=${release}`,dataset:{karetaRelease:release,karetaScriptOrder:'109'}},
  ];
  const document={
    documentElement:{dataset:{}},
    querySelectorAll:()=>scripts,
    createElement:()=>({dataset:{},addEventListener(){}}),
    head:{appendChild(){}},
  };
  const location={href:'https://kareta.kz/#/home',replace(){throw new Error('unexpected recovery');}};
  const window={
    KARETA_NEXT_ASSET_VERSION:release,
    addEventListener:(name,handler)=>{listeners[name]=handler;},
    dispatchEvent(){return true;},
    setTimeout(){return 1;},
  };
  const sandbox={window,document,location,URL,Date,Map,Set,Object,String,Number,Boolean,Array,CustomEvent:class{},sessionStorage:{getItem:()=>null,setItem(){}},navigator:{},caches:{keys:async()=>[]}};
  vm.runInNewContext(read('js/next/runtime_dependencies.js'),sandbox,{filename:'runtime_dependencies.js'});
  assert(window.KaretaRuntimeDependencies,'dependency coordinator was not exported');
  assert(window.KaretaRuntimeDependencies.missing(['KaretaRuntimeDependencies','MissingGlobal']).join(',')==='MissingGlobal','missing dependency detector is invalid');
  assert(window.KaretaRuntimeDependencies.auditDocument()===true,'valid release audit failed');
  const snapshot=window.KaretaRuntimeDependencies.snapshot();
  assert(snapshot.release===release&&snapshot.mixedVersions.length===1,'release snapshot is invalid');
}

function appContracts(){
  const app=read('js/next/app_next.js');
  const renderers=app.indexOf('const PAGE_RENDERERS');
  for(const module of ['KaretaIdentityMigrationPages','KaretaAdminWorkspacePages','KaretaShellNav','KaretaShellMenu','KaretaRouteAssetLoader']){
    assert(app.indexOf(`'${module}'`)>0,`app binding/dependency misses ${module}`);
  }
  assert(app.includes("identityMigration:{global:'KaretaIdentityMigrationPages'"),'identity migration must be late-bound');
  assert(app.includes("adminUsers:{global:'KaretaAdminWorkspacePages'"),'admin workspace must be late-bound');
  const deps=(app.match(/const APP_DEPENDENCIES=\[([\s\S]*?)\];/)||[])[1]||'';
  assert(!deps.includes('KaretaIdentityMigrationPages')&&!deps.includes('KaretaAdminWorkspacePages'),'lazy admin modules remained eager app dependencies');
  const feed=read('js/next/pages/work_feed.js');
  assert(feed.includes('const communityPages=()=>window.KaretaCommunityPages'),'community module is still captured before loading');
  const index=read('index.php');
  for(const marker of ['asset_manifest.php?runtime_probe','release_mismatch','runtime_modules_incomplete','X-Kareta-Asset-Version'])assert(index.includes(marker),`index recovery marker missing: ${marker}`);
}

registryOrder();
deferredModule('js/next/shell_nav.js','shell_nav',['KaretaDynamicNavigation']);
deferredModule('js/next/shell_menu.js','shell_menu',['KaretaDynamicNavigation']);
deferredModule('js/next/route_runtime.js','route_runtime',['KaretaRouteLifecycle']);
deferredModule('js/next/app_next.js','app_next',['KaretaRouteAssetLoader']);
dependencyCoordinator();
appContracts();
console.log('R188.5.5.5 runtime dependency bootstrap tests OK');
