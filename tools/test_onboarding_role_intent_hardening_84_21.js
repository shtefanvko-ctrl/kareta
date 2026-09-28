const fs=require('fs');const path=require('path');const assert=require('assert');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const role=read('js/next/onboarding/pages/role_page.js');
const app=read('js/next/onboarding/onboarding_app.js');
const lifecycle=read('js/next/onboarding/onboarding_lifecycle.js');
const state=read('js/next/onboarding/onboarding_state.js');
const boot=read('js/next/app_next.js');
const version=read('inc/asset_version.php');

assert(!role.includes('k-flow-role-direction'),'role direction blocks must stay removed');
assert(!role.includes('k-flow-direction-button'),'external role direction buttons must stay removed');
assert(role.includes('roleIntent:role, roleIntentLocked:true'),'explicit role choice must lock role intent');
assert(app.includes("synchronizeSession(result, flow, { emit:false })"),'new-account finalize must defer session-confirmed');
assert(app.includes('const activation = await activateEntryRole(desiredRole, flow);'),'new-account finalize must activate selected Identity context');
assert(app.includes("emitSessionConfirmed(user, result, activation?.identity || null)"),'session-confirmed must happen after Identity activation');
assert(app.includes("flow?.roleIntentLocked === true"),'confirmed user must respect explicit role intent');
assert(lifecycle.includes('onboarding.session_confirmed_role_mismatch_ignored'),'lifecycle must reject mismatched early role confirmation');
assert(lifecycle.includes('confirmedRole !== expectedRole'),'mismatched session-confirmed guard missing');
assert(state.includes('roleIntentLocked:false'),'role intent lock must be released after confirmed completion');
assert(boot.includes('generalOnboardingOwnsRoute()'),'app boot must detect general onboarding ownership');
assert(boot.includes("if (!onboardingOwnsRoute) {\n        routeRuntime.transition"),'business route must not mount under general onboarding');
assert(boot.includes("outlet.innerHTML=''"),'business outlet must be cleared while onboarding owns route');
assert(/188\.5\.5\.6\.84\.(2[3-9]|[3-9]\d|\d{3,})/.test(version),'84.23+ version missing');

console.log('KARETA onboarding role intent hardening 84.21: OK');
