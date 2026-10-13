# EXPLOSIVE SHINOBI ARENA

# PRODUCT REQUIREMENTS DOCUMENT (PRD)

# VERSION 2.1 (status updated October 2026)

---

# 1. PRODUCT VISION

Explosive Shinobi Arena is a Naruto-inspired 3D browser game built on top of Bomberman-style tactical combat.

The game combines:

* Exploration
* Bomb combat
* Character progression
* Boss encounters
* Village defense
* Fog of war
* Story progression
* Multiplayer

The game should feel like:

70% Naruto Adventure

20% Tactical Bomberman

10% Roguelike Progression

The player should feel like they are exploring villages, fighting enemy shinobi, discovering hidden secrets, defending important locations, collecting character-specific upgrades, and eventually battling legendary enemies and tailed beasts.

---

# 2. CURRENT TECH STACK

Frontend:

* React
* TypeScript
* Three.js
* React Three Fiber

Engine:

* Deterministic simulation
* Serializable actions
* Tick-based updates

Architecture:

* src/engine
* src/content
* src/story
* src/network
* src/view

Online multiplayer runs the same deterministic engine on an authoritative server.

---

# DELIVERY STATUS (OCTOBER 2026)

The live game at https://bomberman-zuqb.onrender.com implements this document as follows. The sections below keep the original requirements; where the shipped design differs, the section says so.

| Area | Status |
| --- | --- |
| Campaign (§3.1, §5, §8, §9) | Shipped: seven villages in order, each with its objectives, defense waves, mini-boss gate and boss. |
| Arena (§3.2) | Shipped: local battles for 2–3 players with Human or CPU slots. |
| Online (§3.3) | Shipped: private rooms, online co-op campaign, and arena versus for up to four players. Boss raids are not built. |
| Fog of war (§6) | Shipped, with each fighter's vision radius and special vision effects. |
| Map size (§7) | Shipped: bespoke 50x50 campaign maps with districts, secret rooms and an in-map boss arena. Arena maps stay 35x35. |
| Enemies, Zetsu, respawns (§10–§12) | Shipped. |
| Mini-bosses, bosses, tailed beasts (§13–§15) | Shipped: every village ends with a tailed beast. |
| Characters, powerups, themes, transformations (§16–§19) | Shipped: six fighters with signature bombs, ultimates and HUD themes. |
| Village hub (§20) | Shipped both ways: a hub between missions, and a village square inside every mission map. |
| Random events (§21) | Shipped: one event per village. |
| Hidden areas (§22) | Shipped: three secrets per village, tracked on the hub's Secrets tab with a set reward. |
| Character fragments (§23) | Partial: fragments are found and saved. Characters unlock by clearing their village, not yet by fragment count. |
| Reputation (§24) | Shipped: per-village reputation, standing tiers, requests, a stall discount, a new villager, and cosmetic scarves. |
| 3D assets (§25) | Shipped another way: every model is built in code from shared recipes. See §25. |
| Save system (§26) | Shipped: a versioned local save with migrations. |

---

# 3. GAME MODES

## 3.1 Campaign Mode

Primary game mode.

Supported:

* 1 Player
* 2 Player Local Co-op
* 3 Player Local Co-op

Features:

* Save progress
* Continue campaign
* Character unlocks
* Boss progression
* Village progression

Players advance through villages.

Progress persists between sessions.

---

## 3.2 Arena Mode

Local PvP.

Modes:

* Free For All
* Team Battle
* Last Shinobi Standing

Players fight each other.

No story progression.

---

## 3.3 Online Mode

Status: shipped as private rooms with online co-op campaign and arena versus (up to four players). Boss raids are not built yet.

Friend rooms.

Private lobbies.

Supports:

* Campaign Co-op
* Arena PvP
* Boss Raids

Uses existing deterministic engine.

---

# 4. WORLD STRUCTURE

The game is organized around villages.

Village Order:

1. Hidden Leaf
2. Hidden Sand
3. Hidden Mist
4. Hidden Cloud
5. Hidden Stone
6. Akatsuki Hideout
7. Great Shinobi War

Players unlock villages sequentially.

---

