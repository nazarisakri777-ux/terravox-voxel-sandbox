// ============================================================
// TERRAVOX — Player Physics, DDA Raycast, Mining & Interactions
// ============================================================
window.TV = window.TV || {};

(function (TV) {
  const { BLOCKS, ITEMS, B, WORLD_H, crackTextures, createItemIconCanvas, sounds } = TV;

  const keys = {};
  const mouseLook = { yaw: 0, pitch: 0 };
  const vel = new THREE.Vector3();

  let onGround = false;
  let isUnderwater = false;
  let isInLava = false;
  let isFlying = false;
  let isSprinting = false;
  let lastWPress = 0;
  let lastSpacePress = 0;

  // Survival Stats
  let playerHp = 20;
  let playerHunger = 20;
  let playerOxygen = 20;
  let playerXp = 0;
  let playerLevel = 0;
  let fallStartY = 0;
  let naturalRegenTimer = 0;
  let hungerDecayTimer = 0;
  let drownTimer = 0;
  let lavaBurnTimer = 0;
  let footstepTimer = 0;

  let spawnPoint = { x: 8.5, y: 40, z: 8.5 };

  // Mining & Raycast State
  let targetedVoxel = null;
  let targetedMob = null;
  let isLeftDown = false;
  let mineTimer = 0;
  let mineSoundTimer = 0;
  let lastMineKey = '';
  let attackCooldown = 0;
  let bowCooldown = 0;

  // Touch Controls State
  const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const touchAxes = { x: 0, y: 0 };

  // Highlight & Crack Meshes
  const highlightBox = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004)),
    new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.72 })
  );
  highlightBox.visible = false;

  const crackMat = new THREE.MeshBasicMaterial({
    map: crackTextures[0],
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3
  });
  const crackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.003, 1.003, 1.003), crackMat);
  crackMesh.visible = false;

  // First-person Hand / Held Item Viewmodel
  const handGroup = new THREE.Group();
  let heldMesh = null;
  let swingProgress = 0;
  let isSwinging = false;
  let walkBobTimer = 0;

  function initPlayerVisuals(scene, camera) {
    scene.add(highlightBox);
    scene.add(crackMesh);
    camera.add(handGroup);
    handGroup.position.set(0.42, -0.34, -0.58);
  }

  function updateHeldItemModel() {
    if (heldMesh) {
      handGroup.remove(heldMesh);
      if (heldMesh.geometry) heldMesh.geometry.dispose();
      if (heldMesh.material) heldMesh.material.dispose();
      heldMesh = null;
    }

    const cur = TV.inventory[TV.activeHotbarSlot];
    if (!cur) {
      heldMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.44, 0.18),
        new THREE.MeshLambertMaterial({ color: 0xc9946b })
      );
      heldMesh.position.set(0, -0.06, 0);
      heldMesh.rotation.set(-0.35, 0.42, 0.18);
      handGroup.add(heldMesh);
      return;
    }

    const tex = new THREE.CanvasTexture(createItemIconCanvas(cur.id));
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;

    if (cur.id < 100 && !BLOCKS[cur.id]?.plant && !BLOCKS[cur.id]?.torch) {
      const def = BLOCKS[cur.id];
      const topT = def?.tiles?.top ?? def?.tiles?.all ?? 0;
      const sideT = def?.tiles?.front ?? def?.tiles?.side ?? def?.tiles?.all ?? 0;
      const geo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
      const uvs = geo.attributes.uv;
      const faces = [sideT, sideT, topT, sideT, sideT, sideT];
      for (let f = 0; f < 6; f++) {
        const u = TV.getTileUV(faces[f]);
        const idx = f * 4;
        uvs.setXY(idx, u.u0, u.v0);
        uvs.setXY(idx + 1, u.u1, u.v0);
        uvs.setXY(idx + 2, u.u0, u.v1);
        uvs.setXY(idx + 3, u.u1, u.v1);
      }
      uvs.needsUpdate = true;
      heldMesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: TV.atlasTexture }));
      heldMesh.rotation.set(-0.22, 0.65, 0.12);
    } else {
      heldMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.42, 0.42),
        new THREE.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.2, side: THREE.DoubleSide })
      );
      heldMesh.position.set(0.02, 0.06, 0);
      heldMesh.rotation.set(-0.18, 0.38, -0.35);
    }
    handGroup.add(heldMesh);
  }

  function triggerHandSwing() {
    if (!isSwinging) {
      isSwinging = true;
      swingProgress = 0;
    }
  }

  function updateHandAnimation(dt, isMoving) {
    if (isSwinging) {
      swingProgress += dt * 4.8;
      if (swingProgress >= 1.0) { swingProgress = 0; isSwinging = false; }
    }
    if (isMoving && (onGround || isFlying)) walkBobTimer += dt * (isSprinting ? 13 : 9.5);
    const bobX = Math.sin(walkBobTimer) * (isMoving ? 0.022 : 0.004);
    const bobY = Math.abs(Math.cos(walkBobTimer)) * (isMoving ? 0.022 : 0.004);
    const arc = Math.sin(swingProgress * Math.PI);

    handGroup.position.set(0.42 + bobX - arc * 0.16, -0.34 + bobY - arc * 0.11, -0.58 - arc * 0.22);
    handGroup.rotation.set(-arc * 0.75, arc * 0.42, -arc * 0.32);
  }

  function updateCrackTexture(stage) {
    if (stage < 0 || stage > 9) {
      crackMesh.visible = false;
      return;
    }
    crackMesh.visible = true;
    crackMat.map = crackTextures[stage];
    crackMat.needsUpdate = true;
  }

  // Exact Amanatides-Woo 3D DDA Voxel Raycaster
  function updateRaycast(world) {
    const origin = TV.camera.position;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(TV.camera.quaternion).normalize();
    const maxDist = TV.gameMode === 'creative' ? 6.5 : 5.2;

    // 1. Check Mob targeting first (within 3.8 blocks)
    targetedMob = null;
    let mobDist = 3.8;
    for (const m of TV.mobs) {
      if (m.isDead) continue;
      const mCenter = m.pos.clone().add(new THREE.Vector3(0, m.height * 0.52, 0));
      const toMob = mCenter.clone().sub(origin);
      const proj = toMob.dot(dir);
      if (proj > 0 && proj < mobDist) {
        const perpSq = toMob.lengthSq() - proj * proj;
        if (perpSq <= (m.radius + 0.28) * (m.radius + 0.28)) {
          mobDist = proj;
          targetedMob = m;
        }
      }
    }

    // 2. Amanatides-Woo DDA traversal
    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    const stepX = dir.x >= 0 ? 1 : -1;
    const stepY = dir.y >= 0 ? 1 : -1;
    const stepZ = dir.z >= 0 ? 1 : -1;

    const tDeltaX = dir.x === 0 ? 1e9 : Math.abs(1 / dir.x);
    const tDeltaY = dir.y === 0 ? 1e9 : Math.abs(1 / dir.y);
    const tDeltaZ = dir.z === 0 ? 1e9 : Math.abs(1 / dir.z);

    let tMaxX = dir.x === 0 ? 1e9 : ((stepX > 0 ? (x + 1 - origin.x) : (origin.x - x)) * tDeltaX);
    let tMaxY = dir.y === 0 ? 1e9 : ((stepY > 0 ? (y + 1 - origin.y) : (origin.y - y)) * tDeltaY);
    let tMaxZ = dir.z === 0 ? 1e9 : ((stepZ > 0 ? (z + 1 - origin.z) : (origin.z - z)) * tDeltaZ);

    let normal = { x: 0, y: 1, z: 0 };
    let t = 0;
    targetedVoxel = null;

    while (t <= maxDist) {
      if (y >= 0 && y < WORLD_H) {
        const b = world.getBlock(x, y, z);
        if (b !== 0 && b !== B.WATER && b !== B.LAVA) {
          targetedVoxel = { x, y, z, id: b, normal: { ...normal }, dist: t };
          break;
        }
      }
      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          t = tMaxX; tMaxX += tDeltaX; x += stepX; normal = { x: -stepX, y: 0, z: 0 };
        } else {
          t = tMaxZ; tMaxZ += tDeltaZ; z += stepZ; normal = { x: 0, y: 0, z: -stepZ };
        }
      } else {
        if (tMaxY < tMaxZ) {
          t = tMaxY; tMaxY += tDeltaY; y += stepY; normal = { x: 0, y: -stepY, z: 0 };
        } else {
          t = tMaxZ; tMaxZ += tDeltaZ; z += stepZ; normal = { x: 0, y: 0, z: -stepZ };
        }
      }
    }

    if (targetedMob && (!targetedVoxel || mobDist <= targetedVoxel.dist)) {
      highlightBox.visible = false;
      crackMesh.visible = false;
      TV.setInteractPrompt(targetedMob.type === 'villager' ? 'Rechtsklick: Handeln' : '');
    } else if (targetedVoxel) {
      highlightBox.position.set(targetedVoxel.x + 0.5, targetedVoxel.y + 0.5, targetedVoxel.z + 0.5);
      highlightBox.visible = true;
      crackMesh.position.copy(highlightBox.position);

      const def = BLOCKS[targetedVoxel.id];
      let prompt = '';
      if (targetedVoxel.id === B.CRAFTING_TABLE) prompt = 'Rechtsklick: Werkbank öffnen';
      else if (targetedVoxel.id === B.FURNACE) prompt = 'Rechtsklick: Schmelzofen öffnen';
      else if (targetedVoxel.id === B.CHEST) prompt = 'Rechtsklick: Truhe öffnen';
      else if (targetedVoxel.id === B.DOOR_OAK) prompt = 'Rechtsklick: Tür öffnen/schließen';
      else if (targetedVoxel.id === B.BED) prompt = 'Rechtsklick: Schlafen & Respawn setzen';
      else if (targetedVoxel.id === B.COMPOSTER) prompt = 'Rechtsklick: Kompostieren';
      else if (def?.crop && world.getMeta(targetedVoxel.x, targetedVoxel.y, targetedVoxel.z) === 3) prompt = 'Erntereif!';
      TV.setInteractPrompt(prompt);
    } else {
      highlightBox.visible = false;
      crackMesh.visible = false;
      TV.setInteractPrompt('');
    }
  }

  // Player Damage, XP, & Respawn
  function playerTakeDamage(amt, reason = 'Du bist gefallen') {
    if (TV.gameMode === 'creative' || playerHp <= 0) return;
    const armorPts = TV.getEquippedArmorPoints();
    const reduction = Math.min(0.80, armorPts * 0.04);
    const finalDmg = Math.max(1, Math.round(amt * (1 - reduction)));
    playerHp = Math.max(0, playerHp - finalDmg);

    for (const s in TV.equippedArmor) {
      const piece = TV.equippedArmor[s];
      if (piece) {
        piece.durability--;
        if (piece.durability <= 0) {
          TV.equippedArmor[s] = null;
          sounds.playBreak('stone');
        }
      }
    }
    TV.updateArmorUI();
    sounds.playHurt();

    const ov = document.getElementById('damage-overlay');
    ov.style.opacity = '1';
    setTimeout(() => { ov.style.opacity = '0'; }, 180);

    TV.updateSurvivalUI();
    if (playerHp <= 0) {
      if (document.pointerLockElement) document.exitPointerLock();
      document.getElementById('death-reason').textContent = reason;
      document.getElementById('death-score').textContent = `Erreichtes Level: ${playerLevel}`;
      document.getElementById('death-screen').classList.remove('hidden');
    }
  }

  function addPlayerXp(amount) {
    playerXp += amount;
    const needed = 10 + playerLevel * 5;
    if (playerXp >= needed) {
      playerXp -= needed;
      playerLevel++;
      sounds.playLevelUp();
      TV.showToast(`Level ${playerLevel} erreicht!`);
    }
    TV.updateSurvivalUI();
  }

  function respawnPlayer(world) {
    playerHp = 20;
    playerHunger = 20;
    playerOxygen = 20;
    const sy = world.findSurfaceY(Math.floor(spawnPoint.x), Math.floor(spawnPoint.z));
    TV.camera.position.set(spawnPoint.x, Math.max(spawnPoint.y, sy + 1.65), spawnPoint.z);
    vel.set(0, 0, 0);
    fallStartY = TV.camera.position.y;
    document.getElementById('death-screen').classList.add('hidden');
    TV.updateSurvivalUI();
    if (!isTouchDevice) TV.canvas.requestPointerLock();
  }

  // Left Click Action (Attack Mob or Bow or Mine)
  function handleLeftPress(world) {
    triggerHandSwing();
    const cur = TV.inventory[TV.activeHotbarSlot];
    if (cur?.id === 179 && bowCooldown <= 0) {
      if (TV.gameMode === 'creative' || TV.consumeItemFromInventory(180, 1)) {
        const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(TV.camera.quaternion).normalize();
        TV.spawnArrow(TV.camera.position.clone().addScaledVector(dir, 0.6), dir, 30, 8, true);
        sounds.playBow();
        bowCooldown = 0.45;
        if (TV.gameMode !== 'creative' && cur.durability !== undefined) {
          cur.durability--;
          if (cur.durability <= 0) TV.inventory[TV.activeHotbarSlot] = null;
        }
        TV.updateHotbarUI();
      } else {
        TV.showToast('Keine Pfeile im Inventar!');
      }
      return;
    }

    if (targetedMob && attackCooldown <= 0) {
      const dmg = ITEMS[cur?.id]?.damage ?? 1;
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(TV.camera.quaternion).normalize();
      targetedMob.takeDamage(dmg, dir);
      attackCooldown = 0.35;
      if (TV.gameMode !== 'creative' && cur?.durability !== undefined) {
        cur.durability--;
        if (cur.durability <= 0) TV.inventory[TV.activeHotbarSlot] = null;
        TV.updateHotbarUI();
      }
    }
  }

  // Right Click Interaction / Place / Eat / Farm / Bucket
  function handleRightClick(world) {
    // 1. Mob interaction (Villager trade or Animal feeding)
    if (targetedMob && (!targetedVoxel || targetedMob.pos.distanceTo(TV.camera.position) <= targetedVoxel.dist + 0.5)) {
      if (targetedMob.type === 'villager') {
        TV.openVillagerTrade();
        return;
      }
      const cur = TV.inventory[TV.activeHotbarSlot];
      if (cur && targetedMob.tryFeed(cur.id)) {
        if (TV.gameMode !== 'creative') {
          cur.count--;
          if (cur.count <= 0) TV.inventory[TV.activeHotbarSlot] = null;
          TV.updateHotbarUI();
        }
        return;
      }
    }

    const cur = TV.inventory[TV.activeHotbarSlot];

    // 2. Interactive Block under cursor
    if (targetedVoxel) {
      const { x, y, z, id, normal } = targetedVoxel;
      if (id === B.CRAFTING_TABLE) { TV.openInventory(true); return; }
      if (id === B.FURNACE) { TV.openFurnace(x, y, z); return; }
      if (id === B.CHEST) { TV.openChest(x, y, z); return; }
      if (id === B.DOOR_OAK) {
        const meta = world.getMeta(x, y, z);
        const newOpen = (meta & 4) ? (meta & ~4) : (meta | 4);
        world.setBlock(x, y, z, B.DOOR_OAK, newOpen, true);
        // Sync upper/lower door half
        if (world.getBlock(x, y + 1, z) === B.DOOR_OAK) world.setBlock(x, y + 1, z, B.DOOR_OAK, (world.getMeta(x, y + 1, z) & ~4) | (newOpen & 4), true);
        if (world.getBlock(x, y - 1, z) === B.DOOR_OAK) world.setBlock(x, y - 1, z, B.DOOR_OAK, (world.getMeta(x, y - 1, z) & ~4) | (newOpen & 4), true);
        sounds.playDoor((newOpen & 4) !== 0);
        world.rebuildArea(x, z);
        return;
      }
      if (id === B.BED) {
        spawnPoint = { x: x + 0.5, y: y + 1.65, z: z + 0.5 };
        if (TV.isNightTime()) {
          const ov = document.getElementById('sleep-overlay');
          ov.style.opacity = '1';
          setTimeout(() => {
            TV.skipNightToMorning();
            ov.style.opacity = '0';
            TV.showToast('Guten Morgen! Respawn-Punkt gespeichert.');
          }, 650);
        } else {
          TV.showToast('Respawn-Punkt gesetzt! (Schlafen nachts möglich)');
        }
        return;
      }
      if (id === B.COMPOSTER && cur && (cur.id === 137 || cur.id === 136 || BLOCKS[cur.id]?.plant)) {
        if (TV.gameMode !== 'creative') {
          cur.count--;
          if (cur.count <= 0) TV.inventory[TV.activeHotbarSlot] = null;
          TV.updateHotbarUI();
        }
        addPlayerXp(2);
        sounds.playPickup();
        return;
      }

      // Hoe -> Till Grass/Dirt into Farmland
      if (cur && ITEMS[cur.id]?.toolType === 'hoe' && (id === B.GRASS || id === B.DIRT || id === B.DIRT_PATH)) {
        if (world.getBlock(x, y + 1, z) === 0) {
          let hydrated = 0;
          for (let dx = -4; dx <= 4 && !hydrated; dx++) {
            for (let dz = -4; dz <= 4 && !hydrated; dz++) {
              if (world.getBlock(x + dx, y, z + dz) === B.WATER) hydrated = 1;
            }
          }
          world.setBlock(x, y, z, B.FARMLAND, hydrated, true);
          world.rebuildArea(x, z);
          sounds.playDig('dirt');
          triggerHandSwing();
          if (TV.gameMode !== 'creative' && cur.durability !== undefined) {
            cur.durability--;
            if (cur.durability <= 0) TV.inventory[TV.activeHotbarSlot] = null;
            TV.updateHotbarUI();
          }
          return;
        }
      }

      // Plant Seeds / Carrots on Farmland
      if (cur && ITEMS[cur.id]?.plantsBlock && id === B.FARMLAND && normal.y === 1) {
        if (world.getBlock(x, y + 1, z) === 0) {
          world.setBlock(x, y + 1, z, ITEMS[cur.id].plantsBlock, 0, true);
          world.rebuildArea(x, z);
          sounds.playPlace('dirt');
          triggerHandSwing();
          if (TV.gameMode !== 'creative') {
            cur.count--;
            if (cur.count <= 0) TV.inventory[TV.activeHotbarSlot] = null;
            TV.updateHotbarUI();
          }
          return;
        }
      }

      // Bucket Place Water/Lava
      if (cur && (cur.id === 182 || cur.id === 183)) {
        const px = x + normal.x, py = y + normal.y, pz = z + normal.z;
        if (py >= 1 && py < WORLD_H && world.getBlock(px, py, pz) === 0) {
          world.setBlock(px, py, pz, ITEMS[cur.id].liquid, 0, true);
          world.rebuildArea(px, pz);
          sounds.playSplash();
          if (TV.gameMode !== 'creative') {
            TV.inventory[TV.activeHotbarSlot] = { id: 181, count: 1 };
            TV.updateHotbarUI();
          }
          return;
        }
      }
    }

    // Empty Bucket Scoop Water/Lava via short raycast
    if (cur && cur.id === 181) {
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(TV.camera.quaternion).normalize();
      for (let d = 0.4; d <= 4.8; d += 0.2) {
        const p = TV.camera.position.clone().addScaledVector(dir, d);
        const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
        const lb = world.getBlock(bx, by, bz);
        if (lb === B.WATER || lb === B.LAVA) {
          world.setBlock(bx, by, bz, 0, 0, true);
          world.rebuildArea(bx, bz);
          sounds.playSplash();
          if (TV.gameMode !== 'creative') {
            TV.inventory[TV.activeHotbarSlot] = { id: lb === B.WATER ? 182 : 183, count: 1 };
            TV.updateHotbarUI();
          }
          return;
        }
      }
    }

    // 3. Eat Food (when not placing/interacting)
    if (cur && ITEMS[cur.id]?.type === 'food' && playerHunger < 20 && TV.gameMode !== 'creative') {
      sounds.playEat();
      playerHunger = Math.min(20, playerHunger + (ITEMS[cur.id].healHunger || 4));
      cur.count--;
      if (cur.count <= 0) TV.inventory[TV.activeHotbarSlot] = null;
      TV.updateSurvivalUI();
      TV.updateHotbarUI();
      triggerHandSwing();
      return;
    }

    // 4. Equip Armor via Right-Click in hotbar
    if (cur && ITEMS[cur.id]?.type === 'armor') {
      const slot = ITEMS[cur.id].armorSlot;
      const old = TV.equippedArmor[slot];
      TV.equippedArmor[slot] = cur;
      TV.inventory[TV.activeHotbarSlot] = old;
      sounds.playPickup();
      TV.updateHotbarUI();
      TV.updateArmorUI();
      return;
    }

    // 5. Place Block
    if (cur && cur.id < 100 && targetedVoxel) {
      const replaceable = BLOCKS[targetedVoxel.id]?.replaceable;
      const px = replaceable ? targetedVoxel.x : targetedVoxel.x + targetedVoxel.normal.x;
      const py = replaceable ? targetedVoxel.y : targetedVoxel.y + targetedVoxel.normal.y;
      const pz = replaceable ? targetedVoxel.z : targetedVoxel.z + targetedVoxel.normal.z;
      if (py < 1 || py >= WORLD_H) return;

      const def = BLOCKS[cur.id];
      // Prevent placing solid block inside player AABB
      if (def?.solid) {
        const pMinX = TV.camera.position.x - 0.30, pMaxX = TV.camera.position.x + 0.30;
        const pMinY = TV.camera.position.y - 1.62, pMaxY = TV.camera.position.y + 0.16;
        const pMinZ = TV.camera.position.z - 0.30, pMaxZ = TV.camera.position.z + 0.30;
        if (px + 1 > pMinX && px < pMaxX && py + 1 > pMinY && py < pMaxY && pz + 1 > pMinZ && pz < pMaxZ) return;
      }

      // Compute directional facing meta from player yaw
      const normYaw = ((mouseLook.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const facing = Math.round(normYaw / (Math.PI / 2)) & 3;
      let meta = 0;
      if (def?.directional || def?.shape === 'stair') meta = facing;

      if (cur.id === B.TORCH) {
        if (targetedVoxel.normal.x === 1) meta = 2;
        else if (targetedVoxel.normal.x === -1) meta = 1;
        else if (targetedVoxel.normal.z === 1) meta = 4;
        else if (targetedVoxel.normal.z === -1) meta = 3;
        else meta = 0;
      }

      if (cur.id === B.DOOR_OAK) {
        if (py + 1 >= WORLD_H || world.getBlock(px, py + 1, pz) !== 0) return;
        world.setBlock(px, py, pz, B.DOOR_OAK, 0, true);
        world.setBlock(px, py + 1, pz, B.DOOR_OAK, 8, true);
      } else {
        world.setBlock(px, py, pz, cur.id, meta, true);
      }

      world.rebuildArea(px, pz);
      sounds.playPlace(def?.mat || 'stone');
      triggerHandSwing();

      if (TV.gameMode !== 'creative') {
        cur.count--;
        if (cur.count <= 0) TV.inventory[TV.activeHotbarSlot] = null;
        TV.updateHotbarUI();
      }
    }
  }

  // Collision Check Helpers
  function isBlockSolidForPlayer(world, x, y, z) {
    if (y < 0 || y >= WORLD_H) return y < 0;
    const id = world.getBlock(x, y, z);
    if (id === 0) return false;
    const def = BLOCKS[id];
    if (!def || !def.solid) return false;
    if (id === B.DOOR_OAK && (world.getMeta(x, y, z) & 4) !== 0) return false; // Open door is passable!
    return true;
  }

  function collidesAABB(world, cx, eyeY, cz) {
    const r = 0.29;
    const minX = Math.floor(cx - r), maxX = Math.floor(cx + r);
    const minY = Math.floor(eyeY - 1.62 + 0.05), maxY = Math.floor(eyeY + 0.14);
    const minZ = Math.floor(cz - r), maxZ = Math.floor(cz + r);
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (isBlockSolidForPlayer(world, x, y, z)) return true;
          // Fences act 1.5 blocks tall so players cannot walk/jump straight over
          if (y === minY && isBlockSolidForPlayer(world, x, y - 1, z) && world.getBlock(x, y - 1, z) === B.FENCE_OAK) {
            return true;
          }
        }
      }
    }
    return false;
  }

  function updatePlayer(dt, world) {
    attackCooldown = Math.max(0, attackCooldown - dt);
    bowCooldown = Math.max(0, bowCooldown - dt);

    const activeControl = TV.isPlaying && !TV.isAnyModalOpen() && (document.pointerLockElement === TV.canvas || isTouchDevice);
    if (!activeControl || playerHp <= 0) {
      updateHandAnimation(dt, false);
      return;
    }

    const pos = TV.camera.position;
    const isSneaking = (keys['ShiftLeft'] || keys['ShiftRight']) && !isFlying;
    const wantSprint = (keys['ControlLeft'] || isSprinting) && !isSneaking && (playerHunger > 6 || TV.gameMode === 'creative');

    // Movement vector
    const move = new THREE.Vector3();
    if (keys['KeyW']) move.z -= 1;
    if (keys['KeyS']) move.z += 1;
    if (keys['KeyA']) move.x -= 1;
    if (keys['KeyD']) move.x += 1;
    if (isTouchDevice && (Math.abs(touchAxes.x) > 0.08 || Math.abs(touchAxes.y) > 0.08)) {
      move.x += touchAxes.x;
      move.z += touchAxes.y;
    }
    if (!keys['KeyW']) isSprinting = false;

    const isMoving = move.lengthSq() > 0.001;
    const targetFov = TV.settings.fov + (wantSprint && isMoving ? 6 : 0);
    if (Math.abs(TV.camera.fov - targetFov) > 0.1) {
      TV.camera.fov = THREE.MathUtils.lerp(TV.camera.fov, targetFov, Math.min(1, dt * 10));
      TV.camera.updateProjectionMatrix();
    }

    if (isMoving) {
      move.normalize();
      const baseSpeed = isFlying ? 11.5 : (isSneaking ? 2.1 : (wantSprint ? 6.5 : 4.4));
      const yaw = mouseLook.yaw;
      const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
      const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      const wish = new THREE.Vector3().addScaledVector(fwd, -move.z).addScaledVector(right, move.x).multiplyScalar(baseSpeed);

      vel.x = THREE.MathUtils.lerp(vel.x, wish.x, Math.min(1, dt * 14));
      vel.z = THREE.MathUtils.lerp(vel.z, wish.z, Math.min(1, dt * 14));

      if (onGround && !isFlying && !isSneaking) {
        footstepTimer += dt * (wantSprint ? 1.35 : 1.0);
        if (footstepTimer > 0.36) {
          footstepTimer = 0;
          const underId = world.getBlock(Math.floor(pos.x), Math.floor(pos.y - 1.7), Math.floor(pos.z));
          const mat = BLOCKS[underId]?.mat || (isUnderwater ? 'water' : 'grass');
          sounds.playFootstep(mat);
        }
      }
    } else {
      const friction = isFlying ? 8 : 16;
      vel.x = THREE.MathUtils.lerp(vel.x, 0, Math.min(1, dt * friction));
      vel.z = THREE.MathUtils.lerp(vel.z, 0, Math.min(1, dt * friction));
    }

    // Water & Lava checks
    const eyeBlk = world.getBlock(Math.floor(pos.x), Math.floor(pos.y), Math.floor(pos.z));
    const feetBlk = world.getBlock(Math.floor(pos.x), Math.floor(pos.y - 1.2), Math.floor(pos.z));
    const wasUnderwater = isUnderwater;
    isUnderwater = (eyeBlk === B.WATER);
    isInLava = (eyeBlk === B.LAVA || feetBlk === B.LAVA);
    document.getElementById('underwater-overlay').style.opacity = isUnderwater ? '1' : '0';
    document.getElementById('lava-overlay').style.opacity = isInLava ? '1' : '0';

    if (!wasUnderwater && isUnderwater && vel.y < -4) sounds.playSplash();

    if (isInLava && TV.gameMode !== 'creative') {
      lavaBurnTimer += dt;
      if (lavaBurnTimer >= 0.5) {
        lavaBurnTimer = 0;
        playerTakeDamage(4, 'In Lava geschwommen');
      }
    } else {
      lavaBurnTimer = 0;
    }

    if (isFlying) {
      let flyY = 0;
      if (keys['Space']) flyY += 7.5;
      if (keys['ShiftLeft'] || keys['ShiftRight']) flyY -= 7.5;
      vel.y = THREE.MathUtils.lerp(vel.y, flyY, Math.min(1, dt * 12));
      fallStartY = pos.y;
    } else if (isUnderwater || feetBlk === B.WATER) {
      vel.y -= 5.0 * dt;
      if (keys['Space']) vel.y = 3.8;
      vel.y = Math.max(-3.5, Math.min(4.0, vel.y));
      fallStartY = pos.y;

      if (isUnderwater && TV.gameMode !== 'creative') {
        playerOxygen = Math.max(0, playerOxygen - dt * 2.2);
        if (playerOxygen <= 0) {
          drownTimer += dt;
          if (drownTimer >= 1.1) { drownTimer = 0; playerTakeDamage(2, 'Ertrunken'); }
        }
      } else {
        playerOxygen = Math.min(20, playerOxygen + dt * 7);
      }
    } else {
      playerOxygen = Math.min(20, playerOxygen + dt * 7);
      vel.y -= 26.0 * dt;
      if (keys['Space'] && onGround) {
        vel.y = 8.75;
        onGround = false;
      }
    }

    // X Movement + Stair step-up + Sneak Ledge Protection
    const oldX = pos.x;
    pos.x += vel.x * dt;
    if (collidesAABB(world, pos.x, pos.y, pos.z)) {
      // Try automatic 0.52-block step up if standing on ground (e.g. Stairs!)
      const footBlkX = world.getBlock(Math.floor(pos.x + Math.sign(vel.x) * 0.32), Math.floor(pos.y - 1.62 + 0.1), Math.floor(pos.z));
      if (onGround && BLOCKS[footBlkX]?.shape === 'stair' && !collidesAABB(world, pos.x, pos.y + 0.55, pos.z)) {
        pos.y += 0.52;
      } else {
        pos.x = oldX;
        vel.x = 0;
      }
    } else if (isSneaking && onGround) {
      // Ledge guard: prevent walking off unsupported edge while sneaking!
      if (!isBlockSolidForPlayer(world, Math.floor(pos.x), Math.floor(pos.y - 1.75), Math.floor(pos.z))) {
        pos.x = oldX;
        vel.x = 0;
      }
    }

    // Z Movement + Stair step-up + Sneak Ledge Protection
    const oldZ = pos.z;
    pos.z += vel.z * dt;
    if (collidesAABB(world, pos.x, pos.y, pos.z)) {
      const footBlkZ = world.getBlock(Math.floor(pos.x), Math.floor(pos.y - 1.62 + 0.1), Math.floor(pos.z + Math.sign(vel.z) * 0.32));
      if (onGround && BLOCKS[footBlkZ]?.shape === 'stair' && !collidesAABB(world, pos.x, pos.y + 0.55, pos.z)) {
        pos.y += 0.52;
      } else {
        pos.z = oldZ;
        vel.z = 0;
      }
    } else if (isSneaking && onGround) {
      if (!isBlockSolidForPlayer(world, Math.floor(pos.x), Math.floor(pos.y - 1.75), Math.floor(pos.z))) {
        pos.z = oldZ;
        vel.z = 0;
      }
    }

    // Sub-stepped Y Axis Collision
    const totalDy = vel.y * dt;
    const steps = Math.max(1, Math.ceil(Math.abs(totalDy) / 0.12));
    const stepDy = totalDy / steps;
    let landed = false;

    for (let s = 0; s < steps; s++) {
      pos.y += stepDy;
      const r = 0.28;
      const minX = Math.floor(pos.x - r), maxX = Math.floor(pos.x + r);
      const minZ = Math.floor(pos.z - r), maxZ = Math.floor(pos.z + r);

      if (vel.y > 0) {
        const headY = Math.floor(pos.y + 0.16);
        let hitCeil = false;
        for (let x = minX; x <= maxX && !hitCeil; x++) {
          for (let z = minZ; z <= maxZ && !hitCeil; z++) {
            if (isBlockSolidForPlayer(world, x, headY, z)) {
              pos.y = headY - 0.165;
              vel.y = 0;
              hitCeil = true;
            }
          }
        }
        if (hitCeil) break;
      } else {
        const footY = Math.floor(pos.y - 1.62);
        for (let x = minX; x <= maxX && !landed; x++) {
          for (let z = minZ; z <= maxZ && !landed; z++) {
            if (isBlockSolidForPlayer(world, x, footY, z)) {
              const blkId = world.getBlock(x, footY, z);
              const topSurface = (BLOCKS[blkId]?.shape === 'fence') ? footY + 1.5 : (footY + 1.0);
              pos.y = topSurface + 1.62;
              if (!isFlying && fallStartY - pos.y > 3.8 && blkId !== B.HAY_BALE) {
                const dmg = Math.floor((fallStartY - pos.y - 3.2) * 1.9);
                if (dmg > 0) playerTakeDamage(dmg, 'Zu tief gefallen');
              } else if (blkId === B.HAY_BALE && fallStartY - pos.y > 6) {
                playerTakeDamage(Math.floor((fallStartY - pos.y - 5) * 0.4), 'Zu tief gefallen');
              }
              vel.y = 0;
              landed = true;
              fallStartY = pos.y;
            }
          }
        }
        if (landed) break;
      }
    }

    onGround = landed;
    if (onGround) isFlying = false;
    if (!onGround && pos.y > fallStartY) fallStartY = pos.y;

    // Emergency Void / Suffocation Safety
    if (pos.y < 1.5) {
      const sy = world.findSurfaceY(Math.floor(pos.x), Math.floor(pos.z));
      pos.y = sy + 1.65;
      vel.set(0, 0, 0);
      fallStartY = pos.y;
    }

    // Cactus Contact Damage
    if (TV.gameMode !== 'creative') {
      const near = world.getBlock(Math.floor(pos.x), Math.floor(pos.y - 0.8), Math.floor(pos.z));
      if (near === B.CACTUS && lavaBurnTimer <= 0) {
        lavaBurnTimer = 0.5;
        playerTakeDamage(1, 'Von einem Kaktus gestochen');
      }
    }

    // Survival Hunger & Natural Health Regen
    if (TV.gameMode !== 'creative') {
      hungerDecayTimer += dt * (wantSprint && isMoving ? 2.2 : 1.0);
      if (hungerDecayTimer >= 28.0) {
        hungerDecayTimer = 0;
        if (playerHunger > 0) {
          playerHunger--;
          TV.updateSurvivalUI();
        } else if (playerHp > 1) {
          playerTakeDamage(1, 'Verhungert');
        }
      }
      if (playerHunger >= 18 && playerHp < 20) {
        naturalRegenTimer += dt;
        if (naturalRegenTimer >= 4.0) {
          naturalRegenTimer = 0;
          playerHp = Math.min(20, playerHp + 1);
          TV.updateSurvivalUI();
        }
      }
    }

    // Raycast & Mining Progression
    updateRaycast(world);

    if (isLeftDown && targetedVoxel && !targetedMob) {
      triggerHandSwing();
      const targetKey = `${targetedVoxel.x},${targetedVoxel.y},${targetedVoxel.z}`;
      if (targetKey !== lastMineKey) {
        mineTimer = 0;
        lastMineKey = targetKey;
      }

      const def = BLOCKS[targetedVoxel.id];
      if (!def?.unbreakable) {
        const cur = TV.inventory[TV.activeHotbarSlot];
        const toolDef = cur ? ITEMS[cur.id] : null;
        let speed = 1.0;
        const hardness = TV.gameMode === 'creative' ? 0.05 : (def?.hardness ?? 1.0);

        if (toolDef && def?.tool && toolDef.toolType === def.tool) {
          speed = toolDef.speed || 2.5;
        } else if (def?.plant || def?.leaves || def?.torch) {
          speed = 4.0;
        }

        mineTimer += dt * speed;
        mineSoundTimer += dt;
        if (mineSoundTimer >= 0.22) {
          mineSoundTimer = 0;
          sounds.playDig(def?.mat || 'stone');
        }

        const stage = Math.min(9, Math.floor((mineTimer / hardness) * 10));
        updateCrackTexture(stage);

        if (mineTimer >= hardness) {
          const { x, y, z, id } = targetedVoxel;
          const meta = world.getMeta(x, y, z);
          sounds.playBreak(def?.mat || 'stone');
          TV.spawnBlockParticles(x, y, z, id);

          // Determine drops (Respect tool tier for Ores, crop stages, chests!)
          if (TV.gameMode !== 'creative') {
            const hasTier = !def?.minTier || (toolDef?.toolType === def.tool && (toolDef.tier || 0) >= def.minTier);
            if (id === B.WHEAT_CROP) {
              TV.spawnDroppedItem(x + 0.5, y + 0.4, z + 0.5, 137, meta === 3 ? 2 : 1);
              if (meta === 3) TV.spawnDroppedItem(x + 0.5, y + 0.4, z + 0.5, 136, 1);
            } else if (id === B.CARROT_CROP) {
              TV.spawnDroppedItem(x + 0.5, y + 0.4, z + 0.5, 138, meta === 3 ? 3 : 1);
            } else if (hasTier) {
              const dropChance = def?.dropChance ?? 1.0;
              if (def?.drop && Math.random() < dropChance) {
                TV.spawnDroppedItem(x + 0.5, y + 0.4, z + 0.5, def.drop, 1);
              }
              if (def?.bonusDrop && Math.random() < (def.bonusChance || 0)) {
                TV.spawnDroppedItem(x + 0.5, y + 0.4, z + 0.5, def.bonusDrop, 1);
              }
              if (def?.xp) addPlayerXp(def.xp);
            }
          }

          // Drop contents if breaking Chest or Furnace
          const beKey = `${x},${y},${z}`;
          if (id === B.CHEST && TV.blockEntities.chests[beKey]) {
            TV.blockEntities.chests[beKey].forEach(it => { if (it) TV.spawnDroppedItem(x + 0.5, y + 0.5, z + 0.5, it.id, it.count); });
            delete TV.blockEntities.chests[beKey];
          }
          if (id === B.FURNACE && TV.blockEntities.furnaces[beKey]) {
            const f = TV.blockEntities.furnaces[beKey];
            [f.input, f.fuel, f.output].forEach(it => { if (it) TV.spawnDroppedItem(x + 0.5, y + 0.5, z + 0.5, it.id, it.count); });
            delete TV.blockEntities.furnaces[beKey];
          }

          // Remove paired door half
          if (id === B.DOOR_OAK) {
            if (world.getBlock(x, y + 1, z) === B.DOOR_OAK) world.setBlock(x, y + 1, z, 0, 0, true);
            if (world.getBlock(x, y - 1, z) === B.DOOR_OAK) world.setBlock(x, y - 1, z, 0, 0, true);
          }

          world.setBlock(x, y, z, 0, 0, true);

          // Falling gravity blocks (Sand / Gravel above broken block)
          let gy = y + 1;
          while (gy < WORLD_H && BLOCKS[world.getBlock(x, gy, z)]?.gravity) {
            const gId = world.getBlock(x, gy, z);
            world.setBlock(x, gy, z, 0, 0, true);
            let dropY = gy;
            while (dropY > 1 && world.getBlock(x, dropY - 1, z) === 0) dropY--;
            world.setBlock(x, dropY, z, gId, 0, true);
            gy++;
          }

          world.rebuildArea(x, z);

          if (TV.gameMode !== 'creative' && cur?.durability !== undefined) {
            cur.durability--;
            if (cur.durability <= 0) { TV.inventory[TV.activeHotbarSlot] = null; sounds.playBreak('wood'); }
            TV.updateHotbarUI();
          }

          mineTimer = 0;
          updateCrackTexture(-1);
        }
      } else {
        mineTimer = 0;
        updateCrackTexture(-1);
      }
    } else {
      mineTimer = 0;
      updateCrackTexture(-1);
    }

    updateHandAnimation(dt, isMoving);
  }

  // Input Event Listeners
  function initInputListeners() {
    window.addEventListener('keydown', (e) => {
      keys[e.code] = true;

      if (e.code === 'KeyW' && !e.repeat) {
        const now = performance.now();
        if (now - lastWPress < 260) isSprinting = true;
        lastWPress = now;
      }

      if (e.code === 'Space' && !e.repeat && TV.gameMode === 'creative' && TV.isPlaying && !TV.isAnyModalOpen()) {
        const now = performance.now();
        if (now - lastSpacePress < 280) {
          isFlying = !isFlying;
          vel.y = 0;
          TV.showToast(isFlying ? 'Flugmodus aktiv' : 'Flugmodus beendet');
        }
        lastSpacePress = now;
      }

      if (!TV.isPlaying) return;

      if (e.key >= '1' && e.key <= '9' && !TV.isAnyModalOpen()) {
        TV.activeHotbarSlot = parseInt(e.key, 10) - 1;
        TV.updateHotbarUI(true);
      }

      if (e.code === 'KeyE' && document.getElementById('pause-menu').classList.contains('hidden') &&
          document.getElementById('settings-modal').classList.contains('hidden') &&
          document.getElementById('death-screen').classList.contains('hidden')) {
        if (!document.getElementById('inventory-modal').classList.contains('hidden')) {
          TV.closeAllGameModals(true);
        } else if (!TV.isAnyModalOpen()) {
          TV.openInventory(false);
        }
      }

      if (e.code === 'KeyQ' && !TV.isAnyModalOpen()) {
        const cur = TV.inventory[TV.activeHotbarSlot];
        if (cur) {
          const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(TV.camera.quaternion).normalize();
          const p = TV.camera.position.clone().addScaledVector(dir, 1.4);
          TV.spawnDroppedItem(p.x, p.y - 0.3, p.z, cur.id, 1);
          cur.count--;
          if (cur.count <= 0) TV.inventory[TV.activeHotbarSlot] = null;
          TV.updateHotbarUI();
        }
      }

      if (e.code === 'F3') {
        e.preventDefault();
        document.getElementById('debug-overlay').classList.toggle('hidden');
      }

      if (e.code === 'Escape') {
        if (!document.getElementById('settings-modal').classList.contains('hidden')) {
          document.getElementById('settings-modal').classList.add('hidden');
        } else if (!document.getElementById('inventory-modal').classList.contains('hidden') ||
                   !document.getElementById('furnace-modal').classList.contains('hidden') ||
                   !document.getElementById('chest-modal').classList.contains('hidden') ||
                   !document.getElementById('trade-modal').classList.contains('hidden')) {
          TV.closeAllGameModals(true);
        } else if (TV.isPlaying && document.getElementById('death-screen').classList.contains('hidden')) {
          TV.togglePauseMenu();
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      keys[e.code] = false;
    });

    window.addEventListener('wheel', (e) => {
      if (TV.isPlaying && !TV.isAnyModalOpen() && document.pointerLockElement === TV.canvas) {
        TV.activeHotbarSlot += (e.deltaY > 0 ? 1 : -1);
        TV.updateHotbarUI(true);
      }
    });

    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === TV.canvas && TV.isPlaying && !TV.isAnyModalOpen()) {
        const sens = 0.0022 * (TV.settings.sensitivity || 1.0);
        const ySign = TV.settings.invertY ? -1 : 1;
        mouseLook.yaw -= e.movementX * sens;
        mouseLook.pitch -= e.movementY * sens * ySign;
        mouseLook.pitch = Math.max(-Math.PI / 2 + 0.03, Math.min(Math.PI / 2 - 0.03, mouseLook.pitch));
        TV.camera.quaternion.setFromEuler(new THREE.Euler(mouseLook.pitch, mouseLook.yaw, 0, 'YXZ'));
      }
    });

    TV.canvas.addEventListener('mousedown', (e) => {
      if (!TV.isPlaying || TV.isAnyModalOpen()) return;
      sounds.init();
      if (!isTouchDevice && document.pointerLockElement !== TV.canvas) {
        TV.canvas.requestPointerLock();
        return;
      }
      if (e.button === 0) {
        isLeftDown = true;
        mineTimer = 0;
        handleLeftPress(TV.world);
      } else if (e.button === 2) {
        handleRightClick(TV.world);
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        isLeftDown = false;
        mineTimer = 0;
        updateCrackTexture(-1);
      }
    });

    window.addEventListener('contextmenu', (e) => {
      if (TV.isPlaying) e.preventDefault();
    });

    // Touch controls setup
    if (isTouchDevice) {
      document.body.classList.add('touch-mode');
      const jZone = document.getElementById('joystick-zone');
      const jKnob = document.getElementById('joystick-knob');
      let jId = null, lookId = null, lx = 0, ly = 0;

      const moveStick = (t) => {
        const r = jZone.getBoundingClientRect();
        const dx = t.clientX - (r.left + r.width / 2);
        const dy = t.clientY - (r.top + r.height / 2);
        const d = Math.min(Math.hypot(dx, dy), 44);
        const a = Math.atan2(dy, dx);
        jKnob.style.transform = `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px)`;
        touchAxes.x = (Math.cos(a) * d) / 44;
        touchAxes.y = (Math.sin(a) * d) / 44;
      };

      jZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (jId === null && e.changedTouches.length) {
          jId = e.changedTouches[0].identifier;
          moveStick(e.changedTouches[0]);
        }
      }, { passive: false });

      window.addEventListener('touchstart', (e) => {
        if (!TV.isPlaying || TV.isAnyModalOpen()) return;
        for (const t of e.changedTouches) {
          if (t.clientX > window.innerWidth * 0.35 && lookId === null && !t.target.closest('.touch-btn, #hud')) {
            lookId = t.identifier; lx = t.clientX; ly = t.clientY;
          }
        }
      }, { passive: true });

      window.addEventListener('touchmove', (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier === jId) moveStick(t);
          else if (t.identifier === lookId) {
            mouseLook.yaw -= (t.clientX - lx) * 0.004;
            mouseLook.pitch = Math.max(-1.5, Math.min(1.5, mouseLook.pitch - (t.clientY - ly) * 0.004));
            TV.camera.quaternion.setFromEuler(new THREE.Euler(mouseLook.pitch, mouseLook.yaw, 0, 'YXZ'));
            lx = t.clientX; ly = t.clientY;
          }
        }
      }, { passive: false });

      window.addEventListener('touchend', (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier === jId) { jId = null; jKnob.style.transform = 'translate(0,0)'; touchAxes.x = 0; touchAxes.y = 0; }
          if (t.identifier === lookId) lookId = null;
        }
      });

      document.getElementById('touch-jump-btn').addEventListener('touchstart', (e) => { e.preventDefault(); keys['Space'] = true; });
      document.getElementById('touch-jump-btn').addEventListener('touchend', () => { keys['Space'] = false; });
      document.getElementById('touch-mine-btn').addEventListener('touchstart', (e) => { e.preventDefault(); isLeftDown = true; handleLeftPress(TV.world); });
      document.getElementById('touch-mine-btn').addEventListener('touchend', () => { isLeftDown = false; });
      document.getElementById('touch-place-btn').addEventListener('touchstart', (e) => { e.preventDefault(); handleRightClick(TV.world); });
      document.getElementById('touch-sneak-btn').addEventListener('touchstart', (e) => { e.preventDefault(); keys['ShiftLeft'] = !keys['ShiftLeft']; });
      document.getElementById('touch-inv-btn').addEventListener('touchstart', (e) => { e.preventDefault(); TV.openInventory(false); });
    }
  }

  TV.isTouchDevice = isTouchDevice;
  TV.mouseLook = mouseLook;
  TV.playerVel = vel;
  Object.defineProperty(TV, 'playerHp', { get: () => playerHp, set: (v) => { playerHp = v; } });
  Object.defineProperty(TV, 'playerHunger', { get: () => playerHunger, set: (v) => { playerHunger = v; } });
  Object.defineProperty(TV, 'playerOxygen', { get: () => playerOxygen, set: (v) => { playerOxygen = v; } });
  Object.defineProperty(TV, 'playerXp', { get: () => playerXp, set: (v) => { playerXp = v; } });
  Object.defineProperty(TV, 'playerLevel', { get: () => playerLevel, set: (v) => { playerLevel = v; } });
  Object.defineProperty(TV, 'isUnderwater', { get: () => isUnderwater });
  Object.defineProperty(TV, 'isFlying', { get: () => isFlying, set: (v) => { isFlying = v; } });
  Object.defineProperty(TV, 'spawnPoint', { get: () => spawnPoint, set: (v) => { spawnPoint = v; } });
  Object.defineProperty(TV, 'fallStartY', { get: () => fallStartY, set: (v) => { fallStartY = v; } });

  TV.initPlayerVisuals = initPlayerVisuals;
  TV.updateHeldItemModel = updateHeldItemModel;
  TV.updatePlayer = updatePlayer;
  TV.playerTakeDamage = playerTakeDamage;
  TV.addPlayerXp = addPlayerXp;
  TV.respawnPlayer = respawnPlayer;
  TV.initInputListeners = initInputListeners;
})(window.TV);
