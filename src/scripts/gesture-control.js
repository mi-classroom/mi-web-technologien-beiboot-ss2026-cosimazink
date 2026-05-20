import {
  GestureRecognizer,
  FilesetResolver,
  DrawingUtils,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

// One Euro Filter: Smooths noisy 1-D signals
class OneEuroFilter {
  constructor(minCutoff = 1.0, beta = 0.05, dCutoff = 1.0) {
    this._minCutoff = minCutoff;
    this._beta      = beta;
    this._dCutoff   = dCutoff;
    this._x         = null;
    this._dx        = 0;
    this._lastT     = null;
  }

  _alpha(freq, cutoff) {
    const te  = 1 / freq;
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / te);
  }

  filter(x, timestamp) {
    if (this._lastT === null) {
      this._lastT = timestamp;
      this._x     = x;
      return x;
    }
    const dt   = Math.max((timestamp - this._lastT) / 1000, 1e-6);
    const freq = 1 / dt;
    this._lastT = timestamp;

    const dx = (x - this._x) * freq;
    this._dx += this._alpha(freq, this._dCutoff) * (dx - this._dx);

    const cutoff = this._minCutoff + this._beta * Math.abs(this._dx);
    this._x += this._alpha(freq, cutoff) * (x - this._x);
    return this._x;
  }
}

const MIN_CUTOFF         = 1.0;   // Hz – One Euro Filter
const BETA               = 0.05;  // One Euro Filter speed coefficient

const COOLDOWN_MS        = 700;   // min interval between two navigation actions
const CONFIDENCE_MIN     = 0.7;   // handedness score below this → skip hand

const PINCH_THRESHOLD    = 0.08;  // max thumb–index distance to count as pinch
const PINCH_HOLD_MS      = 500;   // hold pinch this long before movement is tracked

// Direction detection
const AXIS_LOCK_THRESHOLD = 0.04; // accumulated movement at which the axis is locked
const AXIS_RATIO          = 2.5;  // dominant axis must be this much larger to lock
const PINCH_MOVE_DELTA    = 0.13; // accumulated movement on the locked axis to trigger

const video      = document.getElementById("gc-video");
const canvas     = document.getElementById("gc-canvas");
const ctx        = canvas.getContext("2d");
const statusEl   = document.getElementById("gc-status");
const feedbackEl = document.getElementById("gc-feedback");

let recognizer    = null;
let lastVideoTime = -1;
let lastActionTs  = 0;

// Per-hand pinch state machine
const makePinchState = () => ({
  phase:      "idle",   // "idle" | "arming" | "armed"
  armedAt:    null,
  prevX:      null,
  prevY:      null,
  accumX:     0,
  accumY:     0,
  lockedAxis: null,     // "h" (horizontal) | "v" (vertical) | null
});
const pinchState = { Left: makePinchState(), Right: makePinchState() };

// One Euro Filters for the pinch midpoint, one per axis per hand
const makeHandFilters = () => ({
  pinchX: new OneEuroFilter(MIN_CUTOFF, BETA),
  pinchY: new OneEuroFilter(MIN_CUTOFF, BETA),
});
const hf = { Left: makeHandFilters(), Right: makeHandFilters() };

async function init() {
  setStatus("Lade Modell…");

  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
  );
  recognizer = await GestureRecognizer.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numHands: 2,
  });

  setStatus("Kamera…");
  await startCamera();
}

async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480, facingMode: "user" },
  });
  video.srcObject = stream;
  video.addEventListener("loadeddata", () => {
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    setStatus("Aktiv");
    requestAnimationFrame(loop);
  });
}

function loop() {
  if (video.readyState < 2) { requestAnimationFrame(loop); return; }

  const now = video.currentTime;
  if (now === lastVideoTime) { requestAnimationFrame(loop); return; }
  lastVideoTime = now;

  const ts      = Date.now();
  const results = recognizer.recognizeForVideo(video, ts);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawLandmarks(results);
  processGestures(results, ts);

  requestAnimationFrame(loop);
}

function drawLandmarks(results) {
  const drawing = new DrawingUtils(ctx);
  for (let i = 0; i < results.landmarks.length; i++) {
    const lm         = results.landmarks[i];
    const handedness = results.handednesses[i]?.[0]?.displayName ?? "?";
    const label      = handedness === "Left" ? "Right" : "Left";

    drawing.drawConnectors(lm, GestureRecognizer.HAND_CONNECTIONS, {
      color: label === "Left" ? "#00c8ff" : "#ff6b6b",
      lineWidth: 2,
    });
    drawing.drawLandmarks(lm, {
      color: "#fff",
      fillColor: label === "Left" ? "#00c8ff" : "#ff6b6b",
      lineWidth: 1,
      radius: 3,
    });
  }
}

