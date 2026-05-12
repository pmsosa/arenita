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

1. `drawBackground(ctx, bgStyle, w, h, t)` — animated background (replaces the black fill)
2. `_drawBoard(ctx, state, P1.boardX, P1.boardY, P1.cell, P1.sand)` — sand ImageData + particles + ghost + active piece
3. `_drawSidePanel(ctx, state, leftPanelX, boardY, rightPanelX, cell, false)` — hold, next queue, stats
4. `_drawToasts(ctx)` — comic-book toast notifications

### 2P

1. `drawBackground(ctx, bgStyle, w, h, t)` — animated background
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
    const px0 = gx * sand, py0 = gy * sand;
    const inner = sand - 1; // 1px gap on right+bottom; rest gets bevel
    for (let dy = 0; dy < inner; dy++) {
      for (let dx = 0; dx < inner; dx++) {
        const hi = dx < 2 && dy < 2;
        const sh = dx >= inner - 2 || dy >= inner - 2;
        const bev = hi ? 14 : sh ? -14 : 0;
        const i = ((py0 + dy) * bw + (px0 + dx)) * 4;
        data[i] = clamp(r + bev); data[i+1] = clamp(g + bev); data[i+2] = clamp(b + bev); data[i+3] = 255;
      }
    }
  }
}
ctx.putImageData(imgData, bx, by); // single blit to canvas
```

One `putImageData` call per board per frame regardless of how many grains are visible.

---

## Finer Sand Grain Rendering (FEAT-06)

Each grain is rendered with subtle depth cues instead of a flat solid block, making the sand mass look granular rather than painted.

### How it works

Within the `sand × sand` pixel block for each grain:

- **1px gap**: the rightmost column and bottom row of each grain block are left empty (transparent/black), creating visible separation between adjacent grains.
- **Highlight**: the top-left 2×2 pixel corner is brightened by +14 (simulates light from the top-left).
- **Shadow**: pixels within 2px of the bottom or right inner edge are darkened by −14.
- **Base color**: all remaining interior pixels use the grain's stored color (which already includes per-grain variation written at lock time by `lockPieceToSand`).

Bevel values are clamped to [0, 255]. The FEAT-05 `lockAge` brightness boost is applied before the bevel, so newly-locked grains flash bright and then settle into the beveled appearance.

### Constants

| Mode | `sand` | `inner` | Bevel coverage |
|------|--------|---------|----------------|
| 1P   | 12px   | 11px    | 2/11 ≈ 18% each edge |
| 2P   | 10px   | 9px     | 2/9 ≈ 22% each edge |

### Key file

- [src/renderer.js](../src/renderer.js) — `_drawBoard` ImageData loop (the grain fill block)

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

## Sand Dissolve Animation on Piece Lock (FEAT-05)

When a piece locks, its grains flash bright white and decay over 8 frames — a tactile "thud" effect.

### How it works

`Board.lockAge` is a `Uint8Array(SAND_COLS × SAND_ROWS)` that runs in parallel with `Board.grid`. When `lockPieceToSand` writes a grain, it also writes `lockAge[idx] = 8`. During the `_drawBoard` ImageData pass, any grain with `lockAge > 0` gets a brightness boost of `age/8 * 60` added to each RGB channel (clamped to 255), then `lockAge[idx]` is decremented. At 60fps this gives a ~133ms white-flash-to-color settle effect with no physics involvement.

### Key files

- `src/sand.js` — `lockPieceToSand(grid, cells, color, lockAge)` — optional 4th param; writes `lockAge[idx] = 8` for each new grain
- `src/board.js` — `this.lockAge` (Uint8Array, created in constructor, cleared in `reset()`); passed to `lockPieceToSand` in `lockPiece()`
- `src/renderer.js` — `_drawBoard`: reads `state.board.lockAge`, applies boost, decrements in the grain render loop

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

## Comic-Book Toast Notifications (FEAT-01)

Big bold comic-book word explosions in the left panel that fire after each line clear.

### Visual design

- Rendered in the left panel **dead space** below the 3rd Next-piece preview, centered at `(85, 490)`.
- Up to 2 toasts stack simultaneously; when a 3rd arrives the oldest is dropped. Newer toasts sit at the base (`y=490`), older toasts shift up by `90px`.
- Each toast: tilted 8–20° (random sign), starburst polygon background, thick black outline stroke, colored fill on top.
- Scale-in animation over 200ms (0.3→1.0), then fade-out over the last 500ms of lifetime.

### Tiers

| Tier | Trigger | Words | Color | Duration |
|------|---------|-------|-------|----------|
| 0 | First clear ever | BEGINNER! / FIRST! / NICE ONE! | Gold `#FFD700` | 1.8s |
| 1 | Basic clear (chains≤1) | WHAM! / POW! / ZAP! | White | 1.8s |
| 2 | Double chain (chains=2) | KA-POW! / CRUNCH! / BOOM! | Orange `#FF8C00` | 2.0s |
| 3 | Triple+ chain (chains≥3) | OBLITERATED!! / ANNIHILATED!! / MAYHEM!! | Magenta `#FF1493` | 2.2s |

