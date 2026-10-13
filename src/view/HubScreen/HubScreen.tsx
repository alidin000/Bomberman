import React, {
  useEffect, useLayoutEffect, useMemo, useRef, useState,
} from 'react';
import {
  Button,
  DialogContent,
  DialogTitle,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  CAMPAIGN_VILLAGES,
  STAGE_DEFINITIONS,
  StageId,
  getBossDefinition,
  getCampaignMission,
  getCampaignVillage,
  getCharacterDefinition,
  getStageDefinition,
} from '../../content';
import {
  HUB_CONSUMABLES,
  HUB_UPGRADES,
  HubConsumableId,
  HubUpgradeId,
  clampUpgradeRank,
  formatEmbers,
  getHubConsumable,
  getHubUpgrade,
  getPackSlots,
  getUpgradeCap,
} from '../../content/hubShop';
import {
  HUB_MERCHANT,
  HubNpc,
  ROAD_TELLER,
  SECRETS_EXPLAINER,
  getHubVillage,
  roadNews,
  villagerGreeting,
} from '../../content/hubVillages';
import { WANDERING_VILLAGER, type ScarfId } from '../../content/villageSquare';
import { isCastId } from '../../content/animeCast';
import { SCARF_LOOKS } from '../../content/scarves';
import { SECRET_SET_REWARD, getVillageSecrets } from '../../content/villageSecrets';
import {
  StoryScenePart, getStoryScene, storySceneId,
} from '../../content/storyScenes';
import { tierAtLeast } from '../../story/reputation';
import { getVillageStanding } from '../../story/villageVisit';
import { chooseScarf, claimSecretSet, markSceneSeen } from '../../story/villageRewards';
import { StoryProgress, getStoryUpgrade, loadStoryProgress } from '../../story/progress';
import {
  PurchaseBlock,
  buyHubConsumable,
  buyHubUpgrade,
  getConsumableBlock,
  getNextUpgradePrice,
  getUpgradeBlock,
  unpackHubConsumable,
} from '../../story/hubEconomy';
import { DIFFICULTIES } from '../../engine/difficulty';
import { WelcomeContainer } from '../WelcomeScreen/WelcomeScreen.styles';
import {
  DeckFooter,
  FooterActions,
  FooterHint,
  StagePreviewImage,
  StyledDialog,
} from '../ConfigScreen/ConfigScreen.styles';
import { RovingTabStops, keepRovingStopOnFocus, moveFocusWithArrows } from '../ConfigScreen/menuNavigation';
import { MAIN_MENU_LABEL } from '../ConfigScreen/menuCopy';
import { launchGame, loadStoredKeyBindings } from '../ConfigScreen/launchGame';
import { loadCampaignDifficulty } from '../ConfigScreen/campaignDifficulty';
import StageAtlas from '../../assets/ninja-bomber-stage-atlas.webp';
import GreatWarStage from '../../assets/great-shinobi-war-stage.webp';
import {
  AskedLine,
  ChoiceList,
  Conversation,
  EmberBalance,
  EmberGlyph,
  HubAnnouncer,
  HubBlurb,
  HubBody,
  HubHeader,
  HubReport,
  HubStatusLine,
  ItemText,
  MerchantLine,
  MissionGoals,
  NpcButton,
  NpcGrid,
  RankPip,
  RankPips,
  ShopHeading,
  ShopList,
  ShopRow,
  SpokenLine,
  Speaker,
  VillageArt,
  VillageIntro,
} from './HubScreen.styles';
import { CardBody, TalkHead } from './HubSecrets.styles';
import { CastPortrait } from '../portraits/CastPortrait';
import { SecretsPanel } from './SecretsPanel';
import { RebuildCard, ScarfPicker, StoryReplay } from './VillageCards';
import { StoryScene } from './StoryScene';
import { earningsBreakdown } from './MissionEarnings';
import { BoardPreview, StandingCard } from './StandingCard';
import { hubPath } from './missionSettlement';

type HubSection = 'village' | 'shop' | 'secrets';

