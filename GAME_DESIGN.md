# Game Design Notes

## Core Direction

This project is a minimalist dark digital/system-themed 2D platformer built for browser play on an HTML5 canvas. Visuals should stay abstract, geometric, and code-generated so the prototype remains lightweight and original.

The player character is currently a white/light-blue abstract humanoid placeholder. It should read clearly against the dark system-like environment without requiring sprite art.

## Current Prototype Goal

The current prototype target is a compact playable slice that demonstrates:

- Basic movement and jumping.
- A System Pulse attack.
- A Walker enemy.
- Spike hazards.
- A Gravity Field ability.
- One gravity puzzle room that teaches and tests the Gravity Field mechanic.

## Long-Term Ability Set

Planned player abilities include:

- **Gravity Field**: Temporarily flips gravity for affected entities within a targeted radius.
- **Time Slow**: Slows selected hazards, enemies, or timing windows.
- **Force Pulse**: Pushes enemies, objects, or projectiles away from the player.
- **Anchor Field**: Locks specific entities or physics objects in place.
- **Phase Shift**: Allows brief interaction changes such as passing through selected barriers or hazards.
- **Energy Link**: Connects entities or devices so state changes can transfer between them.

## First Enemy: Walker

The first enemy is the **Walker**:

- Floating A-shaped geometric unit.
- Has **2 HP**.
- Deals contact damage to the player.
- Patrols back and forth across a small platform or lane.
- Uses subtle hover motion so it feels digital and active without needing sprite animation.

## Gravity Field Rules

Gravity Field behavior should follow these rules:

- Show a preview radius before activation.
- On activation, flip gravity for the player and enemies inside the radius.
- Do not leave behind a persistent bubble after activation.
- Affected entities should display simple visual markers so the player can tell who has flipped gravity.
- Pressing **L** resets affected entities back to their normal gravity state.

## Enemy Adaptation Rule

Each enemy can adapt at most once per ability use. Track this with a per-cast ID so the same ability cast cannot trigger repeated adaptations on the same enemy.
