# Rebuild notes
- [x] copied
- [x] node_modules copied via cp -a (tar --exclude=dist had broken lucide-react)
- [x] Task 3 hero imports in characters.ts; Task 4 HUD hero prop (App passes currentHero); Task 5 stats in constants.ts (INITIAL + BOSS_TEST_*), engine/App use them
- [x] screenshot removed (public/assets/aistudio deleted, MainMenu gradient bg)
- [ ] next: src/game/ArtKit.ts (glow sprites, rng), ArenaRenderer rewrite in arenas.ts, Visuals.ts rewrite, FX.ts, engine renderBackdrop
- [x] arena renderer done (arenas.ts + ArtKit.ts), vite base './', manifest relative, .nojekyll in public
- PERF: shadowBlur is the swiftshader killer (1500ms->30ms/frame). Removed from engine/weather; never use in Visuals. QA scripts in /workspace/qa (serve.sh, shot.js, base2.js, prof.js)
- [x] Visuals.ts rewritten (sprites), FX.ts, engine wired (projectiles/particles/FX hooks). next: visual iteration
- [x] QA: 844x390 + 390x844 touch, 0 console errors, 0 4xx; frame avg ~28-42ms (swiftshader). Boss spawn moved to (250,-150), boss hp 90000 (still dies in seconds vs lvl-8 evolved spells).
- [x] deployed: https://alhjmiiy-netizen.github.io/magic-survival-rebuild/ (main=dist, source branch=src)

## Round 2 (Nov 2 2026, user phone bug report)
- [x] 1 HUD redesign: HUD.tsx rewritten with orientation-aware absolute blocks (stats, timer, currency+pause, radar, powers strip, collapsible quests (collapsed by default), utility col, belt, joystick, dash). Banners moved to 32%/60%. Playwright rect check: 0 overlaps both orientations (qa/overlap.js).
- [x] 2+6 facing/float: Visuals.getMage(view front/side/back), dir8(), renderArchmage(faceAngle, moveAmt): hover lift+bob, shrinking ground shadow, lean, cloak afterimage trail. Engine faceAngle smoothed from last movement. Verified via qa/face.js crops (front/side/back differ). Enemies already face player.
- [x] 3 start spell select: StartSpellModal (LevelUpModal.tsx), engine paused + spells=[] until pick; boss test labelled, starts picked spell Lv5 + boosted stats (BOSS_TEST_PLAYER_STATS), boss hp 40000.
- [x] 4 passive magic: src/game/spells.ts (level-1 defs + applySpellLevel), engine autoCast with global stagger gap (0.35*0.75^n) and Fast Casting (cooldown *0.9^n); learnSpell/levelSpell/getUpgradeChoices/applyUpgrade; LevelUpModal driven by engine choices; manual cast removed; stats 100/5%/1.8x/0 CDR; early-wave enemy scaling.
- [x] 5 powers strip fed by onSpellsUpdate (+ Fast Casting chip).
- [x] 7 combos: engine.checkCombos uses canFormCombo (both Lv6) -> combo spell that casts both components boosted. QA: qa/flow.js.
- [x] SW: workbox skipWaiting/clientsClaim/cleanupOutdatedCaches, cacheId magic-survival-v2.

