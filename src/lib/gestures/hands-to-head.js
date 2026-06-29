/**
 * HandsToHeadGesture — far-mode body-pose gesture.
 *
 * Both wrists held near the nose for 700 ms triggers "up".
 *
 * Actions: "up"
 * States:  "holding"
 *
 * @example
 * lib.register(new HandsToHeadGesture());
 * lib.on("hands-to-head:up", () => Reveal.up());
 */

import { BaseGesture }              from "../gesture-base.js";
import { dist2D, processHoldState } from "../utils/utils.js";

const DEFAULTS = {
  holdMs:        700,
  visibilityMin: 0.5,
  headDist:      0.25,
};

export class HandsToHeadGesture extends BaseGesture {
  get name()          { return "hands-to-head"; }
  get requiredInput() { return "pose"; }

  constructor(options = {}) {
    super();
    this._cfg   = { ...DEFAULTS, ...options };
    this._state = { phase: "idle", startTs: null };
  }

  detect(poseResults, ts) {
    if (!poseResults?.landmarks?.length) { this.reset(); return null; }

    const { holdMs, visibilityMin, headDist } = this._cfg;
    const lm  = poseResults.landmarks[0];
    const vis = (i) => (lm[i]?.visibility ?? 0) >= visibilityMin;

    const bothNearHead = vis(15) && vis(16) && vis(0)
                      && dist2D(lm[15], lm[0]) < headDist
                      && dist2D(lm[16], lm[0]) < headDist;

    const r = processHoldState(this._state, bothNearHead, "up", ts, holdMs);
    if (!r) return null;
    return r === "up" ? { action: "up" } : { state: r };
  }

  reset() {
    this._state = { phase: "idle", startTs: null };
  }
}
