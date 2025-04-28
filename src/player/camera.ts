import * as THREE from 'three';
import { player, playerHeight, playerCharacter, velocityY, onGround, GRAVITY, JUMP_FORCE, gun, createProjectile } from './player';
import { camera, scene } from '../renderer/renderer';
import { getTerrainHeightAt } from '../world/terrain';
import { getActualTerrainHeight } from '../world/chunkmanager';
import type { HumanCharacter } from './playerModel';
import type { Gun } from '../items/gun';

// Add shooting state variables
let canShoot = true;
const SHOOT_COOLDOWN = 0.3; // seconds between shots
let shootCooldownTimer = 0;
const projectiles: THREE.Mesh[] = [];
const PROJECTILE_LIFETIME = 3; // seconds
const PROJECTILE_SPEED = 0.5;

let keyState: Record<string, boolean> = {};
let isThirdPerson = false;
let _velocityY = velocityY;
let _onGround = onGround;
let walkCycle = 0;
let isMoving = false;

// Add variables for orbit camera mode
let isOrbiting = false;
let orbitAngle = 0; // Horizontal orbit angle (yaw)
let orbitHeight = 0; // Vertical orbit angle (pitch)
const orbitDistance = 10;
const orbitHeightMax = Math.PI / 3; // Limit how high/low we can look

// Add near the top with your other state variables
let isAiming = false; // Track when player is aiming (right-click)

// Add these cached vectors at the top of your file
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _movement = new THREE.Vector3();

document.addEventListener('click', () => {
  document.body.requestPointerLock();
});

document.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  keyState[key] = true;
  
  // Track Alt key for orbital camera
  if (key === 'alt') {
    isOrbiting = true;
  }

  if (key === 'v') {
    isThirdPerson = !isThirdPerson;
    if (!isThirdPerson) {
      player.add(camera);
      playerCharacter.visible = false;
      isOrbiting = false; // Disable orbiting when going to first-person
    } else {
      player.remove(camera);
      playerCharacter.visible = true;
      // Initialize orbit angle to match player rotation
      orbitAngle = player.rotation.y;
    }
  }
});

document.addEventListener('keyup', (e) => {
  const key = e.key.toLowerCase();
  keyState[key] = false;
  
  // Release Alt key, exit orbit mode
  if (key === 'alt') {
    isOrbiting = false;
    // Reset orbit height (gradually in the update function)
    // orbitHeight will gradually return to 0 in updateCamera
  }
});

document.addEventListener('mousemove', (e) => {
  if (!document.pointerLockElement) return;
  
  if (isThirdPerson && isOrbiting) {
    // In third-person orbit mode - rotate camera around player
    orbitAngle -= e.movementX * 0.002;
    orbitHeight -= e.movementY * 0.002;
    // Clamp vertical orbit
    orbitHeight = Math.max(-orbitHeightMax, Math.min(orbitHeightMax, orbitHeight));
  } else {
    // Normal rotation - rotate player and camera
    player.rotation.y -= e.movementX * 0.002;
    camera.rotation.x -= e.movementY * 0.002;
    camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));
  }
});

// Add these mouse event listeners after your existing event listeners
document.addEventListener('mousedown', (e) => {
  // Left click while aiming (button 0)
  if (e.button === 0 && isAiming && canShoot) {
    shoot();
    canShoot = false;
    shootCooldownTimer = SHOOT_COOLDOWN;
  }
  
  // Right click (button 2)
  if (e.button === 2) {
    isAiming = true;
    // Prevent context menu from appearing
    document.oncontextmenu = function(e) { return false; };
  }
});

document.addEventListener('mouseup', (e) => {
  // Right click released
  if (e.button === 2) {
    isAiming = false;
  }
});

