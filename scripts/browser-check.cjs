// Browser check for the shared backup: set up a shop, download a backup, then restore it in a new browser.
// Needs Playwright and a built app being served at BASE (run: npm run build && npx vite preview --port 4173).
// Usage: node scripts/browser-check.js
const { chromium } = require('playwright');
const os = require('node:os');
const path = require('node:path');

const BASE = process.env.AUXO_BASE || 'http://localhost:4173/';
const PASS = 'long shared phrase 91';
const log = (...args) => console.log('[check]', ...args);

async function confirmRecoveryCode(page) {
  await page.getByRole('button', { name: 'Generate recovery code' }).click({ timeout: 15000 });
  const code = (await page.locator('.recovery-code').textContent({ timeout: 15000 })).trim();
  await page.getByLabel('Confirm recovery code').fill(code);
  await page.getByRole('button', { name: 'Save recovery code' }).click();
}

async function skipCategoriesIfAsked(page) {
  const save = page.getByRole('button', { name: 'Save and continue' });
  if (await save.waitFor({ state: 'visible', timeout: 10000 }).then(() => true, () => false)) {
    await page.getByLabel('General', { exact: true }).check().catch(() => {});
    await save.click();
  }
}

async function main() {
  const browser = await chromium.launch();
  const file = path.join(os.tmpdir(), 'auxo-browser-check.auxoshared');

  // Browser A: set up a shop with a name, then download a backup.
  const a = await browser.newContext({ acceptDownloads: true });
  const pa = await a.newPage();
  const errorsA = [];
  pa.on('pageerror', e => errorsA.push(String(e)));
  await pa.goto(BASE);
  await pa.getByRole('heading', { name: 'Set up Super Admin' }).waitFor({ timeout: 30000 });
  await pa.getByLabel('Your name').fill('Owner A');
  await pa.getByLabel('Username or email').fill('ownera');
  await pa.getByLabel('Password', { exact: true }).fill('RiverStoneSecret91');
  await pa.getByLabel('Confirm password').fill('RiverStoneSecret91');
  await pa.getByRole('button', { name: 'Create administrator' }).click();
  await confirmRecoveryCode(pa);
  await skipCategoriesIfAsked(pa);
  await pa.goto(BASE + '#/settings');
  await pa.getByLabel('Store name', { exact: true }).fill('E2E Shop', { timeout: 15000 });
  await pa.getByLabel('Address', { exact: true }).fill('Main Road 1');
  await pa.getByLabel('GSTIN').fill('27AAPFU0939F1ZV');
  await pa.getByLabel('GST state').selectOption('27');
  await pa.getByRole('button', { name: /Save business and billing settings/ }).click();
  await pa.getByText('saved on this device').waitFor({ timeout: 15000 });
  await pa.goto(BASE + '#/backups');
  await pa.getByLabel(/Backup passphrase/).first().fill(PASS);
  await pa.getByLabel('Confirm passphrase').fill(PASS);
  const download = pa.waitForEvent('download', { timeout: 30000 }).catch(() => null);
  await pa.getByRole('button', { name: 'Download encrypted backup' }).click();
  const got = await download;
  if (!got) throw new Error('No download. Page said: ' + (await pa.locator('[role=alert]').allTextContents()).join(' | '));
  await got.saveAs(file);
  log('backup downloaded from browser A; page errors:', errorsA.length ? errorsA : 'none');

  // Browser B: a brand-new browser. Restore from the file instead of setting up.
  const b = await browser.newContext();
  const pb = await b.newPage();
  const errorsB = [];
  pb.on('pageerror', e => errorsB.push(String(e)));
  await pb.goto(BASE);
  await pb.getByRole('button', { name: 'Restore a backup instead' }).click({ timeout: 30000 });
  await pb.locator('input[type=file]').setInputFiles(file);
  await pb.getByLabel('Backup passphrase').fill(PASS);
  await pb.getByRole('button', { name: 'Check backup' }).click();
  await pb.getByText('E2E Shop').first().waitFor({ timeout: 30000 });
  log('browser B read the file and shows the shop name');
  await pb.getByLabel('Your name').fill('Owner B');
  await pb.getByLabel('Username').fill('ownerb');
  await pb.getByLabel('Password', { exact: true }).fill('AnotherStrongPass91');
  await pb.getByLabel('Confirm password').fill('AnotherStrongPass91');
  await pb.getByRole('button', { name: 'Create login and restore' }).click();
  await confirmRecoveryCode(pb);
  await pb.getByRole('heading', { name: 'Business overview' }).waitFor({ timeout: 30000 });
  await pb.goto(BASE + '#/settings');
  const field = pb.getByLabel('Store name', { exact: true });
  await field.waitFor({ timeout: 30000 });
  await pb.waitForFunction(() => {
    const input = [...document.querySelectorAll('label')].find(l => l.textContent.trim().startsWith('Store name'))?.querySelector('input');
    return Boolean(input && input.value);
  }, null, { timeout: 30000 });
  const storeName = await field.inputValue();
  log('shop name in browser B after restore:', storeName);
  log('page errors in B:', errorsB.length ? errorsB : 'none');
  await browser.close();
  if (storeName !== 'E2E Shop') throw new Error('Restore check failed: shop name is ' + JSON.stringify(storeName));
  log('PASS');
}

main().catch(error => {
  console.error('[check] FAILED:', error.message);
  process.exit(1);
});
