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
