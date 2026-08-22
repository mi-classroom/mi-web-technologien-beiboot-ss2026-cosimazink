// Schmitt-trigger style hysteresis: avoids a boolean flickering when a value
// hovers right at a single threshold. Needs to cross `onAt` to turn on, and
// cross the looser `offAt` (further away) to turn back off.
export class Hysteresis {
  constructor(onAt, offAt) {
    this._onAt = onAt;
    this._offAt = offAt;
    this._active = false;
  }

  // `valid = false` forces an immediate reset to inactive
  // instead of latching the last known state.
  update(value, valid = true) {
    if (!valid) {
      this._active = false;
      return false;
    }
    if (!this._active && value < this._onAt) this._active = true;
    else if (this._active && value > this._offAt) this._active = false;
    return this._active;
  }

  reset() {
    this._active = false;
  }
}
