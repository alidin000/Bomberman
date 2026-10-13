// The anime cast as this game draws it: one look per character, shared by the
// 3D figures (scene) and the story portraits (2D). Everything is drawn by the
// game from this data; no art, logos or audio are copied from the show.
// Colours are close to the anime's; each part's shape is named by a preset
// that the figure and the portrait both implement.
import type { CharacterId, StageId } from './types';
import type { EnemyArchetype } from './enemies';
import type { VillageSymbolId } from './villageSymbols';

export type SquareCastId =
  | 'kakashi' | 'sakura'
  | 'temari' | 'chiyo'
  | 'mei' | 'chojuro'
  | 'karui' | 'omoi'
  | 'onoki' | 'kurotsuchi'
  | 'yamato' | 'sai'
  | 'shikamaru' | 'tsunade'
  | 'jiraiya';

export type MiniBossCastId = 'iruka' | 'kankuro' | 'haku' | 'darui' | 'akatsuchi' | 'konan' | 'obito';

export type CastId = CharacterId | SquareCastId | MiniBossCastId | EnemyArchetype;

export type HairStyle =
  | 'spikyShort' // Naruto
  | 'spikyBack' // Sasuke
  | 'messyShort' // Gaara
  | 'spikyLongBangs' // Minato
  | 'lowPonytail' // Itachi
  | 'halfUpLongBang' // Deidara: half-up tail, long bang over the left eye
  | 'gravitySilver' // Kakashi: tilted upward spikes
  | 'shortBob' // Sakura, Kurotsuchi
  | 'fourPonytails' // Temari
  | 'bun' // Chiyo, Konan (with a paper flower)
  | 'longFlowing' // Mei: floor-length with a top knot and a bang over one eye
  | 'shortSpiky' // Chojuro, Obito, enemies
  | 'shortCrop' // Karui, Omoi, Sai, Yamato
  | 'sweptBack' // Darui
  | 'bald' // Onoki (with white tuft and beard), Akatsuchi
  | 'highPonytail' // Iruka, Shikamaru (spiky "pineapple" when spiky)
  | 'twinTails' // Tsunade: two low tails
  | 'longWild' // Jiraiya: long spiky mane
  | 'hooded' // Kankuro
  | 'longStraight' // Haku
  | 'none'; // masked or hooded enemies, Zetsu

export type OutfitStyle =
  | 'tracksuit' // Naruto: orange and black
  | 'openShirt' // Sasuke: open white shirt, purple rope belt
  | 'longCoat' // Gaara: Kazekage-era coat with a vest
  | 'flakJacket' // standard jonin/chunin vest over a dark suit
  | 'akatsukiCloak' // black high-collar cloak with red clouds
  | 'qipao' // Sakura: red top with a white circle, pink skirt
  | 'kimonoDress' // Temari, Haku
  | 'robe' // Chiyo, Onoki, Obito (war robe)
  | 'longDress' // Mei
  | 'tunic' // Chojuro, Kurotsuchi, Akatsuchi
  | 'cropTop' // Sai
  | 'haori' // Tsunade: green haori over a grey top; Minato: white haori with flames
  | 'sageVest' // Jiraiya: red vest over green
  | 'bodysuit' // Kankuro, ANBU
  | 'plant'; // White and Black Zetsu

export type Accessory =
  | 'gourd' | 'swordBack' | 'cleaver' | 'wrappedSword' | 'giantFan' | 'puppetBundle'
  | 'kunaiPouch' | 'threeProngKunai' | 'book' | 'bigScroll' | 'scrollBrush'
  | 'gloves' | 'glasses' | 'lollipop' | 'paperFlower' | 'gunbai' | 'senbon'
  | 'flameHaori' | 'scopeEye' | 'clayPouch' | 'ring' | 'chakraThreads' | 'earrings'
  | 'kageHat' | 'helmet' | 'zetsuLeaves';

