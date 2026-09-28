<?php
declare(strict_types=1);

final class KaretaDomainOwnershipService
{
    public function __construct(private PDO $pdo) {}

    public function resolve(string $entityType,string $entityKey): ?array
    {
        $st=$this->pdo->prepare("SELECT id,entity_type,entity_key,owner_user_id,organization_id,owner_context_id,visibility,permissions_json,ownership_revision,status FROM domain_entities WHERE entity_type=? AND entity_key=? LIMIT 1");
        $st->execute([$entityType,$entityKey]);$row=$st->fetch(PDO::FETCH_ASSOC);
        if(!is_array($row))return null;
        $row['id']=(int)$row['id'];$row['owner_context_id']=(int)($row['owner_context_id']??0)?:null;
        $row['permissions']=json_decode((string)($row['permissions_json']??''),true)?:[];
        return $row;
    }

    public function can(array $entity,int $accountId,array $context,string $permission='read'): bool
    {
        $contextId=(int)($context['id']??0);
        if($contextId>0 && (int)($entity['owner_context_id']??0)===$contextId)return true;
        if($this->legacyOwnerMatches($entity,$accountId))return true;
        $organizationKey=trim((string)($context['organizationKey']??$context['organization_key']??''));
        if($organizationKey!=='' && hash_equals((string)($entity['organization_id']??''),$organizationKey))return true;

        $visibility=(string)($entity['visibility']??'private');
        if($permission==='read' && $visibility==='public')return true;
        if($permission==='read' && $visibility==='authenticated' && $accountId>0)return true;

        if($contextId<=0)return false;
        $st=$this->pdo->prepare("SELECT effect FROM domain_entity_acl WHERE entity_id=? AND grantee_context_id=? AND permission_key IN (?, '*') AND (expires_at IS NULL OR expires_at>NOW()) ORDER BY (permission_key='*') ASC, FIELD(effect,'deny','allow') ASC");
        $st->execute([(int)$entity['id'],$contextId,$permission]);
        $allowed=false;foreach($st->fetchAll(PDO::FETCH_COLUMN)?:[] as $effect){if($effect==='deny')return false;if($effect==='allow')$allowed=true;}
        return $allowed;
    }

    public function require(string $entityType,string $entityKey,int $accountId,array $context,string $permission='read'): array
    {
        $entity=$this->resolve($entityType,$entityKey);
        if(!$entity)throw new DomainException('resource_not_found');
        if(!$this->can($entity,$accountId,$context,$permission))throw new DomainException('resource_access_denied');
        return $entity;
    }

    public function scopeSql(int $accountId,array $context,string $alias='d',string $permission='read'): array
    {
        $contextId=(int)($context['id']??0);
        $organizationKey=trim((string)($context['organizationKey']??$context['organization_key']??''));
        $legacyUserId=$this->legacyUserId($accountId);
        $parts=["$alias.visibility='public'","$alias.visibility='authenticated'","$alias.owner_context_id=?"];
        $args=[$contextId];
        if($legacyUserId>0){$parts[]="$alias.owner_user_id=?";$args[]=$legacyUserId;}
        if($organizationKey!==''){$parts[]="$alias.organization_id=?";$args[]=$organizationKey;}
        $parts[]="EXISTS (SELECT 1 FROM domain_entity_acl dea WHERE dea.entity_id=$alias.id AND dea.grantee_context_id=? AND dea.permission_key IN (?, '*') AND dea.effect='allow' AND (dea.expires_at IS NULL OR dea.expires_at>NOW()) AND NOT EXISTS (SELECT 1 FROM domain_entity_acl ded WHERE ded.entity_id=$alias.id AND ded.grantee_context_id=? AND ded.permission_key IN (?, '*') AND ded.effect='deny' AND (ded.expires_at IS NULL OR ded.expires_at>NOW())))";
        array_push($args,$contextId,$permission,$contextId,$permission);
        return ['sql'=>'('.implode(' OR ',$parts).')','args'=>$args];
    }

    private function legacyOwnerMatches(array $entity,int $accountId): bool
    {
        $legacyUserId=$this->legacyUserId($accountId);
        return $legacyUserId>0 && (int)($entity['owner_user_id']??0)===$legacyUserId;
    }
    private function legacyUserId(int $accountId): int
    {
        $st=$this->pdo->prepare("SELECT u.id FROM accounts a JOIN users u ON u.phone=a.phone WHERE a.id=? LIMIT 1");$st->execute([$accountId]);return (int)($st->fetchColumn()?:0);
    }
}
