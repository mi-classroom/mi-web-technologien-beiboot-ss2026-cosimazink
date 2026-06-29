/**
 * BaseGesture — interface that every gesture must implement.
 *
 * Extend this class to create a custom gesture:
 *
 * @example
 * import { BaseGesture } from "./gesture-base.js";
 *
 * export class MyGesture extends BaseGesture {
 *   get name() { return "my-gesture"; }
 *   get requiredInput() { return "hands"; }
 *
 *   detect(input, timestamp) {
 *     // analyse landmarks …
 *     return { action: "my-action" }; // or { state: "pending" } or null
 *   }
 *
 *   reset() { this._state = "idle"; }
 * }
 */
export class BaseGesture {
  /**
   * Unique identifier for this gesture. Used as event name.
   * @returns {string}
   */
  get name() {
    throw new Error(`${this.constructor.name} must implement get name()`);
  }

  /**
   * Which MediaPipe result object this gesture needs.
   * "hands" → receives the GestureRecognizer result
   * "pose"  → receives the PoseLandmarker result
   * @returns {"hands"|"pose"}
   */
  get requiredInput() {
    return "hands";
  }

  /**
   * Analyse one video frame and return the current gesture state.
   *
   * Return values:
   * - `null`                  – gesture is inactive
   * - `{ state: string }`    – gesture is building up (e.g. "arming", "holding")
   * - `{ action: string }`   – gesture has fired (e.g. "right", "left", "up", "down")
   *
   * @param {object} input     - MediaPipe result (handResults or poseResults)
   * @param {number} timestamp - current time in ms (performance.now())
   * @returns {{ action?: string, state?: string }|null}
   */
  detect(input, timestamp) {
    return null;
  }

  /**
   * Reset all internal state (e.g. when switching gesture modes).
   */
  reset() {}
}
