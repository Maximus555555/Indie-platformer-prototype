const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const repoRoot = path.resolve(__dirname, "..");
const eventListeners = new Map();
let nextFrameCallback = null;
let now = 0;

function rememberListener(type, listener) {
  if (!eventListeners.has(type)) eventListeners.set(type, []);
  eventListeners.get(type).push(listener);
}

const noop = () => {};
const recordCanvasCall = (name) => function (...args) {
  context.calls.push({ name, args });
};
const context = new Proxy({
  canvas: null,
  calls: [],
  arc: recordCanvasCall("arc"),
  fill: recordCanvasCall("fill"),
  fillRect: recordCanvasCall("fillRect"),
  ellipse: recordCanvasCall("ellipse"),
  lineTo: recordCanvasCall("lineTo"),
  moveTo: recordCanvasCall("moveTo"),
  stroke: recordCanvasCall("stroke"),
  createLinearGradient: () => ({ addColorStop: noop }),
  createRadialGradient: () => ({ addColorStop: noop }),
  measureText: (text) => ({ width: String(text).length * 8 })
}, {
  get(target, property) {
    if (property in target) return target[property];
    return noop;
  },
  set(target, property, value) {
    target[property] = value;
    return true;
  }
});

const canvas = {
  width: 960,
  height: 540,
  getContext: (type) => (type === "2d" ? context : null),
  addEventListener: rememberListener
};
context.canvas = canvas;

const windowStub = {
  addEventListener: rememberListener,
  removeEventListener: noop
};

const sandbox = {
  console,
  document: { getElementById: (id) => (id === "game" ? canvas : null) },
  window: windowStub,
  performance: { now: () => now },
  requestAnimationFrame: (callback) => { nextFrameCallback = callback; },
  cancelAnimationFrame: noop,
  Math,
  Set,
  Number
};

vm.createContext(sandbox);

for (const file of ["game-config.js", "game.js"]) {
  const source = fs.readFileSync(path.join(repoRoot, file), "utf8");
  vm.runInContext(source, sandbox, { filename: file });
}

function tick(ms = 16) {
  if (typeof nextFrameCallback !== "function") {
    throw new Error("Game loop did not schedule requestAnimationFrame.");
  }
  const callback = nextFrameCallback;
  nextFrameCallback = null;
  now += ms;
  callback(now);
}

for (let frame = 0; frame < 90; frame += 1) tick();

const debug = windowStub.__indiePlatformerDebug;
if (!debug) throw new Error("Debug handle was not exposed; boot likely failed.");
if (!debug.player || !Array.isArray(debug.enemies) || debug.enemies.length === 0) {
  throw new Error("Expected player and enemy entities after boot.");
}
if (!Number.isFinite(debug.player.x) || !Number.isFinite(debug.player.y)) {
  throw new Error("Player position became invalid during smoke frames.");
}
if (debug.player.hp <= 0) throw new Error("Player unexpectedly died during idle smoke test.");

function dispatch(type, event) {
  const listeners = eventListeners.get(type) ?? [];
  for (const listener of listeners) listener(event);
}

function keyEvent(key, code = "") {
  return { key, code, preventDefault: noop };
}

// Jump input regression: if Up Arrow events arrive while Right Arrow and Shift
// are held, the player should still jump without needing extra jump buttons.
debug.player.x = 120;
debug.player.y = 420;
debug.player.vx = 0;
debug.player.vy = 0;
debug.player.gravitySign = 1;
debug.player.onSurface = true;
dispatch("keydown", keyEvent("ArrowRight", "ArrowRight"));
dispatch("keydown", keyEvent("Shift", "ShiftLeft"));
dispatch("keydown", keyEvent("ArrowUp", "ArrowUp"));
debug.update(16 / 1000);
if (debug.player.onSurface || debug.player.vy >= -300) {
  throw new Error("Up Arrow jump did not work while holding Right Arrow and Shift.");
}
dispatch("keyup", keyEvent("ArrowUp", "ArrowUp"));
dispatch("keyup", keyEvent("Shift", "ShiftLeft"));
dispatch("keyup", keyEvent("ArrowRight", "ArrowRight"));
debug.player.x = 120;
debug.player.y = 420;
debug.player.vx = 0;
debug.player.vy = 0;
debug.player.onSurface = true;

// Focus-loss regression: browsers may not send keyup after tab switches. Held
// movement and ability-wheel state should clear instead of staying stuck. Keep
// this setup clear of dialogue triggers so the next ability-input checks run.
debug.player.x = 20;
debug.player.y = 420;
debug.player.vx = 0;
debug.player.vy = 0;
debug.player.onSurface = true;
dispatch("keydown", keyEvent("ArrowRight", "ArrowRight"));
debug.update(16 / 1000);
if (debug.player.vx <= 0) throw new Error("Right Arrow setup did not move the player before blur regression.");
dispatch("blur", {});
debug.update(16 / 1000);
if (debug.player.vx !== 0) throw new Error("Blur did not clear held movement input.");
debug.abilityWheel.open = true;
dispatch("blur", {});
if (debug.abilityWheel.open) throw new Error("Blur did not close the ability wheel without selecting.");
debug.player.x = 120;
debug.player.y = 420;
debug.player.vx = 0;
debug.player.vy = 0;
debug.player.onSurface = true;

// Ability UI/input regression: tapping E activates the selected Gravity Field
// through the ability system, starts its timed active window, and delays
// cooldown until the field ends or is cancelled.
const gravityAbility = debug.abilities.find((ability) => ability.id === "gravity");
if (!gravityAbility || !gravityAbility.unlocked) throw new Error("Expected unlocked Gravity Field ability.");
gravityAbility.cooldownRemaining = 0;
gravityAbility.activeRemaining = 0;
dispatch("keydown", keyEvent("e"));
dispatch("keyup", keyEvent("e"));
debug.update(16 / 1000);
if (gravityAbility.cooldownRemaining > 0) {
  throw new Error("Gravity Field cooldown started before its active duration ended.");
}
if (gravityAbility.activeRemaining <= 0) {
  throw new Error("E tap did not start the Gravity Field active duration.");
}
if (debug.player.gravitySign !== -1) {
  throw new Error("E tap did not activate Gravity Field.");
}
if (!debug.activateSelectedAbility()) {
  throw new Error("Gravity Field could not be manually ended while active.");
}
if (debug.player.gravitySign !== 1) {
  throw new Error("Gravity Field deactivation did not restore player gravity.");
}
if (gravityAbility.cooldownRemaining <= 0 || gravityAbility.activeRemaining > 0) {
  throw new Error("Gravity Field cancellation did not start cooldown and clear active time.");
}
if (debug.activateSelectedAbility()) {
  throw new Error("Inactive Gravity Field activation bypassed cooldown.");
}
debug.resetGravityField(true);
gravityAbility.cooldownRemaining = 0;
gravityAbility.activeRemaining = 0;

// Sprint stamina regression: sprint drains only while active, stops at empty,
// and cannot restart after exhaustion until Shift has been released and stamina
// has recovered to the restart threshold.
debug.player.stamina = debug.constants.MAX_STAMINA;
debug.player.staminaRegenDelayTimer = 0;
debug.player.staminaBarAlpha = 0;
debug.player.isRunning = false;
debug.player.sprintExhausted = false;
debug.player.updateSprintStamina(1, true);
if (!debug.player.isRunning || Math.abs(debug.player.stamina - 70) > 0.001) {
  throw new Error(`Expected one second of sprint to drain stamina to 70, got ${debug.player.stamina}.`);
}
debug.player.updateSprintStamina(3, true);
if (debug.player.isRunning || debug.player.stamina !== 0 || !debug.player.sprintExhausted) {
  throw new Error("Sprint did not stop and lock out immediately when stamina reached zero.");
}
debug.player.updateSprintStamina(debug.constants.SPRINT_STAMINA_REGEN_DELAY, true);
debug.player.updateSprintStamina(debug.constants.SPRINT_STAMINA_RESTART_THRESHOLD / debug.constants.SPRINT_STAMINA_REGEN_RATE, true);
if (debug.player.isRunning || !debug.player.sprintExhausted || debug.player.stamina < debug.constants.SPRINT_STAMINA_RESTART_THRESHOLD) {
  throw new Error("Sprint exhaustion lockout did not persist while Shift stayed held after stamina recovered.");
}
const staminaAfterHeldRecovery = debug.player.stamina;
debug.player.updateSprintStamina(0, false);
if (debug.player.sprintExhausted) {
  throw new Error("Sprint exhaustion lockout did not clear after Shift release and stamina recovery.");
}
debug.player.updateSprintStamina(0.016, true);
if (!debug.player.isRunning || debug.player.stamina >= staminaAfterHeldRecovery) {
  throw new Error("Sprint did not restart after Shift was released and pressed again with enough stamina.");
}

