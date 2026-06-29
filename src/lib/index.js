// Public API — import everything from here, not from individual files.

export { GestureLibrary }     from "./gesture-library.js";
export { BaseGesture }        from "./gesture-base.js";

export { PinchSwipeGesture }  from "./gestures/pinch-swipe.js";
export { ShoulderTapGesture } from "./gestures/shoulder-tap.js";
export { HandsToHeadGesture } from "./gestures/hands-to-head.js";
export { HandsToHipsGesture } from "./gestures/hands-to-hips.js";

// Optional utility — useful when writing custom gestures
export { dist2D } from "./utils/utils.js";
