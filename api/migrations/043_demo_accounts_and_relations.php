<?php
declare(strict_types=1);

return [
    'version' => 43,
    'note' => 'five realistic demo accounts for clients, masters, service stations and parts sellers with linked vehicles, services, products and orders',
    'run' => static function (PDO $pdo): void {
        // Production installations must never receive accounts with publicly
        // known demo phone numbers. Enable explicitly before the first migrate
        // only in an isolated development environment.
        if (!defined('KARETA_DEMO_SEED') || !KARETA_DEMO_SEED) return;
        $now = date('Y-m-d H:i:s');
        $users = [
            ['77010001001','Айдос Нурланов','client','Усть-Каменогорск','Toyota Camry 2018'],
            ['77010001002','Марина Волкова','client','Усть-Каменогорск','Renault Logan 2019'],
            ['77010001003','Ерлан Садыков','client','Семей','Hyundai Tucson 2021'],
            ['77010001004','Ольга Ким','client','Усть-Каменогорск','Kia Rio 2020'],
            ['77010001005','Данияр Ахметов','client','Риддер','Lada Vesta 2022'],
            ['77020002001','Алексей Морозов','master','Усть-Каменогорск',''],
            ['77020002002','Руслан Ибраев','master','Усть-Каменогорск',''],
            ['77020002003','Сергей Пак','master','Семей',''],
            ['77020002004','Максим Орлов','master','Усть-Каменогорск',''],
            ['77020002005','Арман Жумабеков','master','Риддер',''],
            ['77030003001','KARETA Service','sto','Усть-Каменогорск',''],
            ['77030003002','East Auto Tech','sto','Усть-Каменогорск',''],
            ['77030003003','Semey Motors','sto','Семей',''],
            ['77030003004','Altai Garage','sto','Риддер',''],
            ['77030003005','ProCar Center','sto','Усть-Каменогорск',''],
            ['77040004001','GlobalTuning KZ','seller','Усть-Каменогорск',''],
            ['77040004002','AutoParts East','seller','Усть-Каменогорск',''],
            ['77040004003','Motor Market Semey','seller','Семей',''],
            ['77040004004','ElectroCar Parts','seller','Усть-Каменогорск',''],
            ['77040004005','Altai Auto Shop','seller','Риддер',''],
        ];
        $userUpsert = $pdo->prepare("INSERT INTO users (phone,name,role,entry_role,onboarding_stage,onboarded,onboarded_at,country_code,city,initials,car,spec,email,active) VALUES (?,?,?,?, 'done',1,?,'KZ',?,?,?,?,?,1) ON DUPLICATE KEY UPDATE name=VALUES(name),role=VALUES(role),entry_role=VALUES(entry_role),onboarded=1,onboarded_at=COALESCE(onboarded_at,VALUES(onboarded_at)),city=VALUES(city),car=VALUES(car),spec=VALUES(spec),active=1");
        foreach ($users as $u) {
            $spec = $u[2] === 'master' ? 'Диагностика и автоэлектрика' : ($u[2] === 'sto' ? 'Комплексный ремонт автомобилей' : ($u[2] === 'seller' ? 'Продажа автозапчастей' : ''));
            $initials = implode('', array_map(static fn($v) => mb_substr($v,0,1,'UTF-8'), array_slice(preg_split('/\s+/u',$u[1]) ?: [],0,2)));
            $userUpsert->execute([$u[0],$u[1],$u[2],$u[2],$now,$u[3],$initials,$u[4],$spec,'demo+'.substr($u[0],-4).'@kareta.kz']);
        }
        $idByPhone = [];
        $st = $pdo->query("SELECT id,phone FROM users WHERE phone BETWEEN '77010001001' AND '77040004005'");
        foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) $idByPhone[$r['phone']] = (int)$r['id'];

        $clients = [
            ['demo-client-1','77010001001','Айдос Нурланов','Toyota Camry 2018','Постоянный клиент, предпочитает запись утром'],
            ['demo-client-2','77010001002','Марина Волкова','Renault Logan 2019','Обслуживание по регламенту'],
            ['demo-client-3','77010001003','Ерлан Садыков','Hyundai Tucson 2021','Диагностика перед дальней поездкой'],
            ['demo-client-4','77010001004','Ольга Ким','Kia Rio 2020','Основной контакт через чат'],
            ['demo-client-5','77010001005','Данияр Ахметов','Lada Vesta 2022','Интересуется запчастями в наличии'],
        ];
        $clientUpsert = $pdo->prepare("INSERT INTO clients (id,user_id,user_phone,name,phone,car,notes,orders_count,total_spent,created_at) VALUES (?,?,?,?,?,?,?,0,0,CURDATE()) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id),name=VALUES(name),phone=VALUES(phone),car=VALUES(car),notes=VALUES(notes)");
        $vehicleUpsert = $pdo->prepare("INSERT INTO client_vehicles (id,user_id,user_phone,client_id,title,brand,model,year_label,plate,vin,color,icon,note,is_default,active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1,1) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id),title=VALUES(title),plate=VALUES(plate),vin=VALUES(vin),active=1");
        $vehicles = [
            ['Toyota','Camry','2018','777AAA16','JTNB11HK0J3001001','Белый'],['Renault','Logan','2019','123KRA16','X7L4SRAV459001002','Серебристый'],['Hyundai','Tucson','2021','505SEM16','TMAJ3813AMJ001003','Чёрный'],['Kia','Rio','2020','010KIA16','Z94C241BAKR001004','Синий'],['Lada','Vesta','2022','222RID16','XTAGFL110NY001005','Серый']
        ];
        foreach ($clients as $i=>$c) {
            $uid=$idByPhone[$c[1]]??null; $clientUpsert->execute([$c[0],$uid,$c[1],$c[2],$c[1],$c[3],$c[4]]);
            $v=$vehicles[$i]; $vehicleUpsert->execute(['demo-vehicle-'.($i+1),$uid,$c[1],$c[0],$v[0].' '.$v[1].' '.$v[2],$v[0],$v[1],$v[2],$v[3],$v[4],$v[5],'🚗','Демонстрационный автомобиль']);
        }

        $masters = [
            ['demo-master-1','77020002001','Алексей Морозов','Автоэлектрика и диагностика','#f97316'],
            ['demo-master-2','77020002002','Руслан Ибраев','Двигатель и ГРМ','#0ea5e9'],
            ['demo-master-3','77020002003','Сергей Пак','Ходовая и тормоза','#22c55e'],
            ['demo-master-4','77020002004','Максим Орлов','Кондиционеры и отопление','#8b5cf6'],
            ['demo-master-5','77020002005','Арман Жумабеков','Автозвук и сигнализации','#ef4444'],
        ];
        $masterUpsert=$pdo->prepare("INSERT INTO masters (id,user_id,user_phone,name,phone,initials,color,spec,active,sto_id,sto_name) VALUES (?,?,?,?,?,?,?,?,1,?,?) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id),name=VALUES(name),phone=VALUES(phone),color=VALUES(color),spec=VALUES(spec),active=1,sto_id=VALUES(sto_id),sto_name=VALUES(sto_name)");
        foreach($masters as $i=>$m){$masterUpsert->execute([$m[0],$idByPhone[$m[1]]??null,$m[1],$m[2],$m[1],mb_substr($m[2],0,1,'UTF-8'),$m[4],$m[3],'demo-sto-'.($i+1),['KARETA Service','East Auto Tech','Semey Motors','Altai Garage','ProCar Center'][$i]]);}

        $stos = [
            ['demo-sto-1','77030003001','KARETA Service','Усть-Каменогорск','ул. Казахстан, 68','10:00–20:00'],
            ['demo-sto-2','77030003002','East Auto Tech','Усть-Каменогорск','пр. Абая, 156','09:00–19:00'],
            ['demo-sto-3','77030003003','Semey Motors','Семей','ул. Кабанбай батыра, 42','09:00–19:00'],
            ['demo-sto-4','77030003004','Altai Garage','Риддер','ул. Независимости, 12','10:00–19:00'],
            ['demo-sto-5','77030003005','ProCar Center','Усть-Каменогорск','ул. Протозанова, 95','08:00–20:00'],
        ];
        $stoUpsert=$pdo->prepare("INSERT INTO sto_profiles (id,user_id,user_phone,name,contact_phone,country_code,city,address,work_hours,active) VALUES (?,?,?,?,?,'KZ',?,?,?,1) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id),name=VALUES(name),contact_phone=VALUES(contact_phone),city=VALUES(city),address=VALUES(address),work_hours=VALUES(work_hours),active=1");
        $linkUpsert=$pdo->prepare("INSERT INTO sto_master_links (sto_id,master_id,status,invited_at,accepted_at) VALUES (?,?,'active',NOW(),NOW()) ON DUPLICATE KEY UPDATE status='active',accepted_at=COALESCE(accepted_at,NOW())");
        foreach($stos as $i=>$s){$stoUpsert->execute([$s[0],$idByPhone[$s[1]]??null,$s[1],$s[2],$s[1],$s[3],$s[4],$s[5]]);$linkUpsert->execute([$s[0],'demo-master-'.($i+1)]);}

        $sellers = [
            ['77040004001','GlobalTuning KZ','ТОО GlobalTuning KZ','240740001001','Автозвук и мультимедиа'],
            ['77040004002','AutoParts East','ИП AutoParts East','240740001002','Расходники и детали ТО'],
            ['77040004003','Motor Market Semey','ИП Motor Market Semey','240740001003','Двигатель и трансмиссия'],
            ['77040004004','ElectroCar Parts','ТОО ElectroCar Parts','240740001004','Автоэлектрика и освещение'],
            ['77040004005','Altai Auto Shop','ИП Altai Auto Shop','240740001005','Ходовая и тормозная система'],
        ];
        $sellerUpsert=$pdo->prepare("INSERT INTO seller_profiles (user_id,user_phone,store_name,legal_name,bin_iin,contact_phone,email,country_code,city,warehouse_address,description,assortment,category_tags,delivery_modes,payment_methods,minimum_order,return_days,moderation_status,active) VALUES (?,?,?,?,?,? ,?,'KZ',?,?,?,?,?,?,?,?,14,'approved',1) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id),store_name=VALUES(store_name),legal_name=VALUES(legal_name),bin_iin=VALUES(bin_iin),contact_phone=VALUES(contact_phone),city=VALUES(city),warehouse_address=VALUES(warehouse_address),description=VALUES(description),assortment=VALUES(assortment),moderation_status='approved',active=1");
        $cities=['Усть-Каменогорск','Усть-Каменогорск','Семей','Усть-Каменогорск','Риддер'];
        foreach($sellers as $i=>$s){$sellerUpsert->execute([$idByPhone[$s[0]]??null,$s[0],$s[1],$s[2],$s[3],$s[0],'shop'.($i+1).'@kareta.kz',$cities[$i],'Склад: '.$cities[$i].', промышленная зона '.($i+1),'Проверенный магазин автозапчастей. Гарантия, документы и актуальные остатки.',$s[4],json_encode([$s[4]],JSON_UNESCAPED_UNICODE),json_encode(['pickup','courier'],JSON_UNESCAPED_UNICODE),json_encode(['cash','card','transfer'],JSON_UNESCAPED_UNICODE),'5000 ₸']);}

        $productUpsert=$pdo->prepare("INSERT INTO seller_products (id,seller_user_id,seller_phone,sku,oem_number,name,category,brand,price,old_price,stock_qty,status,description,image_url,fitment_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name),category=VALUES(category),brand=VALUES(brand),price=VALUES(price),stock_qty=VALUES(stock_qty),status='published',description=VALUES(description)");
        $sampleProducts=[['Масляный фильтр','filters','MANN',4500],['Катушка зажигания','electrical','Bosch',18500],['Тормозные колодки','brakes','Brembo',24000],['Комплект проводов','wiring','KARETA',12500],['LED лампы H7','lighting','Osram',16500]];
        foreach($sellers as $si=>$s){$uid=$idByPhone[$s[0]]??0;foreach($sampleProducts as $pi=>$p){$n=$si*5+$pi+1;$productUpsert->execute(['demo-product-'.$n,$uid,$s[0],'DEMO-'.str_pad((string)$n,3,'0',STR_PAD_LEFT),'OEM-'.(10000+$n),$p[0].' '.$s[1],$p[1],$p[2],$p[3]+$si*1000,0,5+$pi+$si,'published','Демонстрационный товар с гарантией и актуальным остатком.','',json_encode(['universal'=>true],JSON_UNESCAPED_UNICODE)]);}}

        $serviceIds=$pdo->query("SELECT id,base_price FROM service_catalog WHERE active=1 ORDER BY sort,id LIMIT 10")->fetchAll(PDO::FETCH_ASSOC);
        if($serviceIds){$offerUpsert=$pdo->prepare("INSERT INTO service_offers (service_id,owner_type,owner_user_id,owner_entity_id,city,price,duration_min,warranty_days,availability_status,booking_enabled,notes,active,moderation_status) VALUES (?,?,?,?,?,?,?,?, 'available',1,?,1,'approved') ON DUPLICATE KEY UPDATE city=VALUES(city),price=VALUES(price),duration_min=VALUES(duration_min),warranty_days=VALUES(warranty_days),availability_status='available',booking_enabled=1,notes=VALUES(notes),active=1,moderation_status='approved'");foreach($masters as $i=>$m){foreach(array_slice($serviceIds,$i,5) as $j=>$svc){$offerUpsert->execute([$svc['id'],'master',$idByPhone[$m[1]]??0,$m[0],$cities[$i],max(5000,(int)$svc['base_price']+$i*1000),60+$j*20,30,'Диагностика перед началом работ, согласование цены в чате.']);}}foreach($stos as $i=>$s){foreach(array_slice($serviceIds,0,5) as $j=>$svc){$offerUpsert->execute([$svc['id'],'sto',$idByPhone[$s[1]]??0,$s[0],$s[3],max(7000,(int)$svc['base_price']+$i*1500),50+$j*15,60,'Работы выполняются по заказ-наряду с гарантией СТО.']);}}}

        $orderUpsert=$pdo->prepare("INSERT INTO orders (id,num,status,priority,category,source,type,deferred,client_id,client_user_id,client_vehicle_id,vehicle_title,client_name,client_phone,client_car,master_id,master_user_id,master_name,service_ids,service_names,price,date,time,time_mode,notes,stages,reports) VALUES (?,?,?,?, 'service','demo','service_order',0,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE status=VALUES(status),master_id=VALUES(master_id),master_user_id=VALUES(master_user_id),service_names=VALUES(service_names),price=VALUES(price),notes=VALUES(notes)");
        $statuses=['new','accepted','in_progress','completed','completed'];
        for($i=0;$i<5;$i++){ $c=$clients[$i];$m=$masters[$i];$svc=$serviceIds[$i%max(1,count($serviceIds))]??['id'=>'','base_price'=>15000];$orderUpsert->execute(['D'.str_pad((string)($i+1),7,'0',STR_PAD_LEFT),9001+$i,$statuses[$i],'normal',$c[0],$idByPhone[$c[1]]??null,'demo-vehicle-'.($i+1),$c[3],$c[2],$c[1],$c[3],$m[0],$idByPhone[$m[1]]??null,$m[2],json_encode([$svc['id']],JSON_UNESCAPED_UNICODE),'Диагностика и обслуживание',max(12000,(int)$svc['base_price']),date('Y-m-d',strtotime('+'.($i+1).' days')),'10:00','exact','Демонстрационный заказ с заполненными связями.',json_encode([['name'=>'Заявка создана','done'=>true]],JSON_UNESCAPED_UNICODE),json_encode([],JSON_UNESCAPED_UNICODE)]); }

        $pdo->exec("UPDATE clients c LEFT JOIN (SELECT client_id,COUNT(*) cnt,COALESCE(SUM(price),0) total FROM orders GROUP BY client_id) o ON o.client_id=c.id SET c.orders_count=COALESCE(o.cnt,0),c.total_spent=COALESCE(o.total,0) WHERE c.id LIKE 'demo-client-%'");
    },
];
