import { World } from './render/world.js';
import { FX } from './render/fx.js';
import { Game } from './game/game.js';
import { Input } from './game/input.js';
import { UI } from './ui/ui.js';

const ui = new UI();
const world = new World(document.getElementById('gl'), { shadows: ui.settings.shadows, sharp: ui.settings.sharp });
const fx = new FX(world.scene);
const game = new Game(world, fx, ui);
ui.bind(game, world);
new Input(world.renderer.domElement, world, game, ui);

window.addEventListener('resize', () => world.resize());
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  world.update(dt, game.mode === 'title');
  game.update(dt);
  fx.update(dt);
  world.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// exposed for debugging and tests
window.__game = { game, world, ui, fx };
