# Improvement Roadmap — Explosive Shinobi Arena

This document collects the main engineering findings and product ideas from a source-level review of the game.

**Scope:** review of the repository source code and project structure. This is not a full live-gameplay test, load test, or local test-suite run. Items are prioritized by impact and confidence.

## Status (2026-11-22)

Items 1–5 are implemented. The section 6 ideas are not started. Before building, each finding was checked against the code, reproduced through the real WebSocket server, and load-tested. That changed two items and added the gaps below. The original text further down is kept as written.

| Item | Status | What changed from the finding |
|---|---|---|
| 1. Entity IDs | Done | Boss and enemy hazard IDs collided across rooms, as described. Bomb IDs did not: live bombs used an ID built from match state. That ID could still repeat inside one room, leaving a bomb on the map that never exploded and cost its owner a bomb slot. All three now come from per-match counters in `GameEngineState.entityIds`, and live bombs are `bomb-N`. |
| 2. Abuse protection | Done, one setting open | Limits per address and server-wide on sockets, rooms, connects, creates and failed joins. Seatless sockets time out. Origins are normalised. IPv6 is counted per /64 and per /48. The client address on Render still needs a live check (see Open decisions). |
| 3. Room lifecycle | Done | A one-second sweep replaces the per-room timers. A reconnect or a guest drop used to cancel the lobby timeout; it now counts from creation. Finished rooms stop ticking and expire, and idle and very old rooms close. SIGTERM tells every room the server is restarting. The client stops retrying after a final message and gives up rejoining after 30 s. |
| 4. Tests | Done | 10 new test files. The full suite is 153 files and 1,345 tests (143 and 1,258 before). Each regression test was shown failing on the old code. |
| 5. Diagnostics | Done | One JSON log line per event, with no tokens, names, raw addresses or message bodies. `/healthz` adds a socket count. `/metrics` answers only when `METRICS_TOKEN` is set. |

Evidence for item 1: one room plays while six others start matches on the same server. On the old code, 90 of room A's 1,700 snapshots held two live hazards with the same ID. On the branch, none of its 1,306 snapshots did. `REPLAY_VERSION` (and so `SIMULATION_VERSION`) moved from 10 to 11, so the client and the server must be deployed together.

Gaps found beyond this document, fixed on the branch:

- The client threw away the server's final messages and kept reconnecting. "This game is out of date" never showed, and "room closed" turned into "seat expired".
- Idle, paused and finished rooms sent 20 empty updates a second to every player.
- A lobby guest who dropped stayed in the seat forever and blocked the start.
- A reloaded or duplicated tab could not act, because the server kept the old tab's input sequence.
- `close()` hung while a socket without a seat was open.

Measured capacity: the server ran 100 four-player rooms on one laptop core. Under a 0.1-CPU quota, the size of Render's free instance, only about 3 rooms stayed smooth, and at 20 every room fell behind. A four-player room sends about 0.34 GB of WebSocket traffic an hour. `MAX_ROOMS` is now an environment setting but still defaults to 100.

Open decisions:

1. **Client address on Render.** `render.yaml` uses `CLIENT_IP_SOURCE=xff-left`. That keys normal browsers correctly, but a client that forges `X-Forwarded-For` bypasses every per-address limit and can fill the server-wide caps. The `DEBUG_CLIENT_IP` check described in `render.yaml` shows which source cannot be forged. It needs a deploy, so it has not been run.
2. **`MAX_ROOMS` on the free plan.** A low cap such as 3–5 keeps the rooms that exist smooth, but `MAX_ROOMS_PER_IP` (8) must then come down too, or one address can take every room.
3. **Create cooldown.** Section 2 asked for one. It is off by default (`CREATE_COOLDOWN_MS=0`): a per-address create budget of 8 rooms, refilling one every 5 s, replaces it so a classroom behind one router is not throttled.

Notes on the section 6 ideas, from the same investigation:

- `src/network/replay.ts` already versions and validates a replay format, but nothing records matches or plays them back.
- Local movement repeats per display frame, so a local match cannot be reproduced from the seed and player inputs alone; a replay needs the full action stream.
- The seed changes little (versus crate drops and campaign waves), so "everyone plays the same seed" does not make scores comparable yet.
- The engine keeps no event log, so post-match highlights would need one first.

## Priority summary

| Priority | Area | Improvement |
|---|---|---|
| P1 | Game engine correctness | Replace module-global entity ID counters with per-match state |
| P2 | Online abuse protection | Add global/IP-aware connection and room-creation limits |
| P2 | Multiplayer reliability | Define room lifecycle and recovery behavior for restarts |
| P3 | Test coverage | Add multi-room isolation and deterministic simulation tests |
| P3 | Developer experience | Add structured diagnostics and reproducible bug reports |
| P3 | Game design | Add arena modifiers, replay/ghost features, and rotating challenges |

---

## 1. P1 — Make entity IDs match-scoped

**Finding**

The engine currently keeps entity ID counters at module scope:

- `src/engine/bombs.ts` — bomb ID counter
- `src/engine/bosses.ts` — boss hazard ID counter
- `src/engine/monsters.ts` — monster hazard ID counter

The initial-state creation path resets these counters in `src/engine/initialState.ts`. The online server can create multiple rooms in the same Node.js process, so initializing one room can reset counters while another room is still running.

This creates a cross-room state-isolation risk: an active match may generate IDs that collide with IDs already used in that match. It also makes IDs depend on activity in other rooms, which weakens deterministic behavior.

**Recommended change**

- Store the next entity ID (or separate counters per entity type) inside each `GameEngineState`.
- Allocate IDs through the reducer/state transition rather than module-level mutable variables.
- Remove global reset functions once all callers use state-scoped allocation.

