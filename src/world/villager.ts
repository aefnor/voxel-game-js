import * as THREE from 'three';
import { HarvestableTree } from './special-objects';
import { scene } from '../renderer/renderer';
import { trackHarvestedTree } from './npc-manager';

// Debug flag - set to false to avoid performance issues
const DEBUG_WOODCUTTER = true;
// Sample rate for logging (only log every Nth time) to reduce console spam
const DEBUG_SAMPLE_RATE = 100;
// Counter for sampling
let debugCounter = 0;

// States for the villager behavior system
export enum VillagerState {
  IDLE = 'idle',
  WALKING = 'walking',
  HARVESTING = 'harvesting',
  RETURNING = 'returning',
  DEPOSITING = 'depositing'
}

// Interface for the villager object with additional properties
export interface Villager extends THREE.Group {
  townHallId: number;
  walkDirection: THREE.Vector3;
  walkSpeed: number;
  walkRadius: number;
  lastDirectionChange: number;
  homePosition: THREE.Vector3;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  update: (deltaTime: number) => void;
}

// Extended interface for woodcutter villagers
export interface WoodcutterVillager extends Villager {
  axe: THREE.Group;
  woodCarried: number;
  maxWoodCapacity: number;
  targetTree: HarvestableTree | null;
  harvestSpeed: number;
  harvestTimer: number;
  state: VillagerState;
  stateTime: number;
  findTree: () => HarvestableTree | null;
  moveToTree: (deltaTime: number) => boolean;
  harvestTree: (deltaTime: number) => boolean;
  returnHome: (deltaTime: number) => boolean;
  depositWood: (deltaTime: number) => boolean;
}

// Different villager types with their colors
export const villagerTypes = [
  { 
    type: 'farmer', 
    clothesColor: 0x654321,  // Brown
    hairColor: 0x663300,     // Dark brown
    hasHat: true,
    hatColor: 0xDAA06D       // Straw hat
  },
  { 
    type: 'merchant', 
    clothesColor: 0x9370DB,  // Purple
    hairColor: 0x0a0a0a,     // Black
    hasHat: false,
    hatColor: 0x000000
  },
  { 
    type: 'guard', 
    clothesColor: 0x4169E1,  // Blue
    hairColor: 0x4f2811,     // Red-brown
    hasHat: true,
    hatColor: 0x7b7b7b       // Metal helmet
  },
  { 
    type: 'scholar', 
    clothesColor: 0x800020,  // Burgundy
    hairColor: 0x545454,     // Grey
    hasHat: false,
    hatColor: 0x000000
  },
  {
    type: 'woodcutter',
    clothesColor: 0x228B22,  // Forest green
    hairColor: 0x8B4513,     // Brown
    hasHat: true,
    hatColor: 0x8B4513       // Brown cap
  }
];

/**
 * Create an axe model for the woodcutter
 */
function createAxe(): THREE.Group {
  const axe = new THREE.Group();
  
  // Handle
  const handleMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8),
    handleMaterial
  );
  handle.rotation.x = Math.PI / 2; // Horizontal when held
  axe.add(handle);
  
  // Blade
  const bladeMaterial = new THREE.MeshLambertMaterial({ color: 0xC0C0C0 });
  const blade = new THREE.Mesh(
    new THREE.ConeGeometry(0.08, 0.2, 4),
    bladeMaterial
  );
  blade.rotation.z = Math.PI / 2;
  blade.position.set(0.3, 0, 0);
  axe.add(blade);
  
  return axe;
}

/**
 * Creates a standard villager that walks around near its home town hall
 */
