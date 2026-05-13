// Cellular automata sand simulation
// Sand grid: 20 cols × 40 rows (2× the 10×20 tetromino grid)
// Grid stored as flat Uint32Array: 0=empty, otherwise packed ABGR color

export const SAND_SCALE = 4; // tetromino-to-sand scale factor (each tetromino cell = SAND_SCALE×SAND_SCALE grains)
export const SAND_COLS = 40;
export const SAND_ROWS = 80;

export function createSandGrid() {
  return new Uint32Array(SAND_COLS * SAND_ROWS);
}

export function getCell(grid, x, y) {
  if (x < 0 || x >= SAND_COLS || y < 0 || y >= SAND_ROWS) return -1; // out of bounds
  return grid[y * SAND_COLS + x];
}

export function setCell(grid, x, y, val) {
  if (x < 0 || x >= SAND_COLS || y < 0 || y >= SAND_ROWS) return;
  grid[y * SAND_COLS + x] = val;
}

export function packColor(r, g, b) {
  return 0xFF000000 | (b << 16) | (g << 8) | r;
}

export function unpackColor(val) {
  return [(val) & 0xFF, (val >> 8) & 0xFF, (val >> 16) & 0xFF];
}

// Build a Set of sand-grid coords occupied by the active piece (tetromino coords → sand coords)
function buildOccupied(activeCells) {
  const set = new Set();
  if (!activeCells) return set;
  for (const [tx, ty] of activeCells) {
    const sx = tx * SAND_SCALE, sy = ty * SAND_SCALE;
    for (let dy = 0; dy < SAND_SCALE; dy++)
      for (let dx = 0; dx < SAND_SCALE; dx++)
        set.add(`${sx+dx},${sy+dy}`);
  }
  return set;
}

function isOccupiedByPiece(occupied, x, y) {
  return occupied.has(`${x},${y}`);
}

// One simulation step for the sand grid
// activeCells: array of [tx, ty] tetromino-grid cells occupied by the active piece
// Returns true if any grain moved (board is still settling)
export function stepSand(grid, activeCells) {
  const occupied = buildOccupied(activeCells);
  let moved = false;

  // Iterate bottom-to-top, alternating left-to-right / right-to-left each call
  const leftToRight = Math.random() < 0.5;

  for (let y = SAND_ROWS - 2; y >= 0; y--) {
    const startX = leftToRight ? 0 : SAND_COLS - 1;
    const endX = leftToRight ? SAND_COLS : -1;
    const stepX = leftToRight ? 1 : -1;

    for (let x = startX; x !== endX; x += stepX) {
      const grain = getCell(grid, x, y);
      if (!grain) continue;

      const below = getCell(grid, x, y + 1);
      const belowOccupied = isOccupiedByPiece(occupied, x, y + 1);

      if (below === 0 && !belowOccupied) {
        setCell(grid, x, y + 1, grain);
        setCell(grid, x, y, 0);
        moved = true;
        continue;
      }

      // Try diagonal
      const dLeft = leftToRight ? -1 : 1;
      const dRight = leftToRight ? 1 : -1;

      let fell = false;
      for (const dx of [dLeft, dRight]) {
        const nx = x + dx;
        if (nx < 0 || nx >= SAND_COLS) continue;
        const diag = getCell(grid, nx, y + 1);
        const diagOccupied = isOccupiedByPiece(occupied, nx, y + 1);
        const side = getCell(grid, nx, y);
        const sideOccupied = isOccupiedByPiece(occupied, nx, y);
        if (diag === 0 && !diagOccupied && side === 0 && !sideOccupied) {
          setCell(grid, nx, y + 1, grain);
          setCell(grid, x, y, 0);
          moved = true;
          fell = true;
          break;
        }
      }
    }
  }
  return moved;
}

// Run sand simulation until fully settled (or max iterations)
export function settleSand(grid, activeCells, maxSteps = 200) {
  for (let i = 0; i < maxSteps; i++) {
    if (!stepSand(grid, activeCells)) break;
  }
}

// Convert a tetromino piece into sand grains
// piece: {type, rotation, x, y}, cells: absolute [tx,ty] list, color: [r,g,b]
// lockAge: optional parallel Uint8Array — set to 8 for each new grain (dissolve animation)
export function lockPieceToSand(grid, cells, color, lockAge) {
  for (const [tx, ty] of cells) {
    const sx = tx * SAND_SCALE;
    const sy = ty * SAND_SCALE;
    for (let dy = 0; dy < SAND_SCALE; dy++) {
      for (let dx = 0; dx < SAND_SCALE; dx++) {
        const gx = sx + dx;
        const gy = sy + dy;
        if (gx < 0 || gx >= SAND_COLS || gy < 0 || gy >= SAND_ROWS) continue;
        // Slight color variation
        const r = Math.min(255, Math.max(0, color[0] + Math.floor((Math.random() - 0.5) * 20)));
        const g = Math.min(255, Math.max(0, color[1] + Math.floor((Math.random() - 0.5) * 20)));
        const b = Math.min(255, Math.max(0, color[2] + Math.floor((Math.random() - 0.5) * 20)));
        const idx = gy * SAND_COLS + gx;
        grid[idx] = packColor(r, g, b);
        if (lockAge) lockAge[idx] = 8;
      }
    }
  }
}

