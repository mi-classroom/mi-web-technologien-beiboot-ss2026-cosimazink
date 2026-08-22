import { test } from "node:test";
import assert from "node:assert/strict";
import { CHORDS, chordFrequencies } from "../src/app/chords.js";

test("returns 3 frequencies for a valid degree", () => {
  assert.equal(chordFrequencies(1).length, 3);
});

test("returns null for an out-of-range degree", () => {
  assert.equal(chordFrequencies(0), null);
  assert.equal(chordFrequencies(6), null);
});

test("degree I (A major) uses a major third and a perfect fifth above the root", () => {
  const [root, third, fifth] = chordFrequencies(1);
  assert.equal(root, CHORDS[1].root);
  assert.ok(Math.abs(third / root - Math.pow(2, 4 / 12)) < 1e-9); // major third = 4 semitones
  assert.ok(Math.abs(fifth / root - Math.pow(2, 7 / 12)) < 1e-9); // perfect fifth = 7 semitones
});

test("degree ii (B minor) uses a minor third above the root", () => {
  const [root, third] = chordFrequencies(2);
  assert.ok(Math.abs(third / root - Math.pow(2, 3 / 12)) < 1e-9); // minor third = 3 semitones
});