export function createVillager(x: number, y: number, z: number, townHallId: number): Villager {
  // Select a random villager type
  const villagerType = villagerTypes[Math.floor(Math.random() * (villagerTypes.length - 1))]; // Exclude woodcutter
  
  // Create the basic group for our villager
  const villager = new THREE.Group() as Villager;
  
  // Materials
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xffdbac });
  const hairMat = new THREE.MeshStandardMaterial({ color: villagerType.hairColor });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
  const mouthMat = new THREE.MeshStandardMaterial({ color: 0x7b3f00 });
  const clothesMat = new THREE.MeshStandardMaterial({ color: villagerType.clothesColor });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
  const hatMat = new THREE.MeshStandardMaterial({ color: villagerType.hatColor });

  // Head - slightly smaller than the player character
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), skinMat);
  head.position.y = 1.9;
  villager.add(head);

  // Eyes
  const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.18, 2.0, 0.41);
  rightEye.position.set(0.18, 2.0, 0.41);
  villager.add(leftEye, rightEye);

  // Mouth
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.04, 0.04), mouthMat);
  mouth.position.set(0, 1.75, 0.41);
  villager.add(mouth);

  // Hair (block cap style)
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.3, 0.85), hairMat);
  hair.position.y = 2.25;
  villager.add(hair);

  // Hat (only for certain villager types)
  if (villagerType.hasHat) {
    let hat;
    if (villagerType.type === 'farmer') {
      // Straw hat for farmers
      hat = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16), hatMat);
      hat.position.y = 2.4;
    } else if (villagerType.type === 'guard') {
      // Metal helmet for guards
      hat = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.45, 0.3, 16), hatMat);
      hat.position.y = 2.4;
    }
    
    if (hat) {
      villager.add(hat);
    }
  }

  // Body
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.0, 0.4), clothesMat);
  torso.position.y = 1.1;
  villager.add(torso);

  // Arms - set pivot points at shoulders
  const armGeo = new THREE.BoxGeometry(0.25, 0.9, 0.25);
  armGeo.translate(0, -0.45, 0); // Move geometry so pivot is at shoulder
  
  const leftArm = new THREE.Mesh(armGeo, skinMat);
  const rightArm = new THREE.Mesh(armGeo, skinMat);
  leftArm.position.set(-0.55, 1.55, 0);
  rightArm.position.set(0.55, 1.55, 0);
  villager.add(leftArm, rightArm);
  
  // Store references
  villager.leftArm = leftArm;
  villager.rightArm = rightArm;

  // Legs - set pivot points at hips
  const legGeo = new THREE.BoxGeometry(0.3, 1.0, 0.3);
  legGeo.translate(0, -0.5, 0); // Move geometry so pivot is at hip

  const leftLeg = new THREE.Mesh(legGeo, pantsMat);
  const rightLeg = new THREE.Mesh(legGeo, pantsMat);
  leftLeg.position.set(-0.2, 0.6, 0);
  rightLeg.position.set(0.2, 0.6, 0);
  villager.add(leftLeg, rightLeg);
  
  // Store references
  villager.leftLeg = leftLeg;
  villager.rightLeg = rightLeg;

  // Set villager position
  villager.position.set(x, y, z);
  
  // Initialize villager properties
  villager.townHallId = townHallId;
  villager.walkDirection = new THREE.Vector3(
    Math.random() - 0.5,
    0,
    Math.random() - 0.5
  ).normalize();
  villager.walkSpeed = 0.5 + Math.random() * 0.5; // Random speed between 0.5 and 1.0
  villager.walkRadius = 8 + Math.random() * 4; // Random radius between 8 and 12 blocks
  villager.lastDirectionChange = 0;
  villager.homePosition = new THREE.Vector3(x, y, z);

  // Define the update method for animating the villager
  villager.update = (deltaTime: number) => {
    // Change direction occasionally
    const now = performance.now();
    if (now - villager.lastDirectionChange > 3000) { // Change direction every 3 seconds
      villager.walkDirection.set(
        Math.random() - 0.5,
        0,
        Math.random() - 0.5
      ).normalize();
      villager.lastDirectionChange = now;
      
      // Update rotation to face walking direction
      villager.rotation.y = Math.atan2(
        villager.walkDirection.x,
        villager.walkDirection.z
      );
    }
    
    // Calculate next position
    const nextPos = villager.position.clone().add(
      villager.walkDirection.clone().multiplyScalar(villager.walkSpeed * deltaTime)
    );
    
    // Check if we would exceed the walking radius
    const distanceFromHome = nextPos.distanceTo(villager.homePosition);
    if (distanceFromHome <= villager.walkRadius) {
      // Safe to move
      villager.position.copy(nextPos);
    } else {
      // Turn around
      villager.walkDirection.negate();
      villager.lastDirectionChange = now;
      villager.rotation.y = Math.atan2(
        villager.walkDirection.x,
        villager.walkDirection.z
      );
    }
    
    // Animate legs and arms while walking
    const walkCycle = Math.sin(now * 0.005) * 0.2;
    villager.leftLeg.rotation.x = walkCycle;
    villager.rightLeg.rotation.x = -walkCycle;
    villager.leftArm.rotation.x = -walkCycle;
    villager.rightArm.rotation.x = walkCycle;
  };
  
  return villager;
}

