import { vi, type Mock } from 'vitest';
// eslint-disable-next-line import/no-extraneous-dependencies
import { renderHook } from '@testing-library/react-hooks';
import { act } from '@testing-library/react';
import { useBombManager } from './useBombManager';
import { Player } from '../model/player';
import { GameMap } from '../model/gameItem';

vi.mock('../model/player');
vi.mock('../model/gameItem', () => ({
  isObstacle: vi.fn(),
  isBomb: vi.fn(),
  randomPowerUpGenerator: vi.fn().mockReturnValue('Empty'),
}));

describe('useBombManager', () => {
  let mockPlayersRef: React.MutableRefObject<Player[]>;
  let mockSetPlayers: Mock[];
  let mockMapRef: React.MutableRefObject<GameMap>;
  let mockSetMap: Mock;
  let mockSetExplosions: Mock;
  let mockSetDestroyedBoxes: Mock;

  beforeEach(() => {
    const mockPlayer = {
      getId: vi.fn().mockReturnValue('player1'),
      getY: vi.fn().mockReturnValue(1),
      getX: vi.fn().mockReturnValue(1),
      getBombs: vi.fn().mockReturnValue(1),
      getBombRange: vi.fn().mockReturnValue(1),
      canPlaceBomb: vi.fn().mockReturnValue(true),
      incrementActiveBombs: vi.fn(),
      decrementActiveBombs: vi.fn(),
      isAlive: vi.fn().mockReturnValue(true),
      isDetonator: vi.fn().mockReturnValue(false),
      isInvincible: vi.fn().mockReturnValue(false),
      killPlayer: vi.fn(),
      removePowerUp: vi.fn(),
    } as unknown as Player;

    mockPlayersRef = { current: [mockPlayer] };
    mockSetPlayers = [vi.fn()];
    mockMapRef = { current: [['Empty', 'Empty'], ['Empty', 'Empty']] };
    mockSetMap = vi.fn();
    mockSetExplosions = vi.fn();
    mockSetDestroyedBoxes = vi.fn();
  });

  it('should drop a bomb on the map', () => {
    const { result } = renderHook(() => useBombManager(
      0,
      mockPlayersRef,
      mockSetPlayers,
      mockMapRef,
      mockSetMap,
      mockSetExplosions,
      mockSetDestroyedBoxes
    ));

    act(() => {
      result.current.dropBomb(1, 1);
    });

    expect(mockPlayersRef.current[0].incrementActiveBombs).toHaveBeenCalled();
    expect(mockSetMap).toHaveBeenCalledWith([
      ['Empty', 'Empty'],
      ['Empty', expect.any(Object)],
    ]);
    expect(mockSetPlayers[0]).toHaveBeenCalled();
  });

  it('should explode a bomb after a delay', () => {
    vi.useFakeTimers();

    const { result } = renderHook(() => useBombManager(
      0,
      mockPlayersRef,
      mockSetPlayers,
      mockMapRef,
      mockSetMap,
      mockSetExplosions,
      mockSetDestroyedBoxes
    ));

    act(() => {
      result.current.dropBomb(1, 1);
    });

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(mockSetExplosions).toHaveBeenCalled();
    expect(mockSetMap).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('should not drop a bomb if the cell is not empty', () => {
    mockMapRef.current[1][1] = 'Wall';

    const { result } = renderHook(() => useBombManager(
      0,
      mockPlayersRef,
      mockSetPlayers,
      mockMapRef,
      mockSetMap,
      mockSetExplosions,
      mockSetDestroyedBoxes
    ));

    act(() => {
      result.current.dropBomb(1, 1);
    });

    expect(mockPlayersRef.current[0].incrementActiveBombs).not.toHaveBeenCalled();
    expect(mockSetMap).not.toHaveBeenCalled();
    expect(mockSetPlayers[0]).not.toHaveBeenCalled();
  });
});
