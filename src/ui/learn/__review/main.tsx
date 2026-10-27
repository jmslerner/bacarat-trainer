// Review harness (deleted after verification): LearnView inside the real shell, StrictMode.
import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppShell, LabPlaceholder, PlayPlaceholder, Providers } from '@/ui/shell';
import '@/styles/global.css';
import { LearnView } from '../index';

const container = document.getElementById('root');
if (!container) throw new Error('no #root');
ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <Providers>
      <AppShell views={{ play: PlayPlaceholder, learn: LearnView, lab: LabPlaceholder }} />
    </Providers>
  </React.StrictMode>,
);
