// Temporary dev harness: mounts <LabView/> inside the shell. Deleted before the module is handed over.
import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppShell, LearnPlaceholder, PlayPlaceholder, Providers } from '@/ui/shell';
import { LabView } from '../index';
import '@/styles/global.css';

if (!window.location.hash) window.location.hash = '#lab';

const container = document.getElementById('root');
if (!container) throw new Error('#root missing');
ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <Providers>
      <AppShell views={{ play: PlayPlaceholder, learn: LearnPlaceholder, lab: LabView }} />
    </Providers>
  </React.StrictMode>,
);
