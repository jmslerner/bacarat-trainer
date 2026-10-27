"""Exact enumeration of baccarat outcomes for an N-deck shoe (by card value, drawing without replacement)."""
from fractions import Fraction
import sys, json

def banker_draws(b_total, p3):
    # p3 = None means player stood
    if p3 is None:
        return b_total <= 5
    if b_total <= 2: return True
    if b_total == 3: return p3 != 8
    if b_total == 4: return 2 <= p3 <= 7
    if b_total == 5: return 4 <= p3 <= 7
    if b_total == 6: return 6 <= p3 <= 7
    return False

def enumerate_shoe(counts):
    """counts: dict value->count for values 0..9. Returns dict of event probabilities (Fractions)."""
    total = sum(counts.values())
    ev = {
        'player': Fraction(0), 'banker': Fraction(0), 'tie': Fraction(0),
        'dragon7': Fraction(0), 'panda8': Fraction(0),
        'banker_win_6': Fraction(0), 'banker_win_7_3card': Fraction(0),
        'player_3card_8_win': Fraction(0),
        'player_natural': Fraction(0), 'banker_natural': Fraction(0),
        'cards4': Fraction(0), 'cards5': Fraction(0), 'cards6': Fraction(0),
    }
    # recursive enumeration over values drawn in order p1,b1,p2,b2,(p3),(b3)
    def rec(cnt, remaining, seq, prob):
        n = len(seq)
        if n < 4:
            for v in range(10):
                c = cnt[v]
                if c == 0: continue
                cnt[v] -= 1
                rec(cnt, remaining-1, seq+[v], prob*Fraction(c, remaining))
                cnt[v] += 1
            return
        p = (seq[0]+seq[2]) % 10
        b = (seq[1]+seq[3]) % 10
        if n == 4:
            if p >= 8 or b >= 8:
                finish(seq, prob); return
            if p <= 5:
                for v in range(10):
                    c = cnt[v]
                    if c == 0: continue
                    cnt[v] -= 1
                    rec(cnt, remaining-1, seq+[v], prob*Fraction(c, remaining))
                    cnt[v] += 1
                return
            # player stands
            if banker_draws(b, None):
                for v in range(10):
                    c = cnt[v]
                    if c == 0: continue
                    cnt[v] -= 1
                    finish(seq+[None, v], prob*Fraction(c, remaining))
                    cnt[v] += 1
                return
            finish(seq, prob); return
        if n == 5:
            p3 = seq[4]
            if banker_draws(b, p3):
                for v in range(10):
                    c = cnt[v]
                    if c == 0: continue
                    cnt[v] -= 1
                    finish(seq+[v], prob*Fraction(c, remaining))
                    cnt[v] += 1
                return
            finish(seq, prob); return
    def finish(seq, prob):
        p_cards = [seq[0], seq[2]] + ([seq[4]] if len(seq) >= 5 and seq[4] is not None else [])
        b_cards = [seq[1], seq[3]] + ([seq[5]] if len(seq) == 6 else [])
        p = sum(p_cards) % 10; b = sum(b_cards) % 10
        ncards = len(p_cards) + len(b_cards)
        ev['cards%d' % ncards] += prob
        if len(seq) == 4 and (p >= 8): ev['player_natural'] += prob
        if len(seq) == 4 and (b >= 8): ev['banker_natural'] += prob
        if p > b:
            ev['player'] += prob
            if len(p_cards) == 3 and p == 8: ev['panda8'] += prob
        elif b > p:
            ev['banker'] += prob
            if b == 6: ev['banker_win_6'] += prob
            if len(b_cards) == 3 and b == 7: ev['dragon7'] += prob
        else:
            ev['tie'] += prob
    rec(dict(counts), total, [], Fraction(1))
    return ev

def shoe_counts(decks):
    return {v: (16*decks if v == 0 else 4*decks) for v in range(10)}

def edges(ev):
    P, B, T, D7, P8, B6 = ev['player'], ev['banker'], ev['tie'], ev['dragon7'], ev['panda8'], ev['banker_win_6']
    return {
        'player_1to1': float(P - B),
        'banker_5pct_commission': float(Fraction(95,100)*B - P),
        'banker_ez_push_dragon7': float((B - D7) - P),
        'banker_super6_half_on_6': float((B - B6) + Fraction(1,2)*B6 - P),
        'tie_8to1': float(8*T - (P+B)),
        'tie_9to1': float(9*T - (P+B)),
        'dragon7_40to1': float(40*D7 - (1-D7)),
        'panda8_25to1': float(25*P8 - (1-P8)),
    }

if __name__ == '__main__':
    out = {}
    for decks in (6, 8):
        ev = enumerate_shoe(shoe_counts(decks))
        res = {k: float(v) for k, v in ev.items()}
        res['edges'] = edges(ev)
        # pairs by rank: 13 ranks, 4*decks each
        n = 52*decks
        ppair = Fraction(4*decks-1, n-1)
        res['pair_prob'] = float(ppair)
        res['edges']['pair_11to1'] = float(12*ppair - 1)
        res['edges']['pair_12to1'] = float(13*ppair - 1)  # (not standard; informational)
        # Effect of removal for dragon7 and panda8 and main bets (8-deck only to save time)
        if decks == 8:
            eor = {}
            base = ev
            for v in range(10):
                c = shoe_counts(decks); c[v] -= 1
                e2 = enumerate_shoe(c)
                eor[v] = {
                    'dragon7_ev_change': float((40*e2['dragon7'] - (1-e2['dragon7'])) - (40*base['dragon7'] - (1-base['dragon7']))),
                    'panda8_ev_change': float((25*e2['panda8'] - (1-e2['panda8'])) - (25*base['panda8'] - (1-base['panda8']))),
                    'banker_ez_ev_change': float(((e2['banker']-e2['dragon7']) - e2['player']) - ((base['banker']-base['dragon7']) - base['player'])),
                    'player_ev_change': float((e2['player']-e2['banker']) - (base['player']-base['banker'])),
                    'tie8_ev_change': float((8*e2['tie'] - (e2['player']+e2['banker'])) - (8*base['tie'] - (base['player']+base['banker']))),
                }
            res['eor'] = eor
        out['decks_%d' % decks] = res
        print('decks', decks, file=sys.stderr)
    print(json.dumps(out, indent=2))
