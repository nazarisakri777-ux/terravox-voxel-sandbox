// ============================================================
// TERRAVOX — Greedy Chunk Mesher, AO, Custom Shaders & Water
// ============================================================
window.TV = window.TV || {};

(function (TV) {
  const { BLOCKS, TILES: T, B, CHUNK_SIZE, WORLD_H, getTileUV, atlasTexture, computeChunkLighting } = TV;

  // Global shader uniforms updated every frame from main.js
  const shaderUniforms = {
    uTime: { value: 0 },
    uSkyColor: { value: new THREE.Color(1.0, 1.0, 1.0) },
    uTorchColor: { value: new THREE.Color(1.15, 0.72, 0.32) },
    uSunColor: { value: new THREE.Color(1.0, 0.96, 0.85) },
    uAoEnabled: { value: 1.0 },
    uSunDir: { value: new THREE.Vector3(0.4, 0.85, 0.3).normalize() }
  };

  function patchTerrainShader(material, isCutout = false) {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = shaderUniforms.uTime;
      shader.uniforms.uSkyColor = shaderUniforms.uSkyColor;
      shader.uniforms.uTorchColor = shaderUniforms.uTorchColor;
      shader.uniforms.uAoEnabled = shaderUniforms.uAoEnabled;

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           attribute vec4 aTileRect;
           attribute vec4 aLight;
           uniform float uTime;
           uniform float uAoEnabled;
           varying vec4 vTileRect;
           varying vec2 vLocalUv;
           varying float vAo;
           varying float vSkyLight;
           varying float vBlockLight;
           varying float vEmissive;`
        )
        .replace(
          '#include <uv_vertex>',
          `#include <uv_vertex>
           vTileRect = aTileRect;
           vLocalUv = uv;
           vAo = mix(1.0, aLight.x, uAoEnabled);
           vSkyLight = aLight.y;
           vBlockLight = aLight.z;
           vEmissive = aLight.w < 0.0 ? -aLight.w : 0.0;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
           if (aLight.w > 0.0) {
             float sway = sin(uTime * 2.4 + position.x * 1.1 + position.z * 0.9) * 0.065 * aLight.w;
             transformed.x += sway;
             transformed.z += sway * 0.6;
           }`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform vec3 uSkyColor;
           uniform vec3 uTorchColor;
           varying vec4 vTileRect;
           varying vec2 vLocalUv;
           varying float vAo;
           varying float vSkyLight;
           varying float vBlockLight;
           varying float vEmissive;`
        )
        .replace(
          '#include <map_fragment>',
          `#ifdef USE_MAP
             vec2 wrapped = clamp(fract(max(vLocalUv - 0.0005, 0.0)), 0.002, 0.998);
             vec2 tiledUv = vTileRect.xy + wrapped * vTileRect.zw;
             vec4 texelColor = texture2D( map, tiledUv );
             texelColor = mapTexelToLinear( texelColor );
             diffuseColor *= texelColor;
           #endif`
        )
        .replace(
          'reflectedLight.indirectDiffuse *= BRDF_Diffuse_Lambert( diffuseColor.rgb );',
          `reflectedLight.indirectDiffuse *= BRDF_Diffuse_Lambert( diffuseColor.rgb );
           reflectedLight.indirectDiffuse *= (0.06 + 0.94 * vSkyLight) * vAo;`
        )
        .replace(
          'reflectedLight.directDiffuse *= BRDF_Diffuse_Lambert( diffuseColor.rgb ) * getShadowMask();',
          `reflectedLight.directDiffuse *= BRDF_Diffuse_Lambert( diffuseColor.rgb ) * getShadowMask();
           reflectedLight.directDiffuse *= vSkyLight * vAo;
           vec3 blockBounce = (vBlockLight * vBlockLight) * uTorchColor * vAo * diffuseColor.rgb;
           totalEmissiveRadiance += blockBounce + diffuseColor.rgb * vEmissive;`
        );
    };
    material.customProgramCacheKey = () => (isCutout ? 'terravox-cutout-v2' : 'terravox-solid-v2');
  }

  const solidMaterial = new THREE.MeshLambertMaterial({
    map: atlasTexture,
    vertexColors: true
  });
  patchTerrainShader(solidMaterial, false);

  const cutoutMaterial = new THREE.MeshLambertMaterial({
    map: atlasTexture,
    vertexColors: true,
    alphaTest: 0.35,
    side: THREE.DoubleSide
  });
  patchTerrainShader(cutoutMaterial, true);

  // Depth material for alpha-tested leaves so dappled shadows match Ref 4!
  const cutoutDepthMaterial = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking
  });
  cutoutDepthMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uMap = { value: atlasTexture };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n#ifndef USE_UV\nattribute vec2 uv;\n#endif\nattribute vec4 aTileRect;\nvarying vec4 vTileRect;\nvarying vec2 vLocalUv;`)
      .replace('#include <uv_vertex>', `#include <uv_vertex>\nvTileRect = aTileRect;\nvLocalUv = uv;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform sampler2D uMap;\nvarying vec4 vTileRect;\nvarying vec2 vLocalUv;`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>\nvec2 wuv = clamp(fract(max(vLocalUv - 0.0005, 0.0)), 0.002, 0.998);\nif (texture2D(uMap, vTileRect.xy + wuv * vTileRect.zw).a < 0.35) discard;`);
  };
  cutoutDepthMaterial.customProgramCacheKey = () => 'terravox-depth-cutout-v1';

  // Animated Water Material with Fresnel sky glow & sun sparkle
  const waterMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: shaderUniforms.uTime,
      uSkyColor: shaderUniforms.uSkyColor,
      uSunColor: shaderUniforms.uSunColor,
      uSunDir: shaderUniforms.uSunDir,
      fogColor: { value: new THREE.Color(0x88bbee) },
      fogNear: { value: 45 },
      fogFar: { value: 110 }
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true,
    vertexShader: `
      attribute float aSky;
      uniform float uTime;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying float vSky;
      varying float vFogDepth;
      void main() {
        vec3 p = position;
        if (normal.y > 0.5) {
          p.y -= 0.12 - sin(p.x * 1.4 + uTime * 2.2) * 0.035 - cos(p.z * 1.3 + uTime * 1.8) * 0.035;
        }
        vec4 wp = vec4(p, 1.0);
        vWorldPos = wp.xyz;
        vNormal = normal;
        vSky = aSky;
        vec4 mvPos = modelViewMatrix * wp;
        vFogDepth = -mvPos.z;
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uSkyColor;
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      uniform vec3 fogColor;
      uniform float fogNear;
      uniform float fogFar;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying float vSky;
      varying float vFogDepth;
      void main() {
        vec2 wp = vWorldPos.xz;
        float w1 = sin(wp.x * 2.6 + uTime * 2.3 + sin(wp.y * 1.7 + uTime));
        float w2 = cos(wp.y * 2.8 - uTime * 1.9 + cos(wp.x * 1.9));
        float ripple = (w1 + w2) * 0.5;

        vec3 n = normalize(vNormal + vec3(ripple * 0.09, 0.0, (w1 - w2) * 0.06));
        vec3 viewDir = normalize(cameraPosition - vWorldPos);
        float fresnel = pow(1.0 - max(dot(viewDir, n), 0.0), 3.0);

        vec3 deepWater = vec3(0.08, 0.30, 0.62) * (0.25 + 0.75 * vSky) * uSkyColor;
        vec3 shallowTint = vec3(0.16, 0.52, 0.80) * (0.25 + 0.75 * vSky) * uSkyColor;
        vec3 col = mix(deepWater, shallowTint, clamp(ripple * 0.35 + 0.5, 0.0, 1.0));

        col = mix(col, fogColor * 1.05, fresnel * 0.55);

        vec3 halfVec = normalize(uSunDir + viewDir);
        float spec = pow(max(dot(n, halfVec), 0.0), 64.0) * vSky;
        col += uSunColor * spec * 0.75;

        float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
        col = mix(col, fogColor, fogFactor);
        gl_FragColor = vec4(col, mix(0.74, 0.90, fresnel));
      }
    `
  });

  function isOpaqueCube(id) {
    if (id === 0) return false;
    const def = BLOCKS[id];
    return !!(def && def.solid && !def.transparent && !def.shape && !def.cactus);
  }

  function isOccludingForAO(id) {
    if (id === 0) return false;
    const def = BLOCKS[id];
    return !!(def && def.solid && !def.transparent && !def.shape);
  }

  class Chunk {
    constructor(cx, cz) {
      this.cx = cx;
      this.cz = cz;
      this.voxels = new Uint8Array(CHUNK_SIZE * WORLD_H * CHUNK_SIZE);
      this.meta = new Uint8Array(CHUNK_SIZE * WORLD_H * CHUNK_SIZE);
      this.lightMap = new Uint8Array(CHUNK_SIZE * WORLD_H * CHUNK_SIZE);
      this.biomeMap = new Array(CHUNK_SIZE * CHUNK_SIZE);
      this.lightComputed = false;
      this.dirty = false; // Modified by player / ticks -> save to IndexedDB
      this.solidMesh = null;
      this.cutoutMesh = null;
      this.waterMesh = null;
      this.isMeshed = false;
    }

    disposeMesh(scene) {
      if (this.solidMesh) { scene.remove(this.solidMesh); this.solidMesh.geometry.dispose(); this.solidMesh = null; }
      if (this.cutoutMesh) { scene.remove(this.cutoutMesh); this.cutoutMesh.geometry.dispose(); this.cutoutMesh = null; }
      if (this.waterMesh) { scene.remove(this.waterMesh); this.waterMesh.geometry.dispose(); this.waterMesh = null; }
      this.isMeshed = false;
    }

    rebuild(world, scene, shadowsEnabled) {
      this.disposeMesh(scene);
      computeChunkLighting(this, (ncx, ncz) => world.getChunk(ncx, ncz, false));

      const solid = { pos: [], norm: [], uv: [], col: [], rect: [], light: [], idx: [] };
      const cutout = { pos: [], norm: [], uv: [], col: [], rect: [], light: [], idx: [] };
      const water = { pos: [], norm: [], sky: [], idx: [] };

      const startX = this.cx * CHUNK_SIZE;
      const startZ = this.cz * CHUNK_SIZE;

      // Helper to read voxel & light across chunk borders cleanly
      const getV = (wx, wy, wz) => world.getBlock(wx, wy, wz);
      const getM = (wx, wy, wz) => world.getMeta(wx, wy, wz);
      const getL = (wx, wy, wz) => world.getLight(wx, wy, wz);

      // -------------------------------------------------------------
      // 1. GREEDY MESHING FOR ALL OPAQUE FULL CUBES
      // -------------------------------------------------------------
      // For each of 6 face directions: d = axis (0=X, 1=Y, 2=Z), dir = +1 or -1
      const dims = [CHUNK_SIZE, WORLD_H, CHUNK_SIZE];
      const mask = new Array(CHUNK_SIZE * WORLD_H);

      for (let d = 0; d < 3; d++) {
        const u = (d + 1) % 3;
        const v = (d + 2) % 3;
        const x = [0, 0, 0];
        const q = [0, 0, 0];
        q[d] = 1;

        for (let dir of [1, -1]) {
          const nx = d === 0 ? dir : 0;
          const ny = d === 1 ? dir : 0;
          const nz = d === 2 ? dir : 0;

          for (x[d] = 0; x[d] < dims[d]; x[d]++) {
            let n = 0;
            for (x[v] = 0; x[v] < dims[v]; x[v]++) {
              for (x[u] = 0; x[u] < dims[u]; x[u]++) {
                const lx = x[0], y = x[1], lz = x[2];
                const id = this.voxels[lx + y * CHUNK_SIZE + lz * CHUNK_SIZE * WORLD_H];
                if (!isOpaqueCube(id)) {
                  mask[n++] = null;
                  continue;
                }
                const wx = startX + lx;
                const wz = startZ + lz;
                const ax = wx + nx, ay = y + ny, az = wz + nz;
                if (ay < 0 || ay >= WORLD_H) {
                  mask[n++] = null;
                  continue;
                }
                const adjId = getV(ax, ay, az);
                if (isOpaqueCube(adjId)) {
                  mask[n++] = null;
                  continue;
                }

                // Resolve tile index for this face
                const def = BLOCKS[id];
                const meta = this.meta[lx + y * CHUNK_SIZE + lz * CHUNK_SIZE * WORLD_H];
                const tile = this._resolveFaceTile(id, def, meta, nx, ny, nz);

                // Compute 4 corner AO + Light samples from the air block adjacent to face
                const lightVal = getL(ax, ay, az);
                const skyL = ((lightVal >> 4) & 15) / 15;
                const blkL = (lightVal & 15) / 15;
                const ao = this._computeFaceAO(getV, ax, ay, az, d, nx, ny, nz);

                // Emissive strength (e.g. Lava or Lit Furnace front)
                let emissive = 0;
                if (id === B.LAVA) emissive = -0.85;
                else if (id === B.FURNACE && (meta & 4) && tile === T.FURNACE_FRONT_ON) emissive = -0.55;

                // Subtle biome tint
                const tint = this._getBlockTint(id, def, tile, wx, wz, world);

                // Key for greedy merging (only merge uniform-AO cells so AO gradients never stretch)
                const uniformAO = ao[0] === ao[1] && ao[1] === ao[2] && ao[2] === ao[3];
                const mergeKey = uniformAO
                  ? `${tile}|${ao[0]}|${lightVal}|${tint[0].toFixed(2)},${tint[1].toFixed(2)},${tint[2].toFixed(2)}|${emissive}`
                  : null;
                mask[n++] = { tile, ao, skyL, blkL, emissive, tint, key: mergeKey };
              }
            }

            // Greedy 2D rectangle sweep over (dims[u] x dims[v])
            n = 0;
            for (let j = 0; j < dims[v]; j++) {
              for (let i = 0; i < dims[u];) {
                const cell = mask[n];
                if (!cell) { i++; n++; continue; }

                let w = 1;
                if (cell.key !== null) {
                  while (i + w < dims[u] && mask[n + w] && mask[n + w].key === cell.key) w++;
                }

                let h = 1;
                let done = false;
                if (cell.key !== null) {
                  while (j + h < dims[v]) {
                    for (let k = 0; k < w; k++) {
                      const nextCell = mask[n + k + h * dims[u]];
                      if (!nextCell || nextCell.key !== cell.key) { done = true; break; }
                    }
                    if (done) break;
                    h++;
                  }
                }

                // Emit merged quad!
                x[u] = i;
                x[v] = j;
                const du = [0, 0, 0]; du[u] = w;
                const dv = [0, 0, 0]; dv[v] = h;
                const offset = dir > 0 ? 1 : 0;

                const ox = startX + x[0] + (d === 0 ? offset : 0);
                const oy = x[1] + (d === 1 ? offset : 0);
                const oz = startZ + x[2] + (d === 2 ? offset : 0);

                this._emitGreedyFace(solid, ox, oy, oz, du, dv, nx, ny, nz, w, h, cell);

                // Clear merged region from mask
                for (let l = 0; l < h; l++) {
                  for (let k = 0; k < w; k++) {
                    mask[n + k + l * dims[u]] = null;
                  }
                }
                i += w;
                n += w;
              }
            }
          }
        }
      }

      // -------------------------------------------------------------
      // 2. NON-CUBE & SPECIAL BLOCKS (Water, Foliage, Stairs, Fences, Doors, Torches, Lanterns, Cactus, Beds)
      // -------------------------------------------------------------
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let y = 0; y < WORLD_H; y++) {
          for (let lz = 0; lz < CHUNK_SIZE; lz++) {
            const idx = lx + y * CHUNK_SIZE + lz * CHUNK_SIZE * WORLD_H;
            const id = this.voxels[idx];
            if (id === 0 || isOpaqueCube(id)) continue;

            const def = BLOCKS[id];
            if (!def) continue;
            const meta = this.meta[idx];
            const wx = startX + lx;
            const wz = startZ + lz;
            const lightVal = this.lightMap[idx];
            const skyL = ((lightVal >> 4) & 15) / 15;
            const blkL = (lightVal & 15) / 15;

            if (id === B.WATER) {
              this._addWaterFaces(water, wx, y, wz, skyL, getV);
            } else if (def.plant) {
              const tile = def.stages ? def.stages[meta & 3] : def.tile;
              const tint = this._getBlockTint(id, def, tile, wx, wz, world);
              this._addCrossPlant(cutout, wx, y, wz, tile, skyL, blkL, tint, 1.0);
            } else if (def.torch) {
              this._addTorch(cutout, wx, y, wz, meta, skyL, blkL);
            } else if (def.shape === 'lantern') {
              this._addLantern(cutout, wx, y, wz, skyL, blkL);
            } else if (def.shape === 'stair') {
              this._addStair(solid, wx, y, wz, def.tiles.all, meta & 3, skyL, blkL);
            } else if (def.shape === 'fence') {
              this._addFence(solid, wx, y, wz, def.tiles.all, skyL, blkL, getV);
            } else if (def.shape === 'door') {
              this._addDoor(cutout, wx, y, wz, def, meta, skyL, blkL);
            } else if (def.shape === 'bed') {
              this._addBed(solid, wx, y, wz, def, skyL, blkL);
            } else if (def.cactus) {
              this._addCactus(cutout, wx, y, wz, def, skyL, blkL);
            } else if (def.leaves || def.glass || id === B.ICE) {
              // Transparent full cube (Leaves, Glass, Ice)
              const tint = this._getBlockTint(id, def, def.tiles.all, wx, wz, world);
              const sway = def.leaves ? 0.35 : 0;
              this._addTransparentCube(cutout, wx, y, wz, id, def.tiles.all, skyL, blkL, tint, sway, getV);
            }
          }
        }
      }

      if (solid.pos.length > 0) {
        this.solidMesh = this._buildMesh(solid, solidMaterial, true, shadowsEnabled);
        scene.add(this.solidMesh);
      }
      if (cutout.pos.length > 0) {
        this.cutoutMesh = this._buildMesh(cutout, cutoutMaterial, true, shadowsEnabled);
        this.cutoutMesh.customDepthMaterial = cutoutDepthMaterial;
        scene.add(this.cutoutMesh);
      }
      if (water.pos.length > 0) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(water.pos, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(water.norm, 3));
        geo.setAttribute('aSky', new THREE.Float32BufferAttribute(water.sky, 1));
        geo.setIndex(water.idx);
        geo.computeBoundingBox();
        geo.computeBoundingSphere();
        this.waterMesh = new THREE.Mesh(geo, waterMaterial);
        this.waterMesh.frustumCulled = true;
        this.waterMesh.matrixAutoUpdate = false;
        this.waterMesh.updateMatrix();
        this.waterMesh.renderOrder = 2;
        scene.add(this.waterMesh);
      }

      this.isMeshed = true;
    }

    _resolveFaceTile(id, def, meta, nx, ny, nz) {
      if (ny === 1) {
        if (id === B.FARMLAND && (meta & 1)) return def.tiles.topWet;
        return def.tiles.all ?? def.tiles.top;
      }
      if (ny === -1) return def.tiles.all ?? def.tiles.bottom;

      if (def.directional) {
        const facing = meta & 3; // 0:+Z, 1:-X, 2:-Z, 3:+X
        const isFront =
          (facing === 0 && nz === 1) ||
          (facing === 1 && nx === -1) ||
          (facing === 2 && nz === -1) ||
          (facing === 3 && nx === 1);
        if (isFront) {
          if (id === B.FURNACE && (meta & 4)) return def.tiles.frontLit;
          return def.tiles.front ?? def.tiles.side;
        }
        return def.tiles.side ?? def.tiles.all;
      }

      if (nz === 1 && def.tiles.front) return def.tiles.front;
      return def.tiles.all ?? def.tiles.side;
    }

    _getBlockTint(id, def, tile, wx, wz, world) {
      if (!def.biomeTint) return [1, 1, 1];
      if (id === B.GRASS && tile !== T.GRASS_TOP) return [1, 1, 1];
      const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const biome = this.biomeMap[lx + lz * CHUNK_SIZE] || world.gen.getSurfaceInfo(wx, wz).biome;
      if (biome === 'taiga') return [0.76, 0.90, 0.78];
      if (biome === 'desert' || biome === 'beach') return [1.05, 0.98, 0.72];
      if (biome === 'forest') return [0.88, 1.0, 0.85];
      return [1.0, 1.0, 1.0];
    }

    _computeFaceAO(getV, ax, ay, az, d, nx, ny, nz) {
      const occ = (dx, dy, dz) => (isOccludingForAO(getV(ax + dx, ay + dy, az + dz)) ? 1 : 0);
      const aoVal = (s1, s2, c) => {
        const level = (s1 && s2) ? 3 : (s1 + s2 + c);
        return [1.0, 0.82, 0.65, 0.48][level];
      };

      // Corner order matches _emitGreedyFace corners: (0,0), (u,0), (u,v), (0,v)
      if (d === 0) { // X face -> u=Y, v=Z
        const sU0 = occ(0, -1, 0), sU1 = occ(0, 1, 0), sV0 = occ(0, 0, -1), sV1 = occ(0, 0, 1);
        return [
          aoVal(sU0, sV0, occ(0, -1, -1)),
          aoVal(sU1, sV0, occ(0, 1, -1)),
          aoVal(sU1, sV1, occ(0, 1, 1)),
          aoVal(sU0, sV1, occ(0, -1, 1))
        ];
      } else if (d === 1) { // Y face -> u=Z, v=X
        const sU0 = occ(0, 0, -1), sU1 = occ(0, 0, 1), sV0 = occ(-1, 0, 0), sV1 = occ(1, 0, 0);
        return [
          aoVal(sU0, sV0, occ(-1, 0, -1)),
          aoVal(sU1, sV0, occ(-1, 0, 1)),
          aoVal(sU1, sV1, occ(1, 0, 1)),
          aoVal(sU0, sV1, occ(1, 0, -1))
        ];
      } else { // Z face -> u=X, v=Y
        const sU0 = occ(-1, 0, 0), sU1 = occ(1, 0, 0), sV0 = occ(0, -1, 0), sV1 = occ(0, 1, 0);
        return [
          aoVal(sU0, sV0, occ(-1, -1, 0)),
          aoVal(sU1, sV0, occ(1, -1, 0)),
          aoVal(sU1, sV1, occ(1, 1, 0)),
          aoVal(sU0, sV1, occ(-1, 1, 0))
        ];
      }
    }

    _emitGreedyFace(group, ox, oy, oz, du, dv, nx, ny, nz, w, h, cell) {
      const uvRect = getTileUV(cell.tile);
      const base = group.pos.length / 3;

      // Corners: c0=(0,0), c1=(du), c2=(du+dv), c3=(dv)
      const p0 = [ox, oy, oz];
      const p1 = [ox + du[0], oy + du[1], oz + du[2]];
      const p2 = [ox + du[0] + dv[0], oy + du[1] + dv[1], oz + du[2] + dv[2]];
      const p3 = [ox + dv[0], oy + dv[1], oz + dv[2]];

      // Face winding depends on normal sign & axis cyclic mapping (u=(d+1)%3, v=(d+2)%3)
      const positive = (nx + ny + nz) > 0;
      const pts = positive ? [p0, p1, p2, p3] : [p0, p3, p2, p1];
      const ao = positive ? cell.ao : [cell.ao[0], cell.ao[3], cell.ao[2], cell.ao[1]];

      // Local tiling UVs matching upright orientation per face
      let uvs;
      if (nx !== 0) { // u=Y, v=Z
        uvs = positive ? [[0, 0], [0, w], [h, w], [h, 0]] : [[0, 0], [h, 0], [h, w], [0, w]];
      } else if (ny !== 0) { // u=Z, v=X
        uvs = positive ? [[0, 0], [w, 0], [w, h], [0, h]] : [[0, 0], [0, h], [w, h], [w, 0]];
      } else { // Z face: u=X, v=Y
        uvs = positive ? [[0, 0], [w, 0], [w, h], [0, h]] : [[0, 0], [0, h], [w, h], [w, 0]];
      }

      const [tr, tg, tb] = cell.tint;
      for (let i = 0; i < 4; i++) {
        group.pos.push(pts[i][0], pts[i][1], pts[i][2]);
        group.norm.push(nx, ny, nz);
        group.uv.push(uvs[i][0], uvs[i][1]);
        group.col.push(tr, tg, tb);
        group.rect.push(uvRect.u0, uvRect.v0, uvRect.s, uvRect.s);
        group.light.push(ao[i], cell.skyL, cell.blkL, cell.emissive);
      }

      // Anisotropic AO diagonal flip to eliminate interpolation creases
      if (ao[0] + ao[2] > ao[1] + ao[3]) {
        group.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      } else {
        group.idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
      }
    }

    _addBox(group, x0, y0, z0, x1, y1, z1, tile, skyL, blkL, tint = [1,1,1], swayOrEmissive = 0, tileMap = null) {
      const faces = [
        { nx: 1, ny: 0, nz: 0, t: tileMap?.px ?? tile, v: [[x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1]] },
        { nx:-1, ny: 0, nz: 0, t: tileMap?.nx ?? tile, v: [[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]] },
        { nx: 0, ny: 1, nz: 0, t: tileMap?.py ?? tile, v: [[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0]] },
        { nx: 0, ny:-1, nz: 0, t: tileMap?.ny ?? tile, v: [[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]] },
        { nx: 0, ny: 0, nz: 1, t: tileMap?.pz ?? tile, v: [[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]] },
        { nx: 0, ny: 0, nz:-1, t: tileMap?.nz ?? tile, v: [[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0]] }
      ];
      for (const f of faces) {
        const uvRect = getTileUV(f.t);
        const base = group.pos.length / 3;
        const uvs = [[0,0],[1,0],[1,1],[0,1]];
        for (let i = 0; i < 4; i++) {
          group.pos.push(f.v[i][0], f.v[i][1], f.v[i][2]);
          group.norm.push(f.nx, f.ny, f.nz);
          group.uv.push(uvs[i][0], uvs[i][1]);
          group.col.push(tint[0], tint[1], tint[2]);
          group.rect.push(uvRect.u0, uvRect.v0, uvRect.s, uvRect.s);
          group.light.push(1.0, skyL, blkL, swayOrEmissive);
        }
        group.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }

    _addTransparentCube(group, x, y, z, id, tile, skyL, blkL, tint, sway, getV) {
      const uvRect = getTileUV(tile);
      const dirs = [
        { nx: 1, ny: 0, nz: 0, v: [[1,0,1],[1,0,0],[1,1,0],[1,1,1]] },
        { nx:-1, ny: 0, nz: 0, v: [[0,0,0],[0,0,1],[0,1,1],[0,1,0]] },
        { nx: 0, ny: 1, nz: 0, v: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]] },
        { nx: 0, ny:-1, nz: 0, v: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]] },
        { nx: 0, ny: 0, nz: 1, v: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]] },
        { nx: 0, ny: 0, nz:-1, v: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]] }
      ];
      for (const f of dirs) {
        const adj = getV(x + f.nx, y + f.ny, z + f.nz);
        if (isOpaqueCube(adj)) continue;
        if ((id === B.GLASS || id === B.ICE) && adj === id) continue;
        const base = group.pos.length / 3;
        const uvs = [[0,0],[1,0],[1,1],[0,1]];
        for (let i = 0; i < 4; i++) {
          group.pos.push(x + f.v[i][0], y + f.v[i][1], z + f.v[i][2]);
          group.norm.push(f.nx, f.ny, f.nz);
          group.uv.push(uvs[i][0], uvs[i][1]);
          group.col.push(tint[0], tint[1], tint[2]);
          group.rect.push(uvRect.u0, uvRect.v0, uvRect.s, uvRect.s);
          group.light.push(0.95, skyL, blkL, sway * f.v[i][1]);
        }
        group.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }

    _addCrossPlant(group, x, y, z, tile, skyL, blkL, tint, swayAmt) {
      const uvRect = getTileUV(tile);
      const quads = [
        [[x+0.12,y,z+0.12], [x+0.88,y,z+0.88], [x+0.88,y+0.95,z+0.88], [x+0.12,y+0.95,z+0.12]],
        [[x+0.88,y,z+0.12], [x+0.12,y,z+0.88], [x+0.12,y+0.95,z+0.88], [x+0.88,y+0.95,z+0.12]]
      ];
      const uvs = [[0,0],[1,0],[1,1],[0,1]];
      for (const q of quads) {
        const base = group.pos.length / 3;
        for (let i = 0; i < 4; i++) {
          group.pos.push(q[i][0], q[i][1], q[i][2]);
          group.norm.push(0, 1, 0);
          group.uv.push(uvs[i][0], uvs[i][1]);
          group.col.push(tint[0], tint[1], tint[2]);
          group.rect.push(uvRect.u0, uvRect.v0, uvRect.s, uvRect.s);
          group.light.push(1.0, skyL, blkL, i >= 2 ? swayAmt : 0);
        }
        group.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }

    _addTorch(group, x, y, z, meta, skyL, blkL) {
      const wall = meta & 7;
      let dx = 0, dz = 0, dy = 0;
      if (wall === 1) dx = -0.26;
      else if (wall === 2) dx = 0.26;
      else if (wall === 3) dz = -0.26;
      else if (wall === 4) dz = 0.26;
      if (wall > 0) dy = 0.16;

      this._addBox(group, x + 0.43 + dx, y + dy, z + 0.43 + dz, x + 0.57 + dx, y + 0.62 + dy, z + 0.57 + dz, T.PLANKS_SPRUCE, skyL, blkL, [1,1,1], 0);
      this._addBox(group, x + 0.42 + dx, y + 0.62 + dy, z + 0.42 + dz, x + 0.58 + dx, y + 0.76 + dy, z + 0.58 + dz, T.LAVA, 1, 1, [1.2,1.1,0.9], -1.0);
    }

    _addLantern(group, x, y, z, skyL, blkL) {
      this._addBox(group, x + 0.31, y, z + 0.31, x + 0.69, y + 0.56, z + 0.69, T.LANTERN, skyL, blkL, [1.1,1.0,0.85], -0.85);
      this._addBox(group, x + 0.40, y + 0.56, z + 0.40, x + 0.60, y + 0.68, z + 0.60, T.DEEPSLATE, skyL, blkL);
    }

    _addStair(group, x, y, z, tile, facing, skyL, blkL) {
      // Bottom slab (always full)
      this._addBox(group, x, y, z, x + 1, y + 0.5, z + 1, tile, skyL, blkL);
      // Upper step aligned by facing (0:+Z, 1:-X, 2:-Z, 3:+X)
      if (facing === 0) this._addBox(group, x, y + 0.5, z + 0.5, x + 1, y + 1, z + 1, tile, skyL, blkL);
      else if (facing === 1) this._addBox(group, x, y + 0.5, z, x + 0.5, y + 1, z + 1, tile, skyL, blkL);
      else if (facing === 2) this._addBox(group, x, y + 0.5, z, x + 1, y + 1, z + 0.5, tile, skyL, blkL);
      else this._addBox(group, x + 0.5, y + 0.5, z, x + 1, y + 1, z + 1, tile, skyL, blkL);
    }

    _addFence(group, x, y, z, tile, skyL, blkL, getV) {
      // Center post
      this._addBox(group, x + 0.38, y, z + 0.38, x + 0.62, y + 1.0, z + 0.62, tile, skyL, blkL);
      const connects = (nx, nz) => {
        const b = getV(x + nx, y, z + nz);
        return b === B.FENCE_OAK || isOpaqueCube(b);
      };
      if (connects(1, 0)) {
        this._addBox(group, x + 0.62, y + 0.72, z + 0.44, x + 1.0, y + 0.90, z + 0.56, tile, skyL, blkL);
        this._addBox(group, x + 0.62, y + 0.32, z + 0.44, x + 1.0, y + 0.50, z + 0.56, tile, skyL, blkL);
      }
      if (connects(-1, 0)) {
        this._addBox(group, x, y + 0.72, z + 0.44, x + 0.38, y + 0.90, z + 0.56, tile, skyL, blkL);
        this._addBox(group, x, y + 0.32, z + 0.44, x + 0.38, y + 0.50, z + 0.56, tile, skyL, blkL);
      }
      if (connects(0, 1)) {
        this._addBox(group, x + 0.44, y + 0.72, z + 0.62, x + 0.56, y + 0.90, z + 1.0, tile, skyL, blkL);
        this._addBox(group, x + 0.44, y + 0.32, z + 0.62, x + 0.56, y + 0.50, z + 1.0, tile, skyL, blkL);
      }
      if (connects(0, -1)) {
        this._addBox(group, x + 0.44, y + 0.72, z, x + 0.56, y + 0.90, z + 0.38, tile, skyL, blkL);
        this._addBox(group, x + 0.44, y + 0.32, z, x + 0.56, y + 0.50, z + 0.38, tile, skyL, blkL);
      }
    }

    _addDoor(group, x, y, z, def, meta, skyL, blkL) {
      const isTop = (meta & 8) !== 0;
      const isOpen = (meta & 4) !== 0;
      const tile = isTop ? def.tiles.top : def.tiles.bottom;
      if (isOpen) {
        this._addBox(group, x, y, z, x + 0.18, y + 1, z + 1, tile, skyL, blkL);
      } else {
        this._addBox(group, x, y, z + 0.82, x + 1, y + 1, z + 1, tile, skyL, blkL);
      }
    }

    _addBed(group, x, y, z, def, skyL, blkL) {
      this._addBox(group, x, y + 0.15, z, x + 1, y + 0.56, z + 1, def.tiles.side, skyL, blkL, [1,1,1], 0, {
        py: def.tiles.top, ny: def.tiles.bottom, px: def.tiles.side, nx: def.tiles.side, pz: def.tiles.side, nz: def.tiles.side
      });
      // 4 short wooden legs
      [[0.02,0.02],[0.82,0.02],[0.02,0.82],[0.82,0.82]].forEach(([lx, lz]) => {
        this._addBox(group, x + lx, y, z + lz, x + lx + 0.16, y + 0.15, z + lz + 0.16, T.PLANKS_OAK, skyL, blkL);
      });
    }

    _addCactus(group, x, y, z, def, skyL, blkL) {
      this._addBox(group, x + 0.06, y, z + 0.06, x + 0.94, y + 1, z + 0.94, def.tiles.side, skyL, blkL, [1,1,1], 0, {
        py: def.tiles.top, ny: def.tiles.top, px: def.tiles.side, nx: def.tiles.side, pz: def.tiles.side, nz: def.tiles.side
      });
    }

    _addWaterFaces(group, x, y, z, skyL, getV) {
      const dirs = [
        { nx: 0, ny: 1, nz: 0, v: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]] },
        { nx: 1, ny: 0, nz: 0, v: [[1,0,1],[1,0,0],[1,1,0],[1,1,1]] },
        { nx:-1, ny: 0, nz: 0, v: [[0,0,0],[0,0,1],[0,1,1],[0,1,0]] },
        { nx: 0, ny: 0, nz: 1, v: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]] },
        { nx: 0, ny: 0, nz:-1, v: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]] }
      ];
      for (const f of dirs) {
        const adj = getV(x + f.nx, y + f.ny, z + f.nz);
        if (adj !== B.AIR && !BLOCKS[adj]?.plant && !BLOCKS[adj]?.transparent) continue;
        if (adj === B.WATER) continue;
        const base = group.pos.length / 3;
        for (let i = 0; i < 4; i++) {
          group.pos.push(x + f.v[i][0], y + f.v[i][1], z + f.v[i][2]);
          group.norm.push(f.nx, f.ny, f.nz);
          group.sky.push(skyL);
        }
        group.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }

    _buildMesh(data, mat, castShadow, shadowsEnabled) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(data.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(data.norm, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(data.uv, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(data.col, 3));
      geo.setAttribute('aTileRect', new THREE.Float32BufferAttribute(data.rect, 4));
      geo.setAttribute('aLight', new THREE.Float32BufferAttribute(data.light, 4));
      geo.setIndex(data.idx);
      geo.computeBoundingBox();
      geo.computeBoundingSphere();

      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = true;
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      mesh.castShadow = castShadow && shadowsEnabled;
      mesh.receiveShadow = shadowsEnabled;
      return mesh;
    }
  }

  TV.Chunk = Chunk;
  TV.shaderUniforms = shaderUniforms;
  TV.solidMaterial = solidMaterial;
  TV.cutoutMaterial = cutoutMaterial;
  TV.waterMaterial = waterMaterial;
})(window.TV);
