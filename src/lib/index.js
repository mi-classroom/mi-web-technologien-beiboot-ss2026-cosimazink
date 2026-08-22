// Public API — import everything from here, not from individual files.

export { GestureLibrary } from "./gesture-library.js";
export { BaseGesture } from "./gesture-base.js";

export { PinchSwipeGesture } from "./gestures/pinch-swipe.js";
export { ShoulderTapGesture } from "./gestures/shoulder-tap.js";
export { HandsToHeadGesture } from "./gestures/hands-to-head.js";
export { HandsToHipsGesture } from "./gestures/hands-to-hips.js";
export { PinkyPointerGesture } from "./gestures/pinky-pointer.js";
export { PinkyClickGesture } from "./gestures/pinky-click.js";
export { TiltGesture } from "./gestures/tilt.js";
export { FingerCountGesture } from "./gestures/finger-count.js";

// Optional utilities — useful when writing custom gestures
export {
  dist2D,
  fingerExtended,
  fingerExtendedRadial,
  thumbExtended,
  visible,
  angle2D,
  processHoldState,
} from "./utils/utils.js";
export { selectHands, mirrorHandedness } from "./utils/hands.js";
export { remapToZone, clampRemap01 } from "./utils/zones.js";
export { Hysteresis } from "./utils/hysteresis.js";

// Optional adapter — pulls in a DOM/network dependency (camera, MediaPipe
// CDN) as soon as it's imported. Still re-exported here so every consumer
// goes through this one entry point; see ADR 005 for the trade-off.
export { MediaPipeSource } from "./adapters/mediapipe-source.js";
