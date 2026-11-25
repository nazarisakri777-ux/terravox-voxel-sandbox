# TERRAVOX — 3D Voxel Sandbox

Ein eigenständiges, vollständig spielbares 3D-Voxel-Sandbox-Spiel im Browser auf Basis von **HTML5, CSS3, JavaScript & Three.js**.

---

## ✨ Features

- **Prozedurale, Seed-basierte Oberwelt** (`js/worldgen.js`):
  - Biome: Grasland, Laubwald (Eiche & Birke), Kiefernwald (Taiga), Gebirge mit Schnee & Eis, Wüste, Strände, Flüsse & Ozeane
  - 3D-Höhlensysteme mit unterirdischen Wasser- und Lavabecken sowie Fackeln
  - Geclusterte Erzadern (Kohle, Kupfer, Eisen, Gold, Diamant) & Gesteinsschichten (Stein, Granit, Andesit, Tiefenschiefer)
  - Prozedural generierte Dörfer mit Häusern, Wachturm, Marktständen, bewässerten Feldern, Wegen und Dorfbewohnern
- **Moderne Voxel-Grafik & Performance** (`js/chunk.js`, `js/lighting.js`, `js/textures.js`):
  - **Greedy Meshing** mit nahtlosem Atlas-Tiling im Custom-Shader
  - **Per-Vertex Ambient Occlusion (AO)** & BFS-SkyLight/BlockLight-Beleuchtung
  - **Echtzeit-Sonnenschatten** (`PCFSoftShadowMap`), dynamischer Tag-Nacht-Zyklus, Himmelsverlauf, Sterne & Wolken
  - Animierte Wasseroberfläche mit Wellen & Fresnel-Reflexion sowie sanft wiegende Vegetation
  - Staggered Chunk-Streaming & Grafik-Presets (*Niedrig*, *Mittel*, *Hoch*, *Ultra*)
- **Gameplay, Crafting & Survival** (`js/player.js`, `js/inventory.js`):
  - First-Person-Steuerung (WASD, Springen, Sprinten, Schleichen mit Kantenschutz, Kreativ-Flugmodus)
  - Werkbank (3×3), Rezeptbuch mit Auto-Anordnung, **3D-Charaktervorschau im Inventar**
  - **Schmelzofen** (Erze, Sand, Bruchstein, Nahrung), **Truhen** (27 Slots), **Dorfbewohner-Handel**
  - Landwirtschaft (Hacken, Weizen & Karotten anbauen, Wachstum, Tiere züchten)
  - Rüstungen (Leder, Eisen, Gold, Diamant), Werkzeuge mit Haltbarkeit, Bogen & Pfeile, Wassereimer/Lavaeimer
- **Kreaturen & Audio** (`js/entities.js`, `js/audio.js`):
  - Friedliche Tiere (Schwein, Kuh, Schaf, Huhn), Dorfbewohner & feindliche Nacht-/Höhlenkreaturen (Zombie, Skelett, Spinne, Mooswicht)
  - Prozedurale Web-Audio-Soundeffekte & optionale Umgebungsmusik
- **Speichern & Laden** (`js/storage.js`):
  - Mehrere unabhängige Welten mit RLE-komprimierter **IndexedDB**-Speicherung (inkl. Weltveränderungen, Inventar, Öfen, Truhen & Einstellungen)

---

## 🎮 Steuerung

| Taste / Aktion | Funktion |
| :--- | :--- |
| **W, A, S, D** | Bewegen |
| **Maus** | Umsehen |
| **Leertaste** | Springen / Schwimmen (2× im Kreativmodus = Fliegen) |
| **Shift** | Schleichen & Kantenschutz (oder Sinken beim Fliegen) |
| **Strg / 2× W** | Sprinten |
| **Linksklick** | Block abbauen / Mob angreifen / Bogen schießen |
| **Rechtsklick** | Block platzieren / Interagieren / Essen / Hacken / Tiere füttern |
| **1–9 / Mausrad** | Hotbar-Slot wählen |
| **E** | Inventar & Rezeptbuch öffnen / schließen |
| **Q** | Gegenstand fallen lassen |
| **F3** | Debug-Overlay (Koordinaten, Biom, Licht, FPS) |
| **ESC** | Pausemenü / Dialog schließen |

---

## 🚀 Herunterladen & Lokal Starten

### Option 1: Per Git klonen
```bash
git clone https://github.com/nazarisakri777-ux/terravox-voxel-sandbox.git
cd terravox-voxel-sandbox
```

### Option 2: Als ZIP herunterladen
1. Auf GitHub oben rechts auf den grünen Button **`<> Code`** klicken.
2. **`Download ZIP`** wählen und das Archiv entpacken.

### Spiel starten
Da alle Abhängigkeiten (inkl. `vendor/three.min.js`) lokal enthalten sind, brauchst du **keinen Build-Schritt**:

- **Empfohlen (lokaler Webserver):**
  ```bash
  # Mit Python:
  python -m http.server 8080
  # ODER mit Node.js:
  npx serve .
  ```
  Danach im Browser **`http://localhost:8080`** öffnen.
- **Direktstart:** Alternativ kannst du auch einfach `index.html` per Doppelklick im Browser öffnen.

---

## 📁 Projektstruktur

```text
├── index.html          # HTML-Grundgerüst & Menüs/HUD
├── styles.css          # Benutzeroberfläche & Inventory-Design
├── vendor/
│   └── three.min.js    # Three.js r128 (lokal eingebunden)
└── js/
    ├── noise.js        # Seeded PRNG & 2D/3D Simplex Noise
    ├── audio.js        # Web Audio API Sound- & Musiksynthese
    ├── blocks.js       # Blöcke, Items, Crafting- & Schmelzrezepte
    ├── textures.js     # Prozeduraler 16×16 Texturatlas & UI-Icons
    ├── worldgen.js     # Biome, Höhlen, Erze, Bäume & Dörfer
    ├── lighting.js     # BFS SkyLight & BlockLight
    ├── chunk.js        # Greedy Mesher, AO & Custom GLSL Shader
    ├── entities.js     # Tiere, Dorfbewohner, Gegner, Pfeile & Drops
    ├── storage.js      # IndexedDB Welt- & Chunk-Persistenz
    ├── inventory.js    # Inventar, 3D-Paperdoll, Ofen, Truhe & Handel
    ├── player.js       # Physik, DDA-Raycast, Abbau & Interaktion
    ├── ui.js           # Menüs, Einstellungen & HUD
    └── main.js         # Render-Loop, Himmel/Schatten & Streaming
```
