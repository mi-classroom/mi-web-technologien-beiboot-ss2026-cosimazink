export function dist2D(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Generic hold-state machine used by all body pose gestures.
// st      = { phase: "idle"|"holding"|"fired", startTs: null|number }
// holdMs  = how long the pose must be held before firing
// Returns: action string when fired, "holding" while counting, null otherwise.
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
