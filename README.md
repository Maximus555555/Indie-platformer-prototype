# Corebound

Corebound is a minimalist 2D platformer prototype built directly with browser-native web files. The goal is to prove out early player movement, a simple combat action, and the first gravity-based ability without using Godot, Unity, or external game engines.

All current visuals are original, code-generated placeholder graphics drawn with the Canvas API. There are no image files, copyrighted sprites, logos, music, or external libraries.

## How to run locally

Open `index.html` in any modern browser.

In Codespaces or any terminal-based environment, start the built-in static server from the repository root:

```bash
npm start
```

Then open the forwarded port. By default the game is served at `http://localhost:8000`; if Codespaces provides a `PORT` value, the start script uses that instead. The server binds to `0.0.0.0` so Codespaces can forward it.

You can also serve the folder directly with Python if desired:

```bash
python3 -m http.server 8000 --bind 0.0.0.0
```

Then visit `http://localhost:8000`.

If a workspace/browser preview still shows an older player or old spikes, hard refresh the page. The page also version-tags its local CSS and JavaScript URLs so preview caches fetch the current files.

Run the lightweight validation before sharing changes:

```bash
npm run check
```

## Controls

- **A / D** or **Left / Right Arrow**: Move left and right
- **W** or **Up Arrow**: Jump
- **S** or **Down Arrow**: Crouch
- **Space** or **mouse click**: Fire **System Pulse**
- **Hold Q**: Preview the currently selected ability range
- **E**: Activate or deactivate the selected ability

## Implemented mechanics

- Canvas-based `requestAnimationFrame` game loop with delta time.
- Responsive gravity-based platformer movement.
- Abstract white/light-blue humanoid player silhouette that faces left or right.
- Crouching visually compresses the player and lowers the collision height.
- Player health starts at 3 HP.
- Falling below the bottom platform area causes 1 damage and respawns at the safe edge of the last solid platform the player touched.
- Reaching 0 HP resets the player to the checkpoint with 3 HP.
- **System Pulse** fires a glowing geometric pulse horizontally, deals 1 damage, and has a cooldown.
- Enemy, hazard, and advanced ability systems remain in code, but Level 1, Room 1 currently starts without enemies or hazards.
- Holding **Q** previews the currently selected ability range when an advanced ability is unlocked.
- Level 1, Room 1 unlocks only the basic **System Pulse** attack; Gravity Field, Time Slow, Force Pulse, Anchor Field, Phase Shift, and Energy Link start locked.
- Level 1, Room 1 is a safe movement-and-jump tutorial with flat ground, two raised platforms, a shallow recovery gap, and screen-edge transition recognition at the right edge.

## GitHub Pages

This prototype is ready for GitHub Pages because it uses only static files:

- `index.html`
- `style.css`
- `game-config.js`
- `game.js`

Later, enable GitHub Pages for the repository branch and point it at the repository root. The same `index.html` file should load in the hosted page.
