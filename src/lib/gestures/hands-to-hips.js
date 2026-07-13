// Both wrists held near their same-side hip for 700 ms → action "down"

import { BaseGesture }              from "../gesture-base.js";
import { dist2D, processHoldState } from "../utils/utils.js";

const DEFAULTS = {
  holdMs:        700,
  visibilityMin: 0.5,
  hipDist:       0.20,
};

export class HandsToHipsGesture extends BaseGesture {
  get name()          { return "hands-to-hips"; }
  get requiredInput() { return "pose"; }

  constructor(options = {}) {
    super();
    this._cfg   = { ...DEFAULTS, ...options };
    this._state = { phase: "idle", startTs: null };
  }

  detect(poseResults, ts) {
    if (!poseResults?.landmarks?.length) { this.reset(); return null; }

    const { holdMs, visibilityMin, hipDist } = this._cfg;
    const lm  = poseResults.landmarks[0];
    const vis = (i) => (lm[i]?.visibility ?? 0) >= visibilityMin;

    const bothNearHips = vis(15) && vis(16) && vis(23) && vis(24)
                      && dist2D(lm[15], lm[23]) < hipDist
                      && dist2D(lm[16], lm[24]) < hipDist;

    const r = processHoldState(this._state, bothNearHips, "down", ts, holdMs);
    if (!r) return null;
    return r === "down" ? { action: "down" } : { state: r };
  }

  reset() {
    this._state = { phase: "idle", startTs: null };
  }
}
