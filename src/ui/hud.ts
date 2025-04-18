let slider: HTMLInputElement;
let coordsDiv: HTMLDivElement;
let fpsDiv: HTMLDivElement;
let lastFrameTime = performance.now();
let frameCount = 0;
let lastFpsUpdateTime = 0;
let currentFps = 0;


export function initHUD() {
  slider = document.getElementById('chunk-distance') as HTMLInputElement;
  coordsDiv = document.getElementById('player-coords') as HTMLDivElement;
  fpsDiv = document.getElementById('fps') as HTMLDivElement;

  slider.addEventListener('input', () => {
    const { setRenderDistance } = require('../world/ChunkManager');
    setRenderDistance(parseInt(slider.value));
  });
}

export function updateHUD(position: THREE.Vector3) {
  coordsDiv.textContent = `Coordinates: (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`;
  // fps 
  const now = performance.now();
  frameCount++;
  
  // Update FPS every 500ms for smoother display
  if (now - lastFpsUpdateTime > 500) {
    currentFps = Math.round((frameCount * 1000) / (now - lastFpsUpdateTime));
    fpsDiv.textContent = `FPS: ${currentFps}`;
    lastFpsUpdateTime = now;
    frameCount = 0;
  }
  // Enable flat terrain
  // setFlatTerrainMode(true);
}
