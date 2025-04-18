import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
let lastChunkX = Infinity;
let lastChunkZ = Infinity;
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas });
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 30, 0);

let velocityY = 0;
let onGround = false;
const GRAVITY = -0.98;
const JUMP_FORCE = 2;

const player = new THREE.Object3D();
player.position.set(0, 40, 0);
scene.add(player);

const playerHeight = 1.8;
camera.position.set(0, playerHeight, 0);
player.add(camera);

// Create a simple player character (e.g., a box)
const playerCharacter = new THREE.Mesh(
  new THREE.BoxGeometry(1, 2, 1), // Width, Height, Depth
  new THREE.MeshStandardMaterial({ color: 0xff0000 }) // Red color
);
playerCharacter.position.set(0, playerHeight / 2, 0); // Center the character
scene.add(playerCharacter);

scene.add(new THREE.AmbientLight(0x666666));
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 7);
scene.add(directionalLight);

const BLOCK_SIZE = 1;
const CHUNK_SIZE = 16;
const MAX_HEIGHT = 12;
const MAX_BLOCKS_PER_CHUNK = CHUNK_SIZE * CHUNK_SIZE * MAX_HEIGHT;

const material = new THREE.MeshLambertMaterial({ color: 0x228B22 });
const geometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
const noise2D = createNoise2D();

const slider = document.getElementById('chunk-distance') as HTMLInputElement;
let renderDistance = parseInt(slider.value);
slider.addEventListener('input', () => {
  renderDistance = parseInt(slider.value);
  updateChunks();
});

type ChunkKey = string;
const chunks = new Map<ChunkKey, THREE.Group>();

function chunkKey(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

function generateChunk(cx: number, cz: number): THREE.Group {
  const chunkGroup = new THREE.Group(); // Group to hold blocks and houses
  const dummy = new THREE.Object3D();
  const blockMesh = new THREE.InstancedMesh(geometry, material, MAX_BLOCKS_PER_CHUNK);
  let instanceId = 0;

  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      const worldX = cx * CHUNK_SIZE + x;
      const worldZ = cz * CHUNK_SIZE + z;
      const height = Math.floor((noise2D(worldX / 20, worldZ / 20) + 1) / 2 * MAX_HEIGHT);

      for (let y = 0; y <= height; y++) {
        dummy.position.set(worldX, y, worldZ);
        dummy.updateMatrix();
        blockMesh.setMatrixAt(instanceId++, dummy.matrix);
      }

      if (Math.random() < 0.0005 && height > 1) {
        const house = generateHouse(worldX, height, worldZ);
        chunkGroup.add(house);
      }
    }
  }

  blockMesh.instanceMatrix.needsUpdate = true;
  chunkGroup.add(blockMesh);

  chunkGroup.userData = { cx, cz };
  return chunkGroup;
}

function updateChunks() {
  const playerChunkX = Math.floor(player.position.x / CHUNK_SIZE);
  const playerChunkZ = Math.floor(player.position.z / CHUNK_SIZE);

  if (playerChunkX === lastChunkX && playerChunkZ === lastChunkZ) {
    return; // Don't update if player hasn't changed chunks
  }

  lastChunkX = playerChunkX;
  lastChunkZ = playerChunkZ;

  const visibleChunks = new Set<string>();

  for (let dx = -renderDistance; dx <= renderDistance; dx++) {
    for (let dz = -renderDistance; dz <= renderDistance; dz++) {
      const cx = playerChunkX + dx;
      const cz = playerChunkZ + dz;
      const key = chunkKey(cx, cz);
      visibleChunks.add(key);

      if (!chunks.has(key)) {
        const chunk = generateChunk(cx, cz);
        scene.add(chunk);
        chunks.set(key, chunk);
      } else {
        chunks.get(key)!.visible = true;
      }
    }
  }

  for (const [key, chunk] of chunks) {
    chunk.visible = visibleChunks.has(key);
  }
}


// WASD Movement
let keyState: Record<string, boolean> = {};
document.addEventListener('keydown', (e) => keyState[e.key.toLowerCase()] = true);
document.addEventListener('keyup', (e) => keyState[e.key.toLowerCase()] = false);
const overlay = document.getElementById('start-overlay')!;
overlay.addEventListener('click', () => {
  overlay.style.display = 'none';
  canvas.requestPointerLock();
});

