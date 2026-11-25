// ============================================================
// TERRAVOX — Voxel SkyLight & BlockLight Propagator (BFS)
// ============================================================
window.TV = window.TV || {};

(function (TV) {
  const { BLOCKS, CHUNK_SIZE, WORLD_H } = TV;

  const TOTAL_VOXELS = CHUNK_SIZE * WORLD_H * CHUNK_SIZE;
  const scratchSky = new Uint8Array(TOTAL_VOXELS);
  const scratchBlk = new Uint8Array(TOTAL_VOXELS);
  const scratchSkyQ = new Int32Array(TOTAL_VOXELS * 2);
  const scratchBlkQ = new Int32Array(TOTAL_VOXELS * 2);

  // Compute chunk skyLight & blockLight (0..15) packed into chunk.lightMap (Uint8Array)
  function computeChunkLighting(chunk, getNeighborChunkFn) {
    const sky = scratchSky;
    const blk = scratchBlk;
    sky.fill(0);
    blk.fill(0);
    const voxels = chunk.voxels;

    let skyTail = 0;
    let blkTail = 0;

    // 1. Direct vertical sky light column pass & block light emitters
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        let curSky = 15;
        for (let y = WORLD_H - 1; y >= 0; y--) {
          const idx = lx + y * CHUNK_SIZE + lz * CHUNK_SIZE * WORLD_H;
          const id = voxels[idx];
          const def = BLOCKS[id];

          if (id === 0 || def?.plant || def?.torch || def?.shape) {
            sky[idx] = curSky;
            if (curSky > 1 && y < WORLD_H - 1) scratchSkyQ[skyTail++] = idx;
          } else if (def?.leaves || def?.glass) {
            curSky = Math.max(0, curSky - 1);
            sky[idx] = curSky;
            if (curSky > 1) scratchSkyQ[skyTail++] = idx;
          } else if (def?.liquid && !def?.lava) {
            curSky = Math.max(0, curSky - 2);
            sky[idx] = curSky;
          } else {
            curSky = 0;
            sky[idx] = 0;
          }

          let emit = def?.light || 0;
          if (id === TV.B.FURNACE && (chunk.meta[idx] & 4)) emit = 13;
          if (emit > 0) {
            blk[idx] = emit;
            scratchBlkQ[blkTail++] = idx;
          }
        }
      }
    }

    const seedNeighborEdge = (ncx, ncz, localEdgeFn) => {
      const nch = getNeighborChunkFn(ncx, ncz);
      if (!nch || !nch.lightComputed) return;
      localEdgeFn(nch);
    };

    seedNeighborEdge(chunk.cx - 1, chunk.cz, (nch) => {
      for (let y = 0; y < WORLD_H; y++) for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const nIdx = (CHUNK_SIZE - 1) + y * CHUNK_SIZE + lz * CHUNK_SIZE * WORLD_H;
        const idx = 0 + y * CHUNK_SIZE + lz * CHUNK_SIZE * WORLD_H;
        const ns = (nch.lightMap[nIdx] >> 4) & 15;
        const nb = nch.lightMap[nIdx] & 15;
        if (ns - 1 > sky[idx] && isLightPassable(voxels[idx])) { sky[idx] = ns - 1; scratchSkyQ[skyTail++] = idx; }
        if (nb - 1 > blk[idx] && isLightPassable(voxels[idx])) { blk[idx] = nb - 1; scratchBlkQ[blkTail++] = idx; }
      }
    });
    seedNeighborEdge(chunk.cx + 1, chunk.cz, (nch) => {
      for (let y = 0; y < WORLD_H; y++) for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const nIdx = 0 + y * CHUNK_SIZE + lz * CHUNK_SIZE * WORLD_H;
        const idx = (CHUNK_SIZE - 1) + y * CHUNK_SIZE + lz * CHUNK_SIZE * WORLD_H;
        const ns = (nch.lightMap[nIdx] >> 4) & 15;
        const nb = nch.lightMap[nIdx] & 15;
        if (ns - 1 > sky[idx] && isLightPassable(voxels[idx])) { sky[idx] = ns - 1; scratchSkyQ[skyTail++] = idx; }
        if (nb - 1 > blk[idx] && isLightPassable(voxels[idx])) { blk[idx] = nb - 1; scratchBlkQ[blkTail++] = idx; }
      }
    });
    seedNeighborEdge(chunk.cx, chunk.cz - 1, (nch) => {
      for (let y = 0; y < WORLD_H; y++) for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const nIdx = lx + y * CHUNK_SIZE + (CHUNK_SIZE - 1) * CHUNK_SIZE * WORLD_H;
        const idx = lx + y * CHUNK_SIZE + 0;
        const ns = (nch.lightMap[nIdx] >> 4) & 15;
        const nb = nch.lightMap[nIdx] & 15;
        if (ns - 1 > sky[idx] && isLightPassable(voxels[idx])) { sky[idx] = ns - 1; scratchSkyQ[skyTail++] = idx; }
        if (nb - 1 > blk[idx] && isLightPassable(voxels[idx])) { blk[idx] = nb - 1; scratchBlkQ[blkTail++] = idx; }
      }
    });
    seedNeighborEdge(chunk.cx, chunk.cz + 1, (nch) => {
      for (let y = 0; y < WORLD_H; y++) for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const nIdx = lx + y * CHUNK_SIZE + 0;
        const idx = lx + y * CHUNK_SIZE + (CHUNK_SIZE - 1) * CHUNK_SIZE * WORLD_H;
        const ns = (nch.lightMap[nIdx] >> 4) & 15;
        const nb = nch.lightMap[nIdx] & 15;
        if (ns - 1 > sky[idx] && isLightPassable(voxels[idx])) { sky[idx] = ns - 1; scratchSkyQ[skyTail++] = idx; }
        if (nb - 1 > blk[idx] && isLightPassable(voxels[idx])) { blk[idx] = nb - 1; scratchBlkQ[blkTail++] = idx; }
      }
    });

    const strideZ = CHUNK_SIZE * WORLD_H;

    let head = 0;
    while (head < skyTail) {
      const idx = scratchSkyQ[head++];
      const cur = sky[idx];
      if (cur <= 1) continue;

      const lx = idx % CHUNK_SIZE;
      const y = Math.floor(idx / CHUNK_SIZE) % WORLD_H;
      const lz = Math.floor(idx / strideZ);
      const nextVal = cur - 1;

      if (lx > 0)              { const n = idx - 1; if (sky[n] < nextVal && isLightPassable(voxels[n])) { sky[n] = nextVal; scratchSkyQ[skyTail++] = n; } }
      if (lx < CHUNK_SIZE - 1) { const n = idx + 1; if (sky[n] < nextVal && isLightPassable(voxels[n])) { sky[n] = nextVal; scratchSkyQ[skyTail++] = n; } }
      if (y > 0)               { const n = idx - CHUNK_SIZE; if (sky[n] < nextVal && isLightPassable(voxels[n])) { sky[n] = nextVal; scratchSkyQ[skyTail++] = n; } }
      if (y < WORLD_H - 1)     { const n = idx + CHUNK_SIZE; if (sky[n] < nextVal && isLightPassable(voxels[n])) { sky[n] = nextVal; scratchSkyQ[skyTail++] = n; } }
      if (lz > 0)              { const n = idx - strideZ; if (sky[n] < nextVal && isLightPassable(voxels[n])) { sky[n] = nextVal; scratchSkyQ[skyTail++] = n; } }
      if (lz < CHUNK_SIZE - 1) { const n = idx + strideZ; if (sky[n] < nextVal && isLightPassable(voxels[n])) { sky[n] = nextVal; scratchSkyQ[skyTail++] = n; } }
    }

    head = 0;
    while (head < blkTail) {
      const idx = scratchBlkQ[head++];
      const cur = blk[idx];
      if (cur <= 1) continue;

      const lx = idx % CHUNK_SIZE;
      const y = Math.floor(idx / CHUNK_SIZE) % WORLD_H;
      const lz = Math.floor(idx / strideZ);
      const nextVal = cur - 1;

      if (lx > 0)              { const n = idx - 1; if (blk[n] < nextVal && isLightPassable(voxels[n])) { blk[n] = nextVal; scratchBlkQ[blkTail++] = n; } }
      if (lx < CHUNK_SIZE - 1) { const n = idx + 1; if (blk[n] < nextVal && isLightPassable(voxels[n])) { blk[n] = nextVal; scratchBlkQ[blkTail++] = n; } }
      if (y > 0)               { const n = idx - CHUNK_SIZE; if (blk[n] < nextVal && isLightPassable(voxels[n])) { blk[n] = nextVal; scratchBlkQ[blkTail++] = n; } }
      if (y < WORLD_H - 1)     { const n = idx + CHUNK_SIZE; if (blk[n] < nextVal && isLightPassable(voxels[n])) { blk[n] = nextVal; scratchBlkQ[blkTail++] = n; } }
      if (lz > 0)              { const n = idx - strideZ; if (blk[n] < nextVal && isLightPassable(voxels[n])) { blk[n] = nextVal; scratchBlkQ[blkTail++] = n; } }
      if (lz < CHUNK_SIZE - 1) { const n = idx + strideZ; if (blk[n] < nextVal && isLightPassable(voxels[n])) { blk[n] = nextVal; scratchBlkQ[blkTail++] = n; } }
    }

    for (let i = 0; i < TOTAL_VOXELS; i++) {
      chunk.lightMap[i] = (sky[i] << 4) | blk[i];
    }
    chunk.lightComputed = true;
  }

  function isLightPassable(id) {
    if (id === 0) return true;
    const def = BLOCKS[id];
    return !!(def && (def.transparent || def.plant || def.torch || def.shape));
  }

  TV.computeChunkLighting = computeChunkLighting;
})(window.TV);
