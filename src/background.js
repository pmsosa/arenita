// Persistent star objects for the starfield style
const STARS = Array.from({ length: 50 }, () => ({
  x: Math.random(),
  y: Math.random(),
  r:     Math.random() * 1.0 + 0.5,
  speed: Math.random() * 0.000015 + 0.000008,
}));

export const BG_STYLES = ['dark', 'stars', 'vaporwave', 'tessellation'];
export const BG_LABELS  = ['Dark', 'Starfield', 'Vaporwave', 'Tessellation'];

/**
 * Draw the animated background for the given style.
 * t = Date.now() — used for animations.
 * For 'dark', just fills the canvas black (same as the default clear).
 */
export function drawBackground(ctx, style, w, h, t) {
  switch (style) {
    case 'stars':        return _drawStarfield(ctx, w, h, t);
    case 'vaporwave':    return _drawVaporwave(ctx, w, h, t);
    case 'tessellation': return _drawTessellation(ctx, w, h, t);
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
    const brightness = 0.4 + star.r * 0.35;
    ctx.fillStyle = `rgba(255,255,255,${brightness.toFixed(2)})`;
    ctx.fillRect(star.x * w, y * h, star.r, star.r);
  }
}

// ─── Vaporwave ────────────────────────────────────────────────────────────────

function _drawVaporwave(ctx, w, h, t) {
  const hue = (t * 0.018) % 360;

  // Sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, h * 0.55);
  grad.addColorStop(0,   `hsl(${hue}, 70%, 10%)`);
  grad.addColorStop(1,   `hsl(${(hue + 50) % 360}, 80%, 20%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Floor
  ctx.fillStyle = `hsl(${(hue + 220) % 360}, 50%, 8%)`;
  ctx.fillRect(0, h * 0.55, w, h * 0.45);

  const horizon = h * 0.55;
  const cx = w / 2;

  // Sun
  const sunR = Math.min(w, h) * 0.12;
  const sunGrad = ctx.createRadialGradient(cx, horizon, 0, cx, horizon, sunR);
  sunGrad.addColorStop(0,   `hsl(${(hue + 40) % 360}, 100%, 75%)`);
  sunGrad.addColorStop(0.5, `hsl(${(hue + 20) % 360}, 100%, 55%)`);
  sunGrad.addColorStop(1,   `hsla(${hue}, 100%, 50%, 0)`);
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(cx, horizon, sunR, 0, Math.PI * 2);
  ctx.fill();

  const gridColor = `hsla(${(hue + 190) % 360}, 100%, 65%, 0.35)`;
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;

  // Scrolling horizontal grid lines (perspective: quadratic spacing)
  const scroll = (t * 0.00006) % 0.1; // slow scroll
  for (let i = 0; i < 12; i++) {
    const p = ((i / 12) + scroll) % 1;
    const y = horizon + (h - horizon) * p * p;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Vertical lines converging to vanishing point
  for (let i = -7; i <= 7; i++) {
    const bx = cx + i * (w / 9);
    ctx.beginPath();
    ctx.moveTo(cx, horizon);
    ctx.lineTo(bx, h);
    ctx.stroke();
  }
}

// ─── Tessellation ─────────────────────────────────────────────────────────────

function _drawTessellation(ctx, w, h, t) {
  ctx.fillStyle = '#06060f';
  ctx.fillRect(0, 0, w, h);

  const sz = 32; // half-size of each diamond (width and height)
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
