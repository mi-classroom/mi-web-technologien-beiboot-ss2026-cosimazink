import { test } from "node:test";
import assert from "node:assert/strict";
import { dist2D, angle2D } from "../src/lib/utils/utils.js";

test("dist2D returns 0 for identical points", () => {
  assert.equal(dist2D({ x: 1, y: 1 }, { x: 1, y: 1 }), 0);
});

test("dist2D computes the Euclidean distance (3-4-5 triangle)", () => {
  assert.equal(dist2D({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
});

test("angle2D: pointing right is 0 degrees", () => {
  // Math.atan2 can return -0 here, which is numerically equal to 0 but not
  // === under strict assert — compare with a tolerance instead.
  assert.ok(Math.abs(angle2D({ x: 0, y: 0 }, { x: 1, y: 0 })) < 1e-9);
});

test("angle2D: smaller y (higher on screen) is +90 degrees", () => {
  const angle = angle2D({ x: 0, y: 1 }, { x: 0, y: 0 });
  assert.ok(Math.abs(angle - 90) < 1e-9);
});
