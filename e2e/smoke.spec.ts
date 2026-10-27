import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

/** Console errors/warnings and uncaught page errors; only failed Google Fonts fetches (offline machines) are ignored. */
function watchConsole(page: Page): string[] {
  const problems: string[] = [];
  const fontHost = /fonts\.(googleapis|gstatic)\.com/;
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() !== 'error' && msg.type() !== 'warning') return;
    if (fontHost.test(msg.location().url) || fontHost.test(msg.text())) return;
    problems.push(`${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
  return problems;
}

test('smoke: deal a hand with Banker + Dragon 7, visit Learn and the drills, run a Lab simulation', async ({ page }) => {
  const problems = watchConsole(page);

  // Play
  await page.goto('/#play');
  const view = page.getByTestId('play-view');
  await expect(view).toBeVisible();
  await page.getByLabel('Dealing speed').selectOption('instant'); // the Rail's speed selector
  await expect(view).toHaveAttribute('data-phase', 'idle', { timeout: 20_000 }); // the opening shuffle (started at normal speed) ends
  await expect(page.getByTestId('dealer-call')).toHaveText(/place your bets/i);
  const banker = page.locator('[data-bet="banker"]');
  const dragon7 = page.locator('[data-bet="dragon7"]');
  await page.getByTestId('chip-25').click();
  await banker.click();
  await dragon7.click();
  await expect(banker).toHaveAttribute('data-amount', '25');
  await expect(dragon7).toHaveAttribute('data-amount', '25');
  await expect(page.getByTestId('table-bankroll')).toContainText('On layout $50');
  await page.getByTestId('deal-button').click();
  await expect(page.getByTestId('dealer-call')).toHaveText(/wins, \d over \d|Tie, \d and \d|Dragon 7!|Panda 8!/);
  const status = page.getByTestId('settlement-status');
  await expect(status).toHaveText(/^You won \$|^You lost \$|^Push — your bets are returned$/);
  const bankroll = Number(await page.getByTestId('table-bankroll').locator('[data-value]').getAttribute('data-value'));
  const statusText = (await status.textContent()) ?? '';
  const amount = Number(statusText.replace(/[^0-9.]/g, ''));
  if (statusText.startsWith('Push')) expect(bankroll).toBe(1000);
  if (statusText.startsWith('You won')) expect(bankroll).toBe(1000 + amount);
  if (statusText.startsWith('You lost')) expect(bankroll).toBe(1000 - amount);
  await expect(page.getByTestId('bankroll-pill')).toHaveAttribute('data-value', String(bankroll)); // top bar agrees with the table
  await expect(page.getByText(/^Hand 1$/)).toBeVisible(); // scoreboard
  await expect(page.getByTestId('history-panel')).toContainText('1 hands');
  const cards = await page.locator('[data-dealt]').count();
  expect(cards).toBeGreaterThanOrEqual(4);
  // A three-card hand shows its third card sideways.
  const playerCards = await page.locator('[data-side="player"] [data-dealt]').count();
  if (playerCards === 3) await expect(page.locator('[data-side="player"] [data-rotated]')).toHaveCount(1);

  // Learn: index → lesson → drills hub → a drill
  await page.locator('nav[aria-label="Mode"] a[data-mode="learn"]').click();
  await expect(page.locator('[data-learn-route="index"]')).toBeVisible();
  await page.locator('[data-lesson-link="third-card"]').click();
  await expect(page.locator('[data-lesson="third-card"]')).toBeVisible();
  await page.locator('[data-lesson-link="drills"]').click();
  await expect(page.getByTestId('drills-hub')).toBeVisible();
  await page.getByTestId('open-third-card').click();
  await expect(page.getByTestId('drill-question')).toBeVisible();
  await expect(page).toHaveURL(/#learn\/drills\/third-card$/);

  // Lab: 20 trials × 2 shoes, real Web Worker
  await page.locator('nav[aria-label="Mode"] a[data-mode="lab"]').click();
  await expect(page.getByTestId('lab-view')).toBeVisible();
  await page.getByTestId('lab-preset-flatBanker').click();
  await page.getByLabel('Shoes per trial', { exact: true }).fill('2');
  await page.getByLabel('Trials', { exact: true }).fill('20');
  await expect(page.getByLabel('Trials', { exact: true })).toHaveValue('20');
  await page.getByTestId('lab-run').click();
  const results = page.getByTestId('lab-results');
  await expect(results).toBeVisible({ timeout: 30_000 });
  await expect(results).not.toHaveAttribute('aria-busy', 'true');
  await expect(page.getByTestId('lab-strategy')).toContainText(/Always Banker/);
  await expect(page.getByTestId('lab-stats')).toBeVisible();
  await expect(page.getByTestId('lab-histogram')).toBeVisible();
  await expect(page.getByTestId('lab-curves')).toBeVisible();

  // A lesson's "Lab preset" link opens the Lab with that preset selected.
  await page.goto('/#lab/martingalePlayer');
  await expect(page.getByTestId('lab-preset-martingalePlayer')).toHaveAttribute('aria-pressed', 'true');

  // Persistence and console
  const keys = await page.evaluate(() => Object.keys(window.localStorage));
  expect(keys.length).toBeGreaterThan(0);
  for (const key of keys) expect(key).toMatch(/^bt:/);
  expect(problems).toEqual([]);
});

test('rule presets: commission box and Super 6 note, side bets disappear when switched off, settings survive a reload', async ({ page }) => {
  const problems = watchConsole(page);
  await page.goto('/#play');
  const view = page.getByTestId('play-view');
  await page.getByLabel('Dealing speed').selectOption('instant');
  await expect(view).toHaveAttribute('data-phase', 'idle', { timeout: 20_000 });

  await page.getByTestId('settings-button').click();
  await page.getByTestId('preset-commission').click();
  await page.getByTestId('apply-rules').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(view).toHaveAttribute('data-phase', 'idle', { timeout: 20_000 });
  await expect(page.getByTestId('commission-box')).toBeVisible();
  await expect(page.locator('[data-bet="dragon7"]')).toHaveCount(0);
  await expect(page.locator('[data-bet="panda8"]')).toHaveCount(0);

  await page.getByTestId('settings-button').click();
  await page.getByTestId('preset-super6').click();
  await page.getByTestId('apply-rules').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByTestId('super6-box')).toBeVisible();
  await expect(page.locator('[data-bet="banker"]')).toContainText(/Banker 6 pays 1 to 2/);

  await page.getByTestId('settings-button').click();
  await page.getByTestId('preset-ez').click();
  await page.getByRole('switch', { name: /^pair/i }).click();
  await page.getByTestId('apply-rules').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('[data-bet="playerPair"]')).toHaveCount(0);
  await expect(page.locator('[data-bet="bankerPair"]')).toHaveCount(0);
  await expect(page.locator('[data-bet="dragon7"]')).toHaveCount(1);

  await page.getByTestId('sound-toggle').click();
  await expect(page.getByTestId('sound-toggle')).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await expect(view).toHaveAttribute('data-phase', 'idle', { timeout: 20_000 });
  await expect(page.locator('[data-bet="playerPair"]')).toHaveCount(0);
  await expect(page.getByTestId('sound-toggle')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByLabel('Dealing speed')).toHaveValue('instant');
  expect(problems).toEqual([]);
});

test('no horizontal overflow at 380, 768 and 1440 px in every mode', async ({ page }) => {
  const problems = watchConsole(page);
  const routes: ReadonlyArray<[string, string]> = [
    ['#play', '[data-testid="play-view"]'],
    ['#learn', '[data-learn-route="index"]'],
    ['#learn/roads', '[data-lesson="roads"]'],
    ['#learn/drills', '[data-testid="drills-hub"]'],
    ['#lab', '[data-testid="lab-view"]'],
  ];
  for (const width of [380, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [hash, selector] of routes) {
      await page.goto(`/${hash}`);
      await expect(page.locator(selector)).toBeVisible();
      const overflow = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);
      expect(overflow, `${hash} at ${width}px`).toBeLessThanOrEqual(0);
    }
  }
  expect(problems).toEqual([]);
});