**Acceptance criteria**

- Starting or resetting Room B never changes the IDs generated in Room A.
- Two active rooms can create bombs and hazards in an interleaved sequence without duplicate IDs within either room.
- Replaying the same match action sequence from the same initial state produces the same entity IDs.
- Add regression tests for bombs, boss hazards, and monster hazards.

**Relevant files**

- [bombs.ts](../src/engine/bombs.ts)
- [bosses.ts](../src/engine/bosses.ts)
- [monsters.ts](../src/engine/monsters.ts)
- [initialState.ts](../src/engine/initialState.ts)
- [onlineServer.ts](../server/onlineServer.ts)

---

## 2. P2 — Strengthen online abuse protection

**Finding**

The server has a room cap and a per-socket message-rate limit. A per-socket limit alone does not prevent one client from opening multiple WebSocket connections and spreading requests across them. Room creation and total connection pressure should be considered at server level too.

**Recommended change**

- Add an IP-aware rate limit for room creation and repeated join attempts.
- Add a maximum active WebSocket connection count.
- Add a short room-creation cooldown and sensible limits for unauthenticated actions.
- If the server is behind a reverse proxy, trust forwarded IP headers only from explicitly trusted proxies.
- Log rate-limit decisions and room-creation failures without logging seat tokens.

**Acceptance criteria**

- Opening multiple sockets does not bypass the room-creation limit.
- Limits are configurable through environment variables.
- Legitimate players receive a clear, non-sensitive error when a limit is reached.
- Automated tests cover burst room creation and multi-socket behavior.

---

## 3. P2 — Make room lifecycle and restart behavior explicit

**Current limitation**

Room state is held in an in-memory map in the online server. A process restart or deployment therefore ends active rooms. This is acceptable for an early single-instance MVP, but should be explicit to players and operators.

**Recommended change**

For the near term:
- Give rooms a clear lifecycle: waiting, active, finished, expired.
- Expire abandoned waiting rooms and clean up disconnected seats after a documented timeout.
- Send a clear reconnect failure reason when a room no longer exists.
- Document that deployments/restarts terminate active matches.

For a later scaling phase:
- If persistent matches or multiple server instances become a real requirement, move room coordination/state to shared infrastructure (for example Redis or a database). Do not add this complexity until the product needs it.

**Acceptance criteria**

- Abandoned rooms are cleaned up predictably.
- Clients distinguish an expired room from a temporary network failure.
- Restart behavior is documented and tested.

---

## 4. P3 — Expand multiplayer and deterministic-engine tests

Add tests around the risks that are hardest to catch manually:

- Two or more rooms running concurrently.
- Interleaved bomb and hazard creation across rooms.
- Reconnect during an active match, including stale and invalid seat tokens.
- Room cleanup after all players disconnect.
- Snapshot backpressure and resynchronization under repeated updates.
- Identical seeded inputs producing identical simulation outcomes.
- Invalid or oversized protocol messages.

Prefer tests that assert observable behavior rather than internal implementation details.

---

## 5. P3 — Add useful operational diagnostics

Add structured server events for:

- Room created, started, finished, and expired.
- Player connected, disconnected, and reconnected.
- Protocol validation failures and rate-limit triggers.
- Snapshot resyncs and abnormal disconnects.

Include a room ID and event timestamp, but never log secret seat tokens. Add lightweight counters for active rooms, active sockets, match duration, and disconnect/reconnect frequency.

This will make production issues much easier to reproduce without collecting unnecessary player data.

---

## 6. Product ideas worth exploring

These are feature proposals, not defects found in the current code.

### A. Arena mutation system

Each round or arena can introduce one optional rule modifier:

- **Volatile walls:** some destructible blocks explode after a delay.
- **Low gravity:** bombs and power-ups have altered movement/throw behavior.
- **Blackout:** parts of the arena become temporarily obscured.
- **Chain reaction:** explosions can trigger nearby hazards.
- **Moving cover:** selected obstacles shift on a predictable timer.

Keep modifiers deterministic and show the active rules before a match starts. Start with one or two modifiers and make them configurable for fair competitive play.

### B. Replay and ghost races

Record a compact sequence of player inputs and the match seed, then use it to reproduce a match locally. This could enable:
- Replays for sharing funny or impressive matches.
- A ghost of a previous run in solo challenges.
- Daily or weekly leaderboard challenges where everyone plays the same seed.

First validate that the simulation is deterministic and version the replay format before building a full replay UI.

### C. Daily challenge

Offer one fixed-seed arena each day with a specific objective, such as clearing enemies under a time limit or surviving with limited bombs. A shared seed makes scores more comparable and gives players a reason to return.

### D. Post-match highlights

Generate a short match summary from game events:
- Most eliminations.
- Longest survival.
- Biggest chain reaction.
- Closest escape.
- Most power-ups collected.

Keep it based on actual recorded events rather than guessing from the final board state.

---

## Suggested implementation order

1. **Entity ID isolation** — fix the P1 correctness risk and add regression tests.
2. **Room and socket limits** — close the most obvious multi-connection abuse gap.
3. **Room lifecycle** — make disconnect, expiry, and restart behavior predictable.
4. **Determinism and replay groundwork** — strengthen seeded simulation tests before adding replay features.
5. **One arena modifier + daily challenge prototype** — test whether the gameplay loop becomes more replayable.

## Review notes

- The reducer-based engine, seeded randomness, fixed-step simulation, separation of rendering from engine logic, and server-authoritative multiplayer are good foundations to preserve.
- Avoid introducing Redis, a large analytics stack, or a complex plugin system before there is a concrete scaling or product need.
- Revisit priorities after the entity-ID regression test and a real multi-room load test.
