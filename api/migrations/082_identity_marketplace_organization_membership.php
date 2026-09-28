<?php
return [
  'version'=>82,
  'note'=>'Marketplace ownership by organization membership and capabilities',
  'run'=>static function(PDO $pdo):void {
    $cols=[
      ['market_products','owner_context_id','BIGINT UNSIGNED NULL AFTER organization_id'],
      ['market_warehouses','owner_context_id','BIGINT UNSIGNED NULL AFTER organization_id'],
      ['market_orders','seller_context_id','BIGINT UNSIGNED NULL AFTER organization_id'],
      ['market_stock_movements','actor_context_id','BIGINT UNSIGNED NULL AFTER actor_user_id'],
    ];
    foreach($cols as [$table,$column,$ddl]){
      $st=$pdo->prepare("SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?");
      $st->execute([$table,$column]);
      if(!(int)$st->fetchColumn())$pdo->exec("ALTER TABLE `$table` ADD COLUMN `$column` $ddl");
    }
    $pdo->exec("CREATE TABLE IF NOT EXISTS market_organization_membership_links (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      organization_id VARCHAR(64) NOT NULL,
      context_id BIGINT UNSIGNED NOT NULL,
      person_id BIGINT UNSIGNED NOT NULL,
      membership_id BIGINT UNSIGNED NULL,
      capability_set_code VARCHAR(96) NOT NULL DEFAULT 'organization.seller',
      status VARCHAR(24) NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_market_org_person(organization_id,person_id),
      KEY idx_market_org_context(context_id,status),
      CONSTRAINT fk_market_org_context FOREIGN KEY(context_id) REFERENCES contexts(id) ON DELETE CASCADE,
      CONSTRAINT fk_market_org_person FOREIGN KEY(person_id) REFERENCES persons(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("INSERT INTO market_organization_membership_links(organization_id,context_id,person_id,membership_id,capability_set_code,status)
      SELECT c.organization_key,c.id,cm.person_id,cm.id,COALESCE(cs.code,'organization.seller'),'active'
      FROM contexts c JOIN context_members cm ON cm.context_id=c.id AND cm.status='active'
      LEFT JOIN capability_sets cs ON cs.id=cm.capability_set_id
      WHERE c.context_type='organization' AND c.status='active' AND c.organization_key IS NOT NULL
      ON DUPLICATE KEY UPDATE context_id=VALUES(context_id),membership_id=VALUES(membership_id),capability_set_code=VALUES(capability_set_code),status='active',updated_at=CURRENT_TIMESTAMP");
    $pdo->exec("UPDATE market_products p JOIN contexts c ON c.context_type='organization' AND c.organization_key=p.organization_id SET p.owner_context_id=c.id WHERE p.organization_id IS NOT NULL AND p.owner_context_id IS NULL");
    $pdo->exec("UPDATE market_warehouses w JOIN contexts c ON c.context_type='organization' AND c.organization_key=w.organization_id SET w.owner_context_id=c.id WHERE w.organization_id IS NOT NULL AND w.owner_context_id IS NULL");
    $pdo->exec("UPDATE market_orders o JOIN contexts c ON c.context_type='organization' AND c.organization_key=o.organization_id SET o.seller_context_id=c.id WHERE o.organization_id IS NOT NULL AND o.seller_context_id IS NULL");
    $st=$pdo->prepare("SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='market_products' AND INDEX_NAME='idx_market_product_context'");$st->execute();if(!(int)$st->fetchColumn())$pdo->exec("CREATE INDEX idx_market_product_context ON market_products(owner_context_id,status)");
  }
];
