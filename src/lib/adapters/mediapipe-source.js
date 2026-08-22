// Optional adapter: wraps MediaPipe model loading, camera access, and the
// video frame loop so an app doesn't have to hand-roll it to use the library.
// Not exported from lib/index.js on purpose: the core library has no DOM
// dependency, this adapter does (getUserMedia, <video>, rAF).
//
// Import it explicitly if you want it:
//   import { MediaPipeSource } from "../lib/adapters/mediapipe-source.js";
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

export class MediaPipeSource {
  #handRecognizer  = null;
  #poseRecognizer  = null;
  #video           = null;
  #listeners       = new Map();
  #lastVideoTime   = -1;
  #running         = false;

  // { hands, pose }: which models to load. { delegate }: "GPU" | "CPU".
  constructor({ hands = true, pose = false, delegate = "GPU" } = {}) {
    this._wantHands = hands;
    this._wantPose  = pose;
    this._delegate  = delegate;
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

    const ts = performance.now();
    const handResults = this.#handRecognizer?.recognizeForVideo(video, ts) ?? null;
    let poseResults = null;
    if (this.#poseRecognizer) {
      try { poseResults = this.#poseRecognizer.detectForVideo(video, ts); } catch (_) {}
    }

    this.#emit("frame", { handResults, poseResults }, ts);
    requestAnimationFrame(() => this.#loop());
  }

  // Emits an event to all registered listeners, catching and logging any errors.
  #emit(event, input, ts) {
    for (const cb of this.#listeners.get(event) ?? []) {
      try { cb(input, ts); } catch (e) { console.error(`MediaPipeSource: error in "${event}" handler`, e); }
    }
  }
}
