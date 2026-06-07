import { vi, type Mock } from 'vitest';
/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line import/no-extraneous-dependencies
import { renderHook } from '@testing-library/react-hooks';
import { act } from 'react-dom/test-utils';
import { usePlayerActions } from './usePlayerActions';
import { Player } from '../model/player';

vi.mock('../model/player');

describe('usePlayerActions', () => {
  let mockPlayersInfo: Array<any>;
  let mockSetMap: Mock;
  let mockAddPowerUp: Mock;
  let mockRemovePowerUp: Mock;
  let mockIsPowerUpActive: Mock;

  beforeEach(() => {
    mockSetMap = vi.fn();
    mockAddPowerUp = vi.fn();
    mockRemovePowerUp = vi.fn();
    mockIsPowerUpActive = vi.fn();

    const mockPlayer = {
      isAlive: vi.fn().mockReturnValue(true),
      move: vi.fn(),
      getId: vi.fn().mockReturnValue('player1'),
      getY: vi.fn().mockReturnValue(1),
      getX: vi.fn().mockReturnValue(1),
    } as unknown as Player;

    mockPlayersInfo = [{
      player: mockPlayer,
      setNewPlayer: vi.fn(),
      dropBomb: vi.fn(),
      keyBindings: ['w', 'a', 's', 'd', ' '],
      enemies: [],
    }];
  });

  it('should not perform any action if player is not alive', () => {
    mockPlayersInfo[0].player.isAlive.mockReturnValue(false);

    const { result } = renderHook(() => usePlayerActions(
      mockPlayersInfo,
      { current: [] as unknown as any },
      mockSetMap,
      mockAddPowerUp,
      mockRemovePowerUp,
      mockIsPowerUpActive
    ));

    act(() => {
      result.current({ key: 'w' } as KeyboardEvent);
    });

    expect(mockPlayersInfo[0].player.move).not.toHaveBeenCalled();
  });
});
