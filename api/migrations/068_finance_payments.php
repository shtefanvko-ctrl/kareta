<?php
return [
 'version'=>68,
 'note'=>'Finance estimates, invoices, payment transactions, refunds and immutable ledger',
 'run'=>static function(PDO $pdo):void {
  $pdo->exec("CREATE TABLE IF NOT EXISTS finance_estimates (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    estimate_key VARCHAR(64) NOT NULL,
    owner_user_id BIGINT UNSIGNED NOT NULL,
    organization_id VARCHAR(64) NULL,
    entity_type VARCHAR(64) NULL,
    entity_key VARCHAR(128) NULL,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'draft',
    currency CHAR(3) NOT NULL DEFAULT 'KZT',
    subtotal DECIMAL(14,2) NOT NULL DEFAULT 0,
    discount_total DECIMAL(14,2) NOT NULL DEFAULT 0,
    tax_total DECIMAL(14,2) NOT NULL DEFAULT 0,
    grand_total DECIMAL(14,2) NOT NULL DEFAULT 0,
    version_no INT UNSIGNED NOT NULL DEFAULT 1,
    payload_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_finance_estimate_key(estimate_key),
    KEY idx_finance_estimate_owner(owner_user_id,status),
    KEY idx_finance_estimate_org(organization_id,status),
    KEY idx_finance_estimate_entity(entity_type,entity_key)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
  $pdo->exec("CREATE TABLE IF NOT EXISTS finance_estimate_items (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    estimate_id BIGINT UNSIGNED NOT NULL,
    item_type VARCHAR(24) NOT NULL DEFAULT 'service',
    title VARCHAR(255) NOT NULL,
    quantity DECIMAL(12,3) NOT NULL DEFAULT 1,
    unit_price DECIMAL(14,2) NOT NULL DEFAULT 0,
    line_total DECIMAL(14,2) NOT NULL DEFAULT 0,
    payload_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_finance_estimate_item(estimate_id),
    CONSTRAINT fk_finance_estimate_item_estimate FOREIGN KEY(estimate_id) REFERENCES finance_estimates(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
  $pdo->exec("CREATE TABLE IF NOT EXISTS finance_invoices (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    invoice_key VARCHAR(64) NOT NULL,
    estimate_id BIGINT UNSIGNED NULL,
    owner_user_id BIGINT UNSIGNED NOT NULL,
    organization_id VARCHAR(64) NULL,
    payer_user_id BIGINT UNSIGNED NULL,
    entity_type VARCHAR(64) NULL,
    entity_key VARCHAR(128) NULL,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'draft',
    currency CHAR(3) NOT NULL DEFAULT 'KZT',
    total_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
    paid_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
    due_at DATETIME NULL,
    sent_at DATETIME NULL,
    paid_at DATETIME NULL,
    payload_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_finance_invoice_key(invoice_key),
    KEY idx_finance_invoice_owner(owner_user_id,status),
    KEY idx_finance_invoice_org(organization_id,status),
    KEY idx_finance_invoice_entity(entity_type,entity_key),
    CONSTRAINT fk_finance_invoice_estimate FOREIGN KEY(estimate_id) REFERENCES finance_estimates(id) ON DELETE SET NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
  $pdo->exec("CREATE TABLE IF NOT EXISTS finance_transactions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    transaction_key VARCHAR(64) NOT NULL,
    invoice_id BIGINT UNSIGNED NOT NULL,
    payment_key VARCHAR(64) NULL,
    payer_user_id BIGINT UNSIGNED NOT NULL,
    payee_user_id BIGINT UNSIGNED NULL,
    organization_id VARCHAR(64) NULL,
    amount DECIMAL(14,2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'KZT',
    method VARCHAR(32) NOT NULL DEFAULT 'manual',
    status VARCHAR(24) NOT NULL DEFAULT 'completed',
    payload_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_finance_transaction_key(transaction_key),
    KEY idx_finance_transaction_invoice(invoice_id,status),
    CONSTRAINT fk_finance_transaction_invoice FOREIGN KEY(invoice_id) REFERENCES finance_invoices(id) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
  $pdo->exec("CREATE TABLE IF NOT EXISTS finance_refunds (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    refund_key VARCHAR(64) NOT NULL,
    transaction_id BIGINT UNSIGNED NOT NULL,
    owner_user_id BIGINT UNSIGNED NOT NULL,
    amount DECIMAL(14,2) NOT NULL,
    reason VARCHAR(255) NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'completed',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_finance_refund_key(refund_key),
    KEY idx_finance_refund_transaction(transaction_id),
    CONSTRAINT fk_finance_refund_transaction FOREIGN KEY(transaction_id) REFERENCES finance_transactions(id) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
  $pdo->exec("CREATE TABLE IF NOT EXISTS finance_ledger (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ledger_key VARCHAR(96) NOT NULL,
    owner_user_id BIGINT UNSIGNED NOT NULL,
    organization_id VARCHAR(64) NULL,
    account_code VARCHAR(64) NOT NULL,
    entry_type ENUM('debit','credit') NOT NULL,
    amount DECIMAL(14,2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'KZT',
    reference_type VARCHAR(64) NOT NULL,
    reference_key VARCHAR(128) NOT NULL,
    description VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_finance_ledger_key(ledger_key),
    KEY idx_finance_ledger_owner(owner_user_id,created_at),
    KEY idx_finance_ledger_org(organization_id,created_at),
    KEY idx_finance_ledger_ref(reference_type,reference_key)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
 }
];
