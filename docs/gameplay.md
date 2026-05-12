# Gameplay

## Core Concept

Pieces fall Tetris-style, but on lock they dissolve into individual sand grains that settle under gravity. Clears are not row-based — a clear triggers when a **same-colored connected blob of sand spans both walls simultaneously**. The entire connected component is removed, not just a row.

Strategic goal: layer same-colored pieces so their sand flows together into a wall-spanning bridge. Mixing colors buries paths and makes future clears harder.

---

## State Machine

Defined in `src/game.js`. States are string constants in the `STATE` object.

```
MENU ──[Enter/1/2]──→ MENU (difficulty) ──[Enter]──→ MENU (background) ──[Enter]──→ PLAYING_1P ──[ESC]──→ PAUSED
 (mode)                     │                              │                               │               ──[ESC]──→ PLAYING_1P
                        [ESC/Back]                    [ESC/Back]                       [top-out]
                             ↓                             ↓                               ↓
                           MENU                       MENU (difficulty)              FLOODING ──[~3s]──→ GAMEOVER ──[R]──→ MENU

                                                                       PLAYING_2P ──[ESC]──→ PAUSED ──[ESC]──→ PLAYING_2P
                                                                           │
                                                                       [top-out]
                                                                           ↓
                                                                       GAMEOVER ──[R]──→ MENU
```

**Menu is three-step:**
1. **Mode step** (`menuStep = 0`): choose 1 Player or 2 Players. Navigate with ↑↓ or W/S. Press Enter/Space/Z to advance, or `1`/`2` as shortcuts that jump straight to difficulty.
2. **Difficulty step** (`menuStep = 1`): choose Easy (3 colors), Medium (5 colors), or Hard (7 colors). Navigate with ↑↓ or W/S. Press Enter to advance, Escape/Backspace to go back.
3. **Background step** (`menuStep = 2`): choose an animated background style. The selected style renders live behind the picker. Press Enter to start, Escape/Backspace to go back to difficulty.

**Paused state** redraws the current game boards underneath the pause overlay — both players' boards remain visible.

**FLOODING state (1P only)** plays a ~3-second sand flood animation when the player tops out. Random-colored grains rain from the top of the board using the same sand simulation, visually filling the board before the score overlay appears. The flood runs for 180 frames (~3s at 60fps) then transitions to GAMEOVER. 2P deaths skip FLOODING and go directly to GAMEOVER.

**Canvas size** changes with mode: 560×600 for 1P, 900×600 for 2P. Returning to menu resets to 560×600.

---

## Difficulty

Difficulty controls how many colors are in the sand color pool. More colors → harder to form same-color wall-spanning blobs.

| Difficulty | Colors available | Strategic effect |
|---|---|---|
| Easy | 3 | Sand quickly consolidates into large same-color masses; clears come frequently |
| Medium | 5 | Moderate color mixing; requires some planning |
| Hard | 7 | Maximum color variety; wall-spanning blobs require careful stacking |

The color pool is passed to each `Player` constructor at game start. Both players in 2P share the same pool.

---

## Win Conditions

**1P:** Game ends on top-out. Final score, level, and lines cleared are shown.

**2P:** The player whose opponent tops out wins. If both top out on the same frame, it's a draw (`winner = 0`). The winner screen shows both players' final scores.

---

## Scoring

Handled in `_processClear` inside `src/player.js`.

```
score += grains_cleared × level × chain_multiplier
```

Chain multipliers (0-indexed by chain number):

| Chain | Multiplier |
|---|---|
| 1st clear (base) | ×1 |
| 2nd | ×2 |
| 3rd | ×4 |
| 4th+ | ×8 |

**Level** is derived from score, not a separate counter:
```js
level = Math.floor(score / 500) + 1
```

**Lines cleared** (displayed stat) increments by `Math.floor(grains / 40)` per clear event — loosely maps grain count to "lines" for the display.

**Hard drop bonus:** 2 points per row snapped downward.

**Soft drop bonus:** 1 point per gravity tick while soft dropping.

---

## Piece Fall Speed

```js
// src/player.js
_fallInterval() {
  return Math.max(50, 1000 - (this.level - 1) * 80);
}
```

At level 1: 1000ms per row. Each level subtracts 80ms, floored at 50ms (level ~13+).

Soft drop uses `max(16, interval / 10)` — 10× faster, minimum 16ms per row.

---

## Lock Delay

A grounded piece does not lock immediately. From `src/player.js`:

- **Delay:** 500ms (`LOCK_DELAY`)
- **Resets:** Each successful move or rotation while grounded resets the timer
- **Max resets:** 15 (`MAX_LOCK_RESETS`) — prevents infinite stalling

The piece locks immediately on hard drop regardless of delay.

---

## Controls

### Player 1 — WASD or Arrow keys (1P mode only)

In single-player mode both key sets are merged — either works independently.

| Action | WASD | Arrow keys |
|---|---|---|
| Move left | A | ← |
| Move right | D | → |
| Soft drop | S | ↓ |
| Hard drop | W | ↑ |
| Rotate CW | E | — |
| Rotate CCW | Q | — |
| Hold | Shift Left | — |

In 2P mode, Arrow keys are exclusively Player 2's controls.

### Player 2 (2P mode only)

| Action | Key |
|---|---|
| Move left | ← |
| Move right | → |
| Soft drop | ↓ |
| Hard drop | ↑ |
| Rotate CW | . (period) |
| Rotate CCW | , (comma) |
| Hold | Shift Right |

### Global

| Action | Key |
|---|---|
| Pause / Resume | Escape |
| Return to menu | R (on game over screen) |

---

## DAS / ARR (Auto-Repeat)

Implemented in `src/input.js`. Standard competitive timing.

- **DAS (Delayed Auto-Shift):** 167ms — time after first keypress before auto-repeat begins
- **ARR (Auto-Repeat Rate):** 33ms — interval between repeated moves during auto-repeat

**Behavior on first press:** fires a move immediately, starts DAS charge (`dasActive = false`).  
**After 167ms:** `dasActive = true`, ARR accumulator starts. Fires a move every 33ms thereafter.  
**Releasing:** resets all DAS/ARR state.  
**Simultaneous L+R:** ignored (neither fires).

Hard drop, rotation, and hold are instant-on-press only — they do not repeat.

---

## Hold Piece

- Hold is available once per piece drop (`holdUsed` flag).
- If the hold slot is empty, the current piece is held and the next piece spawns immediately.
- If the hold slot is occupied, the two pieces swap. The swapped-in piece spawns fresh at rotation 0.
- Lock timer and fall timer reset on hold.
- `holdUsed` is cleared when the next piece spawns (after a lock + settle cycle).

---

## 7-Bag Randomizer

Each player has their own independent bag. The bag is a shuffled list of all 7 piece types. Pieces are drawn from the end until the bag is empty, then a new shuffle runs. This guarantees at most 12 pieces between any two of the same type.

The `next` queue shows the next 3 upcoming pieces (1P mode shows all 3 in the side panel, 2P shows 1 in the mini preview).
