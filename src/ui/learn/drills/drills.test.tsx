// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DEFAULT_RULES, createRng } from '@/engine';
import {
  BestBetDrill,
  CountingDrill,
  DRAGON7_COUNT,
  DrillsHub,
  PayoutDrill,
  RoadDrill,
  ThirdCardDrill,
  describeOutcome,
  drillHash,
  drillScoresStore,
  emptyScores,
  formatCount,
  generateBestBetQuestion,
  generateCountingCards,
  generatePayoutQuestion,
  generateRoadQuestion,
  generateThirdCardQuestion,
  parseDrillHash,
  questionSeed,
  recordDrillAnswer,
  resetDrillScore,
  runningCountOf,
  sanitizeDrillScores,
  signedMoney,
  type DrillScores,
} from './index';

beforeEach(() => {
  window.localStorage.clear();
  drillScoresStore.reset();
  window.location.hash = '';
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function storedScores(): DrillScores | null {
  const raw = window.localStorage.getItem('bt:drills');
  return raw === null ? null : (JSON.parse(raw) as DrillScores);
}

function feedback(): HTMLElement {
  return screen.getByTestId('drill-feedback');
}

describe('score store (bt:drills)', () => {
  it('records answers, streaks and bests and persists them', () => {
    recordDrillAnswer('third-card', true, 1000);
    recordDrillAnswer('third-card', true, 2000);
    const after = recordDrillAnswer('third-card', false, 3000);
    expect(after).toEqual({ attempted: 3, correct: 2, streak: 0, best: 2, updatedAt: 3000 });
    expect(storedScores()?.['third-card']).toEqual(after);
    expect(drillScoresStore.get().payout.attempted).toBe(0);
    resetDrillScore('third-card');
    expect(drillScoresStore.get()['third-card'].attempted).toBe(0);
  });

  it('sanitises stale or corrupt data', () => {
    const scores = sanitizeDrillScores({ 'third-card': { attempted: 5, correct: 9, streak: 'x', best: -1 }, junk: 1 }, emptyScores());
    expect(scores['third-card']).toEqual({ attempted: 5, correct: 5, streak: 0, best: 0, updatedAt: null });
    expect(scores.road.attempted).toBe(0);
    expect(sanitizeDrillScores('garbage', emptyScores())).toEqual(emptyScores());
  });
});

describe('DrillsHub', () => {
  it('lists the five drills with their saved scores and opens / closes a drill', () => {
    recordDrillAnswer('payout', true);
    recordDrillAnswer('payout', true);
    recordDrillAnswer('payout', true);
    recordDrillAnswer('payout', false);
    recordDrillAnswer('payout', false);
    render(<DrillsHub seed={11} />);
    expect(screen.getByTestId('drills-hub')).toBeInTheDocument();
    for (const id of ['third-card', 'payout', 'best-bet', 'road', 'counting']) expect(screen.getByTestId(`drill-card-${id}`)).toBeInTheDocument();
    expect(screen.getByTestId('card-score-payout')).toHaveTextContent('3/5');
    expect(screen.getByTestId('drill-card-payout')).toHaveTextContent('60% accuracy');
    expect(screen.getByTestId('drills-overall')).toHaveTextContent('3/5 correct overall (60%)');
    expect(screen.getByTestId('open-payout')).toHaveTextContent('Continue');
    expect(screen.getByTestId('open-road')).toHaveTextContent('Start');

    fireEvent.click(screen.getByTestId('open-third-card'));
    expect(screen.queryByTestId('drills-hub')).not.toBeInTheDocument();
    const drill = document.querySelector('[data-drill="third-card"]');
    expect(drill).not.toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Third-card rules' })).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('drill-back'));
    expect(screen.getByTestId('drills-hub')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('drills-reset-all'));
    expect(screen.getByTestId('card-score-payout')).toHaveTextContent('0/0');
    expect(screen.getByTestId('drills-overall')).toHaveTextContent('No answers yet');
  });

  it('parses and builds the #learn/drills/<id> sub-route', () => {
    expect(parseDrillHash('#learn/drills/road')).toBe('road');
    expect(parseDrillHash('#learn/drills/')).toBeNull();
    expect(parseDrillHash('#learn/drills')).toBeNull();
    expect(parseDrillHash('#learn/drills/nope')).toBeNull();
    expect(parseDrillHash('#learn/roads/road')).toBeNull();
    expect(drillHash('payout')).toBe('#learn/drills/payout');
  });

  it('uses the hash when shown at #learn/drills', async () => {
    window.location.hash = '#learn/drills';
    render(<DrillsHub seed={11} />);
    expect(screen.getByTestId('drills-hub')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('open-road'));
    expect(window.location.hash).toBe('#learn/drills/road');
    await waitFor(() => expect(document.querySelector('[data-drill="road"]')).not.toBeNull());
    fireEvent.click(screen.getByTestId('drill-back'));
    expect(window.location.hash).toBe('#learn/drills');
    await waitFor(() => expect(screen.getByTestId('drills-hub')).toBeInTheDocument());
  });
});

describe('ThirdCardDrill', () => {
  it('asks the seeded situation, scores a correct answer, then a wrong one, and reveals the rule', () => {
    const q1 = generateThirdCardQuestion(createRng(questionSeed(11, 0)));
    render(<ThirdCardDrill seed={11} />);
    expect(screen.getByTestId('drill-question')).toHaveTextContent(q1.ask === 'banker' ? 'Does Banker draw a third card?' : 'Does Player draw a third card?');
    expect(screen.getByTestId('banker-total')).toHaveTextContent(String(q1.bankerTotal));
    expect(within(screen.getByRole('group', { name: 'Player cards' })).getAllByRole('img')).toHaveLength(q1.playerCards.length);

    fireEvent.click(screen.getByTestId(q1.answer ? 'answer-yes' : 'answer-no'));
    expect(feedback()).toHaveAttribute('data-correct', 'true');
    expect(feedback()).toHaveTextContent(q1.answer ? 'draws' : 'stands');
    expect(screen.getByTestId(q1.ask === 'banker' ? 'banker-table' : 'player-table')).toBeInTheDocument();
    if (q1.ask === 'banker') expect(screen.getByTestId('banker-table').querySelector(`[data-row="${q1.bankerTotal}"]`)).toHaveAttribute('aria-current', 'true');
    expect(screen.getByTestId('score-correct')).toHaveTextContent('1/1');
    expect(screen.getByTestId('score-streak')).toHaveTextContent('1');
    expect(screen.getByTestId('drill-status')).toHaveTextContent(/^Correct\./);
    expect(storedScores()?.['third-card']).toMatchObject({ attempted: 1, correct: 1, streak: 1, best: 1 });
    expect(screen.getByTestId('answer-yes')).toBeDisabled();

    fireEvent.click(screen.getByTestId('drill-next'));
    expect(screen.queryByTestId('drill-feedback')).not.toBeInTheDocument();
    const q2 = generateThirdCardQuestion(createRng(questionSeed(11, 1)));
    expect(screen.getByTestId('drill-question')).toHaveTextContent(q2.ask === 'banker' ? 'Does Banker' : 'Does Player');
    expect(screen.getByTestId('banker-total')).toHaveTextContent(String(q2.bankerTotal));

    // Keyboard: the wrong key.
    fireEvent.keyDown(window, { key: q2.answer ? 'n' : 'y' });
    expect(feedback()).toHaveAttribute('data-correct', 'false');
    expect(screen.getByTestId('score-correct')).toHaveTextContent('1/2');
    expect(screen.getByTestId('score-streak')).toHaveTextContent('0');
    expect(screen.getByTestId('score-best')).toHaveTextContent('1');
    expect(storedScores()?.['third-card']).toMatchObject({ attempted: 2, correct: 1, streak: 0, best: 1 });

    // Enter advances.
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.queryByTestId('drill-feedback')).not.toBeInTheDocument();
    const q3 = generateThirdCardQuestion(createRng(questionSeed(11, 2)));
    expect(screen.getByTestId('banker-total')).toHaveTextContent(String(q3.bankerTotal));
  });

  it('scores correctly across many seeds (answer = engine rule)', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const q = generateThirdCardQuestion(createRng(questionSeed(seed, 0)));
      const { unmount } = render(<ThirdCardDrill seed={seed} />);
      fireEvent.click(screen.getByTestId(q.answer ? 'answer-no' : 'answer-yes'));
      expect(feedback()).toHaveAttribute('data-correct', 'false');
      unmount();
    }
    expect(storedScores()?.['third-card']).toMatchObject({ attempted: 5, correct: 0 });
  });
});

