<?php
declare(strict_types=1);
$root=dirname(__DIR__);
$patterns=[
 'legacy_role_php'=>'/\$[A-Za-z_]*(?:role|isMaster|isClient|isSto|isSeller)\b|\[\s*[\'\"]role[\'\"]\s*\]/i',
 'legacy_role_js'=>'/user\.role|forcedRole|storedRole|data-user-role|KaretaRoleAccess/i',
 'legacy_auth_endpoint'=>'/auth_session\.php|organizations\.php\?action=contexts/i',
 'direct_fetch_api'=>'/fetch\s*\(\s*[\'\"]\/api\//i',
 'capability_alias'=>'/\b(?:work_order|workorder|orders?\.|chats?\.|finance\.manageOwn)\b/i',
];
$skip=['vendor/','storage/','tools/internal_architecture_audit.php'];
$rows=[];$counts=array_fill_keys(array_keys($patterns),0);
$it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root,FilesystemIterator::SKIP_DOTS));
foreach($it as $f){
 if(!$f->isFile()||!preg_match('/\.(php|js|css)$/',$f->getFilename()))continue;
 $rel=str_replace('\\','/',substr($f->getPathname(),strlen($root)+1));
 foreach($skip as $x)if(str_starts_with($rel,$x))continue 2;
 $lines=@file($f->getPathname()); if(!$lines)continue;
 foreach($lines as $n=>$line)foreach($patterns as $type=>$re)if(preg_match($re,$line)){
   $counts[$type]++;$rows[]=['type'=>$type,'file'=>$rel,'line'=>$n+1,'preview'=>substr(trim($line),0,220)];
 }
}
usort($rows,fn($a,$b)=>[$a['type'],$a['file'],$a['line']]<=>[$b['type'],$b['file'],$b['line']]);
$out=['generatedAt'=>gmdate('c'),'counts'=>$counts,'total'=>array_sum($counts),'items'=>$rows];
@mkdir($root.'/docs/audit',0775,true);
file_put_contents($root.'/docs/audit/internal_architecture_audit.json',json_encode($out,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_INVALID_UTF8_SUBSTITUTE));
$md="# Internal Architecture Audit\n\nGenerated: {$out['generatedAt']}\n\n";
foreach($counts as $k=>$v)$md.="- **{$k}**: {$v}\n";
$md.="\n## Findings\n\n|Type|File|Line|Preview|\n|---|---|---:|---|\n";
foreach(array_slice($rows,0,500) as $r)$md.='|'.$r['type'].'|`'.$r['file'].'`|'.$r['line'].'|'.str_replace('|','\\|',$r['preview'])."|\n";
file_put_contents($root.'/docs/audit/INTERNAL_ARCHITECTURE_AUDIT.md',$md);
echo json_encode(['ok'=>true,'counts'=>$counts,'total'=>$out['total']],JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES).PHP_EOL;
