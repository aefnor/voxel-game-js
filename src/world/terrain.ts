import * as THREE from 'three';
import { createNoise2D, createNoise3D } from 'simplex-noise';

export const CHUNK_SIZE = 16;
export const MAX_HEIGHT = 300;
export const BLOCK_SIZE = 1;
export const MAX_BLOCKS_PER_CHUNK = CHUNK_SIZE * CHUNK_SIZE * MAX_HEIGHT;
export const WATER_LEVEL = 60; // Fixed water level

// Configuration flags
export let USE_FLAT_TERRAIN = false;
export const FLAT_TERRAIN_HEIGHT = 70; // Height for flat terrain mode


// Create multiple noise functions
const mainNoise = createNoise2D();
const detailNoise = createNoise2D();
const mountainNoise = createNoise2D();
const biomeNoise = createNoise2D();
const caveNoise = createNoise3D();

// Materials
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

// Geometry for blocks
const geometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);

// Enum for biome types
enum BiomeType {
  Plains,
  Desert,
  Mountains,
  Forest
}

// Get biome at a specific world position
function getBiomeAt(x: number, z: number): BiomeType {
  const biomeValue = biomeNoise(x / 200, z / 200);
  
  if (biomeValue < -0.5) return BiomeType.Desert;
  if (biomeValue < 0) return BiomeType.Plains;
  if (biomeValue < 0.5) return BiomeType.Forest;
  return BiomeType.Mountains;
}

export function setFlatTerrainMode(enabled: boolean): void {
  USE_FLAT_TERRAIN = enabled;
  console.log(`Flat terrain mode ${enabled ? 'enabled' : 'disabled'}`);
}

// Get terrain height using multiple octaves of noise
export function getTerrainHeightAt(x: number, z: number): number {

  // If flat terrain mode is enabled, return constant height
  if (USE_FLAT_TERRAIN) {
    return FLAT_TERRAIN_HEIGHT;
  } 

  const biome = getBiomeAt(x, z);
  
  // Base terrain
  let height = (mainNoise(x / 100, z / 100) + 1) / 2 * 60 + 40;
  
  // Add smaller details
  height += detailNoise(x / 30, z / 30) * 10;
  
  // Add mountains in mountain biome
  if (biome === BiomeType.Mountains) {
    const mountainValue = mountainNoise(x / 50, z / 50);
    if (mountainValue > 0.1) {
      height += (mountainValue - 0.1) * 2 * 150;
    }
  }
  
  // Make desert biome flatter
  if (biome === BiomeType.Desert) {
    height = height * 0.5 + 40;
  }
  
  // Cliff formations
  const cliffNoise = mainNoise(x / 20, z / 20);
  if (cliffNoise > 0.7) {
    height += (cliffNoise - 0.7) * 100;
  }
  
  return Math.floor(height);
}

// Get block material based on height and biome
function getBlockMaterial(x: number, y: number, z: number, height: number): THREE.Material {
  const biome = getBiomeAt(x, z);
  
  // Surface layer
  if (y === height) {
    switch (biome) {
      case BiomeType.Desert:
        return sandMaterial;
      case BiomeType.Mountains:
        return y > 120 ? snowMaterial : rockMaterial;
      case BiomeType.Forest:
      case BiomeType.Plains:
      default:
        return grassMaterial;
    }
  }
  
  // Subsurface layers
  if (y > height - 4) {
    return biome === BiomeType.Desert ? sandMaterial : dirtMaterial;
  }
  
  // Deep layers
  return rockMaterial;
}

// Generate trees using local chunk coordinates
function generateTree(x: number, y: number, z: number): THREE.Group {
  const tree = new THREE.Group();
  
  // Trunk - using local coordinates
  const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
  const trunk = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 4, 0.6),
    trunkMaterial
  );
  trunk.position.set(x, y + 2, z);
  tree.add(trunk);
  
  // Leaves - using local coordinates
  const leavesMaterial = new THREE.MeshLambertMaterial({ color: 0x2d7d32 });
  const leaves = new THREE.Mesh(
    new THREE.SphereGeometry(2, 8, 8),
    leavesMaterial
  );
  leaves.position.set(x, y + 5, z);
  tree.add(leaves);
  
  return tree;
}

