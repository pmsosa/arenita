# Sand Simulation

## Grid Specification

The sand grid runs at **2× resolution** relative to the tetromino board.

| | Cols | Rows |
|---|---|---|
| Tetromino board | 10 | 20 |
| Sand grid | 20 | 40 |

Each tetromino cell maps to a 2×2 block of 4 sand grains. This lets sand flow realistically between piece gaps without the simulation feeling coarse.

**Storage:** flat `Uint32Array` of length `SAND_COLS * SAND_ROWS` (800 cells).

**Encoding:** `0` = empty. Non-zero = packed ABGR color:
```js
packColor(r, g, b) → 0xFF000000 | (b << 16) | (g << 8) | r
unpackColor(val)   → [r, g, b]
```

Defined in `src/sand.js`. Constants exported as `SAND_COLS = 20`, `SAND_ROWS = 40`.

---

## Cellular Automata

### Step Function (`stepSand`)

Runs once per call. Called 3 times per frame from `Board.update()`.

**Iteration order:** bottom-to-top (y = SAND_ROWS-2 down to 0). Direction (left-to-right vs right-to-left) alternates randomly each step to prevent directional bias.

**Per grain at `(x, y)`:**
1. If `(x, y+1)` is empty and not occupied by the active piece → move down
2. Else try diagonal-down-left and diagonal-down-right (respecting active piece) → move to first free diagonal
3. Else → stay

The active piece's tetromino cells are converted to a set of sand coordinates (`buildOccupied`) at the start of each step. Grains treat the falling piece as a solid wall — they pile on top and around it in real time.

**Returns** `true` if any grain moved (board is still unsettled).

### Board Integration (`Board.update`)

```js
// src/board.js
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
        const result = detectAndClearBlobsOnce(this.grid);
        if (result.cleared > 0) {
          // Accumulate and stay settling — sand will fall again, triggering
          // another pass next time it stills (step-mode chain detection)
          this._clearAccum.steps++;
          this.activeChains = this._clearAccum.steps;
        } else {
          // No blobs left — emit final result and exit settling
          this._settling = false;
          this.activeChains = 0;
          return { cleared: this._clearAccum?.cleared ?? 0,
                   chains: (this._clearAccum?.steps ?? 0) - 1 };
        }
      }
    } else {
      this._stillFrames = 0;
    }
  }
  return null;
}
```

Sand always runs every frame — even while a piece is falling. `_settling` is only a flag for whether to check for clears. Clear detection fires after 2 consecutive still frames following a lock.

**Step-mode clearing (FEAT-04):** Instead of the original `detectAndClearBlobs` (which looped all chain steps synchronously in one frame), the board now calls `detectAndClearBlobsOnce` — a single-pass version that clears one batch of blobs and returns. Between passes, the normal 3×/frame `stepSand` loop handles settling. This makes each chain step visible across multiple real frames and gives `game.js` time to apply the slow-mo `timeScale` between passes. `board.activeChains` is updated after each pass so game.js can read the current chain depth.

---

## Locking a Piece

When a piece locks (`Board.lockPiece`):

1. `lockPieceToSand(grid, cells, piece.color, board.lockAge)` is called — the color comes from the piece object itself (assigned at spawn from the difficulty pool), not from `PIECES[type]`.
2. Each tetromino cell `[tx, ty]` expands to 4 sand cells at `[tx*2+dx, ty*2+dy]` for `dx,dy ∈ {0,1}`.
3. Each grain gets **±10 RGB variation** per channel (clamped to 0–255) for visual texture.
4. Each grain also writes `lockAge[idx] = 8` — the renderer uses this to briefly flash the grains bright white (dissolve animation, FEAT-05).
5. `board._settling = true` is set — clear detection will fire once sand settles.

---

## Clear Detection

Detection is split into two functions in `src/sand.js`:

- `detectAndClearBlobsOnce(grid)` — **single-pass, no settling** — used by `Board.update` for step-mode chain detection (FEAT-04). Returns `{ cleared }`.
- `detectAndClearBlobs(grid)` — **legacy looping version** — kept for reference; no longer called by the game loop.

