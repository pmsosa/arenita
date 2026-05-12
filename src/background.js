// ─── Starfield state ──────────────────────────────────────────────────────────

const STARS = Array.from({ length: 150 }, () => ({
  x:     Math.random(),
  y:     Math.random(),
  r:     Math.random() * 1.2 + 0.4,
  speed: Math.random() * 0.000014 + 0.000006,
  tint:  Math.floor(Math.random() * 3), // 0=white 1=warm 2=cool
}));

// Constellation clusters — pts are pixel offsets from the base position
const CONSTELLATIONS = [
  { // Big Dipper
    pts:   [[0,34],[22,22],[44,26],[42,44],[44,60],[62,72],[80,66]],
    edges: [[0,1],[1,2],[2,3],[3,0],[3,4],[4,5],[5,6]],
    ox: 0.10, oy: 0.10, speed: 0.0000025,
  },
  { // Cassiopeia W
    pts:   [[0,20],[18,0],[36,22],[54,2],[72,20]],
    edges: [[0,1],[1,2],[2,3],[3,4]],
    ox: 0.58, oy: 0.08, speed: 0.0000018,
  },
  { // Orion — belt + shoulders + feet
    pts:   [[5,0],[58,6],[18,34],[34,34],[50,34],[10,68],[52,68]],
    edges: [[0,2],[1,4],[2,3],[3,4],[2,5],[4,6]],
    ox: 0.28, oy: 0.44, speed: 0.0000022,
  },
  { // Southern Cross
    pts:   [[18,0],[18,44],[0,22],[36,22]],
    edges: [[0,1],[2,3]],
    ox: 0.70, oy: 0.52, speed: 0.0000020,
  },
  { // Leo sickle
    pts:   [[0,32],[20,14],[38,0],[52,12],[52,32],[34,50]],
    edges: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0]],
    ox: 0.14, oy: 0.66, speed: 0.0000028,
  },
];

// ─── Matrix state ─────────────────────────────────────────────────────────────

const MATRIX_CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789';
const MATRIX_CH = 14; // char cell height (px)
const MATRIX_COLS_DATA = Array.from({ length: 80 }, () => ({
  phase:  Math.random() * 2000,
  speed:  Math.random() * 0.024 + 0.014, // rows/ms
  len:    Math.floor(Math.random() * 14 + 8),
  chars:  Array.from({ length: 25 }, () => MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)]),
  cOff:   Math.floor(Math.random() * 25),
}));

// ─── Bubble state ─────────────────────────────────────────────────────────────

const BUBBLES = Array.from({ length: 35 }, () => ({
  x:      Math.random(),
  y:      Math.random(),
  r:      Math.random() * 5 + 2,
  speed:  Math.random() * 0.000025 + 0.000010,
  wobble: Math.random() * 0.0015 + 0.0008,
  wPhase: Math.random() * Math.PI * 2,
}));

// ─── Lava blob state ──────────────────────────────────────────────────────────

const LAVA_BLOBS = Array.from({ length: 6 }, (_, i) => ({
  cx: 0.2 + Math.random() * 0.6, cy: 0.2 + Math.random() * 0.6,
  ax: 0.12 + Math.random() * 0.15, ay: 0.15 + Math.random() * 0.20,
  fx: 0.00014 + Math.random() * 0.00008,
  fy: 0.00011 + Math.random() * 0.00007,
  px: (i / 6) * Math.PI * 2,
  py: (i / 6) * Math.PI * 2 + 1.1,
}));
const LAVA_CELL   = 10;
const LAVA_R_FRAC = 0.075; // blob radius as fraction of min(w,h)

// ─── Glitch state ─────────────────────────────────────────────────────────────

let _glitchLastT = 0;
let _glitchTears = []; // { y, h, shift, life }

// ─── Conway's Life state ──────────────────────────────────────────────────────

