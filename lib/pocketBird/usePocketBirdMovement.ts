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

const IDLE_CHECK_MS = 100;

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
  const rescheduleAfk = useRef(() => {});

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
    rescheduleAfk.current();
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

    let cancelled = false;
    let hopTimer: ReturnType<typeof setTimeout> | undefined;
    let hopRollTimer: ReturnType<typeof setTimeout> | undefined;
    let afkTimer: ReturnType<typeof setTimeout> | undefined;
    let raf = 0;

    const hopChancePerCheck =
      1 - (1 - POCKET_BIRD_HOP_CHANCE) ** (IDLE_CHECK_MS / POCKET_BIRD_UPDATE_MS);

    const clearTimers = () => {
      if (hopTimer) clearTimeout(hopTimer);
      if (hopRollTimer) clearTimeout(hopRollTimer);
      if (afkTimer) clearTimeout(afkTimer);
      hopTimer = undefined;
      hopRollTimer = undefined;
      afkTimer = undefined;
    };

    const stopRaf = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const tickMotion = () => {
      if (cancelled) return;
      const state = snapshot.current;

      if (state.currentState === "hop") {
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
          scheduleIdle();
          return;
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
          scheduleIdle();
          return;
        }
      } else {
        scheduleIdle();
        return;
      }

      raf = requestAnimationFrame(tickMotion);
    };

    const startMotionLoop = () => {
      clearTimers();
      stopRaf();
      raf = requestAnimationFrame(tickMotion);
    };

    const scheduleAfk = () => {
      if (cancelled || snapshot.current.currentState !== "idle") return;
      if (afkTimer) clearTimeout(afkTimer);
      const wait = Math.max(
        0,
        POCKET_BIRD_AFK_MS - (Date.now() - snapshot.current.lastActionTimestamp),
      );
      afkTimer = setTimeout(() => {
        if (cancelled || snapshot.current.currentState !== "idle") return;
        beginFly();
        snapshot.current.lastActionTimestamp = Date.now();
        startMotionLoop();
      }, wait);
    };

    rescheduleAfk.current = scheduleAfk;

    const scheduleIdle = () => {
      stopRaf();
      clearTimers();

      if (grounded && snapshot.current.birdY !== groundY) {
        snapshot.current.birdY = groundY;
        posY.value = groundY;
      }

      hopTimer = setTimeout(() => {
        const roll = () => {
          if (cancelled || snapshot.current.currentState !== "idle") return;
          if (Math.random() < hopChancePerCheck) {
            beginHop();
            startMotionLoop();
            return;
          }
          hopRollTimer = setTimeout(roll, IDLE_CHECK_MS);
        };
        roll();
      }, POCKET_BIRD_HOP_DELAY_MS);

      scheduleAfk();
    };

    if (snapshot.current.currentState === "idle") {
      scheduleIdle();
    } else {
      startMotionLoop();
    }

    return () => {
      cancelled = true;
      rescheduleAfk.current = () => {};
      clearTimers();
      stopRaf();
    };
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
