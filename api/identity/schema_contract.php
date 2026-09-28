<?php
declare(strict_types=1);

final class KaretaSchemaContract
{
    public static function contracts(): array
    {
        return [
            'accounts' => ['id','phone','status','created_at'],
            'persons' => ['id','account_id','fullname'],
            'person_profiles' => ['id','person_id','profile_type','status'],
            'contexts' => ['id','context_key','context_type','status'],
            'context_members' => ['id','context_id','account_id','membership_status'],
            'auth_sessions' => ['id','account_id','token_hash','current_context_id','revoked_at'],
            'capabilities' => ['id','capability_key'],
        ];
    }

    public static function inspect(PDO $pdo): array
    {
        $missingTables=[];$missingColumns=[];$checked=[];
        foreach (self::contracts() as $table=>$columns) {
            $st=$pdo->prepare("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?");
            $st->execute([$table]);
            if ((int)$st->fetchColumn()===0) { $missingTables[]=$table; continue; }
            $checked[]=$table;
            $ph=implode(',',array_fill(0,count($columns),'?'));
            $sql="SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME IN ($ph)";
            $st=$pdo->prepare($sql);$st->execute(array_merge([$table],$columns));
            $found=array_fill_keys(array_map('strval',$st->fetchAll(PDO::FETCH_COLUMN)),true);
            foreach($columns as $column) if(!isset($found[$column])) $missingColumns[]=$table.'.'.$column;
        }
        return [
            'ok'=>!$missingTables&&!$missingColumns,
            'checkedTables'=>$checked,
            'missingTables'=>$missingTables,
            'missingColumns'=>$missingColumns,
        ];
    }

    public static function assert(PDO $pdo): void
    {
        $result=self::inspect($pdo);
        if(!$result['ok']) {
            throw new RuntimeException('Schema contract mismatch: tables='.implode(',',$result['missingTables']).'; columns='.implode(',',$result['missingColumns']));
        }
    }

    public static function record(PDO $pdo, array $result, string $source): void
    {
        try {
            $pdo->prepare("INSERT INTO schema_contract_audit(source_name,status,missing_tables_json,missing_columns_json,checked_at) VALUES(?,?,?,?,CURRENT_TIMESTAMP)")
                ->execute([$source,$result['ok']?'ok':'failed',json_encode($result['missingTables'],JSON_UNESCAPED_UNICODE),json_encode($result['missingColumns'],JSON_UNESCAPED_UNICODE)]);
        } catch(Throwable $_ignored) {}
    }
}
