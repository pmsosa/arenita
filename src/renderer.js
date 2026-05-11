import { SAND_COLS, SAND_ROWS, unpackColor } from './sand.js';
import { BOARD_COLS, BOARD_ROWS } from './board.js';
import { PIECES, getAbsoluteCells } from './tetromino.js';

// Layout constants
const CELL  = 24; // tetromino cell px (1P)
const SAND  = CELL / 2; // sand grain px = 12

// 1P layout  (canvas 560×600)
// board 240×480 centered with panels on each side
const P1 = {
  canvasW: 560, canvasH: 600,
  boardX: 160, boardY: 60,
  leftPanelX: 10, rightPanelX: 412,
  cell: CELL, sand: SAND,
};

// 2P layout (canvas 900×600)
// Left board: x=10, right board ends at x=890, boards are 200px wide (cell=20)
const C2 = 20;
const S2 = C2 / 2;
const BW2 = BOARD_COLS * C2;  // 200
const BH2 = BOARD_ROWS * C2;  // 400

const P2L = { boardX: 10,  boardY: 100, cell: C2, sand: S2 };
const P2R = { boardX: 690, boardY: 100, cell: C2, sand: S2 };
const CENTER_MID = (P2L.boardX + BW2 + P2R.boardX) / 2; // midpoint of center strip ≈ 450

