import { initRenderer, scene, camera } from './renderer';
import { player, playerCharacter } from '../player/player';
import { updateCamera } from '../player/camera';
import { initInput } from '../input/inputhandler';
import { initHUD, updateHUD } from '../ui/hud';
import { processChunkQueue, updateChunks } from '../world/chunkmanager';
import { setFlatTerrainMode } from '../world/terrain';

let frameCount = 0;
const renderer = initRenderer();

function animate() {
  requestAnimationFrame(animate);
  
  const start = performance.now();
  
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
    
    // Only log if there are slow operations
    if (performanceEntries.length > 1 || (performance.now() - start) > 2) {
      console.log('Performance bottlenecks (>2ms):', performanceEntries.join(', '));
    }
  }
}
setFlatTerrainMode(true); // Enable flat terrain mode for testing

initHUD();
initInput();
animate();