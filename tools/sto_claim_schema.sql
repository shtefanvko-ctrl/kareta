-- KARETA pre-claim candidate directory; deploy only via approved migration lane.
-- Separate from sto_profiles: an unclaimed listing is NEVER a working account.
CREATE TABLE IF NOT EXISTS sto_directory_candidates (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  fingerprint CHAR(64) NOT NULL,
  name VARCHAR(191) NOT NULL,
  city VARCHAR(120) NOT NULL,
  address VARCHAR(255) NOT NULL DEFAULT '',
  description TEXT NULL,
  source_url VARCHAR(512) NOT NULL,
  source_checked_at DATETIME NULL,
  directory_visible TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('unclaimed','claimed_pending_setup','activated','hidden','disputed') NOT NULL DEFAULT 'unclaimed',
  linked_sto_id VARCHAR(64) NULL,
  approved_owner_account_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sto_directory_fingerprint (fingerprint),
  UNIQUE KEY uq_sto_directory_link (linked_sto_id),
  KEY idx_sto_directory_public (status,directory_visible,city),
  KEY idx_sto_directory_owner (approved_owner_account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sto_directory_claims (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  candidate_id VARCHAR(64) NOT NULL,
  claimant_account_id BIGINT UNSIGNED NOT NULL,
  claimant_user_id BIGINT UNSIGNED NOT NULL,
  evidence_method ENUM('registry','official_website','authorization_letter','onsite') NOT NULL,
  evidence_reference VARCHAR(512) NOT NULL,
  status ENUM('pending','approved','rejected','withdrawn') NOT NULL DEFAULT 'pending',
  reviewer_account_id BIGINT UNSIGNED NULL,
  verification_method VARCHAR(48) NULL,
  verification_reference VARCHAR(512) NULL,
  reviewed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sto_claim_account (candidate_id,claimant_account_id),
  KEY idx_sto_claim_review (status,created_at),
  KEY idx_sto_claim_claimant (claimant_account_id,status,created_at),
  CONSTRAINT fk_sto_claim_candidate FOREIGN KEY (candidate_id) REFERENCES sto_directory_candidates(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sto_directory_claim_audit (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  claim_id BIGINT UNSIGNED NULL,
  candidate_id VARCHAR(64) NOT NULL,
  actor_account_id BIGINT UNSIGNED NOT NULL,
  event_type VARCHAR(48) NOT NULL,
  metadata_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_sto_claim_audit_candidate (candidate_id,created_at),
  KEY idx_sto_claim_audit_actor (actor_account_id,created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;