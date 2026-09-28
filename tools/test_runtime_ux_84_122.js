'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const expect=(v,m)=>{if(!v)throw new Error(m)};
const db=read('api/db.php');
const chats=read('js/next/pages/chats.js');
const profile=read('js/next/pages/master_profile_owner.js');
const cabinet=read('js/next/pages/cabinet.js');
const nav=read('js/next/dynamic_navigation.js');
const navCore=read('js/next/navigation_core.js');
const pageUi=read('js/next/page_ui.js');
const request=read('js/next/pages/request.js');
const details=read('js/next/pages/details.js');
const messaging=read('api/messaging_core.php');
const asset=read('inc/asset_version.php');
const sw=read('sw.js');

expect(db.includes("$identityLegacy = is_array($actor['legacyUser'] ?? null)"),'chat actor does not use Identity legacyUser');
expect(db.includes("$userId=(int)($effectiveUser['id'] ?? $legacy['id'] ?? 0)"),'chat actor user id resolver missing');
expect(db.includes('SELECT id FROM users WHERE active=1 AND RIGHT('),'chat actor phone-to-users fallback missing');
expect(db.includes("'userId'=>$userId"),'resolved chat actor id not returned');
expect(db.includes("$actorId=(int)($chatActor['userId'] ?? 0)"),'chat markRead still bypasses unified actor');
expect(db.includes("$viewerId=(int)($viewerActor['userId'] ?? 0)"),'messages viewer still bypasses unified actor');
expect(db.includes("$actorUserId = (int)($chatActor['userId'] ?? 0)"),'message add actor id missing');
expect(db.split('#/chats?chatId=').length-1>=7,'message notifications do not deep-link to exact chat');

expect(chats.includes('const target=requestedChatTarget()'),'chat deep-link parser not used');
expect(chats.includes('await openChat(target.chatId)'),'chatId deep-link does not open conversation');
expect(chats.includes("sessionStorage.getItem('kareta.chat.open')"),'order-to-chat handoff missing');

expect(profile.includes('view(response.payload?.data||response.payload||response.data||{})'),'Master profile first-load payload fix missing');
expect(cabinet.includes("'api/db.php?action=masterWorkplace.get'"),'Master cabinet still calls action name instead of API URL');
expect(!details.includes('const location=['),'provider SPA still shadows window.location');
expect(details.includes('const providerLocation=[')&&details.includes('esc(providerLocation)'),'provider location rename missing');

expect(pageUi.includes('const chromeHeader = opts.chromeHeader !== false'),'page shell chromeless contract missing');
for(const f of ['js/next/pages/chats.js','js/next/pages/orders.js','js/next/pages/services.js','js/next/pages/workflow.js','js/next/pages/work_order.js','js/next/pages/service_management.js']) expect(read(f).includes('chromeHeader:false'),'redundant app chrome still enabled in '+f);
expect(request.includes('chromeHeader:false'),'staff request page chrome still duplicated');

expect(nav.includes("masterAny:['work_orders.read']"),'Master services navigation recovery missing');
expect(nav.includes('...(masterProfile?(item.masterAny||[]):[])'),'masterAny is not scoped to Master profile');
expect(nav.includes("any:['chats.use']"),'Chats capability contract was broadened unexpectedly');
expect(nav.includes("masterAny:['profile.edit_own','profile.master']"),'Master account navigation recovery missing');
expect(navCore.includes("const wantsMore = preferred.includes('__more__')")&&navCore.includes("if (key === '__more__') continue")&&navCore.includes("result.push('__more__')"),'mobile More-last contract missing');

expect(request.includes('flowSteps=isMaster?[0,2,3,4]:[0,1,2,3,4]'),'Master self-booking 4-step flow missing');
expect(request.includes('const REQUEST_FLOW_VERSION=9'),'request flow version 9 missing');
expect(request.includes("${isMaster?'':"),'Master location UI conditional missing');
expect(request.includes('fieldService:isMaster?false'),'Master self-booking can still request field service');
expect(request.includes("address:isMaster?'':"),'Master self-booking still sends address');
expect(request.includes("masterId:isMaster?'':"),'Master self-booking can still override its executor');
expect(request.includes("source:role==='master'?'master_client_booking'"),'Master booking source missing');
expect(db.includes("if ($actorRole === 'master')"),'server Master self-assignment invariant missing');
expect(messaging.includes("'actionUrl'=>'#/chats?chatId='.rawurlencode($chatId)"),'external inbound chat notification is not deep-linked');
expect(messaging.includes("$chatUrl=trim((string)($payload['chatUrl']??''));if($chatUrl!=='')$text.=\"\\n\".$chatUrl;"),'WhatsApp chat delivery does not include exact chat URL');
expect(messaging.includes("'Открыть чат KARETA'" )&&messaging.includes('kareta_messaging_chat_url($karetaChatId)'),'Telegram chat delivery button missing');
expect(db.includes("$eventType !== 'message.new' && function_exists('kareta_messaging_enqueue_notification')"),'message.new notification still duplicates external delivery');

const va=(asset.match(/KARETA_ASSET_VERSION[^']*'([^']+)'/)||[])[1];
const vs=(sw.match(/const RELEASE = '([^']+)'/)||[])[1];
expect(va==='188.5.5.6.84.122','asset version not 84.122');
expect(va===vs,'asset/service worker mismatch');
console.log('RUNTIME_UX_84_122: PASS chats=identity deepLink=chat messaging=telegram+whatsapp profile=payload cabinet=url chrome=trimmed masterBooking=4step nav=restored');
