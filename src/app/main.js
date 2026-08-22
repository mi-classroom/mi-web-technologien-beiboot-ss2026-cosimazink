import { GestureLibrary, TiltGesture, FingerCountGesture, selectHands, fingerExtendedRadial, thumbExtended, angle2D } from "../lib/index.js";
import { MediaPipeSource } from "../lib/adapters/mediapipe-source.js";
import { REGISTERS } from "./gestures/index.js";
import { CHORDS, chordFrequencies } from "./chords.js";

function freqFromValue(base, value) {
  return base * Math.pow(2, value); // exponential = linear in perceived pitch, one octave per register
}

const FILTER_MIN = 200;  // Hz — a more muffled sound
const FILTER_MAX = 8000; // Hz — the brightest sound

function filterFromValue(value) {
  return FILTER_MIN * Math.pow(FILTER_MAX / FILTER_MIN, value); // exponential, as with pitch
}

const video        = document.getElementById("video");
const canvas       = document.getElementById("canvas");
const ctx          = canvas.getContext("2d");
const registerEl   = document.getElementById("register");
const noteEl       = document.getElementById("note");
const toneStateEl  = document.getElementById("tone-state");
const chordEl      = document.getElementById("chord");
const filterEl     = document.getElementById("filter-value");
const chordStateEl = document.getElementById("chord-state");
const statusEl     = document.getElementById("status");
const unlockHint   = document.getElementById("unlock-hint");
const debugEl      = document.getElementById("debug");
const modeTonesBtn  = document.getElementById("mode-tones");
const modeChordsBtn = document.getElementById("mode-chords");

let audioCtx, audioReady = false;

// ── Sound instrument (Button 1) — a continuous sine wave, unmodified ────

let osc, gain;

function initToneInstrument() {
  osc  = audioCtx.createOscillator();
  gain = audioCtx.createGain();
  gain.gain.value = 0; // starts silent
  osc.type = "sine";
  osc.frequency.value = REGISTERS[0].base;
  osc.connect(gain).connect(audioCtx.destination);
  osc.start();
}

const GLIDE_MS = 40; // short smoothing per frame, avoids zipper noise between camera frames

function setFrequency(freq) {
  if (!audioReady) return;
  const now = audioCtx.currentTime;
  osc.frequency.cancelScheduledValues(now);
  osc.frequency.setValueAtTime(osc.frequency.value, now);
  osc.frequency.exponentialRampToValueAtTime(freq, now + GLIDE_MS / 1000);
  noteEl.textContent = `${freq.toFixed(2)} Hz`;
}

function setToneAudible(audible) {
  if (!audioReady) return;
  gain.gain.setTargetAtTime(audible ? 0.15 : 0, audioCtx.currentTime, 0.05);
}

// ── Chord instrument (Button 2) — 3 sawtooth voices through a
// ── shared low-pass filter, completely separate from the melody instrument above

let chordOscs = [], chordFilter, chordGain;

function initChordInstrument() {
  chordFilter = audioCtx.createBiquadFilter();
  chordFilter.type = "lowpass";
  chordFilter.frequency.value = FILTER_MIN;

  chordGain = audioCtx.createGain();
  chordGain.gain.value = 0; // starts silent

  chordFilter.connect(chordGain).connect(audioCtx.destination);

  chordOscs = chordFrequencies(1).map((freq) => {
    const o = audioCtx.createOscillator();
    o.type = "sawtooth"; // rich in overtones
    o.frequency.value = freq;
    o.connect(chordFilter);
    o.start();
    return o;
  });
}

function setChord(degree) {
  if (!audioReady) return;
  const freqs = chordFrequencies(degree);
  const now = audioCtx.currentTime;
  chordOscs.forEach((o, i) => {
    o.frequency.cancelScheduledValues(now);
    o.frequency.setValueAtTime(o.frequency.value, now);
    o.frequency.exponentialRampToValueAtTime(freqs[i], now + GLIDE_MS / 1000);
  });
  chordEl.textContent = CHORDS[degree].label;
}

function setChordFilterValue(value) {
  if (!audioReady) return;
  chordFilter.frequency.setTargetAtTime(filterFromValue(value), audioCtx.currentTime, 0.05);
  filterEl.textContent = `Filter: ${Math.round(value * 100)}%`;
}

