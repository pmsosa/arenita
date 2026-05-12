# Arenita — Documentation Index

Arenita is a Sand Tetris clone: pieces dissolve into sand grains on lock, and clears trigger when a same-colored connected blob spans both walls. Vanilla JS ES2022 modules, no build step.

---

## Sections

| Doc | What's in it |
|---|---|
| [gameplay.md](gameplay.md) | Game rules, state machine, scoring, controls, DAS/ARR |
| [simulation.md](simulation.md) | Sand grid, cellular automata, clear detection, garbage system |
| [pieces.md](pieces.md) | Tetromino definitions, SRS wall kicks, 7-bag randomizer |
| [rendering.md](rendering.md) | Canvas layout, ImageData fast path, audio |

---

## Architecture

```
index.html
  └── src/main.js          Entry point — canvas init, rAF game loop
      ├── game.js           Top-level state machine + draw dispatch
      ├── input.js          Keyboard handler, DAS/ARR, per-player queues
      ├── player.js         Per-player state: board, piece, score, hold, next
      │   ├── board.js      Owns sand grid; collision, lock, settle, clear
      │   ├── tetromino.js  Piece defs, SRS rotation, wall kicks, spawn
      │   └── sand.js       Cellular automata: step, lock, detect, garbage
      ├── garbage.js        (GarbageQueue helper — logic mainly in player.js)
      ├── renderer.js       Draws boards + UI onto the single canvas
      └── audio.js          Web Audio API sound effects (no external files)
```

## File Map

| File | Exports |
|---|---|
| `src/main.js` | — (entry point) |
| `src/game.js` | `Game`, `STATE` |
| `src/input.js` | `InputManager` |
| `src/player.js` | `Player` |
| `src/board.js` | `Board`, `BOARD_COLS`, `BOARD_ROWS` |
| `src/tetromino.js` | `PIECES`, `WALL_KICKS`, `PIECE_TYPES`, `SAND_COLORS`, `DIFFICULTY_COLOR_COUNTS`, `getAbsoluteCells`, `rotatePiece`, `spawnPiece` |
| `src/sand.js` | `SAND_COLS`, `SAND_ROWS`, `stepSand`, `lockPieceToSand`, `detectAndClearBlobsOnce`, `detectAndClearBlobs`, `addGarbageRows`, `isTopped`, `packColor`, `unpackColor` |
| `src/renderer.js` | `Renderer` |
| `src/audio.js` | `audio` |

## Game Loop

```js
// src/main.js
function loop(timestamp) {
  const dt = Math.min(timestamp - lastTime, 50); // cap at 50ms
  lastTime = timestamp;
  game.update(dt);          // runs input, physics, sand, clears, draws
  requestAnimationFrame(loop);
}
```

`game.update(dt)` is the single entry point that handles everything — input polling, physics, sand stepping, clear detection, and rendering all happen inside it each frame.

## Tech Stack

- **Language:** Vanilla JS (ES2022 native modules)
- **Rendering:** Canvas 2D API with `ImageData` fast path for sand
- **Audio:** Web Audio API, synthesized — no external audio files
- **Entry:** Single `index.html`, served as static files

## Running Locally

Any static file server works:

```sh
python3 -m http.server 8765
# then open http://localhost:8765
```