document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === canvas) {
    player.rotation.y -= e.movementX * 0.002;
    camera.rotation.x -= e.movementY * 0.002;
    camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
  }
});
let isThirdPerson = false; // Start in first-person mode
document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'v') { // Press 'V' to toggle camera mode
        isThirdPerson = !isThirdPerson;
        if (!isThirdPerson) {
            player.add(camera); // Reattach the camera for first-person
        } else {
            player.remove(camera); // Detach the camera for third-person
        }
    }
});
function getTerrainHeightAt(x: number, z: number): number {
    const h = (noise2D(x / 20, z / 20) + 1) / 2 * MAX_HEIGHT;
    return Math.floor(h);
  }
  function updateCamera() {
    const moveSpeed = 0.09;
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();

    // Get the forward direction based on the player's rotation
    forward.set(0, 0, -1).applyQuaternion(player.quaternion).normalize();
    forward.y = 0; // Ignore vertical movement
    forward.normalize();

    // Get the right direction by crossing the forward vector with the up vector
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    // Apply movement based on key states
    if (keyState['w']) player.position.add(forward.clone().multiplyScalar(moveSpeed));
    if (keyState['s']) player.position.add(forward.clone().multiplyScalar(-moveSpeed));
    if (keyState['a']) player.position.add(right.clone().multiplyScalar(-moveSpeed));
    if (keyState['d']) player.position.add(right.clone().multiplyScalar(moveSpeed));

    // Gravity
    velocityY += GRAVITY * 0.1;
    player.position.y += velocityY * 0.1;

    // Terrain collision (raycast down)
    const groundY = getTerrainHeightAt(player.position.x, player.position.z) + playerHeight;
    if (player.position.y <= groundY) {
        player.position.y = groundY;
        velocityY = 0;
        onGround = true;
    } else {
        onGround = false;
    }

    // Jump
    if (keyState[' '] && onGround) {
        velocityY = JUMP_FORCE;
        onGround = false;
    }

    // Update camera position based on mode
    if (isThirdPerson) {
        // Third-person: Position the camera behind the player
        const offset = new THREE.Vector3(0, 5, 10); // Adjust height and distance
        offset.applyQuaternion(player.quaternion); // Rotate offset based on player rotation
        camera.position.copy(player.position.clone().add(offset));
        camera.lookAt(player.position); // Look at the player
    } else {
        // First-person: Attach the camera to the player
        camera.position.set(0, playerHeight, 0);
        player.add(camera);
    }
}

function generateHouse(x: number, y: number, z: number): THREE.Group {
  const house = new THREE.Group();

  // Create the base (walls) of the house
  const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); // Brown color
  const wallThickness = 0.2;

  // Front wall with a door
  const frontWall = new THREE.Mesh(
    new THREE.BoxGeometry(4, 3, wallThickness), // Width, Height, Depth
    wallMaterial
  );
  frontWall.position.set(x, y + 1.5, z - 2 + wallThickness / 2); // Center the wall
  house.add(frontWall);

  // Cut out a door in the front wall
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(1, 2, wallThickness + 0.1), // Width, Height, Depth
    new THREE.MeshLambertMaterial({ color: 0x000000, opacity: 0, transparent: true }) // Invisible material
  );
  door.position.set(x, y + 1, z - 2 + wallThickness / 2);
  house.add(door);

  // Add a window to the front wall
  const window = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, wallThickness + 0.1), // Width, Height, Depth
    new THREE.MeshLambertMaterial({ color: 0x87ceeb, opacity: 0.5, transparent: true }) // Glass-like material
  );
  window.position.set(x, y + 2, z - 2 + wallThickness / 2);
  house.add(window);

  // Back wall
  const backWall = new THREE.Mesh(
    new THREE.BoxGeometry(4, 3, wallThickness),
    wallMaterial
  );
  backWall.position.set(x, y + 1.5, z + 2 - wallThickness / 2);
  house.add(backWall);

  // Left wall
  const leftWall = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, 3, 4),
    wallMaterial
  );
  leftWall.position.set(x - 2 + wallThickness / 2, y + 1.5, z);
  house.add(leftWall);

  // Right wall
  const rightWall = new THREE.Mesh(
    new THREE.BoxGeometry(wallThickness, 3, 4),
    wallMaterial
  );
  rightWall.position.set(x + 2 - wallThickness / 2, y + 1.5, z);
  house.add(rightWall);

  // Create the roof
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(3, 2, 4), // Radius, Height, Segments
    new THREE.MeshLambertMaterial({ color: 0xff0000 }) // Red color
  );
  roof.position.set(x, y + 4, z); // Position above the base
  house.add(roof);

  // Add a floor
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(4, wallThickness, 4),
    new THREE.MeshLambertMaterial({ color: 0x654321 }) // Dark brown color
  );
  floor.position.set(x, y, z);
  house.add(floor);

  return house;
}

function animate() {
    requestAnimationFrame(animate);

    // Sync player character with player position
    playerCharacter.position.copy(player.position);

    // Update player coordinates label
    const coordsDiv = document.getElementById('player-coords')!;
    coordsDiv.textContent = `Coordinates: (${player.position.x.toFixed(2)}, ${player.position.y.toFixed(2)}, ${player.position.z.toFixed(2)})`;

    updateCamera();
    updateChunks();
    renderer.render(scene, camera);
}

animate();
