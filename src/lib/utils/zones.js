// Remaps a value from [min, max] to [0,1]. Clamped, so out-of-range inputs
// still land in [0,1] instead of overflowing.
export function clampRemap01(value, min, max) {
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

// Remaps a normalised camera-space point into [0,1] over an active sub-region
// ("zone") of the frame.
export function remapToZone(x, y, zoneX, zoneY) {
  return {
    x: clampRemap01(x, zoneX[0], zoneX[1]),
    y: clampRemap01(y, zoneY[0], zoneY[1]),
  };
}
