<?php
declare(strict_types=1);
return [
  'version'=>75,
  'note'=>'R186.5 stage 4: identity session core support',
  'run'=>static function(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS identity_session_audit (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      account_id BIGINT UNSIGNED NULL,
      auth_session_id BIGINT UNSIGNED NULL,
      challenge_id BIGINT UNSIGNED NULL,
      event_type VARCHAR(64) NOT NULL,
      request_id VARCHAR(64) NULL,
      ip_prefix VARCHAR(64) NULL,
      user_agent_hash CHAR(64) NULL,
      payload_json JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(id),
      KEY idx_identity_session_audit_account(account_id,created_at),
      KEY idx_identity_session_audit_event(event_type,created_at),
      CONSTRAINT fk_identity_session_audit_account FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE SET NULL,
      CONSTRAINT fk_identity_session_audit_session FOREIGN KEY(auth_session_id) REFERENCES auth_sessions(id) ON DELETE SET NULL,
      CONSTRAINT fk_identity_session_audit_challenge FOREIGN KEY(challenge_id) REFERENCES auth_challenges(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    $pdo->exec("UPDATE person_profiles SET status='active' WHERE profile_type='client' AND status='draft'");
  }
];
