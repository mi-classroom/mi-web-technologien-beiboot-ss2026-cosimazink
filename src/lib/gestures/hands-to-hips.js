// Both wrists held near their same-side hip for 700 ms → action "down"

import { BaseGesture }                       from "../gesture-base.js";
import { dist2D, processHoldState, visible } from "../utils/utils.js";
import { Hysteresis }                        from "../utils/hysteresis.js";

const DEFAULTS = {
  holdMs:           700,
  visibilityMin:    0.5,
  hipDist:          0.20,
  hysteresisFactor: 1.25, // release distance = hipDist * this
};

export class HandsToHipsGesture extends BaseGesture {
  get name()          { return "hands-to-hips"; }
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

    const bothVisible = visible(lm, 15, visibilityMin) && visible(lm, 16, visibilityMin)
                      && visible(lm, 23, visibilityMin) && visible(lm, 24, visibilityMin);
    const maxDist      = Math.max(dist2D(lm[15], lm[23]), dist2D(lm[16], lm[24]));
    const bothNearHips = this._hysteresis.update(maxDist, bothVisible);

    const r = processHoldState(this._state, bothNearHips, "down", ts, holdMs);
    if (!r) return null;
    return r === "down" ? { action: "down" } : { state: r };
  }

  reset() {
    this._state = { phase: "idle", startTs: null };
    this._makeHysteresis();
  }

  _makeHysteresis() {
    const { hipDist, hysteresisFactor } = this._cfg;
    this._hysteresis = new Hysteresis(hipDist, hipDist * hysteresisFactor);
  }
}
