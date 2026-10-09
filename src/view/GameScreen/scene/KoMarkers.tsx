/* eslint-disable react/no-unknown-property */
import React from 'react';
import { getPlayerCell } from '../../../engine/grid';
import { PlayerState } from '../../../engine/types';
import { PlayerTagSprite } from './playerTags';
import { toWorld } from './sceneSpace';

const KO_CHIP_HEIGHT = 0.34;
// One stable tag object per player id (there are at most three).
const KO_TAGS = new Map<string, { koMarker: string }>();

function koTag(playerId: string): { koMarker: string } {
  let tag = KO_TAGS.get(playerId);
  if (!tag) {
    tag = { koMarker: playerId };
    KO_TAGS.set(playerId, tag);
  }
  return tag;
}

/**
 * A greyed "P2 KO" chip on the cell where each fallen ninja went down. It
 * stays until the round resets the players, so the survivors can still see
 * who fell where. One sprite (one draw call) per fallen ninja, sharing the
 * pre-warmed name-tag program; the fallen body and its own tag are hidden at
 * the same time, so a fall never adds draw calls overall.
 */
export function KoMarkers({
  players,
  chips,
}: {
  players: readonly PlayerState[];
  chips: readonly PlayerTagSprite[];
}) {
  return (
    <>
      {players.map((player, index) => {
        const chip = chips[index];
        if (player.alive || !chip) return null;
        const cell = getPlayerCell(player);
        const [wx, , wz] = toWorld(cell.x, cell.y);
        return (
          <sprite
            key={`ko-${player.id}`}
            position={[wx, KO_CHIP_HEIGHT, wz]}
            scale={[KO_CHIP_HEIGHT * 1.15 * chip.aspect, KO_CHIP_HEIGHT * 1.15, 1]}
            material={chip.material}
            renderOrder={9}
            userData={koTag(player.id)}
          />
        );
      })}
    </>
  );
}
