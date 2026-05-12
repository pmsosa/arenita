// Particle system for sand explosion effects on line clear.
// Particle positions are in sand-grid coordinates (fractional gx, gy).
// The renderer converts to canvas pixels: px = bx + p.x * sand, py = by + p.y * sand.

import { SAND_COLS } from './sand.js';

export class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  // Emit one particle for a cleared grain at flat sand-grid index `idx`.
  emitGrain(idx, r, g, b) {
    const gx = idx % SAND_COLS + 0.5;
    const gy = Math.floor(idx / SAND_COLS) + 0.5;
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.2 + Math.random() * 0.5;
    this.particles.push({
      x: gx, y: gy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 0.4, // upward bias
      r, g, b,
      life: 1.0,
      decay: 0.028 + Math.random() * 0.038,
    });
  }

  update() {
    const ps = this.particles;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.vy += 0.045; // gravity in sand-grid units per frame²
      p.x  += p.vx;
      p.y  += p.vy;
      p.life -= p.decay;
    }
    // Compact in-place
    let w = 0;
    for (let i = 0; i < ps.length; i++) {
      if (ps[i].life > 0) ps[w++] = ps[i];
    }
    ps.length = w;
  }

  clear() {
    this.particles.length = 0;
  }
}
