export const keyState: Record<string, boolean> = {};

document.addEventListener('keydown', (e) => {
  keyState[e.key.toLowerCase()] = true;
});
document.addEventListener('keyup', (e) => {
  keyState[e.key.toLowerCase()] = false;
});

export function initInput() {
  const canvas = document.getElementById('game-canvas')!;
  const overlay = document.getElementById('start-overlay')!;
  overlay.addEventListener('click', () => {
    overlay.style.display = 'none';
    canvas.requestPointerLock();
  });

  document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas) {
      const camera = require('../renderer/renderer').camera;
      const player = require('../player/player').player;
      player.rotation.y -= e.movementX * 0.002;
      camera.rotation.x -= e.movementY * 0.002;
      camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
    }
  });
}