const SECTIONS: { id: HubSection; label: string }[] = [
  { id: 'village', label: 'Village' },
  { id: 'shop', label: 'Shop' },
  { id: 'secrets', label: 'Secrets' },
];

// How many secrets the save has found, of every village's.
function secretsFound(progress: StoryProgress): { found: number; total: number } {
  const secrets = CAMPAIGN_VILLAGES.flatMap((village) => getVillageSecrets(village.stageId));
  return {
    found: secrets.filter((secret) => progress.discoveredSecrets.includes(secret.id)).length,
    total: secrets.length,
  };
}

// Short of Embers is said in the announcement; that button keeps its price.
const BLOCK_LABELS: Record<PurchaseBlock, string> = {
  funds: 'Not enough Embers',
  packFull: 'Pack full',
  packed: 'Packed',
  maxed: 'Max rank',
};

function blockDetail(block: PurchaseBlock, shortfall: number): string {
  if (block === 'funds') return `Need ${formatEmbers(shortfall)} more.`;
  if (block === 'packFull') return 'The pack is full: unpack an item to swap it.';
  if (block === 'packed') return 'Packed for the next mission.';
  return 'Fully trained.';
}

// Where each village sits on the stage atlas (as on the Mission Deck).
const VILLAGE_ART: Record<StageId, string> = {
  hiddenLeaf: '0% 0%',
  hiddenSand: '50% 0%',
  hiddenMist: '100% 0%',
  hiddenCloud: '0% 100%',
  hiddenStone: '50% 100%',
  akatsukiHideout: '100% 100%',
  greatShinobiWar: 'center',
};

// A route to a village that is not open yet goes to the current one.
function resolveHubStage(requested: string | undefined, progress: StoryProgress): StageId {
  const stage = STAGE_DEFINITIONS.find((item) => item.id === requested);
  if (stage && progress.unlockedStages.includes(stage.id)) return stage.id;
  if (progress.unlockedStages.includes(progress.lastStage)) return progress.lastStage;
  return progress.unlockedStages[0] ?? 'hiddenLeaf';
}

type Talk = { npcId: string; choiceId: string | null };

// A scene on screen: what plays, and whether the mission deploys after it.
type SceneShowing = { stageId: StageId; part: StoryScenePart; deploy: boolean; replay: boolean };

/**
 * The scene a hub arrival plays: right after a won mission, that village's
 * after-victory scene, the first time (the hub can replay it later).
 */
function arrivalScene(progress: StoryProgress): SceneShowing | null {
  const report = progress.lastMission;
  if (!report?.success || !progress.completedStages.includes(report.stageId)) return null;
  if (progress.seenScenes.includes(storySceneId(report.stageId, 'after'))) return null;
  return {
    stageId: report.stageId, part: 'after', deploy: false, replay: false,
  };
}

