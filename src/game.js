import { Player } from './player.js';
import { Renderer } from './renderer.js';
import { InputManager } from './input.js';
import { audio } from './audio.js';
import { SAND_COLORS, DIFFICULTY_COLOR_COUNTS } from './tetromino.js';
import { SAND_COLS, SAND_ROWS, setCell, stepSand, packColor } from './sand.js';
import { drawBackground, BG_STYLES, BG_LABELS } from './background.js';

export const STATE = {
  MENU:       'MENU',
  PLAYING_1P: 'PLAYING_1P',
  PLAYING_2P: 'PLAYING_2P',
  PAUSED:     'PAUSED',
  FLOODING:   'FLOODING',
  GAMEOVER:   'GAMEOVER',
};

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.input = new InputManager();

    this.state = STATE.MENU;
    this.prevState = null;
    this.winner = null;

    this.players = [];
    this.menuStep = 0;       // 0=mode select, 1=difficulty select, 2=background select
    this.menuMode = 0;       // 0=1P, 1=2P
    this.menuDifficulty = 1; // 0=easy, 1=medium, 2=hard
    this.menuBgStyle = 0;    // index into BG_STYLES

    this.timeScale = 1.0;
    this._timeScaleTween = null;

    this._setupMenuKeys();
    this._setupDebugKeys();
  }

  _setupMenuKeys() {
    this._menuKeyHandler = (e) => {
      if (this.state !== STATE.MENU) return;

      if (this.menuStep === 0) {
        if (e.code === 'ArrowUp' || e.code === 'KeyW') {
          this.menuMode = (this.menuMode + 1) % 2;
        }
        if (e.code === 'ArrowDown' || e.code === 'KeyS') {
          this.menuMode = (this.menuMode + 1) % 2;
        }
        if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyZ') {
          this.menuStep = 1;
        }
        if (e.code === 'Digit1') { this.menuMode = 0; this.menuStep = 1; }
        if (e.code === 'Digit2') { this.menuMode = 1; this.menuStep = 1; }
      } else if (this.menuStep === 1) {
        if (e.code === 'ArrowUp' || e.code === 'KeyW') {
          this.menuDifficulty = (this.menuDifficulty + 2) % 3;
        }
        if (e.code === 'ArrowDown' || e.code === 'KeyS') {
          this.menuDifficulty = (this.menuDifficulty + 1) % 3;
        }
        if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyZ') {
          this.menuStep = 2;
        }
        if (e.code === 'Escape' || e.code === 'Backspace') {
          this.menuStep = 0;
        }
      } else {
        // step 2: background style
        if (e.code === 'ArrowUp' || e.code === 'KeyW') {
          this.menuBgStyle = (this.menuBgStyle + BG_STYLES.length - 1) % BG_STYLES.length;
        }
        if (e.code === 'ArrowDown' || e.code === 'KeyS') {
          this.menuBgStyle = (this.menuBgStyle + 1) % BG_STYLES.length;
        }
        if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyZ') {
          this._startGame(this.menuMode + 1, this.menuDifficulty, this.menuBgStyle);
        }
        if (e.code === 'Escape' || e.code === 'Backspace') {
          this.menuStep = 1;
        }
      }
    };
    window.addEventListener('keydown', this._menuKeyHandler);
  }

  _startGame(numPlayers, difficulty, bgStyleIdx = 0) {
    const diffKey = ['easy', 'medium', 'hard'][difficulty ?? 1];
    const colorCount = DIFFICULTY_COLOR_COUNTS[diffKey];
    const colorPool = SAND_COLORS.slice(0, colorCount);

    this.renderer.bgStyle = BG_STYLES[bgStyleIdx] ?? 'dark';
    this.timeScale = 1.0;
    this._timeScaleTween = null;

    this.players = [];
    if (numPlayers === 1) {
      this.state = STATE.PLAYING_1P;
      this.renderer.setupFor1P();
      this.players.push(new Player(0, colorPool));
    } else {
      this.state = STATE.PLAYING_2P;
      this.renderer.setupFor2P();
      this.players.push(new Player(0, colorPool));
      this.players.push(new Player(1, colorPool));
    }
    this.winner = null;
  }

  update(dt) {
    const { players: playerActions, global } = this.input.update(dt);

    switch (this.state) {
      case STATE.MENU:
        this._drawMenu();
        break;

      case STATE.PLAYING_1P:
        if (global.pause) {
          this.prevState = this.state;
          this.state = STATE.PAUSED;
          break;
        }
        // Merge WASD (P1) and Arrow keys (P2 slot) for single-player
        this._update1P(dt, _mergeActions(playerActions[0], playerActions[1]));
        break;

      case STATE.PLAYING_2P:
        if (global.pause) {
          this.prevState = this.state;
          this.state = STATE.PAUSED;
          break;
        }
        this._update2P(dt, playerActions[0], playerActions[1]);
        break;

      case STATE.PAUSED:
        if (global.pause) {
          this.state = this.prevState;
        }
        if (this.prevState === STATE.PLAYING_1P) {
          this.renderer.draw1P(this.players[0].getState());
        } else {
          this.renderer.draw2P(this.players[0].getState(), this.players[1].getState());
        }
        this.renderer.drawPaused(this.prevState === STATE.PLAYING_2P);
        break;

      case STATE.FLOODING:
        this._tickFlood();
        break;

      case STATE.GAMEOVER:
        if (global.restart) {
          this.state = STATE.MENU;
          this.menuStep = 0;
          this.menuMode = 0;
          this.renderer.bgStyle = 'dark';
          this.canvas.width  = 560;
          this.canvas.height = 600;
          break;
        }
        this._drawGameOver();
        break;
    }
  }

  _update1P(dt, actions) {
    const p = this.players[0];

    // Advance tween back to 1.0 (real time, not scaled)
    if (this._timeScaleTween) {
      this._timeScaleTween.elapsed += dt;
      const t = Math.min(this._timeScaleTween.elapsed / this._timeScaleTween.duration, 1);
      this.timeScale = this._timeScaleTween.from + (1.0 - this._timeScaleTween.from) * t;
      if (t >= 1) this._timeScaleTween = null;
    }

    // Capture chain depth before this frame's update
    const prevChainDepth = p.board.activeChains;

    // Snap timeScale down as chains deepen (only ever decreases here)
    if (prevChainDepth >= 2) {
      const target = 1 / (1 + (prevChainDepth - 1) * 0.4);
      if (target < this.timeScale) {
        this.timeScale = target;
        this._timeScaleTween = null;
      }
    }

    const wasFirstClear = !p.hasCleared;
    const isHardDropping = actions.hardDrop && !!p.active;
    const clearResult = p.update(dt * this.timeScale, actions, null);
    const chainDepth = p.board.activeChains; // capture after update

    if (isHardDropping) this.renderer.triggerShake(3, 6);

    // Push a toast the exact frame each chain step fires (depth just increased)
    if (chainDepth > prevChainDepth) {
      // isFirstClear only applies to the very first step of the first chain ever
      const isFirst = wasFirstClear && prevChainDepth === 0;
      this.renderer.pushToast(chainDepth, isFirst);
      this.renderer.triggerShake(2 + chainDepth, 7);
    }

    if (clearResult !== null) {
      // Settling done — tween back to normal speed over 500ms
      if (this.timeScale < 1.0) {
        this._timeScaleTween = { from: this.timeScale, elapsed: 0, duration: 500 };
      }
    }

    if (p.dead) {
      audio.gameover();
      this.state = STATE.FLOODING;
      this._floodFrame = 0;
      this.timeScale = 1.0;
      this._timeScaleTween = null;
    }

    this.renderer.chainDepth = chainDepth;
    this.renderer.draw1P(p.getState());
  }

  _update2P(dt, actL, actR) {
    const [p1, p2] = this.players;

    p1.update(dt, actL, p2.garbageQueue);
    p2.update(dt, actR, p1.garbageQueue);

    const stateL = p1.getState();
    const stateR = p2.getState();

    if (p1.dead || p2.dead) {
      if (p1.dead && p2.dead) {
        this.winner = 0; // draw — show no winner
      } else if (p1.dead) {
        this.winner = 2;
      } else {
        this.winner = 1;
      }
      audio.gameover();
      this.state = STATE.GAMEOVER;
    }

    this.renderer.draw2P(stateL, stateR);
  }

  _tickFlood() {
    const p = this.players[0];
    const grid = p.board.grid;
    const pool = p.colorPool;

    // Rain sand from the top across the full width
    for (let x = 0; x < SAND_COLS; x++) {
      if (Math.random() < 0.7) {
        const c = pool[Math.floor(Math.random() * pool.length)];
        setCell(grid, x, 0, packColor(c[0], c[1], c[2]));
      }
    }

    for (let i = 0; i < 3; i++) stepSand(grid, null);

    this._floodFrame++;
    this.renderer.draw1P(p.getState());

    if (this._floodFrame >= 180) {
      this.state = STATE.GAMEOVER;
    }
  }

  _drawMenu() {
    const ctx = this.renderer.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    // Live-preview the selected bg style on step 2, otherwise dark
    const previewStyle = this.menuStep === 2 ? BG_STYLES[this.menuBgStyle] : 'dark';
    drawBackground(ctx, previewStyle, cw, ch, Date.now());

    // Title
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 52px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ARENITA', cw / 2, 150);

    ctx.fillStyle = '#888';
    ctx.font = '16px monospace';
    ctx.fillText('Sand Tetris', cw / 2, 182);

    if (this.menuStep === 2) {
      // Background style picker — live preview is already drawn above
      const modeName = this.menuMode === 0 ? '1 Player' : '2 Players';
      const diffName = ['Easy', 'Medium', 'Hard'][this.menuDifficulty];
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, cw, ch);

      ctx.fillStyle = '#666';
      ctx.font = '13px monospace';
      ctx.fillText(`${modeName}  ·  ${diffName}  —  Select Background`, cw / 2, 240);

      // Scrollable list — show 7 items centred on selection
      const BG_VISIBLE = 7;
      const bgWin = Math.max(0, Math.min(this.menuBgStyle - 3, BG_LABELS.length - BG_VISIBLE));
      const bgEnd = Math.min(BG_LABELS.length, bgWin + BG_VISIBLE);
      for (let i = bgWin; i < bgEnd; i++) {
        const sel = i === this.menuBgStyle;
        const pos = i - bgWin;
        ctx.fillStyle = sel ? '#FFD700' : '#555';
        ctx.font = sel ? 'bold 20px monospace' : '17px monospace';
        ctx.fillText((sel ? '▶ ' : '  ') + BG_LABELS[i], cw / 2, 270 + pos * 38);
      }
      if (bgWin > 0) {
        ctx.fillStyle = '#444'; ctx.font = '11px monospace';
        ctx.fillText(`↑  ${bgWin} more`, cw / 2, 255);
      }
      if (bgEnd < BG_LABELS.length) {
        ctx.fillStyle = '#444'; ctx.font = '11px monospace';
        ctx.fillText(`↓  ${BG_LABELS.length - bgEnd} more`, cw / 2, 270 + BG_VISIBLE * 38);
      }

      ctx.fillStyle = '#444';
      ctx.font = '12px monospace';
      ctx.fillText('↑↓ to select  ·  Enter to start  ·  Esc to go back', cw / 2, ch - 20);
    } else if (this.menuStep === 0) {
      ctx.fillStyle = '#666';
      ctx.font = '13px monospace';
      ctx.fillText('Select Mode', cw / 2, 240);

      const modes = ['1 Player', '2 Players'];
      for (let i = 0; i < modes.length; i++) {
        const sel = i === this.menuMode;
        ctx.fillStyle = sel ? '#FFD700' : '#555';
        ctx.font = sel ? 'bold 26px monospace' : '22px monospace';
        ctx.fillText((sel ? '▶ ' : '  ') + modes[i], cw / 2, 290 + i * 60);
      }

      ctx.fillStyle = '#444';
      ctx.font = '12px monospace';
      ctx.fillText('↑↓ to select  ·  Enter to continue  ·  1 / 2 to start', cw / 2, ch - 40);
      ctx.fillStyle = '#333';
      ctx.font = '11px monospace';
      ctx.fillText('P1: WASD + Q/E + Shift  |  P2: Arrows + ,/. + Shift', cw / 2, ch - 20);
    } else if (this.menuStep === 1) {
      const modeName = this.menuMode === 0 ? '1 Player' : '2 Players';
      ctx.fillStyle = '#666';
      ctx.font = '13px monospace';
      ctx.fillText(modeName + '  —  Select Difficulty', cw / 2, 240);

      const levels = [
        { label: 'Easy',   desc: '3 colors' },
        { label: 'Medium', desc: '5 colors' },
        { label: 'Hard',   desc: '7 colors' },
      ];
      for (let i = 0; i < levels.length; i++) {
        const sel = i === this.menuDifficulty;
        ctx.fillStyle = sel ? '#FFD700' : '#555';
        ctx.font = sel ? 'bold 24px monospace' : '20px monospace';
        const line = (sel ? '▶ ' : '  ') + levels[i].label;
        ctx.fillText(line, cw / 2, 285 + i * 58);
        ctx.fillStyle = sel ? '#aaa' : '#444';
        ctx.font = '12px monospace';
        ctx.fillText('(' + levels[i].desc + ')', cw / 2, 305 + i * 58);
      }

      ctx.fillStyle = '#444';
      ctx.font = '12px monospace';
      ctx.fillText('↑↓ to select  ·  Enter to continue  ·  Esc to go back', cw / 2, ch - 20);
    }

    ctx.textAlign = 'left';
  }

  _drawGameOver() {
    if (this.prevState === STATE.PLAYING_2P || this.players.length === 2) {
      this.renderer.draw2P(this.players[0].getState(), this.players[1].getState());
      this.renderer.drawGameOver2P(
        this.players[0].getState(),
        this.players[1].getState(),
        this.winner
      );
    } else {
      this.renderer.draw1P(this.players[0].getState());
      this.renderer.drawGameOver1P(this.players[0].getState());
    }
  }

  _setupDebugKeys() {
    this._debugChain = 0;
    this._debugLastPressAt = 0;

    this._debugKeyHandler = (e) => {
      if (this.state !== STATE.PLAYING_1P) return;
      if (e.code === 'Digit1') {
        const now = Date.now();
        if (now - this._debugLastPressAt > 4000) this._debugChain = 0;
        this.renderer.pushToast(this._debugChain + 1, false);
        this._debugChain++;
        this._debugLastPressAt = now;
      }
      if (e.code === 'Digit2') {
        this._debugSetupWin();
      }
      if (e.code === 'Digit3') {
        this._debugSetupChain();
      }
    };
    window.addEventListener('keydown', this._debugKeyHandler);
  }

  _debugSetupWin() {
    const p = this.players[0];
    const color = p.colorPool[0];
    const packed = packColor(color[0], color[1], color[2]);
    const grid = p.board.grid;

    // Clear board, fill bottom 18 sand rows cols 0–15 with color A (left wall to col 15)
    // Leaves sand cols 16–19 empty so the blob doesn't span both walls yet
    grid.fill(0);
    for (let gy = SAND_ROWS - 18; gy < SAND_ROWS; gy++) {
      for (let gx = 0; gx < 16; gx++) {
        setCell(grid, gx, gy, packed);
      }
    }

    // Reset settling state so the board doesn't think it's mid-settle
    p.board._settling = false;
    p.board._stillFrames = 0;
    p.board._clearAccum = null;
    p.board._chainHold = 0;

    // Replace active piece with an I-piece at x=6 (covers sand cols 12–19 when dropped)
    // matching color A — hard drop immediately fills the gap and triggers the clear
    p.active = { type: 'I', rotation: 0, x: 6, y: -1, color };
    p.fallTimer  = 0;
    p.lockTimer  = 0;
    p.lockResets = 0;
  }

  _debugSetupChain() {
    const p = this.players[0];
    const grid = p.board.grid;

    grid.fill(0);

    // Non-clearable gray floor (rows 36-39)
    for (let y = 36; y < 40; y++) {
      for (let x = 0; x < SAND_COLS; x++) {
        const v = Math.floor((Math.random() - 0.5) * 10);
        grid[y * SAND_COLS + x] = packColor(130 + v, 130 + v, 130 + v);
      }
    }

    // RED band: rows 32-33, x=0..11 — gap at x=12..19 (I-piece fills it)
    for (let y = 32; y <= 33; y++) {
      for (let x = 0; x <= 11; x++) {
        grid[y * SAND_COLS + x] = packColor(200, 60, 60);
      }
    }

    // BLUE column: rows 24-31, x=0..1 — hangs above red; falls after red clears
    for (let y = 24; y <= 31; y++) {
      for (let x = 0; x <= 1; x++) {
        grid[y * SAND_COLS + x] = packColor(60, 100, 220);
      }
    }

    // BLUE band: rows 34-35, x=2..19 — gap at x=0..1, completed by falling column
    for (let y = 34; y <= 35; y++) {
      for (let x = 2; x <= 19; x++) {
        grid[y * SAND_COLS + x] = packColor(60, 100, 220);
      }
    }

    p.board._settling = false;
    p.board._stillFrames = 0;
    p.board._clearAccum = null;
    p.board._chainHold = 0;
    p.board.activeChains = 0;

    // I-piece (horizontal) at x=6 covers sand cols 12-19 — hard drop fills the red gap
    p.active = { type: 'I', rotation: 0, x: 6, y: 0, color: [200, 60, 60] };
    p.fallTimer  = 0;
    p.lockTimer  = 0;
    p.lockResets = 0;
  }

  destroy() {
    this.input.destroy();
    window.removeEventListener('keydown', this._menuKeyHandler);
    window.removeEventListener('keydown', this._debugKeyHandler);
  }
}

function _mergeActions(a, b) {
  return {
    left:      a.left      || b.left,
    right:     a.right     || b.right,
    softDrop:  a.softDrop  || b.softDrop,
    hardDrop:  a.hardDrop  || b.hardDrop,
    rotateCW:  a.rotateCW  || b.rotateCW,
    rotateCCW: a.rotateCCW || b.rotateCCW,
    hold:      a.hold      || b.hold,
  };
}
