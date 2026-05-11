import { Game } from './game.js';

const canvas = document.getElementById('game');
const game = new Game(canvas);

// Start canvas at menu size
canvas.width  = 560;
canvas.height = 600;

let lastTime = 0;

function loop(timestamp) {
  const dt = Math.min(timestamp - lastTime, 50); // cap at 50ms to avoid huge jumps
  lastTime = timestamp;
  game.update(dt);
  requestAnimationFrame(loop);
}

requestAnimationFrame((t) => {
  lastTime = t;
  requestAnimationFrame(loop);
});