const LIFE_CELL = 8;
const LIFE_W    = Math.ceil(900 / LIFE_CELL); // 113
const LIFE_H    = Math.ceil(600 / LIFE_CELL); // 75
const LIFE_N    = LIFE_W * LIFE_H;

let _lifeGrid   = new Uint8Array(LIFE_N);
let _lifeNext   = new Uint8Array(LIFE_N);
let _lifeLastT  = 0;
let _lifeInited = false;

// ─── Reaction-Diffusion state (Gray-Scott) ────────────────────────────────────

const RD_CELL = 8;
const RD_W    = Math.ceil(900 / RD_CELL); // 113
const RD_H    = Math.ceil(600 / RD_CELL); // 75
const RD_N    = RD_W * RD_H;
// Coral/spot parameters — dt=0.1 keeps the explicit Euler step stable
const RD_F = 0.055, RD_K = 0.062, RD_DA = 1.0, RD_DB = 0.5, RD_DT = 0.1;

let _rdA      = new Float32Array(RD_N).fill(1);
let _rdB      = new Float32Array(RD_N);
let _rdNextA  = new Float32Array(RD_N);
let _rdNextB  = new Float32Array(RD_N);
let _rdLastT  = 0;
let _rdInited = false;

// ─── Exports ──────────────────────────────────────────────────────────────────

export const BG_STYLES = [
  'dark', 'stars', 'vaporwave', 'tessellation', 'plasma',
  'matrix', 'crt', 'lava', 'underwater', 'landscape',
  'glitch', 'life', 'reaction',
];
export const BG_LABELS = [
  'Dark', 'Starfield', 'Vaporwave', 'Tessellation', 'Plasma',
  'Matrix Rain', 'CRT', 'Lava Lamp', 'Underwater', 'Landscape',
  'Glitch', "Conway's Life", 'Reaction-Diffusion',
];

export function drawBackground(ctx, style, w, h, t) {
  switch (style) {
    case 'stars':        return _drawStarfield(ctx, w, h, t);
    case 'vaporwave':    return _drawVaporwave(ctx, w, h, t);
    case 'tessellation': return _drawTessellation(ctx, w, h, t);
    case 'plasma':       return _drawPlasma(ctx, w, h, t);
    case 'matrix':       return _drawMatrix(ctx, w, h, t);
    case 'crt':          return _drawCRT(ctx, w, h, t);
    case 'lava':         return _drawLava(ctx, w, h, t);
    case 'underwater':   return _drawUnderwater(ctx, w, h, t);
    case 'landscape':    return _drawLandscape(ctx, w, h, t);
    case 'glitch':       return _drawGlitch(ctx, w, h, t);
    case 'life':         return _drawLife(ctx, w, h, t);
    case 'reaction':     return _drawReaction(ctx, w, h, t);
    default:
      ctx.fillStyle = '#0d0d0d';
      ctx.fillRect(0, 0, w, h);
  }
}

// ─── Starfield ────────────────────────────────────────────────────────────────

function _drawStarfield(ctx, w, h, t) {
  ctx.fillStyle = '#000010';
  ctx.fillRect(0, 0, w, h);

  for (const star of STARS) {
    const y = (star.y + star.speed * t) % 1;
    const b = (0.35 + star.r * 0.30).toFixed(2);
    if      (star.tint === 1) ctx.fillStyle = `rgba(255,235,200,${b})`;
    else if (star.tint === 2) ctx.fillStyle = `rgba(190,210,255,${b})`;
    else                      ctx.fillStyle = `rgba(255,255,255,${b})`;
    ctx.fillRect(star.x * w, y * h, star.r, star.r);
  }

  for (let ci = 0; ci < CONSTELLATIONS.length; ci++) {
    const con = CONSTELLATIONS[ci];
    const bx  = con.ox * w;
    const by  = (con.oy + con.speed * t) % 1 * h;
    const tw  = 0.65 + 0.35 * Math.sin(t * 0.0018 + ci * 2.1); // group twinkle

    ctx.strokeStyle = `rgba(160,200,255,${(0.10 * tw).toFixed(3)})`;
    ctx.lineWidth = 0.8;
    for (const [a, b] of con.edges) {
      ctx.beginPath();
      ctx.moveTo(bx + con.pts[a][0], by + con.pts[a][1]);
      ctx.lineTo(bx + con.pts[b][0], by + con.pts[b][1]);
      ctx.stroke();
    }
    for (let si = 0; si < con.pts.length; si++) {
      const [dx, dy] = con.pts[si];
      const st = 0.6 + 0.4 * Math.sin(t * 0.002 + ci * 1.4 + si * 0.9);
      ctx.fillStyle = `rgba(200,225,255,${(0.55 + 0.45 * st).toFixed(3)})`;
      ctx.fillRect(bx + dx - 1, by + dy - 1, 3, 3);
    }
  }
}

