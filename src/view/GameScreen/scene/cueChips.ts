import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { Power, powerUpOptions } from '../../../model/gameItem';
import { playerSlotColor } from '../playerSlots';
import {
  PLAYER_TAG_SPRITES, PlayerTagSprite, chipKey, koChipKey,
} from './playerTags';

// What a pickup does, in plain words: the label that rises from the ninja
// who took it. It names the stat change, not a themed title, so it reads the
// same for every character and fits a small chip. The border colour matches
// the pickup's HUD chip; the ink-on-paper text carries the meaning.
export const PICKUP_LABELS: Record<Power, { label: string; color: string }> = {
  AddBomb: { label: '+Bomb', color: '#f97316' },
  BlastRangeUp: { label: '+Range', color: '#22c55e' },
  Detonator: { label: 'Remote', color: '#dc2626' },
  RollerSkate: { label: '+Speed', color: '#38bdf8' },
  Invincibility: { label: 'Shield', color: '#a855f7' },
  Ghost: { label: 'Phase', color: '#16a34a' },
  Obstacle: { label: '+Cover', color: '#a16207' },
  ClaySpider: { label: '+Bomb+Range', color: '#f97316' },
  Rasengan: { label: '+Range', color: '#22c55e' },
  Sharingan: { label: 'Remote', color: '#dc2626' },
  FTGKunai: { label: '+Speed', color: '#38bdf8' },
  CrowFeather: { label: 'Phase', color: '#16a34a' },
  SandArmor: { label: 'Shield', color: '#a855f7' },
  ChakraScroll: { label: '+Range', color: '#22c55e' },
  CharacterFragment: { label: '+Ult', color: '#facc15' },
};

export function pickupChipKey(power: Power): string {
  const { label, color } = PICKUP_LABELS[power];
  return chipKey(label, color, 'pickup');
}

export type CueChips = {
  pickups: Map<Power, PlayerTagSprite>;
  /** KO chip per slot index; empty outside local multiplayer. */
  ko: PlayerTagSprite[];
};

/**
 * Draws every pickup label and each slot's KO chip when the arena mounts
 * (during the round countdown), uploads their textures and keeps them
 * referenced until it unmounts. The first pickup or fall of the match then
 * costs no canvas draw, no texture upload and no shader compile: the chips
 * share the name-tag sprite program the warmup already holds.
 */
export function useCueChips(slots: number): CueChips {
  const gl = useThree((state) => state.gl);
  const keys = useMemo(() => {
    const pickupKeys = powerUpOptions.map(pickupChipKey);
    const koKeys = Array.from({ length: slots }, (_, index) => (
      koChipKey(index + 1, playerSlotColor(index))
    ));
    return { pickupKeys, koKeys };
  }, [slots]);
  const chips = useMemo<CueChips>(() => {
    const pickups = new Map<Power, PlayerTagSprite>();
    powerUpOptions.forEach((power, index) => {
      pickups.set(power, PLAYER_TAG_SPRITES.get(keys.pickupKeys[index]));
    });
    return { pickups, ko: keys.koKeys.map((key) => PLAYER_TAG_SPRITES.get(key)) };
  }, [keys]);

  useEffect(() => {
    const held: [string, PlayerTagSprite][] = [];
    const hold = (key: string, sprite: PlayerTagSprite) => {
      if (held.some(([, value]) => value === sprite)) return;
      PLAYER_TAG_SPRITES.retain(key, sprite);
      held.push([key, sprite]);
      try {
        gl.initTexture(sprite.texture);
      } catch {
        // Best effort: without the early upload the first draw uploads it.
      }
    };
    powerUpOptions.forEach((power, index) => {
      hold(keys.pickupKeys[index], chips.pickups.get(power) as PlayerTagSprite);
    });
    keys.koKeys.forEach((key, index) => hold(key, chips.ko[index]));
    return () => held.forEach(([key, sprite]) => PLAYER_TAG_SPRITES.release(key, sprite));
  }, [chips, gl, keys]);

  return chips;
}
