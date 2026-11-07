# Clay Shaper: Pottery Studio

An original HTML5 pottery-shaping game. Mechanics only inspired by clay/pottery
shaping — no copied art, code, names, characters, or assets from Sculpt People
or any existing game. Every title, customer, piece of art, and note of music
is original and procedurally generated at runtime.

## How to play

- A customer orders a pot. The **dashed outline** on the wheel shows the shape
  they want.
- **Drag on the clay** (mouse or touch): drag **right** to push the clay out,
  **left** to pinch it in. The clay nearest your finger moves most; neighbours
  move with it, like real throwing.
- Watch the **Match %** meter. When it is at or above the customer's target,
  tap **🔥 Fire It!** to serve the pot.
- Better matches earn more **coins** and up to 3 **stars**. Serve all
  **20 customers** to become Master Potter.
- Miss the target (or run out of time) and you lose a **heart** — lose all
  3 hearts and the studio day ends (game over, retry from the start).
- Difficulty ramps across the 20 orders: more control points (7 → 11),
  tighter pass marks (65% → 85%), shorter timers (90s → 52s), and wavy rims
  on later pots.
- **Pause** (❚❚) and **mute** (♪) buttons sit at the top-right while playing.
  Music is an original synthesized pentatonic loop (WebAudio); all sound
  effects are synthesized — no audio files, no copyrighted music.

## Files

- `index.html` — the whole game: plain HTML5 + vanilla JS + Canvas, single
  self-contained file. No engine, no external assets, no network needed.
  Portrait-friendly (480×800 logical, scales to fit any screen).
- `test.js` — headless Playwright test (real mouse clicks and drags).
- `test-shots/` — screenshots captured by the test run.

## How to run

Just open `index.html` in any modern browser (desktop or mobile):

```sh
# option 1: double-click index.html
# option 2: serve locally
python3 -m http.server 8000
# then visit http://localhost:8000/
```

No build step, no dependencies, no install.

## How to test

```sh
cd ~/workspace/playables-inspired/clay-shaper
NODE_PATH=~/workspace/tools/pw-shot/node_modules node test.js            # full flow
NODE_PATH=~/workspace/tools/pw-shot/node_modules node test-gameover.js  # focused 3-fails path
```

Requirements: `playwright-core` (in `~/workspace/tools/pw-shot/node_modules`)
and Chromium at `/opt/meta-chromium/chrome`. The test launches headless
Chromium with the Hatch WebGL policy flags used by the other playables in
this folder.

The test drives the game with **real mouse input only** (no state hacking
except a `window.__clay.setRadiiToTarget()` debug hook used to snap the clay
to the target so all 20 levels can be exercised quickly) and checks:

1. Page loads with zero console/page errors; menu screen shows.
2. How to Play opens and returns to the menu.
3. Play starts level 1 (Cosy Soup Bowl, 90s timer, 65% pass mark).
4. A real drag on the clay pushes the radius outward and changes accuracy
   (55% → 66% in the recorded run); a drag back pinches it in.
5. Pause pauses, resume returns to play; mute toggles without error.
6. Fail path: ruined clay scores below the pass mark → submit loses a heart,
   "Try Again" retries the same level.
7. Pass path: snapped clay scores 100% → coins awarded, stars recorded,
   "Next Customer" advances to level 2.
8. Levels 2–20 all complete in turn → **win screen** ("Master Potter!")
   with total coins/score/stars; "Play Again" restarts at level 1.
9. Game-over path: three failed orders on level 1 → game-over screen,
   "Try Again" restarts with 3 hearts.

## Test results

Final run — **Nov 6, 2026**, headless Chromium (playwright-core +
`/opt/meta-chromium/chrome`), real mouse input throughout:

- `test.js` — **ALL TESTS PASSED, 0 console/page errors.** Load (menu, 0
  errors) → How to Play → Play starts level 1 at 55% match (below the 65%
  pass mark, so firing untouched cannot pass) → real drag pushes the clay
  out, 55% → 66% → pause/resume and mute toggle work → ruined clay at 44%
  fails, loses a heart, retry works → snapped clay scores 100%, +15 coins,
  3 stars, advances to level 2 (starts at 47%) → levels 2–20 all complete
  in turn → **win screen**: 870 coins, score 23000, 20×3 stars → Play Again
  restarts at level 1 with 3 hearts → three failed orders → **game-over
  screen** → Try Again restarts with 3 hearts.
- `test-gameover.js` — **GAME-OVER TEST PASSED, 0 console/page errors.**
  Focused re-run of the 3-fails path on the final build: fails at 64%
  → leveldone (2 hearts) → leveldone (1 heart) → gameover (0 hearts)
  → restart works.
- Screenshots: `test-shots/gameplay.png` (level 1 in play: customer,
  dashed target, clay on wheel, 55% meter) and `test-shots/gameover.png`
  ("Day Over!" screen), both visually verified.

Notes from testing: headless Chromium on this VM throttles `requestAnimationFrame`
to ~0.3–4 fps, so the game carries two robustness measures that also help
slow real devices — hit-targets are refreshed synchronously on every
pointerdown, and a 200 ms watchdog redraws if no animation frame ran in the
last 250 ms. Two earlier full runs died mid-way when the VM ran 7–9
concurrent Chromiums from other agents (browser killed under memory
pressure, not a game fault); the final runs above completed cleanly once
load subsided. A test-harness lesson: under heavy load some pointermove
steps are dropped, so the "ruin the clay" steps loop on measured accuracy
instead of a fixed drag count.