// Re-pressing Shift before enough stamina refills must not queue an automatic
// restart; the player has to release Shift again after the recovery threshold.
debug.player.stamina = 0;
debug.player.staminaRegenDelayTimer = debug.constants.SPRINT_STAMINA_REGEN_DELAY;
debug.player.isRunning = false;
debug.player.sprintExhausted = true;
debug.player.updateSprintStamina(0, false);
if (!debug.player.sprintExhausted) {
  throw new Error("Sprint recovery lock cleared before stamina reached the restart threshold.");
}
debug.player.updateSprintStamina(debug.constants.SPRINT_STAMINA_REGEN_DELAY, false);
debug.player.updateSprintStamina(debug.constants.SPRINT_STAMINA_RESTART_THRESHOLD / (debug.constants.SPRINT_STAMINA_REGEN_RATE * 2), true);
if (debug.player.isRunning || !debug.player.sprintExhausted || debug.player.stamina >= debug.constants.SPRINT_STAMINA_RESTART_THRESHOLD) {
  throw new Error("Low-stamina Shift press did not remain locked before the restart threshold.");
}
debug.player.updateSprintStamina(debug.constants.SPRINT_STAMINA_RESTART_THRESHOLD / debug.constants.SPRINT_STAMINA_REGEN_RATE, true);
if (debug.player.isRunning || !debug.player.sprintExhausted || debug.player.stamina < debug.constants.SPRINT_STAMINA_RESTART_THRESHOLD) {
  throw new Error("Low-stamina Shift press queued sprint after the restart threshold without a fresh release.");
}
const staminaAfterQueuedPress = debug.player.stamina;
debug.player.updateSprintStamina(0, false);
if (debug.player.sprintExhausted) {
  throw new Error("Sprint recovery lock did not clear after a post-threshold Shift release.");
}
debug.player.updateSprintStamina(0.016, true);
if (!debug.player.isRunning || debug.player.stamina >= staminaAfterQueuedPress) {
  throw new Error("Sprint did not restart from a fresh press after recovery threshold.");
}
debug.player.updateSprintStamina(0, false);

// Direction-change regression: after sprint exhausts from real held Shift input,
// A/D changes must not count as a fresh sprint press while Shift remains held.
dispatch("blur", {});
debug.player.x = 20;
debug.player.y = 420;
debug.player.vx = 0;
debug.player.vy = 0;
debug.player.gravitySign = 1;
debug.player.onSurface = true;
debug.player.isCrouching = false;
debug.player.isRunning = true;
debug.player.sprintExhausted = false;
debug.player.stamina = 1;
debug.player.staminaRegenDelayTimer = 0;
dispatch("keydown", keyEvent("Shift", "ShiftLeft"));
dispatch("keydown", keyEvent("d", "KeyD"));
debug.player.update(0.05);
if (debug.player.isRunning || debug.player.stamina !== 0 || !debug.player.sprintExhausted) {
  throw new Error("Held Shift sprint did not lock immediately on the exhaustion frame.");
}
if (Math.abs(debug.player.vx - debug.constants.WALK_SPEED) > 0.001) {
  throw new Error(`Exhaustion frame did not immediately fall back to walk speed; got ${debug.player.vx}.`);
}
dispatch("keyup", keyEvent("d", "KeyD"));
dispatch("keydown", keyEvent("a", "KeyA"));
// Simulate stamina having recovered above the restart threshold while Shift is
// still held; the exhaustion lock, not stamina level, must decide restart.
debug.player.stamina = debug.constants.SPRINT_STAMINA_RESTART_THRESHOLD + 1;
debug.player.staminaRegenDelayTimer = 0;
const staminaBeforeLockedDirectionChanges = debug.player.stamina;
debug.player.update(0.016);
if (debug.player.isRunning || !debug.player.sprintExhausted || debug.player.stamina < debug.constants.SPRINT_STAMINA_RESTART_THRESHOLD) {
  throw new Error("Changing direction while Shift stayed held bypassed the sprint exhaustion lock.");
}
if (debug.player.stamina < staminaBeforeLockedDirectionChanges) {
  throw new Error("Locked sprint drained stamina after a held-Shift direction change.");
}
if (Math.abs(debug.player.vx + debug.constants.WALK_SPEED) > 0.001) {
  throw new Error(`Locked sprint direction change did not use walk speed; got ${debug.player.vx}.`);
}

dispatch("keyup", keyEvent("a", "KeyA"));
let staminaBeforeNoMovement = debug.player.stamina;
debug.player.update(0.016);
if (debug.player.isRunning || !debug.player.sprintExhausted || debug.player.vx !== 0 || debug.player.stamina < staminaBeforeNoMovement) {
  throw new Error("Releasing movement while Shift stayed held altered the sprint exhaustion lock.");
}
dispatch("keydown", keyEvent("a", "KeyA"));
staminaBeforeNoMovement = debug.player.stamina;
debug.player.update(0.016);
if (debug.player.isRunning || !debug.player.sprintExhausted || debug.player.stamina < staminaBeforeNoMovement) {
  throw new Error("Restarting movement while Shift stayed held bypassed the sprint exhaustion lock.");
}
if (Math.abs(debug.player.vx + debug.constants.WALK_SPEED) > 0.001) {
  throw new Error(`Locked movement restart did not use walk speed; got ${debug.player.vx}.`);
}

// Rapidly alternate movement input while Shift stays down. Direction changes may
// change only the sign of walk movement; they must never clear exhaustion or
// cause a one-frame sprint drain/burst.
for (let frame = 0; frame < 8; frame += 1) {
  const holdLeft = frame % 2 === 0;
  dispatch("keyup", keyEvent(holdLeft ? "d" : "a", holdLeft ? "KeyD" : "KeyA"));
  dispatch("keydown", keyEvent(holdLeft ? "a" : "d", holdLeft ? "KeyA" : "KeyD"));
  const staminaBeforeFrame = debug.player.stamina;
  debug.player.update(0.016);
  const expectedVx = (holdLeft ? -1 : 1) * debug.constants.WALK_SPEED;
  if (!debug.getShiftIsDown()) throw new Error("Shift state was lost during rapid movement input changes.");
  if (debug.player.isRunning || !debug.player.sprintExhausted) {
    throw new Error("Rapid movement input changes bypassed the held-Shift sprint exhaustion lock.");
  }
  if (debug.player.stamina < staminaBeforeFrame) {
    throw new Error("Locked sprint drained stamina during rapid movement input changes.");
  }
  if (Math.abs(debug.player.vx - expectedVx) > 0.001) {
    throw new Error(`Locked rapid direction change used the wrong speed; got ${debug.player.vx}, expected ${expectedVx}.`);
  }
}
dispatch("keyup", keyEvent("a", "KeyA"));
dispatch("keyup", keyEvent("d", "KeyD"));
dispatch("keyup", keyEvent("Shift", "ShiftLeft"));
debug.player.update(0);
if (debug.player.sprintExhausted) {
  throw new Error("Real Shift release did not clear the sprint exhaustion lock after direction changes.");
}
dispatch("blur", {});

// Switching away from Gravity Field through the same selection path used by the
// wheel should only change the selected tap target. Timed abilities now remain
// active until their timer expires or the same ability is tapped again.
debug.setSelectedAbility("gravity");
if (!debug.activateSelectedAbility()) throw new Error("Gravity Field did not reactivate for ability-switch persistence regression.");
if (debug.player.gravitySign !== -1) throw new Error("Gravity Field setup did not invert the player before switching abilities.");
debug.setSelectedAbility("pulse");
if (debug.getSelectedAbility().id !== "pulse") throw new Error("Switching away from Gravity Field did not select Force Pulse.");
if (debug.player.gravitySign !== -1) throw new Error("Switching away from Gravity Field unexpectedly reset player gravity.");
for (let elapsed = 0; elapsed < debug.constants.GRAVITY_FIELD_DURATION + 0.1; elapsed += 0.1) debug.update(0.1);
if (debug.player.gravitySign !== 1) throw new Error("Gravity Field duration expiry did not restore player gravity.");
if (gravityAbility.cooldownRemaining <= 0) throw new Error("Gravity Field cooldown did not start after duration expiry.");
gravityAbility.cooldownRemaining = 0;
gravityAbility.activeRemaining = 0;

// Force Pulse regression: the ability is unlocked, selected independently from
// Gravity Field, starts its own cooldown, and pushes an enemy inside the cone.
const forcePulseAbility = debug.abilities.find((ability) => ability.id === "pulse");
if (!forcePulseAbility || !forcePulseAbility.unlocked) throw new Error("Expected unlocked Force Pulse ability.");
const pulseWalker = debug.enemies[0];
debug.player.x = 580;
debug.player.y = 420;
debug.player.facing = 1;
debug.player.gravitySign = 1;
debug.player.isDying = false;
pulseWalker.x = 660;
pulseWalker.y = 435;
pulseWalker.hp = 2;
pulseWalker.isDying = false;
pulseWalker.gravitySign = 1;
pulseWalker.forcePulseStunTimer = 0;
pulseWalker.lastForcePulseCastId = 0;
forcePulseAbility.cooldownRemaining = 0;
debug.setSelectedAbility("pulse");
if (!debug.activateSelectedAbility()) throw new Error("Force Pulse did not activate when selected and ready.");
if (forcePulseAbility.cooldownRemaining <= 0) throw new Error("Force Pulse activation did not start its cooldown.");
if (pulseWalker.vx <= 300 || pulseWalker.forcePulseStunTimer <= 0) {
  throw new Error("Force Pulse did not knock back and briefly stun the Walker in front of the player.");
}
const latestForcePulseVisual = debug.forcePulseVisuals.at(-1);
if (!latestForcePulseVisual || typeof latestForcePulseVisual.getOrigin !== "function") {
  throw new Error("Force Pulse visual did not expose its hand-anchored origin.");
}
const castHandOrigin = debug.player.getForwardHandPoint(1);
const visualOrigin = latestForcePulseVisual.getOrigin();
if (Math.abs(visualOrigin.x - castHandOrigin.x) > 0.01 || Math.abs(visualOrigin.y - castHandOrigin.y) > 0.01) {
  throw new Error("Force Pulse visual origin did not match the player's forward hand point.");
}
const visualOriginBeforeMove = latestForcePulseVisual.getOrigin();
debug.player.x += 5;
const visualOriginAfterMove = latestForcePulseVisual.getOrigin();
if (visualOriginAfterMove.x - visualOriginBeforeMove.x < 4.9) {
  throw new Error("Force Pulse visual origin did not stay attached to the moving hand.");
}
debug.player.x -= 5;
const forcePulseCooldownAfterCast = forcePulseAbility.cooldownRemaining;
const forcePulseVisualCount = debug.forcePulseVisuals.length;
if (debug.activateSelectedAbility()) throw new Error("Force Pulse activation bypassed cooldown.");
if (debug.forcePulseVisuals.length !== forcePulseVisualCount) {
  throw new Error("Force Pulse spawned a visual while on cooldown.");
}
if (forcePulseAbility.cooldownRemaining > forcePulseCooldownAfterCast) {
  throw new Error("Force Pulse cooldown was reset by a denied cast.");
}

