// "I love you" sign (🤟 pinky + index + thumb extended, middle + ring curled) → action "click".
// Index must be extended to distinguish from PinkyPointerGesture (pinky only), preventing accidental clicks.
// Internal cooldown prevents rapid re-firing. Use alongside PinkyPointerGesture.

import { BaseGesture }            from "../gesture-base.js";
import { dist2D, fingerExtended } from "../utils/utils.js";
import { selectHands }            from "../utils/hands.js";
import { remapToZone }            from "../utils/zones.js";

const DEFAULTS = {
  confidenceMin:  0.7,
  thumbExtendMin: 0.10, // min dist thumb tip → index MCP to count as extended
  cooldownMs:     2000,
  zoneX: [0.15, 0.85],
  zoneY: [0.10, 0.90],
};

export class PinkyClickGesture extends BaseGesture {
  get name()          { return "pinky-click"; }
  get requiredInput() { return "hands"; }

  constructor(options = {}) {
    super();
    this._cfg       = { ...DEFAULTS, ...options };
    this._lastClick = -Infinity;
  }

  detect(handResults, ts) {
    const { confidenceMin, thumbExtendMin, cooldownMs, zoneX, zoneY } = this._cfg;

    if (ts - this._lastClick < cooldownMs) return null;

    const hands = selectHands(handResults, confidenceMin);

    for (const label of ["Left", "Right"]) {
      const lm = hands[label];
      if (!lm) continue;

      const pinkyExtended = fingerExtended(lm, 20, 18);
      const indexExtended = fingerExtended(lm, 8,  6);
      const middleCurled  = !fingerExtended(lm, 12, 10);
      const ringCurled    = !fingerExtended(lm, 16, 14);
      const thumbExtended = dist2D(lm[4], lm[5]) > thumbExtendMin;

      if (!(pinkyExtended && indexExtended && middleCurled && ringCurled && thumbExtended)) continue;

      const { x, y } = remapToZone(lm[20].x, lm[20].y, zoneX, zoneY);

      this._lastClick = ts;
      return { action: "click", x, y };
    }

    return null;
  }

  reset() {
    this._lastClick = -Infinity;
  }
}
