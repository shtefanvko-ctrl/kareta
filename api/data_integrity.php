<?php
declare(strict_types=1);

function kareta_integrity_table_exists(PDO $pdo,string $table): bool {
    $st=$pdo->prepare("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?");
    $st->execute([$table]); return (int)$st->fetchColumn()>0;
}
function kareta_integrity_column_exists(PDO $pdo,string $table,string $column): bool {
    $st=$pdo->prepare("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=?");
    $st->execute([$table,$column]); return (int)$st->fetchColumn()>0;
}
function kareta_integrity_scalar(PDO $pdo,string $sql): int {
    try { return (int)($pdo->query($sql)->fetchColumn() ?: 0); } catch(Throwable $e) { return -1; }
}
function kareta_data_integrity_audit(PDO $pdo): void {
    kareta_require_any_role(['admin','owner']);
    $issues=[];
    $add=static function(string $key,string $label,int $count,string $severity='warning') use (&$issues):void {
        $issues[]=['key'=>$key,'label'=>$label,'count'=>$count,'severity'=>$count>0?$severity:'ok'];
    };
    $add('masters_without_user','Мастера без связи с учётной записью',kareta_integrity_scalar($pdo,"SELECT COUNT(*) FROM masters WHERE user_id IS NULL OR user_id=0"),'critical');
    $add('sto_without_user','СТО без связи с учётной записью',kareta_integrity_scalar($pdo,"SELECT COUNT(*) FROM sto_profiles WHERE user_id IS NULL OR user_id=0"),'critical');
    $add('masters_multiple_active_sto','Мастера с несколькими активными СТО',kareta_integrity_scalar($pdo,"SELECT COUNT(*) FROM (SELECT master_id FROM sto_master_links WHERE status='active' GROUP BY master_id HAVING COUNT(*)>1) x"),'critical');
    $add('masters_invalid_sto','Мастера со ссылкой на отсутствующее СТО',kareta_integrity_scalar($pdo,"SELECT COUNT(*) FROM masters m LEFT JOIN sto_profiles s ON s.id=m.sto_id WHERE COALESCE(m.sto_id,'')<>'' AND s.id IS NULL"),'critical');
    $add('orders_without_master_user','Заказы мастера без master_user_id',kareta_integrity_scalar($pdo,"SELECT COUNT(*) FROM orders WHERE COALESCE(master_id,'')<>'' AND (master_user_id IS NULL OR master_user_id=0)"));
    $add('orders_without_sto','Заказы мастеров СТО без sto_id',kareta_integrity_scalar($pdo,"SELECT COUNT(*) FROM orders o JOIN masters m ON m.id=o.master_id WHERE COALESCE(m.sto_id,'')<>'' AND COALESCE(o.sto_id,'')=''"));
    $add('orders_sto_mismatch','Заказы с несовпадением СТО и мастера',kareta_integrity_scalar($pdo,"SELECT COUNT(*) FROM orders o JOIN masters m ON m.id=o.master_id WHERE COALESCE(o.sto_id,'')<>'' AND COALESCE(m.sto_id,'')<>'' AND o.sto_id<>m.sto_id"),'critical');
    $add('orphan_master_links','Связи с отсутствующим мастером или СТО',kareta_integrity_scalar($pdo,"SELECT COUNT(*) FROM sto_master_links l LEFT JOIN masters m ON m.id=l.master_id LEFT JOIN sto_profiles s ON s.id=l.sto_id WHERE m.id IS NULL OR s.id IS NULL"),'critical');
    $critical=0;$warnings=0; foreach($issues as $i){ if(($i['count']??0)>0){ if($i['severity']==='critical')$critical+=(int)$i['count']; else $warnings+=(int)$i['count']; }}
    kareta_json(['ok'=>true,'data'=>['healthy'=>$critical===0,'critical'=>$critical,'warnings'=>$warnings,'issues'=>$issues,'checkedAt'=>date(DATE_ATOM)]]);
}
function kareta_data_integrity_repair(PDO $pdo): void {
    kareta_require_any_role(['admin','owner']);
    $before=[];
    foreach(['masters','sto_profiles','orders'] as $t) $before[$t]=kareta_integrity_table_exists($pdo,$t)?kareta_integrity_scalar($pdo,"SELECT COUNT(*) FROM `$t`"):0;
    $migration=require __DIR__.'/migrations/060_relation_integrity.php';
    ($migration['run'])($pdo);
    kareta_json(['ok'=>true,'message'=>'safe_relations_repaired','counts'=>$before]);
}
