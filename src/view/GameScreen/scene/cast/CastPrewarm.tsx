import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { isCastId } from '../../../../content/animeCast';
import { ENEMY_ARCHETYPE_DEFINITIONS, EnemyArchetype } from '../../../../content/enemies';
import type { StageId } from '../../../../content/types';
import type { VillageSquareLayout } from '../../../../content/villageSquare';
import { GUARD_CAST } from '../guardLooks';
import { castAtlasTexture } from './castAtlas';
import { ENEMY_CAST_SCALE, castFigureMesh, enemyFigureMesh } from './castGeometry';

/**
 * Builds the figures a campaign mission can show mid-match (every enemy
 * kind, the stage's gate guard, the square's cast) during the countdown, one
 * look per frame, so a kind first seen as the fog lifts never builds its
 * geometry in a frame of play, and no single frame does them all. Also
 * uploads the cast atlas now, before the first figure needs it.
 */
function CastPrewarmBase({
  stageId,
  square,
}: {
  stageId: StageId | undefined;
  square: VillageSquareLayout | null;
}) {
  const gl = useThree((state) => state.gl);
  const jobs = useMemo(() => {
    const list: (() => unknown)[] = [];
    if (!stageId) return list;
    (Object.keys(ENEMY_ARCHETYPE_DEFINITIONS) as EnemyArchetype[]).forEach((archetype) => {
      list.push(() => enemyFigureMesh(archetype));
    });
    list.push(() => castFigureMesh(GUARD_CAST[stageId], ENEMY_CAST_SCALE));
    square?.interactables.forEach((item) => {
      if (item.kind === 'villager' && isCastId(item.villagerId)) {
        const id = item.villagerId;
        list.push(() => castFigureMesh(id));
      }
    });
    return list;
  }, [square, stageId]);
  const next = useRef(0);
  useEffect(() => { next.current = 0; }, [jobs]);

  useEffect(() => {
    try {
      gl.initTexture(castAtlasTexture());
    } catch {
      // No WebGL texture upload (tests): the first draw uploads it.
    }
  }, [gl]);

  useFrame(() => {
    if (next.current >= jobs.length) return;
    jobs[next.current]();
    next.current += 1;
  });
  return null;
}

export const CastPrewarm = React.memo(CastPrewarmBase);
