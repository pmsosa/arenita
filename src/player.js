import { Board } from './board.js';
import { spawnPiece, getAbsoluteCells, rotatePiece, PIECES, SAND_COLORS } from './tetromino.js';
import { audio } from './audio.js';

const LOCK_DELAY = 500;   // ms before a grounded piece auto-locks
const MAX_LOCK_RESETS = 15;
const SOFT_MULT = 10;     // soft drop is 10× faster than normal fall

export class Player {
  constructor(index, colorPool) {
    this.index = index;
    this.colorPool = colorPool || SAND_COLORS;
    this.board = new Board();

    this.active = null;
    this.held   = null;
    this.holdUsed = false;
    this.next   = [];

    this.score  = 0;
    this.level  = 1;
    this.linesCleared = 0;

    this.lockTimer  = 0;
    this.lockResets = 0;
    this.fallTimer  = 0;

    this.dead = false;
    this.hasCleared = false;
    this.dropTrail = null;
    this.spinTrail = null;
    this.holdAnim  = null;

    // Garbage: rows pending delivery on next spawn
    this.garbageQueue = { pending: 0 };

    this._bag = [];
    this._fillNext(3);
    this.spawn();
  }

  // ─── Piece management ────────────────────────────────────────────

  _nextType() {
    if (this._bag.length === 0) this._bag = _shuffle(['I','O','T','S','Z','J','L']);
    return this._bag.pop();
  }

  _pickColor() {
    return this.colorPool[Math.floor(Math.random() * this.colorPool.length)];
  }

  _fillNext(count = 3) {
    while (this.next.length < count) {
      this.next.push({ type: this._nextType(), color: this._pickColor() });
    }
  }

  spawn() {
    // Deliver pending garbage before spawning
    if (this.garbageQueue.pending > 0) {
      this.board.addGarbage(this.garbageQueue.pending);
      this.garbageQueue.pending = 0;
    }

    const item = this.next.shift();
    this._fillNext(3);
    this.active = spawnPiece(item.type, item.color);
    this.holdUsed   = false;
    this.lockTimer  = 0;
    this.lockResets = 0;
    this.fallTimer  = 0;

    // Top-out check
    if (this.board.collides(getAbsoluteCells(this.active))) {
      this.dead = true;
    }
  }

  hold() {
    if (this.holdUsed || !this.active) return;
    this.holdUsed = true;
    const prev = this.held;
    this.holdAnim = {
      incoming: {
        type: this.active.type, rotation: this.active.rotation,
        x: this.active.x, y: this.active.y, color: this.active.color,
      },
      outgoing: prev ? { type: prev.type, color: prev.color } : null,
      startAt: Date.now(),
      duration: 220,
    };
    this.held = { type: this.active.type, color: this.active.color };
    if (prev) {
      this.active = spawnPiece(prev.type, prev.color);
      if (this.board.collides(getAbsoluteCells(this.active))) this.dead = true;
      this.lockTimer  = 0;
      this.lockResets = 0;
      this.fallTimer  = 0;
    } else {
      this.active = null;
      this.spawn();
    }
  }

  tryMove(dx, dy) {
    if (!this.active) return false;
    const cells = PIECES[this.active.type].cells[this.active.rotation]
      .map(([dc, dr]) => [this.active.x + dc + dx, this.active.y + dr + dy]);
    if (this.board.collides(cells)) return false;
    this.active = { ...this.active, x: this.active.x + dx, y: this.active.y + dy };
    return true;
  }

  tryRotate(dir) {
    if (!this.active) return false;
    const result = rotatePiece(this.active, dir, this.board);
    if (!result) return false;
    this.spinTrail = {
      type: this.active.type,
      rotation: this.active.rotation,
      x: this.active.x,
      y: this.active.y,
      color: this.active.color,
      framesLeft: 4,
    };
    this.active = result;
    return true;
  }

  _resetLockIfGrounded() {
    if (this.lockResets < MAX_LOCK_RESETS) {
      this.lockTimer = 0;
      this.lockResets++;
    }
  }

  hardDrop() {
    if (!this.active) return;
    const ghostY = this.board.getGhostY(this.active);
    const dist = ghostY - this.active.y;
    if (dist > 0) {
      this.dropTrail = {
        type: this.active.type,
        rotation: this.active.rotation,
        x: this.active.x,
        startY: this.active.y,
        endY: ghostY,
        color: this.active.color,
        framesLeft: 5,
      };
    }
    this.active = { ...this.active, y: ghostY };
    this.score += dist * 2;
    this._lock();
  }

  _lock() {
    if (!this.active) return;
    audio.lock();
    this.board.lockPiece(this.active);
    this.active = null;
  }

