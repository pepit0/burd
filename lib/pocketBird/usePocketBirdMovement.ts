import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSharedValue } from "react-native-reanimated";

import type { PocketBirdAnimationId } from "@/lib/pocketBird/animations";
import {
  POCKET_BIRD_AFK_MS,
  POCKET_BIRD_FLY_SPEED,
  POCKET_BIRD_HOP_CHANCE,
  POCKET_BIRD_HOP_DELAY_MS,
  POCKET_BIRD_HOP_SPEED,
  POCKET_BIRD_UPDATE_MS,
  advanceParabolicPath,
  getGroundY,
  getPocketBirdBounds,
  getScaledHopDistance,
  pickHopTargetX,
  randomGroundPoint,
  randomPointInBounds,
  type PocketBirdMovementState,
} from "@/lib/pocketBird/movement";

interface MovementSnapshot {
  currentState: PocketBirdMovementState;
  stateStart: number;
  birdX: number;
  birdY: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  lastActionTimestamp: number;
}

interface PocketBirdArena {
  width: number;
  height: number;
  birdSize: number;
  grounded?: boolean;
}

export function usePocketBirdMovement(
  { width, height, birdSize, grounded = false }: PocketBirdArena,
  paused: boolean,
) {
  const ready = width > 0 && height > 0;
  const bounds = getPocketBirdBounds(width, height, birdSize);
  const groundY = getGroundY(bounds);
  const hopDistance = getScaledHopDistance(birdSize);
  const arenaSpan = Math.max(width, height);

  const posX = useSharedValue(width / 2);
  const posY = useSharedValue(grounded ? groundY : height / 2);
  const facingScale = useSharedValue(-1);

  const [movementState, setMovementState] =
    useState<PocketBirdMovementState>("idle");
  const [moveAnimation, setMoveAnimation] =
    useState<PocketBirdAnimationId>("BOB");

  const snapshot = useRef<MovementSnapshot>({
    currentState: "idle",
    stateStart: Date.now(),
    birdX: width / 2,
    birdY: grounded ? groundY : height / 2,
    startX: width / 2,
    startY: grounded ? groundY : height / 2,
    targetX: width / 2,
    targetY: grounded ? groundY : height / 2,
    lastActionTimestamp: Date.now(),
  });
  const facingRightRef = useRef(true);

  const updateFacing = (facingRight: boolean) => {
    if (facingRight === facingRightRef.current) return;
    facingRightRef.current = facingRight;
    facingScale.value = facingRight ? -1 : 1;
  };

  const setState = (next: PocketBirdMovementState) => {
    const state = snapshot.current;
    state.stateStart = Date.now();
    state.startX = state.birdX;
    state.startY = state.birdY;
    state.currentState = next;
    setMovementState(next);
    setMoveAnimation(next === "idle" ? "BOB" : "FLYING");
  };

  const beginHop = () => {
    const state = snapshot.current;
    if (state.currentState !== "idle") return;

    state.targetX = pickHopTargetX(state.birdX, bounds, hopDistance);
    state.targetY = grounded ? groundY : state.birdY;
    setState("hop");
  };

  const beginFly = () => {
    const state = snapshot.current;
    const target = grounded ? randomGroundPoint(bounds) : randomPointInBounds(bounds);
    state.targetX = target.x;
    state.targetY = target.y;
    setState("flying");
  };

  const touch = () => {
    snapshot.current.lastActionTimestamp = Date.now();
  };

  useLayoutEffect(() => {
    if (!ready) return;

    const startX = width / 2;
    const startY = grounded ? groundY : height / 2;
    posX.value = startX;
    posY.value = startY;

    snapshot.current = {
      currentState: "idle",
      stateStart: Date.now(),
      birdX: startX,
      birdY: startY,
      startX,
      startY,
      targetX: startX,
      targetY: startY,
      lastActionTimestamp: Date.now(),
    };

    setMovementState("idle");
    facingRightRef.current = true;
    facingScale.value = -1;
    setMoveAnimation("BOB");
  }, [facingScale, groundY, grounded, height, posX, posY, ready, width]);

  useEffect(() => {
    if (paused || !ready) return;

    const tick = () => {
      const state = snapshot.current;

      if (state.currentState === "idle") {
        if (grounded && state.birdY !== groundY) {
          state.birdY = groundY;
          posY.value = groundY;
        }

        if (
          Date.now() - state.stateStart > POCKET_BIRD_HOP_DELAY_MS &&
          Math.random() < POCKET_BIRD_HOP_CHANCE
        ) {
          beginHop();
        } else if (Date.now() - state.lastActionTimestamp > POCKET_BIRD_AFK_MS) {
          beginFly();
          state.lastActionTimestamp = Date.now();
        }
      } else if (state.currentState === "hop") {
        const step = advanceParabolicPath(
          state.startX,
          state.startY,
          state.targetX,
          state.targetY,
          state.birdX,
          state.birdY,
          state.stateStart,
          POCKET_BIRD_HOP_SPEED,
          arenaSpan,
        );
        state.birdX = step.x;
        state.birdY = step.y;
        posX.value = step.x;
        posY.value = step.y;
        updateFacing(step.facingRight);
        if (step.complete) {
          if (grounded) {
            state.birdY = groundY;
            posY.value = groundY;
          }
          setState("idle");
        }
      } else if (state.currentState === "flying") {
        const step = advanceParabolicPath(
          state.startX,
          state.startY,
          state.targetX,
          state.targetY,
          state.birdX,
          state.birdY,
          state.stateStart,
          POCKET_BIRD_FLY_SPEED,
          arenaSpan,
          2,
        );
        state.birdX = step.x;
        state.birdY = step.y;
        posX.value = step.x;
        posY.value = step.y;
        updateFacing(step.facingRight);
        if (step.complete) {
          if (grounded) {
            state.birdY = groundY;
            posY.value = groundY;
          }
          setState("idle");
        }
      }
    };

    const interval = setInterval(tick, POCKET_BIRD_UPDATE_MS);
    return () => clearInterval(interval);
  }, [arenaSpan, groundY, grounded, paused, posX, posY, ready]);

  return {
    posX,
    posY,
    facingScale,
    movementState,
    moveAnimation,
    touch,
  };
}
