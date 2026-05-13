import { SAND_COLS, SAND_ROWS, SAND_SCALE, unpackColor } from './sand.js';
import { BOARD_COLS, BOARD_ROWS } from './board.js';
import { PIECES, getAbsoluteCells } from './tetromino.js';
import { drawBackground } from './background.js';

// Layout constants
const CELL  = 24; // tetromino cell px (1P)
const SAND  = CELL / SAND_SCALE; // sand grain px

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
const S2 = C2 / SAND_SCALE;
const BW2 = BOARD_COLS * C2;  // 200
const BH2 = BOARD_ROWS * C2;  // 400

const P2L = { boardX: 10,  boardY: 100, cell: C2, sand: S2 };
const P2R = { boardX: 690, boardY: 100, cell: C2, sand: S2 };
const CENTER_MID = (P2L.boardX + BW2 + P2R.boardX) / 2; // midpoint of center strip ≈ 450

const FONT = '14px monospace';
const FONT_LG = 'bold 20px monospace';

// Comic-book toast tiers: [words, color, fontSize, tiltDeg, starburstR, durationMs]
const TOAST_TIERS = [
  { words: ['BEGINNER!', 'NICE ONE!', 'FIRST!'],            color: '#FFD700', fontSize: 22, tilt: 8,  starburstR: 30, duration: 1800 },
  { words: ['WHAM!', 'POW!', 'ZAP!'],                       color: '#ffffff', fontSize: 30, tilt: 12, starburstR: 36, duration: 1800 },
  { words: ['KA-POW!', 'CRUNCH!', 'BOOM!'],                 color: '#FF8C00', fontSize: 34, tilt: 15, starburstR: 42, duration: 2000 },
  { words: ['OBLITERATED!!', 'ANNIHILATED!!', 'MAYHEM!!'],  color: '#FF1493', fontSize: 26, tilt: 20, starburstR: 50, duration: 2200 },
];

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.toasts = [];
    this.bgStyle = 'dark';
    this._shake = { frames: 0, intensity: 0 };
  }

  triggerShake(intensity, frames) {
    if (this._shake.frames <= 0 || intensity > this._shake.intensity) {
      this._shake.intensity = intensity;
      this._shake.frames = frames;
    }
  }

  _applyShake(ctx) {
    const s = this._shake;
    if (s.frames <= 0) return;
    const amp = s.intensity * (s.frames / 8);
    ctx.translate((Math.random() * 2 - 1) * amp, (Math.random() * 2 - 1) * amp);
    s.frames--;
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
    ctx.save();
    this._applyShake(ctx);
    drawBackground(ctx, this.bgStyle, P1.canvasW, P1.canvasH, Date.now());
    this._drawBoard(ctx, state, P1.boardX, P1.boardY, P1.cell, P1.sand);
    this._drawSidePanel(ctx, state, P1.leftPanelX, P1.boardY, P1.rightPanelX, P1.cell, false);
    this._drawHoldAnim(ctx, state);
    this._drawToasts(ctx);
    ctx.restore();
  }

  _drawHoldAnim(ctx, state) {
    if (!state.holdAnim) return;
    const anim  = state.holdAnim;
    const elapsed = Date.now() - anim.startAt;
    if (elapsed >= anim.duration) return;

    const t    = elapsed / anim.duration;
    const ease = t * t; // ease-in: slow start, then accelerates (vacuum pull)
    const cell = P1.cell;
    const bx   = P1.boardX;
    const by   = P1.boardY;

    // Center of hold preview box (matches _drawSidePanel's _drawPiecePreview call)
    const hCell = cell * 0.75;
    const holdCx = P1.leftPanelX + hCell * 1.5;
    const holdCy = P1.boardY + 20 + hCell * 0.75;

    // ── Incoming: piece flies from board to hold box ──────────────
    const inc   = anim.incoming;
    const iCells = PIECES[inc.type].cells[inc.rotation];
    const iAvgDc = iCells.reduce((s, [dc]) => s + dc, 0) / iCells.length;
    const iAvgDr = iCells.reduce((s, [, dr]) => s + dr, 0) / iCells.length;
    const srcX = bx + (inc.x + iAvgDc + 0.5) * cell;
    const srcY = by + (inc.y + iAvgDr + 0.5) * cell;

    const cx    = srcX + (holdCx - srcX) * ease;
    const cy    = srcY + (holdCy - srcY) * ease;
    const scale = 1.0 - 0.88 * ease;
    const alpha = 1.0 - 0.5 * ease;
    const [icr, icg, icb] = inc.color;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.fillStyle = `rgb(${icr},${icg},${icb})`;
    for (const [dc, dr] of iCells) {
      ctx.fillRect((dc - iAvgDc - 0.5) * cell, (dr - iAvgDr - 0.5) * cell, cell - 1, cell - 1);
    }
    ctx.restore();

    // ── Outgoing: held piece bursts out of hold box, expands and fades ──
    if (anim.outgoing && t < 0.6) {
      const ot     = t / 0.6;
      const oEase  = 1 - (1 - ot) * (1 - ot); // ease-out
      const out    = anim.outgoing;
      const oCells = PIECES[out.type].cells[0];
      const oAvgDc = oCells.reduce((s, [dc]) => s + dc, 0) / oCells.length;
      const oAvgDr = oCells.reduce((s, [, dr]) => s + dr, 0) / oCells.length;
      const oScale = 0.35 + 1.0 * oEase;
      const oAlpha = (1 - oEase) * 0.75;
      const [ocr, ocg, ocb] = out.color;

      ctx.save();
      ctx.globalAlpha = oAlpha;
      ctx.translate(holdCx, holdCy);
      ctx.scale(oScale, oScale);
      ctx.fillStyle = `rgb(${ocr},${ocg},${ocb})`;
      for (const [dc, dr] of oCells) {
        ctx.fillRect((dc - oAvgDc - 0.5) * cell, (dr - oAvgDr - 0.5) * cell, cell - 1, cell - 1);
      }
      ctx.restore();
    }
  }

  pushToast(chains, isFirstClear) {
    let tier;
    if (isFirstClear)   tier = 0;
    else if (chains <= 1) tier = 1;
    else if (chains === 2) tier = 2;
    else                  tier = 3;

    const t = TOAST_TIERS[tier];
    const word = t.words[Math.floor(Math.random() * t.words.length)];
    const sign = Math.random() < 0.5 ? 1 : -1;
    const angle = sign * t.tilt * Math.PI / 180;

    if (this.toasts.length >= 2) this.toasts.shift();
    this.toasts.push({ word, color: t.color, angle, fontSize: t.fontSize, starburstR: t.starburstR, createdAt: Date.now(), duration: t.duration });
  }

  _drawStarburst(ctx, outerR, innerR, points) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const a = (i * Math.PI / points) - Math.PI / 2;
      if (i === 0) ctx.moveTo(r * Math.cos(a), r * Math.sin(a));
      else         ctx.lineTo(r * Math.cos(a), r * Math.sin(a));
    }
    ctx.closePath();
  }

  _drawToasts(ctx) {
    const now = Date.now();
    this.toasts = this.toasts.filter(t => now - t.createdAt < t.duration);

    // Left panel dead space: below 3rd next-piece preview (~y=441) to board bottom (~y=540)
    const baseY = 490;
    const stackGap = 90;

    for (let i = 0; i < this.toasts.length; i++) {
      const t = this.toasts[i];
      const elapsed   = now - t.createdAt;
      const remaining = t.duration - elapsed;

      const scale = elapsed < 200 ? 0.3 + 0.7 * (elapsed / 200) : 1.0;
      const alpha = remaining < 500 ? remaining / 500 : 1.0;
      // stack: newest toast at baseY, older toast pushed up
      const y = baseY - (this.toasts.length - 1 - i) * stackGap;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(85, y); // center of left panel (x=10..160)
      ctx.rotate(t.angle);
      ctx.scale(scale, scale);

      // starburst background
      this._drawStarburst(ctx, t.starburstR, t.starburstR * 0.55, 8);
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fill();
      ctx.strokeStyle = t.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // text with black outline then colored fill
      ctx.font = `bold ${t.fontSize}px Impact, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#000';
      ctx.strokeText(t.word, 0, 0);
      ctx.fillStyle = t.color;
      ctx.fillText(t.word, 0, 0);

      ctx.restore();
    }
  }

  draw2P(stateL, stateR) {
    const ctx = this.ctx;
    drawBackground(ctx, this.bgStyle, 900, 600, Date.now());

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

    // Border — flashes orange/red during chain slow-mo
    const cd = this.chainDepth ?? 0;
    ctx.strokeStyle = cd >= 3 ? 'rgba(255,50,50,0.95)'
                    : cd >= 2 ? 'rgba(255,160,0,0.9)'
                    :           'rgba(255,255,255,0.4)';
    ctx.lineWidth = cd >= 2 ? 2 : 1;
    ctx.strokeRect(bx - 1, by - 1, bw + 2, bh + 2);

    // Sand grid via ImageData
    const imgData = ctx.createImageData(bw, bh);
    const data = imgData.data;

    const grid = state.board.grid;
    const lockAge = state.board.lockAge;
    for (let gy = 0; gy < SAND_ROWS; gy++) {
      for (let gx = 0; gx < SAND_COLS; gx++) {
        const idx = gy * SAND_COLS + gx;
        const val = grid[idx];
        if (!val) continue;
        const [r, g, b] = unpackColor(val);
        // Dissolve flash: brighten newly-locked grains for 8 frames
        const age = lockAge[idx];
        const boost = age > 0 ? Math.round(age / 8 * 60) : 0;
        if (age > 0) lockAge[idx]--;
        const fr = Math.min(255, r + boost);
        const fg = Math.min(255, g + boost);
        const fb = Math.min(255, b + boost);
        // Each sand grain = sand×sand pixels; leave 1px gap + bevel for depth
        const px0 = gx * sand;
        const py0 = gy * sand;
        const inner = sand - 1; // 1px gap on right+bottom edge
        for (let dy = 0; dy < inner; dy++) {
          for (let dx = 0; dx < inner; dx++) {
            const hi = dx < 2 && dy < 2;
            const sh = dx >= inner - 2 || dy >= inner - 2;
            const bev = hi ? 14 : sh ? -14 : 0;
            const i = ((py0 + dy) * bw + (px0 + dx)) * 4;
            data[i]   = Math.min(255, Math.max(0, fr + bev));
            data[i+1] = Math.min(255, Math.max(0, fg + bev));
            data[i+2] = Math.min(255, Math.max(0, fb + bev));
            data[i+3] = 255;
          }
        }
      }
    }
    ctx.putImageData(imgData, bx, by);

    // Particle pass — exploding grains fly off-board after a clear
    this._drawParticles(ctx, state.board.particles, bx, by, sand);

    // Spin trail — fading ghost of the previous rotation, makes spins look snappy
    if (state.spinTrail) {
      const st = state.spinTrail;
      const a = (st.framesLeft / 4) * 0.55;
      const cells = PIECES[st.type].cells[st.rotation];
      const [scr, scg, scb] = st.color;
      ctx.fillStyle = `rgba(${scr},${scg},${scb},${a.toFixed(2)})`;
      for (const [dc, dr] of cells) {
        const ty = st.y + dr;
        if (ty < 0 || ty >= BOARD_ROWS) continue;
        ctx.fillRect(bx + (st.x + dc) * cell, by + ty * cell, cell - 1, cell - 1);
      }
    }

    // Hard drop trail — fading ghost cells at each row the piece passed through
    if (state.dropTrail) {
      const tr = state.dropTrail;
      const a = (tr.framesLeft / 5) * 0.45;
      const cells = PIECES[tr.type].cells[tr.rotation];
      const [tcr, tcg, tcb] = tr.color;
      ctx.fillStyle = `rgba(${tcr},${tcg},${tcb},${a.toFixed(2)})`;
      for (let y = tr.startY; y < tr.endY; y++) {
        for (const [dc, dr] of cells) {
          const ty = y + dr;
          if (ty < 0 || ty >= BOARD_ROWS) continue;
          ctx.fillRect(bx + (tr.x + dc) * cell, by + ty * cell, cell - 1, cell - 1);
        }
      }
    }

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

    // Active piece — lerps toward gold during active chains
    if (state.active) {
      const cells = getAbsoluteCells(state.active);
      const [cr, cg, cb] = state.active.color;
      const cd = this.chainDepth ?? 0;
      let pr = cr, pg = cg, pb = cb;
      if (cd > 0) {
        const t = Math.min(cd * 0.22, 0.7);
        pr = Math.round(cr + (255 - cr) * t);
        pg = Math.round(cg + (220 - cg) * t * 0.7);
        pb = Math.round(cb * (1 - t * 0.6));
      }
      ctx.fillStyle = `rgba(${pr},${pg},${pb},0.85)`;
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

  _drawParticles(ctx, particles, bx, by, sand) {
    const ps = particles.particles;
    if (ps.length === 0) return;
    const sz = sand * 0.45;
    const half = sz / 2;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      ctx.globalAlpha = Math.max(0, p.life) * 0.9;
      ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
      ctx.fillRect(bx + p.x * sand - half, by + p.y * sand - half, sz, sz);
    }
    ctx.globalAlpha = 1;
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
