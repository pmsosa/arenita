import { SAND_ROWS, createSandGrid, getCell, lockPieceToSand, detectAndClearBlobs, stepSand, isTopped, addGarbageRows } from './sand.js';
import { getAbsoluteCells, PIECES } from './tetromino.js';

export const BOARD_COLS = 10;
export const BOARD_ROWS = 20;

export class Board {
  constructor() {
    this.grid = createSandGrid();
    this._settling = false;
    this._stillFrames = 0;
    this._clearAccum = null;
  }

  // Check if a set of tetromino-grid cells collide with walls or settled sand
  collides(cells) {
    for (const [tx, ty] of cells) {
      if (tx < 0 || tx >= BOARD_COLS) return true;
      if (ty >= BOARD_ROWS) return true;
      if (ty < 0) continue; // above board is fine
      const sx = tx * 2, sy = ty * 2;
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
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
    lockPieceToSand(this.grid, cells, piece.color);
    this._settling = true;
    this._stillFrames = 0;
  }

  // Run sand simulation every frame; activeCells = null when no active piece
  // Returns { cleared, chains } once settling completes, otherwise null
  update(dt, activeCells) {
    let moved = false;
    for (let i = 0; i < 3; i++) {
      if (stepSand(this.grid, activeCells)) moved = true;
    }

    if (this._settling) {
      if (!moved) {
        this._stillFrames++;
        if (this._stillFrames >= 2) {
          this._stillFrames = 0;
          const result = detectAndClearBlobs(this.grid);
          if (result.cleared > 0) {
            // Accumulate clears and stay in settling mode so any sand that
            // continues moving after this clear gets another clearing pass.
            if (!this._clearAccum) this._clearAccum = { cleared: 0, chains: 0 };
            this._clearAccum.cleared += result.cleared;
            this._clearAccum.chains += result.chains + 1;
          } else {
            this._settling = false;
            const final = this._clearAccum ?? result;
            this._clearAccum = null;
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
    this._settling = false;
    this._stillFrames = 0;
    this._clearAccum = null;
  }
}
