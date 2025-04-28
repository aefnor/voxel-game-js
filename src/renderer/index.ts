import { initRenderer, scene, camera } from './renderer';
import { player, playerCharacter } from '../player/player';
import { updateCamera } from '../player/camera';
import { initInput } from '../input/inputhandler';
import { initHUD, updateHUD } from '../ui/hud';
import { initChunkWorker, prerenderArea, processChunkQueue, updateChunks, initializeTownHalls } from '../world/chunkmanager';
import { setFlatTerrainMode } from '../world/terrain';

let frameCount = 0;
const renderer = initRenderer();

function animate() {
  //@ts-ignore
  requestAnimationFrame(animate);
  
  const start = performance.now();
  frameCount++;
  
  // Player position update
  const playerStart = performance.now();
  playerCharacter.position.copy(player.position);
  const playerTime = performance.now() - playerStart;
  
  // HUD update
  const hudStart = performance.now();
  updateHUD(player.position);
  const hudTime = performance.now() - hudStart;
  
  // Camera update
  const cameraStart = performance.now();
  updateCamera();
  const cameraTime = performance.now() - cameraStart;
  
  // Chunk update
  const chunksStart = performance.now();
  updateChunks(player.position);
  const chunksTime = performance.now() - chunksStart;
  
  processChunkQueue(10); // Adjust number for perf

  // Rendering
  const renderStart = performance.now();
  renderer.render(scene, camera);
  const renderTime = performance.now() - renderStart;
  
  // Update FPS counter
  if (frameCount % 10 === 0) {
    const fps = Math.round(1000 / (performance.now() - start));
    const fpsElement = document.getElementById('fps');
    if (fpsElement) {
        fpsElement.textContent = `FPS: ${fps}`;
    }
  }
  
  // Log performance every 100 frames
  if (frameCount % 100 === 0) {
    const performanceEntries = [];
    
    // Only add entries that take more than 2ms
    if (playerTime > 2) performanceEntries.push(`Player: ${playerTime.toFixed(2)}`);
    if (hudTime > 2) performanceEntries.push(`HUD: ${hudTime.toFixed(2)}`);
    if (cameraTime > 2) performanceEntries.push(`Camera: ${cameraTime.toFixed(2)}`);
    if (chunksTime > 2) performanceEntries.push(`Chunks: ${chunksTime.toFixed(2)}`);
    if (renderTime > 2) performanceEntries.push(`Render: ${renderTime.toFixed(2)}`);
    
    // Always show total time
    performanceEntries.push(`Total: ${(performance.now() - start).toFixed(2)}`);
    console.log(`📊 Performance: ${performanceEntries.join(' | ')}`);
  }
}

// Initialize all systems
console.log('🚀 Initializing voxel engine...');

// Main initialization function
async function initGame() {
  // Initialize the chunk worker first so it's ready when we start generating chunks
  console.log('🧠 Initializing chunk worker...');
  await initChunkWorker();
  
  // Set flat terrain mode AFTER worker initialization is complete
  console.log('🏞️ Setting flat terrain mode...');
  setFlatTerrainMode(true);
  
  initHUD();
  initInput();
  
  // Show loading screen
  const loadingMessage = document.createElement('div');
  loadingMessage.style.position = 'absolute';
  loadingMessage.style.top = '50%';
  loadingMessage.style.left = '50%';
  loadingMessage.style.transform = 'translate(-50%, -50%)';
  loadingMessage.style.color = 'white';
  loadingMessage.style.fontSize = '24px';
  loadingMessage.style.fontFamily = 'Arial, sans-serif';
  loadingMessage.textContent = 'Loading world...';
  document.body.appendChild(loadingMessage);
  
  // Start prerendering chunks around player
  console.log('🗺️ Prerendering initial chunks...');
  await prerenderArea(player.position, 5, 5); // 5 chunk radius, 5 chunks per frame
  
  // Initialize static town halls after the initial terrain is loaded
  console.log('🏛️ Adding town halls to the world...');
  initializeTownHalls();
  
  // Remove loading message when done
  document.body.removeChild(loadingMessage);
  
  // Start the game loop
  console.log('🎮 Starting game loop');
  animate();
}

// Start the initialization process
initGame();