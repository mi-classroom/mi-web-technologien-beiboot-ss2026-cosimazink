import { GestureLibrary, TiltGesture, selectHands, fingerExtendedRadial, thumbExtended, angle2D } from "../lib/index.js";
import { MediaPipeSource } from "../lib/adapters/mediapipe-source.js";
import { REGISTERS } from "./gestures/index.js";

function freqFromValue(base, value) {
  return base * Math.pow(2, value); // exponential = linear in perceived pitch, one octave per register
}

const video       = document.getElementById("video");
const canvas      = document.getElementById("canvas");
const ctx         = canvas.getContext("2d");
const registerEl  = document.getElementById("register");
const noteEl      = document.getElementById("note");
const toneStateEl = document.getElementById("tone-state");
const statusEl    = document.getElementById("status");
const unlockHint  = document.getElementById("unlock-hint");
const debugEl     = document.getElementById("debug");

let audioCtx, osc, gain, audioReady = false;

// Initialize the audio context and oscillator for generating tones
function initAudio() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  osc  = audioCtx.createOscillator();
  gain = audioCtx.createGain();
  gain.gain.value = 0; // starts silent
  osc.type = "sine";
  osc.frequency.value = REGISTERS[0].base;
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
  audioReady = true;
  unlockHint.style.display = "none";
}

// AudioContext can only start after a genuine user interaction 
document.addEventListener("pointerdown", () => { if (!audioReady) initAudio(); }, { once: true });

const GLIDE_MS = 40; // short smoothing per frame, avoids zipper noise between camera frames

function setFrequency(freq) {
  if (!audioReady) return;
  const now = audioCtx.currentTime;
  osc.frequency.cancelScheduledValues(now);
  osc.frequency.setValueAtTime(osc.frequency.value, now);
  osc.frequency.exponentialRampToValueAtTime(freq, now + GLIDE_MS / 1000);
  noteEl.textContent = `${freq.toFixed(2)} Hz`;
}

function setAudible(audible) {
  if (!audioReady) return;
  gain.gain.setTargetAtTime(audible ? 0.15 : 0, audioCtx.currentTime, 0.05);
}

// ── Gestures ─────────────────────────────────────────────────────────────

const lib = new GestureLibrary();

for (const reg of REGISTERS) {
  lib.register(new TiltGesture({ name: reg.id, hand: "Left", fingers: reg.fingers }));
}

// Audible exactly while a register gesture is currently being shown
const activeRegisters = new Set();

function updateAudible() {
  const audible = activeRegisters.size > 0;
  setAudible(audible);
  toneStateEl.textContent = audible ? "Ton aktiv" : "Ton inaktiv";
  toneStateEl.style.color = audible ? "#4caf50" : "#999";
}

for (const reg of REGISTERS) {
  lib.on(reg.id, ({ value }) => {
    activeRegisters.add(reg.id);
    registerEl.textContent = reg.label;
    setFrequency(freqFromValue(reg.base, value));
    updateAudible();
  });
  lib.on(`${reg.id}:idle`, () => {
    activeRegisters.delete(reg.id);
    if (activeRegisters.size === 0) registerEl.textContent = "–";
    updateAudible();
  });
}

updateAudible(); // reflect initial "inactive" state before any gesture is seen

// ── Camera ──────────────────────────────────────────────────────────────

(async () => {
  statusEl.textContent = "Lade Modelle…";

  const source = new MediaPipeSource({ hands: true, pose: false });
  source.on("frame", (input, ts) => {
    lib.detect(input, ts);
    drawHands(input.handResults);
    updateDebug(input.handResults, ts);
  });
  await source.start(video);

  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  statusEl.textContent = "Aktiv — Register per Fingerform wählen und kippen, Ton läuft solange die Geste gezeigt wird";
})().catch((err) => {
  statusEl.textContent = `Fehler: ${err.message}`;
  console.error(err);
});

// Live debug readout of which fingers are extended and the angle of the hand, for each hand
function updateDebug(handResults, ts) {
  const hands = selectHands(handResults, 0.7);
  const lines = [];
  for (const label of ["Left", "Right"]) {
    const lm = hands[label];
    if (!lm) { lines.push(`${label}: keine Hand erkannt`); continue; }
    const f = (tip, pip) => (fingerExtendedRadial(lm, tip, pip) ? "✓" : "✗");
    const thumb = thumbExtended(lm) ? "✓" : "✗";
    const angle = angle2D(lm[17], lm[5]).toFixed(1);
    lines.push(
      `${label}: Daumen ${thumb}  Zeige ${f(8, 6)}  Mittel ${f(12, 10)}  Ring ${f(16, 14)}  Klein ${f(20, 18)}  |  Winkel ${angle}°`
    );
  }
  if (handResults?.landmarks?.length === 0) lines.push("(gar keine Hand im Bild — auf Kamera-Freigabe/Beleuchtung prüfen)");
  debugEl.textContent = lines.join("\n");
}

function drawHands(handResults) {
  if (!canvas.width) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgb(0, 140, 255)";
  for (const lm of handResults?.landmarks ?? []) {
    for (const p of lm) {
      ctx.beginPath();
      ctx.arc(p.x * canvas.width, p.y * canvas.height, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
