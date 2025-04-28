import * as THREE from 'three';
import { townHallPositions, WORLD_MIN, WORLD_MAX, WORLD_SIZE } from '../world/chunkmanager';

let slider: HTMLInputElement;
let coordsDiv: HTMLDivElement;
let fpsDiv: HTMLDivElement;
let miniMap: HTMLDivElement;
let lastFrameTime = performance.now();
let frameCount = 0;
let lastFpsUpdateTime = 0;
let currentFps = 0;

// Town hall markers on the mini-map
const townHallMarkers: HTMLDivElement[] = [];
// Player marker on the mini-map
let playerMarker: HTMLDivElement | null = null;

export function initHUD() {
  slider = document.getElementById('chunk-distance') as HTMLInputElement;
  coordsDiv = document.getElementById('player-coords') as HTMLDivElement;
  fpsDiv = document.getElementById('fps') as HTMLDivElement;
  miniMap = document.getElementById('mini-map') as HTMLDivElement;

  slider.addEventListener('input', () => {
    const { setRenderDistance } = require('../world/chunkmanager');
    setRenderDistance(parseInt(slider.value));
  });

  // Initialize mini-map with town hall markers
  initMiniMap();
}

function initMiniMap() {
  // Create player marker
  playerMarker = document.createElement('div');
  playerMarker.className = 'player-marker';
  miniMap.appendChild(playerMarker);

  // Create town hall markers
  townHallPositions.forEach((pos: {x: number, z: number}, index: number) => {
    const marker = document.createElement('div');
    marker.className = 'town-hall-marker';
    marker.title = `Town Hall ${index + 1}`;
    
    // Convert world coordinates to mini-map coordinates
    const [x, y] = worldToMiniMapCoords(pos.x, pos.z);
    marker.style.left = `${x}px`;
    marker.style.top = `${y}px`;
    
    miniMap.appendChild(marker);
    townHallMarkers.push(marker);
  });
}

// Helper function to convert world coordinates to mini-map pixel coordinates
function worldToMiniMapCoords(worldX: number, worldZ: number): [number, number] {
  // Calculate the scale of the mini-map
  const miniMapSize = 150; // Size in pixels
  
  // Normalize coordinates to 0-1 range based on world size
  const normalizedX = (worldX - WORLD_MIN) / WORLD_SIZE;
  const normalizedZ = (worldZ - WORLD_MIN) / WORLD_SIZE;
  
  // Convert to pixel coordinates
  const pixelX = normalizedX * miniMapSize;
  const pixelY = normalizedZ * miniMapSize;
  
  return [pixelX, pixelY];
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
  
  // Update player position on mini-map
  updateMiniMapPlayerPosition(position);
}

function updateMiniMapPlayerPosition(position: THREE.Vector3) {
  if (!playerMarker) return;
  
  // Convert player's world position to mini-map coordinates
  const [x, y] = worldToMiniMapCoords(position.x, position.z);
  
  // Update player marker position on the mini-map
  playerMarker.style.left = `${x}px`;
  playerMarker.style.top = `${y}px`;
}
