# Rendering & Audio

## Canvas Layout

Single `<canvas id="game">` element. Size changes with game mode.

### 1P Layout — 560×600

```
x=0                                              x=560
  ┌──────────┬────────────────────┬────────────┐
  │ Left     │   Board            │ Right      │
  │ Panel    │   10×20 cells      │ Panel      │
  │ x=10     │   x=160, y=60      │ x=412      │
  │          │   240×480px        │            │
  │ HOLD     │   cell=24px        │ SCORE      │
  │ NEXT×3   │                    │ LEVEL      │
  │          │                    │ LINES      │
  └──────────┴────────────────────┴────────────┘
```

Constants in `src/renderer.js`:
```js
const CELL = 24;        // tetromino cell px
const SAND = CELL / 2;  // sand grain px = 12
const P1 = {
  canvasW: 560, canvasH: 600,
  boardX: 160, boardY: 60,
  leftPanelX: 10, rightPanelX: 412,
  cell: CELL, sand: SAND,
};
```

### 2P Layout — 900×600

```
x=0      x=210  x=450  x=690              x=900
  ┌────────┬──────┬──────┬────────────────┐
  │ P1     │ Garb │Center│ Garb │ P2      │
  │ Board  │ Meter│Strip │ Meter│ Board   │
  │ x=10   │      │      │      │ x=690   │
  │ 200×400│      │      │      │ 200×400 │
  │ cell=20│      │      │      │ cell=20 │
  ├────────┴──────┴──────┴──────┴─────────┤
  │ Mini hold/next previews below boards   │
  └─────────────────────────────────────────┘
```

```js
const C2 = 20;    // cell px in 2P mode
const S2 = C2/2;  // sand grain px = 10
const BW2 = BOARD_COLS * C2;    // 200
const BH2 = BOARD_ROWS * C2;    // 400
const P2L = { boardX: 10,  boardY: 100, cell: C2, sand: S2 };
const P2R = { boardX: 690, boardY: 100, cell: C2, sand: S2 };
const CENTER_MID = (P2L.boardX + BW2 + P2R.boardX) / 2; // ≈ 450
```

---

## Draw Calls Per Frame

### 1P

1. Fill canvas black
2. `_drawBoard(ctx, state, P1.boardX, P1.boardY, P1.cell, P1.sand)` — sand + ghost + active piece
3. `_drawSidePanel(ctx, state, leftPanelX, boardY, rightPanelX, cell, false)` — hold, next queue, stats

### 2P

1. Fill canvas black
2. `_drawBoard` for each player
3. Mini hold/next labels + `_drawPiecePreview` below each board (9px cells)
4. `_drawCenterStrip` — title, P1/P2 labels, scores, level, "vs" text
5. `_drawGarbageMeter` for each player (red bar between board and center strip)

### Overlays

- `drawPaused(isTwo)` — semi-transparent black rect + text. Call after the board draw.
- `drawGameOver1P(state)` / `drawGameOver2P(stateL, stateR, winner)` — same pattern.

---

## Sand Rendering (ImageData Fast Path)

Drawing 800 individual sand grains per board with `fillRect` would be ~10× slower. Instead:

```js
// src/renderer.js — _drawBoard
const imgData = ctx.createImageData(bw, bh); // bw=boardW, bh=boardH in pixels
const data = imgData.data;                    // Uint8ClampedArray, RGBA format

for (let gy = 0; gy < SAND_ROWS; gy++) {
  for (let gx = 0; gx < SAND_COLS; gx++) {
    const val = grid[gy * SAND_COLS + gx];
    if (!val) continue;
    const [r, g, b] = unpackColor(val);
    // Each sand grain fills a sand×sand pixel block
    const px0 = gx * sand, py0 = gy * sand;
    for (let py = py0; py < py0 + sand; py++) {
      for (let px = px0; px < px0 + sand; px++) {
        const i = (py * bw + px) * 4;
        data[i] = r; data[i+1] = g; data[i+2] = b; data[i+3] = 255;
      }
    }
  }
}
ctx.putImageData(imgData, bx, by); // single blit to canvas
```

One `putImageData` call per board per frame regardless of how many grains are visible.

---

## Ghost and Active Piece