### Algorithm (per pass)

1. **Find seeds:** Collect all non-garbage grains on the left wall (`x = 0`).
2. **BFS per seed:** Flood-fill through grains of the same color (4-directional adjacency, with color tolerance ±30 per channel).
3. **Wall-span check:** If the component touches the right wall (`x = SAND_COLS - 1`), it qualifies for clearing.
4. **Clear:** Zero out all grains in qualifying components.

In step-mode, settling between passes is handled by the regular `stepSand` loop across subsequent frames, not by `settleSand`. This is what makes each chain step visible to the player.

**Color similarity** (`isSameColor`): allows ±30 per RGB channel. This is intentionally wide — grains from the same piece have ±10 variation, so they always match each other. False cross-color matches are prevented by design: every pair of colors in `SAND_COLORS` differs by >50 in at least one channel, so even with ±10 grain variation on both sides (worst case 20 of effective drift), the minimum inter-color distance still exceeds the 30-unit tolerance. See [pieces.md](pieces.md) for the full color pool.

### Garbage Exclusion

Gray garbage grains are excluded from clear detection via `isGarbage(val)`:
```js
isGarbage(val) → max(R,G,B) - min(R,G,B) < 50
```
Low color saturation = garbage. These grains will never be a seed or join a clear component.

---

## Garbage System (2P)

Handled by `_processClear` in `src/player.js` and `addGarbageRows` in `src/sand.js`.

### Sending Garbage

When a player clears, garbage rows are queued to the opponent based on grains cleared:

| Grains cleared | Garbage rows sent |
|---|---|
| < 20 | 0 |
| 20–59 | 1 |
| 60–119 | 2 |
| 120–199 | 3 |
| 200+ | 4 |

Chain clears beyond the first add +1 row per chain link: `rows += Math.max(0, chains)`.

### Delivery Timing

Garbage is stored in `player.garbageQueue.pending`. It is delivered (applied to the board) at the start of the **opponent's next piece spawn** — after a lock + settle cycle completes. This prevents garbage from interrupting an active piece mid-flight.

### Garbage Form

Garbage rows are gray sand grains injected at the **top** of the board, pushing all existing sand down:

```js
// src/sand.js — addGarbageRows
// 1. Shift all existing sand down by numRows rows
// 2. Fill top rows with gray grains (RGB ~136), one random gap per row
```

Each garbage row has exactly one random gap column (like classic Tetris garbage). Garbage grains have near-zero color saturation so `isGarbage` returns true and they cannot be cleared by the color mechanic.

**Undercutting:** If a color clear removes sand beneath a garbage pile, the gray grains fall under gravity like normal sand. Grains that fall past the bottom row are destroyed — skilled players can eliminate garbage by clearing beneath it.

---

## Top-Out Condition

```js
// src/sand.js
isTopped(grid) → any grain at y=0 or y=1
```

Checked after each spawn. If true, `player.dead = true` and game over triggers.

---

## Board Class (`src/board.js`)

`Board` wraps the sand grid and exposes tetromino-aware operations.

| Method | Description |
|---|---|
| `collides(cells)` | True if any tetromino cell is out of bounds or overlaps a sand grain. Skips `ty < 0` (above board is valid). |
| `lockPiece(piece)` | Converts piece to sand, sets `_settling = true`. |
| `update(dt, activeCells)` | Runs 3 sand steps. Returns `{ cleared, chains }` when settling completes (step-mode), else `null`. Sets `activeChains` during multi-clear settling. |
| `isSettling()` | True while waiting for sand to settle after a lock. |
| `isTopped()` | Delegates to `isTopped(grid)`. |
| `getGhostY(piece)` | Drops piece down 1 row at a time until collision — returns landing row. |
| `addGarbage(rows)` | Delegates to `addGarbageRows(grid, rows)`. |
| `reset()` | Zeros the grid and `lockAge`, clears settling state. |

**Collision check detail:** Each tetromino cell `[tx, ty]` maps to 4 sand cells. All 4 are checked against walls, floor (`ty >= BOARD_ROWS` → `gy >= SAND_ROWS`), and non-zero grid values.
