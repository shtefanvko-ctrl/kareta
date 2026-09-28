<?php
return [
 'version'=>69,
 'note'=>'Marketplace products, warehouses, stock, carts, orders, reservations and movements',
 'run'=>static function(PDO $pdo):void {
  $pdo->exec("CREATE TABLE IF NOT EXISTS market_products (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_key VARCHAR(64) NOT NULL,
    owner_user_id BIGINT UNSIGNED NOT NULL,
    organization_id VARCHAR(64) NULL,
    sku VARCHAR(96) NOT NULL,
    title VARCHAR(255) NOT NULL,
    brand VARCHAR(128) NULL,
    oem_number VARCHAR(128) NULL,
    price DECIMAL(14,2) NOT NULL DEFAULT 0,
    currency CHAR(3) NOT NULL DEFAULT 'KZT',
    status VARCHAR(24) NOT NULL DEFAULT 'active',
    payload_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_market_product_key(product_key),
    UNIQUE KEY uq_market_product_org_sku(organization_id,sku),
    KEY idx_market_product_owner(owner_user_id,status),
    KEY idx_market_product_search(title,brand,oem_number)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
  $pdo->exec("CREATE TABLE IF NOT EXISTS market_warehouses (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    warehouse_key VARCHAR(64) NOT NULL,
    owner_user_id BIGINT UNSIGNED NOT NULL,
    organization_id VARCHAR(64) NULL,
    title VARCHAR(255) NOT NULL,
    address VARCHAR(255) NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_market_warehouse_key(warehouse_key),
    KEY idx_market_warehouse_org(organization_id,status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
  $pdo->exec("CREATE TABLE IF NOT EXISTS market_stock (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    warehouse_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,
    quantity DECIMAL(14,3) NOT NULL DEFAULT 0,
    reserved DECIMAL(14,3) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_market_stock(warehouse_id,product_id),
    CONSTRAINT fk_market_stock_warehouse FOREIGN KEY(warehouse_id) REFERENCES market_warehouses(id) ON DELETE CASCADE,
    CONSTRAINT fk_market_stock_product FOREIGN KEY(product_id) REFERENCES market_products(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
  $pdo->exec("CREATE TABLE IF NOT EXISTS market_carts (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    cart_key VARCHAR(64) NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_market_cart_key(cart_key),
    KEY idx_market_cart_user(user_id,status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
  $pdo->exec("CREATE TABLE IF NOT EXISTS market_cart_items (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    cart_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,
    quantity DECIMAL(12,3) NOT NULL DEFAULT 1,
    unit_price DECIMAL(14,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_market_cart_item(cart_id,product_id),
    CONSTRAINT fk_market_cart_item_cart FOREIGN KEY(cart_id) REFERENCES market_carts(id) ON DELETE CASCADE,
    CONSTRAINT fk_market_cart_item_product FOREIGN KEY(product_id) REFERENCES market_products(id) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
  $pdo->exec("CREATE TABLE IF NOT EXISTS market_orders (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_key VARCHAR(64) NOT NULL,
    buyer_user_id BIGINT UNSIGNED NOT NULL,
    seller_user_id BIGINT UNSIGNED NULL,
    organization_id VARCHAR(64) NULL,
    invoice_key VARCHAR(64) NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'reserved',
    total_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
    currency CHAR(3) NOT NULL DEFAULT 'KZT',
    delivery_method VARCHAR(32) NOT NULL DEFAULT 'pickup',
    payload_json JSON NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_market_order_key(order_key),
    KEY idx_market_order_buyer(buyer_user_id,status),
    KEY idx_market_order_org(organization_id,status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
  $pdo->exec("CREATE TABLE IF NOT EXISTS market_order_items (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,
    warehouse_id BIGINT UNSIGNED NOT NULL,
    quantity DECIMAL(12,3) NOT NULL,
    unit_price DECIMAL(14,2) NOT NULL,
    line_total DECIMAL(14,2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_market_order_item(order_id),
    CONSTRAINT fk_market_order_item_order FOREIGN KEY(order_id) REFERENCES market_orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_market_order_item_product FOREIGN KEY(product_id) REFERENCES market_products(id) ON DELETE RESTRICT,
    CONSTRAINT fk_market_order_item_warehouse FOREIGN KEY(warehouse_id) REFERENCES market_warehouses(id) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
  $pdo->exec("CREATE TABLE IF NOT EXISTS market_stock_movements (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    movement_key VARCHAR(80) NOT NULL,
    warehouse_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,
    actor_user_id BIGINT UNSIGNED NOT NULL,
    movement_type VARCHAR(24) NOT NULL,
    quantity DECIMAL(14,3) NOT NULL,
    reference_type VARCHAR(48) NULL,
    reference_key VARCHAR(128) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_market_movement_key(movement_key),
    KEY idx_market_movement_stock(warehouse_id,product_id,created_at),
    CONSTRAINT fk_market_movement_warehouse FOREIGN KEY(warehouse_id) REFERENCES market_warehouses(id) ON DELETE RESTRICT,
    CONSTRAINT fk_market_movement_product FOREIGN KEY(product_id) REFERENCES market_products(id) ON DELETE RESTRICT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
 }
];
