import * as THREE from 'three';
import { scene, camera } from '../renderer/renderer';
import { generateChunk, getTerrainHeightAt } from './terrain';
import { createTreeFromData, createHouseFromData, createTownHallFromData } from './special-objects';

const CHUNK_SIZE = 16;
const MAX_HEIGHT = 300;
let renderDistance = 3;
let lastChunkX = Infinity;
let lastChunkZ = Infinity;

// World boundaries - cap at 100x100 chunks
export const WORLD_SIZE = 100; // World is WORLD_SIZE x WORLD_SIZE chunks
export const WORLD_MIN = -WORLD_SIZE / 2;
export const WORLD_MAX = WORLD_SIZE / 2;

// Town hall positions - evenly spread out across the world
export const townHallPositions = [
  { x: WORLD_MIN + WORLD_SIZE * 0.25, z: WORLD_MIN + WORLD_SIZE * 0.25 }, // Southwest
  { x: WORLD_MIN + WORLD_SIZE * 0.75, z: WORLD_MIN + WORLD_SIZE * 0.25 }, // Southeast
  { x: WORLD_MIN + WORLD_SIZE * 0.25, z: WORLD_MIN + WORLD_SIZE * 0.75 }, // Northwest
  { x: WORLD_MIN + WORLD_SIZE * 0.75, z: WORLD_MIN + WORLD_SIZE * 0.75 }  // Northeast
];

// Town hall management - separate from chunk system
interface TownHall {
  group: THREE.Group;
  position: { x: number, y: number, z: number };
  placed: boolean;
}
const townHalls: TownHall[] = townHallPositions.map((pos) => ({
  group: new THREE.Group(),
  position: { ...pos, y: 0 },
  placed: false
}));

const chunks = new Map<string, THREE.Group>();
const chunkQueue: Array<() => void> = [];
const visibleChunkKeys = new Set<string>();

// Track if town halls have been added - using a single source of truth for town hall placement
const townHallsPlaced = new Set<string>();

// Add worker communication
let chunkWorker: Worker | null = null;
const pendingChunkRequests = new Map<string, {
  resolve: (chunk: THREE.Group) => void,
  reject: (error: Error) => void
}>();

// Materials for chunk creation from worker data
const grassMaterial = new THREE.MeshLambertMaterial({ color: 0x3d9140 });
const dirtMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
const sandMaterial = new THREE.MeshLambertMaterial({ color: 0xDEB887 });
const rockMaterial = new THREE.MeshLambertMaterial({ color: 0x808080 });
const snowMaterial = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
const waterMaterial = new THREE.MeshLambertMaterial({ 
  color: 0x0099FF, 
  transparent: true, 
  opacity: 0.7 
});

// Block geometry for instanced meshes
const geometry = new THREE.BoxGeometry(1, 1, 1);
const materials = [grassMaterial, dirtMaterial, sandMaterial, rockMaterial, snowMaterial];

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

// Initialize the chunk worker
export function initChunkWorker(): Promise<void> {
  if (chunkWorker) {
    // Already initialized
    return Promise.resolve();
  }

  // Create the worker
  chunkWorker = new Worker('chunk-worker.js');
  
  // Make the worker accessible globally for other modules
  (window as any).chunkWorkerInstance = chunkWorker;

  // Return a promise that resolves when the worker is initialized
  return new Promise((resolve) => {
    // Set up the message handling
    if (!chunkWorker) {
        throw new Error('Chunk worker is not initialized');
    }
    chunkWorker.onmessage = (e) => {
      const { type, data } = e.data;
      
      switch (type) {
        case 'initialized':
          log('🧠 Chunk worker initialized and ready');
          resolve(); // Resolve the promise when initialization is complete
          break;
          
        case 'chunkGenerated':
          const { cx, cz, chunkData } = data;
          const key = chunkKey(cx, cz);
          
          try {
            // Create a THREE.js group for the chunk
            const chunk = createChunkFromWorkerData(cx, cz, chunkData);
            
            // Resolve the pending request
            const request = pendingChunkRequests.get(key);
            if (request) {
              request.resolve(chunk);
              pendingChunkRequests.delete(key);
            }
          } catch (error) {
            console.error('Error creating chunk from worker data:', error);
            
            // Reject the pending request
            const request = pendingChunkRequests.get(key);
            if (request) {
              request.reject(new Error(`Failed to create chunk from worker data: ${error}`));
              pendingChunkRequests.delete(key);
            }
          }
          break;
          
        case 'error':
          const errorKey = chunkKey(data.cx, data.cz);
          console.error(`Error generating chunk ${errorKey}: ${data.message}`);
          
          // Reject the pending request
          const errorRequest = pendingChunkRequests.get(errorKey);
          if (errorRequest) {
            errorRequest.reject(new Error(data.message));
            pendingChunkRequests.delete(errorKey);
          }
          break;
      }
    };
    
    // Initialize the worker with the simplex noise library
    chunkWorker.postMessage({
      type: 'init',
      data: {
        simplexNoiseUrl: 'https://cdn.jsdelivr.net/npm/simplex-noise@4.0.1/dist/esm/simplex-noise.js'
      }
    });
  });
}

