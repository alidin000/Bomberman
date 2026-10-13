// The people of each village hub and their short, branching talk. Names and
// words are original to this game; the hints point at the real hidden areas
// in campaignMissions.ts (scroll cache in the north-west by the entrance, the
// archive fragment north of the centre, the burrow in the south-east).
import { StageId } from './types';
import { CAMPAIGN_VILLAGES, getNextCampaignStageId } from './campaign';
import type { ReputationTierId } from './villageSquare';
import { WANDERING_VILLAGER } from './villageSquare';

export interface HubDialogueChoice {
  id: string;
  prompt: string;
  reply: string;
}

export interface HubNpc {
  id: string;
  name: string;
  role: string;
  greeting: string;
  // Said once the village's mission has been cleared.
  clearedGreeting: string;
  choices: HubDialogueChoice[];
}

export interface HubVillageDefinition {
  stageId: StageId;
  blurb: string;
  // The travelling merchant's word in this village, above the shop.
  merchantLine: string;
  npcs: HubNpc[];
}

export const HUB_MERCHANT = {
  name: 'Pell',
  role: 'Merchant of the Painted Cart',
} as const;

export const HUB_VILLAGES: HubVillageDefinition[] = [
  {
    stageId: 'hiddenLeaf',
    blurb: 'Lantern smoke drifts between the training logs. The gate is open, and the forest is not quiet.',
    merchantLine: 'First time in the village? Start small. A ward costs less than a bad morning.',
    npcs: [
      {
        id: 'wren',
        name: 'Wren',
        role: 'Gatewarden',
        greeting: 'Keep your fuse short and your eyes up. The woods past the gate are crawling tonight.',
        clearedGreeting: 'The gate held because of you. I have started sleeping again.',
        choices: [
          {
            id: 'hidden',
            prompt: 'Anything hidden nearby?',
            reply: 'Old supply scrolls were bricked up by the north wall, a few steps from where you come in. Crack the crates there first.',
          },
          {
            id: 'threat',
            prompt: 'Who is out there?',
            reply: 'Students who never finished their training, and worse. They hunt in pairs. Do not let them flank you.',
          },
        ],
      },
      {
        id: 'hobb',
        name: 'Old Hobb',
        role: 'Tea Seller',
        greeting: 'Tea is free for anyone who brings the villagers home. Two of them are still out there.',
        clearedGreeting: 'Everyone is home. The kettle is on, and the second cup is yours.',
        choices: [
          {
            id: 'defend',
            prompt: 'How do I hold the building?',
            reply: 'Stay close and keep the attackers off its walls. You only have to outlast them for twenty breaths.',
          },
          {
            id: 'boss',
            prompt: 'Any advice for the big one?',
            reply: 'Do not trade blows. Bomb, step aside, bomb again. Patience is cheaper than bandages.',
          },
        ],
      },
    ],
  },
  {
    stageId: 'hiddenSand',
    blurb: 'Wind scours the sandstone. Every well has a guard, and every guard looks tired.',
    merchantLine: 'Sand gets into everything. Except the prices. Those stay put.',
    npcs: [
      {
        id: 'saffi',
        name: 'Saffi',
        role: 'Well Digger',
        greeting: 'Mind the drifts. The storm moves the dunes, and the dunes move the enemy.',
        clearedGreeting: 'The wells are clear and the sand has settled. Even the scorpions went home.',
        choices: [
          {
            id: 'hidden',
            prompt: 'Seen anything strange?',
            reply: 'When I dig just north of the village centre I hit hollow stone. Someone sealed a room down there long ago.',
          },
          {
            id: 'storm',
            prompt: 'How do I fight in a sandstorm?',
            reply: 'You will not see far. Keep a wall at your back and let them come to you.',
          },
        ],
      },
      {
        id: 'doru',
        name: 'Doru',
        role: 'Caravan Scout',
        greeting: 'Puppets on the ridge again. Whoever pulls their strings never shows a face.',
        clearedGreeting: 'The ridge is empty. The first caravan in weeks leaves at dawn.',
        choices: [
          {
            id: 'source',
            prompt: 'Where are they coming from?',
            reply: 'Three burrows feed the attack: one by the gate, one in the outer streets, one by the old arena.',
          },
          {
            id: 'reward',
            prompt: 'What does the village offer?',
            reply: 'The village pays its debts. Clear the arena and someone you know may join you.',
          },
        ],
      },
    ],
  },
  {
    stageId: 'hiddenMist',
    blurb: 'Fog sits on the water like wet paper. Bridges creak somewhere you cannot see.',
    merchantLine: 'Damp crates, dry powder. I check every pouch twice.',
    npcs: [
      {
        id: 'ondine',
        name: 'Ondine',
        role: 'Ferry Pilot',
        greeting: 'Fog this thick, you hear them before you see them. Listen for the splash.',
        clearedGreeting: 'The fog is lifting. I can see the far shore for the first time this season.',
        choices: [
          {
            id: 'bearings',
            prompt: 'How do I find my way?',
            reply: 'Count the bridges. The gate in the middle marks the centre of the village. Everything else is a guess.',
          },
          {
            id: 'hunter',
            prompt: 'Who guards the inner gate?',
            reply: 'Someone quiet and fast who never wastes a step. Do not chase. Make them come through your blast.',
          },
        ],
      },
      {
        id: 'kell',
        name: 'Kell',
        role: 'Net Mender',
        greeting: 'My nets keep catching strange things. Last week, half a scroll case.',
        clearedGreeting: 'The nets are full of fish again. Real fish.',
        choices: [
          {
            id: 'hidden',
            prompt: 'Where did the scroll case come from?',
            reply: 'The south-east docks. There is a wall there that sounds wrong when you knock. Be ready when it opens.',
          },
          {
            id: 'help',
            prompt: 'Can I help?',
            reply: 'You are helping. Every clone you pop is one less thing tangled in my nets.',
          },
        ],
      },
    ],
  },
  {
    stageId: 'hiddenCloud',
    blurb: 'Thunder rolls off the cliffs. The towers hum, and your hair stands up as you pass them.',
    merchantLine: 'Storm season means storm prices. Joking. Mostly.',
    npcs: [
      {
        id: 'brisa',
        name: 'Brisa',
        role: 'Bell Ringer',
        greeting: 'When the bell rings twice, lightning is coming. Get off the open stone.',
        clearedGreeting: 'I rang the bell once today. Just for joy.',
        choices: [
          {
            id: 'lightning',
            prompt: 'How do I read the lightning?',
            reply: 'The ground marks the strike before it lands. If the floor is marked under you, step off now.',
          },
          {
            id: 'hidden',
            prompt: 'What is in the towers?',
            reply: 'Old wire and older secrets. A courier hid a satchel by the north-west wall when the storm caught him.',
          },
        ],
      },
      {
        id: 'tobin',
        name: 'Tobin',
        role: 'Kite Maker',
        greeting: 'My kites keep getting struck down. That never used to happen.',
        clearedGreeting: 'I flew one all afternoon. Not a single spark.',
        choices: [
          {
            id: 'storm',
            prompt: 'Why is the storm so angry?',
            reply: 'Something big is stirring under the clouds. The storm is only its breath.',
          },
          {
            id: 'guard',
            prompt: 'Any tips for the gate guard?',
            reply: 'He hits hard and boasts harder. Keep moving and let him tire himself out.',
          },
        ],
      },
    ],
  },
  {
    stageId: 'hiddenStone',
    blurb: 'Boulders lean over every path. Lamplight winks from cave mouths high on the slopes.',
    merchantLine: 'Rock is cheap up here. Fuses are not. Choose well.',
    npcs: [
      {
        id: 'marl',
        name: 'Marl',
        role: 'Quarry Foreman',
        greeting: 'We hit a seam of something that is not stone. Then the golems woke up.',
        clearedGreeting: 'Back to honest digging. Loud, dusty, honest digging.',
        choices: [
          {
            id: 'hidden',
            prompt: 'What did you find?',
            reply: 'Carved tablets, just north of the middle of the quarry. Writing nobody here can read.',
          },
          {
            id: 'rockslide',
            prompt: 'How do I survive a rockslide?',
            reply: 'You do not stop it. You let it pass. Rocks fall where the ground is marked first.',
          },
        ],
      },
      {
        id: 'ysolde',
        name: 'Ysolde',
        role: 'Lamp Miner',
        greeting: 'Lamps are cheap. Eyes are not. Bring light if you go down the shafts.',
        clearedGreeting: 'The shafts are quiet. I can hear my own lamp hiss again.',
        choices: [
          {
            id: 'lantern',
            prompt: 'Do I need a lantern?',
            reply: 'A bigger flame shows you more of the dark. The merchant sells oil, if you have the Embers.',
          },
          {
            id: 'depths',
            prompt: 'What lives down there?',
            reply: 'Spiders the size of carts, and whatever scares the spiders.',
          },
        ],
      },
    ],
  },
  {
    stageId: 'akatsukiHideout',
    blurb: 'Red lanterns burn without heat. The halls smell of ink and old ash.',
    merchantLine: 'I never ask where my customers come from. Here, I really never ask.',
    npcs: [
      {
        id: 'ash',
        name: 'Ash',
        role: 'Escaped Scribe',
        greeting: 'They made me copy their plans for a year. I remember every page.',
        clearedGreeting: 'I burned my copies. The originals went down with the hideout.',
        choices: [
          {
            id: 'plans',
            prompt: 'What were the plans?',
            reply: 'Seals, mostly. Long chains of them, meant to hold something that should never be held.',
          },
          {
            id: 'hidden',
            prompt: 'Where is their archive?',
            reply: 'Follow the pillars inward. The vault sits just north of the centre floor.',
          },
        ],
      },
      {
        id: 'quill',
        name: 'Quill',
        role: 'Lookout',
        greeting: 'Crows at the east window again. Someone is watching us back.',
        clearedGreeting: 'The crows left. Strange how much quieter a sky can be.',
        choices: [
          {
            id: 'cult',
            prompt: 'How do I get past the cultists?',
            reply: 'They guard the rituals, not the halls. Go around, and they will come to you one at a time.',
          },
          {
            id: 'stay',
            prompt: 'Why do you stay?',
            reply: 'Someone has to keep watch until it is really over. It might as well be me.',
          },
        ],
      },
    ],
  },
  {
    stageId: 'greatShinobiWar',
    blurb: 'Banners lie torn across the field. Every village fights here, side by side, for once.',
    merchantLine: 'Last stop on the road. Everything I have left, at fair prices.',
    npcs: [
      {
        id: 'vey',
        name: 'Vey',
        role: 'Field Medic',
        greeting: 'I patch them up and send them back. Try not to be one of them.',
        clearedGreeting: 'The tents are emptying. The good kind of empty.',
        choices: [
          {
            id: 'supplies',
            prompt: 'Any supplies to spare?',
            reply: 'A Second Wind Knot from the merchant has saved more of my patients than I have. Pack one if you can.',
          },
          {
            id: 'front',
            prompt: 'What is happening at the front?',
            reply: 'Masked clones in waves. They do not stop and they do not flinch.',
          },
        ],
      },
      {
        id: 'nim',
        name: 'Nim',
        role: 'Banner Runner',
        greeting: 'I carry messages between the camps. Today they all say the same thing: hold.',
        clearedGreeting: 'Last message of the war: go home. The best one I ever carried.',
        choices: [
          {
            id: 'orders',
            prompt: 'What are the orders?',
            reply: 'Hold the line until the gate opens. Then everyone pushes for the centre at once.',
          },
          {
            id: 'fear',
            prompt: 'Are you scared?',
            reply: 'Every day. Running helps. So does knowing someone like you is out there.',
          },
        ],
      },
    ],
  },
];

