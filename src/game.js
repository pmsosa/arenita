import { Player } from './player.js';
import { Renderer } from './renderer.js';
import { InputManager } from './input.js';
import { audio } from './audio.js';

export const STATE = {
  MENU:       'MENU',
  PLAYING_1P: 'PLAYING_1P',
  PLAYING_2P: 'PLAYING_2P',
  PAUSED:     'PAUSED',
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
    this.menuSelection = 0; // 0=1P, 1=2P
    this.menuItems = ['1 Player', '2 Players'];

    this._setupMenuKeys();
  }

  _setupMenuKeys() {
    this._menuKeyHandler = (e) => {
      if (this.state !== STATE.MENU) return;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        this.menuSelection = (this.menuSelection + this.menuItems.length - 1) % this.menuItems.length;
      }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        this.menuSelection = (this.menuSelection + 1) % this.menuItems.length;
      }
      if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyZ') {
        this._startGame(this.menuSelection + 1);
      }
      if (e.code === 'Digit1') this._startGame(1);
      if (e.code === 'Digit2') this._startGame(2);
    };
    window.addEventListener('keydown', this._menuKeyHandler);
  }

  _startGame(numPlayers) {
    this.players = [];
    if (numPlayers === 1) {
      this.state = STATE.PLAYING_1P;
      this.renderer.setupFor1P();
      this.players.push(new Player(0));
    } else {
      this.state = STATE.PLAYING_2P;
      this.renderer.setupFor2P();
      this.players.push(new Player(0));
      this.players.push(new Player(1));
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
        this._update1P(dt, playerActions[0]);
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

      case STATE.GAMEOVER:
        if (global.restart) {
          this.state = STATE.MENU;
          this.menuSelection = 0;
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
    p.update(dt, actions, null);

    if (p.dead) {
      audio.gameover();
      this.state = STATE.GAMEOVER;
    }

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

  _drawMenu() {
    const ctx = this.renderer.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, cw, ch);

    // Title
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 52px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ARENITA', cw / 2, 170);

    ctx.fillStyle = '#888';
    ctx.font = '16px monospace';
    ctx.fillText('Sand Tetris', cw / 2, 205);

    // Menu items
    for (let i = 0; i < this.menuItems.length; i++) {
      const selected = i === this.menuSelection;
      ctx.fillStyle = selected ? '#FFD700' : '#555';
      ctx.font = selected ? 'bold 24px monospace' : '20px monospace';
      const prefix = selected ? '▶ ' : '  ';
      ctx.fillText(prefix + this.menuItems[i], cw / 2, 290 + i * 55);
    }

    // Controls hint
    ctx.fillStyle = '#444';
    ctx.font = '12px monospace';
    ctx.fillText('↑↓ to select  ·  Enter / 1 / 2 to start', cw / 2, ch - 40);

    ctx.fillStyle = '#333';
    ctx.font = '11px monospace';
    ctx.fillText('P1: WASD + Q/E + Shift    P2: Arrows + ,/. + Shift', cw / 2, ch - 20);

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

  destroy() {
    this.input.destroy();
    window.removeEventListener('keydown', this._menuKeyHandler);
  }
}
