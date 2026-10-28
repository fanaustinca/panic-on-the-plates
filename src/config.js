// Static game data: worlds, ingredients, recipes, outfits and tuning constants.
// Everything here is plain data so the node logic tests can import it.

export const VERSION = '1.0.0';
export const MAX_PLAYERS = 4;
export const NET_HZ = 15;

// Ingredient methods: every ingredient is chopped first, then (optionally) cooked.
//   chop -> served chopped    pan -> fried on a stove pan
//   pot  -> boiled in a pot   oven -> baked in an oven
export const METHODS = ['chop', 'pan', 'pot', 'oven'];
export const METHOD_LABEL = { chop: 'Chopped', pan: 'Fried', pot: 'Boiled', oven: 'Baked' };

// shape = mesh archetype (render/items.js); c1 skin, c2 flesh / inner, c3 accent
export const WORLDS = [
  {
    id: 'pirate', name: 'Pirate Ship', blurb: 'Tilting decks and cannonball holes.',
    outfit: 'pirate', sky: 0x7fc4e8, fog: 0x9fd2ee, floor: 'planks', wall: 'hull', voidKind: 'sea',
    ingredients: [
      { id: 'saltfish', name: 'Salt-Fish', method: 'pan', shape: 'fish', c1: 0x8fa8b8, c2: 0xf1e2d0, c3: 0x51677a },
      { id: 'kraken', name: 'Giant Kraken Tentacle', method: 'pot', shape: 'tentacle', c1: 0xb0457a, c2: 0xf3c4d8, c3: 0xf7d9e6 },
      { id: 'barnpotato', name: 'Barnacle Potato', method: 'oven', shape: 'potato', c1: 0xa8865a, c2: 0xf1e3b0, c3: 0xdcd6c8 },
      { id: 'seakelp', name: 'Sea-Kelp', method: 'chop', shape: 'kelp', c1: 0x3f7f3a, c2: 0x7fbf5a, c3: 0x2c5a2a },
    ],
    dishes: ['Kelp Ribbons', 'Seared Salt-Fish', 'Fish & Kelp Plate', 'Kraken Chowder', 'Kraken Kelp Bowl',
      'Barnacle Bake', 'Surf-n-Surf', 'Captain\'s Platter', 'Kraken Pot Pie', 'Plunderer\'s Feast'],
  },
  {
    id: 'glacier', name: 'Glacier', blurb: 'Slippery ice and drifting floes.',
    outfit: 'parka', sky: 0xbfe3f5, fog: 0xd8eef8, floor: 'ice', wall: 'snowbrick', voidKind: 'arctic',
    ingredients: [
      { id: 'crysshrimp', name: 'Glacier Crystal-Shrimp', method: 'chop', shape: 'shrimp', c1: 0x9fe6ff, c2: 0xe9fbff, c3: 0x5ec6ef },
      { id: 'frostshroom', name: 'Frost-Mushroom', method: 'pot', shape: 'mushroom', c1: 0x7fb3e0, c2: 0xf3f7fb, c3: 0xffffff },
      { id: 'icecorn', name: 'Blue Ice-Corn', method: 'oven', shape: 'corn', c1: 0x3f7fe0, c2: 0x9fd0ff, c3: 0x87b56a },
      { id: 'mammoth', name: 'Mammoth Meat', method: 'pan', shape: 'drumbone', c1: 0xa4483c, c2: 0xe9c9a5, c3: 0xf5efe3 },
    ],
    dishes: ['Crystal Sashimi', 'Mammoth Sizzle', 'Tundra Surf Board', 'Frost Broth', 'Shrimp Frost Bowl',
      'Ice-Corn Bake', 'Mammoth Stew Plate', 'Avalanche Platter', 'Snowdrift Gratin', 'Glacier Banquet'],
  },
  {
    id: 'volcano', name: 'Volcanic Core', blurb: 'Fire walls, embers and magma geysers.',
    outfit: 'heatsuit', sky: 0x3a1410, fog: 0x5a1f12, floor: 'basalt', wall: 'obsidian', voidKind: 'lava',
    ingredients: [
      { id: 'magmapepper', name: 'Magma-Pepper', method: 'chop', shape: 'pepper', c1: 0xff4a1a, c2: 0xffc23a, c3: 0x3d8a2a },
      { id: 'flamesteak', name: 'Flame-Steak', method: 'pan', shape: 'steak', c1: 0xc0392b, c2: 0xf6c6b0, c3: 0xffa53a },
      { id: 'ashroot', name: 'Ash-Root', method: 'oven', shape: 'root', c1: 0x6b6460, c2: 0xd9c9a8, c3: 0x8a8a8a },
      { id: 'sulfurspore', name: 'Sulfur-Spore', method: 'pot', shape: 'spore', c1: 0xe8d23a, c2: 0xfff6a8, c3: 0xa89a1a },
    ],
    dishes: ['Pepper Shards', 'Blackened Flame-Steak', 'Lava Fajita', 'Spore Bubbler', 'Brimstone Soup',
      'Roasted Ash-Root', 'Eruption Combo', 'Caldera Platter', 'Smoldering Hotpot', 'Core Meltdown Feast'],
  },
  {
    id: 'space', name: 'Space Station', blurb: 'Laser grid doors and gravity failures.',
    outfit: 'spacesuit', sky: 0x070a1c, fog: 0x0b1030, floor: 'metalgrid', wall: 'hullpanel', voidKind: 'space',
    ingredients: [
      { id: 'astrobean', name: 'Astro-Bean', method: 'pot', shape: 'bean', c1: 0x5ad1a0, c2: 0xd8fff0, c3: 0x2a8a6a },
      { id: 'meteorcheese', name: 'Meteor-Cheese', method: 'pan', shape: 'cheese', c1: 0xffc93a, c2: 0xfff0a8, c3: 0x7a6a5a },
      { id: 'vacbread', name: 'Vacuum-Bread', method: 'oven', shape: 'bread', c1: 0xd99a4a, c2: 0xfbe7c0, c3: 0xc0c8d0 },
      { id: 'nebtomato', name: 'Nebula-Tomato', method: 'chop', shape: 'tomato', c1: 0x9a3ad9, c2: 0xff7ad0, c3: 0x3ad97a },
    ],
    dishes: ['Nebula Salsa', 'Meteor Melt', 'Cosmic Nachos', 'Astro-Bean Broth', 'Orbit Bean Salad',
      'Vacuum Loaf', 'Comet Fondue Plate', 'Galaxy Sandwich', 'Bean & Bread Rations', 'Mission Control Feast'],
  },
  {
    id: 'clouds', name: 'In the Clouds', blurb: 'Air gusts and lightning storms.',
    outfit: 'aviator', sky: 0xa6c8ff, fog: 0xd6e4ff, floor: 'cloudtile', wall: 'marble', voidKind: 'sky',
    ingredients: [
      { id: 'sunlemon', name: 'Sun-Drop Lemon', method: 'chop', shape: 'lemon', c1: 0xffe14a, c2: 0xfff8c0, c3: 0xffb21a },
      { id: 'skypoultry', name: 'Sky-Poultry', method: 'oven', shape: 'poultry', c1: 0xf5d7b8, c2: 0xfff1e0, c3: 0xffffff },
      { id: 'fluffmelon', name: 'Fluff-Melon', method: 'pot', shape: 'melon', c1: 0xf6e8ff, c2: 0xffb6d9, c3: 0xe0c8ff },
      { id: 'windleek', name: 'Wind-Leek', method: 'pan', shape: 'leek', c1: 0x6fc46a, c2: 0xf1fae8, c3: 0xd8f0c8 },
    ],
    dishes: ['Lemon Zest Sky-Bites', 'Breezy Leek Fry', 'Tailwind Toss', 'Fluff-Melon Soup', 'Citrus Cloud Bowl',
      'Roast Sky-Poultry', 'Stormfront Stir', 'Jet-Stream Platter', 'Thunderhead Roast', 'Stratosphere Feast'],
  },
  {
    id: 'jungle', name: 'Jungle Treehouse', blurb: 'Swaying rope bridges and thieving monkeys.',
    outfit: 'explorer', sky: 0x8fd18a, fog: 0x6fae6a, floor: 'bamboo', wall: 'trunk', voidKind: 'canopy',
    ingredients: [
      { id: 'vinemelon', name: 'Vine-Melon', method: 'chop', shape: 'melon', c1: 0x3f9a3a, c2: 0xff6a5a, c3: 0x2a6a2a },
      { id: 'treenut', name: 'Tree-Nut', method: 'oven', shape: 'nut', c1: 0x8a5a2a, c2: 0xf1d9a8, c3: 0x5a3a1a },
      { id: 'frogleg', name: 'Tree-Frog Leg', method: 'pan', shape: 'frogleg', c1: 0x5ad13a, c2: 0xf1f8d0, c3: 0xffd23a },
      { id: 'goldmango', name: 'Golden Mango', method: 'pot', shape: 'mango', c1: 0xffb81a, c2: 0xffd86a, c3: 0x5aa83a },
    ],
    dishes: ['Vine-Melon Wedges', 'Hopping Frog Fry', 'Canopy Crunch', 'Golden Mango Stew', 'Mango Melon Bowl',
      'Toasted Tree-Nut', 'Swamp Surprise', 'Expedition Platter', 'Nutty Mango Bake', 'Treetop Feast'],
  },
  {
    id: 'factory', name: 'Factory', blurb: 'Conveyor belts and reroute levers.',
    outfit: 'welder', sky: 0x5a6470, fog: 0x6a7480, floor: 'steelplate', wall: 'brickfactory', voidKind: 'pit',
    ingredients: [
      { id: 'gearcorn', name: 'Gear-Corn', method: 'oven', shape: 'corn', c1: 0xc8a23a, c2: 0xffe08a, c3: 0x7a7a7a },
      { id: 'steelbeef', name: 'Steel-Beef', method: 'pan', shape: 'steak', c1: 0x9a5a5a, c2: 0xd8c8c8, c3: 0xb8c0c8 },
      { id: 'boltbeans', name: 'Bolt-Beans', method: 'pot', shape: 'bolt', c1: 0x8a9aa8, c2: 0xd0d8e0, c3: 0x5a6a78 },
      { id: 'alloyshroom', name: 'Alloy-Mushroom', method: 'chop', shape: 'mushroom', c1: 0xa8b0b8, c2: 0xe0e4e8, c3: 0x6a7480 },
    ],
    dishes: ['Alloy Shavings', 'Steel-Beef Sear', 'Assembly-Line Plate', 'Bolt-Bean Chili', 'Hardware Bowl',
      'Gear-Corn Roast', 'Torque & Beans', 'Quality Control Combo', 'Heavy Metal Bake', 'Production Line Feast'],
  },
  {
    id: 'library', name: 'Enchanted Clockwork Library', blurb: 'Time dilation and The Cuckoo Trap.',
    outfit: 'wizard', sky: 0x2a1f3a, fog: 0x3a2a4a, floor: 'parquet', wall: 'bookshelf', voidKind: 'abyss',
    ingredients: [
      { id: 'spellsugar', name: 'Spell-Sugar', method: 'chop', shape: 'crystal', c1: 0xff9ae0, c2: 0xffe0f6, c3: 0xc06ad9 },
      { id: 'magicflour', name: 'Magic-Flour', method: 'oven', shape: 'sack', c1: 0xe8dcc0, c2: 0xffffff, c3: 0x8a6ad9 },
      { id: 'stardustmelon', name: 'Star-Dust Melon', method: 'pan', shape: 'starmelon', c1: 0x2a3a8a, c2: 0xc8d8ff, c3: 0xffe14a },
      { id: 'chronocream', name: 'Chrono-Cream', method: 'pot', shape: 'cream', c1: 0xfff4e0, c2: 0xffffff, c3: 0xd9a84a },
    ],
    dishes: ['Sugar Glyphs', 'Seared Star-Dust', 'Constellation Crumble', 'Chrono-Cream Custard', 'Sweet Hourglass',
      'Enchanted Loaf', 'Midnight Melon Cream', 'Spellbook Sampler', 'Time-Warp Tart', 'Grand Grimoire Feast'],
  },
];

