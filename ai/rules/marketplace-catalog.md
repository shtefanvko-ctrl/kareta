# Marketplace / Seller / Product Catalog Rules

Load for parts, seller, shop, product import, categories, SKU/OEM, stock, pricing or fitment.

## Verified current boundaries
- `api/catalog/product_catalog.php` treats protected JSON as an import source; runtime product reads are MySQL-backed.
- Source validation already includes schema version, record count and SHA-256 integrity.
- Client shop requests are bounded by search/category/limit rather than requiring the full catalog at startup.
- Seller mutations remain server actions with seller context/capability enforcement.

## Invariants
- Keep one authoritative runtime record per product identity; do not create a client-side second source of truth.
- Preserve SKU, OEM, brand, category, price, stock and fitment semantics.
- New import sources declare source identity, schema/version and integrity evidence.
- Large product/category/tool arrays load progressively and only for the route/query needing them.
- Never attach the full product catalog to login/bootstrap.
- Stock/order changes are server-authoritative; cache invalidation must not fabricate availability.
- Seller CRUD and client catalog views converge on compatible product contracts.

## Verification
Validate import/schema/integrity, bounded catalog retrieval, seller authorization, stock mutation and a client-visible read-after-write path when those contracts change.
