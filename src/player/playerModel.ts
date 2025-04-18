import * as THREE from 'three';

export interface HumanCharacter extends THREE.Group {
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
}

export function createLowPolyHuman(): HumanCharacter {
  const character = new THREE.Group() as HumanCharacter;

  // Materials
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xffdbac });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x2c1b10 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
  const mouthMat = new THREE.MeshStandardMaterial({ color: 0x7b3f00 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: 0x3366ff });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x333333 });

  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), skinMat);
  head.position.y = 2.5;
  character.add(head);

  // Eyes
  const eyeGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.2, 2.6, 0.51);
  rightEye.position.set(0.2, 2.6, 0.51);
  character.add(leftEye, rightEye);

  // Mouth
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.05), mouthMat);
  mouth.position.set(0, 2.3, 0.51);
  character.add(mouth);

  // Hair (block cap style)
  const hair = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.4, 1.05), hairMat);
  hair.position.y = 2.9;
  character.add(hair);

  // Body
  const torso = new THREE.Mesh(new THREE.BoxGeometry(1, 1.2, 0.5), shirtMat);
  torso.position.y = 1.4;
  character.add(torso);

  // Arms - set pivot points at shoulders
  const armGeo = new THREE.BoxGeometry(0.3, 1.1, 0.3);
  armGeo.translate(0, -0.55, 0); // Move geometry so pivot is at shoulder
  
  const leftArm = new THREE.Mesh(armGeo, skinMat);
  const rightArm = new THREE.Mesh(armGeo, skinMat);
  leftArm.position.set(-0.65, 1.95, 0);
  rightArm.position.set(0.65, 1.95, 0);
  character.add(leftArm, rightArm);
  
  // Store references
  character.leftArm = leftArm;
  character.rightArm = rightArm;

  // Legs - set pivot points at hips
  const legGeo = new THREE.BoxGeometry(0.4, 1.2, 0.4);
  legGeo.translate(0, -0.6, 0); // Move geometry so pivot is at hip

  const leftLeg = new THREE.Mesh(legGeo, pantsMat);
  const rightLeg = new THREE.Mesh(legGeo, pantsMat);
  leftLeg.position.set(-0.2, 0.8, 0);
  rightLeg.position.set(0.2, 0.8, 0);
  character.add(leftLeg, rightLeg);
  
  // Store references
  character.leftLeg = leftLeg;
  character.rightLeg = rightLeg;

  return character;
}
