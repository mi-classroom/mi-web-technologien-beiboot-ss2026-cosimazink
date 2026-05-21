// Hand gesture (near mode): pinch + directional swipe → "left" | "right" | "up" | "down"
// Also exposes isNearMode() so the orchestrator knows which mode is active.

import { OneEuroFilter } from "./one-euro-filter.js";
import { dist2D } from "./utils.js";

const MIN_CUTOFF          = 1.0;
const BETA                = 0.05;
const CONFIDENCE_MIN      = 0.7;
const PINCH_THRESHOLD     = 0.08;
const PINCH_HOLD_MS       = 500;
const AXIS_LOCK_THRESHOLD = 0.04;
const AXIS_RATIO          = 2.5;
const PINCH_MOVE_DELTA    = 0.13;

// Wrist (LM 0) → middle-finger tip (LM 12) in normalised coords ≈ 0.10 at ~2 m.
// Hands appearing smaller than this are too far away for reliable pinch control.
const HAND_MIN_SCALE = 0.10;

const ACTIONS = new Set(["right", "left", "up", "down"]);

// Per-hand pinch state machine
const makePinchState = () => ({
  phase:      "idle",
  armedAt:    null,
  prevX:      null,
  prevY:      null,
  accumX:     0,
  accumY:     0,
  lockedAxis: null,
});
const pinchState = { Left: makePinchState(), Right: makePinchState() };

// One Euro Filters for pinch midpoint, one per axis per hand
const makeHandFilters = () => ({
  pinchX: new OneEuroFilter(MIN_CUTOFF, BETA),
  pinchY: new OneEuroFilter(MIN_CUTOFF, BETA),
});
const hf = { Left: makeHandFilters(), Right: makeHandFilters() };

// true when at least one hand appears large enough to be within pinch range
export function isNearMode(results) {
  for (let i = 0; i < results.landmarks.length; i++) {
    const score = results.handednesses[i]?.[0]?.score ?? 0;
    if (score < CONFIDENCE_MIN) continue;
    if (dist2D(results.landmarks[i][0], results.landmarks[i][12]) >= HAND_MIN_SCALE) return true;
  }
  return false;
}

// Returns an action ("left"|"right"|"up"|"down"), a pending state ("arming"|"armed"), or null.
// minScale: minimum hand size to accept. Pass 0 to disable the distance gate (e.g. for debug views).
export function getPinchResult(results, ts, minScale = HAND_MIN_SCALE) {
  const hands = { Left: null, Right: null };

  for (let i = 0; i < results.landmarks.length; i++) {
    const score = results.handednesses[i]?.[0]?.score ?? 0;
    if (score < CONFIDENCE_MIN) continue;
    const lm = results.landmarks[i];
    if (minScale > 0 && dist2D(lm[0], lm[12]) < minScale) continue;
    const handedness = results.handednesses[i][0].displayName;
    const label      = handedness === "Left" ? "Right" : "Left";
    hands[label]     = lm;
  }

  let status = null;
  for (const label of ["Left", "Right"]) {
    if (!hands[label]) { resetPinch(label); continue; }

    const r = detectPinch(hands[label], hf[label], ts, label);
    if (ACTIONS.has(r)) return r;
    if (r === "armed" || (r === "arming" && status !== "armed")) status = r;
  }
  return status;
}

function detectPinch(lm, f, ts, label) {
  const isPinching = dist2D(lm[4], lm[8]) < PINCH_THRESHOLD;
  const st         = pinchState[label];

  if (!isPinching) { resetPinch(label); return null; }

  const px = f.pinchX.filter((lm[4].x + lm[8].x) / 2, ts);
  const py = f.pinchY.filter((lm[4].y + lm[8].y) / 2, ts);

  if (st.phase === "idle") {
    st.phase   = "arming";
    st.armedAt = ts;
    st.prevX   = px;
    st.prevY   = py;
    return "arming";
  }

  if (st.phase === "arming") {
    st.prevX = px;
    st.prevY = py;
    if (ts - st.armedAt < PINCH_HOLD_MS) return "arming";
    st.phase  = "armed";
    st.accumX = 0;
    st.accumY = 0;
    return "armed";
  }

  // Armed: accumulate movement
  st.accumX += px - st.prevX;
  st.accumY += py - st.prevY;
  st.prevX   = px;
  st.prevY   = py;

  const ax = Math.abs(st.accumX);
  const ay = Math.abs(st.accumY);

  if (!st.lockedAxis) {
    if (ax >= AXIS_LOCK_THRESHOLD && ax >= ay * AXIS_RATIO) st.lockedAxis = "h";
    else if (ay >= AXIS_LOCK_THRESHOLD && ay >= ax * AXIS_RATIO) st.lockedAxis = "v";
  }

  if (st.lockedAxis === "h" && ax >= PINCH_MOVE_DELTA) {
    const dir     = st.accumX < 0 ? "right" : "left";
    st.accumX     = 0;
    st.accumY     = 0;
    st.lockedAxis = null;
    return dir;
  }

  if (st.lockedAxis === "v" && ay >= PINCH_MOVE_DELTA) {
    const dir     = st.accumY > 0 ? "down" : "up";
    st.accumX     = 0;
    st.accumY     = 0;
    st.lockedAxis = null;
    return dir;
  }

  return "armed";
}

function resetPinch(label) {
  const st      = pinchState[label];
  st.phase      = "idle";
  st.armedAt    = null;
  st.prevX      = null;
  st.prevY      = null;
  st.accumX     = 0;
  st.accumY     = 0;
  st.lockedAxis = null;
}
