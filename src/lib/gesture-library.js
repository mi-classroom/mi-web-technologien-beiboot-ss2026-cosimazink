export class GestureLibrary {
  #gestures  = new Map(); // name → BaseGesture instance
  #listeners = new Map(); // event → Set<callback>

  // Register a gesture. Replaces any existing gesture with the same name.
  register(gesture) {
    this.#gestures.set(gesture.name, gesture);
    return this;
  }

  unregister(name) {
    this.#gestures.delete(name);
    return this;
  }

  // Subscribe to a gesture event.
  // "gesture-name"         fires on every non-null result
  // "gesture-name:action"  fires only when that specific action occurs
  on(event, callback) {
    if (!this.#listeners.has(event)) this.#listeners.set(event, new Set());
    this.#listeners.get(event).add(callback);
    return this;
  }

  off(event, callback) {
    this.#listeners.get(event)?.delete(callback);
    return this;
  }

  // Call once per animation frame with the current MediaPipe results.
  detect({ handResults, poseResults }, timestamp) {
    for (const gesture of this.#gestures.values()) {
      const input = gesture.requiredInput === "pose" ? poseResults : handResults;
      if (!input) continue;

      const result = gesture.detect(input, timestamp);
      if (!result) continue;

      this.#emit(gesture.name, result);
      if (result.action) this.#emit(`${gesture.name}:${result.action}`, result);
    }
  }

  // Reset internal state of one gesture (by name) or all gestures (no arg).
  reset(name) {
    if (name) {
      this.#gestures.get(name)?.reset();
    } else {
      for (const g of this.#gestures.values()) g.reset();
    }
    return this;
  }

  #emit(event, data) {
    for (const cb of this.#listeners.get(event) ?? []) {
      try { cb(data); } catch (e) { console.error(`GestureLibrary: error in "${event}" handler`, e); }
    }
  }
}
