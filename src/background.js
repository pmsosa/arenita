// ─── Starfield ────────────────────────────────────────────────────────────────

// Background stars: more of them, varied size/speed/tint
const STARS = Array.from({ length: 150 }, () => ({
  x:     Math.random(),
  y:     Math.random(),
  r:     Math.random() * 1.2 + 0.4,
  speed: Math.random() * 0.000014 + 0.000006,
  // slight warm/cool tint for depth
  tint:  Math.floor(Math.random() * 3), // 0=white, 1=warm, 2=cool
}));

// Constellations: pixel-offset star positions + connecting edges
// pts = [dx, dy] offsets from the constellation's base position
// ox,oy = normalized base position (0–1), speed = downward drift
const CONSTELLATIONS = [
  { // Big Dipper — bowl + handle
    pts: [[0,34],[22,22],[44,26],[42,44],[44,60],[62,72],[80,66]],
    edges: [[0,1],[1,2],[2,3],[3,0],[3,4],[4,5],[5,6]],
    ox: 0.10, oy: 0.10, speed: 0.0000025,
  },
  { // Cassiopeia — W shape
    pts: [[0,20],[18,0],[36,22],[54,2],[72,20]],
    edges: [[0,1],[1,2],[2,3],[3,4]],
    ox: 0.58, oy: 0.08, speed: 0.0000018,
  },
  { // Orion — belt + shoulders + feet
    pts: [[5,0],[58,6],[18,34],[34,34],[50,34],[10,68],[52,68]],
    edges: [[0,2],[1,4],[2,3],[3,4],[2,5],[4,6]],
    ox: 0.28, oy: 0.44, speed: 0.0000022,
  },
  { // Southern Cross — two crossed lines
    pts: [[18,0],[18,44],[0,22],[36,22],[28,6]],
    edges: [[0,1],[2,3]],
    ox: 0.70, oy: 0.52, speed: 0.0000020,
  },
  { // Leo — sickle head + body
    pts: [[0,32],[20,14],[38,0],[52,12],[52,32],[34,50]],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0]],
    ox: 0.14, oy: 0.66, speed: 0.0000028,
  },
];

// ─── Plasma ───────────────────────────────────────────────────────────────────

const PLASMA_CELL = 8; // px — coarse pixel grid size

// ─── Exports ──────────────────────────────────────────────────────────────────

export const BG_STYLES = ['dark', 'stars', 'vaporwave', 'tessellation', 'plasma'];
export const BG_LABELS  = ['Dark', 'Starfield', 'Vaporwave', 'Tessellation', 'Plasma'];

/**
 * Draw the animated background for the given style.
 * t = Date.now() — drives all animations.
 */
export function drawBackground(ctx, style, w, h, t) {
  switch (style) {
    case 'stars':        return _drawStarfield(ctx, w, h, t);
    case 'vaporwave':    return _drawVaporwave(ctx, w, h, t);
    case 'tessellation': return _drawTessellation(ctx, w, h, t);
    case 'plasma':       return _drawPlasma(ctx, w, h, t);
    default:
      ctx.fillStyle = '#0d0d0d';
      ctx.fillRect(0, 0, w, h);
  }
}

// ─── Starfield impl ───────────────────────────────────────────────────────────

function _drawStarfield(ctx, w, h, t) {
  ctx.fillStyle = '#000010';
  ctx.fillRect(0, 0, w, h);

  // Background stars
  for (const star of STARS) {
    const y = (star.y + star.speed * t) % 1;
    const brightness = 0.35 + star.r * 0.30;
    if (star.tint === 1) {
      ctx.fillStyle = `rgba(255,235,200,${brightness.toFixed(2)})`;
    } else if (star.tint === 2) {
      ctx.fillStyle = `rgba(190,210,255,${brightness.toFixed(2)})`;
    } else {
      ctx.fillStyle = `rgba(255,255,255,${brightness.toFixed(2)})`;
    }
    ctx.fillRect(star.x * w, y * h, star.r, star.r);
  }

  // Constellations
  for (let ci = 0; ci < CONSTELLATIONS.length; ci++) {
    const con = CONSTELLATIONS[ci];
    const baseY = (con.oy + con.speed * t) % 1;
    const bx = con.ox * w;
    const by = baseY * h;

    // Twinkle: each constellation pulses slightly out of phase
    const twinkle = 0.65 + 0.35 * Math.sin(t * 0.0018 + ci * 2.1);

    // Connection lines — very faint
    ctx.strokeStyle = `rgba(160,200,255,${(0.10 * twinkle).toFixed(3)})`;
    ctx.lineWidth = 0.8;
    for (const [a, b] of con.edges) {
      const [ax, ay] = con.pts[a];
      const [bpx, bpy] = con.pts[b];
      ctx.beginPath();
      ctx.moveTo(bx + ax, by + ay);
      ctx.lineTo(bx + bpx, by + bpy);
      ctx.stroke();
    }

    // Constellation stars — brighter, slightly larger
    for (let si = 0; si < con.pts.length; si++) {
      const [dx, dy] = con.pts[si];
      const starTwinkle = 0.6 + 0.4 * Math.sin(t * 0.002 + ci * 1.4 + si * 0.9);
      const alpha = (0.55 + 0.45 * starTwinkle).toFixed(3);
      ctx.fillStyle = `rgba(200,225,255,${alpha})`;
      ctx.fillRect(bx + dx - 1, by + dy - 1, 3, 3);
    }
  }
}

