// A major, degrees I–V as simple major/minor triads (root + third + fifth).
const MAJOR = [0, 4, 7];
const MINOR = [0, 3, 7];

export const CHORDS = {
  1: { label: "A (I)", root: 220.0, intervals: MAJOR }, // A3
  2: { label: "Bm (ii)", root: 246.94, intervals: MINOR }, // B3
  3: { label: "C♯m (iii)", root: 277.18, intervals: MINOR }, // C♯4
  4: { label: "D (IV)", root: 293.66, intervals: MAJOR }, // D4
  5: { label: "E (V)", root: 329.63, intervals: MAJOR }, // E4
};

// The 3 chord note frequencies (Hz) for a level (1–5), or zero.
export function chordFrequencies(degree) {
  const chord = CHORDS[degree];
  if (!chord) return null;
  return chord.intervals.map(
    (semitones) => chord.root * Math.pow(2, semitones / 12),
  );
}
