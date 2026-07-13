// Fist with only the pinky extended → state "pointing" with pinky-tip position.
// { x, y } are remapped from the active zone to [0,1]; for a mirrored canvas use screenX = (1-x) * width

import { BaseGesture }    from "../gesture-base.js";
import { fingerExtended } from "../utils/utils.js";

const DEFAULTS = {
  confidenceMin: 0.7,
  zoneX: [0.15, 0.85], // active region of the camera frame (normalised)
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
