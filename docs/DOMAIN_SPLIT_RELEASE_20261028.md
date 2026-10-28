# KARETA domain split / staged integration release

Release candidate: `188.5.5.6.84.179`, source branch `feat/domain-shells-20261028`.

## Delivered in this candidate
- Host-resolved client (`client.kareta.kz`), specialist (`work.kareta.kz`), STO (`works.kareta.kz`), and shop (`shop.kareta.kz`) SPA entrypoints. All currently share the **existing** JS bundles, PHP backend and DB, not independent microservices.
- Identity-backed UI context affinity: mismatch shows role switch actions only for contexts actually returned by the authenticated Identity API. No localStorage role spoofing for the domain overlay; role selection goes through `KaretaIdentity.select` and existing server checks. Anonymous sign-in remains as-is.
- SPA initial route for the verified profile; app startup skips rendering the conflicting context's protected page and skips aggregate snapshot/prefetch during mismatch.
- Public portal displays direct destinations for four roles, and Web CTA points to client app; existing `m.kareta.kz` and `s.kareta.kz` remain compatible until gated cutover.
- Nginx role-host config is template-only and NOT installed. Exact 4-host mapping is asserted by automated tests.

## Explicit limitations / release blockers
- **Cross-subdomain SSO is NOT implemented.** Current session cookie defaults to host-only and `fetch` uses same-origin. Opening another subdomain may require signing in again. Shared credential database does NOT imply shared browser session; never weaken cookies or hand tokens through URLs.
- **UI host selection is NOT a security boundary.** Existing server-side context membership, capability and object ownership checks remain authoritative. A separate API authorization audit and negative tests are required before promoting this as strong role isolation.
- **DNS and Cloudflare Tunnel** ingress for the four role hosts are not yet configured; Nginx host template is staged only. No traffic switch was performed.
- **Live DB** manifest 137/144 inconsistency (PR #155) is unresolved; activating migrations 138–144 without independently authorized DB inventory/restore is prohibited.
- `kareta.kz` public portal cutover and `s.kareta.kz` retirement depend on verified routing and SSO; don't break old deep links or user session flows.

## Deployment controls
1. Verify source exact SHA, CI gates, separate backup of deployed static assets, Nginx and Tunnel configurations, and restore rehearsal.
2. Confirm actual DB and migration consistency independently, without autoheal or runtime bootstrap side effects.
3. Provide SSO across `auth.kareta.kz` with authorization code + PKCE, per-host host-only HttpOnly cookies, strict callback allowlist and CSRF controls. Test all role switches and logout.
4. Provision DNS and Tunnel ingress, then install and test a Nginx release-root substitution in the template. Validate with `nginx -t`, host-header HTTP and browser screenshot tests, while keeping public ingress off.
5. Gate each subdomain behind opt-in traffic release and monitor errors/rollbacks independently. Only then update portal links and redirect legacy deep links (302 initially).

## Local preview evidence
PHP CLI contract, Node.js VM tests and role-host HTTP responses using the candidate docroot. No live registration, browser authenticated test or production deploy is claimed.

### Browser smoke test (optional local QA)
The optional `tools/test_domain_browser_smoke.js` uses Puppeteer and an explicit local HTTP preview port (default 18091). Every `/api/` request is stubbed with 401, so test pages do not invoke live MySQL or mutate accounts; all other external hosts are blocked. This checks rendering/scripting and captures desktop/mobile screenshots for four role hosts plus legacy `m.kareta.kz`, and a separate DOM role-mismatch overlay. For portability, supply installed Puppeteer module location and browser executable via environment variables `KARETA_PUPPETEER_MODULE` and `KARETA_BROWSER_EXECUTABLE`. Run only against a local preview containing the candidate build; the script is not a replacement for authorized browser E2E.

Local execution on KaretaMeneger: PASS (11 screenshots, 0 JavaScript exceptions), evidence stored in `/home/karetadmin/kareta-workspace/kareta-domain-browser-evidence-20261028/report.json`. This is not a production test.
