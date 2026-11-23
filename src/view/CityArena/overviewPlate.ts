/**
 * The round-start overview's plate at the foot of the screen
 * (CityOverviewPlate), in CSS px: its gap above the bottom edge (and the
 * safe area), its height with one line of credits, and the air the camera
 * keeps above it. The plate may cover the bottom HUD band, which shows
 * nothing that changes while the countdown freezes the arena; the overview
 * frames the board above both (scene/roundOverview.ts), so the plate, which
 * also carries the countdown, covers none of the board.
 */
export const OVERVIEW_PLATE = { gapPx: 8, heightPx: 56, airPx: 8 } as const;
