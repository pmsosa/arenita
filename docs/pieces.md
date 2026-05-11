# Tetromino System

Defined in `src/tetromino.js`.

---

## Piece Definitions

All 7 standard tetrominoes. Cells are `[col, row]` offsets within a 4×4 bounding box (origin top-left). Each piece has 4 rotation states. Piece **shape** is determined by type; piece **color** is assigned randomly from the active color pool at spawn time (see [Sand Color Pool](#sand-color-pool) below).

| Type | `kickTable` | `spawnX` | `spawnY` |
|---|---|---|---|
| I | `'I'` | 3 | -1 |
| O | `'O'` | 3 | 0 |
| T | `'default'` | 3 | 0 |
| S | `'default'` | 3 | 0 |
| Z | `'default'` | 3 | 0 |
| J | `'default'` | 3 | 0 |
| L | `'default'` | 3 | 0 |

**I spawns at `spawnY = -1`** — one row above the board — so it enters from the top edge naturally.

---

## Sand Color Pool

Colors are **decoupled from piece type**. Every spawned piece gets a random color from `SAND_COLORS` (defined in `src/tetromino.js`). The number of colors available is set by difficulty.

```js
export const SAND_COLORS = [
  [0,   220, 230],  // Cyan
  [240, 120,   0],  // Orange
  [160,   0, 230],  // Purple
  [220,  30,  30],  // Red
  [240, 220,   0],  // Yellow
  [0,    60, 220],  // Blue
  [0,   130,  30],  // Dark Green
];

export const DIFFICULTY_COLOR_COUNTS = { easy: 3, medium: 5, hard: 7 };
```

Colors are ordered so that the first N entries (Easy = 3, Medium = 5, Hard = 7) are maximally distinct — every pair differs by >50 in at least one RGB channel, which ensures the sand clear detection's ±30 tolerance never produces false cross-color matches even with per-grain ±10 variation applied on lock.

The color lives on the **piece object** itself (`piece.color: [r, g, b]`) from spawn through lock, previews, hold, and sand conversion — nothing reads from `PIECES[type].color` at runtime.

---

## Rotation States

Rotation index: 0 = spawn orientation, 1 = CW 90°, 2 = 180°, 3 = CCW 90°.

### I piece
```
State 0:  . . . .    State 1:  . . X .    State 2:  . . . .    State 3:  . X . .
          X X X X              . . X .              . . . .              . X . .
          . . . .              . . X .              X X X X              . X . .
          . . . .              . . X .              . . . .              . X . .
```
### O piece (no rotation — all 4 states identical)
```
          . X X .
          . X X .
          . . . .
```
### T piece
```
State 0:  . X .    State 1:  . X .    State 2:  . . .    State 3:  . X .
          X X X              . X X              X X X              X X .
          . . .              . X .              . X .              . X .
```
### S, Z, J, L — standard SRS orientations (see `PIECES` in `src/tetromino.js` for exact cell arrays).

---

## SRS Wall Kicks

`WALL_KICKS` contains kick offset tables for each rotation transition.

### Default kicks (T, S, Z, J, L)

Each transition has 5 candidate offsets tried in order. First passing offset wins.

| Transition | Offsets `[dx, dy]` |
|---|---|
| 0→1 | `[0,0] [-1,0] [-1,-1] [0,2] [-1,2]` |
| 1→0 | `[0,0] [1,0] [1,1] [0,-2] [1,-2]` |
| 1→2 | `[0,0] [1,0] [1,1] [0,-2] [1,-2]` |
| 2→1 | `[0,0] [-1,0] [-1,-1] [0,2] [-1,2]` |
| 2→3 | `[0,0] [1,0] [1,-1] [0,2] [1,2]` |
| 3→2 | `[0,0] [-1,0] [-1,1] [0,-2] [-1,-2]` |
| 3→0 | `[0,0] [-1,0] [-1,1] [0,-2] [-1,-2]` |
| 0→3 | `[0,0] [1,0] [1,-1] [0,2] [1,2]` |

### I piece kicks (different table)

| Transition | Offsets `[dx, dy]` |
|---|---|
| 0→1 | `[0,0] [-2,0] [1,0] [-2,-1] [1,2]` |
| 1→0 | `[0,0] [2,0] [-1,0] [2,1] [-1,-2]` |
| 1→2 | `[0,0] [-1,0] [2,0] [-1,2] [2,-1]` |
| 2→1 | `[0,0] [1,0] [-2,0] [1,-2] [-2,1]` |
| 2→3 | `[0,0] [2,0] [-1,0] [2,1] [-1,-2]` |
| 3→2 | `[0,0] [-2,0] [1,0] [-2,-1] [1,2]` |
| 3→0 | `[0,0] [1,0] [-2,0] [1,-2] [-2,1]` |
| 0→3 | `[0,0] [-1,0] [2,0] [-1,2] [2,-1]` |

### O piece kicks

All transitions: `[[0,0]]` — O never kicks (it has no meaningful rotation).

**Y-axis note:** These offsets are in screen coordinates (y increases downward), which is the negated form of the Tetris guideline's y-up convention.

---

## Key Functions

### `rotatePiece(piece, dir, board)`

Attempts to rotate a piece. `dir` is `1` (CW) or `-1` (CCW).

1. Computes `nextRot = (rotation + 4 + dir) % 4`.
2. Looks up the kick table for `"from->to"` string key.
3. For each kick offset `[kx, ky]`, applies the offset and checks `board.collides(cells)`.
4. Returns the first non-colliding result as a new piece object, or `null` if all kicks fail.

### `getAbsoluteCells(piece)`

Returns absolute `[col, row]` positions on the board for all cells of a piece at its current position and rotation. Used throughout for collision checks and rendering.

### `spawnPiece(type, color)`

Returns `{ type, rotation: 0, x: def.spawnX, y: def.spawnY, color }`. Always spawns at rotation 0. `color` is a `[r, g, b]` array drawn from the active difficulty pool; it is stored on the piece object and carried forward into sand locking and preview rendering.

---

## 7-Bag Randomizer

Each `Player` instance manages its own bag (`this._bag`). There is also a module-level `nextFromBag` export in `tetromino.js` but it is not used at runtime — the per-player logic in `player.js` is what runs.

```js
// src/player.js
_nextType() {
  if (this._bag.length === 0)
    this._bag = _shuffle(['I','O','T','S','Z','J','L']);
  return this._bag.pop();
}
```

The bag is a shuffled copy of all 7 types. Pieces are popped from the end. When the bag empties a new shuffle runs. This guarantees you see every piece type within any 7-piece window (no type can repeat more than ~12 pieces apart).

`this.next` always holds 3 upcoming pieces — `_fillNext(3)` tops it up after each draw. Each entry in `this.next` is a `{ type, color }` object so the preview can render the correct color before the piece spawns. `this.held` is likewise `{ type, color }` or `null`.
