// Both wrists held near the nose for 700 ms → action "up"

import { BaseGesture }                       from "../gesture-base.js";
import { dist2D, processHoldState, visible } from "../utils/utils.js";
import { Hysteresis }                        from "../utils/hysteresis.js";

const DEFAULTS = {
  holdMs:           700,
  visibilityMin:    0.5,
  headDist:         0.25,
  hysteresisFactor: 1.25, // release distance = headDist * this
};

export class HandsToHeadGesture extends BaseGesture {
  get name()          { return "hands-to-head"; }
  get requiredInput() { return "pose"; }

  constructor(options = {}) {
    super();
    this._cfg   = { ...DEFAULTS, ...options };
    this._state = { phase: "idle", startTs: null };
    this._makeHysteresis();
  }

  detect(poseResults, ts) {
    if (!poseResults?.landmarks?.length) { this.reset(); return null; }

    const { holdMs, visibilityMin } = this._cfg;
    const lm = poseResults.landmarks[0];

    const bothVisible = visible(lm, 15, visibilityMin) && visible(lm, 16, visibilityMin) && visible(lm, 0, visibilityMin);
    const maxDist      = Math.max(dist2D(lm[15], lm[0]), dist2D(lm[16], lm[0]));
    const bothNearHead = this._hysteresis.update(maxDist, bothVisible);

    const r = processHoldState(this._state, bothNearHead, "up", ts, holdMs);
    if (!r) return null;
    return r === "up" ? { action: "up" } : { state: r };
  }

  reset() {
    this._state = { phase: "idle", startTs: null };
    this._makeHysteresis();
  }

  _makeHysteresis() {
    const { headDist, hysteresisFactor } = this._cfg;
    this._hysteresis = new Hysteresis(headDist, headDist * hysteresisFactor);
  }
}
