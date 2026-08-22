import {
  GestureRecognizer,
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

import {
  GestureLibrary,
  PinchSwipeGesture,
  ShoulderTapGesture,
  HandsToHeadGesture,
  HandsToHipsGesture,
  PinkyPointerGesture,
  PinkyClickGesture,
} from "../lib/index.js";

const LANDMARK_NAMES = [
  "WRIST",
  "THUMB_CMC", "THUMB_MCP", "THUMB_IP", "THUMB_TIP",
  "INDEX_MCP", "INDEX_PIP", "INDEX_DIP", "INDEX_TIP",
  "MIDDLE_MCP", "MIDDLE_PIP", "MIDDLE_DIP", "MIDDLE_TIP",
  "RING_MCP", "RING_PIP", "RING_DIP", "RING_TIP",
  "PINKY_MCP", "PINKY_PIP", "PINKY_DIP", "PINKY_TIP"
];

const lib = new GestureLibrary();
lib
  .register(new PinchSwipeGesture({ minScale: 0 }))
  .register(new ShoulderTapGesture())
  .register(new HandsToHeadGesture())
  .register(new HandsToHipsGesture())
  .register(new PinkyPointerGesture())
  .register(new PinkyClickGesture());

const ACTION_LABELS = {
  "pinch-swipe:right":  "→ Pinch Swipe",
  "pinch-swipe:left":   "← Pinch Swipe",
  "pinch-swipe:up":     "↑ Pinch Swipe",
  "pinch-swipe:down":   "↓ Pinch Swipe",
  "shoulder-tap:right": "→ Schulter-Tap",
  "shoulder-tap:left":  "← Schulter-Tap",
  "hands-to-head:up":   "↑ Hände zum Kopf",
  "hands-to-hips:down": "↓ Hände zur Hüfte",
  "pinky-click:click":  "● Pinky Click",
};
const STATE_LABELS = {
  arming:   "○ Pinch lädt…",
  armed:    "● Pinch bereit",
  holding:  "○ hält…",
  pointing: "◉ Pinky Pointer",
};

let activeLabel = null;
let clearTimer  = null;

function showLabel(text, ttl) {
  activeLabel = text;
  clearTimeout(clearTimer);
  clearTimer = setTimeout(() => { activeLabel = null; }, ttl);
}

for (const [event, label] of Object.entries(ACTION_LABELS)) {
  lib.on(event, () => showLabel(label, 1500));
}

lib.on("pinch-swipe",   ({ state }) => { if (state) showLabel(STATE_LABELS[state] ?? state, 300); });
lib.on("shoulder-tap",  ({ state }) => { if (state) showLabel(STATE_LABELS[state] ?? state, 300); });
lib.on("hands-to-head", ({ state }) => { if (state) showLabel("○ Hände zum Kopf…",          300); });
lib.on("hands-to-hips", ({ state }) => { if (state) showLabel("○ Hände zur Hüfte…",          300); });
lib.on("pinky-pointer", ({ state }) => { if (state) showLabel(STATE_LABELS.pointing,          300); });

const video          = document.getElementById("video");
const canvas         = document.getElementById("canvas");
const ctx            = canvas.getContext("2d");
const status         = document.getElementById("status");
const perfEl         = document.getElementById("perf");
const gestureDisplay = document.getElementById("gesture-display");

let recognizer     = null;
let poseRecognizer = null;
let lastVideoTime  = -1;
let lastT          = performance.now();
let frameCount     = 0;

async function init() {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
  );

  [recognizer, poseRecognizer] = await Promise.all([
    GestureRecognizer.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numHands: 2
    }),
    PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
        delegate: "GPU"
      },
      runningMode: "VIDEO",
      numPoses: 1
    }),
  ]);

  status.textContent = "Loaded model. Starting camera…";
  await startCamera();
}

async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480, facingMode: "user" }
  });
  video.srcObject = stream;
  video.addEventListener("loadeddata", () => {
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    status.textContent = "Live";
    requestAnimationFrame(predict);
  });
}

