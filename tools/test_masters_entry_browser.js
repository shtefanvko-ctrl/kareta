'use strict';

// Run with Playwright and its Chromium browser installed.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');

async function run() {
  const browser = await chromium.launch();
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.route('http://entry.test/**', route => route.fulfill({
        contentType: 'text/html; charset=utf-8',
        body: '<a href="#/masters">Мастера</a><main></main>'
      }));
      await page.goto('http://entry.test/#/masters?type=sto');
      await page.evaluate(() => {
        window.KaretaOnboardingProfileDraft = { read: () => ({}), patch() {} };
        window.KaretaOnboardingApi = {};
        window.KaretaOnboardingNavigation = {};
        window.KaretaOnboardingProfilePages = { openFromRoute: () => true };
      });
      for (const file of ['onboarding_state', 'onboarding_router', 'post_auth_first_entry_resolver',
        'onboarding_app', 'onboarding_lifecycle']) {
        await page.addScriptTag({ path: path.join(root, 'js/next/onboarding', file + '.js') });
      }
      await page.addScriptTag({ path: path.join(root, 'js/next/pages/masters.js') });
      await page.evaluate(() => window.KaretaOnboardingLifecycle.boot());
      assert.equal(await page.evaluate(() => window.KaretaOnboardingRouter.catalogEntry()), '#/masters?type=sto');
      await page.getByRole('link', { name: 'Мастера' }).click();
      assert.equal(new URL(page.url()).hash, '#role:client:welcome');
      const result = await page.evaluate(async () => {
        const app = window.KaretaOnboardingApp;
        const router = window.KaretaOnboardingRouter;
        window.KaretaIdentity = { snapshot: () => ({ loaded: true, authenticated: true, context: { type: 'personal' } }) };
        const client = () => app.authoritativeTargetAfterAuth({}, {}, { role: 'client' });
        const target = await client();
        const repeat = await client();
        const rejected = router.rememberCatalogEntry('https://example.com/');
        router.rememberCatalogEntry('#/masters');
        const seller = await app.authoritativeTargetAfterAuth({}, {}, { role: 'seller' });
        const afterSeller = await client();
        router.rememberCatalogEntry('#/masters');
        window.KaretaIdentity.snapshot = () => ({ loaded: true, authenticated: false });
        const anonymous = await client();
        history.replaceState(null, '', target);
        document.querySelector('main').innerHTML = window.KaretaMastersPages.renderMasters();
        return { target, repeat, rejected, seller, afterSeller, anonymous };
      });
      assert.deepEqual(result, { target: '#/masters', repeat: '#/home', rejected: false,
        seller: '#/seller', afterSeller: '#/home', anonymous: '#/home' });
      await page.getByRole('link', { name: 'Открыть карту СТО и мастеров' }).click();
      assert.equal(new URL(page.url()).hash, '#/home?map=1');
      console.log('PASS catalog entry, role boundaries and map link, width', width);
      await page.close();
    }
  } finally { await browser.close(); }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
