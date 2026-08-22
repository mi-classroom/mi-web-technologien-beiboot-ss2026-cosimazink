// Configurable finger-shape gate + continuous "tilt" value from rolling the
// wrist (like turning a key), remapped to [0,1]. This gesture only reports
// the raw tilt — mapping that to a note/frequency/anything else is left to
// the app (see ADR 005, Teil B).
//
// Generalises the original IndexTiltGesture once the music app needed
// several shapes (one per "register") sharing the same tilt mechanic — see
// ADR 005, Teil B, Nachtrag 4. Requires an explicit `name` since multiple
// instances of this same class are typically registered side by side.
//
// Measures the angle of the vector across the back of the hand (index MCP →
// pinky MCP), not wrist → fingertip: that vector points in the direction the
// finger is aimed, which barely changes during a wrist roll (the rotation
// axis is roughly aligned with it) — see ADR 005, Teil B, Nachtrag 1.

import { BaseGesture }                                     from "../gesture-base.js";
import { fingerExtendedRadial, thumbExtended, angle2D }     from "../utils/utils.js";
import { selectHands }                                      from "../utils/hands.js";
import { clampRemap01 }                                     from "../utils/zones.js";
import { OneEuroFilter }                                    from "../utils/one-euro-filter.js";

// [tipIdx, pipIdx] per finger, for fingerExtendedRadial(). Thumb is checked
// separately via thumbExtended() — see comment there.
const FINGER_LANDMARKS = {
  index:  [8, 6],
  middle: [12, 10],
  ring:   [16, 14],
  pinky:  [20, 18],
};

const DEFAULTS = {
  confidenceMin: 0.7,
  angleRange: [-60, 60], // degrees, comfortable wrist-roll range → [0,1] (0° = palm flat toward camera)
  minCutoff: 1.0,
  beta:      0.05,
  hand: "any", // "Left" | "Right" | "any" — restrict to one hand so it doesn't clash with a gesture on the other
  thumbExtendMin: 0.10, // distance thumb tip → index MCP to count as extended
  // Required shape: true = must be extended, false = must be curled. Default: index-only (the original gesture).
  fingers: { thumb: false, index: true, middle: false, ring: false, pinky: false },
};

export class TiltGesture extends BaseGesture {
  constructor(options = {}) {
    super();
    if (!options.name) throw new Error("TiltGesture requires a unique `name`");
    this._name = options.name;
    this._cfg  = {
      ...DEFAULTS,
      ...options,
      fingers: { ...DEFAULTS.fingers, ...(options.fingers ?? {}) },
    };
    this._makeFilter();
  }

  get name()          { return this._name; }
  get requiredInput() { return "hands"; }

  detect(handResults, ts) {
    const { confidenceMin, angleRange, hand, fingers, thumbExtendMin } = this._cfg;
    const hands  = selectHands(handResults, confidenceMin);
    const labels = hand === "any" ? ["Left", "Right"] : [hand];

    for (const label of labels) {
      const lm = hands[label];
      if (!lm) continue;

      const matchesShape = Object.entries(fingers).every(([finger, mustBeExtended]) => {
        if (finger === "thumb") return thumbExtended(lm, thumbExtendMin) === mustBeExtended;
        const [tip, pip] = FINGER_LANDMARKS[finger];
        return fingerExtendedRadial(lm, tip, pip) === mustBeExtended;
      });
      if (!matchesShape) continue;

      const angleDeg = this._filter.filter(angle2D(lm[17], lm[5]), ts); // pinky MCP → index MCP
      const value    = clampRemap01(angleDeg, angleRange[0], angleRange[1]);

      return { state: "tilting", value, angleDeg };
    }

    this.reset(); // no matching hand this frame — drop filter state so it doesn't lag on the next one
    return null;
  }

  reset() {
    this._makeFilter();
  }

  _makeFilter() {
    const { minCutoff, beta } = this._cfg;
    this._filter = new OneEuroFilter(minCutoff, beta);
  }
}
