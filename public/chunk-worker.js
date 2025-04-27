// Chunk Worker for offloading chunk generation from the main thread
// This worker runs in the background to generate terrain chunks

// Import necessary dependencies via importScripts as Web Workers can't use ES modules
self.noise = { createNoise2D: null, createNoise3D: null };

// Constants for chunk generation
const CHUNK_SIZE = 16;
const MAX_HEIGHT = 300;
const BLOCK_SIZE = 1;
const MAX_BLOCKS_PER_CHUNK = CHUNK_SIZE * CHUNK_SIZE * MAX_HEIGHT;
const WATER_LEVEL = 60;

// Configuration flags
let USE_FLAT_TERRAIN = false;
const FLAT_TERRAIN_HEIGHT = 70;

// Enum for biome types (needs to match terrain.ts)
const BiomeType = {
  Plains: 0,
  Desert: 1,
  Mountains: 2,
  Forest: 3
};

// Handle messages from the main thread
self.onmessage = function(e) {
  const { type, data } = e.data;
  
  switch (type) {
    case 'init':
      // Initialize the worker with our simplified noise implementation
      importScripts('simplified-noise.js');
      
      // Set up our noise functions
      self.noise.createNoise2D = self.createNoise2D;
      self.noise.createNoise3D = self.createNoise3D;
      
      // Create noise functions
      self.mainNoise = self.noise.createNoise2D();
      self.detailNoise = self.noise.createNoise2D();
      self.mountainNoise = self.noise.createNoise2D();
      self.biomeNoise = self.noise.createNoise2D();
      self.caveNoise = self.noise.createNoise3D();
      
      self.postMessage({ type: 'initialized' });
      break;
      
    case 'generateChunk':
      const { cx, cz } = data;
      try {
        // Generate chunk data - just the data, not THREE.js objects
        const chunkData = generateChunkData(cx, cz);
        self.postMessage({ 
          type: 'chunkGenerated', 
          data: { 
            cx, 
            cz,
            chunkData 
          }
        });
      } catch (error) {
        self.postMessage({ 
          type: 'error', 
          data: { 
            cx, 
            cz,
            message: error.toString() 
          }
        });
      }
      break;
      
    case 'setFlatTerrainMode':
      USE_FLAT_TERRAIN = data.enabled;
      self.postMessage({ type: 'flatTerrainSet', data: { enabled: USE_FLAT_TERRAIN } });
      break;
  }
};

// Get biome at a specific world position
function getBiomeAt(x, z) {
  const biomeValue = self.biomeNoise(x / 200, z / 200);
  
  if (biomeValue < -0.5) return BiomeType.Desert;
  if (biomeValue < 0) return BiomeType.Plains;
  if (biomeValue < 0.5) return BiomeType.Forest;
  return BiomeType.Mountains;
}

// Get terrain height using multiple octaves of noise
function getTerrainHeightAt(x, z) {
  // If flat terrain mode is enabled, return constant height
  if (USE_FLAT_TERRAIN) {
    return FLAT_TERRAIN_HEIGHT;
  } 

  const biome = getBiomeAt(x, z);
  
  // Base terrain
  let height = (self.mainNoise(x / 100, z / 100) + 1) / 2 * 60 + 40;
  
  // Add smaller details
  height += self.detailNoise(x / 30, z / 30) * 10;
  
  // Add mountains in mountain biome
  if (biome === BiomeType.Mountains) {
    const mountainValue = self.mountainNoise(x / 50, z / 50);
    if (mountainValue > 0.1) {
      height += (mountainValue - 0.1) * 2 * 150;
    }
  }
  
  // Make desert biome flatter
  if (biome === BiomeType.Desert) {
    height = height * 0.5 + 40;
  }
  
  // Cliff formations
  const cliffNoise = self.mainNoise(x / 20, z / 20);
  if (cliffNoise > 0.7) {
    height += (cliffNoise - 0.7) * 100;
  }
  
  return Math.floor(height);
}