export type FaceMark =
  | 'whiskers' // Naruto
  | 'loveKanji' // Gaara's forehead mark
  | 'tearTroughs' // Itachi, Gaara (dark rings)
  | 'mask' // Kakashi's face mask
  | 'eyeScar' // Kakashi
  | 'noseScar' // Iruka
  | 'kabuki' // Kankuro's purple paint
  | 'diamondSeal' // Tsunade
  | 'redLines' // Jiraiya
  | 'beard' // Onoki
  | 'porcelainMask' // ANBU (animal), Haku (hunter-nin)
  | 'spiralMask' // Obito (war mask with ripples)
  | 'halfBlack'; // Black Zetsu

export type EyeMark = 'sharingan' | 'rinnegan' | 'byakugan';

export type HeadbandWear = 'forehead' | 'slashed' | 'neck' | 'arm' | 'hairband' | 'overEye' | 'strap';

export interface CastLook {
  hair: { style: HairStyle; color: string };
  eyes: { color: string; mark?: EyeMark };
  skin: string;
  outfit: { style: OutfitStyle; primary: string; secondary: string; trim?: string };
  headband?: { symbol: VillageSymbolId; wear: HeadbandWear; cloth: string };
  face?: FaceMark[];
  accessories?: Accessory[];
  // Figure height against the default (1): Onoki is small, Akatsuchi large.
  scale?: number;
}

export interface CastMember {
  id: CastId;
  name: string;
  // The village they belong to; null for Akatsuki and Zetsu.
  village: VillageSymbolId | null;
  role: string;
  look: CastLook;
}

const SKIN = '#f2c9a0';
const SKIN_DARK = '#8a5a3c';
const SKIN_PALE = '#f6e9e2';
const LEAF_VEST = { primary: '#4f6b3a', secondary: '#23304a' };
const CLOUD_VEST = { primary: '#d9dde3', secondary: '#2d2f38' };
const AKATSUKI = {
  style: 'akatsukiCloak' as const, primary: '#141418', secondary: '#c4161c', trim: '#f8fafc'
};
const BLUE_CLOTH = '#1d3b8f';
const DARK_CLOTH = '#1f2937';

function member(
  id: CastId,
  name: string,
  village: VillageSymbolId | null,
  role: string,
  look: CastLook
): CastMember {
  return {
    id, name, village, role, look,
  };
}