// Recipe templates per world, written as method slots so every world has the same progression.
// Index into WORLDS[w].dishes for the name.
const RECIPE_SLOTS = [
  ['chop'], ['pan'], ['chop', 'pan'], ['pot'], ['pot', 'chop'],
  ['oven'], ['pan', 'pot'], ['oven', 'chop', 'pan'], ['pot', 'oven'], ['chop', 'pan', 'pot', 'oven'],
];

/** Recipes for a world: { id, name, ings: [ingredientId...] } */
export function worldRecipes(wi) {
  const w = WORLDS[wi];
  const byMethod = Object.fromEntries(w.ingredients.map((i) => [i.method, i.id]));
  return RECIPE_SLOTS.map((slots, r) => ({ id: `${w.id}-r${r}`, idx: r, name: w.dishes[r], ings: slots.map((m) => byMethod[m]) }));
}

// Which recipe indices each level number (1..10) of every world serves.
export const LEVEL_RECIPES = [
  [0, 1], [0, 1, 2], [1, 2, 3], [2, 3, 4], [3, 4, 5],
  [4, 5, 6], [5, 6, 7], [6, 7, 8], [7, 8, 9], [2, 6, 8, 9],
];

export const INGREDIENTS = {};
WORLDS.forEach((w, wi) => w.ingredients.forEach((ing, k) => { INGREDIENTS[ing.id] = { ...ing, world: wi, slot: k }; }));

