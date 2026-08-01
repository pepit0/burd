export type PocketBirdFrameId =
  | "base"
  | "headDown"
  | "wingsDown"
  | "wingsUp"
  | "heartOne"
  | "heartTwo"
  | "heartThree"
  | "heartFour";

export type PocketBirdAnimationId = "STILL" | "BOB" | "FLYING" | "HEART";

export interface PocketBirdAnimationDef {
  frames: PocketBirdFrameId[];
  durations: number[];
  loop: boolean;
}

/** Animation timings copied from Pocket Bird (`src/birb.js`). */
export const POCKET_BIRD_ANIMATIONS: Record<
  PocketBirdAnimationId,
  PocketBirdAnimationDef
> = {
  STILL: {
    frames: ["base"],
    durations: [1000],
    loop: true,
  },
  BOB: {
    frames: ["base", "headDown"],
    durations: [420, 420],
    loop: true,
  },
  FLYING: {
    frames: ["base", "wingsUp", "headDown", "wingsDown"],
    durations: [30, 80, 30, 60],
    loop: true,
  },
  HEART: {
    frames: [
      "heartOne",
      "heartTwo",
      "heartThree",
      "heartFour",
      "heartThree",
      "heartFour",
      "heartThree",
      "heartFour",
    ],
    durations: [60, 80, 250, 250, 250, 250, 250, 250],
    loop: false,
  },
};

export const IDLE_ANIMATION: PocketBirdAnimationId = "BOB";

/** Occasional idle flourishes — same set Pocket Bird uses for hop/fly moments. */
export const IDLE_FLOURISH_ANIMATIONS: PocketBirdAnimationId[] = [
  "FLYING",
  "BOB",
];

export const FLOURISH_MIN_MS = 4500;
export const FLOURISH_MAX_MS = 9000;
export const FLOURISH_PLAY_MS = 2200;
