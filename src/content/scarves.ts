// The scarves a shinobi can wear (VillageVisitConfig.scarf): the ember-thread
// scarf from Honored standing, and one per village for claiming its three
// secrets. Names and colours for the hub's picker and the 3D scarf.
import type { ScarfId } from './villageSquare';

export interface ScarfLook {
  name: string;
  // The cloth, then the stripe woven through it.
  colors: readonly [string, string];
}

export const SCARF_LOOKS: Record<ScarfId, ScarfLook> = {
  ember: { name: 'Ember-thread scarf', colors: ['#d9481e', '#f6b24a'] },
  hiddenLeaf: { name: 'Leaf scarf', colors: ['#2f6b3a', '#ff8a00'] },
  hiddenSand: { name: 'Sand scarf', colors: ['#c98a3d', '#7a2b2b'] },
  hiddenMist: { name: 'Mist scarf', colors: ['#3f7fae', '#d7e3ea'] },
  hiddenCloud: { name: 'Cloud scarf', colors: ['#e9ecef', '#d4a33f'] },
  hiddenStone: { name: 'Stone scarf', colors: ['#8c5a3c', '#c9a26b'] },
  akatsukiHideout: { name: 'Red-cloud scarf', colors: ['#141418', '#c4161c'] },
  greatShinobiWar: { name: 'Alliance scarf', colors: ['#1f2937', '#e5e7eb'] },
};
