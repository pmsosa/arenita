// Keyboard input handler with DAS/ARR support

const DAS_DELAY = 167; // ms before auto-repeat starts
const ARR_RATE  = 33;  // ms between repeats

const P1_KEYS = {
  left:    'KeyA',
  right:   'KeyD',
  softDrop:'KeyS',
  hardDrop:'KeyW',
  rotateCW:'KeyE',
  rotateCCW:'KeyQ',
  hold:    'ShiftLeft',
};

const P2_KEYS = {
  left:    'ArrowLeft',
  right:   'ArrowRight',
  softDrop:'ArrowDown',
  hardDrop:'ArrowUp',
  rotateCW:'Period',
  rotateCCW:'Comma',
  hold:    'ShiftRight',
};

const GLOBAL_KEYS = {
  pause: 'Escape',
  restart: 'KeyR',
};

export class InputManager {
  constructor() {
    this.held = new Set();
    this.justPressed = new Set();

    this.players = [
      createPlayerInput(P1_KEYS),
      createPlayerInput(P2_KEYS),
    ];

    this.globalJust = new Set();

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  _onKeyDown(e) {
    if (this.held.has(e.code)) return; // already held
    this.held.add(e.code);
    this.justPressed.add(e.code);

    // Prevent page scroll for arrow keys and space
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.key)) {
      e.preventDefault();
    }
  }

  _onKeyUp(e) {
    this.held.delete(e.code);
  }

  // Update DAS/ARR and produce action events
  // Returns array of actions per player: [{ left, right, softDrop, hardDrop, rotateCW, rotateCCW, hold }]
  update(dt) {
    const results = this.players.map(pi => {
      const actions = {
        left: false, right: false,
        softDrop: false, hardDrop: false,
        rotateCW: false, rotateCCW: false,
        hold: false,
      };

      // Instant actions (just pressed)
      if (this.justPressed.has(pi.keys.hardDrop)) actions.hardDrop = true;
      if (this.justPressed.has(pi.keys.rotateCW))  actions.rotateCW = true;
      if (this.justPressed.has(pi.keys.rotateCCW)) actions.rotateCCW = true;
      if (this.justPressed.has(pi.keys.hold))       actions.hold = true;

      // Soft drop — repeat while held
      if (this.held.has(pi.keys.softDrop)) actions.softDrop = true;

      // DAS/ARR for left/right
      const heldLeft  = this.held.has(pi.keys.left);
      const heldRight = this.held.has(pi.keys.right);
      const justLeft  = this.justPressed.has(pi.keys.left);
      const justRight = this.justPressed.has(pi.keys.right);

      if (justLeft || justRight) {
        // Fresh key press — fire immediately and start DAS charging
        const dir = justLeft ? 'left' : 'right';
        if (!(justLeft && justRight)) { // ignore simultaneous press of both
          actions[dir] = true;
          pi.dasDir    = dir;
          pi.dasCharge = 0;
          pi.dasActive = false;
          pi.arrCharge = 0;
        }
      } else if ((heldLeft || heldRight) && !(heldLeft && heldRight)) {
        const dir = heldLeft ? 'left' : 'right';
        if (pi.dasDir === dir) {
          if (!pi.dasActive) {
            pi.dasCharge += dt;
            if (pi.dasCharge >= DAS_DELAY) {
              pi.dasActive = true;
              pi.arrCharge = ARR_RATE; // fire immediately on DAS kick-in
            }
          }
          if (pi.dasActive) {
            pi.arrCharge += dt;
            while (pi.arrCharge >= ARR_RATE) {
              actions[dir] = true;
              pi.arrCharge -= ARR_RATE;
            }
          }
        }
      } else if (!heldLeft && !heldRight) {
        pi.dasCharge = 0;
        pi.arrCharge = 0;
        pi.dasActive = false;
        pi.dasDir    = null;
      }

      return actions;
    });

    // Global actions
    const global = {
      pause:   this.justPressed.has(GLOBAL_KEYS.pause),
      restart: this.justPressed.has(GLOBAL_KEYS.restart),
    };

    this.justPressed.clear();

    return { players: results, global };
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }
}

function createPlayerInput(keys) {
  return {
    keys,
    dasCharge: 0,
    arrCharge: 0,
    dasActive: false,
    dasDir: null,
  };
}
