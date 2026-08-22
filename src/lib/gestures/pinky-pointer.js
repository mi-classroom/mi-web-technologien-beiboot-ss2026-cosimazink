// Fist with only the pinky extended → state "pointing" with pinky-tip position.
// { x, y } are remapped from the active zone to [0,1]; for a mirrored canvas use screenX = (1-x) * width
// Position is smoothed with a OneEuroFilter — the filter resets whenever the
// gesture drops out so it snaps to the new spot instead of lagging behind.

import { BaseGesture }    from "../gesture-base.js";
import { fingerExtended } from "../utils/utils.js";
import { selectHands }    from "../utils/hands.js";
import { remapToZone }    from "../utils/zones.js";
import { OneEuroFilter }  from "../utils/one-euro-filter.js";

const DEFAULTS = {
  confidenceMin: 0.7,
  zoneX: [0.15, 0.85], // active region of the camera frame (normalised)
  zoneY: [0.10, 0.90],
  minCutoff: 1.0,      // OneEuroFilter: lower = smoother at rest
  beta:      0.05,     // OneEuroFilter: higher = less lag during fast movement
};

export class PinkyPointerGesture extends BaseGesture {
  get name()          { return "pinky-pointer"; }
  get requiredInput() { return "hands"; }

  constructor(options = {}) {
    super();
    this._cfg = { ...DEFAULTS, ...options };
    this._makeFilters();
  }

  detect(handResults, ts) {
    const { confidenceMin, zoneX, zoneY } = this._cfg;
    const hands = selectHands(handResults, confidenceMin);

    for (const label of ["Left", "Right"]) {
      const lm = hands[label];
      if (!lm) continue;

      const pinkyExtended = fingerExtended(lm, 20, 18);
      const indexCurled   = !fingerExtended(lm, 8,  6);
      const middleCurled  = !fingerExtended(lm, 12, 10);
      const ringCurled    = !fingerExtended(lm, 16, 14);

      if (!(pinkyExtended && indexCurled && middleCurled && ringCurled)) continue;

      const { x, y } = remapToZone(lm[20].x, lm[20].y, zoneX, zoneY);
      return {
        state: "pointing",
        x: this._filterX.filter(x, ts),
        y: this._filterY.filter(y, ts),
      };
    }

    this.reset(); // no pointing hand this frame — drop filter state so it doesn't lag on the next one
    return null;
  }

  reset() {
    this._makeFilters();
  }

  _makeFilters() {
    const { minCutoff, beta } = this._cfg;
    this._filterX = new OneEuroFilter(minCutoff, beta);
    this._filterY = new OneEuroFilter(minCutoff, beta);
  }
}
