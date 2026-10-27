// Temporary dev harness: mounts <PlayView/> inside the shell. Deleted before the module is handed over.
import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppShell, Providers, LabPlaceholder, LearnPlaceholder, resetSession } from '@/ui/shell';
import { PlayView } from '../index';
import '@/styles/global.css';

const params = new URLSearchParams(window.location.search);
const seed = params.get('seed');
const bankroll = params.get('bankroll');
if (seed !== null || bankroll !== null) {
  resetSession({ ...(seed !== null ? { seed: Number(seed) } : {}), ...(bankroll !== null ? { bankroll: Number(bankroll) } : {}) });
}

const container = document.getElementById('root');
if (!container) throw new Error('#root missing');
ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <Providers>
      <AppShell views={{ play: PlayView, learn: LearnPlaceholder, lab: LabPlaceholder }} />
    </Providers>
  </React.StrictMode>,
);
