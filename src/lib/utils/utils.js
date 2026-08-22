// Euclidean distance between two 2-D landmarks ({ x, y } in normalised coords).
export function dist2D(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// True when the fingertip is higher on screen than its PIP joint (finger extended).
// Assumes the hand roughly points upward — breaks down if the hand is rotated.
export function fingerExtended(lm, tipIdx, pipIdx) {
  return lm[tipIdx].y < lm[pipIdx].y;
}

// Rotation-invariant version: extended when the tip is farther from the wrist
// than the PIP joint is. Works regardless of how the hand is rotated.
export function fingerExtendedRadial(lm, tipIdx, pipIdx, wristIdx = 0) {
  return dist2D(lm[tipIdx], lm[wristIdx]) > dist2D(lm[pipIdx], lm[wristIdx]);
}

// The thumb doesn't curl toward the wrist the way the other four fingers do.
// Extended when the tip is far from the index finger's base, tucked in, it
// ends up close to it.
export function thumbExtended(lm, extendMin = 0.10) {
  return dist2D(lm[4], lm[5]) > extendMin;
}

// True when a pose landmark's visibility score meets the minimum.
export function visible(lm, idx, min) {
  return (lm[idx]?.visibility ?? 0) >= min;
}

// Angle in degrees of the vector from `a` to `b`, relative to horizontal.
// 0° = pointing right, 90° = pointing up (image y grows downward, so we flip it).
export function angle2D(a, b) {
  return Math.atan2(-(b.y - a.y), b.x - a.x) * (180 / Math.PI);
}

// Hold-state machine for body-pose gestures.
// Returns action name when hold completes, "holding" while counting, null otherwise.
export function processHoldState(st, isActive, action, ts, holdMs) {
  if (!isActive) { st.phase = "idle"; st.startTs = null; return null; }
  if (st.phase === "fired")   return null;
  if (st.phase === "idle")    { st.phase = "holding"; st.startTs = ts; return "holding"; }
  if (st.phase === "holding") {
    if (ts - st.startTs >= holdMs) { st.phase = "fired"; return action; }
    return "holding";
  }
  return null;
}
