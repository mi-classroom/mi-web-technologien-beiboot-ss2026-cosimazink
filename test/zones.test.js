import { test } from "node:test";
import assert from "node:assert/strict";
import { clampRemap01, remapToZone } from "../src/lib/utils/zones.js";

test("clampRemap01 maps the middle of the range to 0.5", () => {
  assert.equal(clampRemap01(5, 0, 10), 0.5);
});

test("clampRemap01 clamps values below the range to 0", () => {
  assert.equal(clampRemap01(-100, 0, 10), 0);
});

test("clampRemap01 clamps values above the range to 1", () => {
  assert.equal(clampRemap01(100, 0, 10), 1);
});

test("remapToZone maps x and y independently", () => {
  const { x, y } = remapToZone(0.5, 0.5, [0, 1], [0.25, 0.75]);
  assert.equal(x, 0.5);
  assert.equal(y, 0.5);
});
