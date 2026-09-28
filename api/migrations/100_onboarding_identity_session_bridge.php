<?php
declare(strict_types=1);

return [
    'version'=>100,
    'note'=>'R188.5.5.1: backfill Identity accounts and personal contexts for legacy onboarding users',
    'run'=>static function(PDO $pdo): void {
        $pdo->exec("INSERT INTO accounts(phone,status)
            SELECT DISTINCT u.phone,'active' FROM users u
            WHERE TRIM(COALESCE(u.phone,''))<>'' AND COALESCE(u.active,1)=1
            ON DUPLICATE KEY UPDATE phone=VALUES(phone)");

        $pdo->exec("INSERT INTO persons(account_id,fullname,settings,locale,timezone)
            SELECT a.id,COALESCE(NULLIF(TRIM(u.name),''),'Клиент'),JSON_OBJECT(),'ru-KZ','Asia/Almaty'
            FROM accounts a JOIN users u ON u.phone=a.phone
            WHERE a.status='active' AND COALESCE(u.active,1)=1
            ON DUPLICATE KEY UPDATE fullname=IF(persons.fullname='',VALUES(fullname),persons.fullname)");

        $pdo->exec("INSERT INTO person_profiles(person_id,profile_type,status,legacy_entity_type,legacy_entity_id,payload_json)
            SELECT p.id,'client','active','user',u.id,JSON_OBJECT('source','r188551_legacy_backfill')
            FROM accounts a JOIN persons p ON p.account_id=a.id JOIN users u ON u.phone=a.phone
            WHERE a.status='active' AND COALESCE(u.active,1)=1
            ON DUPLICATE KEY UPDATE status=IF(person_profiles.status='archived','active',person_profiles.status),legacy_entity_type=COALESCE(person_profiles.legacy_entity_type,VALUES(legacy_entity_type)),legacy_entity_id=COALESCE(person_profiles.legacy_entity_id,VALUES(legacy_entity_id)),updated_at=CURRENT_TIMESTAMP");

        $pdo->exec("INSERT INTO contexts(context_key,context_type,account_id,person_id,capability_set_id,status)
            SELECT CONCAT('personal:',a.id),'personal',a.id,p.id,cs.id,'active'
            FROM accounts a JOIN persons p ON p.account_id=a.id
            LEFT JOIN capability_sets cs ON cs.code='personal.client'
            WHERE a.status='active'
            ON DUPLICATE KEY UPDATE account_id=VALUES(account_id),person_id=VALUES(person_id),capability_set_id=COALESCE(contexts.capability_set_id,VALUES(capability_set_id)),status='active'");

        $pdo->exec("INSERT INTO context_members(context_id,account_id,person_id,capability_set_id,membership_status)
            SELECT c.id,a.id,p.id,c.capability_set_id,'active'
            FROM accounts a JOIN persons p ON p.account_id=a.id
            JOIN contexts c ON c.context_key=CONCAT('personal:',a.id)
            WHERE a.status='active'
            ON DUPLICATE KEY UPDATE person_id=VALUES(person_id),capability_set_id=COALESCE(VALUES(capability_set_id),context_members.capability_set_id),membership_status='active',updated_at=CURRENT_TIMESTAMP");
    },
];
