# Panic on the Plates

A co-op kitchen game for 1–4 cooks that runs in the browser. It uses **Three.js** for the 3D and **WebRTC** (PeerJS) for peer-to-peer multiplayer.

**Play:** https://fanaustinca.github.io/panic-on-the-plates/

## Controls
| Key | Action |
| --- | --- |
| `W` `A` `S` `D` | Move |
| `Space` | Jump (over gaps, lasers, fire walls and the Cuckoo) |
| `Enter` (tap) | Grab / place / cook / plate / serve / flip lever |
| `Enter` (hold) | Chop on a board, wash at the sink, spray the fire extinguisher |
| `Esc` | Pause menu |

## The kitchen
Every dish follows the same steps. Take a raw ingredient from its crate and **chop** it. Some ingredients then go into a **pan**, **pot** or **oven**; the icon on the order ticket shows which. Put everything on a **clean plate** and serve it at the **ORDER UP** window. Dirty plates come back through the dish return and have to be **washed** in the sink. Food left cooking too long burns, then catches **fire**, and the fire spreads along the counters. The extinguisher puts it out. Serving the oldest ticket first builds a tip **combo**.

## 8 worlds × 10 levels
| World | Ingredients | Hazards |
| --- | --- | --- |
| Pirate Ship | Salt-Fish, Kraken Tentacle, Barnacle Potato, Sea-Kelp | Tilting deck, cannonballs that punch holes in the floor |
| Glacier | Crystal-Shrimp, Frost-Mushroom, Blue Ice-Corn, Mammoth Meat | Slippery ice, drifting ice floes |
| Volcanic Core | Magma-Pepper, Flame-Steak, Ash-Root, Sulfur-Spore | Fire walls, falling embers, magma geysers |
| Space Station | Astro-Bean, Meteor-Cheese, Vacuum-Bread, Nebula-Tomato | Laser grid doors, gravity failures |
| In the Clouds | Sun-Drop Lemon, Sky-Poultry, Fluff-Melon, Wind-Leek | Air gusts, lightning |
| Jungle Treehouse | Vine-Melon, Tree-Nut, Tree-Frog Leg, Golden Mango | Swaying rope bridges, thieving monkeys |
| Factory | Gear-Corn, Steel-Beef, Bolt-Beans, Alloy-Mushroom | Conveyor belts, reroute levers, floor conveyors |
| Enchanted Clockwork Library | Spell-Sugar, Magic-Flour, Star-Dust Melon, Chrono-Cream | Time dilation, The Cuckoo Trap |

Recipes get more complex through each world, from one chopped ingredient up to four-part feasts. Later levels add shifting walls and retracting bridges. Each world unlocks an outfit mod: Pirate, Winter Parka, Heat-Resistant Suit, Space Suit, Aviator, Explorer, Welding Gear and Wizard Robes. Layouts are generated from fixed seeds and validated for reachability, so every player gets the same 80 levels.

## Multiplayer
- **Quick Match** probes the well-known public room slots, joins the fullest open lobby, or hosts a new one if none are open.
- **Host Room** opens a public room or a private room with a 5-letter code. **Join Code** joins a room by its code, and **Rooms** lists the open public kitchens.
- In the virtual lobby, cooks customise their outfit, colour and skin tone, vote on a level and ready up. The host starts the round, and the most-voted level is played.
- The host runs the kitchen simulation. Each client predicts its own cook's movement, and all hazards are deterministic functions of level time, so they never need to be sent over the network.

## Development
```bash
npm install
npm run dev            # http://localhost:8951  (add ?net=local to test multiplayer across tabs, ?unlock to open every level)
npm test               # build + node logic tests + Puppeteer browser tests
npm run shots -- 2-5   # render screenshots of levels into tests/screenshots/
```
- `tests/logic.mjs` checks that all 80 levels generate, validate and are unique. It then cooks and delivers **every recipe in every level** through the real rules, and covers fire, washing, belts, monkeys and snapshots.
- `tests/e2e.mjs` runs headless Chromium. It renders and pixel-checks the canvas, plays with the real keyboard, renders all 8 worlds, and runs a two-tab multiplayer session (quick match, vote, start, synced movement and actions).
- `tests/shots.mjs` saves screenshots for visual review.

Pushing to `main` runs the tests in GitHub Actions, then deploys `dist/` to GitHub Pages.
