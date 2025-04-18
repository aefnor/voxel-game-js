import { app, BrowserWindow } from 'electron';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Electron + ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.loadFile(join(__dirname, '..', 'public', 'index.html'));
}

app.whenReady().then(createWindow);

// import { initRenderer, scene, camera } from './render/renderer';
// import { player, playerCharacter } from './player/player';
// import { updateCamera } from './player/camera';
// import { initInput } from './input/inputhandler';
// import { initHUD, updateHUD } from './ui/hud';
// import { updateChunks } from './world/chunkmanager';

// function animate() {
//   requestAnimationFrame(animate);
//   playerCharacter.position.copy(player.position);
//   updateHUD(player.position);
//   updateCamera();
//   updateChunks();
//   initRenderer().render(scene, camera);
// }

// initHUD();
// initInput();
// animate();