## Round 3 (2026-11-02 PST)
1. Floating joystick: full-screen touchpad under HUD (pointer capture, per-pointerId, R=52, deadzone 0.14, analog speed in engine). Fixed joystick removed. Dash fires on pointerdown so it works with a second finger. QA touch.js: base spawns at touch point, player moves R/L/U/D/diag at 844x390 & 390x844; HUD touch doesn't spawn it.
2. Magic bar: bottom-centre glass bar, 52px tiles, Lv badge, pips, cooldown ring (rAF via getCooldowns), tap = tooltip, toast + flash on learn/level. Items belt separate (right, above Dash, labelled ITEMS, potion icons + counts).
3. Cards: grid 2/4 cols, icon orb art, element frame, name + Lv badge, one-line effect (spellEffectText). Header visible and all cards in view at both sizes.
4. Polish: .glass-panel on menu tiles/bar, Research letter, level-up/start headers.
5. White screen: not reproduced (rapid level-ups, game over, quit-to-menu, 60s+ run all fine, heap ~8MB, 0 errors). Video looks like the browser/tab being killed. Hardening: ErrorBoundary recover screen, dark html background inline (no white flash on reload/SW update), stuck initial weather banner now clears.
6. Mage sprite matched to Caelen portrait: blue-violet crystal wings (front/side/back), longer silver hair, near-black coat with violet belt + cyan gem; 8-dir facing/float unchanged. v3-mage-match.png.

## Round 4 — Issue #1: hero selection now changes the in-game character
- `Visuals.ts`: `HERO_LOOKS` + `getHeroSprite(heroId, view)` — per-hero 8-direction sprites (wings, hair/hood/horns/antlers, outfit colours, weapon, halo/crown/rings) matching each portrait; Caelen keeps the item-6 mage sprite. `renderArchmage` takes `heroId`; ground aura per hero.
- `GameEngine.ts`: passes `currentHero.id`; copies initial stats.
- `App.tsx`: `heroRef` + `applyHeroBonuses` — bonuses applied at run start and as deltas on mid-run switch; removed `currentHero` from engine-init deps (no stale restart), consecutive picks work.
- QA: `/workspace/qa/hero.js` at 844x390 and 390x844 (touch), all 10 heroes, 0 console errors. Shots: v4-hero-*.png.

## Round 5 — cohesion: in-game heroes match their menu portraits (2026-11-03 PST)
- `Visuals.ts`: ground rune circle now per-hero colour (`getMageCircle(aura, trim)`, cached per colour) instead of cyan for everyone; staff-tip glow uses hero `weaponGlow`, body glow uses hero aura; fire-hand heroes (Kael, Zephyr, Ignis) get bigger 2-tone hand flames + additive hand glow; Vane dagger glow.
- Signature features: Moros bone skull face inside hood; Ignis flame-tipped horns; Eldrin brown antlers with glowing green tips + crystal staff head; Nyx blue chest gem; orbStaff heads now crystal (Lyra/Eldrin/Nyx).
- `HUD.tsx`: portrait ring border + glow and hero name tag use `hero.color`.
- QA: `/workspace/qa/cohesion.js` (dsf 3, clears spells/enemies for clean crops; menu screenshot | portrait | front/side/back). 844x390 + 390x844 touch, 10 heroes, 0 console errors. Shots: v5-cohesion-<hero>.png, -port.png, v5-cohesion-all.png.
- Known: arena backdrop's cyan rune lines dominate crops regardless of hero (arena art, not hero); sprites remain ~50px chibi so portrait detail (armour plates, robe embroidery) is simplified.

## Fix: Altar research resets (2026-11-03 PST)
- Root cause: `UpgradeModal` kept ranks/points in component-local `useState(INITIAL_RESEARCH_ATTRIBUTES)` / `useState(3)`, nothing saved to localStorage, so every reopen/reload re-initialised to defaults. Gold was also run-local (engine started from `INITIAL_PLAYER_STATS.gold = 0`), so spent gold/bought points vanished and research never applied at run start.
- Fix: `src/game/research.ts` — `ms_research_v1` {points, ranks, gold}; loaded on modal mount and app start, saved synchronously on every enhance/reset/buy; `applyResearch` applies purchased ranks (delta vs defaults: might/vitality/haste/snipe/agility/explorer/saturation) + gold wallet at engine init; App saves gold on change. Load merges/clamps (no wipe on unknown/partial data). No previous save existed to migrate.
- Regression: `qa/research-persist.js <url> <shotdir> <tag>` (390x844 touch): buy point + 4 enhances, close/reopen, run start (effects + gold), reload.
