import { test } from "node:test";
import assert from "node:assert/strict";
import { Hysteresis } from "../src/lib/utils/hysteresis.js";

test("stays off while the value is above onAt", () => {
  const h = new Hysteresis(0.1, 0.15);
  assert.equal(h.update(0.2), false);
});

test("turns on once the value drops below onAt", () => {
  const h = new Hysteresis(0.1, 0.15);
  h.update(0.2);
  assert.equal(h.update(0.05), true);
});

test("does not flicker off between onAt and offAt", () => {
  const h = new Hysteresis(0.1, 0.15);
  h.update(0.05); // turn on
  assert.equal(h.update(0.12), true); // still below offAt — stays on
});

test("turns off only once the value rises above the looser offAt", () => {
  const h = new Hysteresis(0.1, 0.15);
  h.update(0.05); // turn on
  h.update(0.12); // stays on
  assert.equal(h.update(0.2), false);
});

test("valid = false forces an immediate reset regardless of value", () => {
  const h = new Hysteresis(0.1, 0.15);
  h.update(0.05); // turn on
  assert.equal(h.update(0.05, false), false);
});
