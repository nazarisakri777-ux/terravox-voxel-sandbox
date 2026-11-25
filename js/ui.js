// ============================================================
// TERRAVOX — Menus, World List, Settings & HUD Renderer
// ============================================================
window.TV = window.TV || {};

(function (TV) {
  const { getItemDataUrl, getItemName, storage, saveSettings, sounds } = TV;

  let heldLabelTimeout = null;
  let selectedNewMode = 'survival';

  function showToast(msg) {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = 'toast-msg';
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => { el.remove(); }, 2800);
  }

  function setInteractPrompt(text) {
    const el = document.getElementById('interact-prompt');
    if (!el) return;
    if (text) {
      el.textContent = text;
      el.classList.add('visible');
    } else {
      el.classList.remove('visible');
    }
  }

  function initStatusIcons() {
    const hearts = document.getElementById('hearts-container');
    const hunger = document.getElementById('hunger-container');
    const bubbles = document.getElementById('bubbles-container');
    hearts.innerHTML = '';
    hunger.innerHTML = '';
    bubbles.innerHTML = '';

    for (let i = 0; i < 10; i++) {
      hearts.insertAdjacentHTML('beforeend', `
        <svg class="stat-icon" viewBox="0 0 16 16" id="heart-${i}">
          <path class="heart-bg" d="M4,2 A3,3 0 0,0 1,5 C1,9 8,14 8,14 C8,14 15,9 15,5 A3,3 0 0,0 12,2 A3,3 0 0,0 8,4 A3,3 0 0,0 4,2 Z" fill="#262626" stroke="#111" stroke-width="1.2"/>
          <path class="heart-full" d="M4,2 A3,3 0 0,0 1,5 C1,9 8,14 8,14 C8,14 15,9 15,5 A3,3 0 0,0 12,2 A3,3 0 0,0 8,4 A3,3 0 0,0 4,2 Z" fill="#e11d48"/>
          <path class="heart-half" d="M4,2 A3,3 0 0,0 1,5 C1,9 8,14 8,14 L8,4 A3,3 0 0,0 4,2 Z" fill="#e11d48" style="display:none;"/>
          <circle class="heart-glint" cx="5" cy="4.5" r="1" fill="#ffffff"/>
        </svg>
      `);
      hunger.insertAdjacentHTML('beforeend', `
        <svg class="stat-icon" viewBox="0 0 16 16" id="hunger-${i}">
          <path class="hunger-meat" d="M4,5 C2,7 3,11 7,13 C11,14 13,11 12,8 C11,5 6,3 4,5 Z" fill="#a1622a" stroke="#111" stroke-width="1.2"/>
          <rect x="11" y="4" width="3" height="3" rx="1" fill="#e5e7eb" stroke="#111" stroke-width="0.8"/>
        </svg>
      `);
      bubbles.insertAdjacentHTML('beforeend', `
        <svg class="stat-icon" viewBox="0 0 16 16" id="bubble-${i}">
          <circle cx="8" cy="8" r="5.5" fill="#38bdf8" stroke="#0284c7" stroke-width="1.2"/>
          <circle cx="6" cy="6" r="1.4" fill="#ffffff"/>
        </svg>
      `);
    }
  }

  function updateSurvivalUI() {
    const isCreative = TV.gameMode === 'creative';
    document.getElementById('status-row').style.visibility = isCreative ? 'hidden' : 'visible';
    document.getElementById('xp-container').style.visibility = isCreative ? 'hidden' : 'visible';

    for (let i = 0; i < 10; i++) {
      const hEl = document.getElementById(`heart-${i}`);
      if (hEl) {
        const full = hEl.querySelector('.heart-full');
        const half = hEl.querySelector('.heart-half');
        const glint = hEl.querySelector('.heart-glint');
        if (TV.playerHp >= (i + 1) * 2) {
          full.style.display = 'block'; half.style.display = 'none'; glint.style.display = 'block';
        } else if (TV.playerHp === i * 2 + 1) {
          full.style.display = 'none'; half.style.display = 'block'; glint.style.display = 'block';
        } else {
          full.style.display = 'none'; half.style.display = 'none'; glint.style.display = 'none';
        }
      }

      const fEl = document.getElementById(`hunger-${i}`);
      if (fEl) {
        const meat = fEl.querySelector('.hunger-meat');
        if (TV.playerHunger >= (i + 1) * 2) meat.setAttribute('fill', '#b45309');
        else if (TV.playerHunger === i * 2 + 1) meat.setAttribute('fill', '#78350f');
        else meat.setAttribute('fill', '#262626');
      }

      const bEl = document.getElementById(`bubble-${i}`);
      if (bEl) {
        bEl.style.opacity = (TV.playerOxygen >= (i + 1) * 2) ? '1' : '0.18';
      }
    }

    document.getElementById('bubbles-container').style.display = TV.isUnderwater ? 'flex' : 'none';

    const needed = 10 + TV.playerLevel * 5;
    document.getElementById('level-number').textContent = TV.playerLevel;
    document.getElementById('xp-bar-fill').style.width = `${Math.min(100, (TV.playerXp / needed) * 100)}%`;
  }

  function updateArmorUI() {
    const bar = document.getElementById('armor-container');
    bar.innerHTML = '';
    const total = TV.getEquippedArmorPoints();
    if (total <= 0) return;

    for (let i = 0; i < 10; i++) {
      const val = total - i * 2;
      const fill = val >= 2 ? '#d1d5db' : (val === 1 ? '#6b7280' : '#262626');
      bar.insertAdjacentHTML('beforeend', `
        <svg class="stat-icon" viewBox="0 0 18 18">
          <polygon points="9,2 16,5 16,11 9,16 2,11 2,5" fill="${fill}" stroke="#111" stroke-width="1.3"/>
        </svg>
      `);
    }
  }

  function updateHotbarUI(showLabel = false) {
    for (let i = 0; i < 9; i++) {
      const slotEl = document.querySelector(`.hotbar-slot[data-slot="${i}"]`);
      if (!slotEl) continue;
      slotEl.innerHTML = '';
      const it = TV.inventory[i];
      if (it) {
        const img = document.createElement('img');
        img.src = getItemDataUrl(it.id);
        slotEl.appendChild(img);
        if (it.count > 1) {
          const c = document.createElement('div');
          c.className = 'slot-count';
          c.textContent = it.count;
          slotEl.appendChild(c);
        }
        if (it.durability !== undefined && it.maxDurability && it.durability < it.maxDurability) {
          const bar = document.createElement('div');
          bar.className = 'slot-durability';
          const inner = document.createElement('div');
          inner.className = 'slot-durability-inner';
          const ratio = Math.max(0, it.durability / it.maxDurability);
          inner.style.width = `${ratio * 100}%`;
          inner.style.background = ratio > 0.5 ? '#22c55e' : (ratio > 0.25 ? '#eab308' : '#ef4444');
          bar.appendChild(inner);
          slotEl.appendChild(bar);
        }
      }
    }

    document.getElementById('hotbar-selector').style.transform = `translateX(${TV.activeHotbarSlot * 40}px)`;
    TV.updateHeldItemModel();

    if (showLabel) {
      const label = document.getElementById('held-item-label');
      const cur = TV.inventory[TV.activeHotbarSlot];
      label.textContent = cur ? getItemName(cur.id) : '';
      label.classList.toggle('visible', !!cur);
      clearTimeout(heldLabelTimeout);
      if (cur) heldLabelTimeout = setTimeout(() => label.classList.remove('visible'), 1600);
    }
  }

  function showHUD(visible) {
    ['crosshair-wrap', 'top-info-bar', 'hud'].forEach(id => {
      document.getElementById(id).classList.toggle('hidden', !visible);
    });
    if (!visible) document.getElementById('debug-overlay').classList.add('hidden');
  }

  function showMainMenuView(viewId) {
    ['menu-home-view', 'menu-create-view', 'menu-worlds-view'].forEach(id => {
      document.getElementById(id).classList.toggle('hidden', id !== viewId);
    });
  }

  async function renderWorldsList() {
    const listEl = document.getElementById('worlds-list');
    listEl.innerHTML = '<div class="world-empty">Lade Welten...</div>';
    const worlds = await storage.listWorlds();
    listEl.innerHTML = '';

    if (worlds.length === 0) {
      listEl.innerHTML = '<div class="world-empty">Noch keine gespeicherten Welten. Erstelle deine erste Welt!</div>';
      return;
    }

    for (const w of worlds) {
      const row = document.createElement('div');
      row.className = 'world-row';
      const dateStr = w.updatedAt ? new Date(w.updatedAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : 'Neu';
      const modeStr = w.gameMode === 'creative' ? 'Kreativ' : 'Überleben';

      const info = document.createElement('div');
      info.className = 'world-info';
      info.innerHTML = `<h3>${escapeHtml(w.name)}</h3><p>Seed: ${escapeHtml(w.seed)} • ${modeStr} • Tag ${w.dayCount || 1} • ${dateStr}</p>`;

      const actions = document.createElement('div');
      actions.className = 'world-actions';

      const btnPlay = document.createElement('button');
      btnPlay.className = 'tv-btn small primary';
      btnPlay.textContent = '▶ Laden';
      btnPlay.addEventListener('click', () => TV.loadSavedWorld(w.id));

      const btnRename = document.createElement('button');
      btnRename.className = 'tv-btn small';
      btnRename.textContent = '✏';
      btnRename.title = 'Umbenennen';
      btnRename.addEventListener('click', async () => {
        const newName = prompt('Neuer Weltname:', w.name);
        if (newName && newName.trim()) {
          await storage.renameWorld(w.id, newName.trim());
          renderWorldsList();
        }
      });

      const btnDel = document.createElement('button');
      btnDel.className = 'tv-btn small danger';
      btnDel.textContent = '🗑';
      btnDel.title = 'Löschen';
      btnDel.addEventListener('click', async () => {
        if (confirm(`Welt "${w.name}" wirklich unwiderruflich löschen?`)) {
          await storage.deleteWorld(w.id);
          renderWorldsList();
        }
      });

      actions.append(btnPlay, btnRename, btnDel);
      row.append(info, actions);
      listEl.appendChild(row);
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
  }

  function togglePauseMenu() {
    const pauseEl = document.getElementById('pause-menu');
    const opening = pauseEl.classList.contains('hidden');
    pauseEl.classList.toggle('hidden', !opening);

    if (opening) {
      if (document.pointerLockElement) document.exitPointerLock();
      const meta = document.getElementById('pause-world-meta');
      if (TV.currentWorldMeta) {
        meta.innerHTML = `<b>${escapeHtml(TV.currentWorldMeta.name)}</b><br>Seed: ${escapeHtml(TV.currentWorldMeta.seed)} • ${TV.gameMode === 'creative' ? 'Kreativmodus' : 'Überlebensmodus'}`;
      }
    } else if (!TV.isTouchDevice) {
      TV.canvas.requestPointerLock();
    }
  }

  function syncSettingsInputs() {
    const s = TV.settings;
    document.getElementById('set-quality').value = s.quality;
    document.getElementById('set-render-dist').value = s.renderDistance;
    document.getElementById('val-render-dist').textContent = s.renderDistance;
    document.getElementById('set-shadows').checked = s.shadows;
    document.getElementById('set-ao').checked = s.ao;
    document.getElementById('set-fov').value = s.fov;
    document.getElementById('val-fov').textContent = s.fov;
    document.getElementById('set-master-vol').value = s.masterVol;
    document.getElementById('val-master-vol').textContent = s.masterVol;
    document.getElementById('set-sfx-vol').value = s.sfxVol;
    document.getElementById('val-sfx-vol').textContent = s.sfxVol;
    document.getElementById('set-music-vol').value = s.musicVol;
    document.getElementById('val-music-vol').textContent = s.musicVol;
    document.getElementById('set-sens').value = s.sensitivity;
    document.getElementById('val-sens').textContent = s.sensitivity.toFixed(1);
    document.getElementById('set-invert-y').checked = s.invertY;
  }

  function initMenusAndListeners() {
    initStatusIcons();

    // Hotbar direct click
    document.querySelectorAll('.hotbar-slot').forEach(slotEl => {
      slotEl.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        const idx = parseInt(slotEl.getAttribute('data-slot'), 10);
        if (!isNaN(idx)) { TV.activeHotbarSlot = idx; updateHotbarUI(true); }
      });
    });

    // Main Menu navigation
    document.getElementById('btn-menu-play').addEventListener('click', () => {
      sounds.init();
      showMainMenuView('menu-worlds-view');
      renderWorldsList();
    });
    document.getElementById('btn-menu-new').addEventListener('click', () => {
      sounds.init();
      showMainMenuView('menu-create-view');
    });
    document.getElementById('btn-worlds-to-new').addEventListener('click', () => showMainMenuView('menu-create-view'));
    document.querySelectorAll('[data-back-home]').forEach(b => b.addEventListener('click', () => showMainMenuView('menu-home-view')));

    document.getElementById('btn-random-seed').addEventListener('click', () => {
      document.getElementById('input-world-seed').value = String(Math.floor(100000 + Math.random() * 8999999));
    });

    document.querySelectorAll('.mode-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        selectedNewMode = card.getAttribute('data-gamemode');
      });
    });

    document.getElementById('btn-create-world-confirm').addEventListener('click', () => {
      const name = document.getElementById('input-world-name').value.trim() || 'Neue Welt';
      const seed = document.getElementById('input-world-seed').value.trim() || String(Math.floor(100000 + Math.random() * 8999999));
      const preset = document.getElementById('select-world-preset').value;
      TV.startNewWorld({ name, seed, gameMode: selectedNewMode, preset });
    });

    // Pause Menu buttons
    document.getElementById('btn-resume').addEventListener('click', () => togglePauseMenu());
    document.getElementById('btn-save-world').addEventListener('click', async () => {
      await TV.saveCurrentWorld();
      showToast('Welt gespeichert!');
    });
    document.getElementById('btn-pause-settings').addEventListener('click', () => {
      syncSettingsInputs();
      document.getElementById('settings-modal').classList.remove('hidden');
    });
    document.getElementById('btn-menu-settings').addEventListener('click', () => {
      sounds.init();
      syncSettingsInputs();
      document.getElementById('settings-modal').classList.remove('hidden');
    });
    document.getElementById('btn-quit-menu').addEventListener('click', async () => {
      await TV.saveCurrentWorld();
      TV.returnToMainMenu();
    });

    // Death screen buttons
    document.getElementById('respawn-btn').addEventListener('click', () => TV.respawnPlayer(TV.world));
    document.getElementById('death-menu-btn').addEventListener('click', () => TV.returnToMainMenu());

    // Settings Modal
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.getAttribute('data-tab');
        ['graphics', 'audio', 'controls'].forEach(t => {
          document.getElementById(`tab-${t}`).classList.toggle('hidden', t !== tab);
        });
      });
    });

    document.getElementById('set-quality').addEventListener('change', (e) => {
      const presets = {
        low: { renderDistance: 3, shadows: false, ao: false },
        medium: { renderDistance: 5, shadows: true, ao: true },
        high: { renderDistance: 6, shadows: true, ao: true },
        ultra: { renderDistance: 8, shadows: true, ao: true }
      };
      const p = presets[e.target.value];
      if (p) {
        document.getElementById('set-render-dist').value = p.renderDistance;
        document.getElementById('val-render-dist').textContent = p.renderDistance;
        document.getElementById('set-shadows').checked = p.shadows;
        document.getElementById('set-ao').checked = p.ao;
      }
    });

    ['render-dist', 'fov', 'master-vol', 'sfx-vol', 'music-vol', 'sens'].forEach(k => {
      const inp = document.getElementById(`set-${k}`);
      const val = document.getElementById(`val-${k}`);
      inp.addEventListener('input', () => { val.textContent = inp.value; });
    });

    document.getElementById('btn-close-settings').addEventListener('click', () => {
      document.getElementById('settings-modal').classList.add('hidden');
    });

    document.getElementById('btn-save-settings').addEventListener('click', () => {
      const s = TV.settings;
      s.quality = document.getElementById('set-quality').value;
      s.renderDistance = parseInt(document.getElementById('set-render-dist').value, 10);
      s.shadows = document.getElementById('set-shadows').checked;
      s.ao = document.getElementById('set-ao').checked;
      s.fov = parseInt(document.getElementById('set-fov').value, 10);
      s.masterVol = parseInt(document.getElementById('set-master-vol').value, 10);
      s.sfxVol = parseInt(document.getElementById('set-sfx-vol').value, 10);
      s.musicVol = parseInt(document.getElementById('set-music-vol').value, 10);
      s.sensitivity = parseFloat(document.getElementById('set-sens').value);
      s.invertY = document.getElementById('set-invert-y').checked;
      saveSettings(s);
      TV.applySettings();
      document.getElementById('settings-modal').classList.add('hidden');
      showToast('Einstellungen gespeichert!');
    });
  }

  TV.showToast = showToast;
  TV.setInteractPrompt = setInteractPrompt;
  TV.updateSurvivalUI = updateSurvivalUI;
  TV.updateArmorUI = updateArmorUI;
  TV.updateHotbarUI = updateHotbarUI;
  TV.showHUD = showHUD;
  TV.showMainMenuView = showMainMenuView;
  TV.renderWorldsList = renderWorldsList;
  TV.togglePauseMenu = togglePauseMenu;
  TV.initMenusAndListeners = initMenusAndListeners;
})(window.TV);
