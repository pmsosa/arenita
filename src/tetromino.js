// Standard SRS tetromino definitions
// Cells are [col, row] offsets in a 4x4 bounding box, origin top-left

export const PIECE_TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

// Colorblind-friendly sand color pool — ordered easy→hard
// Each pair differs by >50 in at least one channel so isSameColor(tol=30) never cross-matches
export const SAND_COLORS = [
  [0,   220, 230],  // Cyan
  [240, 120,   0],  // Orange
  [160,   0, 230],  // Purple
  [220,  30,  30],  // Red
  [240, 220,   0],  // Yellow
  [0,    60, 220],  // Blue
  [0,   130,  30],  // Dark Green (distinct from yellow for colorblind users)
];

export const DIFFICULTY_COLOR_COUNTS = { easy: 3, medium: 5, hard: 7 };

export const PIECES = {
  I: {
    color: [0, 240, 240],
    cells: [
      [[0,1],[1,1],[2,1],[3,1]],
      [[2,0],[2,1],[2,2],[2,3]],
      [[0,2],[1,2],[2,2],[3,2]],
      [[1,0],[1,1],[1,2],[1,3]],
    ],
    kickTable: 'I',
    spawnX: 3,
    spawnY: -1,
  },
  O: {
    color: [240, 240, 0],
    cells: [
      [[1,0],[2,0],[1,1],[2,1]],
      [[1,0],[2,0],[1,1],[2,1]],
      [[1,0],[2,0],[1,1],[2,1]],
      [[1,0],[2,0],[1,1],[2,1]],
    ],
    kickTable: 'O',
    spawnX: 3,
    spawnY: 0,
  },
  T: {
    color: [160, 0, 240],
    cells: [
      [[1,0],[0,1],[1,1],[2,1]],
      [[1,0],[1,1],[2,1],[1,2]],
      [[0,1],[1,1],[2,1],[1,2]],
      [[1,0],[0,1],[1,1],[1,2]],
    ],
    kickTable: 'default',
    spawnX: 3,
    spawnY: 0,
  },
  S: {
    color: [0, 240, 0],
    cells: [
      [[1,0],[2,0],[0,1],[1,1]],
      [[1,0],[1,1],[2,1],[2,2]],
      [[1,1],[2,1],[0,2],[1,2]],
      [[0,0],[0,1],[1,1],[1,2]],
    ],
    kickTable: 'default',
    spawnX: 3,
    spawnY: 0,
  },
  Z: {
    color: [240, 0, 0],
    cells: [
      [[0,0],[1,0],[1,1],[2,1]],
      [[2,0],[1,1],[2,1],[1,2]],
      [[0,1],[1,1],[1,2],[2,2]],
      [[1,0],[0,1],[1,1],[0,2]],
    ],
    kickTable: 'default',
    spawnX: 3,
    spawnY: 0,
  },
  J: {
    color: [0, 0, 240],
    cells: [
      [[0,0],[0,1],[1,1],[2,1]],
      [[1,0],[2,0],[1,1],[1,2]],
      [[0,1],[1,1],[2,1],[2,2]],
      [[1,0],[1,1],[0,2],[1,2]],
    ],
    kickTable: 'default',
    spawnX: 3,
    spawnY: 0,
  },
  L: {
    color: [240, 160, 0],
    cells: [
      [[2,0],[0,1],[1,1],[2,1]],
      [[1,0],[1,1],[1,2],[2,2]],
      [[0,1],[1,1],[2,1],[0,2]],
      [[0,0],[1,0],[1,1],[1,2]],
    ],
    kickTable: 'default',
    spawnX: 3,
    spawnY: 0,
  },
};

// SRS wall kick tables — offsets in screen coords (y increases downward)
// Negated y from Tetris guideline (which uses y-up)
export const WALL_KICKS = {
  default: {
    '0->1': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    '1->0': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
    '1->2': [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
    '2->1': [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
    '2->3': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
    '3->2': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    '3->0': [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
    '0->3': [[0,0],[1,0],[1,-1],[0,2],[1,2]],
  },
  I: {
    '0->1': [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
    '1->0': [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
    '1->2': [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
    '2->1': [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
    '2->3': [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],
    '3->2': [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],
    '3->0': [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],
    '0->3': [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],
  },
  O: {
    '0->1': [[0,0]],
    '1->0': [[0,0]],
    '1->2': [[0,0]],
    '2->1': [[0,0]],
    '2->3': [[0,0]],
    '3->2': [[0,0]],
    '3->0': [[0,0]],
    '0->3': [[0,0]],
  },
};

export function getPieceCells(type, rotation, x, y) {
  return PIECES[type].cells[rotation].map(([dc, dr]) => [x + dc, y + dr]);
}

export function getAbsoluteCells(piece) {
  return getPieceCells(piece.type, piece.rotation, piece.x, piece.y);
}

export function rotatePiece(piece, dir, board) {
  const nextRot = (piece.rotation + 4 + dir) % 4;
  const kickKey = `${piece.rotation}->${nextRot}`;
  const kicks = WALL_KICKS[PIECES[piece.type].kickTable][kickKey] || [[0,0]];

  for (const [kx, ky] of kicks) {
    const nx = piece.x + kx;
    const ny = piece.y + ky;
    const cells = getPieceCells(piece.type, nextRot, nx, ny);
    if (!board.collides(cells)) {
      return { ...piece, rotation: nextRot, x: nx, y: ny };
    }
  }
  return null; // rotation failed
}

export function spawnPiece(type, color) {
  const def = PIECES[type];
  return { type, rotation: 0, x: def.spawnX, y: def.spawnY, color: color || def.color };
}

let bag = [];
export function nextFromBag() {
  if (bag.length === 0) bag = shuffle([...PIECE_TYPES]);
  return bag.pop();
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
