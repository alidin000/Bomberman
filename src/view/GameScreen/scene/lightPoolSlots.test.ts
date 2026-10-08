import * as THREE from 'three';
import {
  isAnchorRendered,
  LIGHT_PRIORITY,
  PooledLightRequest,
  selectPooledLights,
} from './lightPoolSlots';

function request(priority: number, intensity = 1): PooledLightRequest {
  const anchor = new THREE.Object3D();
  return {
    anchor,
    position: anchor.position,
    color: new THREE.Color('#ffffff'),
    intensity,
    distance: 2,
    decay: 2,
    priority,
  };
}

const alwaysRendered = () => true;

describe('selectPooledLights', () => {
  it('gives over-capacity slots to higher priority, oldest first within a priority', () => {
    const markerA = request(LIGHT_PRIORITY.marker);
    const playerA = request(LIGHT_PRIORITY.player);
    const bombOld = request(LIGHT_PRIORITY.bomb);
    const playerB = request(LIGHT_PRIORITY.player);
    const bombNew = request(LIGHT_PRIORITY.bomb);
    const explosion = request(LIGHT_PRIORITY.explosion);
    const out: PooledLightRequest[] = [];

    const used = selectPooledLights(
      [markerA, playerA, bombOld, playerB, bombNew, explosion],
      4,
      out,
      alwaysRendered
    );

    expect(used).toBe(4);
    expect(out.slice(0, used)).toEqual([explosion, bombOld, bombNew, playerA]);
  });

  it('skips dark and unrendered requests so they never hold a slot', () => {
    const dark = request(LIGHT_PRIORITY.explosion, 0);
    const hidden = request(LIGHT_PRIORITY.bomb);
    const lit = request(LIGHT_PRIORITY.marker);
    const out: PooledLightRequest[] = [];

    const used = selectPooledLights(
      [dark, hidden, lit],
      4,
      out,
      (anchor) => anchor !== hidden.anchor
    );

    expect(out.slice(0, used)).toEqual([lit]);
  });
});

describe('isAnchorRendered', () => {
  it('is false when any ancestor is hidden or the anchor is detached', () => {
    const scene = new THREE.Scene();
    const group = new THREE.Group();
    const anchor = new THREE.Object3D();
    group.add(anchor);

    expect(isAnchorRendered(anchor)).toBe(false);
    scene.add(group);
    expect(isAnchorRendered(anchor)).toBe(true);
    // Invincibility blinks the player group; the light must follow it.
    group.visible = false;
    expect(isAnchorRendered(anchor)).toBe(false);
  });
});