// Regression: when two enemies are touching in the pulse direction, the rear
// enemy should not spend its shove colliding into the front enemy's old body.
const pulseChainFrontWalker = debug.enemies[2];
if (!pulseChainFrontWalker) throw new Error("Expected a second Walker for Force Pulse chain regression.");
debug.player.x = 580;
debug.player.y = 420;
debug.player.facing = 1;
for (const enemy of [pulseWalker, pulseChainFrontWalker]) {
  enemy.hp = 2;
  enemy.isDying = false;
  enemy.gravitySign = 1;
  enemy.forcePulseStunTimer = 0;
  enemy.forcePulseDirection = 0;
  enemy.lastForcePulseCastId = 0;
  enemy.anchorLocked = false;
  enemy.vx = 0;
  enemy.vy = 0;
}
pulseWalker.x = 660;
pulseWalker.y = 435;
pulseChainFrontWalker.x = pulseWalker.x + pulseWalker.w - 4;
pulseChainFrontWalker.y = pulseWalker.y;
const pulseChainRearStartX = pulseWalker.x;
const pulseChainFrontStartX = pulseChainFrontWalker.x;
forcePulseAbility.cooldownRemaining = 0;
if (!debug.activateSelectedAbility()) throw new Error("Force Pulse did not activate for adjacent enemy chain regression.");
debug.update(1 / 30);
if (pulseWalker.x <= pulseChainRearStartX + 8 || pulseChainFrontWalker.x <= pulseChainFrontStartX + 8) {
  throw new Error("Force Pulse did not carry both adjacent enemies forward as a chain.");
}

forcePulseAbility.cooldownRemaining = 0;

// Energy Link regression: the final ability is selectable, links every enemy
// inside a circular player-centered range with one E tap, transfers full System
// Pulse damage and Force Pulse knockback to linked enemies, persists across
// ability switches, and starts cooldown when cancelled or expired.
const linkAbility = debug.abilities.find((ability) => ability.id === "link");
if (!linkAbility || !linkAbility.unlocked) throw new Error("Expected unlocked Energy Link ability.");
const linkA = debug.enemies[0];
const linkB = debug.enemies[1];
const linkC = debug.enemies[3];
if (!linkA || !linkB || !linkC) throw new Error("Expected three nearby enemies for Energy Link regression.");
for (const enemy of [linkA, linkB, linkC]) {
  debug.resetEnemyAdaptation(enemy);
  enemy.hp = 2;
  enemy.isDying = false;
  enemy.gravitySign = 1;
  enemy.vx = 0;
  enemy.vy = 0;
  enemy.forcePulseStunTimer = 0;
  enemy.lastForcePulseCastId = 0;
}
debug.player.x = 500;
debug.player.y = 420;
debug.player.facing = 1;
debug.player.gravitySign = 1;
linkA.x = 610;
linkA.y = 435;
linkB.x = 710;
linkB.y = 435;
linkC.x = 760;
linkC.y = 435;
linkAbility.cooldownRemaining = 0;
linkAbility.activeRemaining = 0;
debug.setSelectedAbility("link");
if (!debug.activateSelectedAbility()) throw new Error("Energy Link did not activate from a single circular range cast.");
let linkState = debug.getEnergyLinkState();
if (!linkState.active || !linkState.targets.includes(linkA) || !linkState.targets.includes(linkB) || !linkState.targets.includes(linkC)) {
  throw new Error("Energy Link did not connect every enemy inside the player-centered range.");
}
if (linkAbility.cooldownRemaining > 0 || Math.abs(linkAbility.activeRemaining - debug.constants.ENERGY_LINK_DURATION) > 0.01) {
  throw new Error("Energy Link did not start its active duration without immediate cooldown.");
}
if (!debug.setSelectedAbility("gravity")) throw new Error("Could not switch away from Energy Link.");
if (!debug.getEnergyLinkState().active) throw new Error("Switching away from Energy Link cancelled the active link.");
debug.setSelectedAbility("link");
debug.player.x = 540;
debug.player.y = 420;
debug.player.facing = 1;
linkA.x = 630;
linkA.y = 435;
linkB.x = 735;
linkB.y = 435;
linkC.x = 790;
linkC.y = 435;
linkA.hp = 2;
linkB.hp = 2;
linkC.hp = 2;
debug.player.firePulse();
debug.update(0.09);
if (linkA.hp !== 1 || linkB.hp !== 1 || linkC.hp !== 1) {
  throw new Error(`Energy Link did not preserve first-cast full System Pulse transfer before applying adaptation to later links; got ${linkA.hp}, ${linkB.hp}, and ${linkC.hp}.`);
}
if (linkA.adaptationStages.energy_link !== 1 || linkB.adaptationStages.energy_link !== 1 || linkC.adaptationStages.energy_link !== 1) {
  throw new Error("Energy Link did not record exactly one adaptation stage on each linked target.");
}
if (linkA.lastAdaptedAbility !== "energy_link" || linkB.lastAdaptedAbility !== "energy_link" || linkC.lastAdaptedAbility !== "energy_link") {
  throw new Error("Energy Link adaptation did not become the active adaptation marker/glow source.");
}
linkA.hp = 2;
linkB.hp = 2;
linkC.hp = 2;
for (const enemy of [linkA, linkB, linkC]) {
  enemy.vx = 0;
  enemy.forcePulseStunTimer = 0;
  enemy.lastForcePulseCastId = 0;
}
linkA.x = 630;
linkA.y = 435;
linkB.x = 735;
linkB.y = 220;
linkC.x = 790;
linkC.y = 220;
forcePulseAbility.cooldownRemaining = 0;
debug.setSelectedAbility("pulse");
if (!debug.activateSelectedAbility()) throw new Error("Force Pulse did not activate for Energy Link transfer regression.");
if (linkA.vx <= 280 || linkB.vx <= 300 || linkC.vx <= 300) {
  throw new Error(`Energy Link did not transfer adapted Force Pulse knockback to all linked enemies; got ${linkA.vx}, ${linkB.vx}, and ${linkC.vx}.`);
}

// Linked enemies share other ability effects too: if one linked enemy is caught
// by Gravity Field or Time Slow, every valid endpoint should be affected.
for (const enemy of [linkA, linkB, linkC]) {
  enemy.gravitySign = 1;
  enemy.vx = 0;
  enemy.vy = 0;
  enemy.forcePulseStunTimer = 0;
  enemy.lastGravityCastId = 0;
  enemy.idleTimer = 0;
}
debug.player.x = 500;
debug.player.y = 420;
linkA.x = 610;
linkA.y = 435;
linkB.x = 1060;
linkB.y = 435;
linkC.x = 1150;
linkC.y = 435;
gravityAbility.cooldownRemaining = 0;
gravityAbility.activeRemaining = 0;
debug.setSelectedAbility("gravity");
if (!debug.activateSelectedAbility()) throw new Error("Gravity Field did not activate for Energy Link gravity propagation regression.");
if (linkA.gravitySign !== -1 || linkB.gravitySign !== -1 || linkC.gravitySign !== -1) {
  throw new Error(`Energy Link did not propagate Gravity Field to all linked enemies; got ${linkA.gravitySign}, ${linkB.gravitySign}, and ${linkC.gravitySign}.`);
}
if (!debug.activateSelectedAbility()) throw new Error("Gravity Field did not cancel after Energy Link gravity propagation regression.");
if (linkA.gravitySign !== 1 || linkB.gravitySign !== 1 || linkC.gravitySign !== 1) {
  throw new Error("Gravity Field cancellation did not restore all linked enemies affected through Energy Link.");
}
gravityAbility.cooldownRemaining = 0;
gravityAbility.activeRemaining = 0;