// Gesture processing 
function processGestures(results, ts) {
  const hands = { Left: null, Right: null };
  for (let i = 0; i < results.landmarks.length; i++) {
    const score = results.handednesses[i]?.[0]?.score ?? 0;
    if (score < CONFIDENCE_MIN) continue;
    const handedness = results.handednesses[i][0].displayName;
    const label      = handedness === "Left" ? "Right" : "Left";
    hands[label]     = results.landmarks[i];
  }

  const result = detectGesture(hands, ts);
  handleResult(result, ts);
}

// return first action found, or the most advanced pending state
function detectGesture(hands, ts) {
  let status = null;

  for (const label of ["Left", "Right"]) {
    if (!hands[label]) { resetPinch(label); continue; }

    const r = detectPinch(hands[label], hf[label], ts, label);

    if (r === "right" || r === "left" || r === "up" || r === "down") return r;
    if (r === "armed" || (r === "arming" && status !== "armed")) status = r;
  }

  return status;
}

// Pinch state machine
function detectPinch(lm, f, ts, label) {
  const isPinching = dist2D(lm[4], lm[8]) < PINCH_THRESHOLD;
  const st         = pinchState[label];

  if (!isPinching) { resetPinch(label); return null; }

  const px = f.pinchX.filter((lm[4].x + lm[8].x) / 2, ts);
  const py = f.pinchY.filter((lm[4].y + lm[8].y) / 2, ts);

  // Arming
  if (st.phase === "idle") {
    st.phase   = "arming";
    st.armedAt = ts;
    st.prevX   = px;
    st.prevY   = py;
    return "arming";
  }

  if (st.phase === "arming") {
    st.prevX = px; 
    st.prevY = py;
    if (ts - st.armedAt < PINCH_HOLD_MS) return "arming";
    st.phase  = "armed";
    st.accumX = 0;
    st.accumY = 0;
    return "armed";
  }

  // Armed
  st.accumX += px - st.prevX;
  st.accumY += py - st.prevY;
  st.prevX   = px;
  st.prevY   = py;

  const ax = Math.abs(st.accumX);
  const ay = Math.abs(st.accumY);

  // Try to lock axis if not yet locked
  if (!st.lockedAxis) {
    if (ax >= AXIS_LOCK_THRESHOLD && ax >= ay * AXIS_RATIO) st.lockedAxis = "h";
    else if (ay >= AXIS_LOCK_THRESHOLD && ay >= ax * AXIS_RATIO) st.lockedAxis = "v";
  }

  // Only the locked axis can trigger; ignore the other axis entirely
  if (st.lockedAxis === "h" && ax >= PINCH_MOVE_DELTA) {
    const dir     = st.accumX < 0 ? "right" : "left";
    st.accumX     = 0;
    st.accumY     = 0;
    st.lockedAxis = null; // reset so next movement can pick a new direction
    return dir;
  }

  if (st.lockedAxis === "v" && ay >= PINCH_MOVE_DELTA) {
    const dir     = st.accumY > 0 ? "down" : "up";
    st.accumX     = 0;
    st.accumY     = 0;
    st.lockedAxis = null;
    return dir;
  }

  return "armed";
}

function resetPinch(label) {
  const st      = pinchState[label];
  st.phase      = "idle";
  st.armedAt    = null;
  st.prevX      = null;
  st.prevY      = null;
  st.accumX     = 0;
  st.accumY     = 0;
  st.lockedAxis = null;
}

// 2D distance between two landmarks
function dist2D(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Result handling
function handleResult(result, ts) {
  if (!result) { showFeedback(""); return; }

  const pending = { arming: "○", armed: "●" };
  if (result in pending) { showFeedback(pending[result]); return; }

  if (ts - lastActionTs >= COOLDOWN_MS) {
    lastActionTs = ts;
    showFeedback(gestureLabel(result) + " ✓", 700);
    switch (result) {
      case "right": window.Reveal?.right(); break;
      case "left":  window.Reveal?.left();  break;
      case "up":    window.Reveal?.up();    break;
      case "down":  window.Reveal?.down();  break;
    }
  }
}

// UI helpers
let feedbackTimer = null;

function showFeedback(text, clearAfterMs = 0) {
  feedbackEl.textContent = text;
  clearTimeout(feedbackTimer);
  if (clearAfterMs > 0) {
    feedbackTimer = setTimeout(() => { feedbackEl.textContent = ""; }, clearAfterMs);
  }
}

function setStatus(text) { statusEl.textContent = text; }

function gestureLabel(g) {
  return { right: "→", left: "←", up: "↑", down: "↓" }[g] ?? g;
}

// Start
init().catch((err) => {
  setStatus(`Fehler: ${err.message}`);
  console.error(err);
});
