import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { App } from './App';
import { installStaleChunkReload } from './view/routeChunks';
import { applyDocumentPreferences, loadGamePreferences } from './view/GameScreen/gamePreferences';

import './index.css';

installStaleChunkReload();

// The page follows the saved High contrast / Reduced motion settings (or
// the system's) from the first paint, not only once a match opens.
applyDocumentPreferences(loadGamePreferences());

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
