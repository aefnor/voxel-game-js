import * as THREE from 'three';

export function generateHouse(x: number, y: number, z: number): THREE.Group {
  const house = new THREE.Group();
  const wallMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
  const wallThickness = 0.2;

  const frontWall = new THREE.Mesh(new THREE.BoxGeometry(4, 3, wallThickness), wallMaterial);
  frontWall.position.set(x, y + 1.5, z - 2 + wallThickness / 2);
  house.add(frontWall);

  const door = new THREE.Mesh(new THREE.BoxGeometry(1, 2, wallThickness + 0.1),
    new THREE.MeshLambertMaterial({ color: 0x000000, opacity: 0, transparent: true })
  );
  door.position.set(x, y + 1, z - 2 + wallThickness / 2);
  house.add(door);

  const window = new THREE.Mesh(new THREE.BoxGeometry(1, 1, wallThickness + 0.1),
    new THREE.MeshLambertMaterial({ color: 0x87ceeb, opacity: 0.5, transparent: true })
  );
  window.position.set(x, y + 2, z - 2 + wallThickness / 2);
  house.add(window);

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(4, 3, wallThickness), wallMaterial);
  backWall.position.set(x, y + 1.5, z + 2 - wallThickness / 2);
  house.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, 3, 4), wallMaterial);
  leftWall.position.set(x - 2 + wallThickness / 2, y + 1.5, z);
  house.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, 3, 4), wallMaterial);
  rightWall.position.set(x + 2 - wallThickness / 2, y + 1.5, z);
  house.add(rightWall);

  const roof = new THREE.Mesh(new THREE.ConeGeometry(3, 2, 4), new THREE.MeshLambertMaterial({ color: 0xff0000 }));
  roof.position.set(x, y + 4, z);
  house.add(roof);

  const floor = new THREE.Mesh(new THREE.BoxGeometry(4, wallThickness, 4), new THREE.MeshLambertMaterial({ color: 0x654321 }));
  floor.position.set(x, y, z);
  house.add(floor);

  return house;
}
