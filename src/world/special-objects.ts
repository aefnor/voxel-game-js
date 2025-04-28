import * as THREE from 'three';

// Interface for harvestable trees with wood resources
export interface HarvestableTree extends THREE.Group {
  woodRemaining: number;
  maxWood: number;
  isBeingHarvested: boolean;
  harvestedBy: string | null;
  growthStage: number;
  lastHarvestTime: number;
  canBeHarvested: () => boolean;
  harvestWood: (amount: number) => number;
  getWoodPercentage: () => number;
  updateAppearance: () => void;
  updateWoodLabel: () => void;
  woodLabel?: THREE.Sprite;
}

/**
 * Creates a text sprite to display wood amount
 */
function createWoodLabel(wood: number, maxWood: number): THREE.Sprite {
  // Create canvas for the label
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 128;
  canvas.height = 64;
  
  if (context) {
    context.fillStyle = 'rgba(0, 0, 0, 0.5)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add border
    context.strokeStyle = 'white';
    context.lineWidth = 2;
    context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
    
    // Add text
    context.font = 'bold 30px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = 'white';
    context.fillText(`Wood: ${wood}/${maxWood}`, canvas.width / 2, canvas.height / 2);
  }
  
  // Create texture from canvas
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  
  // Create sprite material with the texture
  const spriteMaterial = new THREE.SpriteMaterial({ 
    map: texture,
    transparent: true
  });
  
  // Create the sprite
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(1.5, 0.75, 1);
  
  return sprite;
}

/**
 * Creates a tree object from position data that can be harvested for wood
 */
export function createTreeFromData(x: number, y: number, z: number): THREE.Group {
  const tree = new THREE.Group() as HarvestableTree;
  
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
  
  // Add harvestable properties
  tree.woodRemaining = 10;
  tree.maxWood = 10;
  tree.isBeingHarvested = false;
  tree.harvestedBy = null;
  tree.growthStage = 1; // Full grown
  tree.lastHarvestTime = 0;
  
  // Create and add wood label
  const woodLabel = createWoodLabel(tree.woodRemaining, tree.maxWood);
  woodLabel.position.set(x, y + 7.5, z); // Position above the tree
  tree.add(woodLabel);
  tree.woodLabel = woodLabel;
  
  // Add methods to harvest wood
  tree.canBeHarvested = function() {
    return this.woodRemaining > 0 && !this.isBeingHarvested;
  };
  
  tree.harvestWood = function(amount: number) {
    const harvestedAmount = Math.min(amount, this.woodRemaining);
    this.woodRemaining -= harvestedAmount;
    this.lastHarvestTime = Date.now();
    
    // Update tree appearance and label
    this.updateAppearance();
    this.updateWoodLabel();
    
    return harvestedAmount;
  };
  
  tree.getWoodPercentage = function() {
    return this.woodRemaining / this.maxWood;
  };
  
  tree.updateAppearance = function() {
    const woodPercentage = this.getWoodPercentage();
    
    if (woodPercentage <= 0) {
      // Tree stump - no leaves, shorter trunk
      this.children[1].visible = false; // Hide leaves
      
      // Resize trunk to a stump
      const trunk = this.children[0] as THREE.Mesh;
      trunk.scale.y = 0.25;
      trunk.position.y = y + 0.5; // Lower position since it's shorter
      
      // Move label down to stump level
      if (this.woodLabel) {
        this.woodLabel.position.y = y + 1.5;
      }
    } else if (woodPercentage < 0.5) {
      // Partially harvested - smaller leaves
      const leaves = this.children[1] as THREE.Mesh;
      leaves.scale.set(woodPercentage * 2, woodPercentage * 2, woodPercentage * 2);
      
      // Adjust label height based on leaves size
      if (this.woodLabel) {
        this.woodLabel.position.y = y + 5 + woodPercentage * 2.5;
      }
    }
  };
  
  // Update the wood label
  tree.updateWoodLabel = function() {
    if (this.woodLabel) {
      // Remove old label
      this.remove(this.woodLabel);
      
      // Create new label with updated values
      const newLabel = createWoodLabel(this.woodRemaining, this.maxWood);
      
      // Position based on current tree state
      const woodPercentage = this.getWoodPercentage();
      if (woodPercentage <= 0) {
        newLabel.position.set(x, y + 1.5, z); // Lower for stumps
      } else {
        newLabel.position.set(x, y + 5 + woodPercentage * 2.5, z); // Position based on leaves size
      }
      
      // Add new label to tree
      this.add(newLabel);
      this.woodLabel = newLabel;
    }
  };
  
  // Add the tree's position to userData for easy reference
  tree.userData = {
    type: 'harvestableTree',
    position: new THREE.Vector3(x, y, z)
  };
  
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