describe('PayoutDrill', () => {
  it('shows the dealt hand and the bets, and scores the typed net result', () => {
    const q1 = generatePayoutQuestion(createRng(questionSeed(5, 0)), DEFAULT_RULES);
    render(<PayoutDrill seed={5} />);
    expect(screen.getByTestId('dealer-call')).toHaveTextContent(describeOutcome(q1.result));
    expect(screen.getByTestId('player-total')).toHaveTextContent(String(q1.result.playerTotal));
    for (const [bet, amount] of Object.entries(q1.bets)) {
      expect(document.querySelector(`[data-spot="${bet}"]`)).toHaveAttribute('data-amount', String(amount));
    }
    expect(document.querySelectorAll('[data-spot]')).toHaveLength(7);

    const input = screen.getByLabelText('Your net result in dollars');
    fireEvent.change(input, { target: { value: String(q1.settlement.net) } });
    fireEvent.submit(input.closest('form')!);
    expect(feedback()).toHaveAttribute('data-correct', 'true');
    expect(screen.getByTestId('settlement-net')).toHaveTextContent(signedMoney(q1.settlement.net));
    expect(screen.getByTestId('settlement-table').querySelectorAll('tbody tr[data-bet]')).toHaveLength(q1.settlement.settlements.length);
    expect(screen.getByTestId('settlement-why').querySelectorAll('li')).toHaveLength(q1.settlement.settlements.length);
    expect(screen.getByTestId('score-correct')).toHaveTextContent('1/1');

    fireEvent.click(screen.getByTestId('drill-next'));
    const q2 = generatePayoutQuestion(createRng(questionSeed(5, 1)), DEFAULT_RULES);
    expect(screen.getByTestId('dealer-call')).toHaveTextContent(describeOutcome(q2.result));
    const input2 = screen.getByLabelText('Your net result in dollars');
    expect(input2).toHaveValue('');
    fireEvent.change(input2, { target: { value: String(q2.settlement.net + 1000) } });
    fireEvent.submit(input2.closest('form')!);
    expect(feedback()).toHaveAttribute('data-correct', 'false');
    expect(feedback()).toHaveTextContent(`You answered ${signedMoney(q2.settlement.net + 1000)}`);
    expect(screen.getByTestId('score-correct')).toHaveTextContent('1/2');
    expect(storedScores()?.payout).toMatchObject({ attempted: 2, correct: 1 });
  });

  it('ignores an empty or unparsable answer', () => {
    render(<PayoutDrill seed={6} />);
    const input = screen.getByLabelText('Your net result in dollars');
    fireEvent.submit(input.closest('form')!);
    expect(screen.queryByTestId('drill-feedback')).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'lots' } });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    fireEvent.submit(input.closest('form')!);
    expect(screen.queryByTestId('drill-feedback')).not.toBeInTheDocument();
    expect(storedScores()).toBeNull();
  });
});

