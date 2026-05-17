import {
  GestureRecognizer,  // ML model
  FilesetResolver,    // Helper: loads WebAssembly files
  DrawingUtils        // Helper: draws landmarks and skeleton on canvas
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

const LANDMARK_NAMES = [
  "WRIST",
  "THUMB_CMC", "THUMB_MCP", "THUMB_IP", "THUMB_TIP",      // 1-4 thumb
  "INDEX_MCP", "INDEX_PIP", "INDEX_DIP", "INDEX_TIP",     // 5-8 index finger
  "MIDDLE_MCP", "MIDDLE_PIP", "MIDDLE_DIP", "MIDDLE_TIP", // 9-12 middle finger
  "RING_MCP", "RING_PIP", "RING_DIP", "RING_TIP",         // 13-16 ring finger
  "PINKY_MCP", "PINKY_PIP", "PINKY_DIP", "PINKY_TIP"      // 17-20 pinky
];

const video   = document.getElementById("video");
const canvas  = document.getElementById("canvas");
const ctx     = canvas.getContext("2d");
const status  = document.getElementById("status");
const perfEl  = document.getElementById("perf");

let recognizer    = null;
let lastVideoTime = -1;
let lastT         = performance.now();
let frameCount    = 0;

// loads model
async function init() {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
  );

  // creates gesture recognizer 
  recognizer = await GestureRecognizer.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
      delegate: "GPU"
    },
    runningMode: "VIDEO",
    numHands: 2
  });

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

  // prevents the same frame from being analysed twice
  const now = video.currentTime;
  if (now === lastVideoTime) { requestAnimationFrame(predict); return; }
  lastVideoTime = now;

  // stops time to see how long the analysis takes
  const t0          = performance.now();
  const results     = recognizer.recognizeForVideo(video, Date.now());  // ML call returns raw data
  const inferenceMs = (performance.now() - t0).toFixed(1);

  // counts frames per second (FPS-counter)
  frameCount++;
  const elapsed = performance.now() - lastT;
  if (elapsed >= 1000) {
    const fps = (frameCount / elapsed * 1000).toFixed(1);
    perfEl.textContent = `fps: ${fps} | inference: ${inferenceMs} ms`;
    frameCount = 0;
    lastT      = performance.now();
  }

  //reset
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  renderResults(results);

  requestAnimationFrame(predict);
}

// shows skeleton on canvas
function renderResults(results) {
  const drawing  = new DrawingUtils(ctx);
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

    drawing.drawConnectors(
      landmarks,
      GestureRecognizer.HAND_CONNECTIONS,
      { color: label === "Left" ? "#00c8ff" : "#ff6b6b", lineWidth: 2 }
    );
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

// displays raw data
function updatePanel(side, data) {
  const noHand = document.getElementById(`no-hand-${side}`);
  const gestEl = document.getElementById(`gesture-${side}`);
  const lmEl   = document.getElementById(`landmarks-${side}`);

  if (!data) {
    noHand.style.display = "block";
    gestEl.textContent   = "";
    lmEl.innerHTML       = "";
    return;
  }

  noHand.style.display = "none";
  gestEl.textContent   = data.gesture
    ? `${data.gesture} (${(data.score * 100).toFixed(0)}%)`
    : "–";

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

init().catch(err => {
  status.textContent = `Fehler: ${err.message}`;
  console.error(err);
});