Drawn on top of the sand ImageData (so they appear above the settled sand).

**Color source:** `state.active.color` — the `[r, g, b]` array stored directly on the piece object when it spawned. The renderer never looks up colors from `PIECES[type]`.

**Ghost piece** (where the piece would land):
- Computed by `board.getGhostY(piece)` — drops 1 row at a time until collision
- Drawn as semi-transparent fill + stroke: `rgba(r,g,b,0.25)` fill, `rgba(r,g,b,0.6)` outline
- Cells at `ty < 0` (above board) are skipped

**Active piece:**
- Drawn at `rgba(r,g,b,0.85)` — slightly transparent so sand beneath is still visible
- Cells at `ty < 0` skipped

Both use `cell - 1` pixel width/height for a 1px gap between cells.

---

## Side Panel (1P)

`_drawSidePanel(ctx, state, leftX, boardY, rightX, cell, _compact)`

**Left panel (hold + next):**
- `HOLD` label, then `_drawPiecePreview` at `cell * 0.75` size
- `NEXT` label, then up to 3 next pieces via `_drawPiecePreview` at `cell * 0.65` size, spaced 85px apart

**Right panel (stats):**
- SCORE (8-digit zero-padded), LEVEL, LINES in white on dark — each label in `#aaa`, value in white

### Piece Preview (`_drawPiecePreview`)

Signature: `_drawPiecePreview(ctx, piece, x, y, cell)`

`piece` is a `{ type, color }` object (matching the shape of `state.held` and `state.next[i]`). Uses rotation 0 cells from `PIECES[type].cells[0]` for shape; color comes from `piece.color`. If `piece` is null (empty hold slot), draws a dark gray `#333` placeholder rectangle.

---

## 2P Center Strip (`_drawCenterStrip`)

Centered at `CENTER_MID ≈ 450`:
- `ARENITA` title in gold (`#FFD700`)
- `[ESC] Pause` hint in dark gray
- P1/P2 labels at `mid ± 120` with scores and level
- `vs` text centered in bold

## Garbage Meter (`_drawGarbageMeter`)

Red vertical bar (`#FF4444`) drawn between the board edge and the center strip. Height = `min(boardH, pending * 15)` pixels, drawn from the bottom up. Only drawn if `pending > 0`.

---

## Visual Style

| Element | Style |
|---|---|
| Background | `#0d0d0d` (near-black) |
| Board border | `rgba(255,255,255,0.4)`, 1px |
| Sand grains | Piece color ± per-grain RGB variation |
| Garbage sand | Gray `~rgb(136,136,136)` with ±15 variation |
| Active piece | `rgba(r,g,b,0.85)` |
| Ghost piece | `rgba(r,g,b,0.25)` fill + `rgba(r,g,b,0.6)` stroke |
| Dead board overlay | `rgba(255,0,0,0.15)` over the board area |
| UI text | `monospace` font, white/gold/gray |

CSS (`style.css`): dark body background, canvas centered with flexbox, `image-rendering: pixelated` for crisp scaling.

---

## Audio (`src/audio.js`)

Web Audio API synthesized sounds — no external files. All wrapped in try/catch so audio failures are silent.

A single `AudioContext` (`ctx`) is created lazily on first use to comply with browser autoplay policies (context must be created after user interaction).

| Sound | Trigger | Implementation |
|---|---|---|
| `move` | Piece moved laterally | Sine, 220Hz, 20ms |
| `rotate` | Piece rotated | Sine, 440Hz, 20ms |
| `lock` | Piece locked | White noise burst, 80ms |
| `clear` | Sand blob cleared | Ascending chord: C5 (523Hz), E5 (659Hz), G5 (784Hz), staggered 50ms apart |
| `garbage` | Garbage sent to opponent | Sawtooth, 180Hz, 100ms |
| `gameover` | Player tops out | 5 descending sine tones (440→200Hz), 120ms apart |

### `playTone(freq, type, duration, gainVal, time)`

Creates an oscillator + gain node, applies an exponential ramp to near-zero at `time + duration`, then stops the oscillator. The `time` parameter offsets from `AudioContext.currentTime` for scheduling chords.

### `playNoise(duration, gainVal)`

Creates a buffer of random samples (white noise), plays once with exponential gain decay.
