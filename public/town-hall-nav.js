// Town Hall Navigation System
// Enhances the mini-map with interactive features for navigating to town halls

export const townHallLabels = [
  "Southwest Hall",
  "Southeast Hall", 
  "Northwest Hall", 
  "Northeast Hall"
];

// Called when a town hall marker is clicked
export function onTownHallMarkerClick(index) {
  const miniMapLabel = document.querySelector('.mini-map-label');
  if (miniMapLabel) {
    miniMapLabel.textContent = `→ ${townHallLabels[index]}`;
    miniMapLabel.style.color = '#0076c0';
    
    // Highlight the selected town hall marker
    const markers = document.querySelectorAll('.town-hall-marker');
    markers.forEach((marker, i) => {
      if (i === index) {
        marker.style.width = '10px';
        marker.style.height = '10px';
        marker.style.boxShadow = '0 0 5px white';
      } else {
        marker.style.width = '8px';
        marker.style.height = '8px';
        marker.style.boxShadow = 'none';
      }
    });
    
    // Set a timeout to return to normal state
    setTimeout(() => {
      miniMapLabel.textContent = 'Mini Map';
      miniMapLabel.style.color = 'white';
    }, 5000);
  }
}

// Initialize navigation features
export function initNavigation() {
  // Add click events to town hall markers
  const markers = document.querySelectorAll('.town-hall-marker');
  markers.forEach((marker, index) => {
    marker.addEventListener('click', () => onTownHallMarkerClick(index));
    marker.style.cursor = 'pointer';
    
    // Add hover effect
    marker.addEventListener('mouseenter', () => {
      marker.style.width = '10px';
      marker.style.height = '10px';
    });
    
    marker.addEventListener('mouseleave', () => {
      if (!marker.classList.contains('selected')) {
        marker.style.width = '8px';
        marker.style.height = '8px';
      }
    });
    
    // Add town hall labels on hover
    const tooltip = document.createElement('div');
    tooltip.className = 'town-hall-tooltip';
    tooltip.textContent = townHallLabels[index];
    tooltip.style.position = 'absolute';
    tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    tooltip.style.color = 'white';
    tooltip.style.padding = '3px 6px';
    tooltip.style.borderRadius = '3px';
    tooltip.style.fontSize = '10px';
    tooltip.style.whiteSpace = 'nowrap';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.opacity = '0';
    tooltip.style.transition = 'opacity 0.2s';
    tooltip.style.zIndex = '200';
    
    document.body.appendChild(tooltip);
    
    marker.addEventListener('mouseenter', (e) => {
      const rect = marker.getBoundingClientRect();
      tooltip.style.left = `${rect.left}px`;
      tooltip.style.top = `${rect.bottom + 5}px`;
      tooltip.style.opacity = '1';
    });
    
    marker.addEventListener('mouseleave', () => {
      tooltip.style.opacity = '0';
    });
  });
  
  // Add compass direction indicators to the mini-map
  const miniMap = document.getElementById('mini-map');
  if (miniMap) {
    const directions = ['N', 'E', 'S', 'W'];
    const positions = [
      { top: '5px', left: '50%', transform: 'translateX(-50%)' },  // N
      { top: '50%', right: '5px', transform: 'translateY(-50%)' }, // E
      { bottom: '5px', left: '50%', transform: 'translateX(-50%)' }, // S
      { top: '50%', left: '5px', transform: 'translateY(-50%)' }   // W
    ];
    
    directions.forEach((dir, i) => {
      const dirMarker = document.createElement('div');
      dirMarker.textContent = dir;
      dirMarker.style.position = 'absolute';
      dirMarker.style.color = 'white';
      dirMarker.style.fontSize = '10px';
      dirMarker.style.fontWeight = 'bold';
      
      // Apply positions from the array
      Object.keys(positions[i]).forEach(key => {
        dirMarker.style[key] = positions[i][key];
      });
      
      miniMap.appendChild(dirMarker);
    });
  }
}

// We'll initialize the navigation when the document is fully loaded
document.addEventListener('DOMContentLoaded', () => {
  // Wait a bit for the mini-map elements to be created by the HUD system
  setTimeout(initNavigation, 1000);
});