/** The finished state an ingredient must reach before it can go on a plate for a recipe. */
export const finalState = (ingId) => (INGREDIENTS[ingId].method === 'chop' ? 'chopped' : 'cooked');

// Outfits: the classic chef plus one mod per world (unlocked by clearing that world's level 1).
export const OUTFITS = [
  { id: 'chef', name: 'Classic Whites', world: -1 },
  { id: 'pirate', name: 'Pirate Outfit', world: 0 },
  { id: 'parka', name: 'Winter Parka', world: 1 },
  { id: 'heatsuit', name: 'Heat-Resistant Suit', world: 2 },
  { id: 'spacesuit', name: 'Space Suit', world: 3 },
  { id: 'aviator', name: 'Aviator Gear', world: 4 },
  { id: 'explorer', name: 'Explorer Outfit', world: 5 },
  { id: 'welder', name: 'Welding Gear', world: 6 },
  { id: 'wizard', name: 'Wizard Robes', world: 7 },
];
export const COLORS = [0xe8553a, 0x3a8ae8, 0x4ab84a, 0xf2b52a, 0xa05ad8, 0x2ac0b8, 0xf27ab0, 0x5a5a6a];
export const SLOT_COLORS = [0xff6a3d, 0x3d9bff, 0x5ad15a, 0xffcf3d];

// Tuning
export const T = {
  speed: 4.4, accel: 26, radius: 0.3, jumpV: 5.6, gravity: 16,
  chopTime: 1.5, washTime: 1.8, cook: { pan: 7, pot: 9, oven: 10 },
  burnAt: { pan: 1.75, pot: 2.0, oven: 1.9 }, fireAt: { pan: 2.4, pot: 2.7, oven: 2.6 },
  fireSpread: 6, fireGrow: 0.25, sprayRate: 1.4,
  dirtyDelay: 9, respawn: 3, plateRespawn: 12,
};