### API

```js
renderer.pushToast(chains, isFirstClear)
```

Called from `game.js._update1P` after each clear result. `chains` is the raw value from `clearResult.chains`; `isFirstClear` is `!player.hasCleared` sampled **before** the player update so it accurately reflects the very first clear.

### Key files

- `src/renderer.js` — `pushToast()`, `_drawStarburst()`, `_drawToasts()` (called at end of `draw1P`)
- `src/game.js` — `_update1P()` captures `wasFirstClear`, calls `pushToast` on clear
- `src/player.js` — `player.hasCleared` boolean, set to `true` on first clear in `_processClear`

---

## Animated Backgrounds (FEAT-03)

Backgrounds are drawn by `src/background.js` before the board each frame. The style is selected by the player in the 3rd menu step and stored on `renderer.bgStyle`.

### API

```js
drawBackground(ctx, style, w, h, t)
// style: 'dark' | 'stars' | 'vaporwave' | 'tessellation' | 'plasma' |
//        'matrix' | 'crt' | 'lava' | 'underwater' | 'landscape' |
//        'glitch' | 'life' | 'reaction'
// t: Date.now() — drives all animations
```

Exported constants for iteration in menus (indices must stay in sync):
```js
BG_STYLES  // ['dark','stars','vaporwave','tessellation','plasma','matrix','crt','lava','underwater','landscape','glitch','life','reaction']
BG_LABELS  // ['Dark','Starfield','Vaporwave','Tessellation','Plasma','Matrix Rain','CRT','Lava Lamp','Underwater','Landscape','Glitch',"Conway's Life",'Reaction-Diffusion']
```

### Styles

| Style | Description |
|---|---|
| `dark` | Flat `#0d0d0d` fill — same as the original default |
| `stars` | 150 background stars (warm/cool/white tinted) plus 5 constellation clusters (Big Dipper, Cassiopeia, Orion, Southern Cross, Leo) with faint connecting lines and per-star twinkle. All data is module-level (no re-roll per frame). |
| `vaporwave` | HSL-cycling gradient sky + floor, radial sun at horizon, scrolling perspective grid. |
| `tessellation` | Diamond lattice (`32px` half-size) drifting downward with hue cycling. |
| `plasma` | 4-wave sine plasma formula on an `8px` cell grid, mapped to fast-cycling HSL. |
| `matrix` | Falling katakana/numeric columns with white head, bright-green shoulder, fading green trail. Character glyphs slowly scramble over time. |
| `crt` | Dark phosphor-green background, 1px scanline bands every 3px, slow-rolling refresh bar, corner vignette. |
| `lava` | 6 sinusoidally-moving metaball blobs on a `10px` coarse grid. Blob field = `Σ r² / d²`; cells above threshold render amber/orange, glow halo below. |
| `underwater` | Dark blue-green gradient, 8 drifting caustic light patches near the floor (radial gradients), 35 rising bubbles with lateral wobble and a small specular highlight. |
| `landscape` | Rolling silhouetted hills (2 layers, front darker) generated from layered sine waves. Stars in sky half, glowing moon with halo. Hills drift very slowly leftward over time. |
| `glitch` | Dark base with random noise bands, horizontal chromatic-aberration tears (red/blue channel-split + white), and a slow VHS tracking bar. Tears accumulate and decay using module-level state; burst mode triggers when `sin(t) > 0.85`. |
| `life` | Conway's Game of Life on a full `113×75` grid (`8px` cells), stepping every ~110ms. Alive cells rendered in hue-cycling `hsla` at 20% opacity. Reinitialises when population drops below 1.5%. |
| `reaction` | Gray-Scott reaction-diffusion on a `113×75` grid (`8px` cells), 3 steps/frame at `dt=0.1`. Parameters: `f=0.055, k=0.062, DA=1.0, DB=0.5` (coral/spot pattern). B-concentration drives both hue offset and lightness; hue base cycles slowly over time. |

