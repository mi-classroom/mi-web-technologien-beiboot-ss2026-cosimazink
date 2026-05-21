// Body pose gesture (far mode): cross-shoulder tap → "right" | "left"
// Left wrist touches right shoulder  → "right"
// Right wrist touches left shoulder  → "left"

import { dist2D, processHoldState } from "./utils.js";

const POSE_HOLD         = 700;   // ms to hold the pose before triggering
const VISIBILITY_MIN    = 0.5;
const SHOULDER_TAP_DIST = 0.12;  // wrist-to-opposite-shoulder distance threshold

const state = {
  leftOnRight: { phase: "idle", startTs: null },  // left wrist → right shoulder → "right"
  rightOnLeft: { phase: "idle", startTs: null },  // right wrist → left shoulder  → "left"
};

// lm = pose landmarks array (poseResults.landmarks[0])
// Returns an action ("right"|"left"), "holding" while counting, or null.
export function getShoulderTapResult(lm, ts) {
  const vis = (i) => (lm[i]?.visibility ?? 0) >= VISIBILITY_MIN;

  const leftTap  = vis(15) && vis(12) && dist2D(lm[15], lm[12]) < SHOULDER_TAP_DIST;
  const rightTap = vis(16) && vis(11) && dist2D(lm[16], lm[11]) < SHOULDER_TAP_DIST;

  const r1 = processHoldState(state.leftOnRight, leftTap,  "right", ts, POSE_HOLD);
  const r2 = processHoldState(state.rightOnLeft, rightTap, "left",  ts, POSE_HOLD);

  return (r1 === "right" || r1 === "left") ? r1
       : (r2 === "right" || r2 === "left") ? r2
       : r1 || r2;
}

export function resetShoulderTap() {
  state.leftOnRight.phase = "idle"; state.leftOnRight.startTs = null;
  state.rightOnLeft.phase = "idle"; state.rightOnLeft.startTs = null;
}
