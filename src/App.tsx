import React, { Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import theme from './theme/InstructionsTheme';
import './App.css';
import { WelcomeScreen } from './view/WelcomeScreen/WelcomeScreen';
import { ConfigScreen } from './view/ConfigScreen/ConfigScreen';
import { InstructionsScreen } from './view/InstructionsScreen/InstructionsScreen';
import { GameSettingsProvider } from './contexts/GameSettingsContext';
import { MenuPad } from './input/MenuPad';
import {
  gameScreenChunk,
  lazyScreen,
  usePrefetchGameScreen,
  usePrefetchGameScreenWhenIdle,
} from './view/routeChunks';

// The match (three.js, the scene, the HUD) is about 255 KB gzip that the menus
// never run, so it loads on demand. The menus start the download early.
const GameScreen = lazyScreen(gameScreenChunk, 'GameScreen');

// Quick Play skips the Mission Deck, so the title screen fetches the match
// once it is idle; the Mission Deck fetches it as soon as it opens.
const PrefetchGameWhenIdle = () => {
  usePrefetchGameScreenWhenIdle();
  return null;
};
const PrefetchGame = () => {
  usePrefetchGameScreen();
  return null;
};

const gameLoading = (
  <div
    role="status"
    style={{
      minHeight: '100dvh',
      paddingTop: 32,
      color: 'var(--anime-paper-light)',
      background: 'var(--anime-night)',
      textAlign: 'center',
      fontSize: '1.1rem',
    }}
  >
    Loading game...
  </div>
);

export function App() {
  return (
    <GameSettingsProvider>
      <ThemeProvider theme={theme}>
        {/* Gamepads drive every screen's menus and dialogs. */}
        <MenuPad />
        <Routes>
          <Route
            path="/"
            element={(
              <>
                <PrefetchGameWhenIdle />
                <WelcomeScreen />
              </>
            )}
          />
          <Route
            path="/config"
            element={(
              <>
                <PrefetchGame />
                <ConfigScreen />
              </>
            )}
          />
          <Route path="/instructions" element={<InstructionsScreen />} />
          <Route
            path="/game/:numOfPlayers/:numOfRounds/:selectedMap"
            element={<Suspense fallback={gameLoading}><GameScreen /></Suspense>}
          />
        </Routes>
      </ThemeProvider>
    </GameSettingsProvider>
  );
}
