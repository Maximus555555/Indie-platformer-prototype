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

function keyEvent(key) {
  return { key, preventDefault: noop };
}

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
  throw new Error(`Energy Link did not transfer full System Pulse damage to all linked enemies; got ${linkA.hp}, ${linkB.hp}, and ${linkC.hp}.`);
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
if (linkA.vx <= 300 || linkB.vx <= 300 || linkC.vx <= 300) {
  throw new Error(`Energy Link did not transfer full Force Pulse knockback to all linked enemies; got ${linkA.vx}, ${linkB.vx}, and ${linkC.vx}.`);
}
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
for (const enemy of [linkA, linkB, linkC]) {
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
for (let elapsed = 0; elapsed < debug.constants.ENERGY_LINK_DURATION + 0.1; elapsed += 0.1) debug.update(0.1);
if (debug.getEnergyLinkState().active || linkAbility.activeRemaining > 0 || linkAbility.cooldownRemaining <= 0) {
  throw new Error("Energy Link duration expiry did not end link and start cooldown.");
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

// Anchor Field regression: it is selectable, starts cooldown only after ending,
// locks enemies in its visible radius, freezes projectiles, and reduces Force
// Pulse displacement while active.
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
anchorAbility.cooldownRemaining = 0;
anchorAbility.activeRemaining = 0;
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
forcePulseAbility.cooldownRemaining = 0;
debug.setSelectedAbility("pulse");
if (!debug.activateSelectedAbility()) throw new Error("Force Pulse did not activate against an anchored enemy.");
if (Math.abs(anchorWalker.x - anchoredWalkerX) > 0.01 || anchorWalker.vx !== 0) {
  throw new Error("Anchored enemy was displaced by Force Pulse knockback.");
}
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
if (context.calls.some((call) => call.name === "fill")) {
  throw new Error("Phased player drew filled body interiors instead of outlines only.");
}
const phaseStrokeCalls = context.calls.filter((call) => call.name === "stroke");
if (phaseStrokeCalls.length < 5) {
  throw new Error("Phased player did not draw enough outline strokes for body and limbs.");
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

console.log("Smoke test passed: game boots, schedules frames, and keeps a valid player state.");
