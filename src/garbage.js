// Cross-player garbage queue (2P only)

export function grainsToGarbageRows(grains) {
  if (grains < 20)  return 0;
  if (grains < 60)  return 1;
  if (grains < 120) return 2;
  if (grains < 200) return 3;
  return 4;
}

export class GarbageQueue {
  constructor() {
    this.pending = 0; // rows queued to deliver
  }

  add(grains, chains) {
    let rows = grainsToGarbageRows(grains);
    rows += Math.max(0, chains); // +1 per chain link beyond first
    this.pending += rows;
  }

  // Deliver pending garbage to a board, returns rows delivered
  deliver(board) {
    if (this.pending <= 0) return 0;
    const rows = this.pending;
    this.pending = 0;
    board.addGarbage(rows);
    return rows;
  }

  hasPending() {
    return this.pending > 0;
  }

  clear() {
    this.pending = 0;
  }
}
