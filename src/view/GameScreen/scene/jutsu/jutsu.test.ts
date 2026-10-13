import * as THREE from 'three';
import { BombKind } from '../../../../engine/types';
import { MAX_FLASH_HZ } from '../flashSafety';
import {
  BOMB_SPIN_RAD_PER_S, JUTSU_LOOKS, JUTSU_OF_BOMB, RASENSHURIKEN_BLADES, TOMOE_COUNT,
  jutsuBeatsPerSecond,
} from './jutsuLooks';
import {
  CellPose, JUTSU_LAYERS, JutsuLayer, createCellPose, lightningFork, poseJutsuCell,
  rasenshurikenSpin,
  tomoeSpin,
} from './explosionPoses';
import { enemyJutsuFor } from './enemyJutsu';

const KINDS = Object.keys(JUTSU_OF_BOMB) as BombKind[];

function pose(
  kind: BombKind,
  progress: number,
  seconds = 0,
  reducedMotion = false,
  index = 3
): CellPose {
  const effect = JUTSU_OF_BOMB[kind];
  return poseJutsuCell(effect, progress, index, seconds, reducedMotion, createCellPose());
}

const jutsuLayersOn = (cell: CellPose) => JUTSU_LAYERS.filter((layer) => cell[layer].on);

/** Times in one second a spinning shape's `count` arms cross one fixed direction. */
function crossings(angleAt: (seconds: number) => number, count: number): number {
  let passes = 0;
  const step = 1 / 2000;
  for (let t = 0; t < 1; t += step) {
    const before = (angleAt(t) * count) / (Math.PI * 2);
    const after = (angleAt(t + step) * count) / (Math.PI * 2);
    passes += Math.abs(Math.floor(after) - Math.floor(before));
  }
  return passes;
}

