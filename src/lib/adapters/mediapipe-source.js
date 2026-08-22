// Optional adapter: wraps MediaPipe model loading, camera access, and the
// video frame loop so an app doesn't have to hand-roll it to use the library.
// Has a DOM/network dependency the core library doesn't (getUserMedia,
// <video>, rAF, MediaPipe CDN) — lives in its own file for that reason, but
// is re-exported from lib/index.js like everything else (see ADR 005):
//   import { GestureLibrary, MediaPipeSource } from "../lib/index.js";
//   const source = new MediaPipeSource({ hands: true, pose: false });
//   source.on("frame", (input, ts) => lib.detect(input, ts));
//   await source.start(videoEl);

import {
  GestureRecognizer,
  PoseLandmarker,
  FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

const VISION_WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";

const MODEL_URLS = {
  hands: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
  pose:  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
};

// Auto-exposure for detection (not the visible preview): the maximum
// correction per measurement, the frequency of measurements, and the
// limits to ensure that an almost black image (e.g. the camera is briefly obscured) does not
// result in an absurdly high gain.
const TARGET_LUMA           = 130;  // Target value for average brightness, 0–255
const BRIGHTNESS_MIN        = 0.7;
const BRIGHTNESS_MAX        = 2.2;
const BRIGHTNESS_SMOOTHING  = 0.15; // Proportion by which the factor approaches the target per measurement
const SAMPLE_EVERY_N_FRAMES = 10;   // Brightness changes slowly, don't measure every frame
const SAMPLE_SIZE           = { width: 16, height: 12 }; // Tiny, sufficient for the average

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export class MediaPipeSource {
  #handRecognizer  = null;
  #poseRecognizer  = null;
  #video           = null;
  #listeners       = new Map();
  #lastVideoTime   = -1;
  #running         = false;
  #procCanvas      = null; // offscreen, exposure-corrected copy of the frame
  #procCtx         = null;
  #sampleCanvas    = null; // tiny downscale only for brightness measurement
  #sampleCtx       = null;
  #brightness      = 1;    // current, smoothed correction factor
  #frameCount      = 0;

  // { hands, pose }: which models to load. { delegate }: "GPU" | "CPU".
  // { targetBrightness, contrast }: Detection runs on an automatically
  // exposure-corrected copy of the frame, not the raw video, visible <video> preview remains unchanged
  constructor({ hands = true, pose = false, delegate = "GPU", targetBrightness = TARGET_LUMA, contrast = 1.15 } = {}) {
    this._wantHands        = hands;
    this._wantPose         = pose;
    this._delegate         = delegate;
    this._targetBrightness = targetBrightness;
    this._contrast         = contrast;
  }

  // Registers a callback for an event. Currently only "frame" is supported.
  on(event, callback) {
    if (!this.#listeners.has(event)) this.#listeners.set(event, new Set());
    this.#listeners.get(event).add(callback);
    return this;
  }

  off(event, callback) {
    this.#listeners.get(event)?.delete(callback);
    return this;
  }

  // The canvas the exposure-corrected frame is drawn to — the same one that
  // actually goes into MediaPipe. Exposed so a consuming app can display it
  // (e.g. to visualize how strongly the correction is currently kicking in).
  // null until start() has completed.
  get debugCanvas() {
    return this.#procCanvas;
  }

  // Loads the requested models, requests the camera, and starts the frame
  // loop. `video` must be an HTMLVideoElement already in the DOM
  async start(video) {
    this.#video = video;

    const vision = await FilesetResolver.forVisionTasks(VISION_WASM_URL);

    const loads = [];
    if (this._wantHands) {
      loads.push(
        GestureRecognizer.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URLS.hands, delegate: this._delegate },
          runningMode: "VIDEO",
          numHands: 2,
        }).then((r) => { this.#handRecognizer = r; })
      );
    }
    if (this._wantPose) {
      loads.push(
        PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URLS.pose, delegate: this._delegate },
          runningMode: "VIDEO",
          numPoses: 1,
        }).then((r) => { this.#poseRecognizer = r; })
      );
    }
    await Promise.all(loads);

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" },
    });
    video.srcObject = stream;
    await new Promise((resolve) => video.addEventListener("loadeddata", resolve, { once: true }));

    this.#procCanvas = document.createElement("canvas");
    this.#procCanvas.width  = video.videoWidth;
    this.#procCanvas.height = video.videoHeight;
    this.#procCtx = this.#procCanvas.getContext("2d");

    this.#sampleCanvas = document.createElement("canvas");
    this.#sampleCanvas.width  = SAMPLE_SIZE.width;
    this.#sampleCanvas.height = SAMPLE_SIZE.height;
    this.#sampleCtx = this.#sampleCanvas.getContext("2d", { willReadFrequently: true });

    this.#running = true;
    requestAnimationFrame(() => this.#loop());
  }

  // Stops the frame loop and releases the camera. Call start() again to resume.
  stop() {
    this.#running = false;
    for (const track of this.#video?.srcObject?.getTracks() ?? []) track.stop();
  }

  #loop() {
    if (!this.#running) return;

    const video = this.#video;
    if (video.readyState < 2 || video.currentTime === this.#lastVideoTime) {
      requestAnimationFrame(() => this.#loop());
      return;
    }
    this.#lastVideoTime = video.currentTime;

    this.#frameCount++;
    if (this.#frameCount % SAMPLE_EVERY_N_FRAMES === 0) this.#updateBrightness();

    this.#procCtx.filter = `brightness(${this.#brightness.toFixed(2)}) contrast(${this._contrast})`;
    this.#procCtx.drawImage(video, 0, 0, this.#procCanvas.width, this.#procCanvas.height);

    const ts = performance.now();
    const handResults = this.#handRecognizer?.recognizeForVideo(this.#procCanvas, ts) ?? null;
    let poseResults = null;
    if (this.#poseRecognizer) {
      try { poseResults = this.#poseRecognizer.detectForVideo(this.#procCanvas, ts); } catch (_) {}
    }

    this.#emit("frame", { handResults, poseResults }, ts);
    requestAnimationFrame(() => this.#loop());
  }

  // Measures the average brightness of a tiny downscale of the
  // current frame and approaches the correction factor smoothly (not abruptly)
  // to the value that would bring it to targetBrightness — clamped,
  // so that a nearly black image doesn't lead to absurd amplification.
  #updateBrightness() {
    const { width, height } = SAMPLE_SIZE;
    this.#sampleCtx.drawImage(this.#video, 0, 0, width, height);
    const { data } = this.#sampleCtx.getImageData(0, 0, width, height);

    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; // Luma
    }
    const avgLuma = sum / (data.length / 4);

    const targetFactor = clamp(this._targetBrightness / Math.max(avgLuma, 1), BRIGHTNESS_MIN, BRIGHTNESS_MAX);
    this.#brightness += (targetFactor - this.#brightness) * BRIGHTNESS_SMOOTHING;
  }

  // Emits an event to all registered listeners, catching and logging any errors.
  #emit(event, input, ts) {
    for (const cb of this.#listeners.get(event) ?? []) {
      try { cb(input, ts); } catch (e) { console.error(`MediaPipeSource: error in "${event}" handler`, e); }
    }
  }
}