const timeAbilityForLink = debug.abilities.find((ability) => ability.id === "time");
if (!timeAbilityForLink) throw new Error("Expected Time Slow ability for Energy Link slow propagation regression.");
timeAbilityForLink.cooldownRemaining = 0;
timeAbilityForLink.activeRemaining = 0;
for (const enemy of [linkA, linkB, linkC]) enemy.idleTimer = 0;
debug.player.x = 500;
debug.player.y = 420;
linkA.x = 610;
linkA.y = 435;
linkB.x = 1060;
linkB.y = 435;
linkC.x = 1150;
linkC.y = 435;
if (!debug.activateTimeSlow()) throw new Error("Time Slow did not activate for Energy Link slow propagation regression.");
debug.update(1);
if (Math.abs(linkA.idleTimer - debug.constants.TIME_SLOW_MULTIPLIER) > 0.08
  || Math.abs(linkB.idleTimer - debug.constants.TIME_SLOW_MULTIPLIER) > 0.08
  || Math.abs(linkC.idleTimer - debug.constants.TIME_SLOW_MULTIPLIER) > 0.08) {
  throw new Error(`Energy Link did not propagate Time Slow to all linked enemies; got idle timers ${linkA.idleTimer}, ${linkB.idleTimer}, and ${linkC.idleTimer}.`);
}
debug.endTimeSlow(false);
timeAbilityForLink.cooldownRemaining = 0;
timeAbilityForLink.activeRemaining = 0;
forcePulseAbility.cooldownRemaining = 0;
debug.setSelectedAbility("link");
if (!debug.activateSelectedAbility()) throw new Error("Energy Link did not manually cancel when selected and active.");
if (debug.getEnergyLinkState().active || linkAbility.activeRemaining > 0 || linkAbility.cooldownRemaining <= 0) {
  throw new Error("Energy Link cancellation did not clear active link and start cooldown.");
}
linkAbility.cooldownRemaining = 0;
linkAbility.activeRemaining = 0;
debug.player.x = 500;
debug.player.y = 420;
debug.player.facing = 1;
debug.player.hp = 3;
debug.player.isDying = false;
debug.player.damageTimer = 0;
debug.player.fallRespawnGraceTimer = 0;
for (const enemy of [linkA, linkB, linkC]) {
  debug.resetEnemyAdaptation(enemy);
  enemy.hp = 2;
  enemy.isDying = false;
  enemy.gravitySign = 1;
  enemy.vx = 0;
  enemy.vy = 0;
  enemy.forcePulseStunTimer = 0;
  enemy.lastForcePulseCastId = 0;
}
linkA.x = 610;
linkA.y = 435;
linkB.x = 710;
linkB.y = 435;
linkC.x = 760;
linkC.y = 435;
debug.setSelectedAbility("link");
if (!debug.activateSelectedAbility()) throw new Error("Energy Link did not reactivate for duration expiry regression.");
debug.player.x = 120;
debug.player.y = 420;
for (let elapsed = 0; elapsed < debug.constants.ENERGY_LINK_DURATION + 0.1; elapsed += 0.1) debug.update(0.1);
if (debug.getEnergyLinkState().active || linkAbility.activeRemaining > 0 || linkAbility.cooldownRemaining <= 0) {
  throw new Error("Energy Link duration expiry did not end link and start cooldown.");
}
linkAbility.cooldownRemaining = 0;
linkAbility.activeRemaining = 0;

// Player death regression: dying is a hard cancel that immediately negates
// every active ability effect without leaving timed fields, links, or fade-only
// remnants in effect for the death/respawn sequence.
const deathPhaseAbility = debug.abilities.find((ability) => ability.id === "phase");
const deathAnchorAbility = debug.abilities.find((ability) => ability.id === "anchor");
if (!deathPhaseAbility || !deathAnchorAbility) throw new Error("Expected Phase Shift and Anchor Field abilities for player death cancellation regression.");
for (const ability of [gravityAbility, timeAbilityForLink, deathPhaseAbility, deathAnchorAbility, linkAbility]) {
  ability.cooldownRemaining = 0;
  ability.activeRemaining = 0;
}
debug.resetGravityField(true);
debug.endTimeSlow(false);
debug.endPhaseShift(false);
debug.endAnchorField(false);
debug.player.x = 500;
debug.player.y = 420;
debug.player.hp = 1;
debug.player.gravitySign = 1;
debug.player.damageTimer = 0;
debug.player.fallRespawnGraceTimer = 0;
debug.player.isDying = false;
for (const enemy of [linkA, linkB, linkC]) {
  enemy.hp = 2;
  enemy.isDying = false;
  enemy.anchorLocked = false;
  enemy.gravitySign = 1;
}
linkA.x = 610;
linkA.y = 435;
linkB.x = 710;
linkB.y = 435;
linkC.x = 760;
linkC.y = 435;
debug.setSelectedAbility("link");
if (!debug.activateSelectedAbility()) throw new Error("Energy Link did not activate for player death cancellation regression.");
if (!debug.toggleGravityField()) throw new Error("Gravity Field did not activate for player death cancellation regression.");
if (!debug.activateTimeSlow()) throw new Error("Time Slow did not activate for player death cancellation regression.");
if (!debug.activatePhaseShift()) throw new Error("Phase Shift did not activate for player death cancellation regression.");
if (!debug.activateAnchorField()) throw new Error("Anchor Field did not activate for player death cancellation regression.");
let deathCancelState = debug.getActiveAbilityEffectState();
if (!deathCancelState.gravityFieldActive || !deathCancelState.timeSlowActive || !deathCancelState.phaseShiftActive || !deathCancelState.anchorFieldActive || !deathCancelState.energyLinkActive) {
  throw new Error("Could not set up every active ability before player death cancellation regression.");
}
debug.player.beginDeath();
deathCancelState = debug.getActiveAbilityEffectState();
if (deathCancelState.gravityFieldActive || deathCancelState.timeSlowActive || deathCancelState.phaseShiftActive || deathCancelState.anchorFieldActive || deathCancelState.energyLinkActive) {
  throw new Error("Player death did not negate every active ability effect.");
}
if (deathCancelState.timeSlowFadeActive || deathCancelState.anchorFieldFadeActive || deathCancelState.energyLinkFadeActive) {
  throw new Error("Player death left ability fade effects running after cancellation.");
}
if (debug.player.gravitySign !== 1 || [linkA, linkB, linkC].some((enemy) => enemy.gravitySign !== 1 || enemy.anchorLocked)) {
  throw new Error("Player death did not restore gravity and clear anchor locks from affected entities.");
}
if ([gravityAbility, timeAbilityForLink, deathPhaseAbility, deathAnchorAbility, linkAbility].some((ability) => ability.activeRemaining > 0)) {
  throw new Error("Player death left a timed ability activeRemaining value above zero.");
}
if ([gravityAbility, timeAbilityForLink, deathPhaseAbility, deathAnchorAbility, linkAbility].some((ability) => ability.cooldownRemaining > 0)) {
  throw new Error("Player death cancellation started ability cooldowns instead of only negating effects.");
}
debug.player.fullRespawn();

// Environmental Energy Link regression: a linked enemy killed by spikes should
// shatter every other non-boss enemy in the active link immediately.
for (const enemy of [linkA, linkB, linkC]) {
  debug.resetEnemyAdaptation(enemy);
  enemy.hp = 2;
  enemy.isDying = false;
  enemy.gravitySign = 1;
  enemy.vx = 0;
  enemy.vy = 0;
  enemy.forcePulseStunTimer = 0;
  enemy.lastForcePulseCastId = 0;
}
debug.player.x = 500;
debug.player.y = 420;
linkA.x = 610;
linkA.y = 435;
linkB.x = 710;
linkB.y = 435;
linkC.x = 760;
linkC.y = 435;
debug.setSelectedAbility("link");
if (!debug.activateSelectedAbility()) throw new Error("Energy Link did not activate for environmental death regression.");
const linkedFloorSpike = debug.spikes.find((spike) => spike.side === "top");
if (!linkedFloorSpike) throw new Error("Expected a floor spike for Energy Link environmental death regression.");
linkA.x = linkedFloorSpike.x + 12;
linkA.y = linkedFloorSpike.platform.y - linkA.h + 8;
debug.update(1 / 60);
if (!linkA.isDying || !linkB.isDying || !linkC.isDying) {
  throw new Error("A linked spike death did not kill all linked enemies.");
}
if (debug.getEnergyLinkState().active || linkAbility.activeRemaining > 0 || linkAbility.cooldownRemaining <= 0) {
  throw new Error("Energy Link did not end and start cooldown after environmental linked deaths.");
}
for (const enemy of [linkA, linkB, linkC]) {
  debug.resetEnemyAdaptation(enemy);
  enemy.hp = 2;
  enemy.isDying = false;
  enemy.deathFragments = [];
  enemy.vx = 0;
  enemy.vy = 0;
}
linkAbility.cooldownRemaining = 0;
linkAbility.activeRemaining = 0;