// Single-pass version: find and clear one batch of spanning blobs without looping or settling.
// onClear(idx, r, g, b) is called for each grain just before it is zeroed (optional).
// Returns { cleared: number of grains removed }
export function detectAndClearBlobsOnce(grid, onClear) {
  const clearSets = findClearComponents(grid);
  let cleared = 0;
  for (const comp of clearSets) {
    for (const idx of comp) {
      if (onClear) {
        const [r, g, b] = unpackColor(grid[idx]);
        onClear(idx, r, g, b);
      }
      grid[idx] = 0;
      cleared++;
    }
  }
  return { cleared };
}

// Detect and remove wall-spanning same-color blobs
// Returns { cleared: number of grains removed, chains: number of chain clears }
export function detectAndClearBlobs(grid) {
  let totalCleared = 0;
  let chains = 0;

  let again = true;
  while (again) {
    again = false;
    const clearSets = findClearComponents(grid);

    if (clearSets.length > 0) {
      let batchCleared = 0;
      for (const comp of clearSets) {
        for (const idx of comp) {
          grid[idx] = 0;
          batchCleared++;
        }
      }
      totalCleared += batchCleared;
      chains++;
      // Let sand settle after clear
      settleSand(grid, null);
      again = true;
    }
  }

  return { cleared: totalCleared, chains: chains > 0 ? chains - 1 : 0 };
}

// Garbage (gray) grains have low color saturation — they can't be wall-cleared
function isGarbage(val) {
  const r = val & 0xFF, g = (val >> 8) & 0xFF, b = (val >> 16) & 0xFF;
  return Math.max(r, g, b) - Math.min(r, g, b) < 50;
}

// Find all connected same-color components that span left wall to right wall
function findClearComponents(grid) {
  const visited = new Uint8Array(SAND_COLS * SAND_ROWS);
  const results = [];

  const leftWallGrains = [];
  for (let y = 0; y < SAND_ROWS; y++) {
    const idx = y * SAND_COLS;
    if (grid[idx] && !isGarbage(grid[idx])) {
      leftWallGrains.push({ idx, color: grid[idx] });
    }
  }

  for (const { idx, color } of leftWallGrains) {
    if (visited[idx]) continue;

    const component = bfsComponent(grid, visited, idx, color);
    if (component === null) continue; // didn't reach right wall

    results.push(component);
  }

  return results;
}

function bfsComponent(grid, visited, startIdx, color) {
  const queue = [startIdx];
  const component = [];
  visited[startIdx] = 1;
  let touchesRight = false;

  while (queue.length > 0) {
    const idx = queue.pop();
    component.push(idx);

    const x = idx % SAND_COLS;
    const y = Math.floor(idx / SAND_COLS);

    if (x === SAND_COLS - 1) touchesRight = true;

    // 4-directional neighbors
    const neighbors = [
      [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]
    ];
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || nx >= SAND_COLS || ny < 0 || ny >= SAND_ROWS) continue;
      const nidx = ny * SAND_COLS + nx;
      if (visited[nidx]) continue;
      if (!isSameColor(grid[nidx], color)) continue;
      visited[nidx] = 1;
      queue.push(nidx);
    }
  }

  return touchesRight ? component : null;
}

// Compare colors with tolerance (to handle slight variation between grains)
function isSameColor(a, b) {
  if (!a || !b) return false;
  // Extract RGB channels and compare with tolerance
  const ar = a & 0xFF, ag = (a >> 8) & 0xFF, ab = (a >> 16) & 0xFF;
  const br = b & 0xFF, bg = (b >> 8) & 0xFF, bb = (b >> 16) & 0xFF;
  return Math.abs(ar - br) <= 30 && Math.abs(ag - bg) <= 30 && Math.abs(ab - bb) <= 30;
}

// Check if top rows have any sand (game over condition)
export function isTopped(grid) {
  for (let x = 0; x < SAND_COLS; x++) {
    if (getCell(grid, x, 0) || getCell(grid, x, 1)) return true;
  }
  return false;
}

// Add garbage rows at top, pushing existing sand down
export function addGarbageRows(grid, numRows) {
  const grayBase = packColor(136, 136, 136);

  // Shift all existing sand down by numRows
  for (let y = SAND_ROWS - 1; y >= numRows; y--) {
    for (let x = 0; x < SAND_COLS; x++) {
      setCell(grid, x, y, getCell(grid, x, y - numRows));
    }
  }
  // Fill top rows with gray garbage (with gaps for visual interest)
  for (let y = 0; y < numRows; y++) {
    for (let x = 0; x < SAND_COLS; x++) {
      // Leave a random gap in each row (classic garbage row style)
      const gap = Math.floor(Math.random() * SAND_COLS);
      if (x !== gap) {
        const v = Math.floor((Math.random() - 0.5) * 30);
        setCell(grid, x, y, packColor(136 + v, 136 + v, 136 + v));
      } else {
        setCell(grid, x, y, 0);
      }
    }
  }
}
