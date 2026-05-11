# Sand Tetris — Design Document

## Overview

A web game combining Tetris-style piece dropping with a sand/particle physics simulation. Supports **single-player** (score attack) and **local 2-player split-screen** (competitive) modes. Pieces dissolve instantly into sand grains on lock. Clears happen when a same-colored blob of sand connects wall-to-wall — removing the entire connected component and scoring based on volume removed. Chain reactions are possible as sand collapses into newly cleared space.

---

## Core Concept

**Standard Tetris:** 7 tetrominoes, wall kicks (SRS), hold piece, level scaling.

**Sand twist:** When a piece locks, its cells instantly dissolve into individual sand grains that settle under gravity. Sand grains treat the active falling piece as a solid obstacle — they pile up around and on top of it in real time. Grains always retain the color of their source piece.

**Clear condition:** A clear triggers when a same-colored connected blob of sand grains forms a continuous path touching **both the left wall and the right wall simultaneously**. The entire connected component of that color is removed — not just a row, but the full irregular blob. Sand above the cleared region then falls under gravity, potentially triggering chain clears.

The strategic goal is to layer same-colored pieces so their sand flows together into a wall-spanning connection. Mixing colors carelessly buries your paths and makes future clears harder.

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Language | Vanilla JS (ES2022 modules) | No build step, full game loop control |
| Rendering | Canvas 2D API | Direct pixel manipulation, ideal for cellular automata |
| Entry point | Single `index.html` | Portable, zero deploy friction |
| Module bundler | None (native ES modules) | Keeps it simple for a game this size |

---

## Screen Layout

### Menu Screen
```
┌────────────────────────────┐
│         SAND TETRIS        │
│                            │
│     [1 Player]             │
│     [2 Players]            │
│                            │
└────────────────────────────┘
```

### Single Player
```
┌──────┬────────────┬───────┐
│ Next │  Board     │ Score │
│ Hold │  10×20     │ Level │
│      │            │ Lines │
└──────┴────────────┴───────┘
```
**Canvas dimensions:** 560px × 600px. Board centered, side panels for Hold/Next/stats.

### 2-Player Split Screen
```
┌─────────────────────────────────────────────┐
│              SAND TETRIS          [ESC=Pause]│
├──────────────┬──────┬──────────────────────┤
│  P1 Board    │  vs  │  P2 Board            │
│  (WASD)      │      │  (Arrow Keys)        │
│              │ scr  │                      │
│  10×20 grid  │ lvl  │  10×20 grid          │
│              │      │                      │
│  Next/Hold   │      │  Next/Hold           │
└──────────────┴──────┴──────────────────────┘
```
**Canvas dimensions:** 900px × 600px total.
- Each board: 300px wide × 540px tall
- Center strip: 300px (scores, level, next piece previews)

---

## Sand Grid

The sand simulation runs at **2× resolution** relative to the Tetromino grid:

- Tetromino grid: 10 cols × 20 rows
- Sand grid: 20 cols × 40 rows (each Tetromino cell = a 2×2 block of sand grains)

This gives the sand realistic "flow" behaviour without the piece snapping feeling too coarse. Each grain stores:

```js
// Cell states (stored in Uint8Array for performance)
const EMPTY = 0;
const SAND  = 1;  // + color index packed into high bits

// Grid is a flat Uint32Array: [state | (r << 8) | (g << 16) | (b << 24)]
```

---

## Architecture

```
index.html
  └── main.js               Entry point, canvas init, game loop
      ├── game.js           Top-level state machine (menu/playing/paused/gameover)
      ├── input.js          Keyboard handler, per-player input queues
      ├── player.js         Per-player state: board, active piece, score, level
      │   ├── board.js      Sand grid + Tetromino locked state, line detection
      │   ├── tetromino.js  Piece definitions, SRS rotation, wall kicks
      │   └── sand.js       Cellular automata update step
      ├── garbage.js        Cross-player garbage queue
      ├── renderer.js       Draws both boards + UI onto the canvas
      └── audio.js          Optional: Web Audio API sound effects
```

### Game Loop