# 5. CAMPAIGN LOOP

Current:

Spawn
Fight Boss
Exit

Target:

Enter Village
↓
Explore Village
↓
Destroy Walls
↓
Discover Secrets
↓
Fight Enemy Shinobi
↓
Collect Character Powerups
↓
Complete Village Objective
↓
Defend Important Structure
↓
Defeat Mini Boss
↓
Locate Boss Arena
↓
Defeat Boss
↓
Receive Rewards
↓
Travel To Next Village

---

# 6. FOG OF WAR SYSTEM

Purpose:

* Exploration
* Suspense
* Online readiness
* Character differentiation

---

## Visibility States

VISIBLE

* Full color

EXPLORED

* Darkened

UNEXPLORED

* Hidden

---

## Vision Radius

Default:

3 cells

---

Character Modifiers:

Naruto = 3

Sasuke = 5

Itachi = 6

Minato = 4

Gaara = 4

Deidara = 3

---

## Special Vision Effects

Sasuke:

Can reveal hidden enemies.

Itachi:

Can reveal enemy outlines.

Minato:

Can sense nearby enemies.

Gaara:

Can detect movement through walls.

Deidara:

Explosions temporarily reveal territory.

---

# 7. MAP SIZE

Status: shipped. Each village has a bespoke 50x50 campaign map with districts, secret rooms and a walled boss arena that opens when the mini-boss gate is cleared. Arena maps are 35x35.

Original requirement: campaign maps should become:

35x35 minimum

50x50 preferred

Maps divided into districts.

Example:

Hidden Leaf

* Village Entrance
* Training Grounds
* Village Center
* Forest Zone
* Hokage District

Boss arena located in final district.

---

# 8. VILLAGE OBJECTIVES

Every village must contain objectives.

Objectives vary by village.

---

## Hidden Leaf

Objective:

Rescue Villagers

Protect Hokage Building

---

## Hidden Sand

Objective:

Destroy Puppet Towers

---

## Hidden Mist

Objective:

Find Hidden Bridge

Locate Missing Shinobi

---

## Hidden Cloud

Objective:

Activate Lightning Shrines

---

## Hidden Stone

Objective:

Collect Earth Seals

Protect Quarry

---

Objectives must be completed before boss arena unlocks.

---

# 9. VILLAGE DEFENSE MISSIONS

Important buildings become objectives.

Examples:

Leaf:

Hokage Building

Cloud:

Raikage Office

Sand:

Kazekage Building

Mist:

Mizukage Hall

Stone:

Tsuchikage Fortress

---

Mission Flow

Enemy Waves
↓
Protect Building
↓
Timer Ends
↓
Reward

Fail Condition:

Building HP reaches zero.

---

# 10. ENEMY SYSTEM

Remove generic "monster" feeling.

Enemies are enemy shinobi.

---

# Shared Base Types

Rogue Genin

Rogue Chunin

ANBU

Mist Ninja

Sand Ninja

Cloud Ninja

Stone Guard

White Zetsu

Black Zetsu

---

# Enemy Abilities

Rogue Genin

Kunai Throw

---

ANBU

Body Flicker

Teleport

---

Mist Ninja

Water Clone

---

Sand Ninja

Sand Spike

---

Cloud Ninja

Lightning Strike

---

White Zetsu

Melee

Fast

---

Black Zetsu

Elite Enemy

Uses special abilities

Mini Boss potential

---

# 11. ZETSU SPAWN SYSTEM

Destroyed walls can spawn surprises.

When wall is destroyed:

Possible outcomes:

60% Nothing

20% Powerup

15% White Zetsu

4% Elite Zetsu

1% Rare Reward

This creates uncertainty and exploration value.

---

# 12. ENEMY RESPAWN SYSTEM

Campaign villages remain alive.

Spawn Points exist in village districts.

Respawn Timer:

20 seconds

Max Active Enemies per Spawn Point:

Configurable

Recommended:

3-5

Enemies should not instantly repopulate cleared areas.

---

# 13. MINI BOSS SYSTEM

Every village contains mini bosses.

Examples:

Leaf

Iruka

ANBU Captain