export function generateChunk(cx: number, cz: number): THREE.Group {
  try{
    const chunkGroup = new THREE.Group();
    chunkGroup.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
    chunkGroup.userData = { cx, cz };

    const blockGrid: number[][][] = [];
    for (let x = 0; x < CHUNK_SIZE; x++) {
      blockGrid[x] = [];
      for (let y = 0; y < MAX_HEIGHT; y++) {
        blockGrid[x][y] = [];
        for (let z = 0; z < CHUNK_SIZE; z++) {
          blockGrid[x][y][z] = -1; // -1 means empty/air
        }
      }
    }

    // Fill the grid with block type data first
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const worldX = cx * CHUNK_SIZE + x;
        const worldZ = cz * CHUNK_SIZE + z;
        const height = getTerrainHeightAt(worldX, worldZ);
        const biome = getBiomeAt(worldX, worldZ);

        for (let y = 0; y <= height; y++) {
          const caveValue = caveNoise(worldX / 30, y / 30, worldZ / 30);
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
      }
    }

    const materials = [grassMaterial, dirtMaterial, sandMaterial, rockMaterial, snowMaterial];
    const instancedMeshes = materials.map(mat =>
      new THREE.InstancedMesh(geometry, mat, MAX_BLOCKS_PER_CHUNK)
    );
    const instanceCounts = new Array(materials.length).fill(0);

    const waterMesh = new THREE.InstancedMesh(geometry, waterMaterial, CHUNK_SIZE * CHUNK_SIZE);
    let waterCount = 0;

    const dummy = new THREE.Object3D();

    // Now render only the visible faces
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const worldX = cx * CHUNK_SIZE + x;
        const worldZ = cz * CHUNK_SIZE + z;
        const height = getTerrainHeightAt(worldX, worldZ);
        const biome = getBiomeAt(worldX, worldZ);

        for (let y = 0; y <= height; y++) {
          // Skip air blocks (caves or outside terrain)
          if (blockGrid[x][y][z] === -1) continue;
          
          // Only render a block if at least one face is visible
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
          
          // Only render if at least one face is exposed
          if (isExposed) {
            dummy.position.set(x, y, z); // local position inside chunk
            dummy.updateMatrix();
            instancedMeshes[matIndex].setMatrixAt(instanceCounts[matIndex]++, dummy.matrix);
          }
        }

        // Water is always rendered
        if (height < WATER_LEVEL) {
          dummy.position.set(x, WATER_LEVEL, z);
          dummy.updateMatrix();
          waterMesh.setMatrixAt(waterCount++, dummy.matrix);
        }

        // Trees and houses
        if (biome === BiomeType.Forest && Math.random() < 0.04 && height > WATER_LEVEL) {
          const tree = generateTree(x, height, z);
          chunkGroup.add(tree);
        }

        if (biome === BiomeType.Plains && Math.random() < 0.001 && height > WATER_LEVEL) {
          const house = generateHouse(x, height, z);
          chunkGroup.add(house);
        }
      }
    }

    instancedMeshes.forEach((mesh, i) => {
      mesh.count = instanceCounts[i];
      if (mesh.count > 0) {
        mesh.instanceMatrix.needsUpdate = true;
        chunkGroup.add(mesh);
      }
    });

    if (waterCount > 0) {
      waterMesh.count = waterCount;
      waterMesh.instanceMatrix.needsUpdate = true;
      chunkGroup.add(waterMesh);
    }

    return chunkGroup;
  }
  catch (error) {
    console.error('Error generating chunk:', error);
    return new THREE.Group(); // Return an empty group on error
  }     
}

// Generate houses using local chunk coordinates
function generateHouse(x: number, y: number, z: number): THREE.Group {
  const house = new THREE.Group();
  
  // Base - using local coordinates
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(4, 3, 4),
    new THREE.MeshLambertMaterial({ color: 0x8B4513 })
  );
  base.position.set(x, y + 1.5, z);
  house.add(base);
  
  // Roof - using local coordinates
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(3, 2, 4),
    new THREE.MeshLambertMaterial({ color: 0xff0000 })
  );
  roof.position.set(x, y + 4, z);
  house.add(roof);
  
  return house;
}