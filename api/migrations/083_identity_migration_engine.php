<?php
declare(strict_types=1);

return [
    'version' => 83,
    'note' => 'R186.5 stage 14A: controlled idempotent identity migration engine metadata',
    'run' => static function (PDO $pdo): void {
        $pdo->exec("CREATE TABLE IF NOT EXISTS identity_migration_runs (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            run_key CHAR(36) NOT NULL,
            mode ENUM('dry_run','apply') NOT NULL,
            status ENUM('running','completed','failed','cancelled') NOT NULL DEFAULT 'running',
            started_by_user_id BIGINT UNSIGNED NULL,
            cursor_user_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
            scanned_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
            migrated_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
            unchanged_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
            conflict_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
            failed_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
            summary_json JSON NULL,
            error_message VARCHAR(500) NULL,
            started_at DATETIME NOT NULL,
            finished_at DATETIME NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_identity_migration_run_key (run_key),
            KEY idx_identity_migration_status (status,created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS identity_legacy_links (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            legacy_type VARCHAR(48) NOT NULL,
            legacy_id VARCHAR(96) NOT NULL,
            account_id BIGINT UNSIGNED NOT NULL,
            person_id BIGINT UNSIGNED NOT NULL,
            profile_id BIGINT UNSIGNED NULL,
            context_id BIGINT UNSIGNED NULL,
            fingerprint CHAR(64) NOT NULL,
            migration_revision INT UNSIGNED NOT NULL DEFAULT 1,
            migrated_at DATETIME NOT NULL,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_identity_legacy_entity (legacy_type,legacy_id),
            KEY idx_identity_legacy_account (account_id),
            KEY idx_identity_legacy_person (person_id),
            CONSTRAINT fk_identity_legacy_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
            CONSTRAINT fk_identity_legacy_person FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE,
            CONSTRAINT fk_identity_legacy_profile FOREIGN KEY (profile_id) REFERENCES person_profiles(id) ON DELETE SET NULL,
            CONSTRAINT fk_identity_legacy_context FOREIGN KEY (context_id) REFERENCES contexts(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

        $pdo->exec("CREATE TABLE IF NOT EXISTS identity_migration_conflicts (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            run_id BIGINT UNSIGNED NULL,
            conflict_key CHAR(64) NOT NULL,
            legacy_type VARCHAR(48) NOT NULL,
            legacy_id VARCHAR(96) NOT NULL DEFAULT '',
            normalized_phone VARCHAR(32) NOT NULL DEFAULT '',
            conflict_type VARCHAR(64) NOT NULL,
            severity ENUM('warning','blocking') NOT NULL DEFAULT 'blocking',
            status ENUM('open','resolved','ignored') NOT NULL DEFAULT 'open',
            details_json JSON NULL,
            resolution_json JSON NULL,
            first_seen_at DATETIME NOT NULL,
            last_seen_at DATETIME NOT NULL,
            resolved_at DATETIME NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uq_identity_conflict_key (conflict_key),
            KEY idx_identity_conflicts_status (status,severity,last_seen_at),
            KEY idx_identity_conflicts_phone (normalized_phone,status),
            CONSTRAINT fk_identity_conflict_run FOREIGN KEY (run_id) REFERENCES identity_migration_runs(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
    },
];
