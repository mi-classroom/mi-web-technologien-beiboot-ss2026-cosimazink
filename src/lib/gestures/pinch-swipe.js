/**
 * PinchSwipeGesture — near-mode hand gesture.
 *
 * Pinch (thumb tip + index tip closer than threshold) and hold for 500 ms,
 * then swipe in any direction to trigger a directional action.
 *
 * Actions:  "right" | "left" | "up" | "down"
 * States:   "arming" | "armed"
 *
 * The gesture automatically ignores hands that are too far from the camera
 * (hand appears smaller than `minScale` in normalised coordinates).
 * Pass `minScale: 0` to disable this gate (useful for debug views).
 *
 * @example
 * lib.register(new PinchSwipeGesture());
 * lib.on("pinch-swipe:right", () => Reveal.right());
 */

import { BaseGesture }    from "../gesture-base.js";
import { OneEuroFilter }  from "../utils/one-euro-filter.js";
import { dist2D }         from "../utils/utils.js";

const DEFAULTS = {
  minCutoff:         1.0,
  beta:              0.05,
  confidenceMin:     0.7,
  pinchThreshold:    0.08,
  pinchHoldMs:       500,
  axisLockThreshold: 0.04,
  axisRatio:         2.5,
  pinchMoveDelta:    0.13,
  minScale:          0.10,
};

export class PinchSwipeGesture extends BaseGesture {
  get name()          { return "pinch-swipe"; }
  get requiredInput() { return "hands"; }

  constructor(options = {}) {
    super();
    this._cfg = { ...DEFAULTS, ...options };
    this._pinchState = {
      Left:  this._makePinchState(),
      Right: this._makePinchState(),
    };
    this._filters = {
      Left:  this._makeFilters(),
      Right: this._makeFilters(),
    };
  }

  detect(handResults, ts) {
    const { confidenceMin, minScale } = this._cfg;
    const hands = { Left: null, Right: null };

    for (let i = 0; i < handResults.landmarks.length; i++) {
      const score = handResults.handednesses[i]?.[0]?.score ?? 0;
      if (score < confidenceMin) continue;
      const lm = handResults.landmarks[i];
      if (minScale > 0 && dist2D(lm[0], lm[12]) < minScale) continue;
      const raw   = handResults.handednesses[i][0].displayName;
      const label = raw === "Left" ? "Right" : "Left"; // mirror correction
      hands[label] = lm;
    }

    const ACTIONS = new Set(["right", "left", "up", "down"]);
    let pending = null;

    for (const label of ["Left", "Right"]) {
      if (!hands[label]) { this._resetPinch(label); continue; }
      const r = this._detectPinch(hands[label], this._filters[label], ts, label);
      if (r === null) continue;
      if (ACTIONS.has(r)) return { action: r };
      if (r === "armed" || (r === "arming" && pending !== "armed")) pending = r;
    }

    return pending ? { state: pending } : null;
  }

  /**
   * Returns true when at least one hand is large enough for near-mode detection.
   * Exposed so a consuming app can switch between hand and pose gesture modes.
   *
   * @param {object} handResults - GestureRecognizer result
   * @returns {boolean}
   */
  isNearMode(handResults) {
    const { confidenceMin, minScale } = this._cfg;
    for (let i = 0; i < handResults.landmarks.length; i++) {
      const score = handResults.handednesses[i]?.[0]?.score ?? 0;
      if (score < confidenceMin) continue;
      if (dist2D(handResults.landmarks[i][0], handResults.landmarks[i][12]) >= minScale) return true;
    }
    return false;
  }

  reset() {
    for (const label of ["Left", "Right"]) {
      this._pinchState[label] = this._makePinchState();
      this._filters[label]    = this._makeFilters();
    }
  }

  // ── private ───────────────────────────────────────────────────────────────

  _makePinchState() {
    return { phase: "idle", armedAt: null, prevX: null, prevY: null,
             accumX: 0, accumY: 0, lockedAxis: null };
  }

  _makeFilters() {
    const { minCutoff, beta } = this._cfg;
    return {
      pinchX: new OneEuroFilter(minCutoff, beta),
      pinchY: new OneEuroFilter(minCutoff, beta),
    };
  }

  _detectPinch(lm, f, ts, label) {
    const { pinchThreshold, pinchHoldMs, axisLockThreshold, axisRatio, pinchMoveDelta } = this._cfg;
    const isPinching = dist2D(lm[4], lm[8]) < pinchThreshold;
    const st         = this._pinchState[label];

    if (!isPinching) { this._resetPinch(label); return null; }

    const px = f.pinchX.filter((lm[4].x + lm[8].x) / 2, ts);
    const py = f.pinchY.filter((lm[4].y + lm[8].y) / 2, ts);

    if (st.phase === "idle") {
      st.phase = "arming"; st.armedAt = ts; st.prevX = px; st.prevY = py;
      return "arming";
    }

    if (st.phase === "arming") {
      st.prevX = px; st.prevY = py;
      if (ts - st.armedAt < pinchHoldMs) return "arming";
      st.phase = "armed"; st.accumX = 0; st.accumY = 0;
      return "armed";
    }

    st.accumX += px - st.prevX;
    st.accumY += py - st.prevY;
    st.prevX   = px;
    st.prevY   = py;

    const ax = Math.abs(st.accumX);
    const ay = Math.abs(st.accumY);

    if (!st.lockedAxis) {
      if (ax >= axisLockThreshold && ax >= ay * axisRatio) st.lockedAxis = "h";
      else if (ay >= axisLockThreshold && ay >= ax * axisRatio) st.lockedAxis = "v";
    }

    if (st.lockedAxis === "h" && ax >= pinchMoveDelta) {
      const dir = st.accumX < 0 ? "right" : "left";
      st.accumX = 0; st.accumY = 0; st.lockedAxis = null;
      return dir;
    }
    if (st.lockedAxis === "v" && ay >= pinchMoveDelta) {
      const dir = st.accumY > 0 ? "down" : "up";
      st.accumX = 0; st.accumY = 0; st.lockedAxis = null;
      return dir;
    }

    return "armed";
  }

  _resetPinch(label) {
    this._pinchState[label] = this._makePinchState();
  }
}
