export class BaseGesture {
  get name() {
    throw new Error(`${this.constructor.name} must implement get name()`);
  }

  // "hands" → GestureRecognizer result, "pose" → PoseLandmarker result
  get requiredInput() {
    return "hands";
  }

  // Return null (inactive), { state } (building up), or { action } (fired)
  detect(input, timestamp) {
    return null;
  }

  reset() {}
}