// Add shooting function
function shoot() {
  // Show muzzle flash
  (gun as Gun).shoot();
  
  // Create projectile
  const projectile = createProjectile();
  
  // Get gun muzzle position in world space
  const muzzlePosition = new THREE.Vector3();
  (gun as Gun).muzzleFlash.getWorldPosition(muzzlePosition);
  projectile.position.copy(muzzlePosition);
  
  // Set velocity in direction player is facing
  const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion);
  projectile.userData.velocity = direction.multiplyScalar(PROJECTILE_SPEED);
  projectile.userData.lifetime = PROJECTILE_LIFETIME;
  
  // Add to scene
  scene.add(projectile);
  projectiles.push(projectile);
}

// Add projectile update function
function updateProjectiles(deltaTime: number) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const projectile = projectiles[i];
    
    // Move projectile
    if (projectile) {
      projectile.position.add(
        projectile.userData.velocity.clone().multiplyScalar(deltaTime * 60)
      );
    
    
      // Decrement lifetime
      projectile.userData.lifetime -= deltaTime;
      
      // Remove if lifetime expired
      if (projectile.userData.lifetime <= 0) {
        scene.remove(projectile);
        projectiles.splice(i, 1);
      }
    }
  }
}

// Modify your updateWalkAnimation function to handle aiming
function updateWalkAnimation(deltaTime: number) {
  const character = playerCharacter as HumanCharacter;
  const walkSpeed = 1; // Adjust to taste
  
  // Apply aiming pose to right arm if aiming
  if (isAiming) {
    // Raise arm to aiming position
    character.rightArm.rotation.x = -Math.PI / 2; // Aim forward
    character.rightArm.rotation.z = 0; // Keep straight
    
    // Allow other animations to continue
    if (isMoving && _onGround) {
      // Walking animation for other limbs
      walkCycle += deltaTime * walkSpeed;
      
      // Only animate left side when aiming
      character.leftLeg.rotation.x = Math.sin(walkCycle) * 0.4;
      character.rightLeg.rotation.x = -Math.sin(walkCycle) * 0.4;
      character.leftArm.rotation.x = -Math.sin(walkCycle) * 0.3;
      // Right arm stays in aiming position
    }
  } else {
    // Normal animation when not aiming
    if (isMoving && _onGround) {
      walkCycle += deltaTime * walkSpeed;
      
      const legSwing = Math.sin(walkCycle) * 0.4;
      const armSwing = Math.sin(walkCycle) * 0.3;
      
      character.leftLeg.rotation.x = legSwing;
      character.rightLeg.rotation.x = -legSwing;
      character.leftArm.rotation.x = -armSwing;
      character.rightArm.rotation.x = armSwing;
    } else {
      // Return limbs to neutral position when not moving
      character.leftLeg.rotation.x *= 0.8;
      character.rightLeg.rotation.x *= 0.8;
      character.leftArm.rotation.x *= 0.8;
      character.rightArm.rotation.x *= 0.8;
    }
  }

  // Keep your jumping animation
  if (!_onGround && keyState[' ']) {
    character.leftLeg.rotation.x = Math.PI / 4;
    character.rightLeg.rotation.x = Math.PI / 4;
    
    // Only adjust arms if not aiming
    if (!isAiming) {
      character.leftArm.rotation.x = -Math.PI / 4;
      character.rightArm.rotation.x = -Math.PI / 4;
    }
  }

  if(!_onGround && !keyState[' ']) {
    character.leftLeg.rotation.x = -Math.PI / 4;
    character.rightLeg.rotation.x = -Math.PI / 4;
    
    // Only adjust arms if not aiming
    if (!isAiming) {
      character.leftArm.rotation.x = Math.PI / 4;
      character.rightArm.rotation.x = Math.PI / 4;
    }
  }
}

