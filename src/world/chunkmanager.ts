import * as THREE from 'three';
import { scene, camera } from '../renderer/renderer'; // Add camera import
import { generateChunk } from './terrain';

const CHUNK_SIZE = 16;
const MAX_HEIGHT = 300;
let renderDistance = 3;
let lastChunkX = Infinity;
let lastChunkZ = Infinity;

const chunks = new Map<string, THREE.Group>();
const chunkQueue: Array<() => void> = [];
const visibleChunkKeys = new Set<string>();

const DEBUG = true;
function log(...args: any[]) {
  if (DEBUG) console.log(...args);
}

// Add these constants at the top of your file
const MAX_CACHED_CHUNKS = 100; // Adjust based on your memory constraints
const CHUNK_UNLOAD_DISTANCE = renderDistance + 5; // Distance at which chunks get unloaded

// Add a Map to track when chunks were last accessed
const chunkLastAccessed = new Map<string, number>();

// Add a frustum object to check what's in view
const frustum = new THREE.Frustum();
const projScreenMatrix = new THREE.Matrix4();

export function setRenderDistance(distance: number) {
  renderDistance = distance;
  lastChunkX = Infinity;
  lastChunkZ = Infinity;
}

function chunkKey(x: number, z: number): string {
  return `${x},${z}`;
}

function getChunkCoord(coord: number): number {
  return Math.floor(coord / CHUNK_SIZE);
}

function ensureChunkNow(cx: number, cz: number): void {
  const key = chunkKey(cx, cz);
  let chunk: THREE.Group;
  
  if (!chunks.has(key)) {
    // Only generate and add a new chunk if one doesn't already exist
    chunk = generateChunk(cx, cz);
    chunk.visible = true;
    scene.add(chunk);
    chunks.set(key, chunk);
    log(`🆕 Generated new chunk at ${key}`);
  } else {
    // Reuse existing chunk and make it visible
    chunk = chunks.get(key)!;
    chunk.visible = true;
    log(`♻️ Reused existing chunk at ${key}`);
  }
  
  // Record access time for LRU cache management
  chunkLastAccessed.set(key, performance.now());
  visibleChunkKeys.add(key);
}

function enqueueChunk(cx: number, cz: number) {
  const key = chunkKey(cx, cz);
  if (!chunks.has(key)) {
    chunkQueue.push(() => {
      const chunk = generateChunk(cx, cz);
      chunk.visible = true;
      scene.add(chunk);
      chunks.set(key, chunk);
      chunkLastAccessed.set(key, performance.now());
      visibleChunkKeys.add(key);
    });
  } else {
    chunkQueue.push(() => {
      const chunk = chunks.get(key)!;
      chunk.visible = true;
      chunkLastAccessed.set(key, performance.now());
      visibleChunkKeys.add(key);
    });
  }
}

export function updateChunks(playerPosition: THREE.Vector3) {
  const playerChunkX = getChunkCoord(playerPosition.x);
  const playerChunkZ = getChunkCoord(playerPosition.z);
  const playerChunkKey = chunkKey(playerChunkX, playerChunkZ);

  if (playerChunkX === lastChunkX && playerChunkZ === lastChunkZ) return;
  lastChunkX = playerChunkX;
  lastChunkZ = playerChunkZ;

  log(`🧭 Player Position: (${playerPosition.x.toFixed(3)}, ${playerPosition.z.toFixed(3)})`);
  log(`🗺️ Player Chunk: ${playerChunkKey}`);

  // Update frustum from current camera
  projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  frustum.setFromProjectionMatrix(projScreenMatrix);

  const newVisible = new Set<string>();
  const maxDistSq = renderDistance * renderDistance;

  // Guarantee the player chunk exists now
  ensureChunkNow(playerChunkX, playerChunkZ);
  newVisible.add(playerChunkKey);

  // Generate chunks in a square radius around the player
  for (let dx = -renderDistance; dx <= renderDistance; dx++) {
    for (let dz = -renderDistance; dz <= renderDistance; dz++) {
      if (dx * dx + dz * dz > maxDistSq) continue; // Skip chunks outside circular radius
      const cx = playerChunkX + dx;
      const cz = playerChunkZ + dz;
      const key = chunkKey(cx, cz);
      
      if (key !== playerChunkKey) {
        // Create a bounding box for the chunk to check if it's in view
        const chunkBox = new THREE.Box3(
          new THREE.Vector3(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE),
          new THREE.Vector3((cx + 1) * CHUNK_SIZE, MAX_HEIGHT, (cz + 1) * CHUNK_SIZE)
        );
        
        // Only add chunk to visible set if it's within the camera frustum
        if (frustum.intersectsBox(chunkBox)) {
          newVisible.add(key);
          enqueueChunk(cx, cz);
        }
      }
    }
  }

  // Hide chunks that are no longer visible
  for (const key of visibleChunkKeys) {
    if (!newVisible.has(key)) {
      const chunk = chunks.get(key);
      if (chunk) {
        chunk.visible = false;
      }
    }
  }

  visibleChunkKeys.clear();
  for (const key of newVisible) visibleChunkKeys.add(key);
  
  // Manage chunk cache to prevent memory issues
  manageChunkCache(playerChunkX, playerChunkZ);
}

