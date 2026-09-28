<?php
declare(strict_types=1);
return static function(PDO $pdo): void {
    $hasColumn=static function(string $table,string $column) use($pdo): bool {
        $st=$pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?");
        $st->execute([$table,$column]); return (int)$st->fetchColumn()>0;
    };
    if(!$hasColumn('vehicle_documents','document_number')) $pdo->exec("ALTER TABLE vehicle_documents ADD COLUMN document_number VARCHAR(120) NULL AFTER title");
    if(!$hasColumn('vehicle_documents','issuer_name')) $pdo->exec("ALTER TABLE vehicle_documents ADD COLUMN issuer_name VARCHAR(191) NOT NULL DEFAULT '' AFTER document_number");
    if(!$hasColumn('vehicle_documents','issued_at')) $pdo->exec("ALTER TABLE vehicle_documents ADD COLUMN issued_at DATE NULL AFTER issuer_name");
    if(!$hasColumn('vehicle_documents','expires_at')) $pdo->exec("ALTER TABLE vehicle_documents ADD COLUMN expires_at DATE NULL AFTER issued_at");
    if(!$hasColumn('vehicle_documents','file_url')) $pdo->exec("ALTER TABLE vehicle_documents ADD COLUMN file_url VARCHAR(500) NOT NULL DEFAULT '' AFTER expires_at");
    if(!$hasColumn('vehicle_documents','visibility')) $pdo->exec("ALTER TABLE vehicle_documents ADD COLUMN visibility VARCHAR(24) NOT NULL DEFAULT 'owner' AFTER file_url");
    if(!$hasColumn('vehicle_documents','note')) $pdo->exec("ALTER TABLE vehicle_documents ADD COLUMN note VARCHAR(500) NOT NULL DEFAULT '' AFTER visibility");
    if(!$hasColumn('vehicle_documents','reminder_days')) $pdo->exec("ALTER TABLE vehicle_documents ADD COLUMN reminder_days SMALLINT UNSIGNED NOT NULL DEFAULT 30 AFTER note");
    if(!$hasColumn('vehicle_documents','status')) $pdo->exec("ALTER TABLE vehicle_documents ADD COLUMN status VARCHAR(24) NOT NULL DEFAULT 'active' AFTER reminder_days");
    try{$pdo->exec("CREATE INDEX idx_vdoc_status_expiry ON vehicle_documents(status,expires_at)");}catch(Throwable $e){}
};