  _isOnGround() {
    if (!this.active) return false;
    const cells = PIECES[this.active.type].cells[this.active.rotation]
      .map(([dc, dr]) => [this.active.x + dc, this.active.y + dr + 1]);
    return this.board.collides(cells);
  }

  _fallInterval() {
    return Math.max(50, 1000 - (this.level - 1) * 80);
  }

  // ─── Main update ──────────────────────────────────────────────────

  // Returns { cleared, chains } if a clear happened this frame, otherwise null
  update(dt, actions, opponentGarbageQueue) {
    if (this.dead) return null;

    if (this.dropTrail) {
      this.dropTrail.framesLeft--;
      if (this.dropTrail.framesLeft <= 0) this.dropTrail = null;
    }
    if (this.spinTrail) {
      this.spinTrail.framesLeft--;
      if (this.spinTrail.framesLeft <= 0) this.spinTrail = null;
    }
    if (this.holdAnim && Date.now() - this.holdAnim.startAt >= this.holdAnim.duration) {
      this.holdAnim = null;
    }

    // Run board sand simulation; returns clear result when settling finishes
    const activeCells = this.active ? getAbsoluteCells(this.active) : null;
    const clearResult = this.board.update(dt, activeCells);

    if (clearResult !== null) {
      // Settling just finished — process clears and spawn
      _processClear(this, clearResult, opponentGarbageQueue);
      this.spawn();
      if (this.board.isTopped()) this.dead = true;
      return clearResult;
    }

    // While settling, no player input
    if (this.board.isSettling()) return null;

    // No piece (shouldn't normally happen mid-game, but guard)
    if (!this.active) return null;

    // ── Input ──────────────────────────────────────
    if (actions.hold)      { this.hold();          }
    if (actions.rotateCW)  { if (this.tryRotate(1))  { this._resetLockIfGrounded(); audio.rotate(); } }
    if (actions.rotateCCW) { if (this.tryRotate(-1)) { this._resetLockIfGrounded(); audio.rotate(); } }
    if (actions.left)      { if (this.tryMove(-1, 0)) { this._resetLockIfGrounded(); audio.move(); } }
    if (actions.right)     { if (this.tryMove(1, 0))  { this._resetLockIfGrounded(); audio.move(); } }
    if (actions.hardDrop)  { this.hardDrop(); return null; }

    // ── Gravity ────────────────────────────────────
    const interval = actions.softDrop
      ? Math.max(16, this._fallInterval() / SOFT_MULT)
      : this._fallInterval();

    this.fallTimer += dt;
    while (this.fallTimer >= interval) {
      this.fallTimer -= interval;
      if (!this.tryMove(0, 1)) {
        this.fallTimer = 0;
        break;
      }
      if (actions.softDrop) this.score += 1;
    }

    // ── Lock delay ─────────────────────────────────
    if (this._isOnGround()) {
      this.lockTimer += dt;
      if (this.lockTimer >= LOCK_DELAY) this._lock();
    } else {
      this.lockTimer = 0;
    }

    return null;
  }

  getState() {
    return {
      board:          this.board,
      active:         this.active,
      held:           this.held,
      next:           this.next,
      score:          this.score,
      level:          this.level,
      linesCleared:   this.linesCleared,
      dead:           this.dead,
      garbagePending: this.garbageQueue.pending,
      dropTrail:      this.dropTrail,
      spinTrail:      this.spinTrail,
      holdAnim:       this.holdAnim,
    };
  }

  reset() {
    this.board.reset();
    this.active     = null;
    this.held       = null;
    this.holdUsed   = false;
    this.next       = [];
    this.score      = 0;
    this.level      = 1;
    this.linesCleared = 0;
    this.lockTimer  = 0;
    this.lockResets = 0;
    this.fallTimer  = 0;
    this.dead       = false;
    this.hasCleared = false;
    this.dropTrail  = null;
    this.spinTrail  = null;
    this.holdAnim   = null;
    this.garbageQueue.pending = 0;
    this._bag       = [];
    this._fillNext(3);
    this.spawn();
  }
}

function _processClear(player, result, opponentGarbageQueue) {
  if (!result || result.cleared === 0) return;
  player.hasCleared = true;
  const { cleared, chains } = result;
  const chainMult = [1, 2, 4, 8][Math.min(chains, 3)];
  player.score += cleared * player.level * chainMult;
  player.linesCleared += Math.floor(cleared / 40);
  player.level = Math.floor(player.score / 500) + 1;
  audio.clear();
  if (opponentGarbageQueue && cleared > 0) {
    const rows = _grainsToRows(cleared) + Math.max(0, chains);
    opponentGarbageQueue.pending += rows;
    if (rows > 0) audio.garbage();
  }
}

function _grainsToRows(g) {
  if (g < 20)  return 0;
  if (g < 60)  return 1;
  if (g < 120) return 2;
  if (g < 200) return 3;
  return 4;
}

function _shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
