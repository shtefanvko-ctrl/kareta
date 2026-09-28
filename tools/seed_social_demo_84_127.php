<?php
declare(strict_types=1);
require __DIR__.'/../api/bootstrap.php';
require_once __DIR__.'/../api/master_social_wall.php';
require_once __DIR__.'/../api/community_posts.php';
$pdo=kareta_pdo();
if(!$pdo) throw new RuntimeException('Database unavailable');
kareta_master_wall_social_ensure($pdo);
kareta_community_posts_ensure($pdo);
kareta_community_groups_ensure($pdo);

function dscalar(PDO $pdo,string $sql,array $args=[]): mixed {$q=$pdo->prepare($sql);$q->execute($args);return $q->fetchColumn();}
function dini(string $name): string {$p=preg_split('/\s+/u',trim($name))?:[];$o='';foreach(array_slice($p,0,2) as $x)$o.=mb_strtoupper(mb_substr($x,0,1));return $o?:'K';}

$defs=[
 ['+77007770101','Андрей Ковалёв','client','Nissan Sunny 2003',''],
 ['+77007770102','Алия Серикова','client','Toyota Camry 50',''],
 ['+77007770103','Дмитрий Орлов','client','Lexus IS250 2009',''],
 ['+77007770104','Мария Волкова','client','Kia Sorento 2014',''],
 ['+77007770105','Руслан Нуртаев','master','','Диагностика и автоэлектрика'],
 ['+77007770106','Артём Соколов','master','','Ходовая и тормоза'],
 ['+77007770107','Ерлан Касымов','master','','Двигатель и топливная'],
 ['+77007770108','Garage East','sto','','СТО полного цикла'],
 ['+77007770109','MotorLab VKO','sto','','Диагностика и моторный ремонт'],
 ['+77007770110','AutoParts VKO','seller','','Магазин запчастей'],
];

$groups=[
 ['demo84_127_group_01','CITY','Авто Усть-Каменогорск','УК','Усть-Каменогорск','','Городское сообщество автомобилистов: дороги, сервисы, помощь и встречи.',42],
 ['demo84_127_group_02','SERVICE','Диагностика и автоэлектрика','OBD','Усть-Каменогорск','','Ошибки, сканеры, электрика, проводка и поиск неисправностей.',31],
 ['demo84_127_group_03','CAR_MODEL','Toyota Camry Club VKO','TC','Усть-Каменогорск','Toyota Camry','Camry 40/50/55/70: обслуживание, ремонт и опыт владельцев.',28],
 ['demo84_127_group_04','CAR_MODEL','Lexus IS / GS East','LX','Усть-Каменогорск','Lexus','Lexus IS и GS: моторы, топливная система, подвеска и электрика.',19],
 ['demo84_127_group_05','CAR_MODEL','Nissan Sunny Казахстан','NS','','Nissan Sunny','Sunny и Almera: эксплуатация, ремонт, запчасти и взаимопомощь.',24],
 ['demo84_127_group_06','SERVICE','Ходовая и тормоза','ABS','Усть-Каменогорск','','Подвеска, ступицы, тормоза, рулевое и вибрации.',26],
 ['demo84_127_group_07','SERVICE','Двигатель и топливная','ENG','Усть-Каменогорск','','ДВС, ТНВД, форсунки, зажигание, компрессия и расход топлива.',35],
 ['demo84_127_group_08','PARTS','Запчасти VKO','ZIP','Усть-Каменогорск','','Поиск номеров, аналоги, совместимость и наличие запчастей.',37],
 ['demo84_127_group_09','SERVICE','Гаражные проекты','DIY','','','Ремонт своими руками, инструмент, приспособления и проекты.',22],
 ['demo84_127_group_10','CITY','Помощь на дороге VKO','SOS','Усть-Каменогорск','','Взаимопомощь на дороге, запуск, колесо, эвакуатор и мелкий ремонт.',46],
];

