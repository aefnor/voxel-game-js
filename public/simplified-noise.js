// Simplified noise implementation for the worker
// Based on simplex-noise library

// Create seeded random number generator
function createRandom(seed = Math.random()) {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

// Create 2D noise function
function createNoise2D(random = Math.random) {
  // Initialize permutation table
  const perm = new Uint8Array(512);
  const permGradIndex3D = new Uint8Array(512);
  const random1 = typeof random === 'function' ? random : createRandom(random);
  
  for (let i = 0; i < 256; i++) {
    perm[i] = i;
  }
  
  for (let i = 0; i < 255; i++) {
    const r = i + ~~(random1() * (256 - i));
    const aux = perm[i];
    perm[i] = perm[r];
    perm[r] = aux;
    perm[i + 256] = perm[i];
  }
  
  // Gradient tables for 2D
  const grad2 = new Float64Array([
    1, 1,
    -1, 1,
    1, -1,
    -1, -1,
    1, 0,
    -1, 0,
    0, 1,
    0, -1,
  ]);
  
  // Return the actual noise function
  return function noise2D(x, y) {
    // Skew the input space to determine which simplex cell we're in
    const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
    const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
    
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = x - X0;
    const y0 = y - Y0;
    
    // Determine which simplex we are in
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    
    // Offsets for corners
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1.0 + 2.0 * G2;
    const y2 = y0 - 1.0 + 2.0 * G2;
    
    // Calculate contribution from the three corners
    const ii = i & 255;
    const jj = j & 255;
    
    const gi0 = perm[ii + perm[jj]] % 8;
    const gi1 = perm[ii + i1 + perm[jj + j1]] % 8;
    const gi2 = perm[ii + 1 + perm[jj + 1]] % 8;
    
    // Calculate noise contributions from each corner
    let n0 = 0, n1 = 0, n2 = 0;
    
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    if (t0 >= 0) {
      t0 *= t0;
      n0 = t0 * t0 * (grad2[gi0 * 2] * x0 + grad2[gi0 * 2 + 1] * y0);
    }
    
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    if (t1 >= 0) {
      t1 *= t1;
      n1 = t1 * t1 * (grad2[gi1 * 2] * x1 + grad2[gi1 * 2 + 1] * y1);
    }
    
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    if (t2 >= 0) {
      t2 *= t2;
      n2 = t2 * t2 * (grad2[gi2 * 2] * x2 + grad2[gi2 * 2 + 1] * y2);
    }
    
    // Add contributions from each corner to get the final noise value
    // The result is scaled to return values in the range [-1, 1]
    return 70.0 * (n0 + n1 + n2);
  };
}

// Create 3D noise function
function createNoise3D(random = Math.random) {
  // Similar initialization to 2D but with 3D gradients
  const perm = new Uint8Array(512);
  const random1 = typeof random === 'function' ? random : createRandom(random);
  
  for (let i = 0; i < 256; i++) {
    perm[i] = i;
  }
  
  for (let i = 0; i < 255; i++) {
    const r = i + ~~(random1() * (256 - i));
    const aux = perm[i];
    perm[i] = perm[r];
    perm[r] = aux;
    perm[i + 256] = perm[i];
  }
  
  // Gradient tables for 3D
  const grad3 = new Float64Array([
    1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0,
    1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1,
    0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1
  ]);
  
  // Return the actual noise function
  return function noise3D(x, y, z) {
    // Skew the input space to determine which simplex cell we're in
    const F3 = 1.0 / 3.0;
    const G3 = 1.0 / 6.0;
    
    const s = (x + y + z) * F3;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const k = Math.floor(z + s);
    
    const t = (i + j + k) * G3;
    const X0 = i - t;
    const Y0 = j - t;
    const Z0 = k - t;
    
    const x0 = x - X0;
    const y0 = y - Y0;
    const z0 = z - Z0;
    
    // Determine which simplex we are in
    let i1, j1, k1; // Offsets for second corner of simplex in (i,j,k) coords
    let i2, j2, k2; // Offsets for third corner of simplex in (i,j,k) coords
    
    if (x0 >= y0) {
      if (y0 >= z0) {
        i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
      }
      else if (x0 >= z0) {
        i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1;
      }
      else {
        i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1;
      }
    }
    else {
      if (y0 < z0) {
        i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1;
      }
      else if (x0 < z0) {
        i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1;
      }
      else {
        i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0;
      }
    }
    
    // Offsets for corners
    const x1 = x0 - i1 + G3;
    const y1 = y0 - j1 + G3;
    const z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2.0 * G3;
    const y2 = y0 - j2 + 2.0 * G3;
    const z2 = z0 - k2 + 2.0 * G3;
    const x3 = x0 - 1.0 + 3.0 * G3;
    const y3 = y0 - 1.0 + 3.0 * G3;
    const z3 = z0 - 1.0 + 3.0 * G3;
    
    // Calculate noise contributions from each corner
    const ii = i & 255;
    const jj = j & 255;
    const kk = k & 255;
    
    const gi0 = perm[ii + perm[jj + perm[kk]]] % 12;
    const gi1 = perm[ii + i1 + perm[jj + j1 + perm[kk + k1]]] % 12;
    const gi2 = perm[ii + i2 + perm[jj + j2 + perm[kk + k2]]] % 12;
    const gi3 = perm[ii + 1 + perm[jj + 1 + perm[kk + 1]]] % 12;
    
    // Calculate noise contributions from each corner
    let n0 = 0, n1 = 0, n2 = 0, n3 = 0;
    
    let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
    if (t0 >= 0) {
      t0 *= t0;
      n0 = t0 * t0 * (grad3[gi0 * 3] * x0 + grad3[gi0 * 3 + 1] * y0 + grad3[gi0 * 3 + 2] * z0);
    }
    
    let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
    if (t1 >= 0) {
      t1 *= t1;
      n1 = t1 * t1 * (grad3[gi1 * 3] * x1 + grad3[gi1 * 3 + 1] * y1 + grad3[gi1 * 3 + 2] * z1);
    }
    
    let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
    if (t2 >= 0) {
      t2 *= t2;
      n2 = t2 * t2 * (grad3[gi2 * 3] * x2 + grad3[gi2 * 3 + 1] * y2 + grad3[gi2 * 3 + 2] * z2);
    }
    
    let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
    if (t3 >= 0) {
      t3 *= t3;
      n3 = t3 * t3 * (grad3[gi3 * 3] * x3 + grad3[gi3 * 3 + 1] * y3 + grad3[gi3 * 3 + 2] * z3);
    }
    
    // Add contributions from each corner to get the final noise value
    // The result is scaled to return values in the range [-1, 1]
    return 32.0 * (n0 + n1 + n2 + n3);
  };
}

// Export the noise functions for the worker
self.createNoise2D = createNoise2D;
self.createNoise3D = createNoise3D;