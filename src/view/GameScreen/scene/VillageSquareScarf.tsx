/* eslint-disable react/no-unknown-property */
import React from 'react';
import { FIGHTER_INK_MATERIAL } from './fighterInk';
import { tokenToonMaterial } from './inkedToken';
import { scarfToken } from './VillageSquareModels';

// A faint ember glow: a uniform on a pooled token material, same program.
const SCARF_MATERIAL = tokenToonMaterial('#f97316', 0.16);
const SCARF_MARK = { honoredScarf: true };

/**
 * The ember-thread scarf an Honored player wears (villageSquare.ts
 * HONORED_COSMETIC_TIER). Mounted in the fighter's pose group beside the
 * figure, not inside it, so the character's shared ink hull never includes
 * it; it carries its own line. Ghost drops it with the solid look.
 */
export function HonoredScarf({ hidden }: { hidden: boolean }) {
  const token = scarfToken();
  return (
    <group visible={!hidden}>
      <mesh geometry={token.body} material={SCARF_MATERIAL} castShadow userData={SCARF_MARK} />
      {token.ink && <mesh geometry={token.ink} material={FIGHTER_INK_MATERIAL} />}
    </group>
  );
}