function predict() {
  // Prevents multiple predictions on the same frame
  if (video.readyState < 2) { requestAnimationFrame(predict); return; }

  const now = video.currentTime;
  if (now === lastVideoTime) { requestAnimationFrame(predict); return; }
  lastVideoTime = now;

  const ts          = performance.now();
  const results     = recognizer.recognizeForVideo(video, ts);
  const inferenceMs = (performance.now() - ts).toFixed(1);

  frameCount++;
  const elapsed = performance.now() - lastT;
  if (elapsed >= 1000) {
    const fps = (frameCount / elapsed * 1000).toFixed(1);
    perfEl.textContent = `fps: ${fps} | inference: ${inferenceMs} ms`;
    frameCount = 0;
    lastT      = performance.now();
  }

  let poseResults = null;
  try { poseResults = poseRecognizer.detectForVideo(video, ts); } catch (e) { /* ignore */ }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  renderResults(results);
  drawPoseLandmarks(poseResults);

  // Results into gesture library for gesture detection
  lib.detect({ handResults: results, poseResults }, ts);

  gestureDisplay.textContent = activeLabel ?? "–";

  requestAnimationFrame(predict);
}

// Draws hand landmarks and gesture labels onto the canvas, and updates the left/right panels
function renderResults(results) {
  const drawing   = new DrawingUtils(ctx);
  const handsData = { Left: null, Right: null };

  for (let i = 0; i < results.landmarks.length; i++) {
    const landmarks  = results.landmarks[i];
    const worldmarks = results.worldLandmarks[i];
    const handedness = results.handednesses[i]?.[0]?.displayName ?? "?";
    const gesture    = results.gestures[i]?.[0]?.categoryName ?? "";
    const score      = results.gestures[i]?.[0]?.score ?? 0;

    // MediaPipe labels are mirrored relative to the canvas — swap sides
    const label = handedness === "Left" ? "Right" : "Left";
    handsData[label] = { landmarks, worldmarks, gesture, score };

    drawing.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, {
      color: label === "Left" ? "#00c8ff" : "#ff6b6b", lineWidth: 2
    });
    drawing.drawLandmarks(landmarks, {
      color: "#fff",
      fillColor: label === "Left" ? "#00c8ff" : "#ff6b6b",
      lineWidth: 1,
      radius: 3
    });
  }

  updatePanel("left",  handsData.Right);
  updatePanel("right", handsData.Left);
}

// Draws pose landmarks onto the canvas, highlighting key points (nose, shoulders, wrists, hips)
function drawPoseLandmarks(poseResults) {
  if (!poseResults?.landmarks?.length) return;
  const drawing = new DrawingUtils(ctx);
  const lm      = poseResults.landmarks[0];

  drawing.drawConnectors(lm, PoseLandmarker.POSE_CONNECTIONS, {
    color: "rgba(255,255,255,0.25)", lineWidth: 1,
  });
  drawing.drawLandmarks(lm, {
    color: "rgba(255,255,255,0.6)",
    fillColor: "rgba(255,255,255,0.2)",
    lineWidth: 1,
    radius: 2,
  });

  // Highlight key points: nose (0), shoulders (11,12), wrists (15,16), hips (23,24)
  for (const i of [0, 11, 12, 15, 16, 23, 24]) {
    if (!lm[i] || (lm[i].visibility ?? 0) < 0.5) continue;
    drawing.drawLandmarks([lm[i]], {
      color: "#fff", fillColor: "#ffcc00", lineWidth: 1, radius: 5,
    });
  }
}

// Updates the left/right panels with the current gesture and landmark data
function updatePanel(side, data) {
  const noHand = document.getElementById(`no-hand-${side}`);
  const gestEl = document.getElementById(`gesture-${side}`);
  const lmEl   = document.getElementById(`landmarks-${side}`);

  if (!data) {
    noHand.style.display = "block";
    gestEl.innerHTML     = "";
    lmEl.innerHTML       = "";
    return;
  }

  noHand.style.display = "none";

  gestEl.textContent = activeLabel ?? data.gesture ?? "–";

  lmEl.innerHTML = data.landmarks
    .map((lm, i) => {
      const wlm = data.worldmarks[i];
      return `<div>
        <span class="name">${i.toString().padStart(2, "0")} ${LANDMARK_NAMES[i]}</span>
        <span class="coords">x:${lm.x.toFixed(4)} y:${lm.y.toFixed(4)} z:${lm.z.toFixed(4)}</span>
        <span class="world-coords">w(m) x:${wlm.x.toFixed(3)} y:${wlm.y.toFixed(3)} z:${wlm.z.toFixed(3)}</span>
      </div>`;
    })
    .join("");
}

// Error handling
init().catch(err => {
  status.textContent = `Fehler: ${err.message}`;
  console.error(err);
});
