// Raw acceleration including gravity is near one g at rest and near zero in free fall.
export const heightMetres = ms => 9.80665 * (ms / 1000) ** 2 / 8;

export class FlightMeter {
  constructor() {
    this.phase = "calibrating";
    this.stillSince = null;
    this.lastTime = null;
    this.lastMagnitude = 9.81;
    this.lastLift = -Infinity;
    this.baseline = null;
    this.begin = 0;
    this.samples = 0;
  }

  add(t, acceleration, rotation) {
    if (this.phase === "finished" || !acceleration) return;
    const vector = [acceleration.x, acceleration.y, acceleration.z];
    if (!Number.isFinite(t) || !vector.every(Number.isFinite)) return;
    const a = Math.hypot(...vector);
    const delta = this.lastTime === null ? 0 : t - this.lastTime;
    if (this.lastTime !== null && delta <= 0) return;
    const prevT = this.lastTime ?? t;
    const previousA = this.lastMagnitude;
    this.lastTime = t;
    this.lastMagnitude = a;
    if (delta > 100) {
      if (this.phase === "flying" || this.phase === "catching") return this.finish("Signal interrupted.");
      this.phase = "calibrating";
      this.stillSince = null;
      this.lastLift = -Infinity;
    }
    if (this.phase === "calibrating") {
      if (a < 8.1 || a > 11.5 || (rotation && Math.hypot(rotation.alpha || 0, rotation.beta || 0, rotation.gamma || 0) > 35)) {
        this.stillSince = null;
        return;
      }
      if (this.stillSince === null) this.stillSince = t;
      if (t - this.stillSince >= 450) {
        this.baseline = vector.map(v => v / a);
        this.phase = "ready";
        return { state: "ready" };
      }
      return;
    }
    const projected = vector.reduce((sum, v, i) => sum + v * this.baseline[i], 0);
    const spin = rotation ? Math.hypot(rotation.alpha || 0, rotation.beta || 0, rotation.gamma || 0) : 0;
    if (this.phase === "ready") {
      if (projected > 12) this.lastLift = t;
      if (a < 3 && t - this.lastLift < 320 && previousA >= 3) {
        this.begin = (prevT + t) / 2;
        this.phase = "flying";
        this.samples = 1;
        this.peakSpin = spin;
        return { state: "flying" };
      }
      return;
    }
    if (this.phase === "flying") {
      if (t - this.begin > 2650) return this.finish("The flight lasted longer than the measurement range.");
      this.peakSpin = Math.max(this.peakSpin, spin);
      if (a < 3) {
        this.samples++;
        return;
      }
      this.end = (prevT + t) / 2;
      this.phase = "catching";
    }
    if (this.phase === "catching") {
      if (a > 11.5) {
        const airtime = Math.round(this.end - this.begin);
        if (airtime < 120 || airtime > 2500 || this.samples < 3) return this.finish("Too few free-fall samples.");
        if (this.peakSpin > 320) return this.finish("Too much rotation for a reliable result.");
        this.phase = "finished";
        return { state: "result", airtime };
      }
      if (t - this.end > 150) return this.finish("Could not identify the catch.");
    }
  }

  finish(message) {
    this.phase = "finished";
    return { state: "invalid", message };
  }
}
