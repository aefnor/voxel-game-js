import * as THREE from 'three';
import { scene } from '../renderer/renderer';
import { generateChunk } from './terrain';

const CHUNK_SIZE = 16;
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
  if (!chunks.has(key)) {
    // Only generate and add a new chunk if one doesn't already exist
    const chunk = generateChunk(cx, cz);
    chunk.visible = true;
    scene.add(chunk);
    chunks.set(key, chunk);
    log(`🆕 Generated new chunk at ${key}`);
  } else {
    // Reuse existing chunk and make it visible
    const chunk = chunks.get(key)!;
    chunk.visible = true;
    log(`♻️ Reused existing chunk at ${key}`);
  }

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
      visibleChunkKeys.add(key);
    });
  } else {
    chunkQueue.push(() => {
      const chunk = chunks.get(key)!;
      chunk.visible = true;
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
        newVisible.add(key);
        enqueueChunk(cx, cz);
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
}

export function processChunkQueue(limit: number = 4) {
  for (let i = 0; i < limit && chunkQueue.length > 0; i++) {
    const task = chunkQueue.shift();
    task?.();
  }
  log(`🟩 Visible Chunks (${visibleChunkKeys.size}): ${[...visibleChunkKeys].join(', ')}`);
}