// Creates a THREE.js chunk from the worker-generated data
function createChunkFromWorkerData(cx: number, cz: number, chunkData: any): THREE.Group {
  const { visibleBlocks, waterBlocks, specialObjects } = chunkData;
  
  const chunkGroup = new THREE.Group();
  chunkGroup.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
  chunkGroup.userData = { cx, cz };
  
  // Create instanced mesh for each material
  const instancedMeshes = materials.map(material => 
    new THREE.InstancedMesh(geometry, material, 5000) // Reduced from MAX_BLOCKS_PER_CHUNK for performance
  );
  
  // Create water mesh
  const waterMesh = new THREE.InstancedMesh(geometry, waterMaterial, CHUNK_SIZE * CHUNK_SIZE);
  
  const instanceCounts = new Array(materials.length).fill(0);
  let waterCount = 0;
  
  const dummy = new THREE.Object3D();
  
  // Place all visible blocks
  for (const block of visibleBlocks) {
    const { x, y, z, materialIndex } = block;
    dummy.position.set(x, y, z); // local position inside chunk
    dummy.updateMatrix();
    if (instancedMeshes[materialIndex]) {
        instancedMeshes[materialIndex].setMatrixAt(instanceCounts[materialIndex]++, dummy.matrix);
    }
  }
  
  // Place water blocks
  for (const block of waterBlocks) {
    const { x, y, z } = block;
    dummy.position.set(x, y, z);
    dummy.updateMatrix();
    waterMesh.setMatrixAt(waterCount++, dummy.matrix);
  }
  
  // Add the instanced meshes to the chunk
  instancedMeshes.forEach((mesh, i) => {
    mesh.count = instanceCounts[i];
    if (mesh.count > 0) {
      mesh.instanceMatrix.needsUpdate = true;
      chunkGroup.add(mesh);
    }
  });
  
  // Add the water mesh
  if (waterCount > 0) {
    waterMesh.count = waterCount;
    waterMesh.instanceMatrix.needsUpdate = true;
    chunkGroup.add(waterMesh);
  }
  
  // Add special objects (trees, houses) - but not town halls!
  // Town halls are now handled separately and not tied to chunks
  for (const obj of specialObjects) {
    if (obj.type === 'tree') {
      const tree = createTreeFromData(obj.x, obj.y, obj.z);
      chunkGroup.add(tree);
    } else if (obj.type === 'house') {
      const house = createHouseFromData(obj.x, obj.y, obj.z);
      chunkGroup.add(house);
    }
  }
  
  return chunkGroup;
}

// Request a chunk from the worker
async function requestChunkFromWorker(cx: number, cz: number): Promise<THREE.Group> {
  const key = chunkKey(cx, cz);
  
  return new Promise((resolve, reject) => {
    if (!chunkWorker) {
      return reject(new Error('Chunk worker not initialized'));
    }
    
    // Store the pending request
    pendingChunkRequests.set(key, { resolve, reject });
    
    // Request the chunk from the worker
    chunkWorker.postMessage({
      type: 'generateChunk',
      data: { cx, cz }
    });
  });
}

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