// Lethal Energy Link regression: when a linked walker dies to a second
// System Pulse hit, the killing hit should still transfer to the other linked
// walkers before the source leaves the active link.
debug.player.x = 500;
debug.player.y = 420;
debug.player.facing = 1;
linkA.x = 610;
linkA.y = 435;
linkB.x = 710;
linkB.y = 435;
linkC.x = 760;
linkC.y = 435;
debug.setSelectedAbility("link");
if (!debug.activateSelectedAbility()) throw new Error("Energy Link did not activate for lethal System Pulse transfer regression.");
debug.player.pulseTimer = 0;
debug.player.firePulse();
debug.update(0.09);
debug.player.pulseTimer = 0;
debug.player.firePulse();
debug.update(0.09);
if (!linkA.isDying || !linkB.isDying || !linkC.isDying) {
  throw new Error("Energy Link did not transfer lethal System Pulse damage before the source enemy died.");
}
for (const enemy of [linkA, linkB, linkC]) {
  debug.resetEnemyAdaptation(enemy);
  enemy.hp = 2;
  enemy.isDying = false;
  enemy.deathFragments = [];
  enemy.vx = 0;
  enemy.vy = 0;
}
linkAbility.cooldownRemaining = 0;
linkAbility.activeRemaining = 0;

debug.setSelectedAbility("gravity");
debug.player.x = 120;
debug.player.y = 420;

// Holding Q previews the selected ability's range instead of always drawing
// Gravity Field, so the drawn preview should swap when Force Pulse is selected.
dispatch("keydown", keyEvent("q"));
context.calls = [];
debug.draw();
if (!context.calls.some((call) => call.name === "arc" && Math.abs(call.args[2] - debug.constants.GRAVITY_FIELD_RADIUS) < 0.01)) {
  throw new Error("Holding Q with Gravity Field selected did not draw its circular range preview.");
}
debug.setSelectedAbility("pulse");
context.calls = [];
debug.draw();
if (!context.calls.some((call) => call.name === "arc" && Math.abs(call.args[2] - debug.constants.FORCE_PULSE_RANGE) < 0.01)) {
  throw new Error("Holding Q with Force Pulse selected did not draw its cone range preview.");
}
debug.setSelectedAbility("link");
context.calls = [];
debug.draw();
if (!context.calls.some((call) => call.name === "arc" && Math.abs(call.args[2] - debug.constants.ENERGY_LINK_RANGE) < 0.01 && Math.abs(call.args[3]) < 0.01 && Math.abs(call.args[4] - Math.PI * 2) < 0.01)) {
  throw new Error("Holding Q with Energy Link selected did not draw its circular range preview.");
}
dispatch("keyup", keyEvent("q"));
debug.setSelectedAbility("gravity");

// Holding E opens the selection wheel; keyboard navigation skips locked slots,
// releasing confirms the highlighted unlocked ability, and that release does
// not also activate the newly selected ability.
dispatch("keydown", keyEvent("e"));
for (let frame = 0; frame < 9; frame += 1) tick(33);
if (!debug.abilityWheel.open) throw new Error("Holding E did not open the ability wheel.");
gravityAbility.cooldownRemaining = 2;
const cooldownWhileWheelOpen = gravityAbility.cooldownRemaining;
const playerXWhileWheelOpen = debug.player.x;
debug.update(1);
if (gravityAbility.cooldownRemaining !== cooldownWhileWheelOpen) {
  throw new Error("Ability cooldown advanced while the ability wheel was open.");
}
if (debug.player.x !== playerXWhileWheelOpen) {
  throw new Error("Player simulation advanced while the ability wheel was open.");
}
dispatch("pointermove", { clientX: 960, clientY: 270 });
debug.update(16 / 1000);
if (debug.abilities[debug.abilityWheel.hoveredIndex]?.id !== "gravity") {
  throw new Error("Mouse movement changed ability wheel selection before the settings toggle exists.");
}
dispatch("keydown", keyEvent("ArrowRight"));
debug.update(16 / 1000);
dispatch("keyup", keyEvent("ArrowRight"));
if (debug.abilities[debug.abilityWheel.hoveredIndex]?.id !== "time") {
  throw new Error("Ability wheel keyboard navigation did not reach the unlocked Time Slow slot.");
}
const timeAbility = debug.abilities.find((ability) => ability.id === "time");
if (!timeAbility || !timeAbility.unlocked) throw new Error("Expected unlocked Time Slow ability.");
timeAbility.cooldownRemaining = 0;
timeAbility.activeRemaining = 0;
dispatch("keyup", keyEvent("e"));
debug.update(16 / 1000);
if (debug.abilityWheel.open) throw new Error("Releasing E did not close the ability wheel.");
if (debug.getSelectedAbility().id !== "time") {
  throw new Error("Releasing the ability wheel did not select Time Slow.");
}
if (timeAbility.activeRemaining > 0 || timeAbility.cooldownRemaining > 0 || gravityAbility.cooldownRemaining > cooldownWhileWheelOpen) {
  throw new Error("Releasing the ability wheel activated an ability or reset a cooldown.");
}
dispatch("keydown", keyEvent("e"));
dispatch("keyup", keyEvent("e"));
debug.update(16 / 1000);
if (timeAbility.activeRemaining <= 0 || timeAbility.cooldownRemaining > 0) {
  throw new Error("Tapping E after wheel selection did not activate Time Slow without starting cooldown.");
}
if (!debug.activateSelectedAbility() || timeAbility.activeRemaining > 0 || timeAbility.cooldownRemaining <= 0) {
  throw new Error("Time Slow manual cancellation did not clear active time and start cooldown.");
}
gravityAbility.cooldownRemaining = 0;
timeAbility.cooldownRemaining = 0;
forcePulseAbility.cooldownRemaining = 0;

// System Access regression: Q/E switch tabs while arrows stay inside the
// Abilities grid, and menu input does not leak into gameplay actions.
debug.closeSystemAccess();
debug.player.damageTimer = 0;
debug.player.attackTimer = 0;
debug.player.isDying = false;
debug.player.x = 120;
debug.player.y = 420;
debug.player.vx = 0;
debug.player.vy = 0;
debug.setSelectedAbility("time");
timeAbility.cooldownRemaining = 0;
timeAbility.activeRemaining = 0;
debug.systemAccess.open = true;
debug.systemAccess.selectedTabIndex = 1;
debug.systemAccess.selectedAbilityId = "gravity";
const playerXBeforeMenuInput = debug.player.x;
dispatch("keydown", keyEvent("e", "KeyE"));
if (debug.systemAccess.selectedTabIndex !== 2) throw new Error("E did not switch System Access to the next tab.");
if (timeAbility.activeRemaining > 0 || timeAbility.cooldownRemaining > 0) {
  throw new Error("E leaked into gameplay ability activation while System Access was open.");
}
dispatch("keyup", keyEvent("e", "KeyE"));
dispatch("keydown", keyEvent("q", "KeyQ"));
if (debug.systemAccess.selectedTabIndex !== 1) throw new Error("Q did not switch System Access to the previous tab.");
dispatch("keyup", keyEvent("q", "KeyQ"));
dispatch("keydown", keyEvent("ArrowRight", "ArrowRight"));
if (debug.systemAccess.selectedAbilityId !== "time") throw new Error("Right Arrow did not move across the ability grid.");
dispatch("keyup", keyEvent("ArrowRight", "ArrowRight"));
dispatch("keydown", keyEvent("ArrowDown", "ArrowDown"));
if (debug.systemAccess.selectedAbilityId !== "anchor") throw new Error("Down Arrow did not move down the ability grid.");
dispatch("keyup", keyEvent("ArrowDown", "ArrowDown"));
dispatch("keydown", keyEvent("ArrowLeft", "ArrowLeft"));
if (debug.systemAccess.selectedAbilityId !== "pulse") throw new Error("Left Arrow did not move across the ability grid.");
dispatch("keyup", keyEvent("ArrowLeft", "ArrowLeft"));
dispatch("keydown", keyEvent("d", "KeyD"));
debug.update(16 / 1000);
if (debug.systemAccess.selectedTabIndex !== 1 || debug.systemAccess.selectedAbilityId !== "pulse") {
  throw new Error("Gameplay movement keys changed System Access navigation while open.");
}
if (debug.player.x !== playerXBeforeMenuInput) throw new Error("Gameplay movement leaked while System Access was open.");
dispatch("keyup", keyEvent("d", "KeyD"));
dispatch("keydown", keyEvent("Escape", "Escape"));
if (debug.systemAccess.open) throw new Error("Escape did not close System Access.");
dispatch("keyup", keyEvent("Escape", "Escape"));
debug.setSelectedAbility("gravity");