const FONT = '14px monospace';
const FONT_LG = 'bold 20px monospace';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  setupFor1P() {
    this.canvas.width  = P1.canvasW;
    this.canvas.height = P1.canvasH;
  }

  setupFor2P() {
    this.canvas.width  = 900;
    this.canvas.height = 600;
  }

  // ─── Main draw calls ────────────────────────────────────────────

  drawMenu(canvas) {
    const ctx = this.ctx;
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 48px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ARENITA', canvas.width / 2, 160);

    ctx.fillStyle = '#aaa';
    ctx.font = '18px monospace';
    ctx.fillText('Sand Tetris', canvas.width / 2, 195);

    ctx.textAlign = 'left';
  }

  draw1P(state) {
    const ctx = this.ctx;
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, P1.canvasW, P1.canvasH);

    this._drawBoard(ctx, state, P1.boardX, P1.boardY, P1.cell, P1.sand);
    this._drawSidePanel(ctx, state, P1.leftPanelX, P1.boardY, P1.rightPanelX, P1.cell, false);
  }

  draw2P(stateL, stateR) {
    const ctx = this.ctx;
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, 900, 600);

    this._drawBoard(ctx, stateL, P2L.boardX, P2L.boardY, P2L.cell, P2L.sand);
    this._drawBoard(ctx, stateR, P2R.boardX, P2R.boardY, P2R.cell, P2R.sand);

    // Mini hold/next below each board
    const belowY = P2L.boardY + BH2 + 8;
    const miniCell = 9;
    ctx.fillStyle = '#888';
    ctx.font = '9px monospace';
    ctx.fillText('HLD', P2L.boardX, belowY + 8);
    this._drawPiecePreview(ctx, stateL.held, P2L.boardX + 22, belowY, miniCell);
    ctx.fillText('NXT', P2L.boardX + 80, belowY + 8);
    this._drawPiecePreview(ctx, stateL.next[0], P2L.boardX + 102, belowY, miniCell);

    ctx.fillText('HLD', P2R.boardX, belowY + 8);
    this._drawPiecePreview(ctx, stateR.held, P2R.boardX + 22, belowY, miniCell);
    ctx.fillText('NXT', P2R.boardX + 80, belowY + 8);
    this._drawPiecePreview(ctx, stateR.next[0], P2R.boardX + 102, belowY, miniCell);

    this._drawCenterStrip(ctx, stateL, stateR);
    // Garbage meters between boards and center strip
    this._drawGarbageMeter(ctx, stateR, P2L.boardX + BW2 + 2, P2L.boardY, BH2);
    this._drawGarbageMeter(ctx, stateL, P2R.boardX - 10,       P2R.boardY, BH2);
  }

  drawPaused(isTwo) {
    const ctx = this.ctx;
    const cw = isTwo ? 900 : P1.canvasW;
    const ch = isTwo ? 600 : P1.canvasH;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, cw, ch);
    ctx.fillStyle = '#fff';
    ctx.font = FONT_LG;
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', cw / 2, ch / 2);
    ctx.font = FONT;
    ctx.fillText('[ESC] to resume', cw / 2, ch / 2 + 30);
    ctx.textAlign = 'left';
  }

  drawGameOver1P(state) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, P1.canvasW, P1.canvasH);
    ctx.fillStyle = '#FF4444';
    ctx.font = FONT_LG;
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', P1.canvasW / 2, P1.canvasH / 2 - 40);
    ctx.fillStyle = '#fff';
    ctx.font = FONT;
    ctx.fillText(`Score: ${state.score}`, P1.canvasW / 2, P1.canvasH / 2);
    ctx.fillText(`Level: ${state.level}`, P1.canvasW / 2, P1.canvasH / 2 + 25);
    ctx.fillText('[R] to return to menu', P1.canvasW / 2, P1.canvasH / 2 + 60);
    ctx.textAlign = 'left';
  }

  drawGameOver2P(stateL, stateR, winner) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, 900, 600);
    ctx.font = FONT_LG;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFD700';
    ctx.fillText(`Player ${winner} Wins!`, 450, 240);
    ctx.fillStyle = '#fff';
    ctx.font = FONT;
    ctx.fillText(`P1 Score: ${stateL.score}   P2 Score: ${stateR.score}`, 450, 280);
    ctx.fillText('[R] to return to menu', 450, 320);
    ctx.textAlign = 'left';
  }

  // ─── Internal draw helpers ───────────────────────────────────────

  _drawBoard(ctx, state, bx, by, cell, sand) {
    const bw = BOARD_COLS * cell;
    const bh = BOARD_ROWS * cell;

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx - 1, by - 1, bw + 2, bh + 2);

    // Sand grid via ImageData
    const imgData = ctx.createImageData(bw, bh);
    const data = imgData.data;

    const grid = state.board.grid;
    for (let gy = 0; gy < SAND_ROWS; gy++) {
      for (let gx = 0; gx < SAND_COLS; gx++) {
        const val = grid[gy * SAND_COLS + gx];
        if (!val) continue;
        const [r, g, b] = unpackColor(val);
        // Each sand grain = sand×sand pixels in the canvas
        const px0 = gx * sand;
        const py0 = gy * sand;
        for (let py = py0; py < py0 + sand; py++) {
          for (let px = px0; px < px0 + sand; px++) {
            const i = (py * bw + px) * 4;
            data[i]   = r;
            data[i+1] = g;
            data[i+2] = b;
            data[i+3] = 255;
          }
        }
      }
    }
    ctx.putImageData(imgData, bx, by);

    // Ghost piece
    if (state.active) {
      const ghostY = state.board.getGhostY(state.active);
      const cells = PIECES[state.active.type].cells[state.active.rotation]
        .map(([dc, dr]) => [state.active.x + dc, ghostY + dr]);
      const color = state.active.color;
      ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},0.25)`;
      ctx.strokeStyle = `rgba(${color[0]},${color[1]},${color[2]},0.6)`;
      ctx.lineWidth = 1;
      for (const [tx, ty] of cells) {
        if (ty < 0) continue;
        ctx.fillRect(bx + tx * cell, by + ty * cell, cell - 1, cell - 1);
        ctx.strokeRect(bx + tx * cell + 0.5, by + ty * cell + 0.5, cell - 2, cell - 2);
      }
    }

    // Active piece
    if (state.active) {
      const cells = getAbsoluteCells(state.active);
      const color = state.active.color;
      ctx.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},0.85)`;
      for (const [tx, ty] of cells) {
        if (ty < 0) continue;
        ctx.fillRect(bx + tx * cell, by + ty * cell, cell - 1, cell - 1);
      }
    }

    // Death overlay
    if (state.dead) {
      ctx.fillStyle = 'rgba(255,0,0,0.15)';
      ctx.fillRect(bx, by, bw, bh);
    }
  }

  _drawSidePanel(ctx, state, leftX, boardY, rightX, cell, _compact) {
    // Left panel: Hold + Next
    ctx.fillStyle = '#fff';
    ctx.font = '11px monospace';
    ctx.fillText('HOLD', leftX, boardY + 14);
    this._drawPiecePreview(ctx, state.held, leftX, boardY + 20, cell * 0.75);

    ctx.fillText('NEXT', leftX, boardY + 110);
    for (let i = 0; i < Math.min(state.next.length, 3); i++) {
      this._drawPiecePreview(ctx, state.next[i], leftX, boardY + 120 + i * 85, cell * 0.65);
    }

    // Right panel: Stats
    ctx.fillStyle = '#aaa';
    ctx.font = '12px monospace';
    ctx.fillText('SCORE', rightX, boardY + 20);
    ctx.fillStyle = '#fff';
    ctx.font = '16px monospace';
    ctx.fillText(String(state.score).padStart(8, '0'), rightX, boardY + 40);

    ctx.fillStyle = '#aaa';
    ctx.font = '12px monospace';
    ctx.fillText('LEVEL', rightX, boardY + 80);
    ctx.fillStyle = '#fff';
    ctx.font = '16px monospace';
    ctx.fillText(state.level, rightX, boardY + 100);

    ctx.fillStyle = '#aaa';
    ctx.font = '12px monospace';
    ctx.fillText('LINES', rightX, boardY + 140);
    ctx.fillStyle = '#fff';
    ctx.font = '16px monospace';
    ctx.fillText(state.linesCleared, rightX, boardY + 160);
  }

  _drawCenterStrip(ctx, stateL, stateR) {
    const mid = CENTER_MID;

    ctx.textAlign = 'center';

    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('ARENITA', mid, 30);

    ctx.font = '11px monospace';
    ctx.fillStyle = '#444';
    ctx.fillText('[ESC] Pause', mid, 48);

    // P1 stats (left of center)
    const lx = mid - 120;
    const rx = mid + 120;

    ctx.fillStyle = '#aaa';
    ctx.font = '12px monospace';
    ctx.fillText('P1', lx, 80);
    ctx.fillText('P2', rx, 80);

    ctx.fillStyle = '#fff';
    ctx.font = '13px monospace';
    ctx.fillText(stateL.score, lx, 100);
    ctx.fillText(stateR.score, rx, 100);

    ctx.fillStyle = '#aaa';
    ctx.font = '11px monospace';
    ctx.fillText(`Lvl ${stateL.level}`, lx, 118);
    ctx.fillText(`Lvl ${stateR.level}`, rx, 118);

    ctx.fillStyle = '#555';
    ctx.font = 'bold 18px monospace';
    ctx.fillText('vs', mid, 100);

    ctx.textAlign = 'left';
  }

  _drawGarbageMeter(ctx, state, x, boardY, bh) {
    const pending = state.garbagePending || 0;
    if (pending <= 0) return;
    ctx.fillStyle = '#FF4444';
    const h = Math.min(bh, pending * 15);
    ctx.fillRect(x, boardY + bh - h, 8, h);
  }

  _drawPiecePreview(ctx, piece, x, y, cell) {
    if (!piece) {
      ctx.fillStyle = '#333';
      ctx.fillRect(x, y, cell * 4, cell * 2.5);
      return;
    }
    const type = piece.type || piece;
    const color = piece.color || PIECES[type].color;
    const cells = PIECES[type].cells[0];
    ctx.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
    for (const [dc, dr] of cells) {
      ctx.fillRect(x + dc * cell, y + dr * cell, cell - 1, cell - 1);
    }
  }
}
