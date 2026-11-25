// ============================================================
// TERRAVOX — Procedural 16x16 Pixel-Art Atlas & Item Icons
// ============================================================
window.TV = window.TV || {};

(function (TV) {
  const { TILES: T, BLOCKS, ITEMS } = TV;
  const TILE_SIZE = 16;
  const ATLAS_TILES = 16; // 16x16 grid -> 256x256 px

  const atlasCanvas = document.createElement('canvas');
  atlasCanvas.width = ATLAS_TILES * TILE_SIZE;
  atlasCanvas.height = ATLAS_TILES * TILE_SIZE;
  const atlasCtx = atlasCanvas.getContext('2d');
  const tileAverageColors = new Array(256).fill(0x888888);

  function pxHash(x, y, s = 1) {
    return TV.hash2D(x, y, s);
  }

  function hexToRgb(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function drawTile(tileIdx, fn) {
    const tx = (tileIdx % ATLAS_TILES) * TILE_SIZE;
    const ty = Math.floor(tileIdx / ATLAS_TILES) * TILE_SIZE;
    const img = atlasCtx.createImageData(TILE_SIZE, TILE_SIZE);
    const d = img.data;

    function setPx(x, y, r, g, b, a = 255) {
      if (x < 0 || x >= 16 || y < 0 || y >= 16) return;
      const i = (y * 16 + x) * 4;
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;
    }
    function setHex(x, y, hex, a = 255) {
      const [r, g, b] = hexToRgb(hex);
      setPx(x, y, r, g, b, a);
    }
    function fillNoise(pal, seed, a = 255) {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          setHex(x, y, pal[Math.floor(pxHash(x, y, seed) * pal.length)], a);
        }
      }
    }

    fn(setPx, setHex, fillNoise);
    atlasCtx.putImageData(img, tx, ty);

    // Compute average opaque color for block-break particles
    let sr = 0, sg = 0, sb = 0, cnt = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 80) {
        sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; cnt++;
      }
    }
    if (cnt > 0) {
      const r = Math.round(sr / cnt), g = Math.round(sg / cnt), b = Math.round(sb / cnt);
      tileAverageColors[tileIdx] = (r << 16) | (g << 8) | b;
    }
  }

  // --- Terrain & Natural Tiles ---
  drawTile(T.GRASS_TOP, (s, h, fill) => {
    fill(['#5e9634', '#558b2f', '#68a33a', '#4d7f29', '#70ad40'], 101);
    for (let i = 0; i < 16; i++) {
      const x = Math.floor(pxHash(i, 3, 102) * 16);
      const y = Math.floor(pxHash(i, 7, 102) * 16);
      h(x, y, '#7bc048');
    }
  });

  drawTile(T.GRASS_SIDE, (s, h, fill) => {
    fill(['#855e40', '#735035', '#61422b', '#946a49'], 103);
    const greens = ['#5e9634', '#558b2f', '#6ca83d', '#497926'];
    for (let x = 0; x < 16; x++) {
      const depth = 2 + Math.floor(pxHash(x, 0, 104) * 3);
      for (let y = 0; y <= depth; y++) {
        h(x, y, greens[Math.floor(pxHash(x, y, 105) * greens.length)]);
      }
      if (pxHash(x, 5, 106) > 0.45) h(x, depth + 1, '#497926');
    }
  });

  drawTile(T.DIRT, (s, h, fill) => {
    fill(['#855e40', '#735035', '#61422b', '#946a49', '#523622'], 107);
    for (let i = 0; i < 10; i++) {
      h(Math.floor(pxHash(i, 1, 108) * 16), Math.floor(pxHash(i, 2, 108) * 16), '#a17858');
    }
  });

  drawTile(T.DIRT_PATH_TOP, (s, h, fill) => {
    fill(['#9f844e', '#917644', '#ae9258', '#836a3c'], 109);
  });

  drawTile(T.DIRT_PATH_SIDE, (s, h, fill) => {
    fill(['#855e40', '#735035', '#61422b'], 110);
    for (let x = 0; x < 16; x++) {
      h(x, 0, '#9f844e');
      h(x, 1, pxHash(x, 1, 111) > 0.4 ? '#917644' : '#735035');
    }
  });

  drawTile(T.FARMLAND_DRY, (s, h, fill) => {
    fill(['#7c5638', '#6b492e', '#8c6343'], 112);
    for (let y = 0; y < 16; y += 4) {
      for (let x = 0; x < 16; x++) h(x, y, '#4a311d');
    }
  });

  drawTile(T.FARMLAND_WET, (s, h, fill) => {
    fill(['#4f341f', '#422a18', '#5c3d25'], 113);
    for (let y = 0; y < 16; y += 4) {
      for (let x = 0; x < 16; x++) h(x, y, '#2c1b0e');
    }
  });

  drawTile(T.STONE, (s, h, fill) => {
    fill(['#7a7a7a', '#6f6f6f', '#848484', '#666666', '#8d8d8d'], 114);
    for (let y = 0; y < 16; y += 3) {
      const sx = Math.floor(pxHash(y, 4, 115) * 12);
      for (let dx = 0; dx < 4; dx++) h((sx + dx) % 16, y, '#606060');
    }
  });

  drawTile(T.COBBLE, (s, h) => {
    const base = ['#767676', '#838383', '#6b6b6b'];
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const row = Math.floor(y / 4);
        const off = (row % 2) * 3;
        const seam = (y % 4 === 0) || ((x + off) % 6 === 0);
        if (seam) h(x, y, '#474747');
        else if ((y % 4 === 1) || ((x + off) % 6 === 1)) h(x, y, '#9b9b9b');
        else h(x, y, base[Math.floor(pxHash(x, y, 116) * base.length)]);
      }
    }
  });

  drawTile(T.MOSSY_COBBLE, (s, h) => {
    const base = ['#707070', '#7e7e7e', '#656565'];
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const row = Math.floor(y / 4);
        const off = (row % 2) * 3;
        const seam = (y % 4 === 0) || ((x + off) % 6 === 0);
        if (seam) h(x, y, pxHash(x, y, 117) > 0.45 ? '#3d6924' : '#464646');
        else if (pxHash(x, y, 118) > 0.72) h(x, y, '#4c7f2d');
        else h(x, y, base[Math.floor(pxHash(x, y, 119) * base.length)]);
      }
    }
  });

  drawTile(T.GRANITE, (s, h, fill) => {
    fill(['#9e6c5a', '#8d5d4d', '#ad7966', '#7d5042', '#b98875'], 120);
  });

  drawTile(T.ANDESITE, (s, h, fill) => {
    fill(['#828687', '#747879', '#919596', '#696c6d', '#9ea2a3'], 121);
  });

  drawTile(T.DEEPSLATE, (s, h, fill) => {
    fill(['#48494d', '#3e3f43', '#525358', '#333438', '#5b5c62'], 122);
    for (let y = 1; y < 16; y += 4) {
      for (let x = 0; x < 16; x++) if (pxHash(x, y, 123) > 0.3) h(x, y, '#2b2c30');
    }
  });

  drawTile(T.BEDROCK, (s, h, fill) => {
    fill(['#181818', '#2a2a2a', '#3b3b3b', '#121212', '#4c4c4c'], 124);
  });

  drawTile(T.SAND, (s, h, fill) => {
    fill(['#dfd19f', '#d5c693', '#e7dab0', '#cbb985'], 125);
  });

  drawTile(T.SANDSTONE_TOP, (s, h, fill) => {
    fill(['#dbc98e', '#d1bf84', '#e3d39d'], 126);
  });

  drawTile(T.SANDSTONE_SIDE, (s, h, fill) => {
    fill(['#d6c387', '#cbb77a', '#e0ce96'], 127);
    for (let x = 0; x < 16; x++) {
      h(x, 0, '#e8d9a6'); h(x, 1, '#e0ce96');
      h(x, 4, '#b8a369'); h(x, 10, '#b8a369');
    }
  });

  drawTile(T.GRAVEL, (s, h, fill) => {
    fill(['#827e7d', '#736f6e', '#928e8d', '#64605f', '#a29e9d'], 128);
  });

  drawTile(T.CLAY, (s, h, fill) => {
    fill(['#9da5b1', '#9199a5', '#aab1bc', '#868d98'], 129);
  });

  drawTile(T.SNOW, (s, h, fill) => {
    fill(['#f1f5f9', '#e6eef7', '#ffffff', '#dce7f3'], 130);
  });

  drawTile(T.GRASS_SNOW_SIDE, (s, h, fill) => {
    fill(['#855e40', '#735035', '#61422b'], 131);
    for (let x = 0; x < 16; x++) {
      const depth = 3 + Math.floor(pxHash(x, 1, 132) * 3);
      for (let y = 0; y <= depth; y++) h(x, y, y === depth ? '#dbeafe' : '#f8fafc');
    }
  });

  drawTile(T.ICE, (s, h, fill) => {
    fill(['#8fd0ff', '#7fc4f7', '#a6dcff'], 133, 215);
    for (let i = 0; i < 6; i++) {
      h(2 + i, 2 + i, '#e0f2fe', 235);
      h(12 - i, 4 + i, '#e0f2fe', 230);
    }
  });

  // --- Wood & Leaves ---
  function drawLogSide(tileIdx, pal, seed) {
    drawTile(tileIdx, (s, h) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const streak = Math.floor((pxHash(Math.floor(x / 2), y, seed) + (x % 2) * 0.35) * pal.length) % pal.length;
          h(x, y, pal[streak]);
        }
      }
    });
  }
  function drawLogTop(tileIdx, bark, rings) {
    drawTile(tileIdx, (s, h) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const d = Math.hypot(x - 7.5, y - 7.5);
          if (d >= 6.8) h(x, y, bark);
          else if (d >= 5.0) h(x, y, rings[0]);
          else if (d >= 3.2) h(x, y, rings[1]);
          else h(x, y, rings[2]);
        }
      }
    });
  }

  drawLogSide(T.LOG_OAK_SIDE, ['#695131', '#584327', '#785d39', '#48351e'], 140);
  drawLogTop(T.LOG_OAK_TOP, '#584327', ['#9c7b4d', '#b38f5d', '#c5a06e']);

  drawTile(T.LOG_BIRCH_SIDE, (s, h, fill) => {
    fill(['#ebe9e1', '#dfddd5', '#f5f4ef'], 141);
    [[2,3,4],[9,6,4],[1,10,3],[10,12,4],[5,14,3],[12,2,3]].forEach(([fx,fy,len]) => {
      for (let i = 0; i < len; i++) h((fx + i) % 16, fy, '#2d2d2d');
      h((fx + 1) % 16, (fy + 1) % 16, '#5a5955');
    });
  });
  drawLogTop(T.LOG_BIRCH_TOP, '#78766e', ['#b9b399', '#d2ccb2', '#e4dec7']);

  drawLogSide(T.LOG_SPRUCE_SIDE, ['#3b2817', '#2f1f11', '#48321e', '#26180c'], 142);
  drawLogTop(T.LOG_SPRUCE_TOP, '#2f1f11', ['#6b4c2d', '#7f5b37', '#946d45']);

  function drawPlanks(tileIdx, cols, seam, seed) {
    drawTile(tileIdx, (s, h) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const plankRow = Math.floor(y / 4);
          const vSeam = (plankRow % 2 === 0 && x === 7) || (plankRow % 2 === 1 && x === 14);
          if (y % 4 === 0 || vSeam) h(x, y, seam);
          else if (y % 4 === 1) h(x, y, cols[3]);
          else h(x, y, cols[Math.floor(pxHash(x, y, seed) * 3)]);
        }
      }
    });
  }
  drawPlanks(T.PLANKS_OAK, ['#a37d48', '#b28950', '#946f3d', '#c1995d'], '#634824', 143);
  drawPlanks(T.PLANKS_BIRCH, ['#d0c38e', '#dacd98', '#c3b57f', '#e5daaa'], '#96895a', 144);
  drawPlanks(T.PLANKS_SPRUCE, ['#6c4c2a', '#785530', '#5f4122', '#866139'], '#3e2913', 145);

  function drawLeaves(tileIdx, cols, seed) {
    drawTile(tileIdx, (s, h) => {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          if (pxHash(x, y, seed) > 0.24) {
            h(x, y, cols[Math.floor(pxHash(x, y, seed + 1) * cols.length)], 255);
          } else {
            s(x, y, 0, 0, 0, 0);
          }
        }
      }
    });
  }
  drawLeaves(T.LEAVES_OAK, ['#3d7e23', '#49922b', '#31681b', '#55a633'], 146);
  drawLeaves(T.LEAVES_BIRCH, ['#5a9638', '#68a842', '#4c802e', '#76b84d'], 148);
  drawLeaves(T.LEAVES_SPRUCE, ['#275229', '#306332', '#1e4220', '#38723b'], 150);

  // --- Crafting, Furnace, Chest, Glass, Bricks, Wool, Hay ---
  drawTile(T.CRAFTING_TOP, (s, h) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (x === 0 || x === 15 || y === 0 || y === 15) h(x, y, '#4a3217');
        else if (x === 5 || x === 10 || y === 5 || y === 10) h(x, y, '#634320');
        else h(x, y, (x + y) % 2 === 0 ? '#be8e52' : '#af8046');
      }
    }
  });
  drawTile(T.CRAFTING_SIDE, (s, h) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) h(x, y, (y === 0 || y === 15) ? '#4a3217' : '#a37d48');
    for (let i = 0; i < 6; i++) { h(3 + i, 4 + i, '#cbd5e1'); h(4 + i, 4 + i, '#475569'); }
    for (let x = 11; x <= 13; x++) for (let y = 4; y <= 11; y++) h(x, y, y < 7 ? '#94a3b8' : '#584327');
  });
  drawTile(T.CRAFTING_FRONT, (s, h) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) h(x, y, (y === 0 || y === 15) ? '#4a3217' : '#a37d48');
    for (let x = 2; x <= 13; x++) { h(x, 4, '#4a3217'); h(x, 10, '#4a3217'); }
    h(7, 6, '#e2e8f0'); h(8, 6, '#e2e8f0');
    h(7, 12, '#e2e8f0'); h(8, 12, '#e2e8f0');
  });

  drawTile(T.FURNACE_TOP, (s, h, fill) => {
    fill(['#6d6d6d', '#7a7a7a', '#616161'], 152);
    for (let i = 0; i < 16; i++) { h(i, 0, '#444'); h(i, 15, '#444'); h(0, i, '#444'); h(15, i, '#444'); }
  });
  drawTile(T.FURNACE_SIDE, (s, h, fill) => {
    fill(['#6d6d6d', '#7a7a7a', '#616161'], 153);
    for (let x = 0; x < 16; x++) { h(x, 5, '#4c4c4c'); h(x, 11, '#4c4c4c'); }
  });
  drawTile(T.FURNACE_FRONT_OFF, (s, h, fill) => {
    fill(['#6d6d6d', '#7a7a7a', '#616161'], 154);
    for (let x = 4; x <= 11; x++) for (let y = 3; y <= 7; y++) h(x, y, '#262626');
    for (let x = 4; x <= 11; x++) for (let y = 10; y <= 14; y++) h(x, y, '#1c1c1c');
    for (let x = 3; x <= 12; x++) h(x, 9, '#949494');
  });
  drawTile(T.FURNACE_FRONT_ON, (s, h, fill) => {
    fill(['#6d6d6d', '#7a7a7a', '#616161'], 154);
    for (let x = 4; x <= 11; x++) for (let y = 3; y <= 7; y++) h(x, y, '#262626');
    for (let x = 4; x <= 11; x++) for (let y = 10; y <= 14; y++) h(x, y, (y >= 12 || x === 7 || x === 8) ? '#fb923c' : '#ea580c');
    h(6, 13, '#fef08a'); h(7, 13, '#fef08a'); h(8, 12, '#fef08a'); h(9, 13, '#fef08a');
    for (let x = 3; x <= 12; x++) h(x, 9, '#949494');
  });

  drawTile(T.CHEST_TOP, (s, h) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const border = x <= 1 || x >= 14 || y <= 1 || y >= 14;
      h(x, y, border ? '#593b18' : '#a87636');
    }
  });
  drawTile(T.CHEST_SIDE, (s, h) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const border = x === 0 || x === 15 || y === 0 || y === 15 || y === 5;
      h(x, y, border ? '#4a3113' : '#9c6c30');
    }
  });
  drawTile(T.CHEST_FRONT, (s, h) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const border = x === 0 || x === 15 || y === 0 || y === 15 || y === 5;
      h(x, y, border ? '#4a3113' : '#a37133');
    }
    for (let x = 6; x <= 9; x++) for (let y = 4; y <= 7; y++) h(x, y, '#cbd5e1');
    h(7, 6, '#334155'); h(8, 6, '#334155');
  });

  drawTile(T.GLASS, (s, h) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (x === 0 || x === 15 || y === 0 || y === 15) h(x, y, '#bae6fd', 240);
        else if ((x === 3 && y === 3) || (x === 4 && y === 2) || (x === 11 && y === 12)) h(x, y, '#ffffff', 220);
        else s(x, y, 200, 240, 255, 28);
      }
    }
  });

  drawTile(T.BRICKS, (s, h) => {
    const cols = ['#9c4637', '#8c3c2e', '#ab5040'];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const off = (Math.floor(y / 4) % 2) * 4;
      if (y % 4 === 0 || (x + off) % 8 === 0) h(x, y, '#cbbda9');
      else h(x, y, cols[Math.floor(pxHash(x, y, 160) * cols.length)]);
    }
  });

  drawTile(T.STONE_BRICKS, (s, h) => {
    const cols = ['#7f7f7f', '#747474', '#898989'];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const off = (Math.floor(y / 8) % 2) * 8;
      if (y % 8 === 0 || (x + off) % 16 === 0) h(x, y, '#4e4e4e');
      else if (y % 8 === 1) h(x, y, '#969696');
      else h(x, y, cols[Math.floor(pxHash(x, y, 161) * cols.length)]);
    }
  });

  drawTile(T.WOOL_WHITE, (s, h, fill) => fill(['#f1f5f9', '#e2e8f0', '#f8fafc'], 162));
  drawTile(T.WOOL_YELLOW, (s, h, fill) => fill(['#facc15', '#eab308', '#fde047'], 163));

  drawTile(T.HAY_TOP, (s, h, fill) => fill(['#d4b445', '#c5a336', '#e0c253'], 164));
  drawTile(T.HAY_SIDE, (s, h, fill) => {
    fill(['#d4b445', '#c5a336', '#e0c253'], 165);
    for (let x = 0; x < 16; x++) {
      h(x, 4, '#b91c1c'); h(x, 5, '#991b1b');
      h(x, 11, '#b91c1c'); h(x, 12, '#991b1b');
    }
  });

  // --- Ores ---
  function drawOre(tileIdx, speckCols, seed) {
    drawTile(tileIdx, (s, h, fill) => {
      fill(['#7a7a7a', '#6f6f6f', '#848484', '#666666'], 114);
      const pts = [[3,3],[4,3],[4,4],[10,2],[11,3],[11,4],[6,8],[7,8],[7,9],[8,9],[12,11],[13,11],[3,12],[4,12]];
      pts.forEach(([ox, oy], i) => {
        h(ox, oy, speckCols[i % speckCols.length]);
        if (pxHash(ox, oy, seed) > 0.4 && ox + 1 < 16) h(ox + 1, oy, speckCols[(i + 1) % speckCols.length]);
      });
    });
  }
  drawOre(T.COAL_ORE, ['#1c1c1c', '#2b2b2b', '#111111'], 170);
  drawOre(T.COPPER_ORE, ['#d97746', '#e68c5a', '#4aa88c'], 171);
  drawOre(T.IRON_ORE, ['#d8b499', '#c2987c', '#ebd0bc'], 172);
  drawOre(T.GOLD_ORE, ['#facc15', '#fef08a', '#ca8a04'], 173);
  drawOre(T.DIAMOND_ORE, ['#22d3ee', '#67e8f9', '#0891b2'], 174);

  // --- Liquids, Light & Plants ---
  drawTile(T.WATER, (s, h, fill) => {
    fill(['#2b78e4', '#3383ee', '#2569cc', '#4492f5'], 175, 220);
  });

  drawTile(T.LAVA, (s, h, fill) => {
    fill(['#f97316', '#ea580c', '#fb923c', '#facc15', '#dc2626'], 176);
  });

  drawTile(T.TORCH, (s, h) => {
    for (let y = 5; y < 16; y++) { h(7, y, '#73512b'); h(8, y, '#593d1f'); }
    h(7, 4, '#292524'); h(8, 4, '#292524');
    h(7, 3, '#f97316'); h(8, 3, '#f97316');
    h(7, 2, '#facc15'); h(8, 2, '#facc15');
    h(7, 1, '#fef9c3'); h(8, 1, '#fef08a');
  });

  drawTile(T.LANTERN, (s, h) => {
    for (let x = 5; x <= 10; x++) { h(x, 4, '#334155'); h(x, 14, '#334155'); }
    for (let y = 5; y <= 13; y++) { h(5, y, '#334155'); h(10, y, '#334155'); }
    h(7, 2, '#475569'); h(8, 2, '#475569'); h(7, 3, '#475569'); h(8, 3, '#475569');
    for (let x = 6; x <= 9; x++) for (let y = 5; y <= 13; y++) {
      h(x, y, (y >= 7 && y <= 11 && x >= 7 && x <= 8) ? '#fef08a' : '#f59e0b');
    }
  });

  drawTile(T.PLANT_GRASS, (s, h) => {
    for (let y = 3; y < 16; y++) {
      if (y > 5) { h(3, y, '#4c8229'); h(12, y, '#4c8229'); }
      if (y > 3) { h(6, y, '#60a135'); h(10, y, '#579430'); }
      if (y > 7) { h(8, y, '#6cb43d'); }
    }
  });

  drawTile(T.PLANT_FERN, (s, h) => {
    for (let y = 3; y < 16; y++) {
      h(7, y, '#356b21'); h(8, y, '#3d7a27');
      if (y % 3 === 0 && y < 14) {
        const w = Math.floor((y - 2) / 3);
        for (let d = 1; d <= w; d++) { h(7 - d, y, '#4d9132'); h(8 + d, y, '#4d9132'); }
      }
    }
  });

  function drawFlower(tileIdx, petalA, petalB, center) {
    drawTile(tileIdx, (s, h) => {
      for (let y = 6; y < 16; y++) { h(7, y, '#3b731e'); h(8, y, '#2f5f17'); }
      h(6, 11, '#4b8e27'); h(9, 12, '#4b8e27');
      for (let y = 2; y <= 6; y++) for (let x = 5; x <= 10; x++) {
        if ((x === 5 || x === 10) && (y === 2 || y === 6)) continue;
        h(x, y, (x + y) % 2 === 0 ? petalA : petalB);
      }
      h(7, 4, center); h(8, 4, center);
    });
  }
  drawFlower(T.FLOWER_RED, '#e11d48', '#be123c', '#450a0a');
  drawFlower(T.FLOWER_WHITE, '#ffffff', '#e2e8f0', '#facc15');
  drawFlower(T.FLOWER_YELLOW, '#fde047', '#facc15', '#ca8a04');
  drawFlower(T.FLOWER_BLUE, '#60a5fa', '#3b82f6', '#1e3a8a');

  drawTile(T.CACTUS_SIDE, (s, h) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (x % 4 === 0) h(x, y, '#2a5f21');
      else h(x, y, pxHash(x, y, 180) > 0.85 ? '#d6d3b2' : '#408332');
    }
  });
  drawTile(T.CACTUS_TOP, (s, h) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const edge = x <= 1 || x >= 14 || y <= 1 || y >= 14;
      h(x, y, edge ? '#2a5f21' : '#539c42');
    }
  });
  drawTile(T.SUGARCANE, (s, h) => {
    [4, 8, 11].forEach((bx, i) => {
      for (let y = 1 + i; y < 16; y++) {
        h(bx, y, y % 4 === 0 ? '#5c9433' : '#7ac147');
        h(bx + 1, y, '#68ab3b');
      }
    });
  });

  // Crops (stages 0..3)
  for (let st = 0; st < 4; st++) {
    drawTile(T.WHEAT_0 + st, (s, h) => {
      const topY = 12 - st * 3;
      const col = st === 3 ? '#eab308' : (st === 2 ? '#a3b833' : '#5b9c31');
      const tip = st === 3 ? '#fef08a' : '#73ba42';
      [3, 6, 9, 12].forEach(bx => {
        for (let y = topY; y < 16; y++) h(bx, y, y <= topY + 2 ? tip : col);
      });
    });
    drawTile(T.CARROT_0 + st, (s, h) => {
      const topY = 12 - st * 2;
      [3, 7, 11].forEach(bx => {
        for (let y = topY; y < 15; y++) {
          h(bx, y, '#478f28');
          if (st >= 2) { h(bx - 1, topY + 1, '#5fb03a'); h(bx + 1, topY + 1, '#5fb03a'); }
        }
        if (st === 3) { h(bx, 15, '#f97316'); h(bx + 1, 15, '#ea580c'); }
      });
    });
  }

  // Saplings
  function drawSapling(tileIdx, trunkCol, leafCol) {
    drawTile(tileIdx, (s, h) => {
      for (let y = 8; y < 16; y++) { h(7, y, trunkCol); h(8, y, trunkCol); }
      for (let y = 3; y <= 9; y++) for (let x = 4; x <= 11; x++) {
        if (Math.abs(x - 7.5) + Math.abs(y - 6) <= 4.2) h(x, y, (x + y) % 2 === 0 ? leafCol[0] : leafCol[1]);
      }
    });
  }
  drawSapling(T.SAPLING_OAK, '#695131', ['#468c28', '#5aa638']);
  drawSapling(T.SAPLING_BIRCH, '#dcdad0', ['#63a13b', '#79b84f']);
  drawSapling(T.SAPLING_SPRUCE, '#3b2817', ['#244f26', '#326935']);

  // Doors
  drawTile(T.DOOR_OAK_BOTTOM, (s, h) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const frame = x <= 1 || x >= 14 || y === 15;
      h(x, y, frame ? '#5c4220' : ((x === 5 || x === 10) ? '#735229' : '#9c733d'));
    }
    h(12, 2, '#facc15');
  });
  drawTile(T.DOOR_OAK_TOP, (s, h) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const frame = x <= 1 || x >= 14 || y <= 1 || y === 15;
      const win = (x >= 4 && x <= 6 && y >= 4 && y <= 9) || (x >= 9 && x <= 11 && y >= 4 && y <= 9);
      if (frame) h(x, y, '#5c4220');
      else if (win) s(x, y, 180, 225, 255, 65);
      else h(x, y, '#9c733d');
    }
  });

  // Bed & Composter
  drawTile(T.BED_TOP, (s, h) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      h(x, y, y < 5 ? '#f1f5f9' : '#dc2626');
    }
  });
  drawTile(T.BED_SIDE, (s, h) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (y >= 11) h(x, y, (x < 3 || x > 12) ? '#5c4220' : '#9c733d');
      else h(x, y, y < 5 ? '#f1f5f9' : '#dc2626');
    }
  });
  drawTile(T.COMPOSTER_SIDE, (s, h) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      h(x, y, (y % 4 === 0 || x === 0 || x === 15) ? '#593b1a' : '#8d6233');
    }
  });
  drawTile(T.COMPOSTER_TOP, (s, h) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const rim = x <= 2 || x >= 13 || y <= 2 || y >= 13;
      h(x, y, rim ? '#7a5228' : (pxHash(x, y, 190) > 0.35 ? '#4c351e' : '#4a7a26'));
    }
  });

  // 10-Stage Crack Overlay Textures
  const crackTextures = [];
  for (let stage = 0; stage < 10; stage++) {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 16;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(16, 16);
    const d = img.data;
    const density = (stage + 1) * 0.088;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const crack = pxHash(x, y, 50 + stage) < density &&
          (Math.abs(x - y) <= 4 || Math.abs((15 - x) - y) <= 4 || x % 4 === 0 || y % 4 === 0);
        if (crack) {
          const i = (y * 16 + x) * 4;
          d[i] = 18; d[i + 1] = 18; d[i + 2] = 18; d[i + 3] = 215;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    crackTextures.push(tex);
  }

  const atlasTexture = new THREE.CanvasTexture(atlasCanvas);
  atlasTexture.magFilter = THREE.NearestFilter;
  atlasTexture.minFilter = THREE.NearestFilter;
  atlasTexture.generateMipmaps = false;

  function getTileUV(tileIdx) {
    const tu = (tileIdx % ATLAS_TILES) / ATLAS_TILES;
    const tv = 1.0 - (Math.floor(tileIdx / ATLAS_TILES) + 1) / ATLAS_TILES;
    const s = 1.0 / ATLAS_TILES;
    return { u0: tu, v0: tv, u1: tu + s, v1: tv + s, s };
  }

  // --- Item & Block 32x32 UI Icon Generator ---
  const itemIconCache = {};
  const itemUrlCache = {};

  function drawPixelTool(ctx, headFn, handleColor = '#6b4725') {
    for (let i = 0; i < 18; i++) {
      ctx.fillStyle = (i % 2 === 0) ? handleColor : '#533519';
      ctx.fillRect(5 + i, 25 - i, 3, 3);
    }
    headFn(ctx);
  }

  function createItemIconCanvas(id) {
    if (itemIconCache[id]) return itemIconCache[id];
    const cvs = document.createElement('canvas');
    cvs.width = 32; cvs.height = 32;
    const ctx = cvs.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    if (id < 100) {
      const def = BLOCKS[id];
      if (def?.plant || def?.torch || def?.shape === 'lantern' || def?.shape === 'door') {
        const tIdx = def.tile ?? def.tiles?.top ?? def.tiles?.all ?? 0;
        const tx = (tIdx % ATLAS_TILES) * 16;
        const ty = Math.floor(tIdx / ATLAS_TILES) * 16;
        ctx.drawImage(atlasCanvas, tx, ty, 16, 16, 4, 4, 24, 24);
      } else {
        const topT = def?.tiles?.top ?? def?.tiles?.all ?? 0;
        const sideT = def?.tiles?.front ?? def?.tiles?.side ?? def?.tiles?.all ?? 0;
        const sx = (sideT % ATLAS_TILES) * 16, sy = Math.floor(sideT / ATLAS_TILES) * 16;
        const tx = (topT % ATLAS_TILES) * 16, ty = Math.floor(topT / ATLAS_TILES) * 16;

        ctx.save();
        ctx.transform(0.75, 0.3125, -0.75, 0.3125, 16, 3);
        ctx.drawImage(atlasCanvas, tx, ty, 16, 16, 0, 0, 16, 16);
        ctx.restore();

        ctx.save();
        ctx.transform(0.75, 0.3125, 0, 1.0, 4, 8);
        ctx.drawImage(atlasCanvas, sx, sy, 16, 16, 0, 0, 16, 16);
        ctx.fillStyle = 'rgba(0,0,0,0.14)';
        ctx.fillRect(0, 0, 16, 16);
        ctx.restore();

        ctx.save();
        ctx.transform(0.75, -0.3125, 0, 1.0, 16, 13);
        ctx.drawImage(atlasCanvas, sx, sy, 16, 16, 0, 0, 16, 16);
        ctx.fillStyle = 'rgba(0,0,0,0.34)';
        ctx.fillRect(0, 0, 16, 16);
        ctx.restore();
      }
    } else {
      const it = ITEMS[id];
      const col = it?.color || '#cbd5e1';

      if (it?.toolType === 'pickaxe') {
        drawPixelTool(ctx, (c) => {
          c.fillStyle = col;
          c.fillRect(10, 4, 14, 4);
          c.fillRect(22, 6, 4, 14);
          c.fillStyle = 'rgba(255,255,255,0.35)';
          c.fillRect(12, 4, 10, 2);
        });
      } else if (it?.toolType === 'axe') {
        drawPixelTool(ctx, (c) => {
          c.fillStyle = col;
          c.fillRect(14, 3, 12, 9);
          c.fillRect(20, 10, 6, 6);
          c.fillStyle = 'rgba(255,255,255,0.3)';
          c.fillRect(16, 4, 8, 2);
        });
      } else if (it?.toolType === 'shovel') {
        drawPixelTool(ctx, (c) => {
          c.fillStyle = col;
          c.fillRect(18, 4, 9, 9);
          c.fillRect(22, 2, 5, 5);
        });
      } else if (it?.toolType === 'sword') {
        ctx.fillStyle = col;
        for (let i = 0; i < 16; i++) ctx.fillRect(11 + i, 18 - i, 4, 4);
        ctx.fillStyle = '#533519';
        ctx.fillRect(7, 17, 7, 4);
        ctx.fillRect(12, 20, 4, 7);
        ctx.fillRect(5, 24, 4, 4);
      } else if (it?.toolType === 'hoe') {
        drawPixelTool(ctx, (c) => {
          c.fillStyle = col;
          c.fillRect(11, 5, 13, 4);
          c.fillRect(11, 8, 4, 4);
        });
      } else if (it?.type === 'armor') {
        const dark = 'rgba(0,0,0,0.28)';
        if (it.armorSlot === 'helmet') {
          ctx.fillStyle = col; ctx.fillRect(7, 7, 18, 15);
          ctx.fillStyle = '#1e293b'; ctx.fillRect(10, 15, 12, 7);
          ctx.fillStyle = dark; ctx.fillRect(7, 19, 3, 3); ctx.fillRect(22, 19, 3, 3);
        } else if (it.armorSlot === 'chestplate') {
          ctx.fillStyle = col; ctx.fillRect(6, 5, 20, 21);
          ctx.fillStyle = '#1e293b'; ctx.fillRect(12, 5, 8, 5);
          ctx.fillStyle = dark; ctx.fillRect(6, 15, 4, 11); ctx.fillRect(22, 15, 4, 11);
        } else if (it.armorSlot === 'leggings') {
          ctx.fillStyle = col; ctx.fillRect(8, 5, 16, 21);
          ctx.fillStyle = '#1e293b'; ctx.fillRect(14, 13, 4, 13);
        } else {
          ctx.fillStyle = col; ctx.fillRect(6, 12, 8, 13); ctx.fillRect(18, 12, 8, 13);
          ctx.fillStyle = dark; ctx.fillRect(4, 20, 10, 5); ctx.fillRect(18, 20, 10, 5);
        }
      } else if (id === 107) { // Stick
        ctx.fillStyle = '#73512b';
        for (let i = 0; i < 20; i++) ctx.fillRect(6 + i, 24 - i, 3, 3);
      } else if (id === 179) { // Bow
        ctx.fillStyle = '#7c5329';
        for (let i = 0; i < 16; i++) {
          const arc = Math.round(Math.sin((i / 15) * Math.PI) * 8);
          ctx.fillRect(10 + arc, 6 + i, 3, 2);
        }
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(9, 6, 1, 18);
      } else if (id === 180) { // Arrow
        ctx.fillStyle = '#7c5329';
        for (let i = 0; i < 18; i++) ctx.fillRect(7 + i, 23 - i, 2, 2);
        ctx.fillStyle = '#94a3b8'; ctx.fillRect(22, 4, 5, 5);
        ctx.fillStyle = '#f8fafc'; ctx.fillRect(5, 22, 5, 5);
      } else if (id === 181 || id === 182 || id === 183) { // Buckets
        ctx.fillStyle = '#94a3b8'; ctx.fillRect(7, 9, 18, 16);
        ctx.fillStyle = '#cbd5e1'; ctx.fillRect(9, 11, 14, 12);
        ctx.fillStyle = '#475569'; ctx.fillRect(10, 5, 12, 3);
        if (id === 182) { ctx.fillStyle = '#3b82f6'; ctx.fillRect(9, 9, 14, 5); }
        if (id === 183) { ctx.fillStyle = '#f97316'; ctx.fillRect(9, 9, 14, 5); }
      } else if (id === 115 || id === 118 || id === 119) { // Ingots
        const c = id === 115 ? '#d1d5db' : (id === 118 ? '#d97746' : '#facc15');
        ctx.fillStyle = c; ctx.fillRect(6, 12, 20, 10);
        ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(8, 11, 14, 4);
        ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(6, 19, 20, 3);
      } else if (id === 116 || id === 135) { // Diamond / Emerald
        ctx.fillStyle = id === 116 ? '#22d3ee' : '#22c55e';
        ctx.beginPath(); ctx.moveTo(16, 5); ctx.lineTo(25, 15); ctx.lineTo(16, 27); ctx.lineTo(7, 15); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(13, 11, 4, 5);
      } else if (id === 117 || id === 130) { // Coal / Charcoal
        ctx.fillStyle = id === 117 ? '#1f2937' : '#3a2b1f';
        ctx.beginPath(); ctx.arc(16, 16, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#4b5563'; ctx.fillRect(12, 11, 4, 3);
      } else if (id === 110) { // Apple
        ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.arc(16, 18, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#451a03'; ctx.fillRect(15, 7, 2, 4);
        ctx.fillStyle = '#22c55e'; ctx.fillRect(17, 7, 4, 3);
      } else if (id === 145) { // Bread
        ctx.fillStyle = '#b45309'; ctx.fillRect(5, 12, 22, 10);
        ctx.fillStyle = '#f59e0b'; ctx.fillRect(7, 10, 18, 6);
        ctx.fillStyle = '#78350f'; ctx.fillRect(10, 12, 3, 2); ctx.fillRect(18, 12, 3, 2);
      } else if (id === 136) { // Wheat
        ctx.fillStyle = '#eab308';
        for (let i = 0; i < 3; i++) {
          ctx.fillRect(9 + i * 5, 8, 3, 16);
          ctx.fillStyle = '#fde047';
          ctx.fillRect(8 + i * 5, 6, 4, 6);
          ctx.fillStyle = '#ca8a04';
        }
      } else if (id === 137) { // Seeds
        ctx.fillStyle = '#84cc16';
        ctx.fillRect(9, 14, 4, 4); ctx.fillRect(17, 10, 4, 4); ctx.fillRect(14, 19, 4, 4);
      } else if (id === 138) { // Carrot
        ctx.fillStyle = '#f97316';
        ctx.beginPath(); ctx.moveTo(22, 10); ctx.lineTo(9, 25); ctx.lineTo(14, 21); ctx.closePath(); ctx.fill();
        ctx.fillRect(15, 13, 7, 7); ctx.fillRect(11, 17, 6, 6);
        ctx.fillStyle = '#22c55e'; ctx.fillRect(20, 5, 6, 6);
      } else if (id === 108 || id === 140 || id === 111 || id === 141 || id === 113 || id === 142 || id === 143 || id === 144 || id === 109) {
        const cooked = (id >= 140 && id <= 144);
        ctx.fillStyle = id === 109 ? '#6b7a2c' : (cooked ? '#8c441e' : '#df6b6b');
        ctx.fillRect(7, 10, 16, 12);
        ctx.fillStyle = cooked ? '#b8683a' : '#fca5a5';
        ctx.fillRect(10, 12, 9, 6);
        if (id === 108 || id === 140 || id === 113 || id === 142) {
          ctx.fillStyle = '#f8fafc'; ctx.fillRect(21, 9, 5, 4);
        }
      } else if (id === 112) { // Leather
        ctx.fillStyle = '#92542b'; ctx.fillRect(8, 7, 16, 18);
        ctx.fillStyle = '#733f1d'; ctx.fillRect(11, 10, 10, 12);
      } else if (id === 114) { // Feather
        ctx.fillStyle = '#f8fafc';
        for (let i = 0; i < 16; i++) ctx.fillRect(8 + i, 22 - i, 5, 4);
        ctx.fillStyle = '#cbd5e1'; ctx.fillRect(7, 23, 3, 3);
      } else if (id === 131) { // Brick item
        ctx.fillStyle = '#9c4637'; ctx.fillRect(6, 11, 20, 10);
      } else if (id === 132) { // Bone
        ctx.fillStyle = '#f1f5f9';
        for (let i = 0; i < 14; i++) ctx.fillRect(9 + i, 21 - i, 3, 3);
        ctx.fillRect(7, 20, 4, 5); ctx.fillRect(20, 6, 5, 4);
      } else if (id === 133 || id === 139) { // String / Wool
        ctx.fillStyle = '#f1f5f9'; ctx.fillRect(9, 9, 14, 14);
        ctx.fillStyle = '#cbd5e1'; ctx.fillRect(11, 11, 10, 10);
      } else {
        ctx.fillStyle = '#475569'; ctx.fillRect(8, 8, 16, 16);
      }
    }

    itemIconCache[id] = cvs;
    return cvs;
  }

  function getItemDataUrl(id) {
    if (itemUrlCache[id]) return itemUrlCache[id];
    const url = createItemIconCanvas(id).toDataURL();
    itemUrlCache[id] = url;
    return url;
  }

  TV.ATLAS_TILES = ATLAS_TILES;
  TV.atlasCanvas = atlasCanvas;
  TV.atlasTexture = atlasTexture;
  TV.crackTextures = crackTextures;
  TV.tileAverageColors = tileAverageColors;
  TV.getTileUV = getTileUV;
  TV.createItemIconCanvas = createItemIconCanvas;
  TV.getItemDataUrl = getItemDataUrl;
})(window.TV);
