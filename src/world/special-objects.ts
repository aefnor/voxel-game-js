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