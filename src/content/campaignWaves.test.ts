import { CAMPAIGN_WAVE_SCRIPTS, getCampaignWaveScript } from './campaignWaves';
import { getCampaignMission } from './campaignMissions';
import { STAGE_DEFINITIONS } from './stages';
import { getCampaignEvent } from './campaignEvents';
import { loadStageMapRows } from '../engine/mapLoader';

// Steps over open floor from (x, y): crates block every walking enemy, and
// the leash that walks wave enemies to the seal paths over open floor only.
function openSteps(map: string[][], from: { x: number; y: number }): number[][] {
  const steps = map.map((row) => row.map(() => Infinity));
  steps[from.y][from.x] = 0;
  const queue = [from];
  for (let head = 0; head < queue.length; head += 1) {
    const cell = queue[head];
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      const x = cell.x + dx;
      const y = cell.y + dy;
      if (map[y]?.[x] !== ' ' || steps[y][x] <= steps[cell.y][cell.x] + 1) return;
      steps[y][x] = steps[cell.y][cell.x] + 1;
      queue.push({ x, y });
    });
  }
  return steps;
}

describe('campaign wave scripts', () => {
  it('gives every village defense a script whose entries reach the seal', () => {
    STAGE_DEFINITIONS.forEach((stage) => {
      const script = getCampaignWaveScript(stage.id);
      expect({ stage: stage.id, script: !!script }).toEqual({ stage: stage.id, script: true });
      const seal = getCampaignMission(stage.id)!.objectives.find((item) => item.kind === 'defense')!;
      const map = loadStageMapRows(stage.mapId);
      const steps = openSteps(map, { x: seal.x!, y: seal.y! });
      script!.entries.forEach((entry) => {
        // Far enough that the marks give warning, near enough to matter, and
        // on a lane that walks to the seal.
        const steps6to12 = steps[entry.y][entry.x] >= 6 && steps[entry.y][entry.x] <= 12;
        expect({ entry: `${stage.id} ${entry.id}`, cell: map[entry.y][entry.x], steps6to12 })
          .toEqual({ entry: `${stage.id} ${entry.id}`, cell: ' ', steps6to12: true });
      });
    });
  });

  it('keeps every wave readable: known entries, marks before arrival, whole seconds', () => {
    CAMPAIGN_WAVE_SCRIPTS.forEach((script) => {
      const ids = new Set(script.entries.map((entry) => entry.id));
      const event = getCampaignEvent(script.stageId);
      const effects = script.eventEffects ?? [];
      effects.forEach((effect) => {
        // An effect for another village's event would never apply.
        expect(effect.event).toBe(event?.id);
        // It fits the HUD wave line without an ellipsis.
        expect(effect.note.length).toBeLessThanOrEqual(38);
        (effect.extra ?? []).forEach((item) => {
          expect(script.waves[item.wave]).toBeDefined();
          item.group.entries.forEach((id) => expect(ids.has(id)).toBe(true));
        });
      });
      const bonus = Math.max(0, ...effects.map((effect) => effect.telegraphBonusMs ?? 0));
      [0, 1, 2].forEach((d) => {
        const telegraph = script.telegraphMs[d] + bonus;
        expect(script.maxActive[d]).toBeGreaterThanOrEqual(2);
        expect(script.finalHoldMs[d] % 1000).toBe(0);
        script.waves.forEach((wave, index) => {
          // The marks of one wave never go up before the last one arrived.
          expect(wave.breatherMs[d]).toBeGreaterThan(telegraph);
          expect(wave.breatherMs[d] % 1000).toBe(0);
          const extra = (effects.find((effect) => effect.event === event?.id)?.extra ?? [])
            .filter((item) => item.wave === index)
            .map((item) => item.group);
          const units = [...wave.groups, ...extra].reduce((sum, group) => sum + group.count[d], 0)
            + (wave.elite && (wave.elite.on ?? [false, true, true])[d] ? 1 : 0);
          // A wave never needs more room than the cap allows.
          expect({ wave: `${script.id} ${wave.id}`, fits: units <= script.maxActive[d] })
            .toEqual({ wave: `${script.id} ${wave.id}`, fits: true });
        });
      });
      script.waves.forEach((wave) => {
        wave.groups.forEach((group) => group.entries.forEach((id) => {
          expect(ids.has(id)).toBe(true);
        }));
        wave.elite?.entries.forEach((id) => expect(ids.has(id)).toBe(true));
        // Story never has more than Normal, nor Normal more than Hard.
        wave.groups.forEach((group) => {
          expect(group.count[0]).toBeLessThanOrEqual(group.count[1]);
          expect(group.count[1]).toBeLessThanOrEqual(group.count[2]);
        });
      });
    });
  });
});
