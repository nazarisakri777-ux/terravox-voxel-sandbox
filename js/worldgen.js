// ============================================================
// TERRAVOX — Seeded Overworld Generator (Biomes, Caves, Structures)
// ============================================================
window.TV = window.TV || {};

(function (TV) {
  const { B, SeededNoise, hash2D, hash3D, hashSeedString } = TV;

  const CHUNK_SIZE = 16;
  const WORLD_H = 96;
  const WATER_LEVEL = 32;

  const BIOME_NAMES = {
    ocean: 'Ozean',
    beach: 'Strand',
    river: 'Fluss',
    plains: 'Grasland',
    forest: 'Laubwald',
    taiga: 'Kiefernwald',
    mountains: 'Gebirge',
    desert: 'Wüste'
  };

  class WorldGenerator {
    constructor(seedInput = 'TERRAVOX', preset = 'default') {
      this.seedStr = String(seedInput || 'TERRAVOX');
      this.seed = hashSeedString(this.seedStr);
      this.preset = preset;

      this.contNoise = new SeededNoise(this.seed ^ 0x1a2b3c4d);
      this.detailNoise = new SeededNoise(this.seed ^ 0x55aa33cc);
      this.tempNoise = new SeededNoise(this.seed ^ 0x77119933);
      this.humidNoise = new SeededNoise(this.seed ^ 0x2468ace0);
      this.riverNoise = new SeededNoise(this.seed ^ 0x13579bdf);
      this.caveNoiseA = new SeededNoise(this.seed ^ 0x9e3779b9);
      this.caveNoiseB = new SeededNoise(this.seed ^ 0x85ebca6b);
      this.cavernNoise = new SeededNoise(this.seed ^ 0xc2b2ae35);
      this.strataNoise = new SeededNoise(this.seed ^ 0x27d4eb2f);

      this.villageCache = new Map();
    }

    getSurfaceInfo(wx, wz) {
      const ampScale = this.preset === 'amplified' ? 1.55 : (this.preset === 'islands' ? 0.72 : 1.0);
      const contShift = this.preset === 'islands' ? -0.22 : 0.0;

      // Continentalness & base terrain height
      const cont = this.contNoise.fbm2D(wx * 0.0045, wz * 0.0045, 4) + contShift;
      const hills = this.detailNoise.fbm2D(wx * 0.018, wz * 0.018, 4);
      const ridge = this.detailNoise.ridge2D(wx * 0.0085, wz * 0.0085, 3);

      const temp = this.tempNoise.fbm2D(wx * 0.0038, wz * 0.0038, 3);
      const humid = this.humidNoise.fbm2D(wx * 0.0038, wz * 0.0038, 3);
      const riverVal = Math.abs(this.riverNoise.fbm2D(wx * 0.0055, wz * 0.0055, 3));

      let baseH = WATER_LEVEL + 4 + cont * 24 * ampScale + hills * 9 * ampScale;
      if (cont > 0.18) {
        const mFactor = Math.min(1, (cont - 0.18) * 3.0);
        baseH += ridge * 30 * mFactor * ampScale;
      }

      // Carve rivers smoothly
      let isRiver = false;
      if (riverVal < 0.055 && baseH > WATER_LEVEL - 4 && baseH < WATER_LEVEL + 26) {
        const t = 1 - riverVal / 0.055;
        const targetRiverH = WATER_LEVEL - 3.5;
        baseH = baseH * (1 - t * t) + targetRiverH * (t * t);
        if (riverVal < 0.032) isRiver = true;
      }

      let height = Math.round(Math.max(5, Math.min(WORLD_H - 14, baseH)));

      // Classify biome
      let biome = 'plains';
      if (height < WATER_LEVEL - 2 && !isRiver) {
        biome = 'ocean';
      } else if (isRiver && height <= WATER_LEVEL + 1) {
        biome = 'river';
      } else if (height <= WATER_LEVEL + 2 && cont < 0.15) {
        biome = 'beach';
      } else if (height >= 54 || (cont > 0.28 && ridge > 0.52)) {
        biome = 'mountains';
      } else if (temp > 0.24 && humid < -0.08) {
        biome = 'desert';
      } else if (temp < -0.15) {
        biome = 'taiga';
      } else if (humid > 0.06) {
        biome = 'forest';
      } else {
        biome = 'plains';
      }

      return { height, biome, temp, humid, cont };
    }

    // Deterministic Village Blueprints on 128x128 block region grid
    getVillageForRegion(rx, rz) {
      const key = `${rx},${rz}`;
      if (this.villageCache.has(key)) return this.villageCache.get(key);

      // Force a scenic village near (0,0) in region (0,0) if land allows, otherwise ~42% of regions
      const rRoll = hash2D(rx, rz, this.seed ^ 0x445566);
      const isOriginRegion = (rx === 0 && rz === 0);
      if (!isOriginRegion && rRoll > 0.44) {
        this.villageCache.set(key, null);
        return null;
      }

      const vx = rx * 128 + 40 + Math.floor(hash2D(rx + 11, rz - 7, this.seed) * 44);
      const vz = rz * 128 + 40 + Math.floor(hash2D(rx - 5, rz + 17, this.seed) * 44);
      const centerInfo = this.getSurfaceInfo(vx, vz);

      if (centerInfo.biome === 'ocean' || centerInfo.biome === 'mountains' || centerInfo.height <= WATER_LEVEL + 1) {
        // Fallback search within region for dry land
        let found = null;
        for (let ox = 28; ox <= 96 && !found; ox += 16) {
          for (let oz = 28; oz <= 96 && !found; oz += 16) {
            const tx = rx * 128 + ox;
            const tz = rz * 128 + oz;
            const info = this.getSurfaceInfo(tx, tz);
            if ((info.biome === 'plains' || info.biome === 'forest' || info.biome === 'desert') &&
                info.height >= WATER_LEVEL + 2 && info.height <= WATER_LEVEL + 16) {
              found = { x: tx, z: tz, y: info.height, biome: info.biome };
            }
          }
        }
        if (!found) {
          this.villageCache.set(key, null);
          return null;
        }
        return this._buildVillageBlueprint(key, found.x, found.z, found.y, found.biome);
      }

      return this._buildVillageBlueprint(key, vx, vz, centerInfo.height, centerInfo.biome);
    }

    _buildVillageBlueprint(key, vx, vz, baseY, biome) {
      const isDesert = biome === 'desert';
      const wallMat = isDesert ? B.SANDSTONE : B.PLANKS_OAK;
      const baseMat = isDesert ? B.SANDSTONE : B.COBBLE;
      const logMat = isDesert ? B.SANDSTONE : B.LOG_OAK;
      const roofStair = isDesert ? B.STAIRS_STONE : B.STAIRS_OAK;

      const structures = [];
      // Central Well / Square at (vx, vz)
      structures.push({
        type: 'well',
        x: vx - 2, z: vz - 2, y: baseY, w: 5, d: 5,
        baseMat, logMat, roofStair
      });

      // Road segments along +X, -X, +Z, -Z
      const plots = [
        { type: 'house', dx: -14, dz: -11, w: 7, d: 7, facing: 0 },
        { type: 'house', dx: 7, dz: -12, w: 7, d: 7, facing: 0 },
        { type: 'farm',  dx: -15, dz: 6, w: 9, d: 9, facing: 2 },
        { type: 'stall', dx: 6, dz: 6, w: 5, d: 5, facing: 2 },
        { type: 'tower', dx: 16, dz: -3, w: 5, d: 5, facing: 1 },
        { type: 'house', dx: -4, dz: -22, w: 7, d: 6, facing: 0 }
      ];

      for (let i = 0; i < plots.length; i++) {
        const p = plots[i];
        const sx = vx + p.dx;
        const sz = vz + p.dz;
        const info = this.getSurfaceInfo(sx + Math.floor(p.w / 2), sz + Math.floor(p.d / 2));
        if (info.height <= WATER_LEVEL + 1 || info.height >= WATER_LEVEL + 24) continue;
        structures.push({
          ...p,
          x: sx,
          z: sz,
          y: info.height,
          wallMat, baseMat, logMat, roofStair,
          seedOffset: i * 17
        });
      }

      const blueprint = {
        vx, vz, baseY, biome,
        minX: vx - 22, maxX: vx + 25,
        minZ: vz - 26, maxZ: vz + 20,
        structures,
        villagerSpawns: [
          { x: vx + 0.5, y: baseY + 1, z: vz + 4.5 },
          { x: vx - 8.5, y: baseY + 1, z: vz + 4.5 },
          { x: vx + 8.5, y: baseY + 1, z: vz + 3.5 }
        ]
      };
      this.villageCache.set(key, blueprint);
      return blueprint;
    }

    generateChunk(chunk) {
      const startX = chunk.cx * CHUNK_SIZE;
      const startZ = chunk.cz * CHUNK_SIZE;
      const surfaceHeights = new Int16Array(CHUNK_SIZE * CHUNK_SIZE);
      const surfaceBiomes = new Array(CHUNK_SIZE * CHUNK_SIZE);

      // 1. Base terrain column & ore/cave generation
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          const wx = startX + lx;
          const wz = startZ + lz;
          const { height, biome } = this.getSurfaceInfo(wx, wz);
          surfaceHeights[lx + lz * CHUNK_SIZE] = height;
          surfaceBiomes[lx + lz * CHUNK_SIZE] = biome;
          if (chunk.biomeMap) chunk.biomeMap[lx + lz * CHUNK_SIZE] = biome;

          for (let y = 0; y < WORLD_H; y++) {
            const idx = lx + y * CHUNK_SIZE + lz * CHUNK_SIZE * WORLD_H;

            if (y === 0) {
              chunk.voxels[idx] = B.BEDROCK;
              continue;
            }
            if (y <= 2 && hash3D(wx, y, wz, this.seed) < (y === 1 ? 0.65 : 0.25)) {
              chunk.voxels[idx] = B.BEDROCK;
              continue;
            }

            if (y > height) {
              if (y <= WATER_LEVEL) {
                if (biome === 'mountains' && y === WATER_LEVEL && height < WATER_LEVEL) {
                  chunk.voxels[idx] = B.ICE;
                } else {
                  chunk.voxels[idx] = B.WATER;
                }
              }
              continue;
            }

            // Determine surface & subsurface block
            let block = B.STONE;
            if (y === height) {
              if (biome === 'desert' || biome === 'beach' || (biome === 'ocean' && y >= WATER_LEVEL - 4) || (biome === 'river' && y <= WATER_LEVEL)) {
                block = B.SAND;
              } else if (biome === 'ocean' || biome === 'river') {
                block = hash2D(wx, wz, this.seed + 7) > 0.65 ? B.CLAY : B.GRAVEL;
              } else if (biome === 'mountains') {
                if (y >= 62) block = B.SNOW;
                else if (y >= 52) block = hash2D(wx, wz, this.seed + 9) > 0.45 ? B.STONE : B.GRAVEL;
                else block = B.GRASS;
              } else {
                block = B.GRASS;
              }
            } else if (y >= height - 3) {
              if (biome === 'desert' || biome === 'beach') {
                block = y >= height - 2 ? B.SAND : B.SANDSTONE;
              } else if (biome === 'mountains' && y >= 50) {
                block = B.STONE;
              } else if (biome === 'ocean') {
                block = B.GRAVEL;
              } else {
                block = B.DIRT;
              }
            } else {
              // Deep underground stone strata & ores
              const strata = this.strataNoise.noise3D(wx * 0.08, y * 0.08, wz * 0.08);
              if (y <= 12) {
                block = B.DEEPSLATE;
              } else if (strata > 0.42) {
                block = B.GRANITE;
              } else if (strata < -0.42) {
                block = B.ANDESITE;
              } else if (strata > 0.25 && strata < 0.30 && y < height - 6) {
                block = B.GRAVEL;
              } else {
                block = B.STONE;
              }

              // Clustered Ore Veins (using coarser 3D grid hash + noise)
              const oreNoise = this.strataNoise.noise3D(wx * 0.22 + 50, y * 0.22, wz * 0.22 - 30);
              if (y <= 14 && oreNoise > 0.72) {
                block = B.DIAMOND_ORE;
              } else if (y <= 28 && oreNoise < -0.66) {
                block = B.GOLD_ORE;
              } else if (y <= 48 && oreNoise > 0.56 && oreNoise <= 0.72 && hash3D(wx >> 1, y >> 1, wz >> 1, this.seed + 22) > 0.45) {
                block = B.IRON_ORE;
              } else if (y <= 60 && y >= 12 && oreNoise < -0.53 && oreNoise >= -0.66) {
                block = B.COPPER_ORE;
              } else if (y <= 70 && hash3D(wx >> 1, y >> 1, wz >> 1, this.seed + 33) > 0.88 && oreNoise > 0.25) {
                block = B.COAL_ORE;
              }
            }

            // 3D Cave Carving (Spaghetti tunnels + Cheese caverns)
            if (y >= 3 && y <= height) {
              // Do not punch caves right through ocean floor underwater
              const underOcean = (height < WATER_LEVEL - 1 && y > height - 4);
              if (!underOcean) {
                const c1 = this.caveNoiseA.noise3D(wx * 0.042, y * 0.058, wz * 0.042);
                const c2 = this.caveNoiseB.noise3D(wx * 0.042 + 120, y * 0.058, wz * 0.042 - 80);
                const tunnel = (c1 * c1 + c2 * c2) < 0.022;
                const cavern = y < 38 && this.cavernNoise.noise3D(wx * 0.024, y * 0.038, wz * 0.024) > 0.56;
                if (tunnel || cavern) {
                  if (y <= 7) {
                    block = B.LAVA;
                  } else {
                    block = B.AIR;
                  }
                }
              }
            }

            chunk.voxels[idx] = block;
          }
        }
      }

      // 2. Subterranean Cave Torches & Underground Waterfalls (sparse atmospheric detail!)
      for (let lx = 2; lx < CHUNK_SIZE - 2; lx += 4) {
        for (let lz = 2; lz < CHUNK_SIZE - 2; lz += 4) {
          const wx = startX + lx;
          const wz = startZ + lz;
          const surf = surfaceHeights[lx + lz * CHUNK_SIZE];
          for (let y = 10; y < surf - 6; y++) {
            const idx = lx + y * CHUNK_SIZE + lz * CHUNK_SIZE * WORLD_H;
            const below = chunk.voxels[idx - CHUNK_SIZE];
            if (chunk.voxels[idx] === B.AIR && (below === B.STONE || below === B.DEEPSLATE || below === B.GRANITE)) {
              const r = hash3D(wx, y, wz, this.seed + 91);
              if (r < 0.015) {
                chunk.voxels[idx] = B.TORCH;
              }
            }
          }
        }
      }

      // 3. Cross-chunk Deterministic Trees (fast hash pre-filter before noise lookup!)
      for (let tx = startX - 3; tx <= startX + CHUNK_SIZE + 2; tx++) {
        for (let tz = startZ - 3; tz <= startZ + CHUNK_SIZE + 2; tz++) {
          const roll = hash2D(tx, tz, this.seed ^ 0x998877);
          if (roll >= 0.032) continue;

          // Keep immediate spawn (0..4, 0..4) clear of trunks
          if (Math.abs(tx) <= 3 && Math.abs(tz) <= 3) continue;

          const info = this.getSurfaceInfo(tx, tz);
          if (info.height < WATER_LEVEL + 2) continue;
          if (info.biome === 'desert' || info.biome === 'ocean' || info.biome === 'beach') continue;
          if (info.biome === 'mountains' && info.height > 54) continue;

          const treeProb = info.biome === 'forest' ? 0.032 : (info.biome === 'taiga' ? 0.026 : (info.biome === 'plains' ? 0.004 : 0.008));
          if (roll >= treeProb) continue;

          // Make sure trunk base is still solid grass (not carved by a cave opening!)
          const c1 = this.caveNoiseA.noise3D(tx * 0.042, info.height * 0.058, tz * 0.042);
          const c2 = this.caveNoiseB.noise3D(tx * 0.042 + 120, info.height * 0.058, tz * 0.042 - 80);
          if (c1 * c1 + c2 * c2 < 0.022) continue;

          const treeVariant = hash2D(tx + 3, tz - 5, this.seed + 44);
          let kind = 'oak';
          if (info.biome === 'taiga') kind = 'spruce';
          else if (info.biome === 'forest' && treeVariant > 0.58) kind = 'birch';

          this._stampTreeSlice(chunk, tx, info.height, tz, kind, startX, startZ);
        }
      }

      // 4. Vegetation (Tall Grass, Ferns, Flowers, Cacti, Sugar Cane)
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let lz = 0; lz < CHUNK_SIZE; lz++) {
          const wx = startX + lx;
          const wz = startZ + lz;
          const h = surfaceHeights[lx + lz * CHUNK_SIZE];
          const biome = surfaceBiomes[lx + lz * CHUNK_SIZE];
          if (h + 1 >= WORLD_H) continue;

          const surfIdx = lx + h * CHUNK_SIZE + lz * CHUNK_SIZE * WORLD_H;
          const aboveIdx = lx + (h + 1) * CHUNK_SIZE + lz * CHUNK_SIZE * WORLD_H;
          const surfBlock = chunk.voxels[surfIdx];
          if (chunk.voxels[aboveIdx] !== B.AIR) continue;

          const vegR = hash2D(wx, wz, this.seed ^ 0x334455);
          if (surfBlock === B.GRASS) {
            const grassChance = (biome === 'plains' || biome === 'forest') ? 0.16 : 0.06;
            if (vegR < grassChance) {
              const kindR = hash2D(wx * 3, wz * 3, this.seed + 19);
              if (kindR < 0.72) {
                chunk.voxels[aboveIdx] = (biome === 'taiga' && kindR > 0.35) ? B.FERN : B.TALL_GRASS;
              } else if (kindR < 0.80) {
                chunk.voxels[aboveIdx] = B.FLOWER_RED;
              } else if (kindR < 0.88) {
                chunk.voxels[aboveIdx] = B.FLOWER_WHITE;
              } else if (kindR < 0.94) {
                chunk.voxels[aboveIdx] = B.FLOWER_YELLOW;
              } else {
                chunk.voxels[aboveIdx] = B.FLOWER_BLUE;
              }
            }
          } else if (surfBlock === B.SAND && biome === 'desert' && h >= WATER_LEVEL + 2) {
            if (vegR < 0.008 && lx >= 1 && lx < CHUNK_SIZE - 1 && lz >= 1 && lz < CHUNK_SIZE - 1) {
              const ch = 2 + Math.floor(hash2D(wx, wz, this.seed + 71) * 2);
              for (let cy = 1; cy <= ch && h + cy < WORLD_H; cy++) {
                chunk.voxels[lx + (h + cy) * CHUNK_SIZE + lz * CHUNK_SIZE * WORLD_H] = B.CACTUS;
              }
            }
          } else if ((surfBlock === B.SAND || surfBlock === B.GRASS) && h === WATER_LEVEL + 1 && vegR < 0.04) {
            // Check adjacent water for Sugar Cane
            const wInfo1 = this.getSurfaceInfo(wx + 1, wz);
            const wInfo2 = this.getSurfaceInfo(wx - 1, wz);
            if (wInfo1.height < WATER_LEVEL || wInfo2.height < WATER_LEVEL) {
              const sh = 2 + Math.floor(hash2D(wx, wz, this.seed + 83) * 2);
              for (let sy = 1; sy <= sh && h + sy < WORLD_H; sy++) {
                chunk.voxels[lx + (h + sy) * CHUNK_SIZE + lz * CHUNK_SIZE * WORLD_H] = B.SUGARCANE;
              }
            }
          }
        }
      }

      // 5. Villages (overlapping nearby 128x128 regions)
      const rxBase = Math.floor(startX / 128);
      const rzBase = Math.floor(startZ / 128);
      for (let drx = -1; drx <= 1; drx++) {
        for (let drz = -1; drz <= 1; drz++) {
          const village = this.getVillageForRegion(rxBase + drx, rzBase + drz);
          if (!village) continue;
          if (startX + CHUNK_SIZE < village.minX || startX > village.maxX ||
              startZ + CHUNK_SIZE < village.minZ || startZ > village.maxZ) {
            continue;
          }
          this._stampVillageSlice(chunk, village, startX, startZ);
        }
      }
    }

    _setLocalIfInside(chunk, wx, y, wz, blockId, meta = 0, startX, startZ) {
      if (y < 1 || y >= WORLD_H) return;
      const lx = wx - startX;
      const lz = wz - startZ;
      if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE) return;
      const idx = lx + y * CHUNK_SIZE + lz * CHUNK_SIZE * WORLD_H;
      chunk.voxels[idx] = blockId;
      chunk.meta[idx] = meta;
    }

    _stampTreeSlice(chunk, tx, ty, tz, kind, startX, startZ) {
      const hRand = hash2D(tx, tz, this.seed + 101);
      if (kind === 'spruce') {
        const trunkH = 6 + Math.floor(hRand * 3);
        for (let dy = 1; dy <= trunkH; dy++) {
          this._setLocalIfInside(chunk, tx, ty + dy, tz, B.LOG_SPRUCE, 0, startX, startZ);
        }
        for (let dy = 2; dy <= trunkH + 2; dy++) {
          const rad = dy === trunkH + 2 ? 0 : (dy >= trunkH ? 1 : ((trunkH - dy) % 2 === 0 ? 2 : 1));
          for (let dx = -rad; dx <= rad; dx++) {
            for (let dz = -rad; dz <= rad; dz++) {
              if (dx === 0 && dz === 0 && dy <= trunkH) continue;
              if (rad === 2 && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;
              const lx = tx + dx - startX;
              const lz = tz + dz - startZ;
              if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE && ty + dy < WORLD_H) {
                const idx = lx + (ty + dy) * CHUNK_SIZE + lz * CHUNK_SIZE * WORLD_H;
                if (chunk.voxels[idx] === B.AIR) chunk.voxels[idx] = B.LEAVES_SPRUCE;
              }
            }
          }
        }
      } else {
        const logBlock = kind === 'birch' ? B.LOG_BIRCH : B.LOG_OAK;
        const leafBlock = kind === 'birch' ? B.LEAVES_BIRCH : B.LEAVES_OAK;
        const trunkH = 4 + Math.floor(hRand * 3);
        for (let dy = 1; dy <= trunkH; dy++) {
          this._setLocalIfInside(chunk, tx, ty + dy, tz, logBlock, 0, startX, startZ);
        }
        for (let ly = -2; ly <= 1; ly++) {
          const rad = ly >= 0 ? 1 : 2;
          for (let dx = -rad; dx <= rad; dx++) {
            for (let dz = -rad; dz <= rad; dz++) {
              if (Math.abs(dx) === rad && Math.abs(dz) === rad && hash3D(tx + dx, ty + trunkH + ly, tz + dz, this.seed) < 0.45) {
                continue;
              }
              const wy = ty + trunkH + ly;
              const lx = tx + dx - startX;
              const lz = tz + dz - startZ;
              if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE && wy < WORLD_H) {
                const idx = lx + wy * CHUNK_SIZE + lz * CHUNK_SIZE * WORLD_H;
                if (chunk.voxels[idx] === B.AIR) chunk.voxels[idx] = leafBlock;
              }
            }
          }
        }
      }
    }

    _stampVillageSlice(chunk, village, startX, startZ) {
      const setV = (wx, wy, wz, id, meta = 0) => this._setLocalIfInside(chunk, wx, wy, wz, id, meta, startX, startZ);

      // Stamp dirt path cross-roads hugging terrain
      for (let dx = -16; dx <= 16; dx++) {
        for (let w = -1; w <= 1; w++) {
          const px = village.vx + dx;
          const pz = village.vz + w;
          const info = this.getSurfaceInfo(px, pz);
          if (info.height >= WATER_LEVEL + 1) {
            setV(px, info.height, pz, B.DIRT_PATH);
            setV(px, info.height + 1, pz, B.AIR);
          }
        }
      }
      for (let dz = -20; dz <= 14; dz++) {
        for (let w = -1; w <= 1; w++) {
          const px = village.vx + w;
          const pz = village.vz + dz;
          const info = this.getSurfaceInfo(px, pz);
          if (info.height >= WATER_LEVEL + 1) {
            setV(px, info.height, pz, B.DIRT_PATH);
            setV(px, info.height + 1, pz, B.AIR);
          }
        }
      }

      // Stamp each structure
      for (const s of village.structures) {
        if (startX + CHUNK_SIZE < s.x - 2 || startX > s.x + s.w + 2 ||
            startZ + CHUNK_SIZE < s.z - 2 || startZ > s.z + s.d + 2) {
          continue;
        }

        if (s.type === 'well') {
          // Cobble / Sandstone well with water & lantern roof
          for (let dx = 0; dx < 5; dx++) {
            for (let dz = 0; dz < 5; dz++) {
              setV(s.x + dx, s.y - 1, s.z + dz, s.baseMat);
              setV(s.x + dx, s.y, s.z + dz, s.baseMat);
              const isRim = dx === 0 || dx === 4 || dz === 0 || dz === 4;
              const isCorner = (dx === 0 || dx === 4) && (dz === 0 || dz === 4);
              const isInner = dx >= 1 && dx <= 3 && dz >= 1 && dz <= 3;
              if (isInner && !(dx === 2 && dz === 2)) {
                setV(s.x + dx, s.y, s.z + dz, B.WATER);
                setV(s.x + dx, s.y + 1, s.z + dz, B.AIR);
              } else if (dx === 2 && dz === 2) {
                setV(s.x + dx, s.y, s.z + dz, B.WATER);
              }
              if (isRim) {
                setV(s.x + dx, s.y + 1, s.z + dz, isCorner ? s.logMat : B.COBBLE);
                if (isCorner) {
                  setV(s.x + dx, s.y + 2, s.z + dz, B.FENCE_OAK);
                  setV(s.x + dx, s.y + 3, s.z + dz, B.FENCE_OAK);
                }
              }
              setV(s.x + dx, s.y + 4, s.z + dz, B.PLANKS_OAK);
            }
          }
          setV(s.x + 2, s.y + 3, s.z + 2, B.LANTERN);
        } else if (s.type === 'farm') {
          // Irrigated Farm Plot (like Reference Image 2!)
          for (let dx = 0; dx < s.w; dx++) {
            for (let dz = 0; dz < s.d; dz++) {
              setV(s.x + dx, s.y - 1, s.z + dz, B.DIRT);
              setV(s.x + dx, s.y + 1, s.z + dz, B.AIR);
              const border = dx === 0 || dx === s.w - 1 || dz === 0 || dz === s.d - 1;
              if (border) {
                setV(s.x + dx, s.y, s.z + dz, B.LOG_OAK);
              } else if (dx === Math.floor(s.w / 2)) {
                setV(s.x + dx, s.y - 1, s.z + dz, B.COBBLE);
                setV(s.x + dx, s.y, s.z + dz, B.WATER);
              } else {
                setV(s.x + dx, s.y, s.z + dz, B.FARMLAND, 1);
                const crop = dx < Math.floor(s.w / 2) ? B.WHEAT_CROP : B.CARROT_CROP;
                const stage = Math.floor(hash2D(s.x + dx, s.z + dz, this.seed) * 4);
                setV(s.x + dx, s.y + 1, s.z + dz, crop, stage);
              }
            }
          }
          // Composter & Torch at corner
          setV(s.x, s.y + 1, s.z, B.COMPOSTER);
          setV(s.x + s.w - 1, s.y + 1, s.z, B.TORCH, 0);
        } else if (s.type === 'stall') {
          // Market Stall (like Reference Image 4 & 5!)
          for (let dx = 0; dx < s.w; dx++) {
            for (let dz = 0; dz < s.d; dz++) {
              setV(s.x + dx, s.y, s.z + dz, B.DIRT_PATH);
              setV(s.x + dx, s.y + 1, s.z + dz, B.AIR);
              setV(s.x + dx, s.y + 2, s.z + dz, B.AIR);
              const corner = (dx === 0 || dx === s.w - 1) && (dz === 0 || dz === s.d - 1);
              if (corner) {
                setV(s.x + dx, s.y + 1, s.z + dz, B.FENCE_OAK);
                setV(s.x + dx, s.y + 2, s.z + dz, B.FENCE_OAK);
              }
              setV(s.x + dx, s.y + 3, s.z + dz, (dx % 2 === 0) ? B.WOOL_YELLOW : B.WOOL_WHITE);
            }
          }
          setV(s.x + 1, s.y + 1, s.z + 1, B.CHEST, 2);
          setV(s.x + 2, s.y + 1, s.z + 1, B.HAY_BALE);
          setV(s.x + 3, s.y + 1, s.z + 1, B.CRAFTING_TABLE);
          setV(s.x + 2, s.y + 2, s.z + 2, B.LANTERN);
        } else if (s.type === 'tower') {
          // Stone Watchtower (Reference Image 5!)
          const hTower = 9;
          for (let dx = 0; dx < s.w; dx++) {
            for (let dz = 0; dz < s.d; dz++) {
              for (let y = -1; y <= 0; y++) setV(s.x + dx, s.y + y, s.z + dz, s.baseMat);
              const edge = dx === 0 || dx === s.w - 1 || dz === 0 || dz === s.d - 1;
              for (let dy = 1; dy <= hTower; dy++) {
                if (edge) {
                  const isDoor = (dx === 2 && dz === 0 && (dy === 1 || dy === 2));
                  const isWin = (dy === 5 && (dx === 2 || dz === 2));
                  if (isDoor) setV(s.x + dx, s.y + dy, s.z + dz, B.DOOR_OAK, dy === 2 ? 8 : 0);
                  else if (isWin) setV(s.x + dx, s.y + dy, s.z + dz, B.GLASS);
                  else setV(s.x + dx, s.y + dy, s.z + dz, dy % 4 === 0 ? B.STONE_BRICKS : s.baseMat);
                } else {
                  setV(s.x + dx, s.y + dy, s.z + dz, (dy === 4 || dy === 8) ? B.PLANKS_OAK : B.AIR);
                }
              }
              // Crenellations
              if (edge && (dx + dz) % 2 === 0) {
                setV(s.x + dx, s.y + hTower + 1, s.z + dz, s.baseMat);
              }
            }
          }
          setV(s.x + 2, s.y + hTower + 1, s.z + 2, B.LANTERN);
        } else if (s.type === 'house') {
          // Cozy Village House (Reference Image 2 & 5!)
          const wallH = 4;
          for (let dx = 0; dx < s.w; dx++) {
            for (let dz = 0; dz < s.d; dz++) {
              setV(s.x + dx, s.y - 1, s.z + dz, s.baseMat);
              setV(s.x + dx, s.y, s.z + dz, B.PLANKS_OAK);
              const edge = dx === 0 || dx === s.w - 1 || dz === 0 || dz === s.d - 1;
              const corner = (dx === 0 || dx === s.w - 1) && (dz === 0 || dz === s.d - 1);
              for (let dy = 1; dy <= wallH; dy++) {
                if (edge) {
                  const doorX = Math.floor(s.w / 2);
                  const isDoor = (dx === doorX && dz === s.d - 1 && (dy === 1 || dy === 2));
                  const isWindow = !corner && dy === 2 && ((dx === Math.floor(s.w / 2) && dz === 0) || (dz === Math.floor(s.d / 2)));
                  if (isDoor) {
                    setV(s.x + dx, s.y + dy, s.z + dz, B.DOOR_OAK, dy === 2 ? 8 : 0);
                  } else if (isWindow) {
                    setV(s.x + dx, s.y + dy, s.z + dz, B.GLASS);
                  } else if (corner) {
                    setV(s.x + dx, s.y + dy, s.z + dz, s.logMat);
                  } else {
                    setV(s.x + dx, s.y + dy, s.z + dz, dy === 1 ? s.baseMat : s.wallMat);
                  }
                } else {
                  setV(s.x + dx, s.y + dy, s.z + dz, B.AIR);
                }
              }
            }
          }
          // Pitched Stair Roof
          const halfW = Math.floor(s.w / 2);
          for (let r = 0; r <= halfW; r++) {
            const ry = s.y + wallH + r;
            for (let dz = -1; dz <= s.d; dz++) {
              setV(s.x + r, ry, s.z + dz, s.roofStair, 3);
              if (s.w - 1 - r !== r) {
                setV(s.x + s.w - 1 - r, ry, s.z + dz, s.roofStair, 1);
              } else {
                setV(s.x + r, ry, s.z + dz, B.PLANKS_OAK);
              }
              // Fill gable triangles
              if (dz === 0 || dz === s.d - 1) {
                for (let fx = r + 1; fx < s.w - 1 - r; fx++) {
                  setV(s.x + fx, ry, s.z + dz, s.wallMat);
                }
              }
            }
          }
          // Interior Furnishings (Crafting Table, Furnace, Bed, Torch, Chest)
          setV(s.x + 1, s.y + 1, s.z + 1, B.FURNACE, 0);
          setV(s.x + 2, s.y + 1, s.z + 1, B.CRAFTING_TABLE);
          setV(s.x + s.w - 2, s.y + 1, s.z + 1, B.CHEST, 0);
          setV(s.x + 1, s.y + 1, s.z + s.d - 2, B.BED);
          setV(s.x + 1, s.y + 3, s.z + 2, B.TORCH, 2);
          setV(s.x + Math.floor(s.w / 2) + 1, s.y + 2, s.z + s.d, B.TORCH, 3);
        }
      }
    }
  }

  TV.CHUNK_SIZE = CHUNK_SIZE;
  TV.WORLD_H = WORLD_H;
  TV.WATER_LEVEL = WATER_LEVEL;
  TV.BIOME_NAMES = BIOME_NAMES;
  TV.WorldGenerator = WorldGenerator;
})(window.TV);