async function ensureChunkNow(cx: number, cz: number): Promise<void> {
  // Check if the chunk is within world boundaries
  if (cx < WORLD_MIN || cx > WORLD_MAX || cz < WORLD_MIN || cz > WORLD_MAX) {
    // Skip chunks outside the world boundary
    return;
  }

  const key = chunkKey(cx, cz);
  let chunk: THREE.Group;
  
  if (!chunks.has(key)) {
    try {
      // Use the worker if initialized, otherwise fallback to main thread
      if (chunkWorker) {
        chunk = await requestChunkFromWorker(cx, cz);
      } else {
        // Fallback to synchronous generation on main thread
        chunk = generateChunk(cx, cz);
      }
      
      chunk.visible = true;
      scene.add(chunk);
      chunks.set(key, chunk);
      log(`🆕 Generated new chunk at ${key}`);
      
    } catch (error) {
      console.error(`Failed to generate chunk ${key}:`, error);
      // Fallback to synchronous generation on main thread
      chunk = generateChunk(cx, cz);
      chunk.visible = true;
      scene.add(chunk);
      chunks.set(key, chunk);
      log(`🔄 Fallback: generated chunk at ${key} on main thread`);
    }
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
  // Check if the chunk is within world boundaries
  if (cx < WORLD_MIN || cx > WORLD_MAX || cz < WORLD_MIN || cz > WORLD_MAX) {
    // Skip chunks outside the world boundary
    return;
  }

  const key = chunkKey(cx, cz);
  if (!chunks.has(key)) {
    chunkQueue.push(async () => {
      try {
        let chunk: THREE.Group;
        
        // Use the worker if initialized, otherwise fallback to main thread
        if (chunkWorker) {
          chunk = await requestChunkFromWorker(cx, cz);
        } else {
          // Fallback to synchronous generation on main thread
          chunk = generateChunk(cx, cz);
        }
        
        chunk.visible = true;
        scene.add(chunk);
        chunks.set(key, chunk);
        chunkLastAccessed.set(key, performance.now());
        visibleChunkKeys.add(key);
        
      } catch (error) {
        console.error(`Failed to generate queued chunk ${key}:`, error);
      }
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

    if (cx === undefined || cz === undefined) continue; // Skip invalid keys
    
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
  
  // First, add the town hall chunks to ensure they get preloaded
  townHallPositions.forEach((pos, index) => {
    const thCx = Math.floor(pos.x / CHUNK_SIZE);
    const thCz = Math.floor(pos.z / CHUNK_SIZE);
    // Check if within world boundaries
    if (thCx >= WORLD_MIN && thCx <= WORLD_MAX && thCz >= WORLD_MIN && thCz <= WORLD_MAX) {
      // Use negative distSq to prioritize town halls
      chunkPositions.push([thCx, thCz, -1000 + index]);
      log(`🏛️ Adding Town Hall chunk at (${thCx}, ${thCz}) to preload queue`);
    }
  });
  
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
          
          // Skip chunks outside of world boundaries
          if (cx < WORLD_MIN || cx > WORLD_MAX || cz < WORLD_MIN || cz > WORLD_MAX) {
            continue;
          }
          
          const distSq = dx * dx + dz * dz;
          chunkPositions.push([cx, cz, distSq]);
        }
      }
    }
  }
  
  // Sort by distance from center (closest first, but town halls get priority)
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
        const chunkPosition = chunkPositions.shift();
        if (!chunkPosition) continue;
        const [cx, cz] = chunkPosition ?? [0, 0];
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

// Add this function to get the actual terrain height at a specific world position
export function getActualTerrainHeight(x: number, z: number): number {
  // Get the chunk coordinates for this world position
  const cx = getChunkCoord(x);
  const cz = getChunkCoord(z);
  const key = chunkKey(cx, cz);
  
  // Convert position to chunk coordinates
  const localX = Math.floor(x) - cx * CHUNK_SIZE;
  const localZ = Math.floor(z) - cz * CHUNK_SIZE;
  
  // If the chunk exists and is loaded, query its actual height
  if (chunks.has(key)) {
    const chunk = chunks.get(key)!;
    
    // Try to find the highest block at this x,z position
    // This is an approximation - in a full implementation, you'd store and query
    // the actual height data for each x,z coordinate in the chunk
    let maxHeight = 0;
    
    // Use raycasting to find the terrain height
    const raycaster = new THREE.Raycaster(
      new THREE.Vector3(x, MAX_HEIGHT + 10, z), // Start from high above
      new THREE.Vector3(0, -1, 0), // Cast downward
      0,  // near
      MAX_HEIGHT + 20 // far - enough to reach ground
    );
    
    const intersects = raycaster.intersectObject(chunk, true);
    if (intersects.length > 0) {
      return intersects[0]?.point.y ?? getTerrainHeightAt(x, z);
    }
  }
  
  // Fall back to the terrain generation function if chunk isn't loaded
  return getTerrainHeightAt(x, z);
}

// Static town halls - these won't be affected by chunk loading/unloading
export function initializeTownHalls(): void {
  if (townHalls.some(th => th.placed)) {
    log('🏛️ Town halls already initialized, skipping...');
    return;
  }

  log('🏛️ Initializing static town halls...');
  townHalls.forEach((townHall, index) => {
    const pos = townHall.position;
    // Calculate terrain height for town hall position
    const worldY = getTerrainHeightAt(pos.x, pos.z);
    
    // Create the town hall structure
    const townHallObject = createTownHallFromData(pos.x, worldY, pos.z);
    
    // Add to scene directly - not part of any chunk
    scene.add(townHallObject);
    
    // Update town hall object
    townHall.group = townHallObject;
    townHall.position.y = worldY;
    townHall.placed = true;
    
    log(`🏛️ Added static Town Hall ${index + 1} at ${pos.x}, ${worldY}, ${pos.z}`);
  });
}
