# Indie Platformer Prototype

A minimalist 2D platformer prototype built directly with browser-native web files. The goal is to prove out early player movement, a simple combat action, and the first gravity-based ability without using Godot, Unity, or external game engines.

All current visuals are original, code-generated placeholder graphics drawn with the Canvas API. There are no image files, copyrighted sprites, logos, music, or external libraries.

## How to run locally

Open `index.html` in any modern browser.

You can also serve the folder with a tiny local web server if desired:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

If a workspace/browser preview still shows an older player or old spikes, hard refresh the page. The page also version-tags its local CSS and JavaScript URLs so preview caches fetch the current files.

## Controls

- **A / D**: Move left and right
- **W**: Jump
- **S**: Crouch
- **Space** or **mouse click**: Fire **System Pulse**
- **Hold Q**: Preview Gravity Field range
- **E**: Activate or deactivate Gravity Field

## Implemented mechanics

- Canvas-based `requestAnimationFrame` game loop with delta time.
- Responsive gravity-based platformer movement.
- Abstract white/light-blue humanoid player silhouette that faces left or right.
- Crouching visually compresses the player and lowers the collision height.
- Player health starts at 3 HP.
- Falling below the bottom platform area causes 1 damage and respawns at the safe edge of the last solid platform the player touched.
- Reaching 0 HP resets the player to the checkpoint with 3 HP.
- **System Pulse** fires a glowing geometric pulse horizontally, deals 1 damage, and has a cooldown.
- Simple enemy placeholder with 2 HP, contact damage, patrol movement, collision boxes, and geometric hover/scanner effects.
- **Gravity Field** preview appears as a circular range outline while Q is held.
- Pressing E tags valid entities inside the range for the current cast ID and flips their gravity.
- Pressing E again deactivates the ability and resets affected entities to normal gravity.
- Affected entities show a small marker and retain flipped gravity even after leaving the original range.
- Test room includes platforms, a checkpoint marker, safe respawn anchor, pit gap, and one enemy target.

## GitHub Pages

This prototype is ready for GitHub Pages because it uses only static files:

- `index.html`
- `style.css`
- `game.js`

Later, enable GitHub Pages for the repository branch and point it at the repository root. The same `index.html` file should load in the hosted page.