// Anchor Field regression: it is selectable, starts cooldown only after ending,
// locks enemies in its visible radius, coexists with other abilities, and lets
// player projectiles keep damaging anchored enemies while non-projectile
// abilities ignore anchored targets.
const anchorAbility = debug.abilities.find((ability) => ability.id === "anchor");
if (!anchorAbility || !anchorAbility.unlocked) throw new Error("Expected unlocked Anchor Field ability.");
const anchorWalker = debug.enemies[0];
debug.player.x = 520;
debug.player.y = 420;
debug.player.facing = 1;
debug.player.gravitySign = 1;
anchorWalker.x = debug.player.x + 110;
anchorWalker.y = 435;
anchorWalker.hp = 2;
anchorWalker.isDying = false;
anchorWalker.anchorLocked = false;
anchorWalker.vx = 0;
anchorWalker.vy = 0;
anchorWalker.gravitySign = 1;
anchorWalker.forcePulseStunTimer = 0;
anchorAbility.cooldownRemaining = 0;
anchorAbility.activeRemaining = 0;
gravityAbility.cooldownRemaining = 0;
gravityAbility.activeRemaining = 0;
timeAbility.cooldownRemaining = 0;
timeAbility.activeRemaining = 0;
linkAbility.cooldownRemaining = 0;
linkAbility.activeRemaining = 0;
debug.setSelectedAbility("anchor");
if (!debug.activateSelectedAbility()) throw new Error("Anchor Field did not activate when selected and ready.");
if (anchorAbility.cooldownRemaining > 0 || anchorAbility.activeRemaining <= 0) {
  throw new Error("Anchor Field cooldown started before its active duration ended.");
}
const anchorPlayerCenter = {
  x: debug.player.x + debug.player.w / 2,
  y: debug.player.y + debug.player.h / 2
};
if (!debug.isPointInsideAnchorField(anchorPlayerCenter)) {
  throw new Error("Anchor Field did not include the player center on activation.");
}
if (debug.isPointInsideAnchorField({ x: anchorPlayerCenter.x + 200, y: anchorPlayerCenter.y })) {
  throw new Error("Anchor Field was still projected forward instead of centered around the player.");
}
debug.update(16 / 1000);
if (!anchorWalker.anchorLocked) throw new Error("Anchor Field did not lock a Walker inside its radius.");
context.calls = [];
debug.draw();
if (context.calls.some((call) => call.name === "ellipse")) {
  throw new Error("Anchor Field drew an enemy lock indicator after anchoring a Walker.");
}
debug.update(0.2);
context.calls = [];
debug.draw();
if (context.calls.some((call) => call.name === "arc" && Math.abs(call.args[2] - debug.constants.ANCHOR_FIELD_RADIUS) < 0.01)) {
  throw new Error("Anchor Field range stayed visible after the activation flash.");
}
const anchoredWalkerX = anchorWalker.x;
anchorWalker.vx = 120;
debug.update(0.25);
if (Math.abs(anchorWalker.x - anchoredWalkerX) > 0.01 || anchorWalker.vx !== 0) {
  throw new Error("Anchored Walker moved while the field was active.");
}
const lateAnchorEnemy = debug.enemies.find((enemy) => enemy !== anchorWalker && enemy.hp > 0);
if (!lateAnchorEnemy) throw new Error("Expected a second enemy for Anchor Field late-entry regression.");
lateAnchorEnemy.anchorLocked = false;
lateAnchorEnemy.hp = 2;
lateAnchorEnemy.isDying = false;
lateAnchorEnemy.x = debug.player.x + 80;
lateAnchorEnemy.y = anchorWalker.y;
debug.update(16 / 1000);
if (lateAnchorEnemy.anchorLocked) {
  throw new Error("Anchor Field locked an enemy that entered the range after activation.");
}
lateAnchorEnemy.hp = 0;
forcePulseAbility.cooldownRemaining = 0;
debug.setSelectedAbility("pulse");
const forcePulseVisualsBeforeAnchorCast = debug.forcePulseVisuals.length;
if (!debug.activateSelectedAbility()) throw new Error("Force Pulse did not activate while Anchor Field was active.");
if (forcePulseAbility.cooldownRemaining <= 0 || debug.forcePulseVisuals.length !== forcePulseVisualsBeforeAnchorCast + 1) {
  throw new Error("Force Pulse while Anchor Field was active did not spend cooldown and spawn its visual.");
}
if (Math.abs(anchorWalker.x - anchoredWalkerX) > 0.01 || anchorWalker.vx !== 0 || anchorWalker.forcePulseStunTimer > 0) {
  throw new Error("Anchored enemy received Force Pulse movement or stun while Anchor Field was active.");
}
anchorWalker.hp = 2;
debug.player.pulseTimer = 0;
debug.player.firePulse();
if (!debug.player.attackPulseQueued || debug.player.attackTimer <= 0) {
  throw new Error("System Pulse did not start while Anchor Field was active.");
}
debug.update(0.09);
if (anchorWalker.hp !== 1) {
  throw new Error("System Pulse did not damage an anchored enemy while Anchor Field was active.");
}
gravityAbility.cooldownRemaining = 0;
gravityAbility.activeRemaining = 0;
const anchoredGravitySign = anchorWalker.gravitySign;
if (!debug.toggleGravityField()) throw new Error("Gravity Field did not activate while Anchor Field was active.");
if (debug.player.gravitySign !== -1 || gravityAbility.activeRemaining <= 0) {
  throw new Error("Gravity Field did not affect the player while Anchor Field was active.");
}
if (anchorWalker.gravitySign !== anchoredGravitySign) {
  throw new Error("Gravity Field affected an anchored enemy while Anchor Field was active.");
}
debug.resetGravityField(false, true);
timeAbility.cooldownRemaining = 0;
timeAbility.activeRemaining = 0;
if (!debug.activateTimeSlow() || timeAbility.activeRemaining <= 0) {
  throw new Error("Time Slow did not activate while Anchor Field was active.");
}
if (!debug.endTimeSlow(true) || timeAbility.cooldownRemaining <= 0) {
  throw new Error("Time Slow did not cancel after activating during Anchor Field.");
}
const linkD = debug.enemies[1];
const linkE = debug.enemies[3];
for (const enemy of [linkD, linkE]) {
  enemy.hp = 2;
  enemy.isDying = false;
  enemy.anchorLocked = false;
  enemy.x = debug.player.x + (enemy === linkD ? 75 : 130);
  enemy.y = 435;
}
linkAbility.cooldownRemaining = 0;
linkAbility.activeRemaining = 0;
debug.setSelectedAbility("link");
if (!debug.activateSelectedAbility()) throw new Error("Energy Link did not activate for unanchored targets while Anchor Field was active.");
const anchorLinkState = debug.getEnergyLinkState();
if (!anchorLinkState.active || anchorLinkState.targets.includes(anchorWalker) || !anchorLinkState.targets.includes(linkD) || !anchorLinkState.targets.includes(linkE)) {
  throw new Error("Energy Link did not ignore anchored enemies while linking unanchored targets during Anchor Field.");
}
if (!debug.activateSelectedAbility()) throw new Error("Energy Link did not cancel after Anchor Field coexistence regression.");
const drone = debug.enemies.find((enemy) => typeof enemy.fireAtPlayer === "function");
if (!drone) throw new Error("Expected a Drone for Anchor Field projectile regression.");
debug.player.x = 450;
debug.player.y = 420;
drone.x = 650;
drone.y = 390;
drone.hp = 2;
drone.isDying = false;
drone.orbitSlots.forEach((slot) => { slot.detached = false; slot.detachTimer = 0; slot.reformTimer = 0; });
const projectileCountBeforeAnchorShot = debug.droneProjectiles.length;
if (!drone.fireAtPlayer()) throw new Error("Drone did not spawn a projectile for Anchor Field regression.");
const lateProjectile = debug.droneProjectiles.at(-1);
if (!lateProjectile || debug.droneProjectiles.length !== projectileCountBeforeAnchorShot + 1) {
  throw new Error("Expected a new Drone projectile for Anchor Field regression.");
}
lateProjectile.x = anchorPlayerCenter.x + 80;
lateProjectile.y = anchorPlayerCenter.y;
lateProjectile.vx = -120;
lateProjectile.vy = 20;
debug.update(16 / 1000);
if (lateProjectile.anchorFrozen) {
  throw new Error("Anchor Field froze a projectile that entered the range after activation.");
}
if (!debug.setSelectedAbility("anchor")) throw new Error("Could not reselect Anchor Field for manual cancellation.");
if (!debug.activateSelectedAbility()) throw new Error("Anchor Field did not manually cancel when selected and tapped again.");
if (anchorAbility.cooldownRemaining <= 0 || anchorAbility.activeRemaining > 0) {
  throw new Error("Anchor Field cancellation did not start cooldown and clear active time.");
}
if (anchorWalker.anchorLocked || lateProjectile.anchorFrozen) {
  throw new Error("Anchor Field did not clear locked enemies and leave uncaptured projectiles alone after ending.");
}
if (debug.activateSelectedAbility()) throw new Error("Anchor Field activation bypassed cooldown after cancellation.");
anchorAbility.cooldownRemaining = 0;
anchorAbility.activeRemaining = 0;

lateProjectile.x = debug.player.x + debug.player.w / 2 + 120;
lateProjectile.y = debug.player.y + debug.player.h / 2;
lateProjectile.vx = -120;
lateProjectile.vy = 20;
debug.setSelectedAbility("anchor");
if (!debug.activateSelectedAbility()) throw new Error("Anchor Field did not reactivate for projectile capture regression.");
if (!lateProjectile.anchorFrozen || lateProjectile.vx !== 0 || lateProjectile.vy !== 0) {
  throw new Error("Anchor Field did not freeze a Drone projectile inside its activation radius.");
}
if (!debug.activateSelectedAbility()) throw new Error("Anchor Field did not manually cancel after projectile capture regression.");
if (lateProjectile.anchorFrozen || lateProjectile.vx !== -120 || lateProjectile.vy !== 20) {
  throw new Error("Anchor Field did not restore a projectile captured on activation.");
}
anchorAbility.cooldownRemaining = 0;
anchorAbility.activeRemaining = 0;

debug.setSelectedAbility("gravity");
debug.player.x = 120;
debug.player.y = 420;

