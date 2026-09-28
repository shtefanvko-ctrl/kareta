const fs = require('fs');
const css = fs.readFileSync('css/next/desktop_card_grid_expansion.css','utf8');
const registry = fs.readFileSync('inc/asset_registry.php','utf8');
const fail = (m) => { throw new Error(m); };
const has = (re, m) => { if (!re.test(css)) fail(m); };
has(/@media\s*\(min-width:\s*1100px\)[\s\S]*?\.k-client-cabinet-grid[\s\S]*?repeat\(3,\s*minmax\(0,\s*1fr\)\)/, 'client cabinet must become 3 columns');
has(/@media\s*\(min-width:\s*1800px\)[\s\S]*?\.k-client-cabinet-grid[\s\S]*?repeat\(4,\s*minmax\(0,\s*1fr\)\)/, 'client cabinet must become 4 columns on wide desktop');
has(/@media\s*\(min-width:\s*1200px\)[\s\S]*?\.k-provider-grid[\s\S]*?repeat\(3,\s*minmax\(0,\s*1fr\)\)/, 'provider directory must become 3 columns');
has(/@media\s*\(min-width:\s*1900px\)[\s\S]*?\.k-provider-grid[\s\S]*?repeat\(4,\s*minmax\(0,\s*1fr\)\)/, 'provider directory must become 4 columns on ultra-wide desktop');
has(/@media\s*\(min-width:\s*1600px\)[\s\S]*?\.k-work-feed-grid[\s\S]*?repeat\(4,\s*minmax\(0,\s*1fr\)\)/, 'work feed must become 4 columns on wide desktop');
has(/@media\s*\(min-width:\s*1400px\)[\s\S]*?\.k-market-products[\s\S]*?repeat\(3,\s*minmax\(0,\s*1fr\)\)/, 'market products must become 3 columns');
has(/@media\s*\(min-width:\s*2000px\)[\s\S]*?\.k-market-products[\s\S]*?repeat\(4,\s*minmax\(0,\s*1fr\)\)/, 'market products must become 4 columns on ultra-wide desktop');
for (const forbidden of ['.k-request-grid','.k-lifecycle-check-grid','.k-op-fin-grid','.k-workflow-board']) {
  if (css.includes(forbidden)) fail(`must not alter operational grid ${forbidden}`);
}
if (!registry.includes('desktop_card_grid_expansion.css')) fail('release stylesheet must be registered');
console.log('R188.5.5.6.40 sensible desktop card grids: OK');
