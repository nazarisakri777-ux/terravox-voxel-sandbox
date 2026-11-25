// ============================================================
// TERRAVOX — Block, Item, Recipe & Smelting Registry
// ============================================================
window.TV = window.TV || {};

(function (TV) {
  const T = {
    GRASS_TOP: 0, GRASS_SIDE: 1, DIRT: 2, STONE: 3, COBBLE: 4, MOSSY_COBBLE: 5,
    GRANITE: 6, ANDESITE: 7, DEEPSLATE: 8, BEDROCK: 9,
    SAND: 10, SANDSTONE_TOP: 11, SANDSTONE_SIDE: 12, GRAVEL: 13, CLAY: 14,
    SNOW: 15, GRASS_SNOW_SIDE: 16, ICE: 17, DIRT_PATH_TOP: 18, DIRT_PATH_SIDE: 19,
    FARMLAND_DRY: 20, FARMLAND_WET: 21,
    LOG_OAK_SIDE: 22, LOG_OAK_TOP: 23, LOG_BIRCH_SIDE: 24, LOG_BIRCH_TOP: 25,
    LOG_SPRUCE_SIDE: 26, LOG_SPRUCE_TOP: 27,
    PLANKS_OAK: 28, PLANKS_BIRCH: 29, PLANKS_SPRUCE: 30,
    LEAVES_OAK: 31, LEAVES_BIRCH: 32, LEAVES_SPRUCE: 33,
    CRAFTING_TOP: 34, CRAFTING_SIDE: 35, CRAFTING_FRONT: 36,
    FURNACE_TOP: 37, FURNACE_SIDE: 38, FURNACE_FRONT_OFF: 39, FURNACE_FRONT_ON: 40,
    CHEST_TOP: 41, CHEST_SIDE: 42, CHEST_FRONT: 43,
    GLASS: 44, BRICKS: 45, STONE_BRICKS: 46, WOOL_WHITE: 47, WOOL_YELLOW: 48,
    HAY_TOP: 49, HAY_SIDE: 50,
    COAL_ORE: 51, COPPER_ORE: 52, IRON_ORE: 53, GOLD_ORE: 54, DIAMOND_ORE: 55,
    WATER: 56, LAVA: 57, TORCH: 58, LANTERN: 59,
    PLANT_GRASS: 60, PLANT_FERN: 61, FLOWER_RED: 62, FLOWER_WHITE: 63,
    FLOWER_YELLOW: 64, FLOWER_BLUE: 65, CACTUS_SIDE: 66, CACTUS_TOP: 67, SUGARCANE: 68,
    WHEAT_0: 69, WHEAT_1: 70, WHEAT_2: 71, WHEAT_3: 72,
    CARROT_0: 73, CARROT_1: 74, CARROT_2: 75, CARROT_3: 76,
    SAPLING_OAK: 77, SAPLING_BIRCH: 78, SAPLING_SPRUCE: 79,
    DOOR_OAK_BOTTOM: 80, DOOR_OAK_TOP: 81,
    BED_TOP: 82, BED_SIDE: 83,
    COMPOSTER_SIDE: 84, COMPOSTER_TOP: 85
  };

  const B = {
    AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, LOG_OAK: 5, LEAVES_OAK: 6,
    PLANKS_OAK: 7, CRAFTING_TABLE: 8, SAND: 9, WATER: 10, LOG_BIRCH: 11,
    COAL_ORE: 12, IRON_ORE: 13, TALL_GRASS: 14, FLOWER_RED: 15, FLOWER_WHITE: 16,
    DIAMOND_ORE: 17, BEDROCK: 18, TORCH: 19,
    GRANITE: 20, ANDESITE: 21, DEEPSLATE: 22, GRAVEL: 23, SANDSTONE: 24, CLAY: 25,
    SNOW: 26, ICE: 27, LOG_SPRUCE: 28, LEAVES_SPRUCE: 29, LEAVES_BIRCH: 30,
    PLANKS_BIRCH: 31, PLANKS_SPRUCE: 32, COPPER_ORE: 33, GOLD_ORE: 34,
    FURNACE: 35, CHEST: 36, GLASS: 37, DOOR_OAK: 38, STAIRS_OAK: 39, STAIRS_STONE: 40,
    FENCE_OAK: 41, BRICKS: 42, STONE_BRICKS: 43, MOSSY_COBBLE: 44,
    WOOL_WHITE: 45, WOOL_YELLOW: 46, HAY_BALE: 47, LANTERN: 48,
    DIRT_PATH: 49, FARMLAND: 50, LAVA: 51, CACTUS: 52, SUGARCANE: 53,
    FLOWER_YELLOW: 54, FLOWER_BLUE: 55, FERN: 56, WHEAT_CROP: 57, CARROT_CROP: 58,
    SAPLING_OAK: 59, SAPLING_BIRCH: 60, SAPLING_SPRUCE: 61, BED: 62, COMPOSTER: 63
  };

  const BLOCKS = {
    0:  { name: 'Luft', solid: false, transparent: true },
    1:  { name: 'Grasblock', solid: true, transparent: false, hardness: 0.75, tool: 'shovel', mat: 'dirt', tiles: { top: T.GRASS_TOP, bottom: T.DIRT, side: T.GRASS_SIDE }, drop: 2, biomeTint: true },
    2:  { name: 'Erde', solid: true, transparent: false, hardness: 0.65, tool: 'shovel', mat: 'dirt', tiles: { all: T.DIRT }, drop: 2 },
    3:  { name: 'Stein', solid: true, transparent: false, hardness: 1.8, tool: 'pickaxe', minTier: 1, mat: 'stone', tiles: { all: T.STONE }, drop: 4 },
    4:  { name: 'Bruchstein', solid: true, transparent: false, hardness: 2.0, tool: 'pickaxe', minTier: 1, mat: 'stone', tiles: { all: T.COBBLE }, drop: 4 },
    5:  { name: 'Eichenstamm', solid: true, transparent: false, hardness: 1.6, tool: 'axe', mat: 'wood', tiles: { top: T.LOG_OAK_TOP, bottom: T.LOG_OAK_TOP, side: T.LOG_OAK_SIDE }, drop: 5, fuel: 15 },
    6:  { name: 'Eichenlaub', solid: true, transparent: true, leaves: true, hardness: 0.25, mat: 'foliage', tiles: { all: T.LEAVES_OAK }, drop: 59, bonusDrop: 110, bonusChance: 0.14, dropChance: 0.16, biomeTint: true },
    7:  { name: 'Eichenbretter', solid: true, transparent: false, hardness: 1.4, tool: 'axe', mat: 'wood', tiles: { all: T.PLANKS_OAK }, drop: 7, fuel: 15 },
    8:  { name: 'Werkbank', solid: true, transparent: false, hardness: 1.5, tool: 'axe', mat: 'wood', interactive: true, tiles: { top: T.CRAFTING_TOP, bottom: T.PLANKS_OAK, side: T.CRAFTING_SIDE, front: T.CRAFTING_FRONT }, drop: 8, fuel: 15 },
    9:  { name: 'Sand', solid: true, transparent: false, gravity: true, hardness: 0.6, tool: 'shovel', mat: 'sand', tiles: { all: T.SAND }, drop: 9 },
    10: { name: 'Wasser', solid: false, transparent: true, liquid: true, tiles: { all: T.WATER } },
    11: { name: 'Birkenstamm', solid: true, transparent: false, hardness: 1.6, tool: 'axe', mat: 'wood', tiles: { top: T.LOG_BIRCH_TOP, bottom: T.LOG_BIRCH_TOP, side: T.LOG_BIRCH_SIDE }, drop: 11, fuel: 15 },
    12: { name: 'Kohleerz', solid: true, transparent: false, hardness: 2.4, tool: 'pickaxe', minTier: 1, mat: 'stone', tiles: { all: T.COAL_ORE }, drop: 117, xp: 2 },
    13: { name: 'Eisenerz', solid: true, transparent: false, hardness: 2.8, tool: 'pickaxe', minTier: 2, mat: 'stone', tiles: { all: T.IRON_ORE }, drop: 13, xp: 2 },
    14: { name: 'Hohes Gras', solid: false, transparent: true, plant: true, replaceable: true, hardness: 0.05, mat: 'foliage', tile: T.PLANT_GRASS, drop: 137, dropChance: 0.35, biomeTint: true },
    15: { name: 'Mohn', solid: false, transparent: true, plant: true, hardness: 0.05, mat: 'foliage', tile: T.FLOWER_RED, drop: 15 },
    16: { name: 'Margerite', solid: false, transparent: true, plant: true, hardness: 0.05, mat: 'foliage', tile: T.FLOWER_WHITE, drop: 16 },
    17: { name: 'Diamanterz', solid: true, transparent: false, hardness: 4.0, tool: 'pickaxe', minTier: 3, mat: 'stone', tiles: { all: T.DIAMOND_ORE }, drop: 116, xp: 6 },
    18: { name: 'Grundgestein', solid: true, transparent: false, unbreakable: true, mat: 'stone', tiles: { all: T.BEDROCK } },
    19: { name: 'Fackel', solid: false, transparent: true, torch: true, light: 14, hardness: 0.05, mat: 'wood', tile: T.TORCH, drop: 19 },
    20: { name: 'Granit', solid: true, transparent: false, hardness: 1.9, tool: 'pickaxe', minTier: 1, mat: 'stone', tiles: { all: T.GRANITE }, drop: 20 },
    21: { name: 'Andesit', solid: true, transparent: false, hardness: 1.9, tool: 'pickaxe', minTier: 1, mat: 'stone', tiles: { all: T.ANDESITE }, drop: 21 },
    22: { name: 'Tiefenschiefer', solid: true, transparent: false, hardness: 2.8, tool: 'pickaxe', minTier: 1, mat: 'stone', tiles: { all: T.DEEPSLATE }, drop: 22 },
    23: { name: 'Kies', solid: true, transparent: false, gravity: true, hardness: 0.75, tool: 'shovel', mat: 'sand', tiles: { all: T.GRAVEL }, drop: 23 },
    24: { name: 'Sandstein', solid: true, transparent: false, hardness: 1.4, tool: 'pickaxe', minTier: 1, mat: 'stone', tiles: { top: T.SANDSTONE_TOP, bottom: T.SANDSTONE_TOP, side: T.SANDSTONE_SIDE }, drop: 24 },
    25: { name: 'Ton', solid: true, transparent: false, hardness: 0.8, tool: 'shovel', mat: 'dirt', tiles: { all: T.CLAY }, drop: 25 },
    26: { name: 'Schnee', solid: true, transparent: false, hardness: 0.5, tool: 'shovel', mat: 'sand', tiles: { all: T.SNOW }, drop: 26 },
    27: { name: 'Eis', solid: true, transparent: true, slippery: true, hardness: 0.6, tool: 'pickaxe', mat: 'glass', tiles: { all: T.ICE }, drop: 0 },
    28: { name: 'Fichtenstamm', solid: true, transparent: false, hardness: 1.6, tool: 'axe', mat: 'wood', tiles: { top: T.LOG_SPRUCE_TOP, bottom: T.LOG_SPRUCE_TOP, side: T.LOG_SPRUCE_SIDE }, drop: 28, fuel: 15 },
    29: { name: 'Fichtenlaub', solid: true, transparent: true, leaves: true, hardness: 0.25, mat: 'foliage', tiles: { all: T.LEAVES_SPRUCE }, drop: 61, dropChance: 0.16, biomeTint: true },
    30: { name: 'Birkenlaub', solid: true, transparent: true, leaves: true, hardness: 0.25, mat: 'foliage', tiles: { all: T.LEAVES_BIRCH }, drop: 60, dropChance: 0.16, biomeTint: true },
    31: { name: 'Birkenbretter', solid: true, transparent: false, hardness: 1.4, tool: 'axe', mat: 'wood', tiles: { all: T.PLANKS_BIRCH }, drop: 31, fuel: 15 },
    32: { name: 'Fichtenbretter', solid: true, transparent: false, hardness: 1.4, tool: 'axe', mat: 'wood', tiles: { all: T.PLANKS_SPRUCE }, drop: 32, fuel: 15 },
    33: { name: 'Kupfererz', solid: true, transparent: false, hardness: 2.5, tool: 'pickaxe', minTier: 2, mat: 'stone', tiles: { all: T.COPPER_ORE }, drop: 33, xp: 2 },
    34: { name: 'Golderz', solid: true, transparent: false, hardness: 3.2, tool: 'pickaxe', minTier: 3, mat: 'stone', tiles: { all: T.GOLD_ORE }, drop: 34, xp: 4 },
    35: { name: 'Schmelzofen', solid: true, transparent: false, hardness: 2.4, tool: 'pickaxe', minTier: 1, mat: 'stone', interactive: true, directional: true, tiles: { top: T.FURNACE_TOP, bottom: T.FURNACE_TOP, side: T.FURNACE_SIDE, front: T.FURNACE_FRONT_OFF, frontLit: T.FURNACE_FRONT_ON }, drop: 35 },
    36: { name: 'Truhe', solid: true, transparent: false, hardness: 1.6, tool: 'axe', mat: 'wood', interactive: true, directional: true, tiles: { top: T.CHEST_TOP, bottom: T.CHEST_TOP, side: T.CHEST_SIDE, front: T.CHEST_FRONT }, drop: 36 },
    37: { name: 'Glas', solid: true, transparent: true, glass: true, hardness: 0.4, mat: 'glass', tiles: { all: T.GLASS }, drop: 0 },
    38: { name: 'Holztür', solid: true, transparent: true, shape: 'door', interactive: true, hardness: 1.5, tool: 'axe', mat: 'wood', tiles: { bottom: T.DOOR_OAK_BOTTOM, top: T.DOOR_OAK_TOP }, drop: 38 },
    39: { name: 'Holztreppe', solid: true, transparent: true, shape: 'stair', hardness: 1.4, tool: 'axe', mat: 'wood', tiles: { all: T.PLANKS_OAK }, drop: 39, fuel: 15 },
    40: { name: 'Steintreppe', solid: true, transparent: true, shape: 'stair', hardness: 2.0, tool: 'pickaxe', minTier: 1, mat: 'stone', tiles: { all: T.COBBLE }, drop: 40 },
    41: { name: 'Holzzaun', solid: true, transparent: true, shape: 'fence', tall: true, hardness: 1.5, tool: 'axe', mat: 'wood', tiles: { all: T.PLANKS_OAK }, drop: 41, fuel: 15 },
    42: { name: 'Ziegelstein', solid: true, transparent: false, hardness: 2.2, tool: 'pickaxe', minTier: 1, mat: 'stone', tiles: { all: T.BRICKS }, drop: 42 },
    43: { name: 'Steinziegel', solid: true, transparent: false, hardness: 2.1, tool: 'pickaxe', minTier: 1, mat: 'stone', tiles: { all: T.STONE_BRICKS }, drop: 43 },
    44: { name: 'Moosiger Bruchstein', solid: true, transparent: false, hardness: 2.0, tool: 'pickaxe', minTier: 1, mat: 'stone', tiles: { all: T.MOSSY_COBBLE }, drop: 44 },
    45: { name: 'Weiße Wolle', solid: true, transparent: false, hardness: 0.6, mat: 'foliage', tiles: { all: T.WOOL_WHITE }, drop: 45 },
    46: { name: 'Gelbe Wolle', solid: true, transparent: false, hardness: 0.6, mat: 'foliage', tiles: { all: T.WOOL_YELLOW }, drop: 46 },
    47: { name: 'Heuballen', solid: true, transparent: false, hardness: 0.7, mat: 'foliage', tiles: { top: T.HAY_TOP, bottom: T.HAY_TOP, side: T.HAY_SIDE }, drop: 47 },
    48: { name: 'Laterne', solid: false, transparent: true, shape: 'lantern', light: 15, hardness: 1.2, tool: 'pickaxe', mat: 'stone', tile: T.LANTERN, drop: 48 },
    49: { name: 'Trampelpfad', solid: true, transparent: false, hardness: 0.7, tool: 'shovel', mat: 'dirt', tiles: { top: T.DIRT_PATH_TOP, bottom: T.DIRT, side: T.DIRT_PATH_SIDE }, drop: 2 },
    50: { name: 'Ackerboden', solid: true, transparent: false, hardness: 0.7, tool: 'shovel', mat: 'dirt', tiles: { top: T.FARMLAND_DRY, topWet: T.FARMLAND_WET, bottom: T.DIRT, side: T.DIRT }, drop: 2 },
    51: { name: 'Lava', solid: false, transparent: false, liquid: true, lava: true, light: 15, tiles: { all: T.LAVA } },
    52: { name: 'Kaktus', solid: true, transparent: true, cactus: true, hardness: 0.5, mat: 'foliage', tiles: { top: T.CACTUS_TOP, bottom: T.CACTUS_TOP, side: T.CACTUS_SIDE }, drop: 52 },
    53: { name: 'Zuckerrohr', solid: false, transparent: true, plant: true, hardness: 0.1, mat: 'foliage', tile: T.SUGARCANE, drop: 53 },
    54: { name: 'Löwenzahn', solid: false, transparent: true, plant: true, hardness: 0.05, mat: 'foliage', tile: T.FLOWER_YELLOW, drop: 54 },
    55: { name: 'Kornblume', solid: false, transparent: true, plant: true, hardness: 0.05, mat: 'foliage', tile: T.FLOWER_BLUE, drop: 55 },
    56: { name: 'Farn', solid: false, transparent: true, plant: true, replaceable: true, hardness: 0.05, mat: 'foliage', tile: T.PLANT_FERN, drop: 137, dropChance: 0.25, biomeTint: true },
    57: { name: 'Weizenpflanze', solid: false, transparent: true, plant: true, crop: true, hardness: 0.05, mat: 'foliage', tile: T.WHEAT_0, stages: [T.WHEAT_0, T.WHEAT_1, T.WHEAT_2, T.WHEAT_3], drop: 137 },
    58: { name: 'Karottenpflanze', solid: false, transparent: true, plant: true, crop: true, hardness: 0.05, mat: 'foliage', tile: T.CARROT_0, stages: [T.CARROT_0, T.CARROT_1, T.CARROT_2, T.CARROT_3], drop: 138 },
    59: { name: 'Eichensetzling', solid: false, transparent: true, plant: true, sapling: 'oak', hardness: 0.05, mat: 'foliage', tile: T.SAPLING_OAK, drop: 59 },
    60: { name: 'Birkensetzling', solid: false, transparent: true, plant: true, sapling: 'birch', hardness: 0.05, mat: 'foliage', tile: T.SAPLING_BIRCH, drop: 60 },
    61: { name: 'Fichtensetzling', solid: false, transparent: true, plant: true, sapling: 'spruce', hardness: 0.05, mat: 'foliage', tile: T.SAPLING_SPRUCE, drop: 61 },
    62: { name: 'Bett', solid: true, transparent: true, shape: 'bed', interactive: true, hardness: 0.5, mat: 'wood', tiles: { top: T.BED_TOP, bottom: T.PLANKS_OAK, side: T.BED_SIDE }, drop: 62 },
    63: { name: 'Komposter', solid: true, transparent: false, hardness: 1.0, tool: 'axe', mat: 'wood', interactive: true, tiles: { top: T.COMPOSTER_TOP, bottom: T.PLANKS_OAK, side: T.COMPOSTER_SIDE }, drop: 63, fuel: 15 }
  };

  const ITEMS = {
    // Pickaxes (tier 1=wood, 2=stone/copper, 3=iron/gold, 4=diamond)
    101: { name: 'Holzspitzhacke', type: 'tool', toolType: 'pickaxe', tier: 1, speed: 2.5, durability: 60, maxDurability: 60, color: '#9b7643' },
    102: { name: 'Steinspitzhacke', type: 'tool', toolType: 'pickaxe', tier: 2, speed: 4.2, durability: 132, maxDurability: 132, color: '#888888' },
    160: { name: 'Kupferspitzhacke', type: 'tool', toolType: 'pickaxe', tier: 2, speed: 5.2, durability: 190, maxDurability: 190, color: '#d97746' },
    161: { name: 'Eisenspitzhacke', type: 'tool', toolType: 'pickaxe', tier: 3, speed: 6.5, durability: 250, maxDurability: 250, color: '#d1d5db' },
    162: { name: 'Goldspitzhacke', type: 'tool', toolType: 'pickaxe', tier: 2, speed: 9.0, durability: 48, maxDurability: 48, color: '#facc15' },
    163: { name: 'Diamantspitzhacke', type: 'tool', toolType: 'pickaxe', tier: 4, speed: 8.5, durability: 1561, maxDurability: 1561, color: '#22d3ee' },

    // Axes
    103: { name: 'Holzaxt', type: 'tool', toolType: 'axe', tier: 1, speed: 2.6, damage: 3, durability: 60, maxDurability: 60, color: '#9b7643' },
    164: { name: 'Steinaxt', type: 'tool', toolType: 'axe', tier: 2, speed: 4.2, damage: 4, durability: 132, maxDurability: 132, color: '#888888' },
    165: { name: 'Kupferaxt', type: 'tool', toolType: 'axe', tier: 2, speed: 5.2, damage: 5, durability: 190, maxDurability: 190, color: '#d97746' },
    166: { name: 'Eisenaxt', type: 'tool', toolType: 'axe', tier: 3, speed: 6.5, damage: 6, durability: 250, maxDurability: 250, color: '#d1d5db' },
    167: { name: 'Diamantaxt', type: 'tool', toolType: 'axe', tier: 4, speed: 8.5, damage: 7, durability: 1561, maxDurability: 1561, color: '#22d3ee' },

    // Shovels
    104: { name: 'Holzschaufel', type: 'tool', toolType: 'shovel', tier: 1, speed: 2.6, durability: 60, maxDurability: 60, color: '#9b7643' },
    168: { name: 'Steinschaufel', type: 'tool', toolType: 'shovel', tier: 2, speed: 4.2, durability: 132, maxDurability: 132, color: '#888888' },
    169: { name: 'Kupferschaufel', type: 'tool', toolType: 'shovel', tier: 2, speed: 5.2, durability: 190, maxDurability: 190, color: '#d97746' },
    170: { name: 'Eisenschaufel', type: 'tool', toolType: 'shovel', tier: 3, speed: 6.5, durability: 250, maxDurability: 250, color: '#d1d5db' },
    171: { name: 'Diamantschaufel', type: 'tool', toolType: 'shovel', tier: 4, speed: 8.5, durability: 1561, maxDurability: 1561, color: '#22d3ee' },

    // Swords
    105: { name: 'Holzschwert', type: 'tool', toolType: 'sword', damage: 4, durability: 60, maxDurability: 60, color: '#9b7643' },
    106: { name: 'Steinschwert', type: 'tool', toolType: 'sword', damage: 5, durability: 132, maxDurability: 132, color: '#888888' },
    172: { name: 'Kupferschwert', type: 'tool', toolType: 'sword', damage: 6, durability: 190, maxDurability: 190, color: '#d97746' },
    173: { name: 'Eisenschwert', type: 'tool', toolType: 'sword', damage: 7, durability: 250, maxDurability: 250, color: '#d1d5db' },
    174: { name: 'Diamantschwert', type: 'tool', toolType: 'sword', damage: 9, durability: 1561, maxDurability: 1561, color: '#22d3ee' },

    // Hoes
    175: { name: 'Holzhacke', type: 'tool', toolType: 'hoe', durability: 60, maxDurability: 60, color: '#9b7643' },
    176: { name: 'Steinhacke', type: 'tool', toolType: 'hoe', durability: 132, maxDurability: 132, color: '#888888' },
    177: { name: 'Eisenhacke', type: 'tool', toolType: 'hoe', durability: 250, maxDurability: 250, color: '#d1d5db' },
    178: { name: 'Diamanthacke', type: 'tool', toolType: 'hoe', durability: 1561, maxDurability: 1561, color: '#22d3ee' },

    // Ranged & Buckets
    179: { name: 'Bogen', type: 'bow', damage: 7, durability: 384, maxDurability: 384 },
    180: { name: 'Pfeil', type: 'item' },
    181: { name: 'Eimer', type: 'bucket', empty: true },
    182: { name: 'Wassereimer', type: 'bucket', liquid: B.WATER },
    183: { name: 'Lavaeimer', type: 'bucket', liquid: B.LAVA, fuel: 100 },

    // Materials & Crops
    107: { name: 'Stock', type: 'item', fuel: 5 },
    112: { name: 'Leder', type: 'item' },
    114: { name: 'Feder', type: 'item' },
    115: { name: 'Eisenbarren', type: 'item' },
    116: { name: 'Diamant', type: 'item' },
    117: { name: 'Kohle', type: 'item', fuel: 80 },
    118: { name: 'Kupferbarren', type: 'item' },
    119: { name: 'Goldbarren', type: 'item' },
    130: { name: 'Holzkohle', type: 'item', fuel: 80 },
    131: { name: 'Ziegel', type: 'item' },
    132: { name: 'Knochen', type: 'item' },
    133: { name: 'Faden', type: 'item' },
    134: { name: 'Schwarzpulver', type: 'item' },
    135: { name: 'Smaragd', type: 'item' },
    136: { name: 'Weizen', type: 'item' },
    137: { name: 'Weizensamen', type: 'seed', plantsBlock: B.WHEAT_CROP },
    138: { name: 'Karotte', type: 'food', healHunger: 3, plantsBlock: B.CARROT_CROP },
    139: { name: 'Wolle', type: 'item' },

    // Foods
    108: { name: 'Rohes Schweinefleisch', type: 'food', healHunger: 3 },
    140: { name: 'Gebratenes Schweinefleisch', type: 'food', healHunger: 8 },
    109: { name: 'Verrottetes Fleisch', type: 'food', healHunger: 2 },
    110: { name: 'Apfel', type: 'food', healHunger: 4 },
    111: { name: 'Rohes Rindfleisch', type: 'food', healHunger: 3 },
    141: { name: 'Gebratenes Steak', type: 'food', healHunger: 8 },
    113: { name: 'Rohes Hühnchen', type: 'food', healHunger: 2 },
    142: { name: 'Gebratenes Hühnchen', type: 'food', healHunger: 6 },
    143: { name: 'Rohes Hammelfleisch', type: 'food', healHunger: 2 },
    144: { name: 'Gebratenes Hammelfleisch', type: 'food', healHunger: 6 },
    145: { name: 'Brot', type: 'food', healHunger: 6 },

    // Armor (Leather, Iron, Gold, Diamond)
    150: { name: 'Lederkappe', type: 'armor', armorSlot: 'helmet', defense: 1, durability: 55, maxDurability: 55, color: '#92542b' },
    151: { name: 'Lederwams', type: 'armor', armorSlot: 'chestplate', defense: 3, durability: 80, maxDurability: 80, color: '#92542b' },
    152: { name: 'Lederhose', type: 'armor', armorSlot: 'leggings', defense: 2, durability: 75, maxDurability: 75, color: '#92542b' },
    153: { name: 'Lederstiefel', type: 'armor', armorSlot: 'boots', defense: 1, durability: 65, maxDurability: 65, color: '#92542b' },

    120: { name: 'Eisenhelm', type: 'armor', armorSlot: 'helmet', defense: 2, durability: 165, maxDurability: 165, color: '#d1d5db' },
    121: { name: 'Eisen-Brustpanzer', type: 'armor', armorSlot: 'chestplate', defense: 6, durability: 240, maxDurability: 240, color: '#d1d5db' },
    122: { name: 'Eisen-Hose', type: 'armor', armorSlot: 'leggings', defense: 5, durability: 225, maxDurability: 225, color: '#d1d5db' },
    123: { name: 'Eisen-Stiefel', type: 'armor', armorSlot: 'boots', defense: 2, durability: 195, maxDurability: 195, color: '#d1d5db' },

    154: { name: 'Goldhelm', type: 'armor', armorSlot: 'helmet', defense: 2, durability: 77, maxDurability: 77, color: '#facc15' },
    155: { name: 'Gold-Brustpanzer', type: 'armor', armorSlot: 'chestplate', defense: 5, durability: 112, maxDurability: 112, color: '#facc15' },
    156: { name: 'Gold-Hose', type: 'armor', armorSlot: 'leggings', defense: 3, durability: 105, maxDurability: 105, color: '#facc15' },
    157: { name: 'Gold-Stiefel', type: 'armor', armorSlot: 'boots', defense: 1, durability: 91, maxDurability: 91, color: '#facc15' },

    124: { name: 'Diamanthelm', type: 'armor', armorSlot: 'helmet', defense: 3, durability: 363, maxDurability: 363, color: '#22d3ee' },
    125: { name: 'Diamant-Brustpanzer', type: 'armor', armorSlot: 'chestplate', defense: 8, durability: 528, maxDurability: 528, color: '#22d3ee' },
    126: { name: 'Diamant-Hose', type: 'armor', armorSlot: 'leggings', defense: 6, durability: 495, maxDurability: 495, color: '#22d3ee' },
    127: { name: 'Diamant-Stiefel', type: 'armor', armorSlot: 'boots', defense: 3, durability: 429, maxDurability: 429, color: '#22d3ee' }
  };

  function getItemDef(id) {
    return id >= 100 ? ITEMS[id] : BLOCKS[id];
  }

  function getItemName(id) {
    return getItemDef(id)?.name || `Item #${id}`;
  }

  function getFuelDuration(id) {
    return getItemDef(id)?.fuel || 0;
  }

  // Smelting recipes (inputId -> { id, count, xp })
  const SMELTING_RECIPES = {
    [B.IRON_ORE]:   { id: 115, count: 1, xp: 3 },
    [B.COPPER_ORE]: { id: 118, count: 1, xp: 2 },
    [B.GOLD_ORE]:   { id: 119, count: 1, xp: 4 },
    [B.SAND]:       { id: B.GLASS, count: 1, xp: 1 },
    [B.COBBLE]:     { id: B.STONE, count: 1, xp: 1 },
    [B.CLAY]:       { id: 131, count: 1, xp: 1 },
    [B.LOG_OAK]:    { id: 130, count: 1, xp: 1 },
    [B.LOG_BIRCH]:  { id: 130, count: 1, xp: 1 },
    [B.LOG_SPRUCE]: { id: 130, count: 1, xp: 1 },
    108: { id: 140, count: 1, xp: 2 },
    111: { id: 141, count: 1, xp: 2 },
    113: { id: 142, count: 1, xp: 2 },
    143: { id: 144, count: 1, xp: 2 }
  };

  // Helper tags for flexible wood/plank crafting matching
  const ANY_LOG = 'ANY_LOG';
  const ANY_PLANK = 'ANY_PLANK';
  const ANY_COAL = 'ANY_COAL';

  function matchesIngredient(slotId, req) {
    if (!req) return !slotId;
    if (!slotId) return false;
    if (req === ANY_LOG) return slotId === B.LOG_OAK || slotId === B.LOG_BIRCH || slotId === B.LOG_SPRUCE;
    if (req === ANY_PLANK) return slotId === B.PLANKS_OAK || slotId === B.PLANKS_BIRCH || slotId === B.PLANKS_SPRUCE;
    if (req === ANY_COAL) return slotId === 117 || slotId === 130;
    return slotId === req;
  }

  // Unified Shaped & Shapeless Recipe List (used both by Crafting Matrix AND Recipe Book!)
  const RECIPES = [
    // Wood & Basics (2x2 capable)
    { id: 'planks_oak', name: 'Eichenbretter (4x)', w: 1, h: 1, pattern: [B.LOG_OAK], output: { id: B.PLANKS_OAK, count: 4 } },
    { id: 'planks_birch', name: 'Birkenbretter (4x)', w: 1, h: 1, pattern: [B.LOG_BIRCH], output: { id: B.PLANKS_BIRCH, count: 4 } },
    { id: 'planks_spruce', name: 'Fichtenbretter (4x)', w: 1, h: 1, pattern: [B.LOG_SPRUCE], output: { id: B.PLANKS_SPRUCE, count: 4 } },
    { id: 'sticks', name: 'Stöcke (4x)', w: 1, h: 2, pattern: [ANY_PLANK, ANY_PLANK], output: { id: 107, count: 4 } },
    { id: 'crafting_table', name: 'Werkbank', w: 2, h: 2, pattern: [ANY_PLANK, ANY_PLANK, ANY_PLANK, ANY_PLANK], output: { id: B.CRAFTING_TABLE, count: 1 } },
    { id: 'torch', name: 'Fackel (4x)', w: 1, h: 2, pattern: [ANY_COAL, 107], output: { id: B.TORCH, count: 4 } },

    // Functional Blocks (3x3)
    { id: 'furnace', name: 'Schmelzofen', w: 3, h: 3, pattern: [B.COBBLE,B.COBBLE,B.COBBLE, B.COBBLE,null,B.COBBLE, B.COBBLE,B.COBBLE,B.COBBLE], output: { id: B.FURNACE, count: 1 } },
    { id: 'chest', name: 'Truhe', w: 3, h: 3, pattern: [ANY_PLANK,ANY_PLANK,ANY_PLANK, ANY_PLANK,null,ANY_PLANK, ANY_PLANK,ANY_PLANK,ANY_PLANK], output: { id: B.CHEST, count: 1 } },
    { id: 'door_oak', name: 'Holztür (3x)', w: 2, h: 3, pattern: [ANY_PLANK,ANY_PLANK, ANY_PLANK,ANY_PLANK, ANY_PLANK,ANY_PLANK], output: { id: B.DOOR_OAK, count: 3 } },
    { id: 'stairs_oak', name: 'Holztreppe (4x)', w: 3, h: 3, pattern: [ANY_PLANK,null,null, ANY_PLANK,ANY_PLANK,null, ANY_PLANK,ANY_PLANK,ANY_PLANK], output: { id: B.STAIRS_OAK, count: 4 } },
    { id: 'stairs_stone', name: 'Steintreppe (4x)', w: 3, h: 3, pattern: [B.COBBLE,null,null, B.COBBLE,B.COBBLE,null, B.COBBLE,B.COBBLE,B.COBBLE], output: { id: B.STAIRS_STONE, count: 4 } },
    { id: 'fence_oak', name: 'Holzzaun (3x)', w: 3, h: 2, pattern: [ANY_PLANK,107,ANY_PLANK, ANY_PLANK,107,ANY_PLANK], output: { id: B.FENCE_OAK, count: 3 } },
    { id: 'bed', name: 'Bett', w: 3, h: 2, pattern: [B.WOOL_WHITE,B.WOOL_WHITE,B.WOOL_WHITE, ANY_PLANK,ANY_PLANK,ANY_PLANK], output: { id: B.BED, count: 1 } },
    { id: 'lantern', name: 'Laterne', w: 3, h: 3, pattern: [115,115,115, 115,B.TORCH,115, 115,115,115], output: { id: B.LANTERN, count: 1 } },
    { id: 'composter', name: 'Komposter', w: 3, h: 3, pattern: [ANY_PLANK,null,ANY_PLANK, ANY_PLANK,null,ANY_PLANK, ANY_PLANK,ANY_PLANK,ANY_PLANK], output: { id: B.COMPOSTER, count: 1 } },

    // Building Materials
    { id: 'sandstone', name: 'Sandstein', w: 2, h: 2, pattern: [B.SAND,B.SAND, B.SAND,B.SAND], output: { id: B.SANDSTONE, count: 1 } },
    { id: 'stone_bricks', name: 'Steinziegel (4x)', w: 2, h: 2, pattern: [B.STONE,B.STONE, B.STONE,B.STONE], output: { id: B.STONE_BRICKS, count: 4 } },
    { id: 'bricks', name: 'Ziegelstein', w: 2, h: 2, pattern: [131,131, 131,131], output: { id: B.BRICKS, count: 1 } },
    { id: 'hay_bale', name: 'Heuballen', w: 3, h: 3, pattern: [136,136,136, 136,136,136, 136,136,136], output: { id: B.HAY_BALE, count: 1 } },
    { id: 'wool_yellow', name: 'Gelbe Wolle', w: 2, h: 1, pattern: [B.WOOL_WHITE, B.FLOWER_YELLOW], output: { id: B.WOOL_YELLOW, count: 1 } },
    { id: 'bread', name: 'Brot', w: 3, h: 1, pattern: [136, 136, 136], output: { id: 145, count: 1 } },

    // Tools: Pickaxes
    { id: 'pick_wood', name: 'Holzspitzhacke', w: 3, h: 3, pattern: [ANY_PLANK,ANY_PLANK,ANY_PLANK, null,107,null, null,107,null], output: { id: 101, count: 1, durability: 60, maxDurability: 60 } },
    { id: 'pick_stone', name: 'Steinspitzhacke', w: 3, h: 3, pattern: [B.COBBLE,B.COBBLE,B.COBBLE, null,107,null, null,107,null], output: { id: 102, count: 1, durability: 132, maxDurability: 132 } },
    { id: 'pick_copper', name: 'Kupferspitzhacke', w: 3, h: 3, pattern: [118,118,118, null,107,null, null,107,null], output: { id: 160, count: 1, durability: 190, maxDurability: 190 } },
    { id: 'pick_iron', name: 'Eisenspitzhacke', w: 3, h: 3, pattern: [115,115,115, null,107,null, null,107,null], output: { id: 161, count: 1, durability: 250, maxDurability: 250 } },
    { id: 'pick_gold', name: 'Goldspitzhacke', w: 3, h: 3, pattern: [119,119,119, null,107,null, null,107,null], output: { id: 162, count: 1, durability: 48, maxDurability: 48 } },
    { id: 'pick_diamond', name: 'Diamantspitzhacke', w: 3, h: 3, pattern: [116,116,116, null,107,null, null,107,null], output: { id: 163, count: 1, durability: 1561, maxDurability: 1561 } },

    // Tools: Axes
    { id: 'axe_wood', name: 'Holzaxt', w: 2, h: 3, pattern: [ANY_PLANK,ANY_PLANK, ANY_PLANK,107, null,107], output: { id: 103, count: 1, durability: 60, maxDurability: 60 } },
    { id: 'axe_stone', name: 'Steinaxt', w: 2, h: 3, pattern: [B.COBBLE,B.COBBLE, B.COBBLE,107, null,107], output: { id: 164, count: 1, durability: 132, maxDurability: 132 } },
    { id: 'axe_copper', name: 'Kupferaxt', w: 2, h: 3, pattern: [118,118, 118,107, null,107], output: { id: 165, count: 1, durability: 190, maxDurability: 190 } },
    { id: 'axe_iron', name: 'Eisenaxt', w: 2, h: 3, pattern: [115,115, 115,107, null,107], output: { id: 166, count: 1, durability: 250, maxDurability: 250 } },
    { id: 'axe_diamond', name: 'Diamantaxt', w: 2, h: 3, pattern: [116,116, 116,107, null,107], output: { id: 167, count: 1, durability: 1561, maxDurability: 1561 } },

    // Tools: Shovels
    { id: 'shovel_wood', name: 'Holzschaufel', w: 1, h: 3, pattern: [ANY_PLANK, 107, 107], output: { id: 104, count: 1, durability: 60, maxDurability: 60 } },
    { id: 'shovel_stone', name: 'Steinschaufel', w: 1, h: 3, pattern: [B.COBBLE, 107, 107], output: { id: 168, count: 1, durability: 132, maxDurability: 132 } },
    { id: 'shovel_copper', name: 'Kupferschaufel', w: 1, h: 3, pattern: [118, 107, 107], output: { id: 169, count: 1, durability: 190, maxDurability: 190 } },
    { id: 'shovel_iron', name: 'Eisenschaufel', w: 1, h: 3, pattern: [115, 107, 107], output: { id: 170, count: 1, durability: 250, maxDurability: 250 } },
    { id: 'shovel_diamond', name: 'Diamantschaufel', w: 1, h: 3, pattern: [116, 107, 107], output: { id: 171, count: 1, durability: 1561, maxDurability: 1561 } },

    // Tools: Swords & Hoes
    { id: 'sword_wood', name: 'Holzschwert', w: 1, h: 3, pattern: [ANY_PLANK, ANY_PLANK, 107], output: { id: 105, count: 1, durability: 60, maxDurability: 60 } },
    { id: 'sword_stone', name: 'Steinschwert', w: 1, h: 3, pattern: [B.COBBLE, B.COBBLE, 107], output: { id: 106, count: 1, durability: 132, maxDurability: 132 } },
    { id: 'sword_copper', name: 'Kupferschwert', w: 1, h: 3, pattern: [118, 118, 107], output: { id: 172, count: 1, durability: 190, maxDurability: 190 } },
    { id: 'sword_iron', name: 'Eisenschwert', w: 1, h: 3, pattern: [115, 115, 107], output: { id: 173, count: 1, durability: 250, maxDurability: 250 } },
    { id: 'sword_diamond', name: 'Diamantschwert', w: 1, h: 3, pattern: [116, 116, 107], output: { id: 174, count: 1, durability: 1561, maxDurability: 1561 } },

    { id: 'hoe_wood', name: 'Holzhacke', w: 2, h: 3, pattern: [ANY_PLANK,ANY_PLANK, null,107, null,107], output: { id: 175, count: 1, durability: 60, maxDurability: 60 } },
    { id: 'hoe_stone', name: 'Steinhacke', w: 2, h: 3, pattern: [B.COBBLE,B.COBBLE, null,107, null,107], output: { id: 176, count: 1, durability: 132, maxDurability: 132 } },
    { id: 'hoe_iron', name: 'Eisenhacke', w: 2, h: 3, pattern: [115,115, null,107, null,107], output: { id: 177, count: 1, durability: 250, maxDurability: 250 } },
    { id: 'hoe_diamond', name: 'Diamanthacke', w: 2, h: 3, pattern: [116,116, null,107, null,107], output: { id: 178, count: 1, durability: 1561, maxDurability: 1561 } },

    // Bow, Arrows, Bucket
    { id: 'bow', name: 'Bogen', w: 3, h: 3, pattern: [null,107,133, 107,null,133, null,107,133], output: { id: 179, count: 1, durability: 384, maxDurability: 384 } },
    { id: 'arrow', name: 'Pfeile (4x)', w: 1, h: 3, pattern: [B.COBBLE, 107, 114], output: { id: 180, count: 4 } },
    { id: 'bucket', name: 'Eimer', w: 3, h: 2, pattern: [115,null,115, null,115,null], output: { id: 181, count: 1 } },

    // Armor sets (Leather, Iron, Gold, Diamond)
    { id: 'leather_helm', name: 'Lederkappe', w: 3, h: 2, pattern: [112,112,112, 112,null,112], output: { id: 150, count: 1, durability: 55, maxDurability: 55 } },
    { id: 'leather_chest', name: 'Lederwams', w: 3, h: 3, pattern: [112,null,112, 112,112,112, 112,112,112], output: { id: 151, count: 1, durability: 80, maxDurability: 80 } },
    { id: 'leather_legs', name: 'Lederhose', w: 3, h: 3, pattern: [112,112,112, 112,null,112, 112,null,112], output: { id: 152, count: 1, durability: 75, maxDurability: 75 } },
    { id: 'leather_boots', name: 'Lederstiefel', w: 3, h: 2, pattern: [112,null,112, 112,null,112], output: { id: 153, count: 1, durability: 65, maxDurability: 65 } },

    { id: 'iron_helm', name: 'Eisenhelm', w: 3, h: 2, pattern: [115,115,115, 115,null,115], output: { id: 120, count: 1, durability: 165, maxDurability: 165 } },
    { id: 'iron_chest', name: 'Eisen-Brustpanzer', w: 3, h: 3, pattern: [115,null,115, 115,115,115, 115,115,115], output: { id: 121, count: 1, durability: 240, maxDurability: 240 } },
    { id: 'iron_legs', name: 'Eisen-Hose', w: 3, h: 3, pattern: [115,115,115, 115,null,115, 115,null,115], output: { id: 122, count: 1, durability: 225, maxDurability: 225 } },
    { id: 'iron_boots', name: 'Eisen-Stiefel', w: 3, h: 2, pattern: [115,null,115, 115,null,115], output: { id: 123, count: 1, durability: 195, maxDurability: 195 } },

    { id: 'gold_helm', name: 'Goldhelm', w: 3, h: 2, pattern: [119,119,119, 119,null,119], output: { id: 154, count: 1, durability: 77, maxDurability: 77 } },
    { id: 'gold_chest', name: 'Gold-Brustpanzer', w: 3, h: 3, pattern: [119,null,119, 119,119,119, 119,119,119], output: { id: 155, count: 1, durability: 112, maxDurability: 112 } },
    { id: 'gold_legs', name: 'Gold-Hose', w: 3, h: 3, pattern: [119,119,119, 119,null,119, 119,null,119], output: { id: 156, count: 1, durability: 105, maxDurability: 105 } },
    { id: 'gold_boots', name: 'Gold-Stiefel', w: 3, h: 2, pattern: [119,null,119, 119,null,119], output: { id: 157, count: 1, durability: 91, maxDurability: 91 } },

    { id: 'diamond_helm', name: 'Diamanthelm', w: 3, h: 2, pattern: [116,116,116, 116,null,116], output: { id: 124, count: 1, durability: 363, maxDurability: 363 } },
    { id: 'diamond_chest', name: 'Diamant-Brustpanzer', w: 3, h: 3, pattern: [116,null,116, 116,116,116, 116,116,116], output: { id: 125, count: 1, durability: 528, maxDurability: 528 } },
    { id: 'diamond_legs', name: 'Diamant-Hose', w: 3, h: 3, pattern: [116,116,116, 116,null,116, 116,null,116], output: { id: 126, count: 1, durability: 495, maxDurability: 495 } },
    { id: 'diamond_boots', name: 'Diamant-Stiefel', w: 3, h: 2, pattern: [116,null,116, 116,null,116], output: { id: 127, count: 1, durability: 429, maxDurability: 429 } }
  ];

  // Match a 2x2 or 3x3 crafting grid against RECIPES (supports offset anywhere inside grid!)
  function matchCraftingGrid(craftSlots, gridSize) {
    let minC = gridSize, maxC = -1, minR = gridSize, maxR = -1;
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        if (craftSlots[r * gridSize + c]) {
          if (c < minC) minC = c;
          if (c > maxC) maxC = c;
          if (r < minR) minR = r;
          if (r > maxR) maxR = r;
        }
      }
    }
    if (maxC < minC) return null; // Empty grid
    const subW = maxC - minC + 1;
    const subH = maxR - minR + 1;

    for (const rec of RECIPES) {
      if (rec.w !== subW || rec.h !== subH) continue;
      let matched = true;
      for (let rr = 0; rr < subH && matched; rr++) {
        for (let cc = 0; cc < subW; cc++) {
          const slot = craftSlots[(minR + rr) * gridSize + (minC + cc)];
          const req = rec.pattern[rr * rec.w + cc];
          if (!matchesIngredient(slot?.id, req)) {
            matched = false;
            break;
          }
        }
      }
      if (matched) return { ...rec.output };
    }
    return null;
  }

  TV.TILES = T;
  TV.B = B;
  TV.BLOCKS = BLOCKS;
  TV.ITEMS = ITEMS;
  TV.RECIPES = RECIPES;
  TV.SMELTING_RECIPES = SMELTING_RECIPES;
  TV.ANY_LOG = ANY_LOG;
  TV.ANY_PLANK = ANY_PLANK;
  TV.ANY_COAL = ANY_COAL;
  TV.matchesIngredient = matchesIngredient;
  TV.matchCraftingGrid = matchCraftingGrid;
  TV.getItemDef = getItemDef;
  TV.getItemName = getItemName;
  TV.getFuelDuration = getFuelDuration;
})(window.TV);
