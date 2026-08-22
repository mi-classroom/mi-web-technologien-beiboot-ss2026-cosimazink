// Pinch (thumb + index tip) and hold 500 ms, then swipe → "right" | "left" | "up" | "down"

import { BaseGesture } from "../gesture-base.js";
import { OneEuroFilter } from "../utils/one-euro-filter.js";
import { dist2D } from "../utils/utils.js";
import { selectHands } from "../utils/hands.js";
import { Hysteresis } from "../utils/hysteresis.js";

const SWIPE_ACTIONS = new Set(["right", "left", "up", "down"]);

const DEFAULTS = {
  minCutoff: 1.0,
  beta: 0.05,
  confidenceMin: 0.7,
  pinchThreshold: 0.08,
  hysteresisFactor: 1.25,
  pinchHoldMs: 500,
  axisLockThreshold: 0.04,
  axisRatio: 2.5,
  pinchMoveDelta: 0.13,
  minScale: 0.1,
};

export class PinchSwipeGesture extends BaseGesture {
  get name() {
    return "pinch-swipe";
  }
  get requiredInput() {
    return "hands";
  }

  constructor(options = {}) {
    super();
    this._cfg = { ...DEFAULTS, ...options };
    this._pinchState = {
      Left: this._makePinchState(),
      Right: this._makePinchState(),
    };
    this._filters = {
      Left: this._makeFilters(),
      Right: this._makeFilters(),
    };
    this._pinchHysteresis = {
      Left: this._makeHysteresis(),
      Right: this._makeHysteresis(),
    };
  }

  detect(handResults, ts) {
    const { confidenceMin, minScale } = this._cfg;
    const hands = selectHands(handResults, confidenceMin);
    if (minScale > 0) {
      for (const label of ["Left", "Right"]) {
        if (
          hands[label] &&
          dist2D(hands[label][0], hands[label][12]) < minScale
        )
          hands[label] = null;
      }
    }

    let pending = null;

    for (const label of ["Left", "Right"]) {
      if (!hands[label]) {
        this._resetPinch(label);
        continue;
      }
      const r = this._detectPinch(
        hands[label],
        this._filters[label],
        ts,
        label,
      );
      if (r === null) continue;
      if (SWIPE_ACTIONS.has(r)) return { action: r };
      if (r === "armed" || (r === "arming" && pending !== "armed")) pending = r;
    }

    return pending ? { state: pending } : null;
  }

  // True when at least one hand is large enough for near-mode detection.
  isNearMode(handResults) {
    const { confidenceMin, minScale } = this._cfg;
    const hands = selectHands(handResults, confidenceMin);
    return ["Left", "Right"].some(
      (label) =>
        hands[label] && dist2D(hands[label][0], hands[label][12]) >= minScale,
    );
  }

  reset() {
    for (const label of ["Left", "Right"]) {
      this._pinchState[label] = this._makePinchState();
      this._filters[label] = this._makeFilters();
      this._pinchHysteresis[label] = this._makeHysteresis();
    }
  }

  _makePinchState() {
    return {
      phase: "idle",
      armedAt: null,
      prevX: null,
      prevY: null,
      accumX: 0,
      accumY: 0,
      lockedAxis: null,
    };
  }

  _makeFilters() {
    const { minCutoff, beta } = this._cfg;
    return {
      pinchX: new OneEuroFilter(minCutoff, beta),
      pinchY: new OneEuroFilter(minCutoff, beta),
    };
  }

  // Hysteresis for pinch distance: prevents rapid toggling between "pinched" and "not pinched" when the distance is near the threshold.
  _makeHysteresis() {
    const { pinchThreshold, hysteresisFactor } = this._cfg;
    return new Hysteresis(pinchThreshold, pinchThreshold * hysteresisFactor);
  }

  _detectPinch(lm, f, ts, label) {
    const { pinchHoldMs, axisLockThreshold, axisRatio, pinchMoveDelta } =
      this._cfg;
    // index partially extended (PIP above MCP) → not a closed fist
    const indexExtended = lm[6].y < lm[5].y;
    const isClose = this._pinchHysteresis[label].update(dist2D(lm[4], lm[8]));
    const isPinching = indexExtended && isClose;
    const st = this._pinchState[label];

    if (!isPinching) {
      this._resetPinch(label);
      return null;
    }

    const px = f.pinchX.filter((lm[4].x + lm[8].x) / 2, ts);
    const py = f.pinchY.filter((lm[4].y + lm[8].y) / 2, ts);

    if (st.phase === "idle") {
      st.phase = "arming";
      st.armedAt = ts;
      st.prevX = px;
      st.prevY = py;
      return "arming";
    }

    if (st.phase === "arming") {
      st.prevX = px;
      st.prevY = py;
      if (ts - st.armedAt < pinchHoldMs) return "arming";
      st.phase = "armed";
      st.accumX = 0;
      st.accumY = 0;
      return "armed";
    }

    st.accumX += px - st.prevX;
    st.accumY += py - st.prevY;
    st.prevX = px;
    st.prevY = py;

    const ax = Math.abs(st.accumX);
    const ay = Math.abs(st.accumY);

    if (!st.lockedAxis) {
      if (ax >= axisLockThreshold && ax >= ay * axisRatio) st.lockedAxis = "h";
      else if (ay >= axisLockThreshold && ay >= ax * axisRatio)
        st.lockedAxis = "v";
    }

    if (st.lockedAxis === "h" && ax >= pinchMoveDelta) {
      const dir = st.accumX < 0 ? "right" : "left";
      st.accumX = 0;
      st.accumY = 0;
      st.lockedAxis = null;
      return dir;
    }
    if (st.lockedAxis === "v" && ay >= pinchMoveDelta) {
      const dir = st.accumY > 0 ? "down" : "up";
      st.accumX = 0;
      st.accumY = 0;
      st.lockedAxis = null;
      return dir;
    }

    return "armed";
  }

  _resetPinch(label) {
    this._pinchState[label] = this._makePinchState();
    this._pinchHysteresis[label].reset();
  }
}