export function processChunkQueue(limit: number = 4) {
  for (let i = 0; i < limit && chunkQueue.length > 0; i++) {
    const task = chunkQueue.shift();
    task?.();
  }
  log(`🟩 Visible Chunks (${visibleChunkKeys.size}): ${[...visibleChunkKeys].join(', ')}`);
}

// Add this new function to manage chunk caching
function manageChunkCache(playerChunkX: number, playerChunkZ: number) {
  if (chunks.size <= MAX_CACHED_CHUNKS) return;
  
  // Get chunks sorted by last accessed time (oldest first)
  const sortedChunks = [...chunkLastAccessed.entries()]
    .sort((a, b) => a[1] - b[1]);
  
  // Calculate how many chunks to remove
  const chunksToRemove = Math.max(10, chunks.size - MAX_CACHED_CHUNKS);
  
  // Remove oldest chunks that are far enough from player
  let removedCount = 0;
  for (const [key, lastAccessed] of sortedChunks) {
    if (removedCount >= chunksToRemove) break;
    
    // Parse chunk coordinates from key
    const [cx, cz] = key.split(',').map(Number);
    
    // Check if chunk is far enough from player to unload
    const distSq = (cx - playerChunkX) * (cx - playerChunkX) + 
                   (cz - playerChunkZ) * (cz - playerChunkZ);
    
    if (distSq > CHUNK_UNLOAD_DISTANCE * CHUNK_UNLOAD_DISTANCE) {
      const chunk = chunks.get(key);
      if (chunk) {
        // Remove the chunk from the scene
        scene.remove(chunk);
        
        // Clear the chunk's resources
        chunk.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
              if (Array.isArray(object.material)) {
                object.material.forEach(material => material.dispose());
              } else {
                object.material.dispose();
              }
            }
          }
        });
        
        // Remove from our data structures
        chunks.delete(key);
        chunkLastAccessed.delete(key);
        visibleChunkKeys.delete(key);
        
        removedCount++;
        log(`🗑️ Unloaded old chunk at ${key}`);
      }
    }
  }
}

/**
 * Prerenders chunks in a specified radius around a position
 * @param centerPosition The center position to prerender around
 * @param radius How many chunks in each direction to prerender
 * @param maxPerFrame Maximum number of chunks to generate per frame
 * @returns Promise that resolves when prerendering is complete
 */
export async function prerenderArea(
  centerPosition: THREE.Vector3, 
  radius: number = 5,
  maxPerFrame: number = 4
): Promise<void> {
  // Convert position to chunk coordinates
  const centerChunkX = getChunkCoord(centerPosition.x);
  const centerChunkZ = getChunkCoord(centerPosition.z);
  
  log(`🔄 Starting prerender around (${centerChunkX}, ${centerChunkZ}) with radius ${radius}`);
  
  // Store all chunk positions to generate in order of distance from center
  const chunkPositions: Array<[number, number, number]> = [];
  
  // Add chunks in a spiral pattern (center-outward)
  for (let r = 0; r <= radius; r++) {
    if (r === 0) {
      // Add center chunk
      chunkPositions.push([centerChunkX, centerChunkZ, 0]);
      continue;
    }
    
    // Add the perimeter of the square at distance r
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        // Only include points on the perimeter of the square
        if (Math.abs(dx) === r || Math.abs(dz) === r) {
          const cx = centerChunkX + dx;
          const cz = centerChunkZ + dz;
          const distSq = dx * dx + dz * dz;
          chunkPositions.push([cx, cz, distSq]);
        }
      }
    }
  }
  
  // Sort by distance from center (closest first)
  chunkPositions.sort((a, b) => a[2] - b[2]);
  
  // Create a loading indicator or progress bar
  const totalChunks = chunkPositions.length;
  let loadedChunks = 0;
  
  // Display loading message
  const loadingMessage = document.createElement('div');
  loadingMessage.style.position = 'absolute';
  loadingMessage.style.top = '50%';
  loadingMessage.style.left = '50%';
  loadingMessage.style.transform = 'translate(-50%, -50%)';
  loadingMessage.style.color = 'white';
  loadingMessage.style.fontSize = '24px';
  loadingMessage.style.fontFamily = 'Arial, sans-serif';
  document.body.appendChild(loadingMessage);
  
  // Generate chunks with frame timing
  return new Promise<void>((resolve) => {
    function generateNextBatch() {
      const startTime = performance.now();
      let generatedThisFrame = 0;
      
      while (chunkPositions.length > 0 && generatedThisFrame < maxPerFrame) {
        const [cx, cz] = chunkPositions.shift()!;
        ensureChunkNow(cx, cz);
        loadedChunks++;
        generatedThisFrame++;
        
        // Update loading message
        const percent = Math.floor((loadedChunks / totalChunks) * 100);
        loadingMessage.textContent = `Loading world: ${percent}% (${loadedChunks}/${totalChunks} chunks)`;
      }
      
      if (chunkPositions.length > 0) {
        // Schedule next batch for next frame
        requestAnimationFrame(generateNextBatch);
      } else {
        // All done, remove loading message and resolve
        document.body.removeChild(loadingMessage);
        log(`✅ Prerender complete: ${loadedChunks} chunks generated`);
        resolve();
      }
    }
    
    // Start generating
    generateNextBatch();
  });
}