export function getHubVillage(stageId: StageId): HubVillageDefinition {
  return HUB_VILLAGES.find((village) => village.stageId === stageId) ?? HUB_VILLAGES[0];
}

// What each villager says once the story has moved past their village: the
// next village's mission is cleared too. The last village has no next one.
export const ONWARD_GREETINGS: Readonly<Record<string, string>> = {
  wren: 'They say the sand village wells run clear again. Word travels fast through an open gate.',
  hobb: 'A traveller paid for her tea with sand village coin. You have been busy.',
  saffi: 'The ferry folk sent a lamp across the desert to thank you. It is on my well now.',
  doru: 'The mist road is open. My caravan goes further every week because of you.',
  ondine: 'A kite from the cloud cliffs landed on my deck. A thank-you, I think.',
  kell: 'Fishermen from the cliffs came down to trade. That has not happened in years.',
  brisa: 'Quarry dust on the wind, but no rockslides. The stone village sleeps easy.',
  tobin: 'Ysolde sent me lamp wire for my kites. Best frames I ever built.',
  marl: 'The red lanterns in the hideout are out. We heard the quiet from here.',
  ysolde: 'My shafts point east, toward the hideout. They feel lighter now.',
  ash: 'The war camp sent runners for my maps. The old ink is finally useful.',
  quill: 'The crows flew west to the battlefield. Then even they stopped watching.',
};

