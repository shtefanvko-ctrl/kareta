const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const expect=(cond,msg)=>{if(!cond)throw new Error(msg);};

const page=read('js/next/pages/master_onboarding.js');
const css=read('css/next/master_onboarding.css');
const api=read('api/master_onboarding.php');
const gate=read('js/next/master_onboarding_gate.js');
const caps=read('api/identity/capability_service.php');
const route=read('js/next/route_registry.js');
const onboarding=read('js/next/onboarding/onboarding_app.js');
const postAuth=read('js/next/onboarding/post_auth_first_entry_resolver.js');
const nav=read('js/next/navigation_core.js');
const roleAccess=read('js/next/role_access.js');
const shell=read('js/next/shell_nav.js');

// Exactly four blocking parent steps and no work navigation inside the flow.
for(const text of ['Расскажите о себе','Выберите услуги','Где вы работаете?','Проверьте профиль']) expect(page.includes(text),`missing parent step: ${text}`);
expect(page.includes('[1,2,3,4]') && !page.includes('[1,2,3,4,5]'),'stepper must stay 1..4');
expect(css.includes('.k-master-onboarding-active #k-shell-header')&&css.includes('#k-mobile-nav')&&css.includes('#k-desktop-nav'),'working shell/nav must be hidden during blocking onboarding');
expect(css.includes('font-family:Manrope')&&css.includes('.kmo-stepper span{width:28px;height:28px'),'K-Flow typography/28px step token missing');
expect(css.includes('.kmo-control{')&&css.includes('min-height:50px')&&css.includes('.kmo-primary{')&&css.includes('height:52px'),'50px fields / 52px CTA contract missing');
expect(css.includes('@media (min-width:600px)')&&css.includes('@media (min-width:900px)')&&css.includes('@media (min-width:1024px)')&&css.includes('@media (max-width:359px)'),'phone/tablet/desktop breakpoints missing');
expect(css.includes('1180px')&&css.includes('560px')&&css.includes('@media (prefers-reduced-motion:reduce)'),'desktop bounds/reduced-motion contract missing');
expect(route.includes("masterOnboarding:Object.freeze({ path:'#/onboarding/master'"),'master onboarding route missing');
expect(onboarding.includes('KaretaPostAuthFirstEntryResolver?.resolve?.')&&postAuth.includes("selectedRole==='master'")&&postAuth.includes("#/onboarding/master?step=1&view=master-profile"),'MASTER context-aware role handoff missing');
const masterMenu="['masterDashboard','masterExchange','serviceManagement','parts','cabinet','__more__']";
expect(nav.includes(`master: Object.freeze(${masterMenu})`)&&roleAccess.includes(`mobile:${masterMenu}`),'completed MASTER mobile menu must be six surfaces');
expect(nav.includes("['personal','master','seller','admin','organization_store'].includes(kind) ? 6 : 5"),'MASTER mobile limit must be six');
expect(shell.includes("master:{masterDashboard:'Рабочее место'") && shell.includes("kind==='master'&&key==='masterDashboard'&&surface==='mobile'?'Главная'")&&shell.includes("serviceManagement:'Услуги'")&&shell.includes("cabinet:'Аккаунт'"),'MASTER mobile labels must match spec');

// Draft restoration and nested windows.
for(const token of ['viewState:{modal:null,temp:null}','mergeConflict(local,remote)','model.savePending=true','if(model.savePending)persist(0)','window.addEventListener(\'pageshow\'','window.addEventListener(\'popstate\'']) expect(page.includes(token),`draft/restore contract missing: ${token}`);
expect(api.includes("if(array_key_exists('services',$draft)&&is_array($draft['services']))$merged['services']=array_values($draft['services'])"),'server draft must replace service list exactly');
expect(api.includes("$merged['workLocation']['serviceArea']['districtIds']=array_values($draft['workLocation']['serviceArea']['districtIds'])"),'district list exact restore missing');