function setChordAudible(audible) {
  if (!audioReady) return;
  chordGain.gain.setTargetAtTime(audible ? 0.12 : 0, audioCtx.currentTime, 0.05);
}

function initAudio() {
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  initToneInstrument();
  initChordInstrument();
  audioReady = true;
  unlockHint.style.display = "none";
}

// AudioContext can only start after a genuine user interaction
document.addEventListener("pointerdown", () => { if (!audioReady) initAudio(); }, { once: true });

// ── Sound gestures (Button 1) — left hand, 6 registers, unmodified ────────────

const toneLib = new GestureLibrary();
for (const reg of REGISTERS) {
  toneLib.register(new TiltGesture({ name: reg.id, hand: "Left", fingers: reg.fingers }));
}

const activeRegisters = new Set();

function updateToneAudible() {
  const audible = activeRegisters.size > 0;
  setToneAudible(audible);
  toneStateEl.textContent = audible ? "Ton aktiv" : "Ton inaktiv";
  toneStateEl.style.color = audible ? "#4caf50" : "#999";
}

for (const reg of REGISTERS) {
  toneLib.on(reg.id, ({ value }) => {
    activeRegisters.add(reg.id);
    registerEl.textContent = reg.label;
    setFrequency(freqFromValue(reg.base, value));
    updateToneAudible();
  });
  toneLib.on(`${reg.id}:idle`, () => {
    activeRegisters.delete(reg.id);
    if (activeRegisters.size === 0) registerEl.textContent = "–";
    updateToneAudible();
  });
}

updateToneAudible(); // reflect initial "inactive" state before any gesture is seen

// ── Chord gestures (Button 2) — right hand selects the note, left hand holds
// ── just open + tilts, controls the filter instead of a frequency

const chordLib = new GestureLibrary();
chordLib
  .register(new TiltGesture({
    name: "chord-filter",
    hand: "Left",
    fingers: { thumb: true, index: true, middle: true, ring: true, pinky: true },
  }))
  .register(new FingerCountGesture({ name: "chord-hand", hand: "Right" }));

let chordHandActive = false;

function updateChordAudible() {
  const audible = chordHandActive;
  setChordAudible(audible);
  chordStateEl.textContent = audible ? "Ton aktiv" : "Ton inaktiv";
  chordStateEl.style.color = audible ? "#4caf50" : "#999";
}

chordLib.on("chord-hand", ({ count }) => {
  chordHandActive = true;
  setChord(count);
  updateChordAudible();
});
chordLib.on("chord-hand:idle", () => {
  chordHandActive = false;
  chordEl.textContent = "–";
  updateChordAudible();
});
chordLib.on("chord-filter", ({ value }) => setChordFilterValue(value));

updateChordAudible(); // reflect initial "inactive" state before any gesture is seen

// ── Mode switching (Button 1 / Button 2) ─────────────────────────────────

let mode = "tones"; // "tones" | "chords"

function setMode(next) {
  if (next === mode) return;
  mode = next;
  document.body.dataset.mode = mode;

  toneLib.reset();
  chordLib.reset();
  activeRegisters.clear();
  chordHandActive = false;
  registerEl.textContent = "–";
  chordEl.textContent = "–";
  updateToneAudible();
  updateChordAudible();
}

modeTonesBtn.addEventListener("click", () => setMode("tones"));
modeChordsBtn.addEventListener("click", () => setMode("chords"));

// ── Camera ──────────────────────────────────────────────────────────────

(async () => {
  statusEl.textContent = "Lade Modelle…";

  const source = new MediaPipeSource({ hands: true, pose: false });
  source.on("frame", (input, ts) => {
    const activeLib = mode === "tones" ? toneLib : chordLib;
    activeLib.detect(input, ts);
    drawHands(input.handResults);
    updateDebug(input.handResults, ts);
  });
  await source.start(video);

  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  statusEl.textContent = "Aktiv";
})().catch((err) => {
  statusEl.textContent = `Fehler: ${err.message}`;
  console.error(err);
});

// Live debug readout of which fingers are extended and the angle of the hand,
// for each hand 
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