/**
 * What a villager opens with: the onward line once the next village is
 * cleared, the cleared line once this one is, else the first greeting.
 */
export function villagerGreeting(
  npc: HubNpc,
  stageId: StageId,
  completedStages: readonly StageId[]
): string {
  const next = getNextCampaignStageId(stageId);
  const onward = ONWARD_GREETINGS[npc.id];
  if (onward && next && completedStages.includes(next)) return onward;
  return completedStages.includes(stageId) ? npc.clearedGreeting : npc.greeting;
}

// Tamsin the Road Teller (WANDERING_VILLAGER) walks between the villages
// and joins every square once your standing reaches Known. Her news follows
// the story, and she is the one who explains standing and the codex.
export const ROAD_TELLER: HubNpc = {
  id: WANDERING_VILLAGER.id,
  name: WANDERING_VILLAGER.name,
  role: WANDERING_VILLAGER.role,
  greeting: 'Every road I walk, people say your name now. Sit a moment. I trade in news.',
  clearedGreeting: 'Another village sleeping soundly. I will have a good story for the next square.',
  choices: [
    {
      id: 'standing',
      prompt: 'What is standing?',
      reply: 'Every village you help adds to how far your name carries. The more it carries, the more each square opens up to you.',
    },
    {
      id: 'codex',
      prompt: 'What is the shrine for?',
      reply: 'The shrine keeps the Codex: lore you uncover by finding a village\'s secrets. Crack a hidden wall, and its story is written there.',
    },
  ],
};

