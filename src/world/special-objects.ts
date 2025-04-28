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
  position: THREE.Vector3;
}

/**
 * Creates a text sprite to display wood amount
 * Modified to ensure proper textures and visibility
 */
function createWoodLabel(wood: number, maxWood: number): THREE.Sprite {
  // Create canvas for the label
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 256; // Increase resolution for better text clarity
  canvas.height = 128;
  
  if (context) {
    // Clear the canvas with a semi-transparent background
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'rgba(0, 0, 0, 0.7)'; // More opaque background
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Add border
    context.strokeStyle = 'white';
    context.lineWidth = 4; // Thicker border
    context.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
    
    // Add text
    context.font = 'bold 48px Arial'; // Bigger text
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
    transparent: true,
    sizeAttenuation: true // Scale with distance
  });
  
  // Create the sprite
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(2, 1, 1); // Make label bigger overall
  
  return sprite;
}

/**
 * Creates a tree object from position data that can be harvested for wood
 */
export function createTreeFromData(x: number, y: number, z: number): THREE.Group {
  const tree = new THREE.Group() as HarvestableTree;
  
  // Set the tree's position directly at creation
  tree.position.set(x, y, z);
  
  // Trunk
  const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
  const trunk = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 4, 0.6),
    trunkMaterial
  );
  trunk.position.set(0, 2, 0); // Position relative to parent
  tree.add(trunk);
  
  // Leaves
  const leavesMaterial = new THREE.MeshLambertMaterial({ color: 0x2d7d32 });
  const leaves = new THREE.Mesh(
    new THREE.SphereGeometry(2, 8, 8),
    leavesMaterial
  );
  leaves.position.set(0, 5, 0); // Position relative to parent
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
  woodLabel.position.set(0, 7.5, 0); // Position relative to parent
  tree.add(woodLabel);
  tree.woodLabel = woodLabel;
  
  // Create highlight effect that will be visible when tree is being harvested
  const highlightGeometry = new THREE.SphereGeometry(2.3, 12, 12);
  const highlightMaterial = new THREE.MeshBasicMaterial({ 
    color: 0x90EE90, // Light green color
    transparent: true,
    opacity: 0.3,
    depthWrite: false, // Don't write to depth buffer
    side: THREE.DoubleSide
  });
  const highlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
  highlight.position.set(0, 5, 0); // Position around leaves
  highlight.visible = false; // Initially hidden
  tree.add(highlight);
  
  // Add methods to harvest wood
  tree.canBeHarvested = function() {
    return this.woodRemaining > 0 && !this.isBeingHarvested;
  };
  
  tree.harvestWood = function(amount: number) {
    const harvestedAmount = Math.min(amount, this.woodRemaining);
    this.woodRemaining -= harvestedAmount;
    this.lastHarvestTime = Date.now();
    
    // Force immediate update of the tree's appearance and label
    this.updateAppearance();
    this.updateWoodLabel();
    
    // Log harvesting for debugging
    console.log(`Tree harvested: ${harvestedAmount} wood. Remaining: ${this.woodRemaining}/${this.maxWood}`);
    
    return harvestedAmount;
  };
  
  tree.getWoodPercentage = function() {
    return this.woodRemaining / this.maxWood;
  };
  
  tree.updateAppearance = function() {
    const woodPercentage = this.getWoodPercentage();
    console.log(`Updating tree appearance. Wood percentage: ${woodPercentage}`);
    
    // Update the highlight visibility based on harvesting state
    const highlight = this.children.find(child => 
      child instanceof THREE.Mesh && 
      (child.material as THREE.MeshBasicMaterial).transparent === true &&
      (child.material as THREE.MeshBasicMaterial).opacity === 0.3
    );
    
    if (highlight) {
      highlight.visible = this.isBeingHarvested;
      
      // If tree is a stump, position the highlight lower
      if (woodPercentage <= 0) {
        highlight.position.y = 0.5;
        highlight.scale.set(0.4, 0.3, 0.4);
      } else if (woodPercentage < 0.5) {
        // Scale highlight with tree size
        highlight.position.y = 3;
        highlight.scale.set(woodPercentage * 2.2, woodPercentage * 2.2, woodPercentage * 2.2);
      } else {
        // Full size highlight
        highlight.position.y = 5;
        highlight.scale.set(1, 1, 1);
      }
    }
    
    if (woodPercentage <= 0) {
      // Tree stump - no leaves, shorter trunk
      console.log("Tree is now a stump!");
      this.children[1].visible = false; // Hide leaves
      
      // Resize trunk to a stump
      const trunk = this.children[0] as THREE.Mesh;
      trunk.scale.y = 0.25;
      trunk.position.y = 0.5; // Lower position since it's shorter (relative to parent)
      
      // Move label down to stump level
      if (this.woodLabel) {
        this.woodLabel.position.y = 1.5; // Relative to parent
      }
    } else if (woodPercentage < 0.5) {
      // Partially harvested - smaller leaves
      const leaves = this.children[1] as THREE.Mesh;
      leaves.scale.set(woodPercentage * 2, woodPercentage * 2, woodPercentage * 2);
      leaves.visible = true; // Ensure leaves are visible
      
      // Reset trunk to normal if needed
      const trunk = this.children[0] as THREE.Mesh;
      if (trunk.scale.y !== 1) {
        trunk.scale.y = 1;
        trunk.position.y = 2; // Relative to parent
      }
      
      // Adjust label height based on leaves size
      if (this.woodLabel) {
        this.woodLabel.position.y = 5 + woodPercentage * 2.5; // Relative to parent
      }
    } else {
      // Fully grown tree - restore default appearance if needed
      const leaves = this.children[1] as THREE.Mesh;
      leaves.scale.set(1, 1, 1);
      leaves.visible = true;
      
      const trunk = this.children[0] as THREE.Mesh;
      trunk.scale.y = 1;
      trunk.position.y = 2; // Relative to parent
      
      if (this.woodLabel) {
        this.woodLabel.position.y = 7.5; // Relative to parent
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
      
      // Position based on current tree state (all positions relative to parent tree)
      const woodPercentage = this.getWoodPercentage();
      if (woodPercentage <= 0) {
        newLabel.position.set(0, 1.5, 0); // Lower for stumps
      } else {
        newLabel.position.set(0, 5 + woodPercentage * 2.5, 0); // Position based on leaves size
      }
      
      // Ensure the sprite is fully visible by making it face the camera
      newLabel.matrixAutoUpdate = true;
      
      // Add new label to tree
      this.add(newLabel);
      this.woodLabel = newLabel;
      
      // Force texture update
      if (newLabel.material && newLabel.material.map) {
        newLabel.material.map.needsUpdate = true;
      }
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
  
  // Set the house's position directly
  house.position.set(x, y, z);
  
  // Base - position relative to parent
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(4, 3, 4),
    new THREE.MeshLambertMaterial({ color: 0x8B4513 })
  );
  base.position.set(0, 1.5, 0);
  house.add(base);
  
  // Roof - position relative to parent
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(3, 2, 4),
    new THREE.MeshLambertMaterial({ color: 0xff0000 })
  );
  roof.position.set(0, 4, 0);
  house.add(roof);
  
  // Add house type to userData
  house.userData = {
    type: 'house',
    position: new THREE.Vector3(x, y, z)
  };
  
  return house;
}

