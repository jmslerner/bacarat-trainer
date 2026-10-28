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
  // A three-card hand shows its third card sideways (a dealt card is a face and a back SVG; only the third pair is rotated).
  const playerCards = page.locator('[data-side="player"] [data-dealt]');
  if ((await playerCards.count()) === 3) {
    await expect(playerCards.nth(2).locator('svg[data-rotated]').first()).toBeVisible();
    await expect(playerCards.nth(1).locator('svg[data-rotated]')).toHaveCount(0);
  }

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
  await page.getByRole('switch', { name: /banker pair/i }).locator('xpath=..').click(); // the <label> around the hidden input
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

test('table levels: the $500 high-limit salon sets the plaque, the chip tray and the bankroll, and survives a reload', async ({ page }) => {
  const problems = watchConsole(page);
  await page.goto('/#play');
  const view = page.getByTestId('play-view');
  await page.getByLabel('Dealing speed').selectOption('instant');
  await expect(view).toHaveAttribute('data-phase', 'idle', { timeout: 20_000 });
  const plaque = page.getByTestId('table-limits');
  await expect(plaque).toContainText('$10 mini-baccarat');
  await expect(plaque).toContainText('Min $10 — Max $5,000');
  await expect(plaque).toHaveAttribute('data-level', 'mini');
  // A hand at the $10 table, so there are last bets to (not) repeat at the salon.
  await page.getByTestId('chip-25').click();
  await page.locator('[data-bet="banker"]').click();
  await page.getByTestId('deal-button').click();
  await expect(page.getByTestId('settlement-status')).toHaveText(/^You won \$|^You lost \$|^Push/);
  await expect(page.getByTestId('rebet-button')).toHaveText(/Rebet \$25/);
  await expect(page.getByTestId('stats-panel')).toContainText('1 hands');

  await page.getByTestId('settings-button').click();
  const dialog = page.getByRole('dialog');
  await expect(page.getByTestId('level-mini')).toHaveAttribute('aria-checked', 'true');
  await page.getByTestId('level-high').click();
  await expect(page.getByTestId('level-high')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('preset-ez')).toHaveAttribute('aria-checked', 'true'); // the game variant is untouched
  await expect(page.getByTestId('level-blurb')).toContainText('Suggested buy-in $50,000');
  await expect(page.getByTestId('new-shoe-warning')).toContainText('$500 high-limit salon');
  await expect(page.getByTestId('new-shoe-warning')).toContainText('$50,000');
  await expect(page.getByLabel('Player / Banker minimum')).toHaveValue('500');
  await expect(page.getByRole('button', { name: '$100,000 chip in tray' })).toBeVisible();
  await page.getByTestId('apply-rules').click();
  await expect(dialog).toHaveCount(0);
  await expect(view).toHaveAttribute('data-phase', 'idle', { timeout: 20_000 });

  const expectSalon = async (): Promise<void> => {
    await expect(plaque).toContainText('$500 high-limit salon');
    await expect(plaque).toContainText('Min $500 — Max $100,000');
    await expect(plaque).toContainText('Tie $500–$10,000 · Side $100–$5,000');
    await expect(plaque).toHaveAttribute('data-level', 'high');
    await expect(plaque).toHaveAttribute('title', /^\$500 high-limit salon — Salon play/);
    const plaqueChip = page.getByTestId('chip-100000');
    await expect(plaqueChip).toBeVisible();
    await expect(plaqueChip).toHaveText('100K');
    await expect(plaqueChip).toHaveAccessibleName(/\$100,000 chip/);
    await expect(page.getByTestId('chip-25000')).toHaveText('25K');
    await expect(page.getByTestId('chip-1')).toHaveCount(0);
    await expect(page.getByTestId('chip-25')).toHaveCount(0);
    await expect(page.getByTestId('chip-500')).toHaveAttribute('aria-pressed', 'true'); // the first chip at the $500 minimum is in hand
    await expect(page.getByTestId('table-bankroll').locator('[data-value]')).toHaveAttribute('data-value', '50000');
    await expect(page.getByTestId('table-bankroll')).toContainText('$50,000');
    await expect(page.getByTestId('bankroll-pill')).toHaveAttribute('data-value', '50000');
  };
  await expectSalon();
  await expect(page.getByTestId('stats-panel')).toContainText('1 hands'); // session stats carry on
  // The $25 Banker bet of the $10 table cannot be repeated here: not offered, and R places nothing.
  const rebet = page.getByTestId('rebet-button');
  await expect(rebet).toBeDisabled();
  await expect(rebet).toHaveAttribute('title', /cannot be repeated at this table: Banker bet of \$25 is below the table minimum of \$500/);
  await expect(page.getByTestId('deal-reason')).toHaveText('Place a bet to deal');
  await page.keyboard.press('r');
  await expect(page.locator('[data-bet="banker"]')).toHaveAttribute('data-amount', '0');
  // The Bankroll tab offers the salon's buy-in.
  await page.getByTestId('buy-in-button').click();
  await expect(page.getByRole('group', { name: 'Quick buy-in amounts' }).getByRole('button', { name: '$50,000' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // Chip keys follow the tray position: 6 is the $100,000 plaque at this table.
  await page.keyboard.press('6');
  await expect(page.getByTestId('chip-100000')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('2');
  await expect(page.getByTestId('chip-500')).toHaveAttribute('aria-pressed', 'true');

  await page.reload();
  await expect(view).toHaveAttribute('data-phase', 'idle', { timeout: 20_000 });
  await expectSalon();
  const stored = await page.evaluate(() => ({
    rules: JSON.parse(window.localStorage.getItem('bt:rules') ?? 'null') as { limits: { main: { min: number; max: number } }; chipDenominations: number[] } | null,
    buyIn: window.localStorage.getItem('bt:buyIn'),
    bankroll: window.localStorage.getItem('bt:bankroll'),
  }));
  expect(stored.rules?.limits.main).toEqual({ min: 500, max: 100000 });
  expect(stored.rules?.chipDenominations).toEqual([100, 500, 1000, 5000, 25000, 100000]);
  expect(stored.buyIn).toBe('50000');
  expect(stored.bankroll).toBe('50000');
  // The lesson and the Lab follow the table too.
  await page.goto('/#learn/casino-procedure');
  await expect(page.locator('tr[data-level="high"]')).toHaveAttribute('data-active', 'true');
  await page.goto('/#lab');
  await expect(page.getByLabel('Unit', { exact: true })).toHaveValue('500');
  await expect(page.getByLabel('Bankroll', { exact: true })).toHaveValue('50,000');
  expect(problems).toEqual([]);
});

/** How far (px) any part of the open settings dialog sticks out past its right edge. */
async function dialogOverflow(page: Page): Promise<number> {
  return page.getByRole('dialog').evaluate((el) => {
    const right = el.getBoundingClientRect().right;
    let worst = 0;
    el.querySelectorAll('*').forEach((child) => {
      const r = child.getBoundingClientRect();
      if (r.width > 0) worst = Math.max(worst, r.right - right);
    });
    return worst;
  });
}

test('no horizontal overflow at 380, 768 and 1440 px in every mode, settings dialog included', async ({ page }) => {
  const problems = watchConsole(page);
  const routes: ReadonlyArray<[string, string]> = [
    ['#play', '[data-testid="play-view"]'],
    ['#learn', '[data-learn-route="index"]'],
    ['#learn/roads', '[data-lesson="roads"]'],
    ['#learn/casino-procedure', '[data-lesson="casino-procedure"]'],
    ['#learn/drills', '[data-testid="drills-hub"]'],
    ['#lab', '[data-testid="lab-view"]'],
  ];
  const pageOverflow = (): Promise<number> => page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth);
  for (const width of [380, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [hash, selector] of routes) {
      await page.goto(`/${hash}`);
      await expect(page.locator(selector)).toBeVisible();
      expect(await pageOverflow(), `${hash} at ${width}px`).toBeLessThanOrEqual(0);
    }
    // The settings dialog with the table-level chooser, at the widest table and with custom limits.
    await page.goto('/#play');
    await page.getByTestId('settings-button').click();
    await expect(page.getByRole('radiogroup', { name: 'Table level' })).toBeVisible();
    expect(await dialogOverflow(page), `settings dialog at ${width}px`).toBeLessThanOrEqual(1);
    await page.getByTestId('level-private').click();
    expect(await dialogOverflow(page), `settings dialog (private) at ${width}px`).toBeLessThanOrEqual(1);
    expect(await pageOverflow(), `settings dialog page at ${width}px`).toBeLessThanOrEqual(0);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  expect(problems).toEqual([]);
});

/** What the table shows right after a hand at instant speed, read in one go (the hit's banner fades by itself after 1.2 s). */
interface Moment {
  kind: 'dragon7' | 'panda8';
  overlayKind: string | null;
  pointerEvents: string;
  inFelt: boolean;
  title: string | null;
  medallion: string | null;
  payout: string | null;
  particles: boolean;
  bigCall: string | null;
  handText: string | null;
}

test('a Dragon 7 or Panda 8: the celebration over the felt, then the hit on the scoreboard and in the history', async ({ page }) => {
  const problems = watchConsole(page);
  await page.goto('/#play');
  // A bankroll that 400 hands of $35 can never run dry.
  await page.evaluate(() => {
    window.localStorage.setItem('bt:bankroll', '20000');
    window.localStorage.setItem('bt:buyIn', '20000');
  });
  await page.reload();
  const view = page.getByTestId('play-view');
  await page.getByLabel('Dealing speed').selectOption('instant');
  await expect(view).toHaveAttribute('data-phase', 'idle', { timeout: 20_000 });
  await page.getByTestId('chip-25').click();
  await page.locator('[data-bet="banker"]').click();
  await page.getByTestId('chip-5').click();
  await page.locator('[data-bet="dragon7"]').click();
  await page.locator('[data-bet="panda8"]').click();
  await expect(page.getByTestId('table-bankroll')).toContainText('On layout $35');

  // Instant speed: each hand is dealt and settled within the key press.
  let moment: Moment | null = null;
  for (let hand = 1; hand <= 400 && moment === null; hand++) {
    if (hand > 1) await page.keyboard.press('r');
    await page.keyboard.press(' ');
    moment = await page.evaluate((): Moment | null => {
      const q = (s: string): HTMLElement | null => document.querySelector<HTMLElement>(s);
      const kind = q('[data-testid="hand-history"] li')?.getAttribute('data-hit');
      // A hit on the shoe's last hand is followed at once by the new shoe's empty roads: look for another.
      if ((kind !== 'dragon7' && kind !== 'panda8') || /^New shoe/.test(q('[data-testid="dealer-call"]')?.textContent ?? '')) return null;
      const overlay = q('[data-testid="bonus-celebration"]');
      const banner = q('[data-testid="bonus-banner"]');
      return {
        kind,
        overlayKind: overlay?.getAttribute('data-kind') ?? null,
        pointerEvents: overlay ? getComputedStyle(overlay).pointerEvents : '',
        inFelt: !!overlay?.closest('[data-testid="felt"]'),
        title: banner?.querySelector('[data-text]')?.textContent ?? null,
        medallion: banner?.querySelector('[data-medallion]')?.getAttribute('data-medallion') ?? null,
        payout: q('[data-testid="bonus-payout"]')?.textContent ?? null,
        particles: !!overlay?.querySelector('[data-testid="bonus-particles"]'),
        bigCall: q('[data-testid="dealer-call"] [data-hit]')?.textContent ?? null,
        handText: Array.from(document.querySelectorAll('span')).find((s) => /^Hand \d+$/.test(s.textContent ?? ''))?.textContent ?? null,
      };
    });
  }
  expect(moment, 'a Dragon 7 or a Panda 8 within 400 hands').not.toBeNull();
  const m = moment!;
  const dragon = m.kind === 'dragon7';
  const name = dragon ? 'Dragon 7' : 'Panda 8';

  // The moment: a decorative overlay inside the felt that never takes the pointer.
  expect(m.overlayKind).toBe(m.kind);
  expect(m.inFelt).toBe(true);
  expect(m.pointerEvents).toBe('none');
  expect(m.title).toBe(dragon ? 'DRAGON 7' : 'PANDA 8');
  expect(m.medallion).toBe(m.kind);
  expect(m.payout).toBe(dragon ? 'Pays 40 to 1 · you won +$200 · Banker bet pushes' : 'Pays 25 to 1 · you won +$125');
  expect(m.particles).toBe(true);
  expect(m.bigCall).toBe(`${name}!`);

  // The scoreboard: the bead and the big-road cell of this hand carry the medallion, the counter flags the new hit,
  // the bonus history lists it with its hand number.
  const handNo = Number((m.handText ?? '').replace(/\D/g, ''));
  expect(handNo).toBeGreaterThan(0);
  const hitLabel = `Hand ${handNo}: ${dragon ? 'Banker' : 'Player'}, ${name}`;
  const bead = page.locator(`[data-bead="${handNo - 1}"]`);
  await expect(bead).toHaveAttribute('data-medallion', m.kind);
  await expect(bead).toHaveAttribute('aria-label', hitLabel);
  const bigCell = page.locator(`[data-big-cell][data-hit="${m.kind}"][aria-label="${hitLabel}"]`);
  await expect(bigCell).toHaveCount(1);
  await expect(bigCell.locator(`[data-badge="${m.kind}"]`)).toHaveCount(1);
  const counter = page.locator(`li[data-count="${m.kind}"]`);
  await expect(counter).toHaveAttribute('data-latest', 'true');
  await expect(counter.getByTestId('bonus-plus-one')).toBeVisible();
  await expect(page.locator(`[data-testid="bonus-hit"][data-kind="${m.kind}"][data-hand="${handNo}"]`)).toHaveCount(1);
  await expect(page.getByTestId(`bonus-since-${m.kind}`)).toHaveText(new RegExp(`^Since last ${name}: this hand \\(expected about 1 in (44|29)\\)$`));
  const row = page.getByTestId('hand-history').getByRole('listitem').first();
  await expect(row).toHaveAttribute('data-hit', m.kind);
  await expect(row.locator(`[data-medallion="${m.kind}"]`)).toHaveCount(1);

  // The banner goes by itself without holding up the table, and the next deal clears what is left of the moment.
  await expect(page.getByTestId('bonus-celebration')).toHaveCount(0, { timeout: 5_000 });
  await expect(page.getByTestId('rebet-button')).toBeEnabled();
  await page.keyboard.press('r');
  await page.keyboard.press(' ');
  const next = await page.getByTestId('hand-history').getByRole('listitem').first().getAttribute('data-hit');
  const newShoe = /^New shoe/.test((await page.getByTestId('dealer-call').textContent()) ?? '');
  if (next === null && !newShoe) {
    await expect(page.getByTestId('dealer-call').locator('[data-hit]')).toHaveCount(0);
    await expect(counter).not.toHaveAttribute('data-latest', 'true');
    await expect(page.getByTestId(`bonus-since-${m.kind}`)).toHaveText(new RegExp(`^Since last ${name}: 1 hand `));
  }
  expect(problems).toEqual([]);
});
