import { cellKey } from '../../../engine/fogOfWar';
import { MonsterState } from '../../../engine/types';

/**
 * Enemies whose warned target tile is in sight. The marker belongs to the
 * threatened tile, not the attacker: an enemy hidden in fog can still aim a
 * Zetsu Ambush or Body Flicker at a tile the player can see.
 */
export function getVisibleAbilityWarnings(
  monsters: MonsterState[],
  visibleCells: Set<string>
): MonsterState[] {
  return monsters.filter((monster) => (
    (monster.abilityWarningTicks ?? 0) > 0
    && !!monster.abilityTarget
    && visibleCells.has(cellKey(monster.abilityTarget.x, monster.abilityTarget.y))
  ));
}
