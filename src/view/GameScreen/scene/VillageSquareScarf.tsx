/* eslint-disable react/no-unknown-property */
import React, { useMemo } from 'react';
import type { ScarfId } from '../../../content/villageSquare';
import { FIGHTER_INK_MATERIAL } from './fighterInk';
import { tokenToonMaterial } from './inkedToken';
import { SCARF_COLORS, scarfMesh } from './cast/castScarf';

/**
 * The scarf the player chose to wear (GameConfig.village.scarf): the ember
 * scarf, or a village's scarf in its colours (cast/castScarf.ts). Mounted in
 * the fighter's pose group beside the figure, not inside it, so the
 * character's shared ink hull never includes it; it carries its own line.
 * Ghost drops it with the solid look.
 */
export function VillageScarf({ scarf, hidden }: { scarf: ScarfId; hidden: boolean }) {
  const token = scarfMesh(scarf);
  const colors = SCARF_COLORS[scarf];
  // A faint glow is a uniform on a pooled token material: the same program.
  const material = colors.glow ? tokenToonMaterial(colors.glow, 0.16) : tokenToonMaterial();
  const mark = useMemo(() => ({ villageScarf: scarf, honoredScarf: scarf === 'ember' }), [scarf]);
  return (
    <group visible={!hidden}>
      <mesh
        geometry={token.body}
        material={material}
        castShadow
        userData={mark}
      />
      {token.ink && <mesh geometry={token.ink} material={FIGHTER_INK_MATERIAL} />}
    </group>
  );
}
