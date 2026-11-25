// ============================================================
// TERRAVOX — Main Engine, Sky/Shadows, WorldStreaming & Loop
// ============================================================
window.TV = window.TV || {};

(function (TV) {
  const { CHUNK_SIZE, WORLD_H, WATER_LEVEL, BIOME_NAMES, WorldGenerator, Chunk, shaderUniforms, waterMaterial, storage, loadSettings, sounds } = TV;

  const canvas = document.getElementById('game-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.outputEncoding = THREE.sRGBEncoding;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x7fb4f5);
  scene.fog = new THREE.Fog(0x7fb4f5, 50, 105);

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 220);
  scene.add(camera);

  // Lighting
  const hemiLight = new THREE.HemisphereLight(0xbbe1ff, 0x566446, 0.65);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfff4d6, 0.95);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.near = 5;
  sunLight.shadow.camera.far = 160;
  sunLight.shadow.camera.left = -46;
  sunLight.shadow.camera.right = 46;
  sunLight.shadow.camera.top = 46;
  sunLight.shadow.camera.bottom = -46;
  sunLight.shadow.bias = -0.0008;
  sunLight.shadow.normalBias = 0.035;
  scene.add(sunLight);
  scene.add(sunLight.target);

  // Sky Dome Shader (smooth horizon-to-zenith sky gradient)
  const skyUniforms = {
    uTopColor: { value: new THREE.Color(0x3a7bd5) },
    uHorizonColor: { value: new THREE.Color(0x9bd0ff) }
  };
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(185, 24, 16),
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: `varying vec3 vPos;\nvoid main(){ vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 uTopColor; uniform vec3 uHorizonColor; varying vec3 vPos;
        void main(){ float h = clamp(normalize(vPos).y, 0.0, 1.0);
        gl_FragColor = vec4(mix(uHorizonColor, uTopColor, pow(h, 0.55)), 1.0); }`
    })
  );
  scene.add(skyDome);

  // Celestial Group (Sun, Moon & Twinkling Stars)
  const celestialGroup = new THREE.Group();
  scene.add(celestialGroup);

  const sunMat = new THREE.MeshBasicMaterial({ color: 0xfff3b0, fog: false });
  const sunMesh = new THREE.Mesh(new THREE.BoxGeometry(12, 12, 2), sunMat);
  sunMesh.position.set(0, 130, 0);
  celestialGroup.add(sunMesh);

  const moonMat = new THREE.MeshBasicMaterial({ color: 0xdbeafe, fog: false });
  const moonMesh = new THREE.Mesh(new THREE.BoxGeometry(9, 9, 2), moonMat);
  moonMesh.position.set(0, -130, 0);
  celestialGroup.add(moonMesh);

  // Starfield
  const starPos = [];
  for (let i = 0; i < 420; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 160;
    starPos.push(r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, transparent: true, opacity: 0, fog: false });
  const starPoints = new THREE.Points(starGeo, starMat);
  celestialGroup.add(starPoints);

  // Volumetric Voxel Clouds
  const cloudsGroup = new THREE.Group();
  scene.add(cloudsGroup);
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.84 });
  for (let i = 0; i < 36; i++) {
    const cw = 14 + Math.random() * 20;
    const cd = 12 + Math.random() * 18;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(cw, 2.6, cd), cloudMat);
    mesh.position.set((Math.random() - 0.5) * 260, 82 + (i % 3) * 1.5, (Math.random() - 0.5) * 260);
    cloudsGroup.add(mesh);
  }

  // ============================================================
  // WORLD MANAGER (Chunks, Deltas, Streaming Queue)
  // ============================================================
  class WorldManager {
    constructor(seed, preset, savedChunkMap = null) {
      this.gen = new WorldGenerator(seed, preset);
      this.chunks = new Map();
      this.savedChunkMap = savedChunkMap || new Map();
      this.dirtyChunks = new Set();
      this.lastScanCx = 999999;
      this.lastScanCz = 999999;
      this.buildQueue = [];
    }

    getChunk(cx, cz, generateIfMissing = true) {
      const key = `${cx},${cz}`;
      let ch = this.chunks.get(key);
      if (!ch && generateIfMissing) {
        ch = new Chunk(cx, cz);
        const saved = this.savedChunkMap.get(key);
        if (saved) {
          ch.voxels.set(saved.voxels);
          ch.meta.set(saved.meta);
          ch.dirty = true;
          this.dirtyChunks.add(key);
        } else {
          this.gen.generateChunk(ch);
        }
        this.chunks.set(key, ch);
      }
      return ch;
    }

    getBlock(wx, wy, wz) {
      if (wy < 0 || wy >= WORLD_H) return 0;
      const cx = Math.floor(wx / CHUNK_SIZE);
      const cz = Math.floor(wz / CHUNK_SIZE);
      const ch = this.getChunk(cx, cz, false);
      if (!ch) return 0;
      const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      return ch.voxels[lx + wy * CHUNK_SIZE + lz * CHUNK_SIZE * WORLD_H];
    }

    getMeta(wx, wy, wz) {
      if (wy < 0 || wy >= WORLD_H) return 0;
      const cx = Math.floor(wx / CHUNK_SIZE);
      const cz = Math.floor(wz / CHUNK_SIZE);
      const ch = this.getChunk(cx, cz, false);
      if (!ch) return 0;
      const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      return ch.meta[lx + wy * CHUNK_SIZE + lz * CHUNK_SIZE * WORLD_H];
    }

    getLight(wx, wy, wz) {
      if (wy < 0) return 0;
      if (wy >= WORLD_H) return 0xf0;
      const cx = Math.floor(wx / CHUNK_SIZE);
      const cz = Math.floor(wz / CHUNK_SIZE);
      const ch = this.getChunk(cx, cz, false);
      if (!ch || !ch.lightComputed) return 0xf0;
      const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      return ch.lightMap[lx + wy * CHUNK_SIZE + lz * CHUNK_SIZE * WORLD_H];
    }

    setBlock(wx, wy, wz, id, meta = 0, markDirty = true) {
      if (wy < 0 || wy >= WORLD_H) return;
      const cx = Math.floor(wx / CHUNK_SIZE);
      const cz = Math.floor(wz / CHUNK_SIZE);
      const ch = this.getChunk(cx, cz, true);
      const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const idx = lx + wy * CHUNK_SIZE + lz * CHUNK_SIZE * WORLD_H;
      ch.voxels[idx] = id;
      ch.meta[idx] = meta;
      if (markDirty) {
        ch.dirty = true;
        this.dirtyChunks.add(`${cx},${cz}`);
      }
    }

    rebuildArea(wx, wz) {
      const cx = Math.floor(wx / CHUNK_SIZE);
      const cz = Math.floor(wz / CHUNK_SIZE);
      const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
      const shadows = TV.settings.shadows;

      const rebuildIfLoaded = (tcx, tcz) => {
        const c = this.getChunk(tcx, tcz, false);
        if (c) c.rebuild(this, scene, shadows);
      };
      rebuildIfLoaded(cx, cz);
      if (lx === 0) rebuildIfLoaded(cx - 1, cz);
      if (lx === CHUNK_SIZE - 1) rebuildIfLoaded(cx + 1, cz);
      if (lz === 0) rebuildIfLoaded(cx, cz - 1);
      if (lz === CHUNK_SIZE - 1) rebuildIfLoaded(cx, cz + 1);
    }

    findSurfaceY(wx, wz) {
      const cx = Math.floor(wx / CHUNK_SIZE);
      const cz = Math.floor(wz / CHUNK_SIZE);
      this.getChunk(cx, cz, true);
      for (let y = WORLD_H - 2; y >= 1; y--) {
        const b = this.getBlock(wx, y, wz);
        if (b !== 0 && b !== TV.B.WATER && !TV.BLOCKS[b]?.plant) {
          return y + 1;
        }
      }
      return WATER_LEVEL + 4;
    }

    findSafeLandSpawn(startX = 12, startZ = 12) {
      for (let rad = 0; rad <= 120; rad += 6) {
        for (let a = 0; a < 8; a++) {
          const ang = (a / 8) * Math.PI * 2;
          const wx = Math.round(startX + Math.cos(ang) * rad);
          const wz = Math.round(startZ + Math.sin(ang) * rad);
          const info = this.gen.getSurfaceInfo(wx, wz);
          if (info.height > WATER_LEVEL + 1 && info.biome !== 'ocean' && info.biome !== 'river') {
            const sy = this.findSurfaceY(wx, wz);
            if (sy > WATER_LEVEL + 1 && this.getBlock(wx, sy - 1, wz) !== TV.B.LAVA) {
              return { x: wx + 0.5, y: sy + 1.65, z: wz + 0.5 };
            }
          }
        }
      }
      const sy = this.findSurfaceY(startX, startZ);
      return { x: startX + 0.5, y: sy + 1.65, z: startZ + 0.5 };
    }

    streamAround(px, pz, maxBuildsPerFrame = 2, budgetMs = 5.5) {
      const pcx = Math.floor(px / CHUNK_SIZE);
      const pcz = Math.floor(pz / CHUNK_SIZE);
      const rd = TV.settings.renderDistance;

      if (pcx !== this.lastScanCx || pcz !== this.lastScanCz) {
        this.lastScanCx = pcx;
        this.lastScanCz = pcz;
        this.buildQueue.length = 0;

        for (let dx = -rd; dx <= rd; dx++) {
          for (let dz = -rd; dz <= rd; dz++) {
            if (dx * dx + dz * dz > (rd + 0.5) * (rd + 0.5)) continue;
            const cx = pcx + dx;
            const cz = pcz + dz;
            const ch = this.getChunk(cx, cz, true);
            if (!ch.isMeshed) {
              this.buildQueue.push({ ch, dist: dx * dx + dz * dz });
            }
          }
        }
        this.buildQueue.sort((a, b) => a.dist - b.dist);

        // Unload far meshes only when crossing chunk boundaries
        for (const [key, ch] of this.chunks.entries()) {
          if (Math.abs(ch.cx - pcx) > rd + 2 || Math.abs(ch.cz - pcz) > rd + 2) {
            if (ch.isMeshed) ch.disposeMesh(scene);
            if (!ch.dirty && Math.abs(ch.cx - pcx) > rd + 5) {
              this.chunks.delete(key);
            }
          }
        }
      }

      if (this.buildQueue.length > 0) {
        const start = performance.now();
        let built = 0;
        while (this.buildQueue.length > 0 && built < maxBuildsPerFrame) {
          const item = this.buildQueue.shift();
          if (!item.ch.isMeshed) {
            item.ch.rebuild(this, scene, TV.settings.shadows);
            built++;
          }
          if (performance.now() - start > budgetMs) break;
        }
      }
    }

    disposeAll() {
      for (const ch of this.chunks.values()) ch.disposeMesh(scene);
      this.chunks.clear();
    }
  }

  // ============================================================
  // GAME STATE, DAY/NIGHT, SETTINGS & SAVING
  // ============================================================
  const DAY_DURATION = 540; // 9 minutes full day-night cycle
  let dayTime = 110; // Morning 08:30
  let dayCount = 1;
  let isPlaying = false;
  let gameMode = 'survival';
  let currentWorldMeta = null;
  let world = null;

  const settings = loadSettings();

  function applySettings() {
    const pxRatio = settings.quality === 'low' ? 1.0 : (settings.quality === 'medium' ? 1.0 : (settings.quality === 'ultra' ? Math.min(window.devicePixelRatio, 1.5) : Math.min(window.devicePixelRatio, 1.25)));
    renderer.setPixelRatio(pxRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);

    renderer.shadowMap.enabled = settings.shadows;
    renderer.shadowMap.needsUpdate = true;
    sunLight.castShadow = settings.shadows;
    const sRes = settings.quality === 'ultra' ? 2048 : 1024;
    if (sunLight.shadow.mapSize.width !== sRes) {
      sunLight.shadow.mapSize.set(sRes, sRes);
      if (sunLight.shadow.map) { sunLight.shadow.map.dispose(); sunLight.shadow.map = null; }
    }

    shaderUniforms.uAoEnabled.value = settings.ao ? 1.0 : 0.0;
    camera.fov = settings.fov;
    camera.updateProjectionMatrix();

    const maxDist = settings.renderDistance * CHUNK_SIZE;
    scene.fog.near = maxDist * 0.48;
    scene.fog.far = maxDist * 0.96;

    sounds.setVolumes(settings.masterVol / 100, settings.sfxVol / 100, settings.musicVol / 100);

    // Rebuild loaded chunks if shadow/ao changed
    if (world) {
      world.lastScanCx = 999999;
      for (const ch of world.chunks.values()) {
        if (ch.isMeshed) ch.rebuild(world, scene, settings.shadows);
      }
    }
  }

  function resetStarterInventory(mode) {
    TV.inventory.fill(null);
    TV.equippedArmor.helmet = null;
    TV.equippedArmor.chestplate = null;
    TV.equippedArmor.leggings = null;
    TV.equippedArmor.boots = null;
    TV.blockEntities.furnaces = {};
    TV.blockEntities.chests = {};

    if (mode === 'creative') {
      [TV.B.GRASS, TV.B.STONE, TV.B.PLANKS_OAK, TV.B.LOG_OAK, TV.B.GLASS, TV.B.STAIRS_OAK, TV.B.TORCH, TV.B.CRAFTING_TABLE, 163].forEach((id, i) => {
        TV.inventory[i] = { id, count: id >= 100 ? 1 : 64 };
      });
    } else {
      TV.inventory[0] = { id: 101, count: 1, durability: 60, maxDurability: 60 };
      TV.inventory[1] = { id: 103, count: 1, durability: 60, maxDurability: 60 };
      TV.inventory[2] = { id: TV.B.TORCH, count: 8 };
      TV.inventory[3] = { id: 145, count: 4 }; // Bread
    }
    TV.activeHotbarSlot = 0;
  }

  function startNewWorld({ name, seed, gameMode: mode, preset }) {
    const id = 'w_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
    currentWorldMeta = { id, name, seed, gameMode: mode, preset, createdAt: Date.now(), updatedAt: Date.now() };
    gameMode = mode;
    dayTime = 110;
    dayCount = 1;

    TV.clearEntities();
    if (world) world.disposeAll();
    world = new WorldManager(seed, preset);
    TV.world = world;

    resetStarterInventory(mode);
    TV.playerHp = 20;
    TV.playerHunger = 20;
    TV.playerOxygen = 20;
    TV.playerXp = 0;
    TV.playerLevel = 0;

    const sp = world.findSafeLandSpawn(14, 14);
    const spCx = Math.floor(sp.x / CHUNK_SIZE);
    const spCz = Math.floor(sp.z / CHUNK_SIZE);
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        world.getChunk(spCx + dx, spCz + dz, true);
      }
    }
    world.streamAround(sp.x, sp.z, 25);

    const exactY = world.findSurfaceY(Math.floor(sp.x), Math.floor(sp.z));
    camera.position.set(sp.x, exactY + 1.65, sp.z);
    TV.spawnPoint = { x: sp.x, y: exactY + 1.65, z: sp.z };
    TV.fallStartY = camera.position.y;
    TV.playerVel.set(0, 0, 0);
    TV.mouseLook.yaw = -0.75;
    TV.mouseLook.pitch = -0.1;
    camera.quaternion.setFromEuler(new THREE.Euler(TV.mouseLook.pitch, TV.mouseLook.yaw, 0, 'YXZ'));

    TV.spawnInitialMobs(world, sp.x, sp.z);
    enterGameplay();
    saveCurrentWorld();
  }

  async function loadSavedWorld(worldId) {
    const w = await storage.getWorld(worldId);
    if (!w) return;
    const savedChunks = await storage.loadWorldChunks(worldId);

    currentWorldMeta = w;
    gameMode = w.gameMode || 'survival';
    dayTime = w.dayTime ?? 110;
    dayCount = w.dayCount ?? 1;

    TV.clearEntities();
    if (world) world.disposeAll();
    world = new WorldManager(w.seed, w.preset || 'default', savedChunks);
    TV.world = world;

    // Restore inventory & blockEntities
    for (let i = 0; i < 36; i++) TV.inventory[i] = w.inventory?.[i] || null;
    Object.assign(TV.equippedArmor, w.equippedArmor || { helmet: null, chestplate: null, leggings: null, boots: null });
    TV.blockEntities.furnaces = w.blockEntities?.furnaces || {};
    TV.blockEntities.chests = w.blockEntities?.chests || {};
    TV.activeHotbarSlot = w.activeHotbarSlot ?? 0;

    const p = w.player || {};
    TV.playerHp = p.hp ?? 20;
    TV.playerHunger = p.hunger ?? 20;
    TV.playerOxygen = p.oxygen ?? 20;
    TV.playerXp = p.xp ?? 0;
    TV.playerLevel = p.level ?? 0;
    TV.spawnPoint = p.spawnPoint || { x: 8.5, y: 40, z: 8.5 };

    const px = p.x ?? 8.5, pz = p.z ?? 8.5;
    const pcx = Math.floor(px / CHUNK_SIZE), pcz = Math.floor(pz / CHUNK_SIZE);
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) world.getChunk(pcx + dx, pcz + dz, true);
    world.streamAround(px, pz, 25);

    camera.position.set(px, p.y ?? (world.findSurfaceY(Math.floor(px), Math.floor(pz)) + 1.65), pz);
    TV.fallStartY = camera.position.y;
    TV.playerVel.set(0, 0, 0);
    TV.mouseLook.yaw = p.yaw ?? 0;
    TV.mouseLook.pitch = p.pitch ?? 0;
    camera.quaternion.setFromEuler(new THREE.Euler(TV.mouseLook.pitch, TV.mouseLook.yaw, 0, 'YXZ'));

    TV.spawnInitialMobs(world, px, pz);
    enterGameplay();
    TV.showToast(`Welt "${w.name}" geladen!`);
  }

  function enterGameplay() {
    isPlaying = true;
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('pause-menu').classList.add('hidden');
    document.getElementById('death-screen').classList.add('hidden');
    TV.showHUD(true);
    document.getElementById('hud-mode-badge').textContent = gameMode === 'creative' ? 'Kreativ' : 'Überleben';
    TV.updateSurvivalUI();
    TV.updateArmorUI();
    TV.updateHotbarUI(true);
    sounds.init();
    if (!TV.isTouchDevice) canvas.requestPointerLock();
  }

  function returnToMainMenu() {
    isPlaying = false;
    TV.closeAllGameModals(false);
    document.getElementById('pause-menu').classList.add('hidden');
    document.getElementById('death-screen').classList.add('hidden');
    TV.showHUD(false);
    if (document.pointerLockElement) document.exitPointerLock();
    document.getElementById('main-menu').classList.remove('hidden');
    TV.showMainMenuView('menu-home-view');
    initTitlePreviewWorld();
  }

  async function saveCurrentWorld() {
    if (!world || !currentWorldMeta) return;
    currentWorldMeta.updatedAt = Date.now();
    currentWorldMeta.dayTime = dayTime;
    currentWorldMeta.dayCount = dayCount;
    currentWorldMeta.player = {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
      yaw: TV.mouseLook.yaw,
      pitch: TV.mouseLook.pitch,
      hp: TV.playerHp,
      hunger: TV.playerHunger,
      oxygen: TV.playerOxygen,
      xp: TV.playerXp,
      level: TV.playerLevel,
      spawnPoint: TV.spawnPoint
    };
    currentWorldMeta.inventory = TV.inventory.map(it => it ? { ...it } : null);
    currentWorldMeta.equippedArmor = { ...TV.equippedArmor };
    currentWorldMeta.activeHotbarSlot = TV.activeHotbarSlot;
    currentWorldMeta.blockEntities = TV.blockEntities;

    const modChunks = [];
    for (const key of world.dirtyChunks) {
      const ch = world.chunks.get(key);
      if (ch) modChunks.push(ch);
    }
    await storage.saveWorld(currentWorldMeta, modChunks);
  }

  function initTitlePreviewWorld() {
    TV.clearEntities();
    if (world) world.disposeAll();
    world = new WorldManager('TERRAVOX_PREVIEW', 'default');
    TV.world = world;
    for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) world.getChunk(dx, dz, true);
    world.streamAround(16, 16, 49);
  }

  // ============================================================
  // SKY & LIGHTING CYCLE UPDATE
  // ============================================================
  let lastDayTimeStr = '';
  let lastBiomeStr = '';
  let shadowFrameCounter = 0;

  function updateAtmosphere(dt) {
    const prevTime = dayTime;
    dayTime = (dayTime + dt) % DAY_DURATION;
    if (dayTime < prevTime) dayCount++;

    const angle = (dayTime / DAY_DURATION) * Math.PI * 2;
    celestialGroup.position.set(camera.position.x, 0, camera.position.z);
    celestialGroup.rotation.z = angle;

    const sunSin = Math.sin(angle);
    const sunCos = Math.cos(angle);
    const sunVec = new THREE.Vector3(sunCos, sunSin, 0.35).normalize();
    shaderUniforms.uSunDir.value.copy(sunVec);

    // Snap directional shadow camera to 2-block texel grid & throttle shadow map refresh to every 3rd frame
    const targetX = Math.round(camera.position.x * 0.5) * 2;
    const targetZ = Math.round(camera.position.z * 0.5) * 2;
    sunLight.target.position.set(targetX, 32, targetZ);
    const lightDir = sunSin >= 0 ? sunVec : sunVec.clone().negate();
    sunLight.position.set(targetX + lightDir.x * 70, 32 + lightDir.y * 70, targetZ + lightDir.z * 70);
    if (settings.shadows && (++shadowFrameCounter % 3 === 0)) {
      renderer.shadowMap.needsUpdate = true;
    }

    // Smooth Sky, Fog & Sun Colors across Day / Golden Hour / Night
    let topHex, horHex, skyMul, sunInt, hemiInt, sunCol;
    if (sunSin > 0.25) {
      topHex = 0x3b82f6; horHex = 0x9dd4ff; skyMul = 1.0; sunInt = 0.95; hemiInt = 0.68; sunCol = 0xfff5db;
    } else if (sunSin > -0.15) {
      const t = (sunSin + 0.15) / 0.40;
      const cTop = new THREE.Color(0x16213e).lerp(new THREE.Color(0x3b82f6), t);
      const cHor = new THREE.Color(0xe87b56).lerp(new THREE.Color(0x9dd4ff), t * t);
      const cSun = new THREE.Color(0xff8e42).lerp(new THREE.Color(0xfff5db), t);
      topHex = cTop.getHex(); horHex = cHor.getHex(); sunCol = cSun.getHex();
      skyMul = 0.30 + t * 0.70;
      sunInt = 0.28 + t * 0.67;
      hemiInt = 0.35 + t * 0.33;
    } else {
      topHex = 0x060913; horHex = 0x10182b; skyMul = 0.20; sunInt = 0.22; hemiInt = 0.24; sunCol = 0x7da2e0;
    }

    skyUniforms.uTopColor.value.setHex(topHex);
    skyUniforms.uHorizonColor.value.setHex(horHex);
    scene.background.setHex(horHex);
    scene.fog.color.setHex(horHex);
    skyDome.position.copy(camera.position);

    sunLight.intensity = sunInt;
    sunLight.color.setHex(sunCol);
    hemiLight.intensity = hemiInt;

    const skyTint = new THREE.Color(sunCol).multiplyScalar(skyMul);
    shaderUniforms.uSkyColor.value.copy(skyTint);
    shaderUniforms.uSunColor.value.setHex(sunCol);
    waterMaterial.uniforms.fogColor.value.copy(scene.fog.color);
    waterMaterial.uniforms.fogNear.value = scene.fog.near;
    waterMaterial.uniforms.fogFar.value = scene.fog.far;

    // Stars & Clouds
    starMat.opacity = sunSin < -0.05 ? Math.min(1, (-sunSin - 0.05) * 3.0) : 0;
    cloudMat.color.setHex(sunSin > 0.2 ? 0xffffff : (sunSin > -0.1 ? 0xfdba9a : 0x263148));
    for (const c of cloudsGroup.children) {
      c.position.x += 1.2 * dt;
      if (c.position.x > camera.position.x + 130) c.position.x = camera.position.x - 130;
      if (c.position.z > camera.position.z + 130) c.position.z = camera.position.z - 130;
      if (c.position.z < camera.position.z - 130) c.position.z = camera.position.z + 130;
    }

    // Update top-left clock & biome HUD only when text changes (avoids 120 DOM writes/sec!)
    if (isPlaying) {
      const hourFloat = ((dayTime / DAY_DURATION) * 24 + 6) % 24;
      const hh = Math.floor(hourFloat);
      const mm = Math.floor((hourFloat - hh) * 60);
      const timeStr = `Tag ${dayCount} • ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
      if (timeStr !== lastDayTimeStr) {
        lastDayTimeStr = timeStr;
        document.getElementById('hud-day-time').textContent = timeStr;
      }
      const info = world.gen.getSurfaceInfo(Math.floor(camera.position.x), Math.floor(camera.position.z));
      const bStr = BIOME_NAMES[info.biome] || info.biome;
      if (bStr !== lastBiomeStr) {
        lastBiomeStr = bStr;
        document.getElementById('hud-biome').textContent = bStr;
      }
    }

    return sunSin;
  }

  // ============================================================
  // MAIN ANIMATION LOOP
  // ============================================================
  let lastFrame = performance.now();
  let fpsCount = 0, fpsTimer = 0, currentFps = 60;
  let autoSaveTimer = 0;
  let menuOrbitAngle = 0;

  function animate() {
    requestAnimationFrame(animate);

    const now = performance.now();
    const dt = Math.min(0.06, (now - lastFrame) / 1000);
    lastFrame = now;
    shaderUniforms.uTime.value = now * 0.001;

    fpsCount++;
    fpsTimer += dt;
    if (fpsTimer >= 0.5) {
      currentFps = Math.round(fpsCount / fpsTimer);
      fpsCount = 0;
      fpsTimer = 0;
    }

    if (isPlaying && world) {
      const paused = !document.getElementById('pause-menu').classList.contains('hidden');
      if (!paused) {
        const sunSin = updateAtmosphere(dt);
        world.streamAround(camera.position.x, camera.position.z, 3);
        TV.updatePlayer(dt, world);
        TV.updateMobs(dt, sunSin, world);
        TV.updateProjectiles(dt, world);
        TV.updateParticles(dt);
        TV.updateDroppedItems(dt, world);
        TV.updateFurnaces(dt, world);
        TV.updateWorldGrowthTicks(dt, world);

        autoSaveTimer += dt;
        if (autoSaveTimer >= 30) {
          autoSaveTimer = 0;
          saveCurrentWorld();
        }
      }

      // Update F3 Debug Overlay if visible
      const dbg = document.getElementById('debug-overlay');
      if (!dbg.classList.contains('hidden')) {
        const x = camera.position.x, y = camera.position.y, z = camera.position.z;
        const info = world.gen.getSurfaceInfo(Math.floor(x), Math.floor(z));
        const light = world.getLight(Math.floor(x), Math.floor(y), Math.floor(z));
        dbg.textContent =
          `TERRAVOX Engine | ${currentFps} FPS\n` +
          `XYZ: ${x.toFixed(1)} / ${y.toFixed(1)} / ${z.toFixed(1)}\n` +
          `Chunk: ${Math.floor(x / 16)}, ${Math.floor(z / 16)} | Seed: ${world.gen.seedStr}\n` +
          `Biom: ${BIOME_NAMES[info.biome] || info.biome} | Licht: Sky ${(light >> 4) & 15} Block ${light & 15}`;
      }
    } else if (world) {
      // Orbiting Title Screen Preview Camera!
      menuOrbitAngle += dt * 0.12;
      const rad = 32;
      const cx = 16 + Math.cos(menuOrbitAngle) * rad;
      const cz = 16 + Math.sin(menuOrbitAngle) * rad;
      camera.position.set(cx, 54, cz);
      camera.lookAt(16, 36, 16);
      updateAtmosphere(dt * 0.4);
      world.streamAround(16, 16, 2);
    }

    renderer.render(scene, camera);
  }

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Expose core references
  TV.canvas = canvas;
  TV.scene = scene;
  TV.camera = camera;
  TV.settings = settings;
  Object.defineProperty(TV, 'isPlaying', { get: () => isPlaying });
  Object.defineProperty(TV, 'gameMode', { get: () => gameMode });
  Object.defineProperty(TV, 'currentWorldMeta', { get: () => currentWorldMeta });
  TV.isNightTime = () => Math.sin((dayTime / DAY_DURATION) * Math.PI * 2) < 0;
  TV.skipNightToMorning = () => { dayTime = 45; dayCount++; };
  TV.applySettings = applySettings;
  TV.startNewWorld = startNewWorld;
  TV.loadSavedWorld = loadSavedWorld;
  TV.saveCurrentWorld = saveCurrentWorld;
  TV.returnToMainMenu = returnToMainMenu;

  // Boot Sequence
  TV.initPlayerVisuals(scene, camera);
  TV.initInputListeners();
  TV.initInventoryUIListeners();
  TV.initMenusAndListeners();
  applySettings();
  initTitlePreviewWorld();
  animate();
})(window.TV);