### Starfield constellations

Each constellation is a module-level constant with:
- `pts` — array of `[dx, dy]` pixel offsets from the constellation's base position
- `edges` — pairs of `pts` indices to connect with lines
- `ox, oy` — normalized base position (0–1 of canvas)
- `speed` — downward drift rate (very slow; wraps at `oy = 1.0`)

Constellations twinkle: `0.65 + 0.35 * sin(t * 0.0018 + ci * 2.1)` — each one pulses out of phase. Stars within a constellation also twinkle individually.

### Menu integration

`game.js` imports `drawBackground`, `BG_STYLES`, and `BG_LABELS`. The menu flow is now 3 steps:

1. **Step 0** — Mode select (1P / 2P)
2. **Step 1** — Difficulty select (Easy / Medium / Hard)
3. **Step 2** — Background select (13 options, scrollable list — 7 visible at a time, centred on the selected item with "↑ N more / ↓ N more" hints)

At step 2 the selected background animates live behind the picker UI (with a `rgba(0,0,0,0.55)` overlay so text stays readable). Pressing Enter starts the game.

`renderer.bgStyle` is reset to `'dark'` when the player returns to the main menu.

### Key files

- `src/background.js` — `drawBackground()`, `BG_STYLES`, `BG_LABELS`, 12 private draw functions; module-level state for matrix columns, bubbles, lava blobs, glitch tears, Life grid, and RD buffers
- `src/renderer.js` — imports `drawBackground`, calls it in `draw1P` / `draw2P`; `this.bgStyle` property (default `'dark'`)
- `src/game.js` — imports `drawBackground` / `BG_STYLES` / `BG_LABELS`; `this.menuBgStyle` index; step-2 menu rendering; passes `bgStyleIdx` to `_startGame`

---

## Sand Explosion Particles on Line Clear (FEAT-07)

When a blob clears, each removed grain emits a particle that bursts outward, arcs off the board, and fades out.

### How it works

`detectAndClearBlobsOnce` in `sand.js` accepts an optional `onClear(idx, r, g, b)` callback. For each grain about to be zeroed, the callback fires — `board.js` forwards it to `ParticleSystem.emitGrain()`.

Each particle stores:
- `x, y` — position in **sand-grid coordinates** (fractional, starts at grain centre)
- `vx, vy` — velocity in sand-grid units per frame; initial `vy` is biased upward (−0.4) so grains burst out before gravity pulls them down
- `r, g, b` — the grain's color at time of clear
- `life` (1.0 → 0) and `decay` per frame (~0.03–0.07, giving ~15–35 frame lifetimes)

Every frame `ParticleSystem.update()` applies gravity (`vy += 0.045`), integrates position, decrements life, and compacts dead particles in-place. This runs unconditionally in `Board.update()` so particles continue animating after settling completes.

The renderer calls `_drawParticles(ctx, particles, bx, by, sand)` immediately after `putImageData`, before the ghost and active piece. Each particle renders as a `sand × 0.45` px square via `ctx.fillRect`, with `globalAlpha` set to `life × 0.9`. Canvas coordinates are derived as `bx + p.x * sand` / `by + p.y * sand`, so particles can fly outside the board bounds over the background — they are not clipped.

Chain clears stack naturally: particles from the first clear are still alive (and mid-arc) when the second chain fires ~330ms later.

### Key files

- [src/particles.js](../src/particles.js) — `ParticleSystem` class (`emitGrain`, `update`, `clear`)
- [src/sand.js](../src/sand.js) — `detectAndClearBlobsOnce(grid, onClear)` — optional callback before each grain is zeroed
- [src/board.js](../src/board.js) — `this.particles` (`ParticleSystem`); `update()` calls `particles.update()` each frame and passes callback to `detectAndClearBlobsOnce`; `reset()` calls `particles.clear()`
- [src/renderer.js](../src/renderer.js) — `_drawParticles()` called in `_drawBoard` after `putImageData`

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
