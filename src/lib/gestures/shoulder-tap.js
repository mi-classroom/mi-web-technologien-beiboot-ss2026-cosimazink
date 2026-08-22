// Cross-shoulder tap: hold wrist near opposite shoulder for 700 ms.
// Left wrist → right shoulder → "right"; right wrist → left shoulder → "left"

import { BaseGesture } from "../gesture-base.js";
import { dist2D, processHoldState, visible } from "../utils/utils.js";
import { Hysteresis } from "../utils/hysteresis.js";

const DEFAULTS = {
  holdMs: 700,
  visibilityMin: 0.5,
  shoulderTapDist: 0.12,
  hysteresisFactor: 1.25, // release distance = shoulderTapDist * this
};

export class ShoulderTapGesture extends BaseGesture {
  get name() {
    return "shoulder-tap";
  }
  get requiredInput() {
    return "pose";
  }

  constructor(options = {}) {
    super();
    this._cfg = { ...DEFAULTS, ...options };
    this._state = {
      leftOnRight: { phase: "idle", startTs: null },
      rightOnLeft: { phase: "idle", startTs: null },
    };
    this._makeHysteresis();
  }

  detect(poseResults, ts) {
    if (!poseResults?.landmarks?.length) {
      this.reset();
      return null;
    }

    const { holdMs, visibilityMin } = this._cfg;
    const lm = poseResults.landmarks[0];

    const leftVisible =
      visible(lm, 15, visibilityMin) && visible(lm, 12, visibilityMin);
    const rightVisible =
      visible(lm, 16, visibilityMin) && visible(lm, 11, visibilityMin);

    const leftTap = this._leftOnRight.update(
      dist2D(lm[15], lm[12]),
      leftVisible,
    );
    const rightTap = this._rightOnLeft.update(
      dist2D(lm[16], lm[11]),
      rightVisible,
    );

    const r1 = processHoldState(
      this._state.leftOnRight,
      leftTap,
      "right",
      ts,
      holdMs,
    );
    const r2 = processHoldState(
      this._state.rightOnLeft,
      rightTap,
      "left",
      ts,
      holdMs,
    );

    const action =
      r1 === "right" || r1 === "left"
        ? r1
        : r2 === "right" || r2 === "left"
          ? r2
          : null;
    if (action) return { action };

    const state = r1 || r2;
    return state ? { state } : null;
  }

  reset() {
    this._state.leftOnRight = { phase: "idle", startTs: null };
    this._state.rightOnLeft = { phase: "idle", startTs: null };
    this._makeHysteresis();
  }

  _makeHysteresis() {
    const { shoulderTapDist, hysteresisFactor } = this._cfg;
    const offAt = shoulderTapDist * hysteresisFactor;
    this._leftOnRight = new Hysteresis(shoulderTapDist, offAt);
    this._rightOnLeft = new Hysteresis(shoulderTapDist, offAt);
  }
}
