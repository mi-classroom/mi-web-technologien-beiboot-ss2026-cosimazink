// Reports how many fingers are extended on a hand (1-5)

import { BaseGesture }                        from "../gesture-base.js";
import { fingerExtendedRadial, thumbExtended } from "../utils/utils.js";
import { selectHands }                        from "../utils/hands.js";

// [tipIdx, pipIdx] for the four non-thumb fingers, for fingerExtendedRadial().
const FINGER_LANDMARKS = [
  [8, 6],   // index
  [12, 10], // middle
  [16, 14], // ring
  [20, 18], // pinky
];

const DEFAULTS = {
  confidenceMin:  0.7,
  hand:           "any", // "Left" | "Right" | "any"
  thumbExtendMin: 0.10,
};

export class FingerCountGesture extends BaseGesture {
  constructor(options = {}) {
    super();
    if (!options.name) throw new Error("FingerCountGesture requires a unique `name`");
    this._name = options.name;
    this._cfg  = { ...DEFAULTS, ...options };
  }

  get name()          { return this._name; }
  get requiredInput() { return "hands"; }

  detect(handResults) {
    const { confidenceMin, hand, thumbExtendMin } = this._cfg;
    const hands  = selectHands(handResults, confidenceMin);
    const labels = hand === "any" ? ["Left", "Right"] : [hand];

    for (const label of labels) {
      const lm = hands[label];
      if (!lm) continue;

      let count = thumbExtended(lm, thumbExtendMin) ? 1 : 0;
      for (const [tip, pip] of FINGER_LANDMARKS) {
        if (fingerExtendedRadial(lm, tip, pip)) count++;
      }
      if (count === 0) continue; // fist — nothing to report

      return { state: "showing", count };
    }

    return null;
  }
}
