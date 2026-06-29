/**
 * Euclidean distance between two 2-D landmarks.
 * Both points must have numeric `x` and `y` properties (normalised 0–1).
 *
 * @param {{ x: number, y: number }} a
 * @param {{ x: number, y: number }} b
 * @returns {number}
 */
export function dist2D(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Returns true when a finger tip is higher on screen than its PIP joint
 * (smaller y value), indicating the finger is extended rather than curled.
 *
 * @param {Array<{x:number,y:number}>} lm  - hand landmark array
 * @param {number} tipIdx  - landmark index of the fingertip
 * @param {number} pipIdx  - landmark index of the PIP joint
 * @returns {boolean}
 */
export function fingerExtended(lm, tipIdx, pipIdx) {
  return lm[tipIdx].y < lm[pipIdx].y;
}

/**
 * Generic hold-state machine used by all body-pose gestures.
 *
 * @param {{ phase: string, startTs: number|null }} st  - mutable state object
 * @param {boolean} isActive   - whether the pose is currently held
 * @param {string}  action     - action name to return when the hold completes
 * @param {number}  ts         - current timestamp in ms (performance.now())
 * @param {number}  holdMs     - required hold duration in ms
 * @returns {string|null}  action when fired, "holding" while counting, null otherwise
 */
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
