import { BossId } from '../../../../content/types';
import { BeastRecipe } from './beastKit';
import { SHUKAKU } from './shukaku';
import { MATATABI } from './matatabi';
import { ISOBU } from './isobu';
import { SON_GOKU } from './sonGoku';
import { KOKUO } from './kokuo';
import { SAIKEN } from './saiken';
import { CHOMEI } from './chomei';
import { GYUKI } from './gyuki';
import { KURAMA } from './kurama';

export type {
  BeastLook, BeastParts, BeastRecipe, BeastTailLayout, BeastTone,
} from './beastKit';

/** Every tailed beast the campaign can field, One-Tail to Nine-Tails. */
export const BEASTS: Record<BossId, BeastRecipe> = {
  shukaku: SHUKAKU,
  matatabi: MATATABI,
  isobu: ISOBU,
  sonGoku: SON_GOKU,
  kokuo: KOKUO,
  saiken: SAIKEN,
  chomei: CHOMEI,
  gyuki: GYUKI,
  kurama: KURAMA,
};
