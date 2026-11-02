import React, { Suspense, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import theme from './theme/InstructionsTheme';
import './App.css';
import { WelcomeScreen } from './view/WelcomeScreen/WelcomeScreen';
import { ConfigScreen } from './view/ConfigScreen/ConfigScreen';
import { InstructionsScreen } from './view/InstructionsScreen/InstructionsScreen';
import { DojoScreen } from './view/DojoScreen/DojoScreen';
import { OnlineLobbyScreen } from './view/OnlineScreen/OnlineLobbyScreen';
import { GameSettingsProvider } from './contexts/GameSettingsContext';
import { MenuPad } from './input/MenuPad';
import { TouchMode } from './input/TouchMode';
import {
  dojoRoomChunk,
  gameScreenChunk,
  onlineGameChunk,
  hubScreenChunk,
  lazyScreen,
  usePrefetchGameScreen,
  usePrefetchGameScreenWhenIdle,
  usePrefetchHubScreen,
} from './view/routeChunks';

// The match (three.js, the scene, the HUD) is about 255 KB gzip that the menus
// never run, so it loads on demand. The menus start the download early.
const GameScreen = lazyScreen(gameScreenChunk, 'GameScreen');
const OnlineGameScreen = lazyScreen(onlineGameChunk, 'OnlineGameScreen');
const DojoRoomScreen = lazyScreen(dojoRoomChunk, 'DojoRoomScreen');
const HubScreen = lazyScreen(hubScreenChunk, 'HubScreen');

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
// The dojo's room list fetches the room screen (and the match it runs).
const PrefetchDojoRoom = () => {
  useEffect(() => {
    dojoRoomChunk.prefetch();
  }, []);
  return null;
};
const PrefetchHub = () => {
  usePrefetchHubScreen();
  return null;
};

// While a screen's chunk downloads: a skeleton shaped like the match (the
// HUD strip over the square arena), not a spinner.
const gameLoading = (
  <div
    role="status"
    style={{
      minHeight: '100dvh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 16,
      padding: 24,
      color: 'var(--anime-paper-light)',
      background: 'var(--anime-night)',
    }}
  >
    <span className="caption-4">Loading game...</span>
    <div className="skeleton" aria-hidden="true" style={{ width: 'min(960px, 100%)', height: 48 }} />
    <div
      className="skeleton"
      aria-hidden="true"
      style={{ width: 'min(640px, 100%, calc(100dvh - 160px))', aspectRatio: '1 / 1' }}
    />
  </div>
);

export function App() {
  return (
    <GameSettingsProvider>
      <ThemeProvider theme={theme}>
        {/* Gamepads drive every screen's menus and dialogs. */}
        <MenuPad />
        {/* Touch controls on touch screens, until a keyboard or pad is used. */}
        <TouchMode />
        {/* One landmark for every screen; MUI dialogs portal outside it. */}
        <main id="main-content">
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
                  <PrefetchHub />
                  <ConfigScreen />
                </>
              )}
            />
            <Route path="/instructions" element={<InstructionsScreen />} />
            <Route path="/online" element={<OnlineLobbyScreen />} />
            <Route path="/online/:roomId" element={<OnlineLobbyScreen />} />
            <Route
              path="/online/:roomId/play"
              element={<Suspense fallback={gameLoading}><OnlineGameScreen /></Suspense>}
            />
            <Route
              path="/dojo"
              element={(
                <>
                  <PrefetchDojoRoom />
                  <DojoScreen />
                </>
              )}
            />
            <Route
              path="/dojo/:roomId"
              element={<Suspense fallback={gameLoading}><DojoRoomScreen /></Suspense>}
            />
            <Route
              path="/hub/:stageId"
              element={(
                <>
                  <PrefetchGame />
                  <Suspense fallback={gameLoading}><HubScreen /></Suspense>
                </>
              )}
            />
            <Route
              path="/game/:numOfPlayers/:numOfRounds/:selectedMap"
              element={<Suspense fallback={gameLoading}><GameScreen /></Suspense>}
            />
          </Routes>
        </main>
      </ThemeProvider>
    </GameSettingsProvider>
  );
}