// ─── Vaporwave ────────────────────────────────────────────────────────────────

function _drawVaporwave(ctx, w, h, t) {
  const hue = (t * 0.018) % 360;

  const grad = ctx.createLinearGradient(0, 0, 0, h * 0.55);
  grad.addColorStop(0, `hsl(${hue},70%,10%)`);
  grad.addColorStop(1, `hsl(${(hue + 50) % 360},80%,20%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = `hsl(${(hue + 220) % 360},50%,8%)`;
  ctx.fillRect(0, h * 0.55, w, h * 0.45);

  const horizon = h * 0.55, cx = w / 2;
  const sunR    = Math.min(w, h) * 0.12;
  const sg = ctx.createRadialGradient(cx, horizon, 0, cx, horizon, sunR);
  sg.addColorStop(0,   `hsl(${(hue+40)%360},100%,75%)`);
  sg.addColorStop(0.5, `hsl(${(hue+20)%360},100%,55%)`);
  sg.addColorStop(1,   `hsla(${hue},100%,50%,0)`);
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.arc(cx, horizon, sunR, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = `hsla(${(hue+190)%360},100%,65%,0.35)`;
  ctx.lineWidth = 1;
  const scroll = (t * 0.00006) % 0.1;
  for (let i = 0; i < 12; i++) {
    const p = ((i / 12) + scroll) % 1;
    const y = horizon + (h - horizon) * p * p;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  for (let i = -7; i <= 7; i++) {
    const bx = cx + i * (w / 9);
    ctx.beginPath(); ctx.moveTo(cx, horizon); ctx.lineTo(bx, h); ctx.stroke();
  }
}

// ─── Tessellation ─────────────────────────────────────────────────────────────

function _drawTessellation(ctx, w, h, t) {
  ctx.fillStyle = '#06060f';
  ctx.fillRect(0, 0, w, h);
  const sz = 32, dY = (t * 0.012) % (sz * 2), hue = (t * 0.01) % 360;
  ctx.strokeStyle = `hsla(${hue},70%,55%,0.22)`;
  ctx.lineWidth = 1;
  for (let row = -2; row < Math.ceil(h / sz) + 2; row++) {
    for (let col = -1; col < Math.ceil(w / sz) + 1; col++) {
      const cy = row * sz * 2 - dY, cx = col * sz * 2 + (row % 2 === 0 ? 0 : sz);
      ctx.beginPath();
      ctx.moveTo(cx, cy - sz); ctx.lineTo(cx + sz, cy);
      ctx.lineTo(cx, cy + sz); ctx.lineTo(cx - sz, cy);
      ctx.closePath(); ctx.stroke();
    }
  }
}

// ─── Plasma ───────────────────────────────────────────────────────────────────

const PLASMA_CELL = 8;

function _drawPlasma(ctx, w, h, t) {
  const s = t * 0.0007;
  const cols = Math.ceil(w / PLASMA_CELL), rows = Math.ceil(h / PLASMA_CELL);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const nx = col / cols, ny = row / rows;
      const v = (Math.sin(nx * 8 + s)
               + Math.sin(ny * 6 + s * 1.3)
               + Math.sin((nx + ny) * 5 + s * 0.8)
               + Math.sin(Math.sqrt((nx - 0.5) ** 2 + (ny - 0.5) ** 2) * 14 + s * 1.6)) * 0.25;
      const hue = ((v + 1) * 160 + s * 40) % 360;
      ctx.fillStyle = `hsl(${hue},${(90 + Math.sin(v * 3.1) * 10).toFixed(0)}%,${(32 + Math.abs(v) * 22).toFixed(0)}%)`;
      ctx.fillRect(col * PLASMA_CELL, row * PLASMA_CELL, PLASMA_CELL, PLASMA_CELL);
    }
  }
}

// ─── Matrix Rain ──────────────────────────────────────────────────────────────

function _drawMatrix(ctx, w, h, t) {
  ctx.fillStyle = 'rgba(0,8,2,0.93)';
  ctx.fillRect(0, 0, w, h);

  const cols  = Math.floor(w / MATRIX_CH);
  const rows  = Math.ceil(h / MATRIX_CH);
  const colW  = w / cols;
  const cTick = Math.floor(t * 0.003);

  ctx.font = `${MATRIX_CH - 2}px monospace`;
  ctx.textAlign = 'center';

  for (let ci = 0; ci < cols; ci++) {
    const col     = MATRIX_COLS_DATA[ci % MATRIX_COLS_DATA.length];
    const headRow = (col.speed * t + col.phase) % (rows + col.len);

    for (let ri = 0; ri < col.len; ri++) {
      const row = Math.floor(headRow) - ri;
      if (row < 0 || row > rows) continue;
      const prog  = ri / col.len;
      const char  = col.chars[(cTick + col.cOff + ri) % col.chars.length];

      if (ri === 0) {
        ctx.fillStyle = 'rgba(255,255,255,1.0)';
      } else if (ri < 3) {
        ctx.fillStyle = `rgba(180,255,140,${(0.85 - ri * 0.12).toFixed(2)})`;
      } else {
        ctx.fillStyle = `rgba(0,200,50,${Math.max(0, 0.65 - prog * 0.60).toFixed(2)})`;
      }
      ctx.fillText(char, (ci + 0.5) * colW, row * MATRIX_CH);
    }
  }
  ctx.textAlign = 'left';
}

// ─── CRT / Scanlines ──────────────────────────────────────────────────────────

function _drawCRT(ctx, w, h, t) {
  ctx.fillStyle = '#020a02';
  ctx.fillRect(0, 0, w, h);

  // Horizontal scanline bands every 3px
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);

  // Slow rolling refresh bar
  const barY = (t * 0.07) % (h + 50) - 25;
  ctx.fillStyle = 'rgba(100,255,100,0.04)';
  ctx.fillRect(0, barY, w, 35);

  // Corner vignette
  const vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.28, w / 2, h / 2, h * 0.88);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.65)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);

  // Green phosphor tint
  ctx.fillStyle = 'rgba(0,25,0,0.18)';
  ctx.fillRect(0, 0, w, h);
}

// ─── Lava Lamp ────────────────────────────────────────────────────────────────

function _drawLava(ctx, w, h, t) {
  const cols = Math.ceil(w / LAVA_CELL), rows = Math.ceil(h / LAVA_CELL);
  const r    = Math.min(w, h) * LAVA_R_FRAC;
  const r2   = r * r;

  const pos = LAVA_BLOBS.map(b => ({
    x: (b.cx + b.ax * Math.sin(t * b.fx + b.px)) * w,
    y: (b.cy + b.ay * Math.sin(t * b.fy + b.py)) * h,
  }));

  for (let row = 0; row < rows; row++) {
    const py = (row + 0.5) * LAVA_CELL;
    for (let col = 0; col < cols; col++) {
      const px = (col + 0.5) * LAVA_CELL;
      let field = 0;
      for (const p of pos) {
        const dx = px - p.x, dy = py - p.y;
        field += r2 / (dx * dx + dy * dy + 1);
      }
      if (field > 1.0) {
        const heat = Math.min(1.2, field);
        ctx.fillStyle = `rgb(${Math.min(255, Math.floor(200 + heat * 40))},${Math.min(255, Math.floor(50 + heat * 60))},8)`;
      } else if (field > 0.55) {
        ctx.fillStyle = `rgba(140,40,5,${((field - 0.55) / 0.45 * 0.45).toFixed(3)})`;
      } else {
        ctx.fillStyle = '#080402';
      }
      ctx.fillRect(col * LAVA_CELL, row * LAVA_CELL, LAVA_CELL, LAVA_CELL);
    }
  }
}

// ─── Underwater ───────────────────────────────────────────────────────────────

function _drawUnderwater(ctx, w, h, t) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#010912');
  grad.addColorStop(1, '#021820');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Caustic light patches drifting across the floor
  ctx.save();
  ctx.globalAlpha = 0.06;
  const floorY = h * 0.65;
  for (let i = 0; i < 8; i++) {
    const cx = (Math.sin(t * 0.00022 * (i + 1) + i * 1.3) * 0.5 + 0.5) * w;
    const cy = floorY + (Math.sin(t * 0.00015 * (i + 1) + i * 0.7) * 0.5 + 0.5) * (h - floorY) * 0.5;
    const cr = 28 + Math.sin(t * 0.0003 + i) * 12;
    const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
    cg.addColorStop(0, '#80efff');
    cg.addColorStop(1, 'transparent');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // Rising bubbles
  ctx.lineWidth = 1;
  for (const b of BUBBLES) {
    const fy = 1 - ((1 - b.y + b.speed * t) % 1);
    const fx = b.x + Math.sin(t * b.wobble + b.wPhase) * 0.025;
    const px = fx * w, py = fy * h;
    ctx.strokeStyle = `rgba(140,220,255,0.30)`;
    ctx.beginPath(); ctx.arc(px, py, b.r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(200,240,255,0.12)';
    ctx.beginPath(); ctx.arc(px - b.r * 0.3, py - b.r * 0.3, b.r * 0.35, 0, Math.PI * 2); ctx.fill();
  }
}

// ─── Landscape ────────────────────────────────────────────────────────────────

function _hillY(xn, t, speed, bias) {
  return bias
    + 0.07 * Math.sin(xn * 4.0 + t * speed * 0.25)
    + 0.04 * Math.sin(xn * 9.3 + t * speed * 0.18 + 1.4)
    + 0.025 * Math.sin(xn * 17.1 + t * speed * 0.12 + 2.8)
    + 0.012 * Math.sin(xn * 31.0 + t * speed * 0.08 + 0.6);
}

function _drawLandscape(ctx, w, h, t) {
  // Sky
  const grad = ctx.createLinearGradient(0, 0, 0, h * 0.68);
  grad.addColorStop(0, '#020408');
  grad.addColorStop(1, '#060d18');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);

  // Stars (sky half only)
  for (const star of STARS.slice(0, 80)) {
    const b = (0.22 + star.r * 0.18).toFixed(2);
    ctx.fillStyle = `rgba(255,255,255,${b})`;
    ctx.fillRect(star.x * w, star.y * h * 0.62, star.r, star.r);
  }

  // Moon
  const mx = 0.82 * w, my = 0.14 * h;
  const mg = ctx.createRadialGradient(mx, my, 0, mx, my, 28);
  mg.addColorStop(0,   'rgba(255,250,220,0.9)');
  mg.addColorStop(0.55,'rgba(255,248,210,0.45)');
  mg.addColorStop(1,   'rgba(255,250,220,0)');
  ctx.fillStyle = mg;
  ctx.beginPath(); ctx.arc(mx, my, 28, 0, Math.PI * 2); ctx.fill();

  const gg = ctx.createRadialGradient(mx, my, 22, mx, my, 90);
  gg.addColorStop(0, 'rgba(255,250,200,0.05)');
  gg.addColorStop(1, 'rgba(255,250,200,0)');
  ctx.fillStyle = gg;
  ctx.beginPath(); ctx.arc(mx, my, 90, 0, Math.PI * 2); ctx.fill();

  // Back hill (slightly lighter)
  ctx.fillStyle = '#0b1824';
  ctx.beginPath(); ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 4) ctx.lineTo(x, _hillY(x / w, t, 0.00020, 0.58) * h);
  ctx.lineTo(w, h); ctx.closePath(); ctx.fill();

  // Front hill (dark silhouette)
  ctx.fillStyle = '#040810';
  ctx.beginPath(); ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 4) ctx.lineTo(x, _hillY(x / w, t, 0.00025, 0.65) * h);
  ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
}

// ─── Glitch / VHS ─────────────────────────────────────────────────────────────

function _drawGlitch(ctx, w, h, t) {
  const dt = Math.min(t - _glitchLastT, 100);
  _glitchLastT = t;

  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, w, h);

  // Burst mode: sin spike above 0.85
  const burst = Math.sin(t * 0.00013) > 0.85;

  // Random noise band
  if (burst || Math.random() < 0.04) {
    ctx.fillStyle = `rgba(255,255,255,${(Math.random() * 0.05).toFixed(3)})`;
    ctx.fillRect(0, Math.random() * h, w, Math.random() * 10 + 2);
  }

  // Spawn new tears
  if (Math.random() < (burst ? 0.35 : 0.018)) {
    _glitchTears.push({
      y: Math.random() * h, h: Math.random() * 22 + 4,
      shift: (Math.random() - 0.5) * 44,
      life: Math.random() * 160 + 50,
    });
  }

  // Draw and age tears
  _glitchTears = _glitchTears.filter(tear => {
    tear.life -= dt;
    const a = Math.min(1, tear.life / 40) * 0.28;
    // Chromatic aberration: red left, blue right, white on shift
    ctx.fillStyle = `rgba(255,30,30,${(a * 0.5).toFixed(3)})`;
    ctx.fillRect(tear.shift * 0.55, tear.y, w, tear.h);
    ctx.fillStyle = `rgba(30,30,255,${(a * 0.5).toFixed(3)})`;
    ctx.fillRect(-tear.shift * 0.35, tear.y, w, tear.h);
    ctx.fillStyle = `rgba(255,255,255,${(a * 0.22).toFixed(3)})`;
    ctx.fillRect(tear.shift, tear.y, w, tear.h);
    return tear.life > 0;
  });

  // VHS tracking bar — slow rolling dark stripe
  const barY = ((t * 0.022) % (h + 60)) - 30;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, barY, w, 28);
  ctx.fillStyle = 'rgba(255,255,255,0.025)';
  ctx.fillRect(0, barY + 26, w, 3);
}

// ─── Conway's Game of Life ────────────────────────────────────────────────────

function _lifeInit() {
  for (let i = 0; i < LIFE_N; i++) _lifeGrid[i] = Math.random() < 0.3 ? 1 : 0;
  _lifeInited = true;
}

function _lifeStep() {
  for (let y = 0; y < LIFE_H; y++) {
    for (let x = 0; x < LIFE_W; x++) {
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          n += _lifeGrid[((y + dy + LIFE_H) % LIFE_H) * LIFE_W + ((x + dx + LIFE_W) % LIFE_W)];
        }
      }
      const alive = _lifeGrid[y * LIFE_W + x];
      _lifeNext[y * LIFE_W + x] = (alive && (n === 2 || n === 3)) || (!alive && n === 3) ? 1 : 0;
    }
  }
  const tmp = _lifeGrid; _lifeGrid = _lifeNext; _lifeNext = tmp;
}

function _drawLife(ctx, w, h, t) {
  if (!_lifeInited) _lifeInit();

  if (t - _lifeLastT > 110) {
    _lifeStep();
    _lifeLastT = t;
    // Reinitialize if population collapses
    let alive = 0;
    for (let i = 0; i < LIFE_N; i++) alive += _lifeGrid[i];
    if (alive < LIFE_N * 0.015) _lifeInit();
  }

  ctx.fillStyle = '#020208';
  ctx.fillRect(0, 0, w, h);

  const hue = (t * 0.007) % 360;
  const cols = Math.min(Math.ceil(w / LIFE_CELL), LIFE_W);
  const rows = Math.min(Math.ceil(h / LIFE_CELL), LIFE_H);
  ctx.fillStyle = `hsla(${hue},75%,55%,0.20)`;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (_lifeGrid[y * LIFE_W + x]) {
        ctx.fillRect(x * LIFE_CELL + 1, y * LIFE_CELL + 1, LIFE_CELL - 2, LIFE_CELL - 2);
      }
    }
  }
}

// ─── Reaction-Diffusion (Gray-Scott) ─────────────────────────────────────────

function _rdInit() {
  _rdA.fill(1); _rdB.fill(0);
  for (let s = 0; s < 22; s++) {
    const sx = Math.floor(Math.random() * RD_W);
    const sy = Math.floor(Math.random() * RD_H);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const i = ((sy + dy + RD_H) % RD_H) * RD_W + ((sx + dx + RD_W) % RD_W);
        _rdA[i] = 0.5; _rdB[i] = 0.25;
      }
    }
  }
  _rdInited = true;
}

function _rdStep() {
  for (let y = 0; y < RD_H; y++) {
    for (let x = 0; x < RD_W; x++) {
      const i  = y * RD_W + x;
      const xm = x === 0 ? RD_W - 1 : x - 1, xp = x === RD_W - 1 ? 0 : x + 1;
      const ym = y === 0 ? RD_H - 1 : y - 1, yp = y === RD_H - 1 ? 0 : y + 1;
      const a = _rdA[i], b = _rdB[i];
      const lapA = _rdA[ym*RD_W+x] + _rdA[yp*RD_W+x] + _rdA[y*RD_W+xm] + _rdA[y*RD_W+xp] - 4*a;
      const lapB = _rdB[ym*RD_W+x] + _rdB[yp*RD_W+x] + _rdB[y*RD_W+xm] + _rdB[y*RD_W+xp] - 4*b;
      const ab2 = a * b * b;
      _rdNextA[i] = Math.max(0, Math.min(1, a + RD_DT * (RD_DA * lapA - ab2 + RD_F * (1 - a))));
      _rdNextB[i] = Math.max(0, Math.min(1, b + RD_DT * (RD_DB * lapB + ab2 - (RD_K + RD_F) * b)));
    }
  }
  const tA = _rdA; _rdA = _rdNextA; _rdNextA = tA;
  const tB = _rdB; _rdB = _rdNextB; _rdNextB = tB;
}

function _drawReaction(ctx, w, h, t) {
  if (!_rdInited) _rdInit();

  if (t - _rdLastT > 16) {
    _rdStep(); _rdStep(); _rdStep();
    _rdLastT = t;
  }

  const hue  = (t * 0.004) % 360;
  const cols = Math.min(Math.ceil(w / RD_CELL), RD_W);
  const rows = Math.min(Math.ceil(h / RD_CELL), RD_H);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const b = _rdB[y * RD_W + x];
      ctx.fillStyle = `hsl(${((hue + b * 120) % 360).toFixed(0)},${(70 + b * 30).toFixed(0)}%,${(b * 55).toFixed(0)}%)`;
      ctx.fillRect(x * RD_CELL, y * RD_CELL, RD_CELL, RD_CELL);
    }
  }
}