describe('BestBetDrill', () => {
  it('scores the lowest/highest-edge pick and explains every option', () => {
    const q1 = generateBestBetQuestion(createRng(questionSeed(3, 0)), DEFAULT_RULES);
    render(<BestBetDrill seed={3} />);
    expect(screen.getByTestId('drill-question')).toHaveTextContent(q1.mode === 'lowest' ? 'LOWEST' : 'HIGHEST');
    for (const o of q1.options) expect(screen.getByTestId(`option-${o.bet}`)).toHaveTextContent(o.label);

    fireEvent.click(screen.getByTestId(`option-${q1.answer}`));
    expect(feedback()).toHaveAttribute('data-correct', 'true');
    expect(screen.getByTestId('edge-table').querySelectorAll('tbody tr')).toHaveLength(q1.options.length);
    expect(screen.getByTestId('score-correct')).toHaveTextContent('1/1');

    fireEvent.click(screen.getByTestId('drill-next'));
    const q2 = generateBestBetQuestion(createRng(questionSeed(3, 1)), DEFAULT_RULES);
    const wrong = q2.options.find((o) => o.bet !== q2.answer)!;
    fireEvent.click(screen.getByTestId(`option-${wrong.bet}`));
    expect(feedback()).toHaveAttribute('data-correct', 'false');
    expect(screen.getByTestId('score-correct')).toHaveTextContent('1/2');

    // Number keys pick an option.
    fireEvent.keyDown(window, { key: 'Enter' });
    const q3 = generateBestBetQuestion(createRng(questionSeed(3, 2)), DEFAULT_RULES);
    const index = q3.options.findIndex((o) => o.bet === q3.answer);
    fireEvent.keyDown(window, { key: String(index + 1) });
    expect(feedback()).toHaveAttribute('data-correct', 'true');
    expect(storedScores()?.['best-bet']).toMatchObject({ attempted: 3, correct: 2, streak: 1, best: 1 });
  });
});

