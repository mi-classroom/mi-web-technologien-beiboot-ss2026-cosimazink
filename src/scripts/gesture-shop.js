import {
  GestureRecognizer,
  PoseLandmarker,
  FilesetResolver,
  DrawingUtils,
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

const video = document.getElementById("gs-video");
const canvas = document.getElementById("gs-canvas");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("gs-status");
const feedbackEl = document.getElementById("gs-feedback");
const cursorEl = document.getElementById("gs-cursor");

// ── Gesture library ───────────────────────────────────────────────────────────

const lib = new GestureLibrary();
lib
  .register(new PinchSwipeGesture())
  .register(new ShoulderTapGesture())
  .register(new HandsToHeadGesture())
  .register(new HandsToHipsGesture())
  .register(new PinkyPointerGesture())
  .register(new PinkyClickGesture({ cooldownMs: 1500 }));

const SCROLL_PX = 420;

// Scroll / navigation
lib.on("pinch-swipe:up", () => {
  window.scrollBy({ top: -SCROLL_PX, behavior: "smooth" });
  showFeedback("↑", 700);
});
lib.on("pinch-swipe:down", () => {
  window.scrollBy({ top: SCROLL_PX, behavior: "smooth" });
  showFeedback("↓", 700);
});
lib.on("pinch-swipe:left", () => {
  history.back();
  showFeedback("← zurück", 700);
});
lib.on("pinch-swipe:right", () => {
  history.forward();
  showFeedback("→ vor", 700);
});
lib.on("shoulder-tap:left", () => {
  history.back();
  showFeedback("← zurück", 700);
});
lib.on("shoulder-tap:right", () => {
  history.forward();
  showFeedback("→ vor", 700);
});
lib.on("hands-to-head:up", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
  showFeedback("↑↑ oben", 700);
});
lib.on("hands-to-hips:down", () => {
  window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  showFeedback("↓↓ unten", 700);
});

// State feedback
lib.on("pinch-swipe", ({ state }) => {
  if (state === "arming") showFeedback("○");
  if (state === "armed") showFeedback("●");
});
lib.on("shoulder-tap", ({ state }) => {
  if (state) showFeedback("○");
});
lib.on("hands-to-head", ({ state }) => {
  if (state) showFeedback("○");
});
lib.on("hands-to-hips", ({ state }) => {
  if (state) showFeedback("○");
});

// Laser cursor
lib.on("pinky-pointer", ({ x, y }) => {
  cursorEl.style.display = "block";
  cursorEl.style.left = `${(1 - x) * 100}vw`;
  cursorEl.style.top = `${y * 100}vh`;
});
lib.on("pinky-pointer:idle", () => {
  cursorEl.style.display = "none";
});

// Pinky click — find element under cursor and click it
lib.on("pinky-click:click", ({ x, y }) => {
  const screenX = (1 - x) * window.innerWidth;
  const screenY = y * window.innerHeight;
  showFeedback("● click", 600);
  cursorEl.classList.add("clicking");
  setTimeout(() => cursorEl.classList.remove("clicking"), 200);
  cursorEl.style.display = "none";
  const target = document.elementFromPoint(screenX, screenY);
  cursorEl.style.display = "block";
  if (target) target.click();
});

// ── MediaPipe ─────────────────────────────────────────────────────────────────

async function init() {
  setStatus("Lade…");
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm",
  );

  const [handRecognizer, poseRecognizer] = await Promise.all([
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

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 640, height: 480, facingMode: "user" },
  });
  video.srcObject = stream;
  video.addEventListener("loadeddata", () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    setStatus("Aktiv");
    requestAnimationFrame(loop.bind(null, handRecognizer, poseRecognizer));
  });
}

let lastVideoTime = -1;

function loop(handRecognizer, poseRecognizer) {
  if (video.readyState < 2 || video.currentTime === lastVideoTime) {
    requestAnimationFrame(loop.bind(null, handRecognizer, poseRecognizer));
    return;
  }
  lastVideoTime = video.currentTime;

  const ts = performance.now();
  const handResults = handRecognizer.recognizeForVideo(video, ts);
  let poseResults = null;
  try {
    poseResults = poseRecognizer.detectForVideo(video, ts);
  } catch (_) {}

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const drawing = new DrawingUtils(ctx);
  for (let i = 0; i < handResults.landmarks.length; i++) {
    const lm = handResults.landmarks[i];
    const raw = handResults.handednesses[i]?.[0]?.displayName ?? "?";
    const label = raw === "Left" ? "Right" : "Left";
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
  if (poseResults?.landmarks?.length) {
    drawing.drawConnectors(
      poseResults.landmarks[0],
      PoseLandmarker.POSE_CONNECTIONS,
      {
        color: "rgba(255,255,255,0.15)",
        lineWidth: 1,
      },
    );
  }

  lib.detect({ handResults, poseResults }, ts);
  requestAnimationFrame(loop.bind(null, handRecognizer, poseRecognizer));
}

// ── UI ────────────────────────────────────────────────────────────────────────

let feedbackTimer = null;
function showFeedback(text, clearAfterMs = 0) {
  feedbackEl.textContent = text;
  clearTimeout(feedbackTimer);
  if (clearAfterMs > 0)
    feedbackTimer = setTimeout(() => {
      feedbackEl.textContent = "";
    }, clearAfterMs);
}
function setStatus(text) {
  statusEl.textContent = text;
}

init().catch((err) => {
  setStatus(`Fehler: ${err.message}`);
  console.error(err);
});