describe('jutsu blasts', () => {
  it('keeps the danger marks under every jutsu: a floor shockwave and ring in its danger colour', () => {
    KINDS.forEach((kind) => {
      const cell = pose(kind, 0.5);
      const danger = new THREE.Color(JUTSU_LOOKS[JUTSU_OF_BOMB[kind]].danger);
      (['shockwave', 'ring'] as const).forEach((layer) => {
        const mark = cell[layer];
        expect({
          kind, layer, onFloor: mark.y < 0.2, big: mark.sx > 0.6, colour: mark.color.equals(danger)
        })
          .toEqual({
            kind, layer, onFloor: true, big: true, colour: true,
          });
      });
      // And the blast's body stands over the cell.
      const body = cell.flame.sx > 0.3 && cell.flame.sy > 0.3;
      expect({ kind, body }).toEqual({ kind, body: true });
    });
  });

  it('draws each signature as its jutsu', () => {
    const drawn = Object.fromEntries(KINDS.map((kind) => [kind, jutsuLayersOn(pose(kind, 0.4))]));
    expect(drawn).toEqual({
      standard: [],
      // A clone bursts in a puff of smoke.
      shadowClone: ['puff'],
      shadowCloneBarrage: ['puff'],
      // Wind blades round a chakra sphere.
      rasenshuriken: ['blade'],
      // Forked bolts.
      chidoriMine: ['bolt'],
      kirin: ['bolt'],
      // Sand dust over the closing spikes.
      sandCoffin: ['puff'],
      sandTsunami: ['puff'],
      // Smoke off a clay blast.
      claySpider: ['puff'],
      giantClay: ['puff'],
      // Crows and the Sharingan's tomoe.
      crowClone: ['bird'],
      tsukuyomi: ['sigil'],
      // The yellow flash is streaks on the base layers.
      thunderMark: [],
      instantTeleport: [],
    } satisfies Record<BombKind, JutsuLayer[]>);
    // Kirin's bolt is a sky-high column; Chidori's crackles at the cell.
    expect(pose('kirin', 0.5).bolt.sy).toBeGreaterThan(2 * pose('chidoriMine', 0.5).bolt.sy);
    // Amaterasu's flames are black; the yellow flash is yellow.
    expect(pose('crowClone', 0.5).accent.color.getHexString()).toBe('0a0a0f');
    const flash = { h: 0, s: 0, l: 0 };
    pose('instantTeleport', 0.5).accent.color.getHSL(flash, THREE.SRGBColorSpace);
    expect(flash.h * 360).toBeGreaterThan(45);
    expect(flash.h * 360).toBeLessThan(60);
    // The flash streaks shoot out flat from the mark.
    expect(Math.abs(pose('thunderMark', 0.5).accent.rx)).toBeCloseTo(Math.PI / 2);
  });

  it('keeps every spin and crackle at or under three beats a second', () => {
    Object.entries(jutsuBeatsPerSecond()).forEach(([shape, beats]) => {
      expect({ shape, safe: beats <= MAX_FLASH_HZ }).toEqual({ shape, safe: true });
    });
    // Sampled: the Rasenshuriken's blades as they turn on a slowly turning bomb.
    const onBomb = (t: number) => rasenshurikenSpin(t, 0, false) + t * BOMB_SPIN_RAD_PER_S;
    expect(crossings(onBomb, RASENSHURIKEN_BLADES)).toBeLessThanOrEqual(MAX_FLASH_HZ);
    expect(crossings((t) => tomoeSpin(t, false), TOMOE_COUNT)).toBeLessThanOrEqual(MAX_FLASH_HZ);
    // Lightning forks: every change lights some pixels and darkens others.
    let changes = 0;
    for (let t = 0; t < 1; t += 0.001) {
      if (lightningFork(t + 0.001, false) !== lightningFork(t, false)) changes += 1;
    }
    expect(changes / 2).toBeLessThanOrEqual(MAX_FLASH_HZ);
    // Still a clear spin, not a crawl.
    expect(crossings(onBomb, RASENSHURIKEN_BLADES)).toBeGreaterThanOrEqual(2);
  });

  it('holds every jutsu still under reduced motion: nothing spins, forks or flies', () => {
    KINDS.forEach((kind) => {
      const early = pose(kind, 0.5, 1.23, true);
      const later = pose(kind, 0.5, 7.91, true);
      const same = JSON.stringify(early) === JSON.stringify(later);
      expect({ kind, same }).toEqual({ kind, same: true });
    });
    // Crows scatter outward as the flame ages, but not under reduced motion.
    const reach = (cell: CellPose) => Math.hypot(cell.bird.x, cell.bird.z);
    expect(reach(pose('crowClone', 0.8))).toBeGreaterThan(reach(pose('crowClone', 0.2)) + 0.2);
    expect(reach(pose('crowClone', 0.8, 0, true))).toBeCloseTo(reach(pose('crowClone', 0.2, 0, true)));
    // And without it, the blades do turn.
    expect(pose('rasenshuriken', 0.5, 0.2).blade.ry).not.toBeCloseTo(pose('rasenshuriken', 0.5, 0.5).blade.ry);
  });

  it('poses a cell in place, so the blast loop allocates nothing', () => {
    const cell = createCellPose();
    const colours = JUTSU_LAYERS.map((layer) => cell[layer].color);
    expect(poseJutsuCell('kirin', 0.3, 1, 0.5, false, cell)).toBe(cell);
    poseJutsuCell('amaterasu', 0.6, 2, 0.9, false, cell);
    expect(JUTSU_LAYERS.map((layer) => cell[layer].color)).toEqual(colours);
    JUTSU_LAYERS.forEach((layer, index) => expect(cell[layer].color).toBe(colours[index]));
  });
});

describe('enemy jutsu', () => {
  it('draws an enemy\'s kunai and lightning strike, and keeps the beasts\' own attacks', () => {
    expect(enemyJutsuFor({ id: 'monster-hazard-4', kind: 'chakraShockwave' })).toBe('kunai');
    expect(enemyJutsuFor({ id: 'monster-hazard-9', kind: 'airStrike' })).toBe('lightning');
    // Sand spikes look the same from a sand ninja or from Shukaku.
    expect(enemyJutsuFor({ id: 'monster-hazard-2', kind: 'sandSpikes' })).toBe('sandSpike');
    expect(enemyJutsuFor({ id: 'hazard-12', kind: 'sandSpikes' })).toBe('sandSpike');
    // A beast's chakra shockwave and Chomei's air strike stay theirs.
    expect(enemyJutsuFor({ id: 'hazard-3', kind: 'chakraShockwave' })).toBeNull();
    expect(enemyJutsuFor({ id: 'hazard-5', kind: 'airStrike' })).toBeNull();
    expect(enemyJutsuFor({ id: 'monster-hazard-7', kind: 'waterCannon' })).toBeNull();
  });
});
