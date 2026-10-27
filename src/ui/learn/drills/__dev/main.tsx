// Review harness (deleted after verification): the drills hub inside the real shell, StrictMode, at #learn/drills.
import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppShell, LabPlaceholder, PlayPlaceholder, Providers } from '@/ui/shell';
import '@/styles/global.css';
import { DrillsHub } from '../index';

function LearnDrills(): JSX.Element {
  const raw = new URLSearchParams(window.location.search).get('seed');
  const seed = raw === null ? undefined : Number(raw);
  return <DrillsHub seed={seed !== undefined && Number.isFinite(seed) ? seed : undefined} />;
}

const container = document.getElementById('root');
if (!container) throw new Error('no #root');
ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <Providers>
      <AppShell views={{ play: PlayPlaceholder, learn: LearnDrills, lab: LabPlaceholder }} />
    </Providers>
  </React.StrictMode>,
);