// Tamsin's road news, by how many villages are cleared (0 to 7).
export const ROAD_NEWS: readonly string[] = [
  'Nothing yet but rumours. The leaf village gate is where every road starts.',
  'The leaf village is safe, and the desert road is open. The wells out there need you next.',
  'Two villages cleared. The fog on the water is thickest just past the dunes.',
  'Three down. The cliff bells have not rung for joy in a long time.',
  'Four villages. The quarry folk say the mountain itself is angry.',
  'Five. Everyone whispers about the hideout now, and nobody whispers loudly.',
  'Six. Every village is marching to the same field. So should you.',
  'All seven are safe. I will be telling this road for the rest of my life.',
];

export function roadNews(completedStages: readonly StageId[]): string {
  const cleared = CAMPAIGN_VILLAGES
    .filter((village) => completedStages.includes(village.stageId)).length;
  return ROAD_NEWS[Math.min(cleared, ROAD_NEWS.length - 1)];
}

/** The person a square's villager prop is: one of the village's two, or Tamsin. */
export function getSquareVillager(stageId: StageId, villagerId: string | undefined): HubNpc | null {
  if (villagerId === ROAD_TELLER.id) return ROAD_TELLER;
  return getHubVillage(stageId).npcs.find((npc) => npc.id === villagerId) ?? null;
}

// What each standing tier brings to every village square.
export const STANDING_TIER_PERKS: Readonly<Record<ReputationTierId, string>> = {
  stranger: 'Two villagers, the first request on the board, and Pell\'s stall at full price.',
  known: `${WANDERING_VILLAGER.name} the ${WANDERING_VILLAGER.role} joins every square, and the board offers a second request.`,
  trusted: 'Pell takes a fifth off the stall, and the board offers its hardest request.',
  honored: 'Your shinobi wears an ember-thread scarf in every mission.',
};

// One line on what the Codex is, for the hub and the square's shrine.
export const CODEX_EXPLAINER = 'The Codex is lore you uncover by finding a village\'s secrets.';
