import * as THREE from 'three';
import { camera, scene } from '../renderer/renderer';
import { getTerrainHeightAt } from '../world/terrain';
import { createLowPolyHuman } from './playerModel';
import { createLowPolyGun, Gun } from '../items/gun';

interface playerState {
    keyState: Record<string, boolean>;
    isThirdPerson: boolean;
    velocityY: number;
    onGround: boolean;
}

export const player = new THREE.Object3D();
export const playerHeight = 1.8;
export let velocityY = 0;
export let onGround = false;

export const GRAVITY = -0.98;
export const JUMP_FORCE = 2;

// Player start position
player.position.set(0, 0, 0);
scene.add(player);

// Attach camera to player (first-person)
camera.position.set(0, playerHeight, 0);
player.add(camera);

// Add a visible player model (e.g. third-person mode)
export const playerCharacter = createLowPolyHuman();
playerCharacter.position.set(0, playerHeight / 2, 0);
scene.add(playerCharacter);

// Create and export the gun for access from camera.ts
export const gun = createLowPolyGun();
gun.scale.set(0.7, 0.7, 0.7); // Scale down to fit hand

// Fix gun orientation - adjust rotation to point barrel AWAY from character
gun.position.set(0, -1.1, 0.2);
gun.rotation.set(-Math.PI/2, -Math.PI/2, Math.PI); // Changed Y rotation to make barrel face outward

// Attach to right arm so it follows arm movement
playerCharacter.rightArm.add(gun);

// Create a simple projectile function
export function createProjectile(): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffff00 })
  );
}

// Functions to modify the variables
export function updateVelocityY(delta: number) {
  velocityY += delta;
}

export function setVelocityY(value: number) {
  velocityY = value;
}

export function setOnGround(value: boolean) {
  onGround = value;
}