$pdo->beginTransaction();
try{
 $step='users';
 $actors=[];
 foreach($defs as $i=>$d){
  [$phone,$name,$role,$car,$spec]=$d;$ini=dini($name);
  $q=$pdo->prepare("INSERT INTO users(phone,name,role,entry_role,onboarding_stage,onboarded,onboarded_at,country_code,city,initials,car,spec,email,active)
   VALUES(?,?,?,?,'completed',1,NOW(),'KZ','Усть-Каменогорск',?,?,?, ?,1)
   ON DUPLICATE KEY UPDATE name=VALUES(name),role=VALUES(role),entry_role=VALUES(entry_role),onboarding_stage='completed',onboarded=1,onboarded_at=NOW(),city=VALUES(city),initials=VALUES(initials),car=VALUES(car),spec=VALUES(spec),active=1");
  $q->execute([$phone,$name,$role,$role,$ini,$car,$spec,'demo'.($i+1).'@kareta.local']);
  $uid=(int)dscalar($pdo,"SELECT id FROM users WHERE phone=?",[$phone]);
  $pdo->prepare("INSERT INTO accounts(phone,status) VALUES(?,'active') ON DUPLICATE KEY UPDATE status='active'")->execute([$phone]);
  $aid=(int)dscalar($pdo,"SELECT id FROM accounts WHERE phone=?",[$phone]);
  $pdo->prepare("INSERT INTO persons(account_id,fullname,locale,timezone) VALUES(?,?,'ru-KZ','Asia/Almaty') ON DUPLICATE KEY UPDATE fullname=VALUES(fullname)")->execute([$aid,$name]);
  $pid=(int)dscalar($pdo,"SELECT id FROM persons WHERE account_id=?",[$aid]);
  $ptype=strtoupper($role);
  $legacyType=$role==='master'?'master':($role==='sto'?'sto':($role==='seller'?'seller':'client'));
  $pdo->prepare("INSERT INTO person_profiles(person_id,profile_type,status,legacy_entity_type,payload_json) VALUES(?,?,'active',?,JSON_OBJECT('seed','demo84_127')) ON DUPLICATE KEY UPDATE status='active',legacy_entity_type=VALUES(legacy_entity_type),payload_json=VALUES(payload_json)")->execute([$pid,$ptype,$legacyType]);
  $ppid=(int)dscalar($pdo,"SELECT id FROM person_profiles WHERE person_id=? AND profile_type=?",[$pid,$ptype]);
  $ctx='profile:'.$role.':'.$ppid;
  $pdo->prepare("INSERT INTO contexts(context_key,context_type,account_id,person_id,profile_id,status) VALUES(?,'profile',?,?,?,'active') ON DUPLICATE KEY UPDATE account_id=VALUES(account_id),person_id=VALUES(person_id),profile_id=VALUES(profile_id),status='active'")->execute([$ctx,$aid,$pid,$ppid]);
  $cid=(int)dscalar($pdo,"SELECT id FROM contexts WHERE context_key=?",[$ctx]);
  $pdo->prepare("INSERT INTO context_members(context_id,account_id,person_id,membership_status) VALUES(?,?,?,'active') ON DUPLICATE KEY UPDATE person_id=VALUES(person_id),membership_status='active'")->execute([$cid,$aid,$pid]);
  $entity='';
  if($role==='client'){
   $entity='demo84_127_client_'.str_pad((string)($i+1),2,'0',STR_PAD_LEFT);
   $pdo->prepare("INSERT INTO clients(id,user_id,user_phone,name,phone,car,notes,orders_count,total_spent,created_at) VALUES(?,?,?,?,?,?,?,0,0,CURDATE()) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id),name=VALUES(name),phone=VALUES(phone),car=VALUES(car),notes=VALUES(notes)")->execute([$entity,$uid,$phone,$name,$phone,$car,'Demo social seed .127']);
  }elseif($role==='master'){
   $entity='demo127_master_'.str_pad((string)($i-3),2,'0',STR_PAD_LEFT);
   $pdo->prepare("INSERT INTO masters(id,user_id,user_phone,name,phone,initials,color,spec,city,experience_label,offer_text,work_mode,availability,profile_visible,active,rating,orders_count) VALUES(?,?,?,?,?,?,'#ff6a00',?,'Усть-Каменогорск','5+ лет','Помогу с диагностикой и ремонтом','independent','online',1,1,4.8,120) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id),name=VALUES(name),phone=VALUES(phone),initials=VALUES(initials),spec=VALUES(spec),city=VALUES(city),active=1")->execute([$entity,$uid,$phone,$name,$phone,$ini,$spec]);
  }elseif($role==='sto'){
   $entity='demo84_127_sto_'.str_pad((string)($i-6),2,'0',STR_PAD_LEFT);
   $pdo->prepare("INSERT INTO sto_profiles(id,user_id,user_phone,name,description,contact_phone,country_code,city,address,work_hours,primary_specialization,active,rating,orders_count) VALUES(?,?,?,?,?,?,'KZ','Усть-Каменогорск','ул. Казахстан, 100','09:00–19:00',?,1,4.8,240) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id),name=VALUES(name),description=VALUES(description),contact_phone=VALUES(contact_phone),primary_specialization=VALUES(primary_specialization),active=1")->execute([$entity,$uid,$phone,$name,'Demo СТО для тестирования',$phone,$spec]);
  }else{
   $pdo->prepare("INSERT INTO seller_profiles(user_id,user_phone,store_name,legal_name,bin_iin,contact_phone,email,country_code,city,warehouse_address,description,assortment,category_tags,delivery_modes,payment_methods,minimum_order,return_days,return_policy,moderation_status,active) VALUES(?,?,?,?,?,?,?,'KZ','Усть-Каменогорск','ул. Казахстан, 120','Demo магазин для тестирования','Запчасти и расходники',JSON_ARRAY('parts'),JSON_ARRAY('pickup','courier'),JSON_ARRAY('cash','card'),'0 ₸',14,'Возврат по правилам магазина','approved',1) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id),store_name=VALUES(store_name),description=VALUES(description),moderation_status='approved',active=1")->execute([$uid,$phone,$name,$name,'990000000127',$phone,'parts@kareta.local']);
   $entity='seller:'.$uid;
  }
  $pdo->prepare("UPDATE person_profiles SET legacy_entity_id=? WHERE id=?")->execute([$entity,$ppid]);
  $actors[]=['uid'=>$uid,'aid'=>$aid,'pid'=>$pid,'cid'=>$cid,'entity'=>$entity,'role'=>$role,'name'=>$name,'phone'=>$phone,'ini'=>$ini,'car'=>$car];
 }

 $step='groups';
 date_default_timezone_set('Asia/Almaty');
 $rules=json_encode(['Без спама','По теме сообщества','Уважать участников'],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
 foreach($groups as $n=>$g){
  [$gid,$gtype,$gname,$short,$city,$vehicle,$desc,$members]=$g;
  $pdo->prepare("INSERT INTO community_groups(id,group_type,name,short_label,city,vehicle,description,rules_json,members_count,active,sort_order) VALUES(?,?,?,?,?,?,?,?,?,1,?) ON DUPLICATE KEY UPDATE group_type=VALUES(group_type),name=VALUES(name),short_label=VALUES(short_label),city=VALUES(city),vehicle=VALUES(vehicle),description=VALUES(description),rules_json=VALUES(rules_json),members_count=VALUES(members_count),active=1,sort_order=VALUES(sort_order)")->execute([$gid,$gtype,$gname,$short,$city,$vehicle,$desc,$rules,$members,$n+1]);
  foreach($actors as $j=>$a){
   if((($j+$n)%3)!==0)continue;
   $memberRole=$j===4?'moderator':'member';
   $pdo->prepare("INSERT INTO community_group_members(group_id,user_id,member_role,active) VALUES(?,?,?,1) ON DUPLICATE KEY UPDATE member_role=VALUES(member_role),active=1")->execute([$gid,$a['uid'],$memberRole]);
  }
 }

 $questions=[
  ['На Nissan Sunny при включении вентиляторов растёт стрелка температуры','При включении вентиляторов напряжение меняется примерно на 0.3 В и одновременно чуть растёт указатель температуры. Массы проверил визуально. С чего начать замеры?','ELECTRICAL',4,0,'Nissan Sunny 2003'],
  ['Lexus IS250: ошибка P1235 и сопротивление клапана ТНВД','На IS250 периодически P1235. Клапан на ТНВД показывает около 1.4 Ом. Стоит ли сначала проверять питание и EDU или сразу менять клапан?','ENGINE',3,2,'Lexus IS250 2009'],
  ['Camry 50: вибрация после 90 км/ч','Колёса балансировал дважды, вибрация остаётся на руле после 90–100 км/ч. Какие точки ходовой проверить до замены деталей?','SUSPENSION',5,1,'Toyota Camry 50'],
  ['Sorento: щёлкает натяжитель на холодную','Первые 20–30 секунд после запуска слышен металлический щелчок со стороны ремня. После прогрева тише. Как отличить ролик от натяжителя?','ENGINE',6,3,'Kia Sorento 2014'],
  ['Где искать утечку тока 0.18 А?','После ночи аккумулятор заметно проседает. После закрытия авто ток покоя держится около 0.18 А. Как правильно искать цепь-потребитель?','ELECTRICAL',1,0,'Nissan Sunny 2003'],
  ['После замены колодок греется переднее колесо','Суппорт обслужен, направляющие смазаны, но через 10 км диск горячее второго. На что смотреть дальше?','BRAKES',5,1,'Toyota Camry 50'],
  ['Нестабильный холостой после чистки дросселя','После чистки дросселя обороты иногда зависают выше нормы. Нужна адаптация или искать подсос?','ENGINE',6,2,'Lexus IS250 2009'],
  ['Как проверить ступичный без подъёмника?','Есть гул на 60–80 км/ч, на поворотах меняется. Можно ли уверенно определить сторону без подъёмника?','SUSPENSION',5,3,'Kia Sorento 2014'],
  ['Подбор аналога датчика ABS','Оригинальный датчик долго ждать. Есть ли нормальный способ проверить совместимость аналога по сопротивлению и разъёму?','PARTS',7,1,'Toyota Camry 50'],
  ['Что взять для первой домашней диагностики?','Нужен базовый набор: мультиметр, ELM327, токовые клещи? Что реально полезно для начинающего?','DIY',8,0,'Nissan Sunny 2003'],
 ];
 $posts=[
  ['Проверили падение напряжения на массе Sunny','На прогретой машине сравнили напряжение между минусом АКБ, кузовом и двигателем под нагрузкой. Плохая масса сразу проявилась при включении вентиляторов.','ELECTRICAL',1,4,'Nissan Sunny'],
  ['Camry после обслуживания тормозов','Почистили скобу, проверили пыльники, направляющие и равномерность возврата поршня. После контрольной поездки температура дисков сравнялась.','BRAKES',5,5,'Toyota Camry 50'],
  ['Диагностика Lexus по P1235','Перед заменой деталей проверили питание, проводку до ТНВД и сигналы управления. Такой порядок сильно сокращает лишние замены.','ENGINE',3,6,'Lexus IS250'],
  ['Свободное окно на диагностику завтра','Garage East открыл два окна на комплексную диагностику. Можно обсудить симптомы в сообществе до записи.','SERVICE',0,7,''],
  ['Как не покупать запчасть дважды','Сверяйте OEM, VIN-применимость и фактический разъём. Фото старой детали часто помогает быстрее любого описания.','PARTS',7,9,''],
  ['Разобрали причину гула ступицы','Гул менялся в длинном повороте, но окончательно подтвердили только после вывешивания и сравнения обеих сторон.','SUSPENSION',5,5,'Kia Sorento'],
  ['Мини-чек перед дальней поездкой','Давление шин, жидкости, заряд АКБ, свет, запаска и базовый инструмент — быстрый список перед трассой.','TRAVEL',0,8,''],
  ['Почему важно писать, что уже проверяли','В вопросах по ремонту указывайте симптомы, ошибки, сделанные замеры и недавние работы. Так ответы становятся намного точнее.','COMMUNITY',1,4,''],
  ['Новый приход расходников','В наличии фильтры, свечи и тормозные расходники для популярных Toyota, Lexus, Nissan и Kia.','PARTS',7,9,''],
  ['Итоги вечерней взаимопомощи','Участники помогли запустить автомобиль с разряженным аккумулятором и подсказали ближайший сервис.','SOS',9,7,''],
 ];

 $step='posts';
 $postSql=$pdo->prepare("INSERT INTO community_posts(id,author_account_id,author_person_id,author_user_id,author_context_id,author_entity_id,author_role,author_name,post_type,group_id,title,text,category,city,vehicle_label,comments_enabled,visibility,active,published_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,'public',1,?,?) ON DUPLICATE KEY UPDATE author_account_id=VALUES(author_account_id),author_person_id=VALUES(author_person_id),author_user_id=VALUES(author_user_id),author_context_id=VALUES(author_context_id),author_entity_id=VALUES(author_entity_id),author_role=VALUES(author_role),author_name=VALUES(author_name),post_type=VALUES(post_type),group_id=VALUES(group_id),title=VALUES(title),text=VALUES(text),category=VALUES(category),city=VALUES(city),vehicle_label=VALUES(vehicle_label),comments_enabled=1,visibility='public',active=1,published_at=VALUES(published_at)");
 foreach($questions as $i=>$x){
  [$title,$body,$cat,$gidx,$aidx,$vehicle]=$x;$a=$actors[$aidx];$id='demo84_127_question_'.str_pad((string)($i+1),2,'0',STR_PAD_LEFT);$dt=date('Y-m-d H:i:s',time()-(($i+1)*1900));
  $postSql->execute([$id,$a['aid'],$a['pid'],$a['uid'],$a['cid'],$a['entity'],$a['role'],$a['name'],'QUESTION',$groups[$gidx][0],$title,$body,$cat,'Усть-Каменогорск',$vehicle,$dt,$dt]);
 }
 foreach($posts as $i=>$x){
  [$title,$body,$cat,$gidx,$aidx,$vehicle]=$x;$a=$actors[$aidx];$id='demo84_127_post_'.str_pad((string)($i+1),2,'0',STR_PAD_LEFT);$dt=date('Y-m-d H:i:s',time()-(($i+1)*2400+300));
  $postSql->execute([$id,$a['aid'],$a['pid'],$a['uid'],$a['cid'],$a['entity'],$a['role'],$a['name'],$i===8?'NEWS':'POST',$groups[$gidx][0],$title,$body,$cat,'Усть-Каменогорск',$vehicle,$dt,$dt]);
 }

 $answers=[
  'Начните с падения напряжения под нагрузкой: минус АКБ → двигатель и минус АКБ → кузов. Визуальной проверки массы недостаточно.',
  'Сначала питание и проводка, затем управляющий сигнал. Сопротивление само по себе ещё не доказывает неисправность узла.',
  'Проверьте люфты, внутренние ШРУСы и биение диска/ступицы. После двух балансировок лучше не менять детали наугад.',
  'Снимите ремень на холодном моторе и отдельно проверьте ролики и свободный ход натяжителя. Так источник слышнее.',
  'Дождитесь засыпания блоков, затем вытаскивайте предохранители по одному и фиксируйте, на какой цепи ток падает.',
  'Проверьте свободный ход поршня и тормозной шланг: внутреннее расслоение иногда держит остаточное давление.',
  'После чистки сначала выполните штатную адаптацию, но параллельно проверьте подсос и положение заслонки по сканеру.',
  'По изменению гула в повороте можно предположить сторону, но подтверждать лучше вывешиванием и сравнением.',
  'По одному сопротивлению совместимость не подтверждается. Нужны OEM, тип сигнала, разъём и длина кабеля.',
  'Для старта: мультиметр, нормальный ELM327 и контрольная лампа. Токовые клещи полезны, но можно добавить позже.'
 ];
 $step='comments';
 $commentSql=$pdo->prepare("INSERT INTO master_wall_comments_social(id,entity_key,parent_id,actor_key,account_id,person_id,user_id,author_name,author_role,author_master_id,body,active,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,1,?) ON DUPLICATE KEY UPDATE author_name=VALUES(author_name),author_role=VALUES(author_role),body=VALUES(body),active=1,created_at=VALUES(created_at)");
 for($i=0;$i<10;$i++){
  for($j=0;$j<3;$j++){
   $a=$actors[($i+$j+4)%count($actors)];$cid='demo84_127_comment_q'.str_pad((string)($i+1),2,'0',STR_PAD_LEFT).'_'.($j+1);
   $body=$j===0?$answers[$i]:($j===1?'Поддерживаю порядок проверки. Напишите результат замеров — дальше можно сузить причину.':'Если добавите фото или код ошибки, участникам будет проще подсказать точнее.');
   $dt=date('Y-m-d H:i:s',time()-(($i+1)*1700)+($j*240));
   $commentSql->execute([$cid,'community:demo84_127_question_'.str_pad((string)($i+1),2,'0',STR_PAD_LEFT),'','a:'.$a['aid'],$a['aid'],$a['pid'],$a['uid'],$a['name'],$a['role'],$a['role']==='master'?$a['entity']:null,$body,$dt]);
  }
 }
 $step='reactions';
 $reactionSql=$pdo->prepare("INSERT INTO master_wall_reactions(id,entity_key,actor_key,account_id,user_id,reaction,created_at) VALUES(?,?,?,?,?,'like',?) ON DUPLICATE KEY UPDATE reaction='like',created_at=VALUES(created_at)");
 for($i=0;$i<20;$i++){
  $entity=$i<10?'community:demo84_127_question_'.str_pad((string)($i+1),2,'0',STR_PAD_LEFT):'community:demo84_127_post_'.str_pad((string)($i-9),2,'0',STR_PAD_LEFT);
  foreach([($i+1)%10,($i+4)%10] as $k){$a=$actors[$k];$rid='demo84_127_reaction_'.str_pad((string)($i+1),2,'0',STR_PAD_LEFT).'_'.$k;$reactionSql->execute([$rid,$entity,'a:'.$a['aid'],$a['aid'],$a['uid'],date('Y-m-d H:i:s',time()-($i+1)*400)]);}
 }

 $step='chats';
 $fallbackOrder=(string)(dscalar($pdo,"SELECT id FROM orders ORDER BY created_at DESC LIMIT 1")?:'');
 if($fallbackOrder==='') throw new RuntimeException('No existing order available for demo chat FK');
 $existing=$pdo->query("SELECT id,phone,name,car,initials FROM users WHERE id IN (1,3) AND active=1 ORDER BY id")->fetchAll(PDO::FETCH_ASSOC)?:[];
 if(!$existing)$existing=[['id'=>$actors[0]['uid'],'phone'=>$actors[0]['phone'],'name'=>$actors[0]['name'],'car'=>$actors[0]['car'],'initials'=>$actors[0]['ini']]];
 $currentMasters=$pdo->query("SELECT m.id entity,m.user_id uid,m.name,u.phone,u.initials ini FROM masters m JOIN users u ON u.id=m.user_id WHERE m.user_id IN (1,3) AND m.active=1 AND u.active=1 ORDER BY m.user_id")->fetchAll(PDO::FETCH_ASSOC)?:[];
 if(!$currentMasters)$currentMasters=array_values(array_filter($actors,fn($a)=>$a['role']==='master'));
 $chatTitles=['Не заводится после ночной стоянки','Диагностика ошибки двигателя','Вибрация на скорости','Греется переднее колесо','Проверка электрики','Замена ступичного подшипника','Нестабильный холостой ход','Подбор времени на диагностику','Проверка перед дальней поездкой','Совет по тормозной системе'];
 $msgSets=[
  ['Здравствуйте. Хочу уточнить по машине, проблема повторяется второй день.','Здравствуйте. Опишите симптомы и что уже проверяли.','Ошибок на панели нет, но запуск стал дольше обычного.','Понял. Начнём с питания, напряжения при запуске и базовой диагностики.','Хорошо, запишусь и пришлю результаты.'],
  ['Есть код ошибки, хочу понять критично ли ехать своим ходом.','Пришлите сам код и модель автомобиля.','Код сохранился, машина едет без потери мощности.','До осмотра не нагружайте двигатель. На диагностике посмотрим freeze frame и текущие параметры.','Принято, спасибо.'],
  ['После 90 км/ч появилась вибрация на руле.','Балансировку и давление уже проверяли?','Да, балансировка сделана дважды.','Тогда проверим ступицы, привода и биение.','Когда можно подъехать?'],
 ];
 $chatSql=$pdo->prepare("INSERT INTO chats(id,chat_type,title,order_id,client_id,client_user_id,client_name,client_phone,client_init,master_id,master_user_id,master_name,master_init,order_title,car,status,unread_client,unread_master,unread_admin,unread_sto,unread_seller,created_at,updated_at) VALUES(:id,'order',:title,:order_id,:client_id,:client_user_id,:client_name,:client_phone,:client_init,:master_id,:master_user_id,:master_name,:master_init,:order_title,:car,'active',:unread_client,:unread_master,0,0,0,:created_at,:updated_at) ON DUPLICATE KEY UPDATE title=VALUES(title),client_id=VALUES(client_id),client_user_id=VALUES(client_user_id),client_name=VALUES(client_name),client_phone=VALUES(client_phone),master_id=VALUES(master_id),master_user_id=VALUES(master_user_id),master_name=VALUES(master_name),order_title=VALUES(order_title),car=VALUES(car),status='active',unread_client=VALUES(unread_client),unread_master=VALUES(unread_master),updated_at=VALUES(updated_at)");
 $partSql=$pdo->prepare("INSERT INTO chat_participants(chat_id,user_id,role,unread_count,joined_at,left_at) VALUES(?,?,?,?,?,NULL) ON DUPLICATE KEY UPDATE role=VALUES(role),unread_count=VALUES(unread_count),left_at=NULL");
 $msgSql=$pdo->prepare("INSERT INTO messages(id,client_message_id,chat_id,order_id,from_role,author_user_id,type,text,meta,time,created_at) VALUES(:id,:client_message_id,:chat_id,:order_id,:from_role,:author_user_id,'text',:text,:meta,:time,:created_at) ON DUPLICATE KEY UPDATE order_id=VALUES(order_id),from_role=VALUES(from_role),author_user_id=VALUES(author_user_id),text=VALUES(text),meta=VALUES(meta),time=VALUES(time),created_at=VALUES(created_at),deleted_at=NULL");
 if(count($currentMasters)<2)$currentMasters=array_values(array_filter($actors,fn($a)=>$a['role']==='master'));
 for($i=0;$i<10;$i++){
  $cu=$existing[$i%count($existing)];$ma=$currentMasters[($i+1)%count($currentMasters)];$chatId='demo84_127_chat_'.str_pad((string)($i+1),2,'0',STR_PAD_LEFT);
  if((int)$ma['uid']===(int)$cu['id']&&count($currentMasters)>1)$ma=$currentMasters[$i%count($currentMasters)];
  $clientId=dscalar($pdo,"SELECT id FROM clients WHERE user_id=? LIMIT 1",[(int)$cu['id']])?:null;
  $created=date('Y-m-d H:i:s',time()-(($i+1)*3600));$unreadClient=$i%3;$unreadMaster=($i+1)%3;
  $chatSql->execute([':id'=>$chatId,':title'=>$chatTitles[$i],':order_id'=>$fallbackOrder,':client_id'=>$clientId,':client_user_id'=>(int)$cu['id'],':client_name'=>$cu['name'],':client_phone'=>$cu['phone'],':client_init'=>dini((string)$cu['name']),':master_id'=>$ma['entity'],':master_user_id'=>$ma['uid'],':master_name'=>$ma['name'],':master_init'=>$ma['ini'],':order_title'=>$chatTitles[$i],':car'=>(string)($cu['car']??''),':unread_client'=>$unreadClient,':unread_master'=>$unreadMaster,':created_at'=>$created,':updated_at'=>$created]);
  $pdo->prepare("UPDATE chat_participants SET left_at=NOW(),unread_count=0 WHERE chat_id=? AND user_id NOT IN (?,?)")->execute([$chatId,(int)$cu['id'],(int)$ma['uid']]);
  $partSql->execute([$chatId,(int)$cu['id'],'client',$unreadClient,$created]);
  $partSql->execute([$chatId,(int)$ma['uid'],'master',$unreadMaster,$created]);
  $set=$msgSets[$i%count($msgSets)];
  foreach($set as $j=>$message){
   $from=$j%2===0?'client':'master';$author=$from==='client'?(int)$cu['id']:$ma['uid'];
   $dt=date('Y-m-d H:i:s',strtotime($created)+($j*420));$mid='demo84_127_msg_'.str_pad((string)($i+1),2,'0',STR_PAD_LEFT).'_'.($j+1);
   $meta=json_encode(['seed'=>'demo84_127','sequence'=>$j+1],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);
   $msgSql->execute([':id'=>$mid,':client_message_id'=>$mid,':chat_id'=>$chatId,':order_id'=>$fallbackOrder,':from_role'=>$from,':author_user_id'=>$author,':text'=>$message,':meta'=>$meta,':time'=>date('H:i',strtotime($dt)),':created_at'=>$dt]);
  }
 }
 $pdo->commit();

 $counts=[
  'demo_users'=>(int)dscalar($pdo,"SELECT COUNT(*) FROM users WHERE phone BETWEEN '+77007770101' AND '+77007770110'"),
  'groups'=>(int)dscalar($pdo,"SELECT COUNT(*) FROM community_groups WHERE id LIKE 'demo84_127_group_%'"),
  'questions'=>(int)dscalar($pdo,"SELECT COUNT(*) FROM community_posts WHERE id LIKE 'demo84_127_question_%' AND post_type='QUESTION'"),
  'posts'=>(int)dscalar($pdo,"SELECT COUNT(*) FROM community_posts WHERE id LIKE 'demo84_127_post_%'"),
  'comments'=>(int)dscalar($pdo,"SELECT COUNT(*) FROM master_wall_comments_social WHERE id LIKE 'demo84_127_comment_%'"),
  'chats'=>(int)dscalar($pdo,"SELECT COUNT(*) FROM chats WHERE id LIKE 'demo84_127_chat_%'"),
  'messages'=>(int)dscalar($pdo,"SELECT COUNT(*) FROM messages WHERE id LIKE 'demo84_127_msg_%'"),
 ];
 echo json_encode(['ok'=>true,'seed'=>'demo84_127','counts'=>$counts],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT).PHP_EOL;
}catch(Throwable $e){
 if($pdo->inTransaction())$pdo->rollBack();
 fwrite(STDERR,'SEED_ERROR ['.($step??'unknown').']: '.$e->getMessage().PHP_EOL);
 exit(1);
}
