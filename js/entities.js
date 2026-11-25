// ============================================================
// TERRAVOX — Mobs, Villagers, Projectiles, Drops & Particles
// ============================================================
window.TV = window.TV || {};

(function (TV) {
  const { BLOCKS, B, WORLD_H, createItemIconCanvas, atlasTexture, tileAverageColors, sounds } = TV;

  const particles = [];
  const droppedItems = [];
  const projectiles = [];
  const mobs = [];

  const partBoxGeo = new THREE.BoxGeometry(0.11, 0.11, 0.11);
  const partMatCache = new Map();
  function getPartMat(colorHex, basic = false) {
    const key = (basic ? 'b_' : 'l_') + colorHex;
    let m = partMatCache.get(key);
    if (!m) {
      m = basic ? new THREE.MeshBasicMaterial({ color: colorHex }) : new THREE.MeshLambertMaterial({ color: colorHex });
      partMatCache.set(key, m);
    }
    return m;
  }

  function spawnColorParticle(x, y, z, colorHex, velVec = null, life = 0.6) {
    const pMesh = new THREE.Mesh(partBoxGeo, getPartMat(colorHex, true));
    pMesh.position.set(x, y, z);
    TV.scene.add(pMesh);
    particles.push({
      mesh: pMesh,
      vel: velVec || new THREE.Vector3((Math.random() - 0.5) * 2.5, Math.random() * 2.5 + 0.8, (Math.random() - 0.5) * 2.5),
      life,
      gravity: 11
    });
  }

  function spawnBlockParticles(bx, by, bz, blockId) {
    const def = BLOCKS[blockId];
    const tile = def?.tile ?? def?.tiles?.top ?? def?.tiles?.all ?? 2;
    const baseCol = tileAverageColors[tile] ?? 0x866043;
    const mat = getPartMat(baseCol, false);
    for (let i = 0; i < 10; i++) {
      const pMesh = new THREE.Mesh(partBoxGeo, mat);
      pMesh.position.set(bx + 0.2 + Math.random() * 0.6, by + 0.2 + Math.random() * 0.6, bz + 0.2 + Math.random() * 0.6);
      TV.scene.add(pMesh);
      particles.push({
        mesh: pMesh,
        vel: new THREE.Vector3((Math.random() - 0.5) * 4.2, Math.random() * 3.8 + 1.2, (Math.random() - 0.5) * 4.2),
        life: 0.42 + Math.random() * 0.3,
        gravity: 15
      });
    }
  }

  function spawnHeartParticles(x, y, z) {
    for (let i = 0; i < 6; i++) {
      spawnColorParticle(
        x + (Math.random() - 0.5) * 0.6,
        y + 0.7 + Math.random() * 0.5,
        z + (Math.random() - 0.5) * 0.6,
        0xf43f5e,
        new THREE.Vector3((Math.random() - 0.5) * 0.6, 1.4 + Math.random() * 0.8, (Math.random() - 0.5) * 0.6),
        0.75
      );
    }
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        TV.scene.remove(p.mesh);
        particles.splice(i, 1);
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += dt * 4;
      p.mesh.rotation.y += dt * 3;
    }
  }

  function spawnDroppedItem(x, y, z, id, count = 1) {
    if (!id || id <= 0) return;
    const grp = new THREE.Group();
    const cvs = createItemIconCanvas(id);
    const tex = new THREE.CanvasTexture(cvs);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;

    if (id < 100 && !BLOCKS[id]?.plant && !BLOCKS[id]?.torch) {
      const cube = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.24, 0.24),
        new THREE.MeshLambertMaterial({ map: tex })
      );
      grp.add(cube);
    } else {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
      sprite.scale.set(0.36, 0.36, 0.36);
      grp.add(sprite);
    }

    grp.position.set(x, y + 0.2, z);
    TV.scene.add(grp);

    droppedItems.push({
      group: grp,
      id,
      count,
      pos: grp.position,
      vel: new THREE.Vector3((Math.random() - 0.5) * 1.8, 2.8, (Math.random() - 0.5) * 1.8),
      age: 0,
      baseY: y
    });
  }

  function updateDroppedItems(dt, world) {
    const pPos = TV.camera.position;
    for (let i = droppedItems.length - 1; i >= 0; i--) {
      const it = droppedItems[i];
      it.age += dt;
      if (it.age > 180) {
        TV.scene.remove(it.group);
        droppedItems.splice(i, 1);
        continue;
      }

      it.group.rotation.y += 2.2 * dt;
      it.vel.y -= 13 * dt;
      it.pos.x += it.vel.x * dt;
      it.pos.z += it.vel.z * dt;
      it.pos.y += it.vel.y * dt;
      it.vel.x *= 0.92;
      it.vel.z *= 0.92;

      const bx = Math.floor(it.pos.x);
      const by = Math.floor(it.pos.y - 0.14);
      const bz = Math.floor(it.pos.z);
      const blk = world.getBlock(bx, by, bz);
      if (blk !== 0 && blk !== B.WATER && !BLOCKS[blk]?.plant) {
        it.pos.y = by + 1.16;
        it.vel.y = 0;
      } else if (blk === B.WATER) {
        it.vel.y = Math.max(it.vel.y, 0.8);
      }

      // Bob gently visually
      const child = it.group.children[0];
      if (child) child.position.y = Math.sin(it.age * 3.5) * 0.05;

      const dist = it.pos.distanceTo(pPos);
      if (it.age > 0.45 && dist < 2.4 && TV.playerHp > 0) {
        const dir = new THREE.Vector3().subVectors(pPos, it.pos).normalize();
        it.pos.addScaledVector(dir, 7.5 * dt);
        if (dist < 0.75) {
          if (TV.addItemToInventory(it.id, it.count)) {
            sounds.playPickup();
            TV.scene.remove(it.group);
            droppedItems.splice(i, 1);
            TV.updateHotbarUI();
          }
        }
      }
    }
  }

  // Arrows (Player Bow & Skeletons)
  function spawnArrow(origin, dir, speed, damage, fromPlayer = true) {
    const grp = new THREE.Group();
    const shaft = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, 0.55),
      new THREE.MeshLambertMaterial({ color: 0x785028 })
    );
    const tip = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.09, 0.12),
      new THREE.MeshLambertMaterial({ color: 0x94a3b8 })
    );
    tip.position.z = -0.3;
    grp.add(shaft, tip);
    grp.position.copy(origin);
    grp.lookAt(origin.clone().add(dir));
    TV.scene.add(grp);

    projectiles.push({
      mesh: grp,
      pos: grp.position,
      vel: dir.clone().normalize().multiplyScalar(speed),
      damage,
      fromPlayer,
      life: 6.0
    });
  }

  function updateProjectiles(dt, world) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const pr = projectiles[i];
      pr.life -= dt;
      if (pr.life <= 0) {
        TV.scene.remove(pr.mesh);
        projectiles.splice(i, 1);
        continue;
      }

      pr.vel.y -= 13.5 * dt;
      const nextPos = pr.pos.clone().addScaledVector(pr.vel, dt);
      pr.mesh.lookAt(nextPos);
      pr.pos.copy(nextPos);

      // Hit solid block
      const b = world.getBlock(Math.floor(pr.pos.x), Math.floor(pr.pos.y), Math.floor(pr.pos.z));
      if (b !== 0 && b !== B.WATER && !BLOCKS[b]?.plant) {
        TV.scene.remove(pr.mesh);
        projectiles.splice(i, 1);
        continue;
      }

      if (pr.fromPlayer) {
        let hit = false;
        for (const m of mobs) {
          if (m.isDead) continue;
          const mCenter = m.pos.clone().add(new THREE.Vector3(0, m.height * 0.55, 0));
          if (pr.pos.distanceTo(mCenter) < m.radius + 0.35) {
            m.takeDamage(pr.damage, pr.vel.clone().normalize());
            hit = true;
            break;
          }
        }
        if (hit) {
          TV.scene.remove(pr.mesh);
          projectiles.splice(i, 1);
        }
      } else {
        // Hit player
        const pCenter = TV.camera.position.clone().add(new THREE.Vector3(0, -0.7, 0));
        if (pr.pos.distanceTo(pCenter) < 0.7 && TV.gameMode !== 'creative') {
          TV.playerTakeDamage(pr.damage, 'Von einem Skelett erschossen');
          TV.scene.remove(pr.mesh);
          projectiles.splice(i, 1);
        }
      }
    }
  }

  // ==========================================================
  // MOB CLASS (Pig, Cow, Sheep, Chicken, Villager, Zombie, Skeleton, Spider, Creeper)
  // ==========================================================
  class Mob {
    constructor(type, x, y, z) {
      this.type = type;
      this.pos = new THREE.Vector3(x, y, z);
      this.vel = new THREE.Vector3();
      this.yaw = Math.random() * Math.PI * 2;
      this.isHostile = (type === 'zombie' || type === 'skeleton' || type === 'spider' || type === 'creeper');
      this.hp = (type === 'chicken') ? 6 : (type === 'pig' || type === 'sheep' ? 10 : (type === 'cow' ? 12 : (type === 'spider' ? 16 : 20)));
      this.maxHp = this.hp;
      this.radius = (type === 'chicken') ? 0.25 : 0.38;
      this.height = (type === 'chicken') ? 0.7 : (this.isHostile || type === 'villager' ? 1.8 : 1.0);
      this.isDead = false;
      this.hurtTimer = 0;
      this.changeDirTimer = Math.random() * 2;
      this.attackCooldown = 0;
      this.walkCycle = 0;
      this.breedCooldown = 0;
      this.fuseTimer = 0;
      this.burnTimer = 0;

      this.group = new THREE.Group();
      this.parts = []; // Store { mesh, baseColor } for clean hurt flash restore!
      TV.scene.add(this.group);
      this.createModel();
    }

    _addPart(w, h, d, colorHex, x, y, z, parent = this.group) {
      const mat = new THREE.MeshLambertMaterial({ color: colorHex });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      this.parts.push({ mesh, baseColor: colorHex });
      return mesh;
    }

    createModel() {
      this.legs = [];
      this.wings = null;

      if (this.type === 'pig') {
        this._addPart(0.68, 0.52, 0.92, 0xf4929e, 0, 0.48, 0);
        this.head = this._addPart(0.46, 0.44, 0.44, 0xf4929e, 0, 0.66, 0.58);
        this._addPart(0.24, 0.16, 0.10, 0xe86f82, 0, 0.59, 0.82);
        this._addPart(0.07, 0.07, 0.03, 0x1e293b, -0.14, 0.72, 0.80);
        this._addPart(0.07, 0.07, 0.03, 0x1e293b, 0.14, 0.72, 0.80);
        [[-0.2,0.18,0.28],[0.2,0.18,0.28],[-0.2,0.18,-0.28],[0.2,0.18,-0.28]].forEach(([lx,ly,lz]) => {
          this.legs.push(this._addPart(0.18, 0.36, 0.18, 0xe87b89, lx, ly, lz));
        });
      } else if (this.type === 'cow') {
        this._addPart(0.76, 0.66, 1.08, 0x4d3728, 0, 0.62, 0);
        this._addPart(0.78, 0.44, 0.46, 0xe5e7eb, 0, 0.64, 0.08);
        this.head = this._addPart(0.48, 0.48, 0.46, 0x4d3728, 0, 0.88, 0.64);
        this._addPart(0.32, 0.18, 0.10, 0x9ca3af, 0, 0.77, 0.88);
        this._addPart(0.08, 0.18, 0.08, 0xe5e7eb, -0.24, 1.16, 0.62);
        this._addPart(0.08, 0.18, 0.08, 0xe5e7eb, 0.24, 1.16, 0.62);
        this._addPart(0.07, 0.07, 0.03, 0x111827, -0.15, 0.95, 0.88);
        this._addPart(0.07, 0.07, 0.03, 0x111827, 0.15, 0.95, 0.88);
        [[-0.24,0.24,0.34],[0.24,0.24,0.34],[-0.24,0.24,-0.34],[0.24,0.24,-0.34]].forEach(([lx,ly,lz]) => {
          this.legs.push(this._addPart(0.18, 0.48, 0.18, 0x2b2018, lx, ly, lz));
        });
      } else if (this.type === 'sheep') {
        this._addPart(0.74, 0.62, 0.96, 0xf1f5f9, 0, 0.56, 0);
        this.head = this._addPart(0.42, 0.40, 0.44, 0xe8cfb8, 0, 0.76, 0.56);
        this._addPart(0.46, 0.18, 0.34, 0xf1f5f9, 0, 0.92, 0.52);
        this._addPart(0.07, 0.07, 0.03, 0x111827, -0.12, 0.80, 0.79);
        this._addPart(0.07, 0.07, 0.03, 0x111827, 0.12, 0.80, 0.79);
        [[-0.22,0.20,0.30],[0.22,0.20,0.30],[-0.22,0.20,-0.30],[0.22,0.20,-0.30]].forEach(([lx,ly,lz]) => {
          this.legs.push(this._addPart(0.16, 0.40, 0.16, 0xd6b89c, lx, ly, lz));
        });
      } else if (this.type === 'chicken') {
        this._addPart(0.36, 0.34, 0.44, 0xffffff, 0, 0.34, 0);
        this.head = this._addPart(0.24, 0.28, 0.24, 0xffffff, 0, 0.58, 0.22);
        this._addPart(0.14, 0.08, 0.14, 0xf59e0b, 0, 0.55, 0.36);
        this._addPart(0.08, 0.10, 0.08, 0xdc2626, 0, 0.46, 0.32);
        this._addPart(0.05, 0.05, 0.02, 0x111827, -0.08, 0.62, 0.34);
        this._addPart(0.05, 0.05, 0.02, 0x111827, 0.08, 0.62, 0.34);
        this.wings = [
          this._addPart(0.06, 0.22, 0.32, 0xe2e8f0, -0.21, 0.36, 0),
          this._addPart(0.06, 0.22, 0.32, 0xe2e8f0, 0.21, 0.36, 0)
        ];
        this.legs.push(this._addPart(0.06, 0.20, 0.06, 0xf59e0b, -0.09, 0.10, 0));
        this.legs.push(this._addPart(0.06, 0.20, 0.06, 0xf59e0b, 0.09, 0.10, 0));
      } else if (this.type === 'villager') {
        this._addPart(0.46, 0.72, 0.32, 0x6b4628, 0, 0.94, 0);
        this._addPart(0.50, 0.22, 0.36, 0x4b2f19, 0, 0.92, 0.10); // folded arms
        this.head = this._addPart(0.42, 0.52, 0.42, 0xd9a787, 0, 1.56, 0);
        this._addPart(0.12, 0.20, 0.14, 0xc79272, 0, 1.46, 0.24); // nose
        this._addPart(0.48, 0.10, 0.48, 0xd4a938, 0, 1.82, 0); // farmer straw hat!
        this._addPart(0.07, 0.07, 0.03, 0x15803d, -0.11, 1.60, 0.21);
        this._addPart(0.07, 0.07, 0.03, 0x15803d, 0.11, 1.60, 0.21);
        this.legs.push(this._addPart(0.19, 0.58, 0.22, 0x52341d, -0.11, 0.29, 0));
        this.legs.push(this._addPart(0.19, 0.58, 0.22, 0x52341d, 0.11, 0.29, 0));
      } else if (this.type === 'zombie') {
        this.head = this._addPart(0.46, 0.46, 0.46, 0x4e7c38, 0, 1.54, 0);
        this._addPart(0.07, 0.06, 0.03, 0x111111, -0.11, 1.58, 0.24);
        this._addPart(0.07, 0.06, 0.03, 0x111111, 0.11, 1.58, 0.24);
        this._addPart(0.48, 0.66, 0.26, 0x267580, 0, 0.98, 0);
        this._addPart(0.18, 0.18, 0.64, 0x4e7c38, -0.34, 1.18, 0.26);
        this._addPart(0.18, 0.18, 0.64, 0x4e7c38, 0.34, 1.18, 0.26);
        this.legs.push(this._addPart(0.18, 0.64, 0.18, 0x273563, -0.14, 0.32, 0));
        this.legs.push(this._addPart(0.18, 0.64, 0.18, 0x273563, 0.14, 0.32, 0));
      } else if (this.type === 'skeleton') {
        this.head = this._addPart(0.44, 0.44, 0.44, 0xe2e8f0, 0, 1.54, 0);
        this._addPart(0.08, 0.07, 0.03, 0x1e293b, -0.11, 1.56, 0.23);
        this._addPart(0.08, 0.07, 0.03, 0x1e293b, 0.11, 1.56, 0.23);
        this._addPart(0.38, 0.64, 0.20, 0xcbd5e1, 0, 0.98, 0);
        this._addPart(0.12, 0.12, 0.58, 0xe2e8f0, -0.26, 1.18, 0.24);
        this._addPart(0.12, 0.12, 0.58, 0xe2e8f0, 0.26, 1.18, 0.24);
        this._addPart(0.06, 0.52, 0.14, 0x7c5329, 0.26, 1.18, 0.56); // bow
        this.legs.push(this._addPart(0.12, 0.64, 0.12, 0xcbd5e1, -0.12, 0.32, 0));
        this.legs.push(this._addPart(0.12, 0.64, 0.12, 0xcbd5e1, 0.12, 0.32, 0));
      } else if (this.type === 'spider') {
        this._addPart(0.68, 0.38, 0.72, 0x1f242d, 0, 0.34, -0.15);
        this.head = this._addPart(0.44, 0.36, 0.42, 0x262c36, 0, 0.36, 0.38);
        this._addPart(0.08, 0.06, 0.04, 0xef4444, -0.11, 0.40, 0.60);
        this._addPart(0.08, 0.06, 0.04, 0xef4444, 0.11, 0.40, 0.60);
        for (let i = 0; i < 4; i++) {
          const zOff = -0.35 + i * 0.24;
          this.legs.push(this._addPart(0.42, 0.09, 0.09, 0x14171c, -0.46, 0.22, zOff));
          this.legs.push(this._addPart(0.42, 0.09, 0.09, 0x14171c, 0.46, 0.22, zOff));
        }
      } else if (this.type === 'creeper') {
        this.head = this._addPart(0.46, 0.46, 0.46, 0x4ca64c, 0, 1.46, 0);
        this._addPart(0.09, 0.09, 0.03, 0x111111, -0.11, 1.52, 0.24);
        this._addPart(0.09, 0.09, 0.03, 0x111111, 0.11, 1.52, 0.24);
        this._addPart(0.18, 0.14, 0.03, 0x111111, 0, 1.36, 0.24);
        this._addPart(0.44, 0.72, 0.26, 0x3b8e3b, 0, 0.88, 0);
        [[-0.14,0.26,0.16],[0.14,0.26,0.16],[-0.14,0.26,-0.16],[0.14,0.26,-0.16]].forEach(([lx,ly,lz]) => {
          this.legs.push(this._addPart(0.20, 0.52, 0.20, 0x2f752f, lx, ly, lz));
        });
      }
    }

    _restoreColors() {
      for (const p of this.parts) p.mesh.material.color.setHex(p.baseColor);
    }

    takeDamage(amt, knockDir = new THREE.Vector3(0, 0, 0)) {
      if (this.isDead) return;
      this.hp -= amt;
      this.hurtTimer = 0.25;
      this.vel.addScaledVector(knockDir, 5.2);
      this.vel.y = 3.8;

      if (this.type === 'pig') sounds.playPig();
      else if (this.type === 'cow') sounds.playCow();
      else if (this.type === 'sheep') sounds.playSheep();
      else if (this.type === 'chicken') sounds.playChicken();
      else if (this.type === 'villager') sounds.playVillager();
      else if (this.type === 'skeleton') sounds.playSkeleton();
      else if (this.type === 'spider') sounds.playSpider();
      else sounds.playZombie();

      for (const p of this.parts) p.mesh.material.color.setRGB(1, 0.25, 0.25);

      if (this.hp <= 0) this.die();
    }

    die() {
      if (this.isDead) return;
      this.isDead = true;
      const x = this.pos.x, y = this.pos.y, z = this.pos.z;

      if (this.type === 'pig') {
        spawnDroppedItem(x, y, z, 108, 1 + Math.floor(Math.random() * 2));
      } else if (this.type === 'cow') {
        spawnDroppedItem(x, y, z, 111, 1 + Math.floor(Math.random() * 2));
        spawnDroppedItem(x, y, z, 112, 1);
      } else if (this.type === 'sheep') {
        spawnDroppedItem(x, y, z, 143, 1 + Math.floor(Math.random() * 2));
        spawnDroppedItem(x, y, z, B.WOOL_WHITE, 1);
      } else if (this.type === 'chicken') {
        spawnDroppedItem(x, y, z, 113, 1);
        spawnDroppedItem(x, y, z, 114, 1 + Math.floor(Math.random() * 2));
      } else if (this.type === 'zombie') {
        spawnDroppedItem(x, y, z, 109, 1 + Math.floor(Math.random() * 2));
        if (Math.random() < 0.15) spawnDroppedItem(x, y, z, 115, 1);
        TV.addPlayerXp(5);
      } else if (this.type === 'skeleton') {
        spawnDroppedItem(x, y, z, 132, 1 + Math.floor(Math.random() * 2));
        spawnDroppedItem(x, y, z, 180, 1 + Math.floor(Math.random() * 3));
        TV.addPlayerXp(6);
      } else if (this.type === 'spider') {
        spawnDroppedItem(x, y, z, 133, 1 + Math.floor(Math.random() * 2));
        TV.addPlayerXp(5);
      } else if (this.type === 'creeper') {
        spawnDroppedItem(x, y, z, 134, 1 + Math.floor(Math.random() * 2));
        TV.addPlayerXp(7);
      }

      TV.scene.remove(this.group);
      this.parts.forEach(p => { p.mesh.geometry.dispose(); p.mesh.material.dispose(); });
    }

    tryFeed(itemId) {
      if (this.breedCooldown > 0) return false;
      const likes =
        (this.type === 'cow' || this.type === 'sheep') && itemId === 136 ||
        (this.type === 'pig' && itemId === 138) ||
        (this.type === 'chicken' && itemId === 137);
      if (!likes) return false;

      this.breedCooldown = 25;
      spawnHeartParticles(this.pos.x, this.pos.y, this.pos.z);
      sounds.playEat();
      if (mobs.length < 36) {
        const baby = new Mob(this.type, this.pos.x + 0.5, this.pos.y, this.pos.z + 0.5);
        baby.group.scale.set(0.6, 0.6, 0.6);
        mobs.push(baby);
      }
      return true;
    }

    update(dt, playerPos, sunSin, world) {
      if (this.isDead) return;

      if (this.hurtTimer > 0) {
        this.hurtTimer -= dt;
        if (this.hurtTimer <= 0) this._restoreColors();
      }
      this.attackCooldown = Math.max(0, this.attackCooldown - dt);
      this.breedCooldown = Math.max(0, this.breedCooldown - dt);
      this.changeDirTimer -= dt;

      const distToPlayer = this.pos.distanceTo(playerPos);
      if (distToPlayer > 72) return; // Pause distant AI

      const heldId = TV.inventory[TV.activeHotbarSlot]?.id;
      const isTempted =
        ((this.type === 'cow' || this.type === 'sheep') && heldId === 136) ||
        (this.type === 'pig' && heldId === 138) ||
        (this.type === 'chicken' && heldId === 137);

      // Undead burn in direct daylight
      if ((this.type === 'zombie' || this.type === 'skeleton') && sunSin > 0.18) {
        const bx = Math.floor(this.pos.x), bz = Math.floor(this.pos.z);
        const topY = Math.floor(this.pos.y + 1.8);
        if (world.getBlock(bx, Math.floor(this.pos.y), bz) !== B.WATER) {
          let exposed = true;
          for (let cy = topY; cy < WORLD_H; cy++) {
            const blk = world.getBlock(bx, cy, bz);
            if (blk !== 0 && blk !== B.WATER && !BLOCKS[blk]?.plant) { exposed = false; break; }
          }
          if (exposed) {
            this.burnTimer += dt;
            if (Math.random() < 0.35) {
              spawnColorParticle(this.pos.x + (Math.random() - 0.5) * 0.4, this.pos.y + 0.6 + Math.random(), this.pos.z + (Math.random() - 0.5) * 0.4, 0xf97316, null, 0.3);
            }
            if (this.burnTimer >= 0.9) {
              this.burnTimer = 0;
              this.takeDamage(2);
            }
          }
        }
      }

      // AI Movement Decisions
      const canTargetPlayer = TV.gameMode !== 'creative' && TV.playerHp > 0;
      if (this.isHostile && canTargetPlayer && distToPlayer < 18 && (this.type !== 'spider' || sunSin < 0.1)) {
        const dx = playerPos.x - this.pos.x;
        const dz = playerPos.z - this.pos.z;
        this.yaw = Math.atan2(dx, dz);

        if (this.type === 'skeleton') {
          const moveSpd = distToPlayer > 9 ? 2.1 : (distToPlayer < 5 ? -1.4 : 0);
          const dir = new THREE.Vector2(dx, dz).normalize();
          this.vel.x = dir.x * moveSpd;
          this.vel.z = dir.y * moveSpd;
          if (distToPlayer < 15 && this.attackCooldown <= 0) {
            const origin = this.pos.clone().add(new THREE.Vector3(0, 1.45, 0));
            const target = playerPos.clone().add(new THREE.Vector3(0, -0.35, 0));
            const aim = target.sub(origin).normalize();
            aim.y += 0.08;
            spawnArrow(origin, aim, 22, 3, false);
            sounds.playBow();
            this.attackCooldown = 2.1;
          }
        } else if (this.type === 'creeper') {
          const dir = new THREE.Vector2(dx, dz).normalize();
          this.vel.x = dir.x * 2.2;
          this.vel.z = dir.y * 2.2;
          if (distToPlayer < 2.8) {
            if (this.fuseTimer === 0) sounds.playFuse();
            this.fuseTimer += dt;
            const pulse = Math.sin(this.fuseTimer * 28) > 0;
            for (const p of this.parts) p.mesh.material.color.setHex(pulse ? 0xffffff : p.baseColor);
            if (this.fuseTimer >= 1.45) {
              this._explode(world, playerPos);
              return;
            }
          } else if (this.fuseTimer > 0) {
            this.fuseTimer = 0;
            this._restoreColors();
          }
        } else {
          const spd = this.type === 'spider' ? 3.1 : 2.3;
          const dir = new THREE.Vector2(dx, dz).normalize();
          this.vel.x = dir.x * spd;
          this.vel.z = dir.y * spd;
          if (distToPlayer < 1.55 && this.attackCooldown <= 0) {
            TV.playerTakeDamage(this.type === 'spider' ? 2 : 3, `Von einem ${this.type === 'spider' ? 'Spinnenangriff' : 'Zombie'} besiegt`);
            this.attackCooldown = 1.15;
          }
        }
      } else if (isTempted && distToPlayer < 12 && distToPlayer > 2.2) {
        const dx = playerPos.x - this.pos.x;
        const dz = playerPos.z - this.pos.z;
        this.yaw = Math.atan2(dx, dz);
        const dir = new THREE.Vector2(dx, dz).normalize();
        this.vel.x = dir.x * 1.75;
        this.vel.z = dir.y * 1.75;
      } else {
        if (this.changeDirTimer <= 0) {
          this.yaw = Math.random() * Math.PI * 2;
          this.changeDirTimer = 2.5 + Math.random() * 4.5;
          if (distToPlayer < 18 && Math.random() < 0.25) {
            if (this.type === 'pig') sounds.playPig();
            else if (this.type === 'cow') sounds.playCow();
            else if (this.type === 'sheep') sounds.playSheep();
            else if (this.type === 'chicken') sounds.playChicken();
            else if (this.type === 'villager') sounds.playVillager();
          }
        }
        const wanderSpd = this.type === 'villager' ? 1.05 : 1.15;
        this.vel.x = Math.sin(this.yaw) * wanderSpd;
        this.vel.z = Math.cos(this.yaw) * wanderSpd;
      }

      // Water buoyancy & lava hazard
      const curBlk = world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.3), Math.floor(this.pos.z));
      if (curBlk === B.WATER) {
        this.vel.y = Math.min(3.0, this.vel.y + 18 * dt);
      } else {
        this.vel.y -= (this.type === 'chicken' ? 10 : 20) * dt;
      }
      if (curBlk === B.LAVA) {
        this.takeDamage(4);
      }

      // Auto-jump over 1-block steps
      const aheadX = Math.floor(this.pos.x + Math.sin(this.yaw) * 0.55);
      const aheadZ = Math.floor(this.pos.z + Math.cos(this.yaw) * 0.55);
      const feetY = Math.floor(this.pos.y);
      const blkAhead = world.getBlock(aheadX, feetY, aheadZ);
      const blkAbove = world.getBlock(aheadX, feetY + 1, aheadZ);
      if (blkAhead !== 0 && blkAhead !== B.WATER && !BLOCKS[blkAhead]?.plant &&
          (blkAbove === 0 || BLOCKS[blkAbove]?.plant)) {
        this.vel.y = 6.0;
      }

      // Axis-separated simple AABB movement
      this.pos.x += this.vel.x * dt;
      if (this._collides(world)) {
        this.pos.x -= this.vel.x * dt;
        this.yaw += Math.PI * 0.6;
      }
      this.pos.z += this.vel.z * dt;
      if (this._collides(world)) {
        this.pos.z -= this.vel.z * dt;
        this.yaw += Math.PI * 0.6;
      }

      this.pos.y += this.vel.y * dt;
      const by = Math.floor(this.pos.y);
      const bx = Math.floor(this.pos.x);
      const bz = Math.floor(this.pos.z);
      const footBlk = world.getBlock(bx, by, bz);
      if (footBlk !== 0 && footBlk !== B.WATER && footBlk !== B.LAVA && !BLOCKS[footBlk]?.plant) {
        this.pos.y = by + 1.0;
        this.vel.y = 0;
      }

      this.group.position.copy(this.pos);
      this.group.rotation.y = this.yaw;

      // Animations
      const speed = Math.hypot(this.vel.x, this.vel.z);
      if (speed > 0.15) {
        this.walkCycle += dt * 8.5;
        const a = Math.sin(this.walkCycle) * 0.5;
        if (this.legs.length === 2) {
          this.legs[0].rotation.x = a;
          this.legs[1].rotation.x = -a;
        } else if (this.legs.length >= 4) {
          for (let i = 0; i < this.legs.length; i++) {
            this.legs[i].rotation.x = (i % 2 === 0 ? a : -a) * (this.type === 'spider' ? 0.35 : 1);
          }
        }
      }
      if (this.wings) {
        const flap = Math.abs(this.vel.y) > 0.6 ? Math.sin(performance.now() * 0.025) * 0.7 : 0;
        this.wings[0].rotation.z = flap;
        this.wings[1].rotation.z = -flap;
      }
    }

    _collides(world) {
      const r = this.radius;
      const minX = Math.floor(this.pos.x - r), maxX = Math.floor(this.pos.x + r);
      const minZ = Math.floor(this.pos.z - r), maxZ = Math.floor(this.pos.z + r);
      const minY = Math.floor(this.pos.y + 0.1), maxY = Math.floor(this.pos.y + this.height - 0.1);
      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          for (let z = minZ; z <= maxZ; z++) {
            const b = world.getBlock(x, y, z);
            if (b !== 0 && b !== B.WATER && b !== B.LAVA && !BLOCKS[b]?.plant) return true;
          }
        }
      }
      return false;
    }

    _explode(world, playerPos) {
      this.isDead = true;
      TV.scene.remove(this.group);
      sounds.playExplosion();
      const cx = Math.floor(this.pos.x), cy = Math.floor(this.pos.y + 0.5), cz = Math.floor(this.pos.z);
      for (let i = 0; i < 24; i++) {
        spawnColorParticle(this.pos.x, this.pos.y + 0.5, this.pos.z, i % 2 === 0 ? 0xf97316 : 0x475569,
          new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 6 + 2, (Math.random() - 0.5) * 8), 0.75);
      }
      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
          for (let dz = -2; dz <= 2; dz++) {
            if (dx * dx + dy * dy + dz * dz <= 5) {
              const blk = world.getBlock(cx + dx, cy + dy, cz + dz);
              if (blk !== 0 && !BLOCKS[blk]?.unbreakable && blk !== B.WATER) {
                world.setBlock(cx + dx, cy + dy, cz + dz, 0, 0, true);
              }
            }
          }
        }
      }
      world.rebuildArea(cx, cz);
      const pDist = this.pos.distanceTo(playerPos);
      if (pDist < 5.5 && TV.gameMode !== 'creative') {
        const dmg = Math.max(2, Math.round((5.5 - pDist) * 2.8));
        TV.playerTakeDamage(dmg, 'Explosion durch einen Mooswicht');
      }
    }
  }

  function clearEntities() {
    mobs.forEach(m => TV.scene.remove(m.group));
    mobs.length = 0;
    droppedItems.forEach(it => TV.scene.remove(it.group));
    droppedItems.length = 0;
    projectiles.forEach(pr => TV.scene.remove(pr.mesh));
    projectiles.length = 0;
    particles.forEach(p => TV.scene.remove(p.mesh));
    particles.length = 0;
  }

  function spawnInitialMobs(world, spawnX, spawnZ) {
    const animals = ['pig', 'cow', 'sheep', 'chicken'];
    for (let i = 0; i < 12; i++) {
      const mx = spawnX - 28 + Math.random() * 56;
      const mz = spawnZ - 28 + Math.random() * 56;
      const my = world.findSurfaceY(Math.floor(mx), Math.floor(mz));
      if (my > TV.WATER_LEVEL) {
        mobs.push(new Mob(animals[i % animals.length], mx, my, mz));
      }
    }
    // Spawn villagers inside nearby villages!
    const rx = Math.floor(spawnX / 128), rz = Math.floor(spawnZ / 128);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const v = world.gen.getVillageForRegion(rx + dx, rz + dz);
        if (v) {
          v.villagerSpawns.forEach(sp => {
            const sy = world.findSurfaceY(Math.floor(sp.x), Math.floor(sp.z));
            mobs.push(new Mob('villager', sp.x, sy, sp.z));
          });
        }
      }
    }
  }

  let spawnCheckTimer = 0;
  function updateMobs(dt, sunSin, world) {
    spawnCheckTimer += dt;
    if (spawnCheckTimer >= 3.0) {
      spawnCheckTimer = 0;
      const pPos = TV.camera.position;

      // Despawn far-away hostile mobs
      for (let i = mobs.length - 1; i >= 0; i--) {
        if (mobs[i].isHostile && mobs[i].pos.distanceTo(pPos) > 65) {
          TV.scene.remove(mobs[i].group);
          mobs.splice(i, 1);
        }
      }

      if (sunSin < -0.15) {
        const hostileCnt = mobs.filter(m => m.isHostile && !m.isDead).length;
        if (hostileCnt < 10) {
          const angle = Math.random() * Math.PI * 2;
          const dist = 16 + Math.random() * 18;
          const sx = Math.floor(pPos.x + Math.cos(angle) * dist);
          const sz = Math.floor(pPos.z + Math.sin(angle) * dist);
          const sy = world.findSurfaceY(sx, sz);
          if (sy > TV.WATER_LEVEL && world.getBlock(sx, sy, sz) === 0) {
            const pool = ['zombie', 'zombie', 'skeleton', 'spider', 'creeper'];
            mobs.push(new Mob(pool[Math.floor(Math.random() * pool.length)], sx + 0.5, sy, sz + 0.5));
          }
        }
      } else if (sunSin > 0.15) {
        const peacefulCnt = mobs.filter(m => !m.isHostile && m.type !== 'villager' && !m.isDead).length;
        if (peacefulCnt < 14) {
          const angle = Math.random() * Math.PI * 2;
          const dist = 16 + Math.random() * 18;
          const sx = Math.floor(pPos.x + Math.cos(angle) * dist);
          const sz = Math.floor(pPos.z + Math.sin(angle) * dist);
          const sy = world.findSurfaceY(sx, sz);
          if (sy > TV.WATER_LEVEL && world.getBlock(sx, sy - 1, sz) === B.GRASS) {
            const pool = ['pig', 'cow', 'sheep', 'chicken'];
            mobs.push(new Mob(pool[Math.floor(Math.random() * pool.length)], sx + 0.5, sy, sz + 0.5));
          }
        }
      }
    }

    for (let i = mobs.length - 1; i >= 0; i--) {
      const m = mobs[i];
      m.update(dt, TV.camera.position, sunSin, world);
      if (m.isDead) mobs.splice(i, 1);
    }
  }

  TV.particles = particles;
  TV.droppedItems = droppedItems;
  TV.projectiles = projectiles;
  TV.mobs = mobs;
  TV.Mob = Mob;
  TV.spawnColorParticle = spawnColorParticle;
  TV.spawnBlockParticles = spawnBlockParticles;
  TV.spawnHeartParticles = spawnHeartParticles;
  TV.updateParticles = updateParticles;
  TV.spawnDroppedItem = spawnDroppedItem;
  TV.updateDroppedItems = updateDroppedItems;
  TV.spawnArrow = spawnArrow;
  TV.updateProjectiles = updateProjectiles;
  TV.spawnInitialMobs = spawnInitialMobs;
  TV.updateMobs = updateMobs;
  TV.clearEntities = clearEntities;
})(window.TV);