/**
 * Creates a woodcutter villager that can find and harvest trees
 */
export function createWoodcutterVillager(x: number, y: number, z: number, townHallId: number): WoodcutterVillager {
  // Always use woodcutter type
  const villagerType = villagerTypes[4]; // Woodcutter type
  
  // Create the basic group for our woodcutter
  const woodcutter = new THREE.Group() as WoodcutterVillager;
  
  // Materials
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xffdbac });
  const hairMat = new THREE.MeshStandardMaterial({ color: villagerType.hairColor });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
  const mouthMat = new THREE.MeshStandardMaterial({ color: 0x7b3f00 });
  const clothesMat = new THREE.MeshStandardMaterial({ color: villagerType.clothesColor });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
  const hatMat = new THREE.MeshStandardMaterial({ color: villagerType.hatColor });

  // Head - slightly smaller than the player character
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), skinMat);
  head.position.y = 1.9;
  woodcutter.add(head);

  // Eyes
  const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.18, 2.0, 0.41);
  rightEye.position.set(0.18, 2.0, 0.41);
  woodcutter.add(leftEye, rightEye);

  // Mouth
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.04, 0.04), mouthMat);
  mouth.position.set(0, 1.75, 0.41);
  woodcutter.add(mouth);

  // Hair (block cap style)
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.3, 0.85), hairMat);
  hair.position.y = 2.25;
  woodcutter.add(hair);

  // Cap for woodcutter
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.4, 0.2, 8), 
    hatMat
  );
  cap.position.y = 2.4;
  woodcutter.add(cap);

  // Body
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.0, 0.4), clothesMat);
  torso.position.y = 1.1;
  woodcutter.add(torso);

  // Arms - set pivot points at shoulders
  const armGeo = new THREE.BoxGeometry(0.25, 0.9, 0.25);
  armGeo.translate(0, -0.45, 0); // Move geometry so pivot is at shoulder
  
  const leftArm = new THREE.Mesh(armGeo, skinMat);
  const rightArm = new THREE.Mesh(armGeo, skinMat);
  leftArm.position.set(-0.55, 1.55, 0);
  rightArm.position.set(0.55, 1.55, 0);
  woodcutter.add(leftArm, rightArm);
  
  // Store references
  woodcutter.leftArm = leftArm;
  woodcutter.rightArm = rightArm;

  // Legs - set pivot points at hips
  const legGeo = new THREE.BoxGeometry(0.3, 1.0, 0.3);
  legGeo.translate(0, -0.5, 0); // Move geometry so pivot is at hip

  const leftLeg = new THREE.Mesh(legGeo, pantsMat);
  const rightLeg = new THREE.Mesh(legGeo, pantsMat);
  leftLeg.position.set(-0.2, 0.6, 0);
  rightLeg.position.set(0.2, 0.6, 0);
  woodcutter.add(leftLeg, rightLeg);
  
  // Store references
  woodcutter.leftLeg = leftLeg;
  woodcutter.rightLeg = rightLeg;

  // Create and add the axe
  const axe = createAxe();
  axe.position.set(0.65, 1.0, 0.2);
  axe.rotation.z = Math.PI / 2; // Hold axe vertically when not in use
  rightArm.add(axe); // Attach to right arm
  woodcutter.axe = axe;

  // Set woodcutter position
  woodcutter.position.set(x, y, z);
  
  // Initialize woodcutter properties
  woodcutter.townHallId = townHallId;
  woodcutter.walkDirection = new THREE.Vector3(
    Math.random() - 0.5,
    0,
    Math.random() - 0.5
  ).normalize();
  woodcutter.walkSpeed = 0.5 + Math.random() * 0.5; // Random speed between 0.5 and 1.0
  woodcutter.walkRadius = 40 + Math.random() * 10; // Increased radius to find trees (40-50 blocks)
  woodcutter.lastDirectionChange = 0;
  woodcutter.homePosition = new THREE.Vector3(x, y, z);
  
  // Woodcutter specific properties
  woodcutter.woodCarried = 0;
  woodcutter.maxWoodCapacity = 5; // Can carry up to 5 wood units
  woodcutter.targetTree = null;
  woodcutter.harvestSpeed = 1; // Wood units per second
  woodcutter.harvestTimer = 0;
  woodcutter.state = VillagerState.IDLE;
  woodcutter.stateTime = 0;

  // Find the closest harvestable tree
  woodcutter.findTree = function() {
    // Get all objects in the scene
    let closestTree: HarvestableTree | null = null;
    let closestDistance = this.walkRadius;
    
    if (DEBUG_WOODCUTTER) {
      console.log(`Woodcutter at [${this.position.x.toFixed(2)}, ${this.position.y.toFixed(2)}, ${this.position.z.toFixed(2)}] looking for trees with radius ${this.walkRadius}`);
    }
    
    let treeCounter = 0;
    let validTreeCounter = 0;
    
    // Check all objects in the scene that might be trees
    scene.traverse((object) => {
      // Check if object has userData.type property indicating it's a tree
      if (object.userData?.type === 'harvestableTree') {
        treeCounter++;
        
        // Check if tree has required harvesting methods
        if ((object as any).canBeHarvested) {
          // Check if tree has wood and is not being harvested
          if ((object as HarvestableTree).canBeHarvested()) {
            validTreeCounter++;
            
            const tree = object as HarvestableTree;
            const distance = this.position.distanceTo(
              new THREE.Vector3(
                object.position.x, 
                this.position.y, // Use woodcutter's y to measure horizontal distance
                object.position.z
              )
            );
            
            if (DEBUG_WOODCUTTER && debugCounter % DEBUG_SAMPLE_RATE === 0) {
              console.log(`  Found harvestable tree at [${object.position.x.toFixed(2)}, ${object.position.y.toFixed(2)}, ${object.position.z.toFixed(2)}], distance: ${distance.toFixed(2)}, wood: ${tree.woodRemaining}/${tree.maxWood}`);
            }
            
            if (distance < closestDistance) {
              closestTree = tree;
              closestDistance = distance;
            }
          } else if (DEBUG_WOODCUTTER) {
            const tree = object as HarvestableTree;
            console.log(`  Tree at [${object.position.x.toFixed(2)}, ${object.position.y.toFixed(2)}, ${object.position.z.toFixed(2)}] is not harvestable: woodRemaining=${tree.woodRemaining}, isBeingHarvested=${tree.isBeingHarvested}`);
          }
        } else if (DEBUG_WOODCUTTER) {
          console.log(`  Object at [${object.position.x.toFixed(2)}, ${object.position.y.toFixed(2)}, ${object.position.z.toFixed(2)}] has type 'harvestableTree' but no canBeHarvested method`);
        }
      }
    });
    
    if (DEBUG_WOODCUTTER) {
      console.log(`Found ${treeCounter} total trees, ${validTreeCounter} valid harvestable trees`);
      if (closestTree) {
        console.log(`Selected closest tree at distance ${closestDistance.toFixed(2)}`);
      } else {
        console.log(`No suitable tree found within range ${this.walkRadius}`);
      }
    }
    
    debugCounter++; // Increment the debug counter

    return closestTree;
  };

  // Move towards the target tree
  woodcutter.moveToTree = function(deltaTime: number) {
    if (!this.targetTree) return false;
    
    // Get tree position
    const treePos = new THREE.Vector3(
      this.targetTree.position.x, 
      this.position.y, // Maintain woodcutter's height
      this.targetTree.position.z
    );
    
    // Vector from woodcutter to tree
    const directionToTree = treePos.clone().sub(this.position).normalize();
    
    // Rotate to face the tree
    this.rotation.y = Math.atan2(directionToTree.x, directionToTree.z);
    
    // Move towards the tree
    const distance = this.position.distanceTo(treePos);
    if (distance > 1.5) { // Stop when within harvesting distance
      // Move towards tree
      const movement = directionToTree.multiplyScalar(this.walkSpeed * deltaTime);
      this.position.add(movement);
      
      // Animate walking
      const now = performance.now();
      const walkCycle = Math.sin(now * 0.005) * 0.2;
      this.leftLeg.rotation.x = walkCycle;
      this.rightLeg.rotation.x = -walkCycle;
      this.leftArm.rotation.x = -walkCycle;
      this.rightArm.rotation.x = walkCycle;
      
      return false; // Not at tree yet
    } else {
      // At tree, ready to harvest
      return true;
    }
  };

  // Harvest wood from the tree
  woodcutter.harvestTree = function(deltaTime: number) {
    if (!this.targetTree || this.woodCarried >= this.maxWoodCapacity) {
      if (DEBUG_WOODCUTTER) {
        if (!this.targetTree) {
          console.log('Cannot harvest: target tree is null');
        } else if (this.woodCarried >= this.maxWoodCapacity) {
          console.log(`Cannot harvest: inventory full (${this.woodCarried}/${this.maxWoodCapacity})`);
        }
      }
      return true;
    }
    
    // Start harvesting animation
    const now = performance.now();
    
    // Axe swinging animation
    this.rightArm.rotation.x = Math.sin(now * 0.01) * 0.8; 
    
    // Reset other animations
    this.leftLeg.rotation.x = 0;
    this.rightLeg.rotation.x = 0;
    this.leftArm.rotation.x = -0.2; // Slightly raised to balance
    
    // Tilt axe during swing
    this.axe.rotation.z = Math.PI / 2 - Math.abs(Math.sin(now * 0.01)) * 0.5;
    
    // Update harvest timer
    this.harvestTimer += deltaTime * this.harvestSpeed;
    
    // When timer reaches threshold, harvest wood
    if (this.harvestTimer >= 1) {
      // Mark tree as being harvested
      this.targetTree.isBeingHarvested = true;
      this.targetTree.harvestedBy = `woodcutter-${this.id || Math.random().toString(36).substr(2, 9)}`;
      
      // Harvest one unit of wood
      const woodBefore = this.targetTree.woodRemaining;
      const harvested = this.targetTree.harvestWood(1);
      const woodAfter = this.targetTree.woodRemaining;
      
      if (DEBUG_WOODCUTTER) {
        console.log(`Harvested ${harvested} wood from tree at [${this.targetTree.position.x.toFixed(2)}, ${this.targetTree.position.y.toFixed(2)}, ${this.targetTree.position.z.toFixed(2)}], wood remaining: ${woodAfter}/${this.targetTree.maxWood}`);
      }
      
      this.woodCarried += harvested;
      this.harvestTimer = 0;
      
      if (DEBUG_WOODCUTTER) {
        console.log(`Woodcutter now carrying ${this.woodCarried}/${this.maxWoodCapacity} wood`);
      }
      
      // Track tree for regrowth
      trackHarvestedTree(this.targetTree);
      
      // Release tree if fully harvested or inventory full
      if (!this.targetTree.canBeHarvested() || this.woodCarried >= this.maxWoodCapacity) {
        this.targetTree.isBeingHarvested = false;
        this.targetTree.harvestedBy = null;
        if (DEBUG_WOODCUTTER) {
          if (!this.targetTree.canBeHarvested()) {
            console.log('Tree fully harvested, returning to town hall');
          } else {
            console.log('Inventory full, returning to town hall');
          }
        }
        return true; // Finished harvesting
      }
    }
    
    return false; // Still harvesting
  };

  // Return to town hall with wood
  woodcutter.returnHome = function(deltaTime: number) {
    // Vector from woodcutter to home
    const directionToHome = this.homePosition.clone().sub(this.position).normalize();
    
    // Rotate to face home
    this.rotation.y = Math.atan2(directionToHome.x, directionToHome.z);
    
    // Distance to home
    const distance = this.position.distanceTo(this.homePosition);
    
    if (distance > 2) {
      // Move towards home
      const movement = directionToHome.multiplyScalar(this.walkSpeed * deltaTime);
      this.position.add(movement);
      
      // Walking animation
      const now = performance.now();
      const walkCycle = Math.sin(now * 0.005) * 0.2;
      this.leftLeg.rotation.x = walkCycle;
      this.rightLeg.rotation.x = -walkCycle;
      this.leftArm.rotation.x = -walkCycle;
      this.rightArm.rotation.x = walkCycle;
      
      // Reset axe position
      this.axe.rotation.z = Math.PI / 2;
      
      return false; // Still walking home
    } else {
      return true; // Reached home
    }
  };

  // Deposit wood at town hall
  woodcutter.depositWood = function(deltaTime: number) {
    // Animation for depositing - put hands down
    this.leftArm.rotation.x = 0.5;
    this.rightArm.rotation.x = 0.5;
    
    // Reset legs
    this.leftLeg.rotation.x = 0;
    this.rightLeg.rotation.x = 0;
    
    // Deposit animation timer
    this.stateTime += deltaTime;
    
    if (DEBUG_WOODCUTTER) {
      console.log(`Depositing wood: ${this.woodCarried} units, deposit progress: ${this.stateTime.toFixed(2)}/1.0`);
    }
    
    if (this.stateTime >= 1) {
      if (DEBUG_WOODCUTTER) {
        console.log(`Successfully deposited ${this.woodCarried} wood at town hall ${this.townHallId}`);
      }
      // Wood deposited, reset values
      this.woodCarried = 0;
      this.stateTime = 0;
      
      // Return to normal position
      this.leftArm.rotation.x = 0;
      this.rightArm.rotation.x = 0;
      
      return true; // Finished depositing
    }
    
    return false; // Still depositing
  };

  // Define the update method for the woodcutter's behavior
  woodcutter.update = (deltaTime: number) => {
    // State machine for woodcutter behavior
    switch (woodcutter.state) {
      case VillagerState.IDLE:
        // Look for trees while idle
        woodcutter.targetTree = woodcutter.findTree();
        
        if (woodcutter.targetTree) {
          // Found a tree, start moving to it
          woodcutter.state = VillagerState.WALKING;
        } else {
          // No tree found, wander around like regular villagers
          const now = performance.now();
          if (now - woodcutter.lastDirectionChange > 3000) { // Change direction every 3 seconds
            woodcutter.walkDirection.set(
              Math.random() - 0.5,
              0,
              Math.random() - 0.5
            ).normalize();
            woodcutter.lastDirectionChange = now;
            
            // Update rotation to face walking direction
            woodcutter.rotation.y = Math.atan2(
              woodcutter.walkDirection.x,
              woodcutter.walkDirection.z
            );
          }
          
          // Calculate next position
          const nextPos = woodcutter.position.clone().add(
            woodcutter.walkDirection.clone().multiplyScalar(woodcutter.walkSpeed * deltaTime)
          );
          
          // Check if we would exceed the walking radius
          const distanceFromHome = nextPos.distanceTo(woodcutter.homePosition);
          if (distanceFromHome <= woodcutter.walkRadius) {
            // Safe to move
            woodcutter.position.copy(nextPos);
          } else {
            // Turn around
            woodcutter.walkDirection.negate();
            woodcutter.lastDirectionChange = now;
            woodcutter.rotation.y = Math.atan2(
              woodcutter.walkDirection.x,
              woodcutter.walkDirection.z
            );
          }
          
          // Animate legs and arms while walking
          const walkCycle = Math.sin(now * 0.005) * 0.2;
          woodcutter.leftLeg.rotation.x = walkCycle;
          woodcutter.rightLeg.rotation.x = -walkCycle;
          woodcutter.leftArm.rotation.x = -walkCycle;
          woodcutter.rightArm.rotation.x = walkCycle;
        }
        break;

      case VillagerState.WALKING:
        // Moving to tree
        if (woodcutter.targetTree) {
          const arrived = woodcutter.moveToTree(deltaTime);
          
          if (arrived) {
            // Switch to harvesting state
            woodcutter.state = VillagerState.HARVESTING;
            woodcutter.harvestTimer = 0;
          }
        } else {
          // Tree is gone, go back to idle
          woodcutter.state = VillagerState.IDLE;
        }
        break;

      case VillagerState.HARVESTING:
        // Harvesting wood from tree
        const finishedHarvesting = woodcutter.harvestTree(deltaTime);
        
        if (finishedHarvesting) {
          // Either we're full of wood or the tree is empty
          woodcutter.state = VillagerState.RETURNING;
        }
        break;

      case VillagerState.RETURNING:
        // Going back to town hall with wood
        const arrivedHome = woodcutter.returnHome(deltaTime);
        
        if (arrivedHome) {
          // Switch to depositing state
          woodcutter.state = VillagerState.DEPOSITING;
          woodcutter.stateTime = 0;
        }
        break;

      case VillagerState.DEPOSITING:
        // Depositing wood at town hall
        const finishedDepositing = woodcutter.depositWood(deltaTime);
        
        if (finishedDepositing) {
          // Back to idle to look for more trees
          woodcutter.state = VillagerState.IDLE;
        }
        break;
    }
  };
  
  return woodcutter;
}