export const HubScreen = () => {
  const params = useParams();
  const navigate = useNavigate();
  const [progress, setProgress] = useState<StoryProgress>(loadStoryProgress);
  const stageId = resolveHubStage(params.stageId, progress);
  const village = getCampaignVillage(stageId);
  const hub = getHubVillage(stageId);
  const stage = getStageDefinition(stageId);
  const { accent } = stage.palette;
  const [section, setSection] = useState<HubSection>('village');
  const [talk, setTalk] = useState<Talk | null>(null);
  const [secretsStage, setSecretsStage] = useState<StageId>(stageId);
  const [scene, setScene] = useState<SceneShowing | null>(() => arrivalScene(progress));
  const [announcement, setAnnouncement] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);
  const speakerRef = useRef<HTMLHeadingElement>(null);
  const lastNpcRef = useRef<string | null>(null);
  const deploying = useRef(false);
  const deployRef = useRef<HTMLButtonElement>(null);

  // Each village's hub opens on its people, not on the last one's talk.
  useEffect(() => {
    setTalk(null);
    setSecretsStage(stageId);
  }, [stageId]);

  const cleared = progress.completedStages.includes(stageId);
  // From Known, Tamsin the Road Teller travels with you: in every square,
  // and here, with the news of the road so far.
  const people = useMemo<HubNpc[]>(() => (
    tierAtLeast(getVillageStanding(progress).tier.id, WANDERING_VILLAGER.minTier)
      ? [...hub.npcs, {
        ...ROAD_TELLER,
        choices: [
          { id: 'road', prompt: 'Any news from the road?', reply: roadNews(progress.completedStages) },
          ...ROAD_TELLER.choices,
        ],
      }]
      : hub.npcs
  ), [hub, progress]);
  const npc = talk ? people.find((item) => item.id === talk.npcId) ?? null : null;
  const choice = npc && talk?.choiceId
    ? npc.choices.find((item) => item.id === talk.choiceId) ?? null
    : null;

  // A new line of talk moves focus to the speaker, so it is read out and the
  // replies are the next stops; ending the talk returns focus to that person.
  useLayoutEffect(() => {
    if (talk) {
      speakerRef.current?.focus();
      return;
    }
    const last = lastNpcRef.current;
    if (last) {
      contentRef.current?.querySelector<HTMLElement>(`[data-npc="${last}"]`)?.focus();
      lastNpcRef.current = null;
    }
  }, [talk]);

  const packSlots = getPackSlots(progress.upgradeRanks);
  const difficulty = DIFFICULTIES[loadCampaignDifficulty()];
  const character = getCharacterDefinition(progress.lastCharacter);
  const storyUpgrade = getStoryUpgrade(progress.selectedUpgrade);
  const packNames = progress.pack.map((id) => getHubConsumable(id).name);
  const secrets = useMemo(() => secretsFound(progress), [progress]);

  const launch = async () => {
    // One deploy per visit: a double press must not spend the pack twice.
    if (deploying.current) return;
    deploying.current = true;
    await launchGame({
      mode: 'solo',
      stageId,
      characters: [progress.lastCharacter],
      upgrade: progress.selectedUpgrade,
      players: '1',
      keyBindings: loadStoredKeyBindings(),
      storyProgress: loadStoryProgress(),
    }, navigate);
  };

  // The first deploy to a village plays its before-the-mission scene first.
  const deploy = () => {
    if (deploying.current || scene) return;
    if (!progress.seenScenes.includes(storySceneId(stageId, 'before'))) {
      setScene({
        stageId, part: 'before', deploy: true, replay: false,
      });
      return;
    }
    launch();
  };

  const endScene = () => {
    if (!scene) return;
    const showing = scene;
    setScene(null);
    // Seen once it is finished or skipped; a replay changes nothing.
    if (!showing.replay) setProgress(markSceneSeen(storySceneId(showing.stageId, showing.part)));
    if (showing.deploy) launch();
    // Back in the hub, a returning player still deploys with one press.
    else if (!showing.replay) window.setTimeout(() => deployRef.current?.focus(), 0);
  };

  const claim = (claimStageId: StageId) => {
    const result = claimSecretSet(claimStageId);
    setProgress(result.progress);
    if (result.ok) {
      setAnnouncement(`Claimed ${formatEmbers(SECRET_SET_REWARD.embers)} and the ${SCARF_LOOKS[claimStageId].name}. ${formatEmbers(result.progress.currency)} to spend.`);
    }
  };

  const wear = (scarf: ScarfId | null) => {
    setProgress(chooseScarf(scarf));
    setAnnouncement(scarf ? `Wearing the ${SCARF_LOOKS[scarf].name}.` : 'No scarf.');
  };

  const endTalk = () => {
    if (talk) lastNpcRef.current = talk.npcId;
    setTalk(null);
  };

  const handleClose = (_event: object, reason: 'backdropClick' | 'escapeKeyDown') => {
    if (reason === 'backdropClick' || scene) return;
    if (talk) endTalk();
    else navigate('/config');
  };

  const buyConsumable = (id: HubConsumableId) => {
    const block = getConsumableBlock(progress, id);
    const item = getHubConsumable(id);
    if (block) {
      setAnnouncement(`${item.name}: ${blockDetail(block, item.price - progress.currency)}`);
      return;
    }
    const result = buyHubConsumable(id);
    setProgress(result.progress);
    setAnnouncement(result.ok
      ? `Packed ${item.name}. ${formatEmbers(result.progress.currency)} left.`
      : `${item.name}: ${BLOCK_LABELS[result.blocked ?? 'funds']}.`);
  };

  const unpack = (id: HubConsumableId) => {
    const result = unpackHubConsumable(id);
    setProgress(result.progress);
    if (result.ok) {
      const item = getHubConsumable(id);
      setAnnouncement(`Unpacked ${item.name}. ${formatEmbers(result.progress.currency)} left.`);
    }
  };

  const buyUpgrade = (id: HubUpgradeId) => {
    const block = getUpgradeBlock(progress, id);
    const item = getHubUpgrade(id);
    const price = getNextUpgradePrice(progress, id) ?? 0;
    if (block) {
      setAnnouncement(`${item.name}: ${blockDetail(block, price - progress.currency)}`);
      return;
    }
    const result = buyHubUpgrade(id);
    setProgress(result.progress);
    const rank = clampUpgradeRank(id, result.progress.upgradeRanks[id]);
    setAnnouncement(result.ok
      ? `${item.name} rank ${rank}. ${formatEmbers(result.progress.currency)} left.`
      : `${item.name}: ${BLOCK_LABELS[result.blocked ?? 'funds']}.`);
  };

  if (params.stageId !== stageId) {
    return <Navigate to={hubPath(stageId)} replace />;
  }

  const { lastMission: report } = progress;
  const reportVillage = report ? getCampaignVillage(report.stageId).villageName : '';

  const greetingOf = (person: HubNpc) => (person.id === ROAD_TELLER.id
    ? person.greeting
    : villagerGreeting(person, stageId, progress.completedStages));

  const renderNpc = (person: HubNpc) => (
    <NpcButton
      key={person.id}
      type="button"
      accent={accent}
      data-npc={person.id}
      onClick={() => setTalk({ npcId: person.id, choiceId: null })}
      aria-label={`Talk to ${person.name}, ${person.role}`}
    >
      <CardBody>
        {isCastId(person.id) && <CastPortrait id={person.id} labelled={false} />}
        <strong>{person.name}</strong>
        <small>{person.role}</small>
        <span>{greetingOf(person)}</span>
      </CardBody>
    </NpcButton>
  );

  const renderVillage = () => {
    if (npc) {
      return (
        <Conversation aria-label={`Talking to ${npc.name}`}>
          <TalkHead>
            {isCastId(npc.id) && <CastPortrait id={npc.id} />}
            <Speaker ref={speakerRef} tabIndex={-1}>
              {npc.name}
              <small>{npc.role}</small>
            </Speaker>
          </TalkHead>
          {choice && <AskedLine>{`You: ${choice.prompt}`}</AskedLine>}
          <SpokenLine accent={accent}>
            {choice?.reply ?? greetingOf(npc)}
          </SpokenLine>
          <ChoiceList role="group" aria-label="replies" data-roving-group>
            {npc.choices
              .filter((item) => item.id !== choice?.id)
              .map((item) => (
                <Button
                  key={item.id}
                  variant="outlined"
                  onClick={() => setTalk({ npcId: npc.id, choiceId: item.id })}
                >
                  {item.prompt}
                </Button>
              ))}
            <Button variant="text" onClick={endTalk}>Goodbye</Button>
          </ChoiceList>
        </Conversation>
      );
    }
    const mission = getCampaignMission(stageId);
    const boss = stage.bossId ? getBossDefinition(stage.bossId) : null;
    return (
      <>
        <VillageIntro>
          <VillageArt>
            <StagePreviewImage
              image={stageId === 'greatShinobiWar' ? GreatWarStage : StageAtlas}
              standalone={stageId === 'greatShinobiWar'}
              backgroundPosition={VILLAGE_ART[stageId]}
              role="img"
              aria-label={`${village.villageName} from above`}
            />
          </VillageArt>
          <div>
            {mission && (
              <h3>
                <small>{cleared ? 'Mission cleared · play again' : 'Next mission'}</small>
                {mission.title}
              </h3>
            )}
            {mission && (
              <MissionGoals>
                {`${mission.objectives.map((objective) => objective.label).join(' · ')}${boss ? ` · ${boss.name}` : ''}`}
              </MissionGoals>
            )}
            <HubBlurb>{hub.blurb}</HubBlurb>
          </div>
        </VillageIntro>
        <NpcGrid role="group" aria-label="villagers" data-roving-group>
          {people.map(renderNpc)}
        </NpcGrid>
        <StoryReplay
          cleared={cleared}
          onReplay={(part) => setScene({
            stageId, part, deploy: false, replay: true,
          })}
        />
        <BoardPreview stageId={stageId} progress={progress} />
        <StandingCard progress={progress} />
        <RebuildCard progress={progress} stageId={stageId} />
        <ScarfPicker progress={progress} onChoose={wear} onLocked={setAnnouncement} />
        <MissionGoals>
          {`Secrets: ${secrets.found} of ${secrets.total} found. ${SECRETS_EXPLAINER}`}
        </MissionGoals>
      </>
    );
  };

  const renderShop = () => (
    <>
      <MerchantLine>
        <strong>{`${HUB_MERCHANT.name}, ${HUB_MERCHANT.role}: `}</strong>
        {`“${hub.merchantLine}”`}
      </MerchantLine>
      <ShopHeading id="hub-pack-heading">
        For the next mission
        <span>
          {`Pack ${progress.pack.length}/${packSlots}`}
          {progress.pack.length >= packSlots && ' · full: unpack an item to swap it'}
        </span>
      </ShopHeading>
      <ShopList aria-labelledby="hub-pack-heading">
        {HUB_CONSUMABLES.map((item) => {
          const block = getConsumableBlock(progress, item.id);
          const packed = block === 'packed';
          const detailId = `hub-item-${item.id}`;
          // Short of Embers keeps the price on the button; the row says how short.
          let label = `Buy · ${item.price}`;
          if (packed) label = 'Unpack';
          else if (block && block !== 'funds') label = BLOCK_LABELS[block];
          // A full pack says so once, in the heading, not on every row.
          const detail = block && block !== 'packFull'
            ? blockDetail(block, item.price - progress.currency)
            : '';
          return (
            <ShopRow key={item.id}>
              <ItemText id={detailId}>
                <strong>{item.name}</strong>
                <span>{item.effect}</span>
                {detail && <small>{detail}</small>}
              </ItemText>
              <Button
                variant="outlined"
                aria-disabled={block && !packed ? 'true' : undefined}
                aria-describedby={detailId}
                // The visible label first, then what it buys.
                aria-label={`${label}: ${item.name}, ${formatEmbers(item.price)}`}
                onClick={() => (packed ? unpack(item.id) : buyConsumable(item.id))}
              >
                {label}
              </Button>
            </ShopRow>
          );
        })}
      </ShopList>
      <ShopHeading id="hub-training-heading">
        Training
        <span>Permanent, every mission</span>
      </ShopHeading>
      <ShopList aria-labelledby="hub-training-heading">
        {HUB_UPGRADES.map((item) => {
          const rank = clampUpgradeRank(item.id, progress.upgradeRanks[item.id]);
          const cap = getUpgradeCap(item.id);
          const price = getNextUpgradePrice(progress, item.id);
          const block = getUpgradeBlock(progress, item.id);
          const detailId = `hub-upgrade-${item.id}`;
          const label = block === 'maxed' ? BLOCK_LABELS.maxed : `Train · ${price}`;
          return (
            <ShopRow key={item.id}>
              <ItemText id={detailId}>
                <strong>
                  {item.name}
                  <RankPips role="img" aria-label={`rank ${rank} of ${cap}`}>
                    {Array.from({ length: cap }, (_, pip) => (
                      <RankPip key={pip} filled={pip < rank} />
                    ))}
                  </RankPips>
                </strong>
                <span>{item.effect}</span>
                {block && <small>{blockDetail(block, (price ?? 0) - progress.currency)}</small>}
              </ItemText>
              <Button
                variant="outlined"
                aria-disabled={block ? 'true' : undefined}
                aria-describedby={detailId}
                aria-label={price === null
                  ? `${label}: ${item.name}`
                  : `${label}: ${item.name} rank ${rank + 1}, ${formatEmbers(price)}`}
                onClick={() => buyUpgrade(item.id)}
              >
                {label}
              </Button>
            </ShopRow>
          );
        })}
      </ShopList>
    </>
  );

  const renderSecrets = () => (
    <SecretsPanel
      progress={progress}
      stageId={secretsStage}
      onSelect={setSecretsStage}
      onClaim={claim}
    />
  );

  return (
    <WelcomeContainer
      sx={{
        backgroundImage: `url(${StageAtlas})`,
        backgroundSize: '300% auto',
        backgroundPosition: '0% 0%',
        backgroundRepeat: 'no-repeat',
        '@media (max-width: 560px)': {
          backgroundSize: 'auto 200%',
        },
      }}
    >
      <StyledDialog
        open
        aria-labelledby="hub-title"
        aria-describedby="hub-status"
        onClose={handleClose}
        PaperProps={{ onKeyDown: moveFocusWithArrows, onFocus: keepRovingStopOnFocus }}
      >
        <DialogTitle id="hub-title">{`${village.villageName} Hub`}</DialogTitle>
        <DialogContent ref={contentRef}>
          <HubHeader>
            <HubStatusLine id="hub-status">
              {`Village ${village.order} of ${CAMPAIGN_VILLAGES.length} · ${cleared ? 'Cleared' : 'Mission ready'}`}
            </HubStatusLine>
            <EmberBalance aria-label={`${formatEmbers(progress.currency)} to spend`}>
              <EmberGlyph aria-hidden="true" />
              {formatEmbers(progress.currency)}
            </EmberBalance>
          </HubHeader>
          {report && (
            <HubReport>
              <strong>{`${reportVillage} mission: +${formatEmbers(report.earnings.total)}`}</strong>
              {report.earnings.total > 0 && ` · ${earningsBreakdown(report.earnings)}`}
            </HubReport>
          )}
          <ToggleButtonGroup
            value={section}
            exclusive
            fullWidth
            size="small"
            onChange={(_event, next: HubSection | null) => {
              if (!next) return;
              setSection(next);
              setTalk(null);
            }}
            aria-label="hub section"
            data-roving-group
          >
            {SECTIONS.map((item) => (
              <ToggleButton key={item.id} value={item.id}>{item.label}</ToggleButton>
            ))}
          </ToggleButtonGroup>
          <HubBody>
            {section === 'village' && renderVillage()}
            {section === 'shop' && renderShop()}
            {section === 'secrets' && renderSecrets()}
          </HubBody>
          <HubAnnouncer role="status" aria-live="polite">{announcement}</HubAnnouncer>
        </DialogContent>
        <DeckFooter data-deck-footer>
          <FooterActions>
            <Button variant="text" size="large" onClick={() => navigate('/')}>{MAIN_MENU_LABEL}</Button>
            <Button
              // Returning players deploy with one press: it has focus on arrival.
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              ref={deployRef}
              variant="contained"
              size="large"
              startIcon={<PlayArrowIcon />}
              onClick={deploy}
            >
              Deploy Mission
            </Button>
            <Button variant="outlined" size="large" onClick={() => navigate('/config')}>Mission Deck</Button>
          </FooterActions>
          <FooterHint>
            {[
              character.name,
              storyUpgrade.name,
              difficulty.label,
              packNames.length ? `Pack: ${packNames.join(', ')}` : 'Pack empty',
            ].join(' · ')}
          </FooterHint>
        </DeckFooter>
        <RovingTabStops root={contentRef} />
      </StyledDialog>
      {scene && (
        <StoryScene
          key={`${scene.stageId}:${scene.part}`}
          scene={getStoryScene(scene.stageId, scene.part)}
          villageName={getCampaignVillage(scene.stageId).villageName}
          accent={getStageDefinition(scene.stageId).palette.accent}
          finishLabel={scene.deploy ? 'Start mission' : 'Done'}
          onDone={endScene}
        />
      )}
    </WelcomeContainer>
  );
};
