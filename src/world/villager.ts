import * as THREE from 'three';

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
  }
];

/**
 * Creates a villager that walks around near its home town hall
 * 
 * @param x Initial x position
 * @param y Initial y position
 * @param z Initial z position
 * @param townHallId The ID of the town hall this villager belongs to
 * @returns A villager object
 */
export function createVillager(x: number, y: number, z: number, townHallId: number): Villager {
  // Select a random villager type
  const villagerType = villagerTypes[Math.floor(Math.random() * villagerTypes.length)];
  
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