/**
 * Creates a town hall object from position data
 * Town halls are larger and more elaborate than regular houses
 */
export function createTownHallFromData(x: number, y: number, z: number): THREE.Group {
  const townHall = new THREE.Group();
  
  // Set the town hall's position directly
  townHall.position.set(x, y, z);
  
  // Main building - larger than a regular house (position relative to parent)
  const mainBuildingMaterial = new THREE.MeshLambertMaterial({ color: 0x9c7b46 }); // Slightly different color than houses
  const mainBuilding = new THREE.Mesh(
    new THREE.BoxGeometry(10, 6, 10),
    mainBuildingMaterial
  );
  mainBuilding.position.set(0, 3, 0);
  townHall.add(mainBuilding);
  
  // Roof - pyramid shape (position relative to parent)
  const roofMaterial = new THREE.MeshLambertMaterial({ color: 0x0076c0 }); // Blue roof to distinguish town halls
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(8, 4, 4),
    roofMaterial
  );
  roof.position.set(0, 8, 0);
  townHall.add(roof);
  
  // Clock tower (position relative to parent)
  const towerMaterial = new THREE.MeshLambertMaterial({ color: 0xd4d4d4 });
  const tower = new THREE.Mesh(
    new THREE.BoxGeometry(2, 5, 2),
    towerMaterial
  );
  tower.position.set(0, 12.5, 0);
  townHall.add(tower);
  
  // Tower roof (position relative to parent)
  const towerRoof = new THREE.Mesh(
    new THREE.ConeGeometry(1.5, 2, 4),
    roofMaterial
  );
  towerRoof.position.set(0, 16, 0);
  townHall.add(towerRoof);
  
  // Entrance (position relative to parent)
  const entranceMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
  const entrance = new THREE.Mesh(
    new THREE.BoxGeometry(4, 3, 1),
    entranceMaterial
  );
  entrance.position.set(0, 1.5, -5);
  townHall.add(entrance);
  
  // Make it prominent with a flag (position relative to parent)
  const flagPoleMaterial = new THREE.MeshLambertMaterial({ color: 0x8b8b8b });
  const flagPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 3, 8),
    flagPoleMaterial
  );
  flagPole.position.set(0, 18, 0);
  townHall.add(flagPole);
  
  // Flag (position relative to parent)
  const flagMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });
  const flag = new THREE.Mesh(
    new THREE.BoxGeometry(1, 0.8, 0.05),
    flagMaterial
  );
  flag.position.set(0.5, 17.5, 0);
  townHall.add(flag);
  
  // Add town hall type to userData
  townHall.userData = {
    type: 'townHall',
    id: Date.now(), // Generate a unique ID for the town hall
    position: new THREE.Vector3(x, y, z)
  };
  
  return townHall;
}