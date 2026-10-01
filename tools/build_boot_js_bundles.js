'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const groups=Object.freeze({
  'js/boot/runtime_onboarding_bundle.js':[
    'js/next/welcome_background.js','js/next/error_403_background.js','js/next/onboarding/onboarding_state.js','js/next/onboarding/onboarding_profile_draft.js','js/next/onboarding/onboarding_router.js','js/next/onboarding/onboarding_navigation.js','js/next/onboarding/onboarding_api.js','js/next/onboarding/post_auth_first_entry_resolver.js','js/next/onboarding/onboarding_app.js','js/next/onboarding/onboarding_phone_runtime.js','js/next/onboarding/onboarding_form_ui.js','js/next/onboarding/onboarding_form_validation.js','js/next/kflow_windows.js','js/next/onboarding/pages/role_definitions.js','js/next/onboarding/onboarding_selection_catalog.js','js/next/onboarding/pages/role_page.js','js/next/onboarding/pages/client_profile_page.js','js/next/onboarding/pages/master_profile_page.js','js/next/onboarding/pages/service_profile_page.js','js/next/onboarding/pages/seller_profile_page.js','js/next/onboarding/pages/profile_registry.js','js/next/onboarding/onboarding_lifecycle.js','js/next/onboarding_bridge.js'
  ],
  'js/boot/runtime_identity_bundle.js':[
    'js/next/route_registry.js','js/next/production_guard.js','js/next/identity_frontend.js','js/next/master_onboarding_gate.js','js/next/dynamic_navigation.js','js/next/role_access.js','js/next/context_manager.js','js/next/ui_icons.js','js/next/visual_assets.js','js/next/reference_client_shell.js'
  ],
  'js/boot/runtime_shell_bundle.js':[
    'js/next/navigation_core.js','js/next/shell_nav.js','js/next/shell_menu.js','js/next/route_lifecycle.js','js/next/route_runtime.js','js/next/route_asset_loader.js','js/next/dashboard_engine.js','js/next/dashboard_widgets.js','js/next/smart_action_hub.js','js/next/navigation_state.js','js/next/mobile_back.js','js/next/mobile_filters.js','js/next/session_resume_runtime.js'
  ],
  'js/boot/runtime_ui_bundle.js':[
    'js/next/page_ui.js','js/next/catalog_cards.js','js/next/social_cards.js','js/next/workflow_engine.js','js/next/core/ui_kit.js','js/next/api_client.js','js/next/core/realtime_client.js','js/next/social_state.js','js/next/runtime_integrity.js','js/next/toast.js','js/next/native_dialogs.js','js/next/swiper_loader.js','js/next/slider_runtime.js'
  ],
  'js/boot/runtime_core_bundle.js':[
    'js/next/pages/core.js','js/next/request_window.js','js/next/client/client_cabinet_api.js','js/next/client/first_vehicle_flow.js','js/next/window_engine.js','js/next/client_viewport_runtime.js','js/next/client_surface_modernization_phase3.js'
  ]
});
function build(target,sources){
  const bundleName=path.basename(target,'.js');
  const chunks=[
    '/* KARETA R188.5.5.6.84.85 GENERATED BOOT BUNDLE — source order preserved. */\n',
    `window.KaretaBootProfiler?.bundleStart?.(${JSON.stringify(bundleName)},${JSON.stringify(target)});\n`
  ];
  for(const src of sources){
    const text=fs.readFileSync(path.join(root,src),'utf8').trimEnd();
    chunks.push(`\n/* SOURCE: ${src} */\n${text}\n;\n`);
  }
  chunks.push(`\nwindow.KaretaBootProfiler?.bundleEnd?.(${JSON.stringify(bundleName)});\n`);
  return chunks.join('');
}
let stale=0;
for(const [target,sources] of Object.entries(groups)){
  const expected=build(target,sources), full=path.join(root,target);
  if(process.argv.includes('--check')){
    const actual=fs.existsSync(full)?fs.readFileSync(full,'utf8'):'';
    if(actual!==expected){console.error(`STALE ${target}`);stale+=1;}
  }else{
    fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,expected);console.log(`built ${target} (${Buffer.byteLength(expected)} bytes)`);
  }
}
if(stale)process.exit(1);
if(process.argv.includes('--check'))console.log(`boot JS bundles fresh: ${Object.keys(groups).length}`);
