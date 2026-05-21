// One Euro Filter: smooths noisy 1-D signals
export class OneEuroFilter {
  constructor(minCutoff = 1.0, beta = 0.05, dCutoff = 1.0) {
    this._minCutoff = minCutoff;
    this._beta      = beta;
    this._dCutoff   = dCutoff;
    this._x         = null;
    this._dx        = 0;
    this._lastT     = null;
  }

  _alpha(freq, cutoff) {
    const te  = 1 / freq;
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / te);
  }

  filter(x, timestamp) {
    if (this._lastT === null) {
      this._lastT = timestamp;
      this._x     = x;
      return x;
    }
    const dt   = Math.max((timestamp - this._lastT) / 1000, 1e-6);
    const freq = 1 / dt;
    this._lastT = timestamp;

    const dx = (x - this._x) * freq;
    this._dx += this._alpha(freq, this._dCutoff) * (dx - this._dx);

    const cutoff = this._minCutoff + this._beta * Math.abs(this._dx);
    this._x += this._alpha(freq, cutoff) * (x - this._x);
    return this._x;
  }
}
