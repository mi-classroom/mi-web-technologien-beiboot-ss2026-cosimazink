// Euclidean distance between two 2-D landmarks ({ x, y } in normalised coords).
export function dist2D(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// True when the fingertip is higher on screen than its PIP joint (finger extended).
export function fingerExtended(lm, tipIdx, pipIdx) {
  return lm[tipIdx].y < lm[pipIdx].y;
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
