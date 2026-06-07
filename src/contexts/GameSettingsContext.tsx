import React, {
  createContext,
  useContext,
  ReactNode,
  useState,
  useMemo
} from 'react';
import { DEFAULT_KEY_BINDINGS, KeyBindings, normalizeKeyBindings } from '../constants/props';

interface GameSettingsContextType {
  playerKeyBindings: KeyBindings;
  setPlayerKeyBindings: React.Dispatch<React.SetStateAction<KeyBindings>>;
}

const defaultState: GameSettingsContextType = {
  playerKeyBindings: normalizeKeyBindings(DEFAULT_KEY_BINDINGS),
  setPlayerKeyBindings: () => {}
};

const GameSettingsContext = createContext<GameSettingsContextType>(defaultState);

export const useGameSettings = () => useContext(GameSettingsContext);

interface Props {
  children: ReactNode;
}

export const GameSettingsProvider: React.FC<Props> = ({ children }) => {
  const [playerKeyBindings, setPlayerKeyBindings] = useState<KeyBindings>(
    defaultState.playerKeyBindings
  );

  const value = useMemo(() => ({
    playerKeyBindings,
    setPlayerKeyBindings
  }), [playerKeyBindings, setPlayerKeyBindings]);

  return (
    <GameSettingsContext.Provider value={value}>
      {children}
    </GameSettingsContext.Provider>
  );
};
