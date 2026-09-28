<?php
declare(strict_types=1);
return [
  'version'=>76,
  'note'=>'R186.5 stage 5: session rotation, idle lifetime and grace period',
  'run'=>static function(PDO $pdo): void {
    $columns = $pdo->query("SHOW COLUMNS FROM auth_sessions")->fetchAll(PDO::FETCH_COLUMN);
    $add = static function(string $name, string $sql) use ($pdo, &$columns): void {
      if (!in_array($name, $columns, true)) { $pdo->exec("ALTER TABLE auth_sessions ADD COLUMN {$sql}"); $columns[]=$name; }
    };
    $add('absolute_expires_at', "absolute_expires_at DATETIME NULL AFTER expires_at");
    $add('idle_expires_at', "idle_expires_at DATETIME NULL AFTER absolute_expires_at");
    $add('rotated_at', "rotated_at DATETIME NULL AFTER revoked_at");
    $add('rotation_grace_until', "rotation_grace_until DATETIME NULL AFTER rotated_at");
    $add('rotation_reason', "rotation_reason VARCHAR(32) NULL AFTER rotation_grace_until");
    $add('rotated_to_session_id', "rotated_to_session_id BIGINT UNSIGNED NULL AFTER rotated_from_session_id");

    $indexes = $pdo->query("SHOW INDEX FROM auth_sessions")->fetchAll(PDO::FETCH_ASSOC);
    $indexNames = array_values(array_unique(array_map(static fn(array $r): string => (string)$r['Key_name'], $indexes)));
    if (!in_array('idx_auth_sessions_lifetime', $indexNames, true)) {
      $pdo->exec("ALTER TABLE auth_sessions ADD KEY idx_auth_sessions_lifetime(account_id,idle_expires_at,absolute_expires_at,revoked_at)");
    }
    if (!in_array('idx_auth_sessions_grace', $indexNames, true)) {
      $pdo->exec("ALTER TABLE auth_sessions ADD KEY idx_auth_sessions_grace(rotation_grace_until,revoked_at)");
    }

    $constraints = $pdo->query("SELECT CONSTRAINT_NAME FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='auth_sessions'")->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('fk_auth_sessions_rotated_to', $constraints, true)) {
      $pdo->exec("ALTER TABLE auth_sessions ADD CONSTRAINT fk_auth_sessions_rotated_to FOREIGN KEY(rotated_to_session_id) REFERENCES auth_sessions(id) ON DELETE SET NULL");
    }

    $pdo->exec("UPDATE auth_sessions SET absolute_expires_at=COALESCE(absolute_expires_at,expires_at), idle_expires_at=COALESCE(idle_expires_at,LEAST(expires_at,DATE_ADD(COALESCE(last_seen_at,created_at),INTERVAL 7 DAY)))");
  }
];