export const CAST: Record<CastId, CastMember> = {
  // --- Playable -------------------------------------------------------------
  naruto: member('naruto', 'Naruto Uzumaki', 'leaf', 'Shinobi of the Leaf', {
    hair: { style: 'spikyShort', color: '#f6c915' },
    eyes: { color: '#2b7bd8' },
    skin: SKIN,
    outfit: { style: 'tracksuit', primary: '#f47b20', secondary: '#1b1b1b' },
    headband: { symbol: 'leaf', wear: 'forehead', cloth: '#1b1b1b' },
    face: ['whiskers'],
    accessories: ['kunaiPouch'],
  }),
  sasuke: member('sasuke', 'Sasuke Uchiha', 'leaf', 'Last of the Uchiha', {
    hair: { style: 'spikyBack', color: '#1a1d2e' },
    eyes: { color: '#1f1f1f', mark: 'sharingan' },
    skin: SKIN_PALE,
    outfit: {
      style: 'openShirt', primary: '#e8e8ec', secondary: '#263248', trim: '#6b3fa0'
    },
    accessories: ['swordBack'],
  }),
  gaara: member('gaara', 'Gaara', 'sand', 'Kazekage of the Sand', {
    hair: { style: 'messyShort', color: '#b3201f' },
    eyes: { color: '#8fd4a8' },
    skin: SKIN_PALE,
    outfit: {
      style: 'longCoat', primary: '#7a2b2b', secondary: '#7d7f86', trim: '#3b2412'
    },
    headband: { symbol: 'sand', wear: 'strap', cloth: '#3b2412' },
    face: ['loveKanji', 'tearTroughs'],
    accessories: ['gourd'],
  }),
  minato: member('minato', 'Minato Namikaze', 'leaf', 'The Yellow Flash', {
    hair: { style: 'spikyLongBangs', color: '#f5d76e' },
    eyes: { color: '#2f6fd6' },
    skin: SKIN,
    outfit: {
      style: 'haori', primary: '#f8fafc', secondary: '#1d2c4d', trim: '#d92d20'
    },
    headband: { symbol: 'leaf', wear: 'forehead', cloth: BLUE_CLOTH },
    accessories: ['flameHaori', 'threeProngKunai'],
  }),
  itachi: member('itachi', 'Itachi Uchiha', 'leaf', 'Akatsuki', {
    hair: { style: 'lowPonytail', color: '#121212' },
    eyes: { color: '#c4161c', mark: 'sharingan' },
    skin: SKIN_PALE,
    outfit: AKATSUKI,
    headband: { symbol: 'leaf', wear: 'slashed', cloth: DARK_CLOTH },
    face: ['tearTroughs'],
    accessories: ['ring'],
  }),
  deidara: member('deidara', 'Deidara', 'stone', 'Akatsuki', {
    hair: { style: 'halfUpLongBang', color: '#f1d26b' },
    eyes: { color: '#3b82f6' },
    skin: SKIN,
    outfit: AKATSUKI,
    headband: { symbol: 'stone', wear: 'slashed', cloth: DARK_CLOTH },
    accessories: ['scopeEye', 'clayPouch', 'ring'],
  }),

  // --- Village square people -----------------------------------------------
  kakashi: member('kakashi', 'Kakashi Hatake', 'leaf', 'Copy Ninja', {
    hair: { style: 'gravitySilver', color: '#d8dde3' },
    eyes: { color: '#2a2a2a', mark: 'sharingan' },
    skin: SKIN,
    outfit: { style: 'flakJacket', ...LEAF_VEST },
    headband: { symbol: 'leaf', wear: 'overEye', cloth: BLUE_CLOTH },
    face: ['mask', 'eyeScar'],
    accessories: ['book'],
  }),
  sakura: member('sakura', 'Sakura Haruno', 'leaf', 'Medical Ninja', {
    hair: { style: 'shortBob', color: '#f3a6c0' },
    eyes: { color: '#4caf6e' },
    skin: SKIN,
    outfit: {
      style: 'qipao', primary: '#c42d3a', secondary: '#e7a2b8', trim: '#f8fafc'
    },
    headband: { symbol: 'leaf', wear: 'hairband', cloth: '#c42d3a' },
    accessories: ['gloves'],
  }),
  temari: member('temari', 'Temari', 'sand', 'Wind Fan Kunoichi', {
    hair: { style: 'fourPonytails', color: '#e8c66b' },
    eyes: { color: '#3a8a8a' },
    skin: SKIN,
    outfit: { style: 'kimonoDress', primary: '#3b2e5a', secondary: '#b52a2a' },
    headband: { symbol: 'sand', wear: 'neck', cloth: '#1f2937' },
    accessories: ['giantFan'],
  }),
  chiyo: member('chiyo', 'Chiyo', 'sand', 'Puppet Master Elder', {
    hair: { style: 'bun', color: '#b9b9b9' },
    eyes: { color: '#6b4f3a' },
    skin: '#e7c49c',
    outfit: { style: 'robe', primary: '#6e2c2c', secondary: '#5b4a7a' },
    accessories: ['chakraThreads'],
    scale: 0.82,
  }),
  mei: member('mei', 'Mei Terumi', 'mist', 'Mizukage', {
    hair: { style: 'longFlowing', color: '#c2532f' },
    eyes: { color: '#5aa36a' },
    skin: SKIN,
    outfit: { style: 'longDress', primary: '#2b4c9a', secondary: '#1f2a44' },
  }),
  chojuro: member('chojuro', 'Chojuro', 'mist', 'Swordsman of the Mist', {
    hair: { style: 'shortSpiky', color: '#7fb3d5' },
    eyes: { color: '#2a2a2a' },
    skin: SKIN,
    outfit: { style: 'tunic', primary: '#3a5d8f', secondary: '#9aa3ad' },
    accessories: ['glasses', 'wrappedSword'],
  }),
  karui: member('karui', 'Karui', 'cloud', 'Cloud Kunoichi', {
    hair: { style: 'shortCrop', color: '#c0302a' },
    eyes: { color: '#d69a2d' },
    skin: SKIN_DARK,
    outfit: { style: 'flakJacket', ...CLOUD_VEST },
    headband: { symbol: 'cloud', wear: 'forehead', cloth: '#2d2f38' },
    accessories: ['swordBack'],
  }),
  omoi: member('omoi', 'Omoi', 'cloud', 'Cloud Swordsman', {
    hair: { style: 'shortCrop', color: '#e9ecef' },
    eyes: { color: '#2a2a2a' },
    skin: SKIN_DARK,
    outfit: { style: 'flakJacket', ...CLOUD_VEST },
    headband: { symbol: 'cloud', wear: 'forehead', cloth: '#2d2f38' },
    accessories: ['lollipop', 'swordBack'],
  }),
  onoki: member('onoki', 'Onoki', 'stone', 'Tsuchikage', {
    hair: { style: 'bald', color: '#f0f0f0' },
    eyes: { color: '#2a2a2a' },
    skin: '#e6c39e',
    outfit: { style: 'robe', primary: '#3d6b3f', secondary: '#a8322d' },
    face: ['beard'],
    accessories: ['kageHat'],
    scale: 0.72,
  }),
  kurotsuchi: member('kurotsuchi', 'Kurotsuchi', 'stone', 'Stone Kunoichi', {
    hair: { style: 'shortBob', color: '#2a2a2e' },
    eyes: { color: '#e48fb1' },
    skin: SKIN,
    outfit: { style: 'tunic', primary: '#a32b2b', secondary: '#c9a26b' },
    headband: { symbol: 'stone', wear: 'forehead', cloth: '#a32b2b' },
  }),
  yamato: member('yamato', 'Yamato', 'leaf', 'Wood Style Captain', {
    hair: { style: 'shortCrop', color: '#5b3a24' },
    eyes: { color: '#2a2a2a' },
    skin: SKIN,
    outfit: { style: 'flakJacket', ...LEAF_VEST },
    headband: { symbol: 'leaf', wear: 'forehead', cloth: BLUE_CLOTH },
    accessories: ['helmet'],
  }),
  sai: member('sai', 'Sai', 'leaf', 'Ink Artist of the Root', {
    hair: { style: 'shortCrop', color: '#1b1b1b' },
    eyes: { color: '#1b1b1b' },
    skin: '#f7ede8',
    outfit: {
      style: 'cropTop', primary: '#1d1d1d', secondary: '#3a3a3a', trim: '#c4161c'
    },
    headband: { symbol: 'leaf', wear: 'forehead', cloth: '#1b1b1b' },
    accessories: ['scrollBrush'],
  }),
  shikamaru: member('shikamaru', 'Shikamaru Nara', 'leaf', 'Alliance Strategist', {
    hair: { style: 'highPonytail', color: '#2b2b2b' },
    eyes: { color: '#2a2a2a' },
    skin: SKIN,
    outfit: { style: 'flakJacket', ...LEAF_VEST },
    headband: { symbol: 'leaf', wear: 'arm', cloth: BLUE_CLOTH },
    accessories: ['earrings'],
  }),
  tsunade: member('tsunade', 'Tsunade', 'leaf', 'Fifth Hokage', {
    hair: { style: 'twinTails', color: '#f0d06c' },
    eyes: { color: '#b07a3e' },
    skin: SKIN,
    outfit: { style: 'haori', primary: '#5c8a5a', secondary: '#8e9aa8' },
    face: ['diamondSeal'],
  }),
  jiraiya: member('jiraiya', 'Jiraiya', 'leaf', 'Toad Sage and Writer', {
    hair: { style: 'longWild', color: '#eef0f2' },
    eyes: { color: '#2a2a2a' },
    skin: SKIN,
    outfit: { style: 'sageVest', primary: '#b8322b', secondary: '#5b7a46' },
    face: ['redLines'],
    accessories: ['bigScroll'],
    scale: 1.12,
  }),

  // --- Mini bosses ------------------------------------------------------------
  iruka: member('iruka', 'Iruka Umino', 'leaf', 'Academy Instructor', {
    hair: { style: 'highPonytail', color: '#3b2a1e' },
    eyes: { color: '#2a2a2a' },
    skin: '#e3b088',
    outfit: { style: 'flakJacket', ...LEAF_VEST },
    headband: { symbol: 'leaf', wear: 'forehead', cloth: BLUE_CLOTH },
    face: ['noseScar'],
  }),
  kankuro: member('kankuro', 'Kankuro', 'sand', 'Puppet Master', {
    hair: { style: 'hooded', color: '#1d1f2a' },
    eyes: { color: '#2a2a2a' },
    skin: SKIN,
    outfit: { style: 'bodysuit', primary: '#1d1f2a', secondary: '#6b5d4f' },
    headband: { symbol: 'sand', wear: 'forehead', cloth: '#1d1f2a' },
    face: ['kabuki'],
    accessories: ['puppetBundle'],
  }),
  haku: member('haku', 'Haku', 'mist', 'Hunter of the Mist', {
    hair: { style: 'longStraight', color: '#1e1e24' },
    eyes: { color: '#3a2a2a' },
    skin: SKIN_PALE,
    outfit: { style: 'kimonoDress', primary: '#5f7f62', secondary: '#9fb3a0' },
    headband: { symbol: 'mist', wear: 'forehead', cloth: '#5f7f62' },
    face: ['porcelainMask'],
    accessories: ['senbon'],
  }),
  darui: member('darui', 'Darui', 'cloud', 'Raikage\'s Right Hand', {
    hair: { style: 'sweptBack', color: '#e7e9ee' },
    eyes: { color: '#2a2a2a' },
    skin: SKIN_DARK,
    outfit: { style: 'flakJacket', ...CLOUD_VEST },
    headband: { symbol: 'cloud', wear: 'forehead', cloth: '#2d2f38' },
    accessories: ['cleaver'],
  }),
  akatsuchi: member('akatsuchi', 'Akatsuchi', 'stone', 'Tsuchikage\'s Guard', {
    hair: { style: 'bald', color: '#2a2a2a' },
    eyes: { color: '#2a2a2a' },
    skin: '#e3b088',
    outfit: { style: 'tunic', primary: '#a32b2b', secondary: '#c9a26b' },
    accessories: ['helmet'],
    scale: 1.25,
  }),
  konan: member('konan', 'Konan', null, 'Akatsuki', {
    hair: { style: 'bun', color: '#5f78b8' },
    eyes: { color: '#d69a2d' },
    skin: SKIN_PALE,
    outfit: AKATSUKI,
    accessories: ['paperFlower', 'ring'],
  }),
  obito: member('obito', 'Obito Uchiha', null, 'Masked Man of the War', {
    hair: { style: 'shortSpiky', color: '#1f1f24' },
    eyes: { color: '#c4161c', mark: 'sharingan' },
    skin: SKIN,
    outfit: { style: 'robe', primary: '#2b2f45', secondary: '#1b1d2b' },
    face: ['spiralMask'],
    accessories: ['gunbai'],
  }),

  // --- Enemies -----------------------------------------------------------------
  rogueGenin: member('rogueGenin', 'Rogue Genin', null, 'Enemy', {
    hair: { style: 'shortSpiky', color: '#3b2a1e' },
    eyes: { color: '#2a2a2a' },
    skin: SKIN,
    outfit: { style: 'tunic', primary: '#4b5563', secondary: '#1f2937' },
    headband: { symbol: 'leaf', wear: 'slashed', cloth: '#374151' },
  }),
  anbu: member('anbu', 'ANBU', 'leaf', 'Enemy', {
    hair: { style: 'shortSpiky', color: '#4b5563' },
    eyes: { color: '#2a2a2a' },
    skin: SKIN,
    outfit: { style: 'bodysuit', primary: '#1f2937', secondary: '#d1d5db' },
    face: ['porcelainMask'],
    accessories: ['swordBack'],
  }),
  mistNinja: member('mistNinja', 'Mist Ninja', 'mist', 'Enemy', {
    hair: { style: 'shortSpiky', color: '#374151' },
    eyes: { color: '#2a2a2a' },
    skin: SKIN,
    outfit: { style: 'flakJacket', primary: '#5b6b7a', secondary: '#2b3440' },
    headband: { symbol: 'mist', wear: 'forehead', cloth: '#2b3440' },
  }),
  sandNinja: member('sandNinja', 'Sand Ninja', 'sand', 'Enemy', {
    hair: { style: 'shortSpiky', color: '#6b4f3a' },
    eyes: { color: '#2a2a2a' },
    skin: '#e3b088',
    outfit: { style: 'flakJacket', primary: '#c9a26b', secondary: '#6b5d4f' },
    headband: { symbol: 'sand', wear: 'forehead', cloth: '#6b5d4f' },
  }),
  cloudNinja: member('cloudNinja', 'Cloud Ninja', 'cloud', 'Enemy', {
    hair: { style: 'shortSpiky', color: '#e5e7eb' },
    eyes: { color: '#2a2a2a' },
    skin: SKIN_DARK,
    outfit: { style: 'flakJacket', ...CLOUD_VEST },
    headband: { symbol: 'cloud', wear: 'forehead', cloth: '#2d2f38' },
  }),
  whiteZetsu: member('whiteZetsu', 'White Zetsu', null, 'Enemy', {
    hair: { style: 'none', color: '#4d7c3a' },
    eyes: { color: '#e5c84a' },
    skin: '#f4f4f0',
    outfit: { style: 'plant', primary: '#f4f4f0', secondary: '#4d7c3a' },
    accessories: ['zetsuLeaves'],
  }),
  blackZetsu: member('blackZetsu', 'Black Zetsu', null, 'Enemy', {
    hair: { style: 'none', color: '#4d7c3a' },
    eyes: { color: '#e5c84a' },
    skin: '#111111',
    outfit: { style: 'plant', primary: '#111111', secondary: '#4d7c3a' },
    face: ['halfBlack'],
    accessories: ['zetsuLeaves'],
  }),
};

/** The two people standing in each village's square, then the wanderer. */
export const SQUARE_CAST: Record<StageId, readonly [SquareCastId, SquareCastId]> = {
  hiddenLeaf: ['kakashi', 'sakura'],
  hiddenSand: ['temari', 'chiyo'],
  hiddenMist: ['mei', 'chojuro'],
  hiddenCloud: ['karui', 'omoi'],
  hiddenStone: ['onoki', 'kurotsuchi'],
  akatsukiHideout: ['yamato', 'sai'],
  greatShinobiWar: ['shikamaru', 'tsunade'],
};

export const WANDERER_CAST: SquareCastId = 'jiraiya';

export function isCastId(id: string | undefined): id is CastId {
  return id !== undefined && Object.prototype.hasOwnProperty.call(CAST, id);
}
