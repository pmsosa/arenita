import { SAND_COLS, SAND_ROWS, SAND_SCALE, createSandGrid, getCell, lockPieceToSand, detectAndClearBlobsOnce, stepSand, isTopped, addGarbageRows } from './sand.js';
import { getAbsoluteCells, PIECES } from './tetromino.js';
import { ParticleSystem } from './particles.js';

export const BOARD_COLS = 10;
export const BOARD_ROWS = 20;

export class Board {
  constructor() {
    this.grid = createSandGrid();
    this.lockAge = new Uint8Array(SAND_COLS * SAND_ROWS);
    this.particles = new ParticleSystem();
    this._settling = false;
    this._stillFrames = 0;
    this._clearAccum = null;
    this._chainHold = 0;   // frame countdown before next BFS pass after a clear
    this.activeChains = 0; // current chain depth while settling (0 = none in progress)
  }

  // Check if a set of tetromino-grid cells collide with walls or settled sand
  collides(cells) {
    for (const [tx, ty] of cells) {
      if (tx < 0 || tx >= BOARD_COLS) return true;
      if (ty >= BOARD_ROWS) return true;
      if (ty < 0) continue; // above board is fine
      const sx = tx * SAND_SCALE, sy = ty * SAND_SCALE;
      for (let dy = 0; dy < SAND_SCALE; dy++) {
        for (let dx = 0; dx < SAND_SCALE; dx++) {
          const gy = sy + dy;
          if (gy >= SAND_ROWS) return true;
          if (gy >= 0 && getCell(this.grid, sx + dx, gy) !== 0) return true;
        }
      }
    }
    return false;
  }

  // Lock piece into sand, start settling phase
  lockPiece(piece) {
    const cells = getAbsoluteCells(piece);
    lockPieceToSand(this.grid, cells, piece.color, this.lockAge);
    this._settling = true;
    this._stillFrames = 0;
  }

  // Run sand simulation every frame; activeCells = null when no active piece
  // Returns { cleared, chains } once settling completes, otherwise null.
  // Clearing is stepped — one blob-detection pass per settle cycle — so each
  // chain step is visible across multiple frames (enabling slow-mo escalation).
  update(dt, activeCells) {
    this.particles.update();

    let moved = false;
    for (let i = 0; i < 3; i++) {
      if (stepSand(this.grid, activeCells)) moved = true;
    }

    if (this._settling) {
      // After a clear, hold for N frames so each chain step is visually distinct
      if (this._chainHold > 0) {
        this._chainHold--;
        this._stillFrames = 0; // restart still-frame count fresh after hold
        return null;
      }

      if (!moved) {
        this._stillFrames++;
        if (this._stillFrames >= 2) {
          this._stillFrames = 0;
          const result = detectAndClearBlobsOnce(this.grid, (idx, r, g, b) => {
            this.particles.emitGrain(idx, r, g, b);
          });
          if (result.cleared > 0) {
            if (!this._clearAccum) this._clearAccum = { cleared: 0, steps: 0 };
            this._clearAccum.cleared += result.cleared;
            this._clearAccum.steps++;
            this.activeChains = this._clearAccum.steps;
            // Hold ~330ms before the next BFS pass so the chain is visible
            this._chainHold = 20;
          } else {
            this._settling = false;
            const steps = this._clearAccum?.steps ?? 0;
            const final = {
              cleared: this._clearAccum?.cleared ?? 0,
              chains: steps > 0 ? steps - 1 : 0,
            };
            this._clearAccum = null;
            this._chainHold = 0;
            this.activeChains = 0;
            return final;
          }
        }
      } else {
        this._stillFrames = 0;
      }
    }

    return null;
  }

  isSettling() {
    return this._settling;
  }

  isTopped() {
    return isTopped(this.grid);
  }

  getGhostY(piece) {
    let y = piece.y;
    while (true) {
      const cells = PIECES[piece.type].cells[piece.rotation]
        .map(([dc, dr]) => [piece.x + dc, y + dr + 1]);
      if (this.collides(cells)) break;
      y++;
    }
    return y;
  }

  addGarbage(rows) {
    addGarbageRows(this.grid, rows);
  }

  reset() {
    this.grid.fill(0);
    this.lockAge.fill(0);
    this.particles.clear();
    this._settling = false;
    this._stillFrames = 0;
    this._clearAccum = null;
    this._chainHold = 0;
    this.activeChains = 0;
  }
}