// Service catalog/filter semantics: category is UI filter, primary specialization is changed only from specialization picker.
expect(page.includes('searchTimer=setTimeout(()=>loadCatalog')&&page.includes(')),300);'),'service search debounce must be 300ms');
expect(page.includes('new AbortController()')&&page.includes('catalogController.abort()'),'service search cancellation missing');
expect(api.includes("$action==='servicesCatalog'")&&api.includes("$_GET['category']")&&api.includes('array_slice($rows,$offset,$limit)'),'server service search/filter/pagination missing');
const categoryHandler=page.match(/querySelectorAll\('\[data-kmo-category\]'\)[\s\S]{0,450}/)?.[0]||'';
expect(categoryHandler.includes('model.categoryFilter=')&&!categoryHandler.includes('primarySpecializationId'),'category chips must not mutate primary specialization');
expect(page.includes('aria-pressed="${selected?\'true\':\'false\'}"'),'service multiselect selected semantics missing');

// Work modes / price modes and privacy.
expect(page.includes('type="radio" name="kmo-work-mode"')&&page.includes('type="radio" name="kmo-price-mode"'),'work mode and price mode must use native radio controls');
for(const mode of ['mobile','fixed','both']) expect(page.includes(`workModeCard('${mode}'`),`missing work mode ${mode}`);
expect(api.includes("$activeAddress=in_array($mode,['fixed','both'],true)")&&api.includes("$activeRadius=in_array($mode,['mobile','both'],true)"),'inactive address/radius must not be published');
expect(api.includes('kmob_resolve_organization_location'),'organization workplace ownership check missing');
expect(api.includes('city_confirmation_required')&&page.includes('cityConfirmed'),'city confirmation contract missing');

// Review edit returns directly to review; complete is revision-aware and idempotent with status recovery.
expect(page.includes("model.draft.returnTarget==='review'")&&page.includes('model.draft.currentStep=4'),'review edit return path missing');
expect(page.includes('recoverCompletion()')&&page.includes("action:'status',idempotencyKey:model.draft.idempotencyKey"),'unknown-result status recovery missing');
expect(page.includes('expectedRevision:model.revision'),'complete expectedRevision missing on client');
expect(api.includes('FOR UPDATE')&&api.includes("$action==='status'")&&api.includes('draft_revision_conflict'),'server revision/idempotency recovery missing');
expect(api.includes('KMOB_TERMS_VERSION')&&api.includes("terms_version_invalid"),'versioned agreement missing');

// Server validates identity context and catalog, filters direct contacts, and fails closed on capability-state errors.
expect(api.includes('master_context_required')&&api.includes('profileId')&&api.includes('personId'),'MASTER context identity validation missing');
expect(api.includes('kmob_catalog_snapshot')&&api.includes('service_not_found')&&api.includes('specialization_invalid'),'server catalog validation missing');
expect(api.includes('whatsapp|telegram')&&api.includes('(?:[\\s().-]*\\d){7,14}'),'direct-contact filtering missing');
expect(api.includes("'moderationStatus'=>'pending'"),'custom services must be normalized into pending moderation server-side');
expect(api.includes('getimagesizefromstring')&&api.includes('strlen($bytes)>1500000'),'avatar upload must validate decoded bytes and actual image MIME');
expect(caps.includes('master_onboarding_guard:state_lookup_failed')&&caps.includes("'master.onboarding.complete'=>true"),'MASTER capability guard must fail closed');

// Session recovery and accessible error/radio controls.
expect(page.includes("new CustomEvent('kareta:session-expired'")&&page.includes("source:'master-onboarding'"),'session-expiry recovery event missing');
expect(page.includes('aria-invalid="true" aria-describedby=')&&css.includes('.kmo-field-error'),'field error accessibility missing');
expect(css.includes('.kmo-native-choice')&&css.includes('.kmo-mode-card:focus-within'),'native radio focus styling missing');
for(const event of ['master_onboarding_opened','master_onboarding_step_viewed','master_onboarding_profile_validated','master_onboarding_service_added','master_onboarding_service_removed','master_onboarding_work_mode_selected','master_onboarding_city_selected','master_onboarding_validation_failed','master_onboarding_submit_started','master_onboarding_completed','master_onboarding_submit_failed','master_onboarding_draft_restored']) expect(page.includes(event),`analytics event missing: ${event}`);

// Regression guards inherited from role-selection contract.
expect(!page.includes('k-flow-role-direction'),'MASTER first-entry must not reintroduce role-direction UI');
expect(!page.includes('k-flow-direction-button'),'MASTER first-entry must not reintroduce direction buttons');

console.log('MASTER First Entry FULL SPEC 1.0 / 84.21 contract OK');
