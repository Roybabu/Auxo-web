// Offline check: load AUXO, save a shop, go offline, reload, and confirm the app opens with the data still there.
// Needs Playwright and a built app served at BASE.
const { chromium } = require('playwright');

const BASE = process.env.AUXO_BASE || 'http://localhost:4173/';
const log = (...args) => console.log('[offline-check]', ...args);

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));

  await page.goto(BASE);
  await page.getByRole('heading', { name: 'Set up Super Admin' }).waitFor({ timeout: 30000 });
  await page.getByLabel('Your name').fill('Offline Owner');
  await page.getByLabel('Username or email').fill('offlineowner');
  await page.getByLabel('Password', { exact: true }).fill('RiverStoneSecret91');
  await page.getByLabel('Confirm password').fill('RiverStoneSecret91');
  await page.getByRole('button', { name: 'Create administrator' }).click();
  await page.getByRole('button', { name: 'Generate recovery code' }).click({ timeout: 15000 });
  const code = (await page.locator('.recovery-code').textContent({ timeout: 15000 })).trim();
  await page.getByLabel('Confirm recovery code').fill(code);
  await page.getByRole('button', { name: 'Save recovery code' }).click();
  const save = page.getByRole('button', { name: 'Save and continue' });
  if (await save.waitFor({ state: 'visible', timeout: 10000 }).then(() => true, () => false)) {
    await page.getByLabel('General', { exact: true }).check().catch(() => {});
    await save.click();
  }
  await page.goto(BASE + '#/settings');
  await page.getByLabel('Store name', { exact: true }).fill('Offline Shop');
  await page.getByLabel('Address', { exact: true }).fill('Main Road 1');
  await page.getByLabel('GSTIN').fill('27AAPFU0939F1ZV');
  await page.getByLabel('GST state').selectOption('27');
  await page.getByRole('button', { name: /Save business and billing settings/ }).click();
  await page.getByText('saved on this device').waitFor({ timeout: 15000 });
  log('shop saved while online');

  // Make sure the service worker has taken control, so the app shell is cached.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await page.waitForTimeout(2000);
  const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
  log('service worker controlling the page:', controlled);

  await context.setOffline(true);
  log('network switched off');
  await page.reload();
  const shell = await page.locator('body').innerText({ timeout: 30000 });
  log('app opened offline:', shell.includes('AUXO') ? 'yes' : 'no');

  // A reload signs out (sessions live in memory only), so sign in again while offline.
  await page.getByLabel('Username or email').fill('offlineowner');
  await page.getByLabel('Password', { exact: true }).fill('RiverStoneSecret91');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('link', { name: 'Settings' }).waitFor({ timeout: 30000 }).catch(() => {});
  await page.goto(BASE + '#/settings');
  const field = page.getByLabel('Store name', { exact: true });
  await field.waitFor({ timeout: 30000 });
  await page.waitForFunction(() => {
    const input = [...document.querySelectorAll('label')].find(l => l.textContent.trim().startsWith('Store name'))?.querySelector('input');
    return Boolean(input && input.value);
  }, null, { timeout: 30000 });
  const storeName = await field.inputValue();
  log('shop name offline:', storeName);
  log('page errors:', errors.length ? errors : 'none');
  await context.setOffline(false);
  await browser.close();
  if (storeName !== 'Offline Shop') throw new Error('Offline check failed: shop name is ' + JSON.stringify(storeName));
  log('PASS');
}

main().catch(error => {
  console.error('[offline-check] FAILED:', error.message);
  process.exit(1);
});
