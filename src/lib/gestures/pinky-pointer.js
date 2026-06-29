/**
 * PinkyPointerGesture — move a cursor with the pinky finger.
 *
 * Fist with only the pinky extended → state "pointing" with pinky-tip position.
 * Click detection is intentionally NOT part of this gesture — use PinkyClickGesture
 * for that so the GestureLibrary cooldown can apply to clicks independently.
 *
 * Returned { x, y } are remapped from the active zone (zoneX/zoneY) to [0, 1]
 * so zone edges already correspond to screen edges.
 * x is in un-mirrored camera space — for a CSS-mirrored video use:
 *   screenX = (1 - x) * windowWidth
 *
 * @example
 * lib.register(new PinkyPointerGesture());
 * lib.on("pinky-pointer", ({ x, y }) => moveCursor(x, y));
 */

import { BaseGesture }     from "../gesture-base.js";
import { fingerExtended }  from "../utils/utils.js";

const DEFAULTS = {
  confidenceMin: 0.7,
  // Active zone within the camera frame [min, max] in normalised coords.
  // Coordinates are remapped so zone edges = screen edges, keeping the hand
  // fully visible even when pointing at screen corners.
  zoneX: [0.15, 0.85],
  zoneY: [0.10, 0.90],
};

export class PinkyPointerGesture extends BaseGesture {
  get name()          { return "pinky-pointer"; }
  get requiredInput() { return "hands"; }

  constructor(options = {}) {
    super();
    this._cfg = { ...DEFAULTS, ...options };
  }

  detect(handResults) {
    const { confidenceMin, zoneX, zoneY } = this._cfg;

    for (let i = 0; i < handResults.landmarks.length; i++) {
      const score = handResults.handednesses[i]?.[0]?.score ?? 0;
      if (score < confidenceMin) continue;

      const lm = handResults.landmarks[i];

      const pinkyExtended = fingerExtended(lm, 20, 18);
      const indexCurled   = !fingerExtended(lm, 8,  6);
      const middleCurled  = !fingerExtended(lm, 12, 10);
      const ringCurled    = !fingerExtended(lm, 16, 14);

      if (!(pinkyExtended && indexCurled && middleCurled && ringCurled)) continue;

      const { x, y } = lm[20];
      const nx = Math.max(0, Math.min(1, (x - zoneX[0]) / (zoneX[1] - zoneX[0])));
      const ny = Math.max(0, Math.min(1, (y - zoneY[0]) / (zoneY[1] - zoneY[0])));

      return { state: "pointing", x: nx, y: ny };
    }

    return null;
  }

  reset() {}
}