describe('RoadDrill', () => {
  it('draws the roads and scores the colour against predictNext', () => {
    const q1 = generateRoadQuestion(createRng(questionSeed(8, 0)));
    render(<RoadDrill seed={8} />);
    expect(screen.getByTestId('drill-question')).toHaveTextContent(q1.side === 'banker' ? 'If the next hand is Banker' : 'If the next hand is Player');
    expect(document.querySelector('[data-road="big"]')).not.toBeNull();
    expect(document.querySelector(`[data-road="${q1.kind}"]`)).not.toBeNull();

    fireEvent.click(screen.getByTestId(`answer-${q1.answer}`));
    expect(feedback()).toHaveAttribute('data-correct', 'true');
    expect(screen.getByTestId('road-why').querySelectorAll('li')).toHaveLength(3);
    expect(screen.getByTestId('score-correct')).toHaveTextContent('1/1');

    fireEvent.click(screen.getByTestId('drill-next'));
    const q2 = generateRoadQuestion(createRng(questionSeed(8, 1)));
    fireEvent.keyDown(window, { key: q2.answer === 'red' ? 'b' : 'r' });
    expect(feedback()).toHaveAttribute('data-correct', 'false');
    expect(storedScores()?.road).toMatchObject({ attempted: 2, correct: 1, streak: 0, best: 1 });
  });
});

describe('CountingDrill', () => {
  it('flashes the seeded cards at the chosen pace and scores the running count', () => {
    vi.useFakeTimers();
    const cards = generateCountingCards(createRng(questionSeed(2, 0)), 8);
    const expected = runningCountOf(cards, DRAGON7_COUNT);
    render(<CountingDrill seed={2} cards={8} pace="blitz" />);
    fireEvent.click(screen.getByRole('switch', { name: 'Show the count while cards flash' }));
    fireEvent.click(screen.getByTestId('count-start'));
    expect(screen.getByTestId('count-progress')).toHaveTextContent('Card 1 of 8');
    expect(screen.getByTestId('count-assist')).toHaveTextContent(formatCount(runningCountOf(cards.slice(0, 1), DRAGON7_COUNT)));
    for (let i = 1; i < 8; i++) {
      act(() => {
        vi.advanceTimersByTime(400);
      });
      expect(screen.getByTestId('count-progress')).toHaveTextContent(`Card ${i + 1} of 8`);
      expect(screen.getByTestId('count-assist')).toHaveTextContent(formatCount(runningCountOf(cards.slice(0, i + 1), DRAGON7_COUNT)));
    }
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.getByTestId('drill-question')).toHaveTextContent('What is the running count?');

    const input = screen.getByLabelText('Running count');
    fireEvent.change(input, { target: { value: formatCount(expected) } });
    fireEvent.submit(input.closest('form')!);
    expect(feedback()).toHaveAttribute('data-correct', 'true');
    expect(feedback()).toHaveTextContent(`Running count: ${formatCount(expected)}`);
    expect(screen.getByTestId('count-strip').querySelectorAll('[role="img"]')).toHaveLength(8);
    expect(screen.getByTestId('score-correct')).toHaveTextContent('1/1');
    expect(storedScores()?.counting).toMatchObject({ attempted: 1, correct: 1 });

    // "Deal again" starts the next seeded deal immediately.
    fireEvent.click(screen.getByTestId('drill-next'));
    expect(screen.getByTestId('count-progress')).toHaveTextContent('Card 1 of 8');
    for (let i = 0; i < 8; i++) {
      act(() => {
        vi.advanceTimersByTime(400);
      });
    }
    const cards2 = generateCountingCards(createRng(questionSeed(2, 1)), 8);
    const input2 = screen.getByLabelText('Running count');
    fireEvent.change(input2, { target: { value: String(runningCountOf(cards2, DRAGON7_COUNT) + 1) } });
    fireEvent.submit(input2.closest('form')!);
    expect(feedback()).toHaveAttribute('data-correct', 'false');
    expect(feedback()).toHaveTextContent('you were off by 1');
    expect(storedScores()?.counting).toMatchObject({ attempted: 2, correct: 1, streak: 0, best: 1 });
  });

  it('can be stopped while dealing', () => {
    vi.useFakeTimers();
    render(<CountingDrill seed={4} cards={8} pace="slow" />);
    fireEvent.click(screen.getByTestId('count-start'));
    act(() => {
      vi.advanceTimersByTime(1600);
    });
    expect(screen.getByTestId('count-progress')).toHaveTextContent('Card 2 of 8');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByTestId('count-start')).toBeInTheDocument();
    expect(storedScores()).toBeNull();
  });
});
