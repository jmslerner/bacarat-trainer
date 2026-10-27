import { describe, expect, it } from 'vitest';
import { RANKS, SUITS, bankerDraws, cardValue, createRng, handTotal, playerDraws } from '@/engine';
import type { Card } from '@/engine';
import { questionSeed } from './seeds';
import { BANKER_TABLE, explainThirdCard, generateThirdCardQuestion, listValues, twoCardsWithTotal, type ThirdCardQuestion } from './thirdCard';

function legalCard(c: Card): void {
  expect(RANKS).toContain(c.rank);
  expect(SUITS).toContain(c.suit);
}

describe('BANKER_TABLE', () => {
  it('is the SPEC §2 table', () => {
    const row = (t: number) => BANKER_TABLE[t];
    expect(row(0).draws).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(row(2).stands).toEqual([]);
    expect(row(3).stands).toEqual([8]);
    expect(row(4).draws).toEqual([2, 3, 4, 5, 6, 7]);
    expect(row(5).draws).toEqual([4, 5, 6, 7]);
    expect(row(6).draws).toEqual([6, 7]);
    expect(row(7).draws).toEqual([]);
    expect(row(7).stands).toHaveLength(10);
  });
  it('lists values readably', () => {
    expect(listValues([8])).toBe('8');
    expect(listValues([6, 7])).toBe('6 or 7');
    expect(listValues([0, 1, 8, 9])).toBe('0, 1, 8 or 9');
    expect(listValues([])).toBe('nothing');
  });
});

describe('twoCardsWithTotal', () => {
  it('always hits the requested total with legal cards', () => {
    const rng = createRng(99);
    for (let total = 0; total <= 9; total++) {
      for (let i = 0; i < 50; i++) {
        const cards = twoCardsWithTotal(rng, total, 10);
        expect(cards).toHaveLength(2);
        cards.forEach(legalCard);
        expect(handTotal(cards)).toBe(total);
        expect(cards.map((c) => c.id)).toEqual([10, 11]);
      }
    }
  });
});

describe('generateThirdCardQuestion', () => {
  it('only produces legal, natural-free situations whose answer matches the engine rules', () => {
    let playerAsks = 0;
    let stood = 0;
    let drew = 0;
    let draws = 0;
    let stands = 0;
    const rows = new Set<number>();
    for (let seed = 0; seed < 3000; seed++) {
      const q = generateThirdCardQuestion(createRng(questionSeed(seed, 0)));
      [...q.playerCards, ...q.bankerCards].forEach(legalCard);
      expect(new Set([...q.playerCards, ...q.bankerCards].map((c) => c.id)).size).toBe(q.playerCards.length + q.bankerCards.length);
      expect(q.bankerCards).toHaveLength(2);
      expect(handTotal(q.bankerCards)).toBe(q.bankerTotal);
      expect(handTotal(q.playerCards.slice(0, 2))).toBe(q.playerTotal);
      expect(q.playerTotal).toBeLessThanOrEqual(7);
      expect(q.bankerTotal).toBeLessThanOrEqual(7);
      if (q.ask === 'player') {
        playerAsks++;
        expect(q.playerCards).toHaveLength(2);
        expect(q.playerThird).toBeNull();
        expect(q.answer).toBe(playerDraws(q.playerTotal));
      } else if (q.playerThird) {
        drew++;
        expect(q.playerCards).toHaveLength(3);
        expect(q.playerCards[2]).toBe(q.playerThird);
        expect(q.playerTotal).toBeLessThanOrEqual(5);
        expect(q.answer).toBe(bankerDraws(q.bankerTotal, cardValue(q.playerThird.rank)));
        rows.add(q.bankerTotal);
      } else {
        stood++;
        expect(q.playerCards).toHaveLength(2);
        expect(q.playerTotal).toBeGreaterThanOrEqual(6);
        expect(q.answer).toBe(bankerDraws(q.bankerTotal, null));
      }
      if (q.answer) draws++;
      else stands++;
    }
    // A varied mix: both kinds of question, both outcomes, every Banker row.
    expect(playerAsks).toBeGreaterThan(500);
    expect(playerAsks).toBeLessThan(1400);
    expect(stood).toBeGreaterThan(200);
    expect(drew).toBeGreaterThan(1000);
    expect(draws).toBeGreaterThan(900);
    expect(stands).toBeGreaterThan(900);
    expect([...rows].sort()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('is deterministic for a seed', () => {
    expect(generateThirdCardQuestion(createRng(123))).toEqual(generateThirdCardQuestion(createRng(123)));
    expect(generateThirdCardQuestion(createRng(123))).not.toEqual(generateThirdCardQuestion(createRng(124)));
  });
});

describe('explainThirdCard', () => {
  const card = (rank: Card['rank'], id: number): Card => ({ rank, suit: 'S', id });

  it('explains a Banker 3 against an 8 with the row and value to highlight', () => {
    const q: ThirdCardQuestion = {
      ask: 'banker',
      playerCards: [card('2', 0), card('3', 1), card('8', 2)],
      bankerCards: [card('A', 3), card('2', 4)],
      playerTotal: 5,
      bankerTotal: 3,
      playerThird: card('8', 2),
      answer: false,
    };
    const e = explainThirdCard(q);
    expect(e.headline).toBe('Banker stands');
    expect(e.row).toBe(3);
    expect(e.p3).toBe(8);
    expect(e.reason).toMatch(/Banker has 3/);
    expect(e.reason).toMatch(/stands on 8/);
    expect(e.tip).toMatch(/except an 8/);
  });

  it('explains Banker when the Player stood', () => {
    const q: ThirdCardQuestion = {
      ask: 'banker',
      playerCards: [card('3', 0), card('4', 1)],
      bankerCards: [card('2', 3), card('3', 4)],
      playerTotal: 7,
      bankerTotal: 5,
      playerThird: null,
      answer: true,
    };
    const e = explainThirdCard(q);
    expect(e.headline).toBe('Banker draws');
    expect(e.row).toBe(5);
    expect(e.p3).toBeNull();
    expect(e.reason).toMatch(/Player stood on 7/);
    expect(e.reason).toMatch(/draws on 0–5/);
  });

  it('explains a Player question', () => {
    const q: ThirdCardQuestion = {
      ask: 'player',
      playerCards: [card('3', 0), card('3', 1)],
      bankerCards: [card('2', 3), card('3', 4)],
      playerTotal: 6,
      bankerTotal: 5,
      playerThird: null,
      answer: false,
    };
    const e = explainThirdCard(q);
    expect(e.headline).toBe('Player stands');
    expect(e.row).toBeNull();
    expect(e.reason).toMatch(/Player has 6/);
  });

  it('explains the always-draw and always-stand rows', () => {
    const base = { ask: 'banker' as const, playerCards: [card('2', 0), card('3', 1), card('9', 2)], bankerCards: [card('T', 3), card('2', 4)], playerTotal: 5, playerThird: card('9', 2) };
    expect(explainThirdCard({ ...base, bankerTotal: 2, answer: true }).reason).toMatch(/always draws/);
    expect(explainThirdCard({ ...base, bankerCards: [card('3', 3), card('4', 4)], bankerTotal: 7, answer: false }).reason).toMatch(/always stands/);
  });
});
