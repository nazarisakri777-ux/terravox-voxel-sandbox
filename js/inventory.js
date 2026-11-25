// ============================================================
// TERRAVOX — Inventory, Crafting, 3D Paperdoll, Furnace, Chest, Crops & Trades
// ============================================================
window.TV = window.TV || {};

(function (TV) {
  const { BLOCKS, ITEMS, B, RECIPES, SMELTING_RECIPES, matchCraftingGrid, matchesIngredient, getItemDef, getItemName, getFuelDuration, getItemDataUrl, sounds } = TV;

  const inventory = new Array(36).fill(null); // 0..8 = Hotbar, 9..35 = Main
  let activeHotbarSlot = 0;

  const equippedArmor = {
    helmet: null,
    chestplate: null,
    leggings: null,
    boots: null
  };

  let cursorItem = null;
  let isTableCrafting = false;
  let craftSlots = new Array(9).fill(null);
  let craftOutputItem = null;
  let selectedRecipeId = RECIPES[0].id;
  let creativeTabActive = false;

  // World Block Entities (persisted in IndexedDB!)
  // furnaces: { "x,y,z": { input, fuel, output, burnTime, burnMax, cookTime } }
  // chests: { "x,y,z": [27 slots] }
  const blockEntities = {
    furnaces: {},
    chests: {}
  };

  let activeFurnaceKey = null;
  let activeChestKey = null;

  // ------------------------------------------------------------
  // 1. LIVE 3D PAPERDOLL RENDERER IN INVENTORY (Reference 1!)
  // ------------------------------------------------------------
  let pdRenderer = null, pdScene = null, pdCamera = null, pdPlayerGroup = null;
  let pdArmorMeshes = {}, pdHeldMesh = null;
  let pdMouseX = 0, pdMouseY = 0;

  function initPaperdoll() {
    const cvs = document.getElementById('paperdoll-canvas');
    if (!cvs || pdRenderer) return;
    pdRenderer = new THREE.WebGLRenderer({ canvas: cvs, antialias: true, alpha: true });
    pdRenderer.setSize(110, 156, false);

    pdScene = new THREE.Scene();
    pdCamera = new THREE.PerspectiveCamera(34, 110 / 156, 0.1, 20);
    pdCamera.position.set(0, 1.05, 3.6);
    pdCamera.lookAt(0, 0.95, 0);

    pdScene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const dl = new THREE.DirectionalLight(0xfff5e0, 0.8);
    dl.position.set(2, 4, 3);
    pdScene.add(dl);

    pdPlayerGroup = new THREE.Group();
    pdScene.add(pdPlayerGroup);

    const skinMat = new THREE.MeshLambertMaterial({ color: 0xc9946b });
    const shirtMat = new THREE.MeshLambertMaterial({ color: 0x0694a2 });
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0x312e81 });
    const hairMat = new THREE.MeshLambertMaterial({ color: 0x3d2817 });

    // Head pivot
    const headPivot = new THREE.Group();
    headPivot.position.set(0, 1.5, 0);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.48), skinMat);
    head.position.y = 0.24;
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.14, 0.50), hairMat);
    hair.position.y = 0.44;
    const eyeL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.03), new THREE.MeshBasicMaterial({ color: 0x1e293b }));
    eyeL.position.set(-0.11, 0.25, 0.245);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.11;
    headPivot.add(head, hair, eyeL, eyeR);
    pdPlayerGroup.add(headPivot);
    pdPlayerGroup.userData.headPivot = headPivot;

    // Torso & Limbs
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.70, 0.26), shirtMat);
    torso.position.set(0, 1.15, 0);
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.68, 0.20), skinMat);
    armL.position.set(-0.36, 1.15, 0);
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.68, 0.20), skinMat);
    armR.position.set(0.36, 1.15, 0);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.22), pantsMat);
    legL.position.set(-0.12, 0.42, 0);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.22), pantsMat);
    legR.position.set(0.12, 0.42, 0);
    pdPlayerGroup.add(torso, armL, armR, legL, legR);

    // Armor overlay meshes
    pdArmorMeshes.helmet = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.34, 0.54), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    pdArmorMeshes.helmet.position.set(0, 0.34, 0);
    headPivot.add(pdArmorMeshes.helmet);

    pdArmorMeshes.chestplate = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.72, 0.32), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    pdArmorMeshes.chestplate.position.set(0, 1.15, 0);
    pdPlayerGroup.add(pdArmorMeshes.chestplate);

    pdArmorMeshes.leggings = new THREE.Group();
    const lg1 = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.46, 0.26), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    lg1.position.set(-0.12, 0.54, 0);
    const lg2 = lg1.clone();
    lg2.position.x = 0.12;
    pdArmorMeshes.leggings.add(lg1, lg2);
    pdPlayerGroup.add(pdArmorMeshes.leggings);

    pdArmorMeshes.boots = new THREE.Group();
    const bt1 = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.24, 0.27), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    bt1.position.set(-0.12, 0.18, 0);
    const bt2 = bt1.clone();
    bt2.position.x = 0.12;
    pdArmorMeshes.boots.add(bt1, bt2);
    pdPlayerGroup.add(pdArmorMeshes.boots);

    pdHeldMesh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.26, 0.26), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    pdHeldMesh.position.set(0.38, 0.78, 0.24);
    pdHeldMesh.rotation.set(0.3, 0.4, 0.2);
    pdPlayerGroup.add(pdHeldMesh);

    window.addEventListener('mousemove', (e) => {
      pdMouseX = (e.clientX / window.innerWidth) * 2 - 1;
      pdMouseY = (e.clientY / window.innerHeight) * 2 - 1;
    });
  }

  function renderPaperdoll() {
    if (!pdRenderer) return;
    const invOpen = !document.getElementById('inventory-modal').classList.contains('hidden');
    if (!invOpen) return;

    // Update equipped armor colors
    for (const slot of ['helmet', 'chestplate', 'leggings', 'boots']) {
      const piece = equippedArmor[slot];
      const mesh = pdArmorMeshes[slot];
      if (!mesh) continue;
      mesh.visible = !!piece;
      if (piece) {
        const col = ITEMS[piece.id]?.color || '#d1d5db';
        if (mesh.material) mesh.material.color.set(col);
        else mesh.children.forEach(c => c.material.color.set(col));
      }
    }

    // Update held item block/tool preview
    const held = inventory[activeHotbarSlot];
    if (held) {
      pdHeldMesh.visible = true;
      const tex = new THREE.CanvasTexture(TV.createItemIconCanvas(held.id));
      tex.magFilter = THREE.NearestFilter;
      pdHeldMesh.material.map = tex;
      pdHeldMesh.material.needsUpdate = true;
    } else {
      pdHeldMesh.visible = false;
    }

    pdPlayerGroup.rotation.y = pdMouseX * 0.48 - 0.15;
    pdPlayerGroup.userData.headPivot.rotation.y = pdMouseX * 0.35;
    pdPlayerGroup.userData.headPivot.rotation.x = pdMouseY * 0.28;
    pdRenderer.render(pdScene, pdCamera);
  }

  // ------------------------------------------------------------
  // 2. INVENTORY OPERATIONS (Stack, Split, Shift-Click)
  // ------------------------------------------------------------
  function isStackable(id) {
    const def = getItemDef(id);
    if (!def) return true;
    return def.type !== 'tool' && def.type !== 'armor' && def.type !== 'bow' && def.type !== 'bucket';
  }

  function addItemToInventory(id, count = 1, durability = undefined, maxDurability = undefined) {
    if (!id || id <= 0) return false;
    let remaining = count;
    if (isStackable(id)) {
      for (let i = 0; i < 36 && remaining > 0; i++) {
        if (inventory[i] && inventory[i].id === id && inventory[i].count < 64) {
          const add = Math.min(remaining, 64 - inventory[i].count);
          inventory[i].count += add;
          remaining -= add;
        }
      }
    }
    while (remaining > 0) {
      const emptyIdx = inventory.findIndex(s => s === null);
      if (emptyIdx === -1) return false;
      const put = isStackable(id) ? Math.min(remaining, 64) : 1;
      const itemObj = { id, count: put };
      const def = getItemDef(id);
      if (durability !== undefined) {
        itemObj.durability = durability;
        itemObj.maxDurability = maxDurability ?? def?.maxDurability ?? durability;
      } else if (def?.maxDurability) {
        itemObj.durability = def.maxDurability;
        itemObj.maxDurability = def.maxDurability;
      }
      inventory[emptyIdx] = itemObj;
      remaining -= put;
    }
    return true;
  }

  function countItemInInventory(req) {
    let total = 0;
    for (let i = 0; i < 36; i++) {
      if (inventory[i] && matchesIngredient(inventory[i].id, req)) {
        total += inventory[i].count;
      }
    }
    return total;
  }

  function consumeItemFromInventory(id, count = 1) {
    let left = count;
    for (let i = 0; i < 36 && left > 0; i++) {
      if (inventory[i] && inventory[i].id === id) {
        const take = Math.min(left, inventory[i].count);
        inventory[i].count -= take;
        left -= take;
        if (inventory[i].count <= 0) inventory[i] = null;
      }
    }
    return left === 0;
  }

  function getEquippedArmorPoints() {
    let pts = 0;
    for (const k in equippedArmor) {
      const it = equippedArmor[k];
      if (it && ITEMS[it.id]?.defense) pts += ITEMS[it.id].defense;
    }
    return pts;
  }

  // ------------------------------------------------------------
  // 3. SLOT RENDERING & TOOLTIP HELPERS
  // ------------------------------------------------------------
  const tooltipEl = document.getElementById('item-tooltip');
  const cursorItemEl = document.getElementById('cursor-item');

  window.addEventListener('mousemove', (e) => {
    if (cursorItem) {
      cursorItemEl.style.left = `${e.clientX + 6}px`;
      cursorItemEl.style.top = `${e.clientY + 6}px`;
    }
    if (!tooltipEl.classList.contains('hidden')) {
      tooltipEl.style.left = `${e.clientX + 14}px`;
      tooltipEl.style.top = `${e.clientY - 26}px`;
    }
  });

  function showTooltip(item) {
    if (!item) { tooltipEl.classList.add('hidden'); return; }
    let text = getItemName(item.id);
    if (item.durability !== undefined && item.maxDurability) {
      text += ` (${item.durability}/${item.maxDurability})`;
    }
    tooltipEl.textContent = text;
    tooltipEl.classList.remove('hidden');
  }
  function hideTooltip() {
    tooltipEl.classList.add('hidden');
  }

  function updateCursorItemUI() {
    if (!cursorItem) {
      cursorItemEl.style.display = 'none';
      return;
    }
    cursorItemEl.style.display = 'block';
    const cvs = createItemIconCanvas(cursorItem.id);
    const target = cursorItemEl.querySelector('canvas');
    const ctx = target.getContext('2d');
    ctx.clearRect(0, 0, 32, 32);
    ctx.drawImage(cvs, 0, 0);
    cursorItemEl.querySelector('.slot-count').textContent = cursorItem.count > 1 ? cursorItem.count : '';
  }

  function populateSlotDOM(el, item) {
    el.innerHTML = '';
    if (!item) return;
    const img = document.createElement('img');
    img.src = getItemDataUrl(item.id);
    img.className = 'slot-icon';
    el.appendChild(img);
    if (item.count > 1) {
      const cnt = document.createElement('div');
      cnt.className = 'slot-count';
      cnt.textContent = item.count;
      el.appendChild(cnt);
    }
    if (item.durability !== undefined && item.maxDurability && item.durability < item.maxDurability) {
      const bar = document.createElement('div');
      bar.className = 'slot-durability';
      const inner = document.createElement('div');
      inner.className = 'slot-durability-inner';
      const ratio = Math.max(0, item.durability / item.maxDurability);
      inner.style.width = `${ratio * 100}%`;
      inner.style.background = ratio > 0.5 ? '#22c55e' : (ratio > 0.25 ? '#eab308' : '#ef4444');
      bar.appendChild(inner);
      el.appendChild(bar);
    }
  }

  // Generic click handler on any array slot
  function handleArraySlotClick(arr, idx, e, refreshFn, shiftTargetArr = null, shiftRange = null) {
    const isRight = e.button === 2;
    const isShift = e.shiftKey;

    if (isShift && arr[idx] && shiftTargetArr) {
      const it = arr[idx];
      const [start, end] = shiftRange || [0, shiftTargetArr.length];
      let moved = false;
      if (isStackable(it.id)) {
        for (let i = start; i < end && it.count > 0; i++) {
          if (shiftTargetArr[i] && shiftTargetArr[i].id === it.id && shiftTargetArr[i].count < 64) {
            const add = Math.min(it.count, 64 - shiftTargetArr[i].count);
            shiftTargetArr[i].count += add;
            it.count -= add;
            moved = true;
          }
        }
      }
      if (it.count > 0) {
        for (let i = start; i < end; i++) {
          if (!shiftTargetArr[i]) {
            shiftTargetArr[i] = it;
            arr[idx] = null;
            moved = true;
            break;
          }
        }
      } else {
        arr[idx] = null;
      }
      if (moved) { sounds.playPickup(); refreshFn(); return; }
    }

    if (!cursorItem && arr[idx]) {
      if (isRight && arr[idx].count > 1) {
        const half = Math.ceil(arr[idx].count / 2);
        cursorItem = { ...arr[idx], count: half };
        arr[idx].count -= half;
      } else {
        cursorItem = arr[idx];
        arr[idx] = null;
      }
    } else if (cursorItem && !arr[idx]) {
      if (isRight && cursorItem.count > 1) {
        arr[idx] = { ...cursorItem, count: 1 };
        cursorItem.count--;
      } else {
        arr[idx] = cursorItem;
        cursorItem = null;
      }
    } else if (cursorItem && arr[idx]) {
      if (cursorItem.id === arr[idx].id && isStackable(cursorItem.id) && arr[idx].count < 64) {
        if (isRight) {
          arr[idx].count++;
          cursorItem.count--;
          if (cursorItem.count <= 0) cursorItem = null;
        } else {
          const add = Math.min(cursorItem.count, 64 - arr[idx].count);
          arr[idx].count += add;
          cursorItem.count -= add;
          if (cursorItem.count <= 0) cursorItem = null;
        }
      } else {
        const tmp = arr[idx];
        arr[idx] = cursorItem;
        cursorItem = tmp;
      }
    }
    updateCursorItemUI();
    refreshFn();
  }

  // ------------------------------------------------------------
  // 4. INVENTORY & RECIPE BOOK MODAL
  // ------------------------------------------------------------
  function isAnyModalOpen() {
    return !document.getElementById('inventory-modal').classList.contains('hidden') ||
           !document.getElementById('furnace-modal').classList.contains('hidden') ||
           !document.getElementById('chest-modal').classList.contains('hidden') ||
           !document.getElementById('trade-modal').classList.contains('hidden') ||
           !document.getElementById('pause-menu').classList.contains('hidden') ||
           !document.getElementById('settings-modal').classList.contains('hidden') ||
           !document.getElementById('death-screen').classList.contains('hidden') ||
           !document.getElementById('main-menu').classList.contains('hidden');
  }

  function closeAllGameModals(relock = true) {
    ['inventory-modal', 'furnace-modal', 'chest-modal', 'trade-modal'].forEach(id => {
      document.getElementById(id).classList.add('hidden');
    });
    hideTooltip();

    // Return items sitting in temporary crafting grid to inventory
    for (let i = 0; i < 9; i++) {
      if (craftSlots[i]) {
        addItemToInventory(craftSlots[i].id, craftSlots[i].count, craftSlots[i].durability, craftSlots[i].maxDurability);
        craftSlots[i] = null;
      }
    }
    if (cursorItem) {
      addItemToInventory(cursorItem.id, cursorItem.count, cursorItem.durability, cursorItem.maxDurability);
      cursorItem = null;
    }
    activeFurnaceKey = null;
    activeChestKey = null;
    updateCursorItemUI();
    TV.updateHotbarUI();

    if (relock && !TV.isTouchDevice && TV.isPlaying && !isAnyModalOpen()) {
      TV.canvas.requestPointerLock();
    }
  }

  function openInventory(tableMode = false) {
    isTableCrafting = tableMode;
    creativeTabActive = (TV.gameMode === 'creative' && !tableMode);
    if (document.pointerLockElement) document.exitPointerLock();

    document.getElementById('inventory-modal').classList.remove('hidden');
    document.getElementById('crafting-title').textContent = tableMode ? 'Werkbank (3×3)' : 'Inventar & Herstellung';

    const toggleBtn = document.getElementById('btn-toggle-creative-tab');
    toggleBtn.classList.toggle('hidden', TV.gameMode !== 'creative');
    toggleBtn.classList.toggle('active', creativeTabActive);

    initPaperdoll();
    refreshInventoryScreen();
  }

  function refreshInventoryScreen() {
    document.getElementById('survival-top-area').classList.toggle('hidden', creativeTabActive);
    document.getElementById('creative-catalog-area').classList.toggle('hidden', !creativeTabActive);
    document.getElementById('recipe-book-window').classList.toggle('hidden', creativeTabActive);

    if (creativeTabActive) {
      renderCreativeCatalog();
    } else {
      renderCraftGrid();
      checkCraftingRecipe();
      renderRecipeBook();
    }
    renderArmorSlots();
    renderInvGrid('main-inventory', 9, 36, refreshInventoryScreen);
    renderInvGrid('hotbar-inventory', 0, 9, refreshInventoryScreen);
    TV.updateHotbarUI();
    TV.updateArmorUI();
    renderPaperdoll();
  }

  function renderInvGrid(elId, start, end, refreshFn, shiftTarget = null, shiftRange = null) {
    const grid = document.getElementById(elId);
    grid.innerHTML = '';
    for (let i = start; i < end; i++) {
      const slot = document.createElement('div');
      slot.className = 'gui-slot';
      const item = inventory[i];
      populateSlotDOM(slot, item);
      slot.addEventListener('mouseenter', () => showTooltip(inventory[i]));
      slot.addEventListener('mouseleave', hideTooltip);
      slot.addEventListener('click', (e) => {
        if (e.shiftKey && !shiftTarget) {
          // Shift-click between main (9..35) and hotbar (0..8)
          const targetRange = i < 9 ? [9, 36] : [0, 9];
          handleArraySlotClick(inventory, i, e, refreshFn, inventory, targetRange);
        } else {
          handleArraySlotClick(inventory, i, e, refreshFn, shiftTarget, shiftRange);
        }
      });
      slot.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        handleArraySlotClick(inventory, i, { button: 2, shiftKey: false }, refreshFn);
      });
      grid.appendChild(slot);
    }
  }

  function renderArmorSlots() {
    document.querySelectorAll('.armor-slot').forEach(slotEl => {
      const type = slotEl.getAttribute('data-slot-type');
      const piece = equippedArmor[type];
      slotEl.classList.toggle('empty', !piece);
      populateSlotDOM(slotEl, piece);
    });
  }

  function initInventoryUIListeners() {
    document.querySelectorAll('.armor-slot').forEach(slotEl => {
      const slotType = slotEl.getAttribute('data-slot-type');
      slotEl.addEventListener('mouseenter', () => showTooltip(equippedArmor[slotType]));
      slotEl.addEventListener('mouseleave', hideTooltip);
      slotEl.addEventListener('click', () => {
        const cur = equippedArmor[slotType];
        if (!cursorItem && cur) {
          cursorItem = cur;
          equippedArmor[slotType] = null;
        } else if (cursorItem && ITEMS[cursorItem.id]?.type === 'armor' && ITEMS[cursorItem.id].armorSlot === slotType) {
          equippedArmor[slotType] = cursorItem;
          cursorItem = cur;
        }
        updateCursorItemUI();
        refreshInventoryScreen();
      });
    });

    document.getElementById('inv-close-btn').addEventListener('click', () => closeAllGameModals(true));
    document.getElementById('furnace-close-btn').addEventListener('click', () => closeAllGameModals(true));
    document.getElementById('chest-close-btn').addEventListener('click', () => closeAllGameModals(true));
    document.getElementById('trade-close-btn').addEventListener('click', () => closeAllGameModals(true));

    document.getElementById('btn-toggle-creative-tab').addEventListener('click', () => {
      creativeTabActive = !creativeTabActive;
      document.getElementById('btn-toggle-creative-tab').classList.toggle('active', creativeTabActive);
      refreshInventoryScreen();
    });

    document.getElementById('recipe-search').addEventListener('input', () => renderRecipeBook());

    document.getElementById('craft-output').addEventListener('click', () => {
      if (!craftOutputItem) return;
      if (cursorItem && (cursorItem.id !== craftOutputItem.id || !isStackable(cursorItem.id) || cursorItem.count + craftOutputItem.count > 64)) {
        return;
      }
      sounds.playPickup();
      const size = isTableCrafting ? 3 : 2;
      for (let i = 0; i < size * size; i++) {
        if (craftSlots[i]) {
          craftSlots[i].count--;
          if (craftSlots[i].count <= 0) craftSlots[i] = null;
        }
      }
      if (!cursorItem) cursorItem = { ...craftOutputItem };
      else cursorItem.count += craftOutputItem.count;
      updateCursorItemUI();
      refreshInventoryScreen();
    });

    document.getElementById('recipe-autofill-btn').addEventListener('click', () => {
      const rec = RECIPES.find(r => r.id === selectedRecipeId);
      if (!rec) return;
      const gridSize = isTableCrafting ? 3 : 2;
      if (rec.w > gridSize || rec.h > gridSize) return;

      for (let i = 0; i < 9; i++) {
        if (craftSlots[i]) {
          addItemToInventory(craftSlots[i].id, craftSlots[i].count);
          craftSlots[i] = null;
        }
      }

      const takeMatch = (req) => {
        for (let i = 0; i < 36; i++) {
          if (inventory[i] && matchesIngredient(inventory[i].id, req)) {
            const id = inventory[i].id;
            inventory[i].count--;
            if (inventory[i].count <= 0) inventory[i] = null;
            return id;
          }
        }
        return null;
      };

      for (let r = 0; r < rec.h; r++) {
        for (let c = 0; c < rec.w; c++) {
          const req = rec.pattern[r * rec.w + c];
          if (req) {
            const id = takeMatch(req);
            if (id) craftSlots[r * gridSize + c] = { id, count: 1 };
          }
        }
      }
      sounds.playPickup();
      refreshInventoryScreen();
    });
  }

  function renderCraftGrid() {
    const grid = document.getElementById('craft-grid');
    grid.innerHTML = '';
    const size = isTableCrafting ? 3 : 2;
    grid.className = `crafting-grid crafting-grid-${size}x${size}`;
    for (let i = 0; i < size * size; i++) {
      const slot = document.createElement('div');
      slot.className = 'gui-slot';
      populateSlotDOM(slot, craftSlots[i]);
      slot.addEventListener('mouseenter', () => showTooltip(craftSlots[i]));
      slot.addEventListener('mouseleave', hideTooltip);
      slot.addEventListener('click', (e) => handleArraySlotClick(craftSlots, i, e, refreshInventoryScreen));
      slot.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        handleArraySlotClick(craftSlots, i, { button: 2, shiftKey: false }, refreshInventoryScreen);
      });
      grid.appendChild(slot);
    }
  }

  function checkCraftingRecipe() {
    const size = isTableCrafting ? 3 : 2;
    craftOutputItem = matchCraftingGrid(craftSlots, size);
    const outEl = document.getElementById('craft-output');
    populateSlotDOM(outEl, craftOutputItem);
  }

  function renderRecipeBook() {
    const list = document.getElementById('recipe-list');
    const q = (document.getElementById('recipe-search').value || '').toLowerCase().trim();
    list.innerHTML = '';

    for (const rec of RECIPES) {
      if (q && !rec.name.toLowerCase().includes(q)) continue;
      const row = document.createElement('div');
      row.className = 'recipe-item' + (rec.id === selectedRecipeId ? ' active' : '');
      const img = document.createElement('img');
      img.src = getItemDataUrl(rec.output.id);
      const name = document.createElement('span');
      name.textContent = rec.name;
      const tag = document.createElement('span');
      tag.className = 'recipe-tag';
      tag.textContent = (rec.w > 2 || rec.h > 2) ? 'Werkbank' : '2×2';
      row.append(img, name, tag);
      row.addEventListener('click', () => {
        selectedRecipeId = rec.id;
        renderRecipeBook();
      });
      list.appendChild(row);
    }

    const rec = RECIPES.find(r => r.id === selectedRecipeId) || RECIPES[0];
    document.getElementById('recipe-detail-name').textContent = rec.name;

    const preview = document.getElementById('recipe-preview-grid');
    preview.innerHTML = '';
    const g = document.createElement('div');
    g.style.display = 'grid';
    g.style.gridTemplateColumns = `repeat(${rec.w}, 28px)`;
    g.style.gap = '2px';

    const reqCounts = {};
    for (let i = 0; i < rec.w * rec.h; i++) {
      const slot = document.createElement('div');
      slot.className = 'mini-slot';
      const req = rec.pattern[i];
      if (req) {
        reqCounts[req] = (reqCounts[req] || 0) + 1;
        const iconId = req === TV.ANY_PLANK ? B.PLANKS_OAK : (req === TV.ANY_LOG ? B.LOG_OAK : (req === TV.ANY_COAL ? 117 : req));
        const img = document.createElement('img');
        img.src = getItemDataUrl(iconId);
        slot.appendChild(img);
      }
      g.appendChild(slot);
    }
    preview.appendChild(g);

    const reqBox = document.getElementById('recipe-requirements');
    reqBox.innerHTML = '<b>Material:</b><br>';
    let canCraft = true;
    for (const [reqKey, need] of Object.entries(reqCounts)) {
      const reqVal = isNaN(reqKey) ? reqKey : parseInt(reqKey, 10);
      const label = reqVal === TV.ANY_PLANK ? 'Holzbretter' : (reqVal === TV.ANY_LOG ? 'Holzstamm' : (reqVal === TV.ANY_COAL ? 'Kohle' : getItemName(reqVal)));
      const have = countItemInInventory(reqVal);
      const ok = have >= need;
      if (!ok) canCraft = false;
      reqBox.innerHTML += `<span style="color:${ok ? '#15803d' : '#b91c1c'}; font-weight:700;">• ${label}: ${have}/${need} ${ok ? '✔' : '✖'}</span><br>`;
    }

    const btn = document.getElementById('recipe-autofill-btn');
    const gridSize = isTableCrafting ? 3 : 2;
    if (rec.w > gridSize || rec.h > gridSize) {
      btn.textContent = '⚠ Werkbank benötigt';
      btn.disabled = true;
    } else if (!canCraft) {
      btn.textContent = '✖ Material fehlt';
      btn.disabled = true;
    } else {
      btn.textContent = '✨ Im Gitter anordnen';
      btn.disabled = false;
    }
  }

  function renderCreativeCatalog() {
    const grid = document.getElementById('creative-grid');
    grid.innerHTML = '';
    const allIds = [];
    for (const k of Object.keys(BLOCKS)) {
      const id = parseInt(k, 10);
      if (id > 0 && id !== B.WHEAT_CROP && id !== B.CARROT_CROP) allIds.push(id);
    }
    for (const k of Object.keys(ITEMS)) allIds.push(parseInt(k, 10));

    for (const id of allIds) {
      const slot = document.createElement('div');
      slot.className = 'gui-slot';
      const itemObj = { id, count: isStackable(id) ? 64 : 1 };
      populateSlotDOM(slot, itemObj);
      slot.addEventListener('mouseenter', () => showTooltip(itemObj));
      slot.addEventListener('mouseleave', hideTooltip);
      slot.addEventListener('click', (e) => {
        if (e.shiftKey) {
          addItemToInventory(id, isStackable(id) ? 64 : 1);
          refreshInventoryScreen();
        } else {
          cursorItem = { id, count: isStackable(id) ? 64 : 1 };
          const def = getItemDef(id);
          if (def?.maxDurability) { cursorItem.durability = def.maxDurability; cursorItem.maxDurability = def.maxDurability; }
          updateCursorItemUI();
        }
      });
      grid.appendChild(slot);
    }
  }

  // ------------------------------------------------------------
  // 5. FURNACE SYSTEM (Background ticking + UI)
  // ------------------------------------------------------------
  function getOrCreateFurnace(key) {
    if (!blockEntities.furnaces[key]) {
      blockEntities.furnaces[key] = { input: null, fuel: null, output: null, burnTime: 0, burnMax: 0, cookTime: 0 };
    }
    return blockEntities.furnaces[key];
  }

  function openFurnace(bx, by, bz) {
    activeFurnaceKey = `${bx},${by},${bz}`;
    getOrCreateFurnace(activeFurnaceKey);
    if (document.pointerLockElement) document.exitPointerLock();
    document.getElementById('furnace-modal').classList.remove('hidden');
    refreshFurnaceUI();
  }

  function refreshFurnaceUI() {
    if (!activeFurnaceKey) return;
    const f = getOrCreateFurnace(activeFurnaceKey);
    const inSlot = document.getElementById('furnace-input-slot');
    const fuelSlot = document.getElementById('furnace-fuel-slot');
    const outSlot = document.getElementById('furnace-output-slot');

    const bindSingle = (el, prop, readOnly = false) => {
      const clone = el.cloneNode(false);
      el.parentNode.replaceChild(clone, el);
      populateSlotDOM(clone, f[prop]);
      clone.addEventListener('mouseenter', () => showTooltip(f[prop]));
      clone.addEventListener('mouseleave', hideTooltip);
      clone.addEventListener('click', (e) => {
        if (readOnly) {
          if (f.output && (!cursorItem || (cursorItem.id === f.output.id && cursorItem.count + f.output.count <= 64))) {
            if (!cursorItem) cursorItem = f.output;
            else cursorItem.count += f.output.count;
            f.output = null;
            sounds.playPickup();
            updateCursorItemUI();
            refreshFurnaceUI();
          }
          return;
        }
        const wrapper = [f[prop]];
        handleArraySlotClick(wrapper, 0, e, () => {
          f[prop] = wrapper[0];
          refreshFurnaceUI();
        });
      });
    };

    bindSingle(inSlot, 'input', false);
    bindSingle(fuelSlot, 'fuel', false);
    bindSingle(outSlot, 'output', true);

    renderInvGrid('furnace-main-inventory', 9, 36, refreshFurnaceUI);
    renderInvGrid('furnace-hotbar-inventory', 0, 9, refreshFurnaceUI);
    updateFurnaceBars(f);
    TV.updateHotbarUI();
  }

  function updateFurnaceBars(f) {
    const fuelBar = document.getElementById('furnace-fuel-bar');
    const progBar = document.getElementById('furnace-progress-bar');
    if (fuelBar) fuelBar.style.height = f.burnMax > 0 ? `${(f.burnTime / f.burnMax) * 100}%` : '0%';
    if (progBar) progBar.style.width = `${(f.cookTime / 4.0) * 100}%`;
  }

  function updateFurnaces(dt, world) {
    for (const [key, f] of Object.entries(blockEntities.furnaces)) {
      const [bx, by, bz] = key.split(',').map(Number);
      if (world.getBlock(bx, by, bz) !== B.FURNACE) {
        delete blockEntities.furnaces[key];
        continue;
      }

      const recipe = f.input ? SMELTING_RECIPES[f.input.id] : null;
      const canSmelt = recipe && (!f.output || (f.output.id === recipe.id && f.output.count + recipe.count <= 64));
      const wasBurning = f.burnTime > 0;

      if (f.burnTime > 0) {
        f.burnTime = Math.max(0, f.burnTime - dt);
      }

      if (f.burnTime <= 0 && canSmelt && f.fuel && getFuelDuration(f.fuel.id) > 0) {
        f.burnMax = getFuelDuration(f.fuel.id);
        f.burnTime = f.burnMax;
        if (f.fuel.id === 183) {
          f.fuel = { id: 181, count: 1 }; // Lava bucket leaves empty bucket!
        } else {
          f.fuel.count--;
          if (f.fuel.count <= 0) f.fuel = null;
        }
      }

      if (f.burnTime > 0 && canSmelt) {
        f.cookTime += dt;
        if (f.cookTime >= 4.0) {
          f.cookTime = 0;
          f.input.count--;
          if (f.input.count <= 0) f.input = null;
          if (!f.output) f.output = { id: recipe.id, count: recipe.count };
          else f.output.count += recipe.count;
          TV.addPlayerXp(recipe.xp || 1);
          if (activeFurnaceKey === key) refreshFurnaceUI();
        }
      } else {
        f.cookTime = 0;
      }

      const isBurning = f.burnTime > 0;
      if (wasBurning !== isBurning) {
        const meta = world.getMeta(bx, by, bz);
        world.setBlock(bx, by, bz, B.FURNACE, isBurning ? (meta | 4) : (meta & ~4), false);
        world.rebuildArea(bx, bz);
      }

      if (activeFurnaceKey === key) updateFurnaceBars(f);
    }
  }

  // ------------------------------------------------------------
  // 6. CHEST STORAGE SYSTEM
  // ------------------------------------------------------------
  function getOrCreateChest(key, isVillageLoot = false) {
    if (!blockEntities.chests[key]) {
      const slots = new Array(27).fill(null);
      if (isVillageLoot) {
        slots[0] = { id: 145, count: 4 }; // Bread
        slots[1] = { id: 110, count: 3 }; // Apples
        slots[2] = { id: 115, count: 3 }; // Iron Ingots
        slots[3] = { id: 137, count: 8 }; // Wheat Seeds
        slots[4] = { id: 135, count: 2 }; // Emeralds
      }
      blockEntities.chests[key] = slots;
    }
    return blockEntities.chests[key];
  }

  function openChest(bx, by, bz) {
    activeChestKey = `${bx},${by},${bz}`;
    // Give untouched world-generated chests cozy starter village loot!
    const existing = blockEntities.chests[activeChestKey];
    if (!existing) getOrCreateChest(activeChestKey, true);
    if (document.pointerLockElement) document.exitPointerLock();
    document.getElementById('chest-modal').classList.remove('hidden');
    refreshChestUI();
  }

  function refreshChestUI() {
    if (!activeChestKey) return;
    const slots = getOrCreateChest(activeChestKey, false);
    const chestGrid = document.getElementById('chest-slots');
    chestGrid.innerHTML = '';

    for (let i = 0; i < 27; i++) {
      const slot = document.createElement('div');
      slot.className = 'gui-slot';
      populateSlotDOM(slot, slots[i]);
      slot.addEventListener('mouseenter', () => showTooltip(slots[i]));
      slot.addEventListener('mouseleave', hideTooltip);
      slot.addEventListener('click', (e) => handleArraySlotClick(slots, i, e, refreshChestUI, inventory, [0, 36]));
      slot.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        handleArraySlotClick(slots, i, { button: 2, shiftKey: false }, refreshChestUI);
      });
      chestGrid.appendChild(slot);
    }

    renderInvGrid('chest-main-inventory', 9, 36, refreshChestUI, slots, [0, 27]);
    renderInvGrid('chest-hotbar-inventory', 0, 9, refreshChestUI, slots, [0, 27]);
    TV.updateHotbarUI();
  }

  // ------------------------------------------------------------
  // 7. VILLAGER TRADING MODAL
  // ------------------------------------------------------------
  const TRADE_OFFERS = [
    { costId: 136, costCount: 12, rewardId: 135, rewardCount: 1, label: '12× Weizen ➔ 1× Smaragd' },
    { costId: 117, costCount: 10, rewardId: 135, rewardCount: 1, label: '10× Kohle ➔ 1× Smaragd' },
    { costId: 135, costCount: 1, rewardId: 145, rewardCount: 5, label: '1× Smaragd ➔ 5× Brot' },
    { costId: 135, costCount: 2, rewardId: B.LANTERN, rewardCount: 3, label: '2× Smaragd ➔ 3× Laterne' },
    { costId: 135, costCount: 3, rewardId: 161, rewardCount: 1, label: '3× Smaragd ➔ Eisenspitzhacke' },
    { costId: 135, costCount: 4, rewardId: 179, rewardCount: 1, label: '4× Smaragd ➔ Bogen + 8 Pfeile', bonusId: 180, bonusCount: 8 }
  ];

  function openVillagerTrade() {
    if (document.pointerLockElement) document.exitPointerLock();
    sounds.playVillager();
    document.getElementById('trade-modal').classList.remove('hidden');
    const list = document.getElementById('trade-offers-list');
    list.innerHTML = '';

    for (const offer of TRADE_OFFERS) {
      const row = document.createElement('div');
      row.className = 'trade-row';

      const left = document.createElement('div');
      left.className = 'trade-items';
      const imgIn = document.createElement('img');
      imgIn.src = getItemDataUrl(offer.costId);
      const txt = document.createElement('span');
      txt.textContent = offer.label;
      const imgOut = document.createElement('img');
      imgOut.src = getItemDataUrl(offer.rewardId);
      left.append(imgIn, txt, imgOut);

      const have = countItemInInventory(offer.costId);
      const btn = document.createElement('button');
      btn.className = 'mc-button';
      btn.textContent = have >= offer.costCount ? 'Tauschen' : `Fehlt (${have}/${offer.costCount})`;
      btn.disabled = have < offer.costCount;
      btn.addEventListener('click', () => {
        if (consumeItemFromInventory(offer.costId, offer.costCount)) {
          addItemToInventory(offer.rewardId, offer.rewardCount);
          if (offer.bonusId) addItemToInventory(offer.bonusId, offer.bonusCount);
          sounds.playPickup();
          TV.addPlayerXp(3);
          TV.updateHotbarUI();
          openVillagerTrade();
        }
      });

      row.append(left, btn);
      list.appendChild(row);
    }
  }

  // ------------------------------------------------------------
  // 8. CROP GROWTH & SAPLING TREE GROWTH TICKS
  // ------------------------------------------------------------
  let worldTickTimer = 0;
  function updateWorldGrowthTicks(dt, world) {
    worldTickTimer += dt;
    if (worldTickTimer < 1.2) return;
    worldTickTimer = 0;

    const px = Math.floor(TV.camera.position.x);
    const pz = Math.floor(TV.camera.position.z);

    // Sample 14 random columns around player each second for organic crop & sapling growth
    for (let s = 0; s < 14; s++) {
      const wx = px + Math.floor((Math.random() - 0.5) * 48);
      const wz = pz + Math.floor((Math.random() - 0.5) * 48);
      for (let y = TV.WATER_LEVEL; y < TV.WORLD_H - 8; y++) {
        const b = world.getBlock(wx, y, wz);
        if (b === B.WHEAT_CROP || b === B.CARROT_CROP) {
          const stage = world.getMeta(wx, y, wz);
          if (stage < 3 && Math.random() < 0.35) {
            world.setBlock(wx, y, wz, b, stage + 1, true);
            world.rebuildArea(wx, wz);
          }
        } else if (b === B.SAPLING_OAK || b === B.SAPLING_BIRCH || b === B.SAPLING_SPRUCE) {
          if (Math.random() < 0.14) {
            const logB = b === B.SAPLING_BIRCH ? B.LOG_BIRCH : (b === B.SAPLING_SPRUCE ? B.LOG_SPRUCE : B.LOG_OAK);
            const leafB = b === B.SAPLING_BIRCH ? B.LEAVES_BIRCH : (b === B.SAPLING_SPRUCE ? B.LEAVES_SPRUCE : B.LEAVES_OAK);
            const h = 4 + Math.floor(Math.random() * 2);
            for (let dy = 0; dy <= h; dy++) world.setBlock(wx, y + dy, wz, logB, 0, true);
            for (let ly = -1; ly <= 1; ly++) {
              const rad = ly === 1 ? 1 : 2;
              for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++) {
                if (dx === 0 && dz === 0 && ly < 1) continue;
                if (world.getBlock(wx + dx, y + h + ly, wz + dz) === 0) {
                  world.setBlock(wx + dx, y + h + ly, wz + dz, leafB, 0, true);
                }
              }
            }
            world.rebuildArea(wx, wz);
          }
        }
      }
    }
  }

  TV.inventory = inventory;
  Object.defineProperty(TV, 'activeHotbarSlot', {
    get: () => activeHotbarSlot,
    set: (v) => { activeHotbarSlot = ((v % 9) + 9) % 9; }
  });
  TV.equippedArmor = equippedArmor;
  TV.blockEntities = blockEntities;
  TV.addItemToInventory = addItemToInventory;
  TV.countItemInInventory = countItemInInventory;
  TV.consumeItemFromInventory = consumeItemFromInventory;
  TV.getEquippedArmorPoints = getEquippedArmorPoints;
  TV.isAnyModalOpen = isAnyModalOpen;
  TV.closeAllGameModals = closeAllGameModals;
  TV.openInventory = openInventory;
  TV.openFurnace = openFurnace;
  TV.openChest = openChest;
  TV.openVillagerTrade = openVillagerTrade;
  TV.updateFurnaces = updateFurnaces;
  TV.updateWorldGrowthTicks = updateWorldGrowthTicks;
  TV.initInventoryUIListeners = initInventoryUIListeners;
})(window.TV);
