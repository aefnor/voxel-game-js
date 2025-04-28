import * as THREE from 'three';

/**
 * Creates a tree object from position data
 */
export function createTreeFromData(x: number, y: number, z: number): THREE.Group {
  const tree = new THREE.Group();
  
  // Trunk
  const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
  const trunk = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 4, 0.6),
    trunkMaterial
  );
  trunk.position.set(x, y + 2, z);
  tree.add(trunk);
  
  // Leaves
  const leavesMaterial = new THREE.MeshLambertMaterial({ color: 0x2d7d32 });
  const leaves = new THREE.Mesh(
    new THREE.SphereGeometry(2, 8, 8),
    leavesMaterial
  );
  leaves.position.set(x, y + 5, z);
  tree.add(leaves);
  
  return tree;
}

/**
 * Creates a house object from position data
 */
export function createHouseFromData(x: number, y: number, z: number): THREE.Group {
  const house = new THREE.Group();
  
  // Base
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(4, 3, 4),
    new THREE.MeshLambertMaterial({ color: 0x8B4513 })
  );
  base.position.set(x, y + 1.5, z);
  house.add(base);
  
  // Roof
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(3, 2, 4),
    new THREE.MeshLambertMaterial({ color: 0xff0000 })
  );
  roof.position.set(x, y + 4, z);
  house.add(roof);
  
  return house;
}

/**
 * Creates a town hall object from position data
 * Town halls are larger and more elaborate than regular houses
 */
export function createTownHallFromData(x: number, y: number, z: number): THREE.Group {
  const townHall = new THREE.Group();
  
  // Main building - larger than a regular house
  const mainBuildingMaterial = new THREE.MeshLambertMaterial({ color: 0x9c7b46 }); // Slightly different color than houses
  const mainBuilding = new THREE.Mesh(
    new THREE.BoxGeometry(10, 6, 10),
    mainBuildingMaterial
  );
  mainBuilding.position.set(x, y + 3, z);
  townHall.add(mainBuilding);
  
  // Roof - pyramid shape
  const roofMaterial = new THREE.MeshLambertMaterial({ color: 0x0076c0 }); // Blue roof to distinguish town halls
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(8, 4, 4),
    roofMaterial
  );
  roof.position.set(x, y + 8, z);
  townHall.add(roof);
  
  // Clock tower
  const towerMaterial = new THREE.MeshLambertMaterial({ color: 0xd4d4d4 });
  const tower = new THREE.Mesh(
    new THREE.BoxGeometry(2, 5, 2),
    towerMaterial
  );
  tower.position.set(x, y + 12.5, z);
  townHall.add(tower);
  
  // Tower roof
  const towerRoof = new THREE.Mesh(
    new THREE.ConeGeometry(1.5, 2, 4),
    roofMaterial
  );
  towerRoof.position.set(x, y + 16, z);
  townHall.add(towerRoof);
  
  // Entrance
  const entranceMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
  const entrance = new THREE.Mesh(
    new THREE.BoxGeometry(4, 3, 1),
    entranceMaterial
  );
  entrance.position.set(x, y + 1.5, z - 5);
  townHall.add(entrance);
  
  // Make it prominent with a flag
  const flagPoleMaterial = new THREE.MeshLambertMaterial({ color: 0x8b8b8b });
  const flagPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 3, 8),
    flagPoleMaterial
  );
  flagPole.position.set(x, y + 18, z);
  townHall.add(flagPole);
  
  // Flag
  const flagMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });
  const flag = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.8, 0.05),
    flagMaterial
  );
  flag.position.set(x + 0.5, y + 17.5, z);
  townHall.add(flag);
  
  return townHall;
}