// Generate data for a chunk, will be turned into THREE.js objects on the main thread
function generateChunkData(cx, cz) {
  // Create a 3D grid for the blocks
  const blockGrid = [];
  for (let x = 0; x < CHUNK_SIZE; x++) {
    blockGrid[x] = [];
    for (let y = 0; y < MAX_HEIGHT; y++) {
      blockGrid[x][y] = [];
      for (let z = 0; z < CHUNK_SIZE; z++) {
        blockGrid[x][y][z] = -1; // -1 means empty/air
      }
    }
  }
  
  // Track where to place special objects like trees and houses
  const specialObjects = [];

  // Fill the grid with block type data
  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      const worldX = cx * CHUNK_SIZE + x;
      const worldZ = cz * CHUNK_SIZE + z;
      const height = getTerrainHeightAt(worldX, worldZ);
      const biome = getBiomeAt(worldX, worldZ);

      for (let y = 0; y <= height; y++) {
        const caveValue = self.caveNoise(worldX / 30, y / 30, worldZ / 30);
        if (caveValue > 0.7 && y < height - 5 && y > 20) {
          blockGrid[x][y][z] = -1; // Air (cave)
          continue;
        }

        // Determine material index
        let matIndex = 0;
        if (y === height) {
          switch (biome) {
            case BiomeType.Desert: matIndex = 2; break;
            case BiomeType.Mountains: matIndex = y > 120 ? 4 : 3; break;
            default: matIndex = 0;
          }
        } else if (y > height - 4) {
          matIndex = biome === BiomeType.Desert ? 2 : 1;
        } else {
          matIndex = 3;
        }
        
        blockGrid[x][y][z] = matIndex;
      }

      // Water blocks
      if (height < WATER_LEVEL) {
        blockGrid[x][WATER_LEVEL][z] = -2; // -2 represents water
      }
      
      // Trees and houses
      if (biome === BiomeType.Forest && Math.random() < 0.04 && height > WATER_LEVEL) {
        specialObjects.push({
          type: 'tree',
          x,
          y: height,
          z
        });
      }

      if (biome === BiomeType.Plains && Math.random() < 0.001 && height > WATER_LEVEL) {
        specialObjects.push({
          type: 'house',
          x,
          y: height,
          z
        });
      }
    }
  }

  // Process the grid to determine visible blocks
  const visibleBlocks = [];
  const waterBlocks = [];

  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      const worldX = cx * CHUNK_SIZE + x;
      const worldZ = cz * CHUNK_SIZE + z;
      const height = getTerrainHeightAt(worldX, worldZ);

      for (let y = 0; y <= height; y++) {
        // Skip air blocks (caves or outside terrain)
        if (blockGrid[x][y][z] === -1) continue;
        
        const matIndex = blockGrid[x][y][z];
        
        // Check if any face is exposed to air or water
        const isExposed = 
          // Check block above
          (y + 1 >= MAX_HEIGHT || blockGrid[x][y + 1][z] === -1 || blockGrid[x][y + 1][z] === -2) ||
          // Check block below
          (y - 1 < 0 || blockGrid[x][y - 1][z] === -1) ||
          // Check block north (-z)
          (z - 1 < 0 || blockGrid[x][y][z - 1] === -1 || blockGrid[x][y][z - 1] === -2) ||
          // Check block south (+z)
          (z + 1 >= CHUNK_SIZE || blockGrid[x][y][z + 1] === -1 || blockGrid[x][y][z + 1] === -2) ||
          // Check block west (-x)
          (x - 1 < 0 || blockGrid[x - 1][y][z] === -1 || blockGrid[x - 1][y][z] === -2) ||
          // Check block east (+x)
          (x + 1 >= CHUNK_SIZE || blockGrid[x + 1][y][z] === -1 || blockGrid[x + 1][y][z] === -2);
        
        // Only include if at least one face is exposed
        if (isExposed) {
          visibleBlocks.push({
            x,
            y,
            z,
            materialIndex: matIndex
          });
        }
      }

      // Water is always included
      if (height < WATER_LEVEL) {
        waterBlocks.push({
          x,
          y: WATER_LEVEL,
          z
        });
      }
    }
  }

  return {
    visibleBlocks,
    waterBlocks,
    specialObjects
  };
}