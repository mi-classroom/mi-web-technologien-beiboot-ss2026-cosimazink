/**
 * GestureLibrary — registers gestures and dispatches events each frame.
 *
 * @example
 * import { GestureLibrary }    from "./lib/gesture-library.js";
 * import { PinchSwipeGesture } from "./lib/gestures/pinch-swipe.js";
 * import { ShoulderTapGesture } from "./lib/gestures/shoulder-tap.js";
 *
 * const lib = new GestureLibrary();
 *
 * lib
 *   .register(new PinchSwipeGesture())
 *   .register(new ShoulderTapGesture());
 *
 * // Listen to a specific gesture + action
 * lib.on("pinch-swipe:right", () => goToNextSlide());
 *
 * // Or listen to all events from a gesture
 * lib.on("shoulder-tap", ({ action, state }) => console.log(action ?? state));
 *
 * // Call once per video frame
 * lib.detect({ handResults, poseResults }, performance.now());
 */
export class GestureLibrary {
  #gestures  = new Map(); // name → BaseGesture instance
  #listeners = new Map(); // event → Set<callback>

  /**
   * Register a gesture detector.
   * Replaces any previously registered gesture with the same name.
   *
   * @param {import("./gesture-base.js").BaseGesture} gesture
   * @returns {GestureLibrary} this (chainable)
   */
  register(gesture) {
    this.#gestures.set(gesture.name, gesture);
    return this;
  }

  /**
   * Remove a previously registered gesture by name.
   *
   * @param {string} name
   * @returns {GestureLibrary} this (chainable)
   */
  unregister(name) {
    this.#gestures.delete(name);
    return this;
  }

  /**
   * Subscribe to a gesture event.
   *
   * Event name forms:
   * - `"gesture-name"`         fires on every non-null result (action or state)
   * - `"gesture-name:action"`  fires only when that specific action occurs
   *
   * @param {string}   event    - event name
   * @param {Function} callback - called with `{ action?, state? }`
   * @returns {GestureLibrary} this (chainable)
   */
  on(event, callback) {
    if (!this.#listeners.has(event)) this.#listeners.set(event, new Set());
    this.#listeners.get(event).add(callback);
    return this;
  }

  /**
   * Unsubscribe a previously registered callback.
   *
   * @param {string}   event
   * @param {Function} callback
   * @returns {GestureLibrary} this (chainable)
   */
  off(event, callback) {
    this.#listeners.get(event)?.delete(callback);
    return this;
  }

  /**
   * Run all registered gestures against the current frame's MediaPipe output.
   * Call this once per animation frame.
   *
   * @param {{ handResults: object, poseResults: object|null }} input
   * @param {number} timestamp - performance.now() timestamp of the current frame
   */
  detect({ handResults, poseResults }, timestamp) {
    for (const gesture of this.#gestures.values()) {
      const input = gesture.requiredInput === "pose" ? poseResults : handResults;
      if (!input) continue;

      const result = gesture.detect(input, timestamp);
      if (!result) continue;

      // Emit "gesture-name" with full result
      this.#emit(gesture.name, result);

      // Emit "gesture-name:action" shorthand when an action fires
      if (result.action) {
        this.#emit(`${gesture.name}:${result.action}`, result);
      }
    }
  }

  /**
   * Reset internal state of one or all gestures.
   * Useful when switching between gesture modes.
   *
   * @param {string} [name] - gesture name; omit to reset all
   * @returns {GestureLibrary} this (chainable)
   */
  reset(name) {
    if (name) {
      this.#gestures.get(name)?.reset();
    } else {
      for (const g of this.#gestures.values()) g.reset();
    }
    return this;
  }

  // ── private ───────────────────────────────────────────────────────────────

  #emit(event, data) {
    for (const cb of this.#listeners.get(event) ?? []) {
      try { cb(data); } catch (e) { console.error(`GestureLibrary: error in "${event}" handler`, e); }
    }
  }
}