---

Sand

Kankuro

---

Mist

Haku

---

Cloud

Darui

---

Stone

Akatsuchi

Mini bosses guard key objectives.

---

# 14. BOSS SYSTEM

Every village ends with a major boss.

Bosses require:

* Intro Sequence
* Multiple Phases
* Arena Hazards
* Unique Attacks
* Death Sequence

---

Boss Flow

Boss Intro
↓
Phase 1
↓
Phase 2
↓
Phase 3
↓
Victory
↓
Rewards

---

# 15. TAILED BEAST SYSTEM

Major story bosses.

Included:

Shukaku

Matatabi

Isobu

Son Goku

Kokuo

Saiken

Chomei

Gyuki

Kurama

Each beast requires:

* Custom model
* Custom attacks
* Custom arena
* Custom hazards
* Intro cinematic

---

# 16. CHARACTER SYSTEM

Playable:

Naruto

Sasuke

Minato

Gaara

Itachi

Deidara

---

Every character contains:

* Bomb Type
* Ultimate
* Passive
* Vision Modifier
* Shield Theme
* HUD Theme
* Powerup Pool

---

# 17. CHARACTER-SPECIFIC POWERUPS

Every character can receive the complete shared upgrade set:

* Bomb Capacity
* Basic Blast Range
* Ultimate Reach
* Movement Speed
* Manual Release
* Chakra Shield
* Phase Step
* Barrier Drop

The eight shared categories have equal random odds for every character. Basic
Blast Range and Ultimate Reach are separate categories, so a range-category
pickup is a 50/50 choice between normal and ultimate bombs.

The effect categories stay consistent, but matching generic entries are
replaced by the active character's signature pickup. Names, models, colors, and
pickup feedback match that character. Chakra Scrolls and Character Fragments
remain authored or rare rewards instead of ordinary random drops.

---

Naruto

* Rasengan

---

Sasuke

* Sharingan

---

Minato

* FTG Kunai

---

Gaara

* Sand Armor

---

Itachi

* Crow Feather
* Sharingan

---

Deidara

* Clay Spider

---

# 18. CHARACTER THEMES

Every character receives:

Unique Bomb Model

Unique Explosion Effect

Unique Shield Effect

Unique HUD

Unique Pickup Models

---

Example:

Naruto

Basic Bomb:

One Shadow Clone Bomb

Ultimate:

Shadow Clone Barrage fills every traversable cell in its eventual blast area
with clones after two seconds. Other players, monsters, and bosses caught in
the formation cannot move. The Naruto who owns the barrage can move through
his own clones; another Naruto cannot.

Shield:

Kurama Cloak

HUD:

Orange Chakra Theme

---

Minato

Basic Bomb:

FTG Seal

Ability:

Place a passable Flying Thunder kunai marker.

Ultimate:

Create the ultimate bomb at the marker and consume it. If no marker exists,
create the bomb at Minato's current cell.

Shield:

Hokage Barrier

HUD:

Yellow Flash Theme

---

# 19. CHARACTER TRANSFORMATIONS

Visual transformation system.

Do NOT create separate gameplay characters.

Implementation:

Base Model
+
Aura Layer
+
Material Changes
+
Particle Effects
+
Stat Buff

Example:

Naruto

Normal

↓

Kurama Mode

Effects:

Orange Aura

Chakra Particles

Stat Buffs

---

# 20. VILLAGE HUB SYSTEM

Status: shipped in two places.

* Between missions, the hub shows the village's people, the shop, the standing card, the requests on offer and the Secrets tab. You can deploy from it, and replay the village's story scenes.
* Inside every mission, the village square at the entrance is safe ground. The village's canon people stand there (for example Kakashi and Sakura in the Leaf, with Jiraiya wandering in from Known standing). It also holds the request board, the merchant's stall, a Secrets shrine and the gate. The square visibly rebuilds as the village's reputation grows: damaged, rebuilt, thriving, festival.

Between missions players enter village hubs.

Players can:

* Change Character
* View Unlocks
* Spend Currency
* Talk To NPCs
* Accept Missions
* Continue Story

Hub Examples:

Hidden Leaf Hub

