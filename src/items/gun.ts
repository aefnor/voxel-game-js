import * as THREE from 'three';

// Create an interface for the gun with shoot method
export interface Gun extends THREE.Group {
  muzzleFlash: THREE.Mesh;
  shoot: () => void;
}

export function createLowPolyGun(): Gun {
  const gun = new THREE.Group() as Gun;

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x555555 });

  // Gun body (blocky main shape)
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.2), bodyMat);
  body.position.set(0, 0, 0);
  gun.add(body);

  // Grip
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.3, 0.2), gripMat);
  grip.position.set(-0.2, -0.25, 0);
  gun.add(grip);

  // Barrel
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.1), barrelMat);
  barrel.position.set(0.5, 0.05, 0);
  gun.add(barrel);

  // Muzzle
  const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: 0x777777 }));
  muzzle.position.set(0.75, 0.05, 0);
  gun.add(muzzle);

  // Add muzzle flash (invisible by default)
  const muzzleFlash = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.2, 0.2),
    new THREE.MeshStandardMaterial({ 
      color: 0xffff00,
      emissive: 0xffff00,
      emissiveIntensity: 2
    })
  );
  muzzleFlash.position.set(0.85, 0.05, 0);
  muzzleFlash.visible = false;
  gun.add(muzzleFlash);
  
  // Store reference
  gun.muzzleFlash = muzzleFlash;
  
  // Add shoot method
  gun.shoot = function() {
    // Show muzzle flash briefly
    this.muzzleFlash.visible = true;
    setTimeout(() => {
      this.muzzleFlash.visible = false;
    }, 50);
  };

  return gun;
}
