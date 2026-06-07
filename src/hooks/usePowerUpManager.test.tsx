import { vi, type Mock } from 'vitest';
/* eslint-disable max-len */
// eslint-disable-next-line import/no-extraneous-dependencies
import { renderHook, act } from '@testing-library/react-hooks';
import usePowerUpManager from './usePowerUpManager';
import { Player } from '../model/player';
import { GameMap } from '../model/gameItem';

vi.mock('../model/player');
vi.mock('../model/gameItem', () => ({
  isObstacle: vi.fn().mockReturnValue(false),
}));

describe('usePowerUpManager', () => {
  let mockPlayersRef: React.MutableRefObject<Player[]>;
  let mockSetPlayers: Mock[];
  let mockMapRef: React.MutableRefObject<GameMap>;

  beforeEach(() => {
    const mockPlayer = {
      getId: vi.fn().mockReturnValue('player1'),
      getY: vi.fn().mockReturnValue(1),
      getX: vi.fn().mockReturnValue(1),
      isAlive: vi.fn().mockReturnValue(true),
      killPlayer: vi.fn(),
    } as unknown as Player;

    mockPlayersRef = { current: [mockPlayer] };
    mockSetPlayers = [vi.fn()];
    mockMapRef = { current: [['Empty', 'Empty'], ['Empty', 'Empty']] };
  });

  it('should add a power-up to a player', () => {
    const { result } = renderHook(() => usePowerUpManager(mockMapRef, mockPlayersRef, mockSetPlayers));

    act(() => {
      result.current.addPowerUp('player1', 'Ghost', 5000);
    });

    expect(result.current.isPowerUpActive('player1', 'Ghost')).toBe(true);
  });

  it('should remove a power-up from a player', () => {
    const { result } = renderHook(() => usePowerUpManager(mockMapRef, mockPlayersRef, mockSetPlayers));

    act(() => {
      result.current.addPowerUp('player1', 'Ghost', 5000);
      result.current.removePowerUp('player1', 'Ghost');
    });

    expect(result.current.isPowerUpActive('player1', 'Ghost')).toBe(false);
  });

  it('should check if a power-up is flashing', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => usePowerUpManager(mockMapRef, mockPlayersRef, mockSetPlayers));

    act(() => {
      result.current.addPowerUp('player1', 'Ghost', 5000);
      vi.advanceTimersByTime(2000); // Fast-forward time
    });

    expect(result.current.isPowerUpFlashing('player1', 'Ghost')).toBe(true);

    vi.useRealTimers();
  });

  it('should clear all power-ups for a player', () => {
    const { result } = renderHook(() => usePowerUpManager(mockMapRef, mockPlayersRef, mockSetPlayers));

    act(() => {
      result.current.addPowerUp('player1', 'Ghost', 5000);
      result.current.addPowerUp('player1', 'Invincibility', 5000);
      result.current.clearPowerUps('player1');
    });

    expect(result.current.isPowerUpActive('player1', 'Ghost')).toBe(false);
    expect(result.current.isPowerUpActive('player1', 'Invincibility')).toBe(false);
  });
});
