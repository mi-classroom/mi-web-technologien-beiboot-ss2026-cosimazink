/**
 * PinkyClickGesture — trigger a click with pinky + thumb.
 *
 * Detects the same base fist-with-pinky pose as PinkyPointerGesture, plus the
 * thumb being extended outward. Returns action "click" with the pinky-tip
 * position so the caller knows where on screen to click.
 *
 * Register alongside PinkyPointerGesture. The internal cooldownMs option
 * prevents rapid re-firing when the gesture is held.
 *
 * Returned { x, y } use the same zone remapping as PinkyPointerGesture so both
 * gestures report coordinates in the same space.
 *
 * @example
 * lib.register(new PinkyPointerGesture());
 * lib.register(new PinkyClickGesture());
 *
 * lib.on("pinky-pointer", ({ x, y }) => moveCursor(x, y));
 * lib.on("pinky-click",   ({ x, y }) => triggerClickAt(x, y));
 */

import { BaseGesture }              from "../gesture-base.js";
import { dist2D, fingerExtended }   from "../utils/utils.js";

const DEFAULTS = {
  confidenceMin:  0.7,
  thumbExtendMin: 0.10, // min dist thumb tip → index MCP to count as extended
  cooldownMs:     2000, // minimum ms between two consecutive clicks
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

    // Reject immediately if still within cooldown window
    if (ts - this._lastClick < cooldownMs) return null;

    for (let i = 0; i < handResults.landmarks.length; i++) {
      const score = handResults.handednesses[i]?.[0]?.score ?? 0;
      if (score < confidenceMin) continue;

      const lm = handResults.landmarks[i];

      const pinkyExtended = fingerExtended(lm, 20, 18);
      const indexCurled   = !fingerExtended(lm, 8,  6);
      const middleCurled  = !fingerExtended(lm, 12, 10);
      const ringCurled    = !fingerExtended(lm, 16, 14);
      const thumbExtended = dist2D(lm[4], lm[5]) > thumbExtendMin;

      if (!(pinkyExtended && indexCurled && middleCurled && ringCurled && thumbExtended)) continue;

      const { x, y } = lm[20];
      const nx = Math.max(0, Math.min(1, (x - zoneX[0]) / (zoneX[1] - zoneX[0])));
      const ny = Math.max(0, Math.min(1, (y - zoneY[0]) / (zoneY[1] - zoneY[0])));

      this._lastClick = ts;
      return { action: "click", x: nx, y: ny };
    }

    return null;
  }

  reset() {
    this._lastClick = -Infinity;
  }
}
