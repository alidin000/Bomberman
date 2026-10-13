import { describe, expect, it } from 'vitest';
import { CAMPAIGN_VILLAGES } from './campaign';
import { getHubVillage } from './hubVillages';
import {
  SECRET_KINDS, getVillageSecrets, secretHint, secretSetProgress, secretWhere,
} from './villageSecrets';
import { getStoryScene } from './storyScenes';
import { isCastId } from './animeCast';
import { sceneKey } from '../story/progress';

const stageIds = CAMPAIGN_VILLAGES.map((village) => village.stageId);

describe('the Secrets tracker', () => {
  it('says roughly where a secret is from its map cell, so a remap moves the words', () => {
    // The leaf scroll cache at (16, 8) sits by the outer district (20, 6).
    expect(secretWhere('hiddenLeaf', 16, 8)).toBe('North-west, near the outer district');
    expect(secretWhere('hiddenLeaf', 24, 23)).toBe('In the village centre');
    expect(secretWhere('hiddenLeaf', 48, 2)).toBe('North-east, in the corner');
    expect(getVillageSecrets('hiddenLeaf')[0].where).toBe('North-west, near the outer district');
  });

  it('lists three secrets per village with the way in and what each gives', () => {
    stageIds.forEach((stageId) => {
      const secrets = getVillageSecrets(stageId);
      expect(secrets.map((secret) => secret.kind)).toEqual([...SECRET_KINDS]);
      expect(secrets.map((secret) => secret.page.secretId))
        .toEqual(secrets.map((secret) => secret.id));
      secrets.forEach((secret) => {
        expect(secret.entry).toMatch(/^(Behind a cracked wall|Through a false wall)/);
      });
      expect(secrets[1].gives).toMatch(/^A Character Fragment/);
      expect(secrets[2].gives).toMatch(/Black Zetsu ambush/);
    });
    expect(getVillageSecrets('hiddenSand')[0].gives).toMatch(/^Sand Armor power-up/);
  });

  it('has the village\'s people hint at every one of its secrets, true to the map', () => {
    stageIds.forEach((stageId) => {
      const replies = getHubVillage(stageId).npcs
        .flatMap((npc) => npc.choices.map((choice) => choice.reply));
      SECRET_KINDS.forEach((kind) => {
        const hint = secretHint(stageId, kind);
        expect(replies.some((reply) => reply.includes(hint)), `${stageId} ${kind}: ${hint}`).toBe(true);
      });
    });
  });

  it('is ready to claim once all three are found, and stays claimed', () => {
    const ids = getVillageSecrets('hiddenMist').map((secret) => secret.id);
    expect(secretSetProgress('hiddenMist', ids.slice(0, 2), []))
      .toEqual({ found: 2, total: 3, state: 'hunting' });
    expect(secretSetProgress('hiddenMist', ids, []).state).toBe('ready');
    expect(secretSetProgress('hiddenMist', ids, ['hiddenMist']).state).toBe('claimed');
    // Another village's secrets do not count here.
    expect(secretSetProgress('hiddenLeaf', ids, []).found).toBe(0);
  });
});

describe('story scenes', () => {
  it('give each village a short scene before its mission and after its first win, spoken by the cast', () => {
    stageIds.forEach((stageId) => {
      const before = getStoryScene(stageId, 'before');
      const after = getStoryScene(stageId, 'after');
      expect(before.lines.length).toBeGreaterThanOrEqual(3);
      expect(before.lines.length).toBeLessThanOrEqual(6);
      expect(after.lines.length).toBeGreaterThanOrEqual(2);
      expect(after.lines.length).toBeLessThanOrEqual(4);
      [...before.lines, ...after.lines].forEach((line) => {
        expect(isCastId(line.speaker)).toBe(true);
        // Our own words, short enough for one speech box.
        expect(line.text.length).toBeLessThanOrEqual(140);
      });
      // The save's keys and the scenes' ids agree.
      expect(before.id).toBe(sceneKey(stageId, 'before'));
      expect(after.id).toBe(sceneKey(stageId, 'after'));
    });
  });
});