export function updateCamera() {
  // Cache these calculations outside the function
  const moveSpeed = 0.1;
  const deltaTime = 1/60; // Better to calculate actual deltaTime between frames

  // Avoid recreating vectors every frame
  const forward = _forward.copy(new THREE.Vector3(0, 0, -1)).applyQuaternion(player.quaternion).normalize();
  forward.y = 0;
  forward.normalize();

  const right = _right.crossVectors(forward, _up).normalize();

  // Track if player is moving for animation
  isMoving = false;
  
  // Combine movement calculations to reduce vector operations
  const movement = _movement.set(0, 0, 0);
  
  if (keyState['w']) { movement.add(forward); isMoving = true; }
  if (keyState['s']) { movement.sub(forward); isMoving = true; }
  if (keyState['a']) { movement.sub(right); isMoving = true; }
  if (keyState['d']) { movement.add(right); isMoving = true; }
  
  // Only normalize and apply if actually moving
  if (isMoving) {
    movement.normalize().multiplyScalar(moveSpeed);
    player.position.add(movement);
  }

  // Gravity & terrain collision
  _velocityY += GRAVITY * 0.1;
  player.position.y += _velocityY * 0.1; // Use _velocityY, not velocityY

  // Use a try/catch to handle potential errors with terrain height calculation
  try {
    // Use getActualTerrainHeight instead of getTerrainHeightAt for more accurate collision
    const groundY = getActualTerrainHeight(player.position.x, player.position.z);
    const playerGroundLevel = groundY + playerHeight;
    
    // Add a sanity check to prevent extreme values
    if (isFinite(playerGroundLevel) && Math.abs(playerGroundLevel) < 100) {
      if (player.position.y <= playerGroundLevel) {
        player.position.y = playerGroundLevel;
        _velocityY = 0;
        _onGround = true;
      } else {
        _onGround = false;
      }
    } else {
      console.warn('Invalid ground height detected:', playerGroundLevel);
    }
  } catch (error) {
    console.error('Error calculating ground height:', error);
    // Use a fallback terrain height to prevent falling forever
    const fallbackGroundHeight = getTerrainHeightAt(player.position.x, player.position.z);
    if (player.position.y <= fallbackGroundHeight + playerHeight) {
      player.position.y = fallbackGroundHeight + playerHeight;
      _velocityY = 0;
      _onGround = true;
    }
  }

  // Jump
  if (keyState[' '] && _onGround) {
    console.log('Jump!');
    _velocityY = JUMP_FORCE;
    _onGround = false;
  }

  // Camera logic with orbit capability
  if (isThirdPerson) {
    let cameraTargetAngle, cameraTargetHeight;
    
    if (isOrbiting) {
      // Use the orbit angles directly
      cameraTargetAngle = orbitAngle;
      cameraTargetHeight = orbitHeight;
    } else {
      // Normal third-person camera follows player rotation
      cameraTargetAngle = player.rotation.y;
      // Gradually reset orbit height when not orbiting
      orbitHeight *= 0.9; // Dampen height back to 0
      cameraTargetHeight = orbitHeight;
    }
    
    // Position camera using spherical coordinates
    const horizontalDistance = orbitDistance * Math.cos(cameraTargetHeight);
    const verticalDistance = orbitDistance * Math.sin(cameraTargetHeight);
    
    // Calculate camera position
    camera.position.x = player.position.x + horizontalDistance * Math.sin(cameraTargetAngle);
    camera.position.z = player.position.z + horizontalDistance * Math.cos(cameraTargetAngle);
    camera.position.y = player.position.y + 2 + verticalDistance; // Add height offset
    
    // Look at player's head level
    camera.lookAt(new THREE.Vector3(
      player.position.x,
      player.position.y + 1.5,
      player.position.z
    ));
  } else {
    // First-person camera code remains unchanged
    if (!player.children.includes(camera)) {
      camera.position.set(0, playerHeight, 0);
      player.add(camera);
    }
  }

  // Update the walking animation
  updateWalkAnimation(deltaTime);

  // Sync player character with player
  playerCharacter.position.set(
    player.position.x,
    player.position.y - playerHeight / 2, // Adjust for model center
    player.position.z
  );
  playerCharacter.rotation.y = player.rotation.y + Math.PI; // Face the opposite direction of the player

  // Update shooting cooldown
  if (!canShoot) {
    shootCooldownTimer -= deltaTime;
    if (shootCooldownTimer <= 0) {
      canShoot = true;
    }
  }
  
  // Update projectiles
  updateProjectiles(deltaTime);
}