// ─── Vaporwave impl ───────────────────────────────────────────────────────────

function _drawVaporwave(ctx, w, h, t) {
  const hue = (t * 0.018) % 360;

  const grad = ctx.createLinearGradient(0, 0, 0, h * 0.55);
  grad.addColorStop(0, `hsl(${hue}, 70%, 10%)`);
  grad.addColorStop(1, `hsl(${(hue + 50) % 360}, 80%, 20%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = `hsl(${(hue + 220) % 360}, 50%, 8%)`;
  ctx.fillRect(0, h * 0.55, w, h * 0.45);

  const horizon = h * 0.55;
  const cx = w / 2;

  const sunR = Math.min(w, h) * 0.12;
  const sunGrad = ctx.createRadialGradient(cx, horizon, 0, cx, horizon, sunR);
  sunGrad.addColorStop(0,   `hsl(${(hue + 40) % 360}, 100%, 75%)`);
  sunGrad.addColorStop(0.5, `hsl(${(hue + 20) % 360}, 100%, 55%)`);
  sunGrad.addColorStop(1,   `hsla(${hue}, 100%, 50%, 0)`);
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(cx, horizon, sunR, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `hsla(${(hue + 190) % 360}, 100%, 65%, 0.35)`;
  ctx.lineWidth = 1;

  const scroll = (t * 0.00006) % 0.1;
  for (let i = 0; i < 12; i++) {
    const p = ((i / 12) + scroll) % 1;
    const y = horizon + (h - horizon) * p * p;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  for (let i = -7; i <= 7; i++) {
    const bx = cx + i * (w / 9);
    ctx.beginPath();
    ctx.moveTo(cx, horizon);
    ctx.lineTo(bx, h);
    ctx.stroke();
  }
}

// ─── Tessellation impl ────────────────────────────────────────────────────────

function _drawTessellation(ctx, w, h, t) {
  ctx.fillStyle = '#06060f';
  ctx.fillRect(0, 0, w, h);

  const sz = 32;
  const driftY = (t * 0.012) % (sz * 2);
  const hue = (t * 0.01) % 360;

  ctx.strokeStyle = `hsla(${hue}, 70%, 55%, 0.22)`;
  ctx.lineWidth = 1;

  for (let row = -2; row < Math.ceil(h / sz) + 2; row++) {
    for (let col = -1; col < Math.ceil(w / sz) + 1; col++) {
      const cy = row * sz * 2 - driftY;
      const cx = col * sz * 2 + (row % 2 === 0 ? 0 : sz);
      ctx.beginPath();
      ctx.moveTo(cx,      cy - sz);
      ctx.lineTo(cx + sz, cy);
      ctx.lineTo(cx,      cy + sz);
      ctx.lineTo(cx - sz, cy);
      ctx.closePath();
      ctx.stroke();
    }
  }
}

// ─── Plasma impl ──────────────────────────────────────────────────────────────

function _drawPlasma(ctx, w, h, t) {
  const s = t * 0.0007;
  const cols = Math.ceil(w / PLASMA_CELL);
  const rows = Math.ceil(h / PLASMA_CELL);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Normalized coords with slight swirl distortion
      const nx = col / cols;
      const ny = row / rows;

      // Four overlapping sine waves — classic plasma formula
      const v1 = Math.sin(nx * 8  + s);
      const v2 = Math.sin(ny * 6  + s * 1.3);
      const v3 = Math.sin((nx + ny) * 5 + s * 0.8);
      const v4 = Math.sin(Math.sqrt((nx - 0.5) ** 2 + (ny - 0.5) ** 2) * 14 + s * 1.6);
      const v  = (v1 + v2 + v3 + v4) * 0.25; // -1 .. 1

      // Map to a fast-cycling hue with high saturation
      const hue = ((v + 1) * 160 + s * 40) % 360;
      const sat = 90 + Math.sin(v * 3.1) * 10;
      const lit = 32 + Math.abs(v) * 22;

      ctx.fillStyle = `hsl(${hue},${sat.toFixed(0)}%,${lit.toFixed(0)}%)`;
      ctx.fillRect(col * PLASMA_CELL, row * PLASMA_CELL, PLASMA_CELL, PLASMA_CELL);
    }
  }
}
