import * as THREE from 'three';
import { scene } from '../renderer/renderer';
import { createVillager, createWoodcutterVillager, Villager, WoodcutterVillager } from './villager';
import { HarvestableTree } from './special-objects';

// Global villager data
const villagers: Villager[] = [];
const woodcutters: WoodcutterVillager[] = [];
const VILLAGERS_PER_TOWN_HALL = 3; // Number of villagers to spawn per town hall
const WOODCUTTERS_PER_TOWN_HALL = 1; // Number of woodcutters to spawn per town hall

// Debug flag to enable logging - set to false for performance
const DEBUG_WOODCUTTER = true;

// Track harvested trees for potential regrowth/respawning
const harvestedTrees: HarvestableTree[] = [];

// Town hall resource storage
interface TownHallResources {
  townHallId: number;
  wood: number;
}

const townHallResources: TownHallResources[] = [];

/**
 * Spawns villagers at a specific town hall location
 * 
 * @param position The town hall position
 * @param townHallId ID of the town hall these villagers belong to
 */
export function spawnVillagersAtTownHall(position: { x: number, y: number, z: number }, townHallId: number): void {
  // Initialize resources for this town hall
  townHallResources.push({
    townHallId,
    wood: 0
  });
  
  // Spawn regular villagers around the town hall
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
  
  // Spawn woodcutter villagers
  for (let i = 0; i < WOODCUTTERS_PER_TOWN_HALL; i++) {
    // Create some variation in starting positions, place them near the town hall entrance
    const offsetX = (Math.random() - 0.5) * 4; 
    const offsetZ = (Math.random() - 0.5) * 4 - 2; // Slightly in front of town hall
    
    // Create the woodcutter at the town hall position plus offset
    const woodcutter = createWoodcutterVillager(
      position.x + offsetX,
      position.y,
      position.z + offsetZ,
      townHallId
    );
    
    // Add the woodcutter to the scene
    scene.add(woodcutter);
    
    // Add to our tracking array
    woodcutters.push(woodcutter);
  }
}

/**
 * Updates all villagers in the game. Should be called in the animation loop.
 * 
 * @param deltaTime Time since last update in seconds
 */
export function updateVillagers(deltaTime: number): void {
  // Update regular villagers
  for (const villager of villagers) {
    villager.update(deltaTime);
  }
  
  // Update woodcutters
  for (const woodcutter of woodcutters) {
    woodcutter.update(deltaTime);
    
    // If woodcutter is depositing and has finished, add to town hall resources
    if (woodcutter.state === 'depositing' && woodcutter.woodCarried > 0) {
      const resources = townHallResources.find(r => r.townHallId === woodcutter.townHallId);
      if (resources) {
        resources.wood += woodcutter.woodCarried;
        console.log(`Town Hall ${woodcutter.townHallId} now has ${resources.wood} wood.`);
      }
    }
  }
  
  // Update harvested trees
  const now = Date.now();
  for (let i = 0; i < harvestedTrees.length; i++) {
    const tree = harvestedTrees[i];
    
    // Trees that are completely harvested will regrow after 60 seconds
    if (tree.woodRemaining <= 0 && now - tree.lastHarvestTime > 60000) {
      // Regrow the tree
      tree.woodRemaining = tree.maxWood;
      tree.updateAppearance();
      harvestedTrees.splice(i, 1);
      i--; // Adjust index after removing element
      console.log('A tree has regrown!');
    }
    // Partially harvested trees replenish more quickly (30 seconds)
    else if (tree.woodRemaining > 0 && tree.woodRemaining < tree.maxWood && now - tree.lastHarvestTime > 30000) {
      // Add one wood unit
      tree.woodRemaining = Math.min(tree.maxWood, tree.woodRemaining + 1);
      tree.updateAppearance();
      
      // Remove from tracking if fully replenished
      if (tree.woodRemaining >= tree.maxWood) {
        harvestedTrees.splice(i, 1);
        i--; // Adjust index after removing element
      }
    }
  }
}

/**
 * Tracks a tree that has been harvested for potential regrowth
 * 
 * @param tree The tree that has been harvested
 */
export function trackHarvestedTree(tree: HarvestableTree): void {
  if (!harvestedTrees.includes(tree)) {
    harvestedTrees.push(tree);
  }
}

/**
 * Returns all active villagers
 */
export function getVillagers(): Villager[] {
  return [...villagers, ...woodcutters];
}

/**
 * Returns all woodcutter villagers
 */
export function getWoodcutters(): WoodcutterVillager[] {
  return woodcutters;
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
  
  const allVillagers = [...villagers, ...woodcutters];
  for (const villager of allVillagers) {
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
  
  for (const woodcutter of woodcutters) {
    scene.remove(woodcutter);
  }
  woodcutters.length = 0;
  
  // Clear resource tracking
  townHallResources.length = 0;
  harvestedTrees.length = 0;
}