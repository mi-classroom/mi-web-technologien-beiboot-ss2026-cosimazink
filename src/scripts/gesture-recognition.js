import {
  GestureRecognizer,  // ML model
  PoseLandmarker,     // Body pose model
  FilesetResolver,    // Helper: loads WebAssembly files
  DrawingUtils        // Helper: draws landmarks and skeleton on canvas
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

import { getPinchResult }                          from "./gestures/pinch-swipe.js";
import { getShoulderTapResult, resetShoulderTap }  from "./gestures/shoulder-tap.js";
import { getHandsToHeadResult, resetHandsToHead }  from "./gestures/hands-to-head.js";
import { getHandsToHipsResult, resetHandsToHips }  from "./gestures/hands-to-hips.js";

const LANDMARK_NAMES = [
  "WRIST",
  "THUMB_CMC", "THUMB_MCP", "THUMB_IP", "THUMB_TIP",      // 1-4 thumb
  "INDEX_MCP", "INDEX_PIP", "INDEX_DIP", "INDEX_TIP",     // 5-8 index finger
  "MIDDLE_MCP", "MIDDLE_PIP", "MIDDLE_DIP", "MIDDLE_TIP", // 9-12 middle finger
  "RING_MCP", "RING_PIP", "RING_DIP", "RING_TIP",         // 13-16 ring finger
  "PINKY_MCP", "PINKY_PIP", "PINKY_DIP", "PINKY_TIP"      // 17-20 pinky
];

const ACTIONS = new Set(["right", "left", "up", "down"]);

const HAND_LABELS = {
  right: "→ pinch right",
  left:  "← pinch left",
  up:    "↑ pinch up",
  down:  "↓ pinch down",
};
const BODY_LABELS = {
  right: "→ shoulder tap",
  left:  "← shoulder tap",
  up:    "↑ hands to head",
  down:  "↓ hands to hips",
};
const PENDING_LABELS = {
  arming:  "○ arming…",
  armed:   "● armed",
  holding: "○ holding…",
};

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

// Display timer: keeps fired gestures visible for 700ms
let actionTimer     = null;
let lockedLabel     = null; // set when an action fires, cleared after 700ms
let currentPending  = "–"; // updated every frame for pending states

// loads model
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

// turns camera on
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

// loop that analyses every frame
function predict() {
  if (video.readyState < 2) { requestAnimationFrame(predict); return; }

  const now = video.currentTime;
  if (now === lastVideoTime) { requestAnimationFrame(predict); return; }
  lastVideoTime = now;

  const ts          = performance.now();
  const results     = recognizer.recognizeForVideo(video, ts);
  const inferenceMs = (performance.now() - ts).toFixed(1);

  // FPS counter
  frameCount++;
  const elapsed = performance.now() - lastT;
  if (elapsed >= 1000) {
    const fps = (frameCount / elapsed * 1000).toFixed(1);
    perfEl.textContent = `fps: ${fps} | inference: ${inferenceMs} ms`;
    frameCount = 0;
    lastT      = performance.now();
  }

  // Pose detection for body gestures
  let poseResults = null;
  try { poseResults = poseRecognizer.detectForVideo(video, ts); } catch (e) { /* ignore */ }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  renderResults(results);
  drawPoseLandmarks(poseResults);

  // ── Gesture detection (display only, no actions triggered) ───────────────
  // minScale=0 → no distance gate, works at any distance from camera
  const pinchResult = getPinchResult(results, ts, 0);

  let bodyResult = null;
  if (poseResults?.landmarks?.length) {
    const lm = poseResults.landmarks[0];
    const r1 = getShoulderTapResult(lm, ts);
    const r2 = getHandsToHeadResult(lm, ts);
    const r3 = getHandsToHipsResult(lm, ts);
    bodyResult = ACTIONS.has(r1) ? r1
               : ACTIONS.has(r2) ? r2
               : ACTIONS.has(r3) ? r3
               : r1 || r2 || r3;
  }

  // Determine result + which label map to use
  let gestureResult = null;
  let labelMap      = HAND_LABELS;

  if (ACTIONS.has(pinchResult)) {
    gestureResult = pinchResult;
    labelMap      = HAND_LABELS;
  } else if (ACTIONS.has(bodyResult)) {
    gestureResult = bodyResult;
    labelMap      = BODY_LABELS;
  } else if (pinchResult) {
    gestureResult = pinchResult;   // pending pinch state (arming/armed)
    labelMap      = HAND_LABELS;
  } else if (bodyResult) {
    gestureResult = bodyResult;    // pending body state (holding)
    labelMap      = BODY_LABELS;
  }

  // Lock fired actions for 700ms so they stay readable
  if (ACTIONS.has(gestureResult)) {
    lockedLabel = labelMap[gestureResult];
    clearTimeout(actionTimer);
    actionTimer = setTimeout(() => { lockedLabel = null; }, 700);
  }

  // Pending states update immediately; fired actions are locked
  currentPending = PENDING_LABELS[gestureResult] ?? null;
  const displayText = lockedLabel ?? currentPending ?? "–";

  gestureDisplay.textContent = displayText;
  updateCustomGesture(displayText);

  requestAnimationFrame(predict);
}

// ── Drawing ───────────────────────────────────────────────────────────────────

// shows hand skeleton on canvas
function renderResults(results) {
  const drawing   = new DrawingUtils(ctx);
  const handsData = { Left: null, Right: null };

  for (let i = 0; i < results.landmarks.length; i++) {
    const landmarks  = results.landmarks[i];
    const worldmarks = results.worldLandmarks[i];
    const handedness = results.handednesses[i]?.[0]?.displayName ?? "?";
    const gesture    = results.gestures[i]?.[0]?.categoryName ?? "";
    const score      = results.gestures[i]?.[0]?.score ?? 0;

    // MediaPipe labels are mirrored relative to the mirrored canvas, so swap
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

// draws body skeleton on canvas
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

  // Nase (0), Schultern (11,12), Handgelenke (15,16), Hüften (23,24) gelb
  for (const i of [0, 11, 12, 15, 16, 23, 24]) {
    if (!lm[i] || (lm[i].visibility ?? 0) < 0.5) continue;
    drawing.drawLandmarks([lm[i]], {
      color: "#fff", fillColor: "#ffcc00", lineWidth: 1, radius: 5,
    });
  }
}

// ── Panels ────────────────────────────────────────────────────────────────────

// displays raw MediaPipe data per hand
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

  // MediaPipe built-in gesture + our custom gesture below it
  const mpLabel     = data.gesture ? `${data.gesture} (${(data.score * 100).toFixed(0)}%)` : "–";
  const customLabel = lockedLabel ?? currentPending ?? "";
  gestEl.innerHTML  = `<span>${mpLabel}</span>`
                    + (customLabel ? `<span class="custom-gesture">${customLabel}</span>` : "");

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

// keeps gesture-display and both panels in sync
function updateCustomGesture(text) {
  for (const side of ["left", "right"]) {
    const el = document.getElementById(`gesture-${side}`);
    if (!el) continue;
    const span = el.querySelector(".custom-gesture");
    if (span) span.textContent = text !== "–" ? text : "";
  }
}

init().catch(err => {
  status.textContent = `Fehler: ${err.message}`;
  console.error(err);
});