Hidden Sand Hub

Hidden Cloud Hub

---

# 21. RANDOM EVENTS

Each run can contain random events.

Examples:

Leaf:

Nine Tails Alert

---

Sand:

Sandstorm

---

Mist:

Dense Fog

---

Cloud:

Lightning Storm

---

Stone:

Rockslide

---

Events modify gameplay.

---

# 22. HIDDEN AREAS

Status: shipped. Every village hides three secrets in real rooms: a scroll cache, an archive fragment and an elite Zetsu burrow. You enter them through cracked walls or hidden passages. The hub's Secrets tab lists each one with a rough location and what it gives. Finding all three pays Embers and unlocks that village's scarf.

Destroyable walls can reveal:

Secret Rooms

Hidden Scrolls

Rare Rewards

Lore Collectibles

Character Fragments

Hidden Mini Bosses

---

# 23. CHARACTER FRAGMENT SYSTEM

Status: partial. Fragments are found in secret rooms and saved per character. Characters currently unlock by clearing their village; unlocking by fragment count is not built.

Characters unlock through fragments.

Example:

Itachi

Need 5 Fragments

Fragments found in Mist Village.

Progress persists.

---

# 24. REPUTATION SYSTEM

Status: shipped.

* Each village's reputation rises with mission clears, new secrets and finished requests.
* Standing (the sum across villages) has tiers: Stranger, Known at 15, Trusted at 40, Honored at 80.
* The tiers bring a new villager (Jiraiya) to every square, more requests, a stall discount and the ember-thread scarf.
* A village's own reputation sets how far its square has rebuilt.

Every village has reputation.

Completing missions increases reputation.

Benefits:

New NPCs

New Rewards

New Quests

New Cosmetics

---

# 25. 3D ASSET STRATEGY

Status: shipped another way. No Blender models or downloaded meshes are used.

* Every fighter, enemy, mini-boss and villager is a cast figure. One look per character lives in `src/content/animeCast.ts`: hair, outfit, headband mark, face marks and accessories. It is built into one merged cel-shaded body and one ink outline.
* Tailed beasts, jutsu effects, pickups, objectives and village landmarks use the same shared-recipe approach.
* Animation comes from a render-only pose and cue system.

This keeps load time, draw calls and silhouettes predictable. The original plan follows.

Use Blender.

Shared Character Skeleton.

Shared Animation Set.

---

Player Models

Naruto

Sasuke

Gaara

Itachi

Minato

Deidara

---

Enemy Models

Base Ninja

ANBU

Mist Ninja

Sand Ninja

Cloud Ninja

Zetsu

---

Boss Models

Mini Bosses

Village Bosses

Tailed Beasts

---

Environment Props

Village Objects

Defense Structures

Powerup Models

Hidden Area Props

---

# 26. SAVE SYSTEM

Status: shipped as a versioned local save (version 6) that migrates older saves. Besides the list below, it keeps Embers, packed consumables and upgrades, finished requests, claimed secret sets, the chosen scarf, and the story scenes seen.

Persist:

Campaign Progress

Village Unlocks

Character Unlocks

Story Rewards

Reputation

Fragments

Settings

Controls

Character Progress

---

# 27. AGENTIC AI IMPLEMENTATION PRIORITY

Status: phases 1 to 4 are delivered. From phase 5, online multiplayer, friend lobbies (private rooms) and co-op campaign are delivered; boss raids remain.

PHASE 1

Campaign Progression

Village Objectives

Save System

Fog Of War

Village Hubs

---

PHASE 2

Character Powerups

Character HUD Themes

Enemy Shinobi System

Zetsu Spawn System

Hidden Areas

---

PHASE 3

Mini Bosses

Village Defense Missions

Random Events

Reputation System

---

PHASE 4

3D Models

Transformation Effects

Boss Cinematics

---

PHASE 5

Online Multiplayer

Boss Raids

Friend Lobbies

Co-op Campaign

---

# SUCCESS CRITERIA

A player should feel:

"I am exploring and surviving inside the Naruto world."

NOT:

"I am playing a series of disconnected Bomberman matches with Naruto skins."
