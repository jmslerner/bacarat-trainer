// Temporary dev harness for browser verification (deleted afterwards). ?seed=&bankroll=&speed=&preset=&cut=&tips=
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RULE_PRESETS, cloneRules } from '@/engine';
import { AppShell, DEFAULT_PREFS, LabPlaceholder, LearnPlaceholder, Providers, prefsStore, resetSession, rulesStore, type DealSpeed } from '@/ui/shell';
import { PlayView } from '@/ui/play';
import '@/styles/global.css';

const q = new URLSearchParams(window.location.search);
const seed = Number(q.get('seed') ?? 42);
const bankroll = Number(q.get('bankroll') ?? 1000);
const speed = (q.get('speed') ?? 'normal') as DealSpeed;
const preset = (q.get('preset') ?? 'ez') as 'ez' | 'commission' | 'super6';
const cut = q.get('cut');
const tips = q.get('tips') !== '0';
const rules = cloneRules(RULE_PRESETS[preset].rules);
if (cut) rules.cutCardFromEnd = Number(cut);
window.localStorage.clear();
prefsStore.set({ ...DEFAULT_PREFS, dealSpeed: speed, sound: false, beginnerTips: tips });
rulesStore.set(rules);
const session = resetSession({ seed, bankroll, rules });
(window as unknown as { __session: unknown }).__session = session;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Providers>
      <AppShell views={{ play: PlayView, learn: LearnPlaceholder, lab: LabPlaceholder }} />
    </Providers>
  </React.StrictMode>,
);