```js
// main.js
function loop(timestamp) {
  const dt = timestamp - lastTime;
  lastTime = timestamp;

  input.flush();           // drain keyboard events into player queues
  game.update(dt);         // update both players + garbage exchange
  renderer.draw(game);     // render both boards to canvas

  requestAnimationFrame(loop);
}
```

**Update budget per frame (60fps → ~16ms):**
- Input processing: < 0.1ms
- Tetromino physics (×2): < 0.5ms
- Sand simulation (×2 boards, 20×40 grids): < 3ms
- Line detection + garbage: < 0.5ms
- Render: < 5ms

---

## Player State (`player.js`)

```js
class Player {
  board          // Board instance (owns the sand grid)
  activePiece    // { type, rotation, x, y }
  nextPiece      // queued with 7-bag randomizer
  heldPiece      // { type } or null; holdUsed flag resets on each lock
  holdUsed       // bool: can only hold once per piece drop
  score
  level
  linesCleared
  lockDelay      // ms remaining before piece locks (500ms, reset on move)
  dasCharge      // delayed auto-shift charge
  arrCharge      // auto-repeat rate charge
  garbageQueue   // incoming garbage rows pending (2P only)
}
```

---

## Tetromino System (`tetromino.js`)

Standard 7 pieces (I, O, T, S, Z, J, L) with SRS rotation tables and wall kick data.

**Piece colors (used as sand grain colors):**
```
I → Cyan    O → Yellow   T → Purple
S → Green   Z → Red      J → Blue    L → Orange
```

**Controls:**

| Action | P1 (WASD) | P2 (Arrows) |
|---|---|---|
| Move left/right | A / D | ← / → |
| Soft drop | S | ↓ |
| Hard drop | W | ↑ |
| Rotate CW | E | . (period) |
| Rotate CCW | Q | , (comma) |
| Hold piece | Shift (left) | Shift (right) |

**DAS/ARR:** 167ms initial delay, 33ms repeat (standard competitive values, configurable).

---

## Board & Sand Simulation (`board.js`, `sand.js`)

### Locking a Piece

When a piece locks:
1. Convert each Tetromino cell (1 cell = 2×2 sand cells) into 4 sand grains with the piece's color.
2. Add slight color variation (±10 RGB) per grain for visual texture.
3. Trigger sand settle animation.

### Cellular Automata Rules (`sand.js`)

Runs **bottom-to-top, alternating left-to-right / right-to-left each frame** to avoid directional bias.

For each grain at `(x, y)`:
```
1. If (x, y+1) is EMPTY and not occupied by the active piece → move down
2. Else if (x-1, y+1) is EMPTY and not occupied by the active piece → move down-left
3. Else if (x+1, y+1) is EMPTY and not occupied by the active piece → move down-right
4. Else → stay (grain is settled)
```

The active piece's cell coordinates are checked each sand update step so grains treat it as a solid obstacle — they pile on top of it and around it in real time.

Grains at the bottom row (y = maxY) cannot move down — they stay.

**Performance:** Use a dirty-region tracker. Only simulate rows that had activity in the previous frame, scanning up from the lowest active row.

### Clear Detection

Run after the sand fully settles following a lock event (not every frame — only when the board changes).

**Algorithm (per color):**
1. Collect all grains of a given color that touch the **left wall** (x = 0). These are seeds.
2. BFS/DFS flood-fill through same-color grains (4-directional adjacency).
3. If the resulting connected component contains any grain touching the **right wall** (x = maxX), a clear is triggered.
4. Remove every grain in that component from the grid.
5. Let the remaining sand above fall (gravity re-runs until the board is settled).
6. After settling, re-run clear detection — chain clears are possible.

**Multiple colors can clear in the same settle cycle** if separate components each span wall-to-wall. Resolve them simultaneously before re-running gravity.

**Score:**
```
grains_removed × level_multiplier
```
Chain clears (triggered by falling sand after a clear) apply an increasing multiplier:
```
Chain 1 (base clear): ×1
Chain 2:              ×2
Chain 3:              ×4
Chain 4+:             ×8
```

Level increases every 500 points. Gravity (piece fall interval) scales with level.

---

## Garbage System (`garbage.js`) — 2P Only

When a player triggers a clear, garbage is queued to the opponent based on grains removed:

| Grains removed | Garbage rows sent |
|---|---|
| < 20 | 0 |
| 20–59 | 1 |
| 60–119 | 2 |
| 120–199 | 3 |
| 200+ | 4 |

Chain clears add +1 garbage row per chain link beyond the first.

**Garbage delivery:** Pending garbage is applied when the opponent's next piece spawns.

**Garbage form:** Rows of gray sand grains injected at the **top** of the opponent's sand grid, pushing existing sand down. Gray sand cannot be part of any color-matching clear — it is inert to the clear mechanic. However, if a colored clear removes sand beneath a garbage pile, the gray grains fall under gravity like normal sand. If they fall off the **bottom of the board** they are destroyed — so skilled players can eliminate garbage by undercutting it with a well-placed clear.

**Top-out:** Triggered when any sand grain (including garbage) reaches the **spawn row** at the top of the board. Game over for that player.

---

## Game State Machine (`game.js`)

```
MENU ──[1P]──→ PLAYING_1P ──[ESC]──→ PAUSED ──[ESC]──→ PLAYING_1P
  │                │                                         
  │            [top-out]                                     
  │                ↓                                         
  │            GAMEOVER ──[R]──→ MENU                        
  │                                                          
  └──[2P]──→ PLAYING_2P ──[ESC]──→ PAUSED ──[ESC]──→ PLAYING_2P
                 │                                           
             [top-out]                                       
                 ↓                                           
             GAMEOVER ──[R]──→ MENU
```

**1P win condition:** Game ends on top-out. Show final score, level, lines cleared.

**2P win condition:** The other player tops out. The remaining player wins. Show winner screen with both final scores.

---

## Renderer (`renderer.js`)

Single canvas, drawn each frame:

1. **Clear** canvas (black background).
2. **Draw P1 board:** iterate sand grid, paint each grain as a 1px dot (since sand grid is 20×40, scale to board pixel dimensions).
3. **Draw P1 active piece:** render on top as semi-transparent colored block.
4. **Draw P1 ghost piece:** where piece would land, shown as faint outline.
5. **Draw P1 hold/next panels:** held piece and upcoming piece.
6. **Repeat for P2** on right half (2P mode only).
7. **Draw center strip (2P) / side panels (1P):** scores, level, next piece, hold piece, garbage meter.

**Sand rendering via ImageData** (fast path):
```js
const imgData = ctx.createImageData(boardW, boardH);
// Write RGBA bytes directly into imgData.data[]
// Then ctx.putImageData(imgData, boardX, boardY) once per board
```

This avoids per-grain `fillRect` calls and is ~10× faster for dense particle grids.

---

## Visual Style

- **Background:** Near-black (`#0d0d0d`)
- **Board border:** Thin bright line (`#ffffff` at 40% opacity)
- **Sand grains:** Tetromino colors with per-grain variation and a subtle "sparkle" shader (random brightness oscillation for settled grains)
- **Garbage sand:** Gray (`#888`) with darker variation
- **UI text:** Monospace font, white/yellow
- **Line clear flash:** Brief white flash on cleared rows before they vanish
- **Garbage warning:** Red border pulse on receiving player's board when garbage is incoming

---

## Audio (`audio.js`) — Optional

Web Audio API, no external files needed:

| Event | Sound |
|---|---|
| Piece move | Short tick (sine wave, 200Hz, 20ms) |
| Piece rotate | Tick (400Hz) |
| Piece lock | Thud (noise burst, 80ms) |
| Line clear | Chime (C5 chord, 200ms) |
| Tetris | Fanfare (arpeggio) |
| Garbage sent | Swoosh |
| Game over | Descending tone |

---

## File Structure

```
Games/
  index.html
  style.css
  src/
    main.js
    game.js
    input.js
    player.js
    board.js
    tetromino.js
    sand.js
    garbage.js
    renderer.js
    audio.js
```

---

## Out of Scope (v1)

- Online multiplayer (WebSockets)
- Persistent leaderboards
- Mobile / touch controls
- Replays
- Custom keybindings UI
- AI opponent

---

## Open Questions / Future Considerations

- **Board bottom behavior for garbage:** The board bottom is currently a hard floor — gray garbage that falls off the bottom is destroyed. This is intentional (reward for undercutting garbage). No open questions remain on this.
