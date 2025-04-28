import * as THREE from 'three';
import { scene } from '../renderer/renderer';
import { createVillager, Villager } from './villager';

// Global villager data
const villagers: Villager[] = [];
const VILLAGERS_PER_TOWN_HALL = 3; // Number of villagers to spawn per town hall

/**
 * Spawns villagers at a specific town hall location
 * 
 * @param position The town hall position
 * @param townHallId ID of the town hall these villagers belong to
 */
export function spawnVillagersAtTownHall(position: { x: number, y: number, z: number }, townHallId: number): void {
  // Spawn multiple villagers around the town hall
  for (let i = 0; i < VILLAGERS_PER_TOWN_HALL; i++) {
    // Create some variation in starting positions
    const offsetX = (Math.random() - 0.5) * 6; 
    const offsetZ = (Math.random() - 0.5) * 6;
    
    // Create the villager at the town hall position plus offset
    const villager = createVillager(
      position.x + offsetX,
      position.y,
      position.z + offsetZ,
      townHallId
    );
    
    // Add the villager to the scene
    scene.add(villager);
    
    // Add to our tracking array
    villagers.push(villager);
  }
}

/**
 * Updates all villagers in the game. Should be called in the animation loop.
 * 
 * @param deltaTime Time since last update in seconds
 */
export function updateVillagers(deltaTime: number): void {
  for (const villager of villagers) {
    villager.update(deltaTime);
  }
}

/**
 * Returns all active villagers
 */
export function getVillagers(): Villager[] {
  return villagers;
}

/**
 * Find the closest villager to a given position
 * 
 * @param position Position to check from
 * @param maxDistance Maximum distance to consider
 * @returns The closest villager or null if none within range
 */
export function findClosestVillager(position: THREE.Vector3, maxDistance: number = 5): Villager | null {
  let closestVillager = null;
  let closestDistance = maxDistance;
  
  for (const villager of villagers) {
    const distance = position.distanceTo(villager.position);
    if (distance < closestDistance) {
      closestDistance = distance;
      closestVillager = villager;
    }
  }
  
  return closestVillager;
}

/**
 * Removes all villagers from the scene
 */
export function clearAllVillagers(): void {
  for (const villager of villagers) {
    scene.remove(villager);
  }
  villagers.length = 0;
}