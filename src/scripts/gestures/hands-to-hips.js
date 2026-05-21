// Body pose gesture (far mode): both wrists near own hips → "down"
// Left wrist near left hip AND right wrist near right hip.

import { dist2D, processHoldState } from "./utils.js";

const POSE_HOLD      = 700;   // ms to hold the pose before triggering
const VISIBILITY_MIN = 0.5;
const HIP_DIST       = 0.20;  // each wrist must be within this distance of its same-side hip

const state = { phase: "idle", startTs: null };

// lm = pose landmarks array (poseResults.landmarks[0])
// Returns "down" when triggered, "holding" while counting, or null.
export function getHandsToHipsResult(lm, ts) {
  const vis = (i) => (lm[i]?.visibility ?? 0) >= VISIBILITY_MIN;

  const bothHip = vis(15) && vis(16) && vis(23) && vis(24)
               && dist2D(lm[15], lm[23]) < HIP_DIST
               && dist2D(lm[16], lm[24]) < HIP_DIST;

  return processHoldState(state, bothHip, "down", ts, POSE_HOLD);
}

export function resetHandsToHips() {
  state.phase   = "idle";
  state.startTs = null;
}
