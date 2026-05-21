import {
  GestureRecognizer,
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

import { isNearMode, getPinchResult }           from "./gestures/pinch-swipe.js";
import { getShoulderTapResult, resetShoulderTap } from "./gestures/shoulder-tap.js";
import { getHandsToHeadResult, resetHandsToHead } from "./gestures/hands-to-head.js";
import { getHandsToHipsResult, resetHandsToHips } from "./gestures/hands-to-hips.js";

const COOLDOWN_MS = 700;
const ACTIONS     = new Set(["right", "left", "up", "down"]);

const video      = document.getElementById("gc-video");
const canvas     = document.getElementById("gc-canvas");
const ctx        = canvas.getContext("2d");
const statusEl   = document.getElementById("gc-status");
const feedbackEl = document.getElementById("gc-feedback");

let recognizer     = null;
let poseRecognizer = null;
let lastVideoTime  = -1;
let lastActionTs   = 0;

async function init() {
  setStatus("Lade Modell…");

  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
  );

  [recognizer, poseRecognizer] = await Promise.all([
    GestureRecognizer.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 2,
    }),
    PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numPoses: 1,
    }),
  ]);

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

  const ts          = performance.now();
  const handResults = recognizer.recognizeForVideo(video, ts);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawHandLandmarks(handResults);

  let poseResults = null;
  try {
    poseResults = poseRecognizer.detectForVideo(video, ts);
    drawPoseLandmarks(poseResults);
  } catch (e) {
    console.warn("Pose:", e);
  }

  const nearMode = isNearMode(handResults);
  let result     = null;

  if (nearMode) {
    // Reset all body pose states when switching to near mode
    resetShoulderTap();
    resetHandsToHead();
    resetHandsToHips();
    result = getPinchResult(handResults, ts);
  } else if (poseResults?.landmarks?.length) {
    const lm = poseResults.landmarks[0];
    const r1 = getShoulderTapResult(lm, ts);
    const r2 = getHandsToHeadResult(lm, ts);
    const r3 = getHandsToHipsResult(lm, ts);

    // Actions take priority; fall back to the most advanced pending state
    result = ACTIONS.has(r1) ? r1
           : ACTIONS.has(r2) ? r2
           : ACTIONS.has(r3) ? r3
           : r1 || r2 || r3;
  } else {
    resetShoulderTap();
    resetHandsToHead();
    resetHandsToHips();
  }

  handleResult(result, ts);
  requestAnimationFrame(loop);
}

// ── Drawing ───────────────────────────────────────────────────────────────────

function drawHandLandmarks(results) {
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

const VISIBILITY_MIN_DRAW = 0.5;

function drawPoseLandmarks(poseResults) {
  if (!poseResults?.landmarks?.length) return;
  const drawing = new DrawingUtils(ctx);
  const lm      = poseResults.landmarks[0];

  drawing.drawConnectors(lm, PoseLandmarker.POSE_CONNECTIONS, {
    color: "rgba(255,255,255,0.25)",
    lineWidth: 1,
  });
  drawing.drawLandmarks(lm, {
    color: "rgba(255,255,255,0.6)",
    fillColor: "rgba(255,255,255,0.2)",
    lineWidth: 1,
    radius: 2,
  });

  // Shoulders (11, 12) and wrists (15, 16) highlighted in yellow
  for (const i of [11, 12, 15, 16]) {
    if (!lm[i] || (lm[i].visibility ?? 0) < VISIBILITY_MIN_DRAW) continue;
    drawing.drawLandmarks([lm[i]], {
      color: "#fff",
      fillColor: "#ffcc00",
      lineWidth: 1,
      radius: 5,
    });
  }
}

// ── Result handling ───────────────────────────────────────────────────────────

function handleResult(result, ts) {
  if (!result) { showFeedback(""); return; }

  const pending = { arming: "○", armed: "●", holding: "○" };
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

// ── UI helpers ────────────────────────────────────────────────────────────────

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