const jumper = debug.enemies.find((enemy) => typeof enemy.canStartAttack === "function");
const jumperPlatform = debug.platforms.find((platform) => platform.x === 1900 && platform.y === 310);
if (!jumper || !jumperPlatform) throw new Error("Expected jumper enemy and its platform for detection regression.");

// Regression: when the player is flush against a platform edge/wall, their center
// can sit just outside the jumper's safe landing margin. The jumper should still
// detect the player because part of the player's body is reachable.
debug.player.x = jumperPlatform.x + jumperPlatform.w - debug.player.w;
debug.player.y = jumperPlatform.y - debug.player.h;
debug.player.gravitySign = 1;
debug.player.isDying = false;
jumper.x = 2010;
jumper.gravitySign = 1;
jumper.onSurface = true;
jumper.jumperState = "idle";
jumper.attachToSurface(jumperPlatform);
if (!jumper.canStartAttack()) {
  throw new Error("Jumper failed to detect a player standing flush against a wall.");
}

// Regression: reversed-gravity jumpers should keep attacking from safe sections
// of a ceiling platform even if another section of that underside has spikes.
const ceilingPlatform = debug.platforms[0];
debug.player.x = 448;
debug.player.y = ceilingPlatform.y + ceilingPlatform.h + 8;
debug.player.gravitySign = -1;
debug.player.isDying = false;
jumper.x = 452;
jumper.gravitySign = -1;
jumper.jumperState = "idle";
jumper.recoveryDelayTimer = 0;
jumper.attachToSurface(ceilingPlatform);
if (!jumper.canStartAttack()) {
  throw new Error("Reversed-gravity jumper treated an unspiked ceiling landing as unsafe.");
}
jumper.update(16 / 1000);
if (jumper.jumperState !== "charging") {
  throw new Error("Reversed-gravity jumper did not continue its jump cycle from a safe ceiling section.");
}

// Regression: if only the jumper's visible edge is on a platform edge, it
// should still treat that lip as support instead of getting stuck airborne.
debug.player.x = 120;
debug.player.y = 420;
jumper.x = jumperPlatform.x + jumperPlatform.w - 2;
jumper.gravitySign = 1;
jumper.jumperState = "idle";
jumper.recoveryDelayTimer = 1;
jumper.attachToSurface(jumperPlatform);
jumper.update(16 / 1000);
if (!jumper.onSurface || jumper.jumperState === "airborne" || jumper.groundedPlatform !== jumperPlatform) {
  throw new Error("Jumper got stuck airborne while balanced on a platform edge.");
}

if (!Array.isArray(debug.spikes) || debug.spikes.length < 2) {
  throw new Error("Expected platform-attached spike strips to exist.");
}

// Regression: enemies that reach a left or right room boundary under their own
// movement should survive; edge shatters are reserved for pulse/projectile shove
// windows so ordinary patrols cannot die just by running into the screen edge.
for (const enemy of debug.enemies) {
  enemy.hp = 2;
  enemy.isDying = false;
  enemy.gravitySign = 1;
  enemy.verticalEdgeKillTimer = 0;
  enemy.x = 0;
  enemy.update(16 / 1000);
  if (enemy.hp === 0 || enemy.isDying) {
    throw new Error(`${enemy.constructor.name} died from an unarmed left room edge touch.`);
  }

  enemy.hp = 2;
  enemy.isDying = false;
  enemy.gravitySign = 1;
  enemy.x = 0;
  enemy.armVerticalEdgeKill();
  enemy.update(16 / 1000);
  if (enemy.hp !== 0 || !enemy.isDying) {
    throw new Error(`${enemy.constructor.name} did not die from an armed left room edge shove.`);
  }
}


// Phase Shift regression: the ability is unlocked, duration-based, can be
// cancelled manually into cooldown, ignores enemy body blocking while active,
// and no longer depends on a phase-marked barrier test setup.
const phaseAbility = debug.abilities.find((ability) => ability.id === "phase");
if (!phaseAbility || !phaseAbility.unlocked) throw new Error("Expected unlocked Phase Shift ability.");
if (!Array.isArray(debug.phaseBarriers) || debug.phaseBarriers.length !== 0) {
  throw new Error("Expected phase-marked barriers to be removed from the level.");
}
debug.setSelectedAbility("phase");
phaseAbility.cooldownRemaining = 0;
phaseAbility.activeRemaining = 0;
debug.player.hp = 3;
debug.player.isDying = false;
debug.player.gravitySign = 1;
debug.player.h = debug.constants.STAND_HEIGHT;
debug.player.x = 520;
debug.player.y = 402;
debug.player.vx = 0;
debug.player.vy = 0;
if (!debug.activateSelectedAbility() || !debug.isPlayerPhased()) {
  throw new Error("Phase Shift did not activate through the selected ability system.");
}
if (phaseAbility.cooldownRemaining > 0 || phaseAbility.activeRemaining <= 0) {
  throw new Error("Phase Shift cooldown/timer state was incorrect immediately after activation.");
}
const phaseEnemy = debug.enemies[0];
if (!phaseEnemy) throw new Error("Expected an enemy for Phase Shift contact regression.");
phaseEnemy.hp = 2;
phaseEnemy.isDying = false;
phaseEnemy.x = debug.player.x;
phaseEnemy.y = debug.player.y;
debug.player.x = phaseEnemy.x;
debug.player.y = phaseEnemy.y;
debug.player.hp = 3;
debug.player.damageTimer = 0;
debug.update(16 / 1000);
if (debug.player.hp !== 3) {
  throw new Error("Phased player took enemy contact damage.");
}
context.calls = [];
debug.player.gravitySign = 1;
debug.player.draw();
const phaseFillCalls = context.calls.filter((call) => call.name === "fill");
if (phaseFillCalls.length < 2) {
  throw new Error("Phased player did not draw the new semi-transparent violet body fill.");
}
const phaseStrokeCalls = context.calls.filter((call) => call.name === "stroke");
if (phaseStrokeCalls.length < 5) {
  throw new Error("Phased player did not draw enough violet outline strokes for body and limbs.");
}
if (!debug.activateSelectedAbility() || debug.isPlayerPhased()) {
  throw new Error("Phase Shift did not manually cancel when selected and tapped again.");
}
if (phaseAbility.cooldownRemaining <= 0 || phaseAbility.activeRemaining > 0) {
  throw new Error("Phase Shift cancellation did not start cooldown and clear active time.");
}
if (debug.activateSelectedAbility()) {
  throw new Error("Phase Shift activation bypassed cooldown after cancellation.");
}
phaseAbility.cooldownRemaining = 0;
phaseAbility.activeRemaining = 0;
if (!debug.activateSelectedAbility()) throw new Error("Phase Shift did not reactivate for duration expiry regression.");
for (let elapsed = 0; elapsed < debug.constants.PHASE_SHIFT_DURATION + 0.1; elapsed += 0.1) debug.update(0.1);
if (debug.isPlayerPhased()) throw new Error("Phase Shift did not end after its active duration.");
if (phaseAbility.cooldownRemaining <= 0) throw new Error("Phase Shift cooldown did not start after duration expiry.");
phaseAbility.cooldownRemaining = 0;
phaseAbility.activeRemaining = 0;

// Regression: spike hazards deal one player damage, knock the player clear,
// and do not leave the player standing inside the spike strip.
debug.player.x = 942;
debug.player.y = 420;
debug.player.hp = 3;
debug.player.gravitySign = 1;
debug.player.damageTimer = 0;
debug.player.fallRespawnGraceTimer = 0;
debug.player.isDying = false;
debug.update(16 / 1000);
if (debug.player.hp !== 2) {
  throw new Error(`Expected floor spikes to deal one player damage, got HP ${debug.player.hp}.`);
}
const floorSpike = debug.spikes.find((spike) => spike.side === "top");
if (!floorSpike) throw new Error("Expected a floor spike strip for damage regression.");

if (debug.player.x + debug.player.w > floorSpike.x && debug.player.x < floorSpike.x + floorSpike.w) {
  throw new Error("Player recovered inside the floor spike strip.");
}

phaseAbility.cooldownRemaining = 0;
phaseAbility.activeRemaining = 0;
debug.player.x = 942;
debug.player.y = 420;
debug.player.hp = 3;
debug.player.gravitySign = 1;
debug.player.damageTimer = 0;
debug.player.fallRespawnGraceTimer = 0;
debug.player.isDying = false;
debug.player.vx = 0;
debug.player.vy = 0;
if (!debug.activatePhaseShift()) throw new Error("Phase Shift did not activate for spike immunity regression.");
debug.update(16 / 1000);
if (debug.player.hp !== 3 || debug.player.damageTimer > 0) {
  throw new Error("Phased player took spike damage or recoil while crossing spikes.");
}
if (!debug.endPhaseShift(false)) throw new Error("Phase Shift did not end after spike immunity regression.");
phaseAbility.cooldownRemaining = 0;
phaseAbility.activeRemaining = 0;

