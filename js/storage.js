// ============================================================
// TERRAVOX — IndexedDB Persistence & Settings Storage
// ============================================================
window.TV = window.TV || {};

(function (TV) {
  const DB_NAME = 'TerravoxDB';
  const DB_VERSION = 1;
  const SETTINGS_KEY = 'terravox_settings_v1';

  const DEFAULT_SETTINGS = {
    quality: 'high',
    renderDistance: 6,
    shadows: true,
    ao: true,
    fov: 75,
    masterVol: 80,
    sfxVol: 85,
    musicVol: 45,
    sensitivity: 1.0,
    invertY: false
  };

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch (e) {}
    return { ...DEFAULT_SETTINGS };
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {}
  }

  // Run-Length Encoding for compact Uint8Array chunk voxel/meta storage
  function rleEncode(arr) {
    const out = [];
    let i = 0;
    while (i < arr.length) {
      const val = arr[i];
      let run = 1;
      while (i + run < arr.length && arr[i + run] === val && run < 65535) run++;
      out.push(run, val);
      i += run;
    }
    return new Uint16Array(out);
  }

  function rleDecode(encoded, targetLength) {
    const out = new Uint8Array(targetLength);
    let pos = 0;
    for (let i = 0; i < encoded.length; i += 2) {
      const run = encoded[i];
      const val = encoded[i + 1];
      out.fill(val, pos, pos + run);
      pos += run;
    }
    return out;
  }

  class StorageManager {
    constructor() {
      this.dbPromise = null;
    }

    open() {
      if (this.dbPromise) return this.dbPromise;
      this.dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('worlds')) {
            db.createObjectStore('worlds', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('chunks')) {
            const store = db.createObjectStore('chunks', { keyPath: 'key' });
            store.createIndex('worldId', 'worldId', { unique: false });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      return this.dbPromise;
    }

    async listWorlds() {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('worlds', 'readonly');
        const req = tx.objectStore('worlds').getAll();
        req.onsuccess = () => {
          const list = (req.result || []).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
          resolve(list);
        };
        req.onerror = () => reject(req.error);
      });
    }

    async getWorld(worldId) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('worlds', 'readonly');
        const req = tx.objectStore('worlds').get(worldId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    }

    async saveWorld(worldData, modifiedChunks = []) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(['worlds', 'chunks'], 'readwrite');
        const worldStore = tx.objectStore('worlds');
        const chunkStore = tx.objectStore('chunks');

        worldStore.put(worldData);

        for (const ch of modifiedChunks) {
          chunkStore.put({
            key: `${worldData.id}_${ch.cx}_${ch.cz}`,
            worldId: worldData.id,
            cx: ch.cx,
            cz: ch.cz,
            voxelsRle: rleEncode(ch.voxels),
            metaRle: rleEncode(ch.meta)
          });
        }

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }

    async loadWorldChunks(worldId) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('chunks', 'readonly');
        const idx = tx.objectStore('chunks').index('worldId');
        const req = idx.getAll(worldId);
        req.onsuccess = () => {
          const map = new Map();
          const len = TV.CHUNK_SIZE * TV.WORLD_H * TV.CHUNK_SIZE;
          for (const rec of (req.result || [])) {
            map.set(`${rec.cx},${rec.cz}`, {
              voxels: rleDecode(rec.voxelsRle, len),
              meta: rleDecode(rec.metaRle, len)
            });
          }
          resolve(map);
        };
        req.onerror = () => reject(req.error);
      });
    }

    async renameWorld(worldId, newName) {
      const w = await this.getWorld(worldId);
      if (!w) return;
      w.name = newName;
      await this.saveWorld(w, []);
    }

    async deleteWorld(worldId) {
      const db = await this.open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(['worlds', 'chunks'], 'readwrite');
        tx.objectStore('worlds').delete(worldId);
        const idx = tx.objectStore('chunks').index('worldId');
        const cursorReq = idx.openKeyCursor(IDBKeyRange.only(worldId));
        cursorReq.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            tx.objectStore('chunks').delete(cursor.primaryKey);
            cursor.continue();
          }
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  }

  TV.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
  TV.loadSettings = loadSettings;
  TV.saveSettings = saveSettings;
  TV.storage = new StorageManager();
})(window.TV);
