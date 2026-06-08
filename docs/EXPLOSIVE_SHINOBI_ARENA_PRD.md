# EXPLOSIVE SHINOBI ARENA

# PRODUCT REQUIREMENTS DOCUMENT (PRD)

# VERSION 2.0

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

Future online multiplayer must remain compatible with current deterministic architecture.

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

## 3.3 Online Mode (Future)

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

Current maps are small arena maps.

Campaign maps should become:

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

Generic crystals removed.

Powerups become character themed.

---

Naruto

* Rasengan
* Sage Scroll
* Kurama Chakra
* Clone Training

---

Sasuke

* Sharingan
* Chidori Scroll
* Curse Mark
* Susanoo Fragment

---

Minato

* FTG Kunai
* Yellow Flash Seal
* Hokage Cloak

---

Gaara

* Sand Armor
* Shukaku Fragment

---

Itachi

* Crow Feather
* Yata Mirror

---

Deidara

* Explosive Clay
* Clay Sculpture

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

Bomb:

Shadow Clone Marker

Shield:

Kurama Cloak

HUD:

Orange Chakra Theme

---

Minato

Bomb:

FTG Seal

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

Destroyable walls can reveal:

Secret Rooms

Hidden Scrolls

Rare Rewards

Lore Collectibles

Character Fragments

Hidden Mini Bosses

---

# 23. CHARACTER FRAGMENT SYSTEM

Characters unlock through fragments.

Example:

Itachi

Need 5 Fragments

Fragments found in Mist Village.

Progress persists.

---

# 24. REPUTATION SYSTEM

Every village has reputation.

Completing missions increases reputation.

Benefits:

New NPCs

New Rewards

New Quests

New Cosmetics

---

# 25. 3D ASSET STRATEGY

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