// Regression: damage invulnerability should stop repeated HP loss, but never
// let the player phase through or remain inside a spike strip.
debug.player.x = 942;
debug.player.y = 420;
debug.player.hp = 2;
debug.player.gravitySign = 1;
debug.player.damageTimer = 0.5;
debug.player.fallRespawnGraceTimer = 0;
debug.player.isDying = false;
debug.update(16 / 1000);
if (debug.player.hp !== 2) {
  throw new Error(`Expected invulnerable spike contact to preserve HP, got ${debug.player.hp}.`);
}
if (debug.player.x + debug.player.w > floorSpike.x && debug.player.x < floorSpike.x + floorSpike.w) {
  throw new Error("Invulnerable player was allowed to remain inside the floor spike strip.");
}


// Regression: hitting floor spikes while gravity is reversed should still eject
// from the spike side, not teleport the player through the platform.
debug.player.x = 942;
debug.player.y = 420;
debug.player.hp = 3;
debug.player.gravitySign = -1;
debug.player.damageTimer = 0;
debug.player.fallRespawnGraceTimer = 0;
debug.player.isDying = false;
debug.update(16 / 1000);
if (debug.player.hp !== 2) {
  throw new Error(`Expected reversed-gravity floor spikes to deal one player damage, got HP ${debug.player.hp}.`);
}
if (debug.player.gravitySign !== -1) {
  throw new Error("Reversed-gravity floor spike damage reset inverted gravity.");
}
if (debug.player.y >= floorSpike.platform.y) {
  throw new Error("Player was moved through to the underside after reversed-gravity floor spike damage.");
}

// Regression: flipping gravity immediately after spike recovery should launch away
// from the current contact side instead of snapping to the opposite platform side.
debug.player.x = 942;
debug.player.y = 420;
debug.player.hp = 3;
debug.player.gravitySign = 1;
debug.player.damageTimer = 0;
debug.player.fallRespawnGraceTimer = 0;
debug.player.isDying = false;
debug.player.onSurface = false;
debug.update(16 / 1000);
if (debug.player.hp !== 2) {
  throw new Error(`Expected setup spike hit to deal one player damage, got HP ${debug.player.hp}.`);
}
debug.toggleGravityField();
if (debug.player.gravitySign !== -1) {
  throw new Error("Expected gravity field to invert player after spike recovery.");
}
if (debug.player.y >= floorSpike.platform.y) {
  throw new Error("Gravity flip after spike recovery snapped player through the platform.");
}
debug.resetGravityField(true);

// Regression: inverted-gravity spike damage should knock the player away from
// underside spikes without resetting gravity or placing them on top of the platform.
const undersideSpike = debug.spikes.find((spike) => spike.side === "bottom");
if (!undersideSpike) throw new Error("Expected an underside spike strip for gravity recovery regression.");
debug.player.x = undersideSpike.x + 22;
debug.player.y = undersideSpike.platform.y + undersideSpike.platform.h;
debug.player.hp = 3;
debug.player.gravitySign = -1;
debug.player.damageTimer = 0;
debug.player.fallRespawnGraceTimer = 0;
debug.player.isDying = false;
debug.update(16 / 1000);
if (debug.player.hp !== 2) {
  throw new Error(`Expected underside spikes to deal one player damage, got HP ${debug.player.hp}.`);
}
if (debug.player.gravitySign !== -1) {
  throw new Error("Underside spike damage reset inverted gravity.");
}
if (debug.player.y < undersideSpike.platform.y + undersideSpike.platform.h) {
  throw new Error("Player was moved onto the top side of the platform after underside spike damage.");
}
if (debug.player.x + debug.player.w > undersideSpike.x && debug.player.x < undersideSpike.x + undersideSpike.w) {
  throw new Error("Player was not pushed horizontally clear of the underside spike strip.");
}

// Collision regression: fast vertical movement must stop at the first platform
// surface it crosses instead of tunneling/flipping to the opposite side between
// frames. This covers both normal and inverted gravity landings on thin ledges.
const thinLedge = debug.platforms[6];
if (!thinLedge) throw new Error("Expected a thin ledge for swept platform collision regression.");
for (const enemy of debug.enemies) {
  enemy.hp = 0;
  enemy.isDying = true;
}
debug.player.x = thinLedge.x + 24;
debug.player.y = thinLedge.y - debug.constants.STAND_HEIGHT - 55;
debug.player.h = debug.constants.STAND_HEIGHT;
debug.player.gravitySign = 1;
debug.player.vx = 0;
debug.player.vy = 900;
debug.player.onSurface = false;
debug.player.isDying = false;
debug.player.moveAndCollide(0.2);
if (Math.abs(debug.player.y - (thinLedge.y - debug.player.h)) > 0.01 || !debug.player.onSurface) {
  throw new Error("Fast downward player movement tunneled through a thin platform.");
}
debug.player.y = thinLedge.y + thinLedge.h + 25;
debug.player.gravitySign = -1;
debug.player.vx = 0;
debug.player.vy = -900;
debug.player.onSurface = false;
debug.player.moveAndCollide(0.2);
if (Math.abs(debug.player.y - (thinLedge.y + thinLedge.h)) > 0.01 || !debug.player.onSurface) {
  throw new Error("Fast inverted-gravity player movement tunneled through a thin platform.");
}

// Regression: an enemy flipped into ceiling-attached spikes should dissolve via
// its normal death state instead of landing safely on the ceiling platform.
const walker = debug.enemies[0];
walker.x = 650;
walker.y = 28;
walker.hp = 2;
walker.isDying = false;
walker.walkerState = "airborne";
walker.gravitySign = -1;
debug.update(16 / 1000);
if (walker.hp !== 0 || !walker.isDying) {
  throw new Error("Walker did not enter its death state after touching ceiling spikes.");
}

// Edge hazard regression: respawn-safe bounds may be inset from the screen edge,
// but fall damage should wait until the player actually touches the real room
// boundary rather than the tighter respawn placement clamp.
debug.player.hp = 3;
debug.player.isDying = false;
debug.player.damageTimer = 0;
debug.player.fallRespawnGraceTimer = 0;
debug.player.gravitySign = 1;
debug.player.h = debug.constants.STAND_HEIGHT;
debug.player.x = 330;
debug.player.y = debug.bottomFallBoundary - debug.player.h + 4;
debug.player.vx = 0;
debug.player.vy = 0;
debug.player.onSurface = false;
debug.player.gravityResetEdgeHazardTimer = 0;
if (debug.player.isInvalidEdgeFallState()) {
  throw new Error("Player entered fall-damage state at the respawn-safe boundary instead of the real room edge.");
}
debug.player.y = debug.roomHazardBounds.bottom - debug.player.h + 1;
debug.player.vy = 0;
debug.player.onSurface = false;
debug.player.fallRespawnGraceTimer = 0;
if (!debug.player.isInvalidEdgeFallState()) {
  throw new Error("Player did not enter fall-damage state at the real room edge.");
}
debug.player.fallOutOfWorld();
if (debug.player.hp !== 2) {
  throw new Error(`Player did not take fall damage at the real room edge; HP ${debug.player.hp}.`);
}

// Side edge regression: horizontal room boundaries are walls, not fall hazards.
debug.player.hp = 3;
debug.player.isDying = false;
debug.player.damageTimer = 0;
debug.player.fallRespawnGraceTimer = 0;
debug.player.gravityResetEdgeHazardTimer = 1;
debug.player.h = debug.constants.STAND_HEIGHT;
debug.player.x = 0;
debug.player.y = 300;
debug.player.vx = 0;
debug.player.vy = 0;
debug.player.onSurface = false;
debug.player.touchedWorldBoundary = true;
if (debug.player.isInvalidEdgeFallState()) {
  throw new Error("Player entered fall-damage state at the left room edge.");
}
debug.player.x = debug.roomHazardBounds.right - debug.player.w;
if (debug.player.isInvalidEdgeFallState()) {
  throw new Error("Player entered fall-damage state at the right room edge.");
}

// Gravity Field edge regression: a stale ceiling/edge recovery anchor should not
// leave the player outside the playable room after fall damage. The fall keeps
// one HP loss, clears the invalid state, and chooses the nearest valid surface.
debug.player.hp = 3;
debug.player.isDying = false;
debug.player.damageTimer = 0;
debug.player.fallRespawnGraceTimer = 0;
debug.player.gravitySign = 1;
debug.player.x = 640;
debug.player.y = debug.bottomFallBoundary + 20;
debug.player.vx = 120;
debug.player.vy = 900;
debug.player.lastGroundedPlatform = debug.platforms[0];
debug.player.lastGroundedEdge = "right";
debug.player.lastValidInBoundsPosition = { x: 640, y: 250 };
debug.player.fallOutOfWorld();
if (debug.player.hp !== 2 || debug.player.isDying) {
  throw new Error("Gravity-reset edge fall did not apply exactly one non-lethal HP loss.");
}
if (debug.player.y < 0 || debug.player.y + debug.player.h > debug.bottomFallBoundary) {
  throw new Error("Gravity-reset edge fall respawn left the player outside playable bounds.");
}
if (debug.player.lastGroundedPlatform === debug.platforms[0]) {
  throw new Error("Gravity-reset edge fall reused an invalid ceiling platform as the respawn anchor.");
}
if (debug.player.vx !== 0 || debug.player.vy !== 0 || !debug.player.onSurface) {
  throw new Error("Gravity-reset edge fall did not reset velocity and ground the player safely.");
}

console.log("Smoke test passed: game boots, schedules frames, and keeps a valid player state.");
