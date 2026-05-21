// Body pose gesture (far mode): both wrists near nose → "up"

import { dist2D, processHoldState } from "./utils.js";

const POSE_HOLD      = 700;   // ms to hold the pose before triggering
const VISIBILITY_MIN = 0.5;
const HEAD_DIST      = 0.25;  // both wrists must be within this distance of the nose

const state = { phase: "idle", startTs: null };

// lm = pose landmarks array (poseResults.landmarks[0])
// Returns "up" when triggered, "holding" while counting, or null.
export function getHandsToHeadResult(lm, ts) {
  const vis = (i) => (lm[i]?.visibility ?? 0) >= VISIBILITY_MIN;

  const bothHead = vis(15) && vis(16) && vis(0)
                && dist2D(lm[15], lm[0]) < HEAD_DIST
                && dist2D(lm[16], lm[0]) < HEAD_DIST;

  return processHoldState(state, bothHead, "up", ts, POSE_HOLD);
}

export function resetHandsToHead() {
  state.phase   = "idle";
  state.startTs = null;
}
