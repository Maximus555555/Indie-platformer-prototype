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
  context.calls.push({
    name,
    args,
    state: {
      font: context.font,
      textAlign: context.textAlign,
      textBaseline: context.textBaseline,
      lineWidth: context.lineWidth,
      strokeStyle: context.strokeStyle,
      fillStyle: context.fillStyle,
      globalAlpha: context.globalAlpha
    }
  });
};
const context = new Proxy({
  canvas: null,
  calls: [],
  arc: recordCanvasCall("arc"),
  fill: recordCanvasCall("fill"),
  fillRect: recordCanvasCall("fillRect"),
  fillText: recordCanvasCall("fillText"),
  ellipse: recordCanvasCall("ellipse"),
  lineTo: recordCanvasCall("lineTo"),
  moveTo: recordCanvasCall("moveTo"),
  stroke: recordCanvasCall("stroke"),
  createLinearGradient: () => ({ addColorStop: noop }),
  createRadialGradient: () => ({ addColorStop: noop }),
  measureText: (text) => ({ width: String(text).length * 8 }),
  globalAlpha: 1
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

function dispatch(type, event) {
  const listeners = eventListeners.get(type) ?? [];
  for (const listener of listeners) listener(event);
}

function keyEvent(key, code = "") {
  return { key, code, preventDefault: noop };
}

for (let frame = 0; frame < 90; frame += 1) tick();

const debug = windowStub.__indiePlatformerDebug;
if (!debug) throw new Error("Debug handle was not exposed; boot likely failed.");
if (!debug.player || !Array.isArray(debug.enemies)) {
  throw new Error("Expected player and enemy containers after boot.");
}
if (!Number.isFinite(debug.player.x) || !Number.isFinite(debug.player.y)) {
  throw new Error("Player position became invalid during smoke frames.");
}
if (debug.player.hp <= 0) throw new Error("Player unexpectedly died during idle smoke test.");
if (debug.getCurrentRoomId() !== "room-1") throw new Error(`Game should start in Level 1, Room 1; got ${debug.getCurrentRoomId()}.`);
if (debug.levelRooms.length !== 7 || debug.levelRooms[0].id !== "room-1" || debug.levelRooms[1].id !== "room-2" || debug.levelRooms[2].id !== "room-3" || debug.levelRooms[3].id !== "room-4" || debug.levelRooms[4].id !== "room-5" || debug.levelRooms[5].id !== "room-6" || debug.levelRooms[6].id !== "room-7") {
  throw new Error(`Expected Level 1 Rooms 1 through 7 only, got ${debug.levelRooms.map((room) => room.id).join(", ")}.`);
}
if (debug.enemies.length !== 1 || debug.getActiveEnemies().length !== 0) {
  throw new Error("Level 1 Room 7 should create exactly one Walker, inactive while the player starts in Room 1.");
}
if (debug.spikes.length !== 1 || debug.phaseBarriers.length !== 0) {
  throw new Error("Level 1 Room 7 should include one lower-platform spike strip and no phase barriers.");
}
if (debug.doors.length !== 0 || debug.exitMarker !== null) {
  throw new Error("Level 1 Rooms 1-6 should not include doors, gates, or exit markers.");
}

const expectedPlatforms = [
  { x: 0, y: 470, w: 360, h: 70 },
  { x: 410, y: 420, w: 150, h: 20 },
  { x: 560, y: 505, w: 70, h: 35 },
  { x: 630, y: 390, w: 160, h: 20 },
  { x: 760, y: 470, w: 200, h: 70 }
];
const room2X = 960;
const room3X = 1920;
const room4X = 2880;
const room5X = 3840;
const room6X = 4800;
const room7X = 5760;
const expectedRoom2Platforms = [
  { x: room2X, y: 470, w: 260, h: 70 },
  { x: room2X + 360, y: 430, w: 150, h: 24 },
  { x: room2X + 625, y: 370, w: 150, h: 24 },
  { x: room2X + 900, y: 470, w: 60, h: 70 }
];
const expectedRoom3Platforms = [
  { x: room3X, y: 470, w: 430, h: 70 },
  { x: room3X + 660, y: 470, w: 170, h: 70 },
  { x: room3X + 890, y: 470, w: 70, h: 70 }
];
const expectedRoom4Platforms = [
  { x: room4X, y: 470, w: 330, h: 70 },
  { x: room4X + 245, y: 0, w: 470, h: 24 },
  { x: room4X + 365, y: 260, w: 54, h: 280 },
  { x: room4X + 650, y: 470, w: 310, h: 70 }
];
const expectedRoom5Platforms = [
  { x: room5X, y: 470, w: 210, h: 24 },
  { x: room5X + 390, y: 0, w: 180, h: 24 },
  { x: room5X + 750, y: 470, w: 210, h: 24 }
];
const expectedRoom6Platforms = [
  { x: room6X, y: 470, w: 270, h: 70 },
  { x: room6X + 335, y: 430, w: 120, h: 24 },
  { x: room6X + 505, y: 470, w: 115, h: 70 },
  { x: room6X + 770, y: 260, w: 42, h: 280 },
  { x: room6X + 870, y: 470, w: 90, h: 70 }
];
const expectedRoom7Platforms = [
  { x: room7X, y: 470, w: 240, h: 70 },
  { x: room7X + 300, y: 430, w: 315, h: 24 },
  { x: room7X + 380, y: 190, w: 170, h: 24 },
  { x: room7X + 685, y: 430, w: 115, h: 24 },
  { x: room7X + 835, y: 470, w: 125, h: 70 }
];
const expectedAllPlatforms = [...expectedPlatforms, ...expectedRoom2Platforms, ...expectedRoom3Platforms, ...expectedRoom4Platforms, ...expectedRoom5Platforms, ...expectedRoom6Platforms, ...expectedRoom7Platforms];
if (debug.platforms.length !== expectedAllPlatforms.length) {
  throw new Error(`Expected ${expectedAllPlatforms.length} Level 1 Room 1-6 platforms, got ${debug.platforms.length}.`);
}
for (const expected of expectedAllPlatforms) {
  if (!debug.platforms.some((platform) => platform.x === expected.x && platform.y === expected.y && platform.w === expected.w && platform.h === expected.h)) {
    throw new Error(`Missing expected platform ${JSON.stringify(expected)}.`);
  }
}

for (const ability of debug.abilities) {
  if (ability.unlocked) throw new Error(`${ability.name} should be locked at Level 1, Room 1 start.`);
}
if (debug.hasUnlockedAbility()) throw new Error("Ability HUD should stay hidden before the first ability unlock.");

// Holding the ability key before any unlock should not reveal or pause on the
// ability wheel. The corner icon and wheel are only introduced after the first
// authorized ability becomes available.
dispatch("keydown", keyEvent("e", "KeyE"));
debug.update(0.3);
dispatch("keyup", keyEvent("e", "KeyE"));
debug.update(16 / 1000);
if (debug.abilityWheel.open) throw new Error("Ability wheel opened before the first ability unlock.");
debug.abilityWheel.open = true;
context.calls.length = 0;
debug.draw();
if (context.calls.some((call) => call.name === "fillText" && ["Gravity", "Time", "Pulse", "Anchor", "Phase", "Link"].includes(call.args[0]))) {
  throw new Error("Ability wheel labels drew before the first ability unlock.");
}
debug.abilityWheel.open = false;

const expectedTriggerMessages = [
  "Movement initialized.",
  "Input response acceptable.",
  "Vertical traversal permitted.",
  "Proceed.",
  "Traversal pattern accepted.",
  "Increase input commitment.",
  "Spatial correction stable.",
  "Continue.",
  "Velocity modulation available.",
  "Sustained input increases traversal range.",
  "Extended traversal confirmed.",
  "Proceed.",
  "New function detected.",
  "Gravitational override available.",
  "Input authorization granted.",
  "Gravity Field unlocked.",
  "Gravitational control persists.",
  "Trajectory may be corrected mid-motion.",
  "Arc deviation confirmed.",
  "Hostile process detected.",
  "Environmental correction may be applied."
];
for (const text of expectedTriggerMessages) {
  const trigger = debug.systemMessageTriggers.find((candidate) => candidate.messages.includes(text));
  if (!trigger) throw new Error(`Missing trigger for system message: ${text}`);
  if (trigger.repeat !== false) throw new Error(`System message trigger should fire once: ${text}`);
}

for (const trigger of debug.systemMessageTriggers) trigger.fired = false;
debug.systemDialogue.logs.length = 0;
debug.systemDialogue.loggedMessageKeys.clear();
debug.systemDialogue.activeAmbient = null;
debug.systemDialogue.ambientQueue.length = 0;
const nonBlockingTriggerPositions = [86, 250, 360, 850, room2X + 40, room2X + 525, room2X + 780, room2X + 920, room3X + 40, room3X + 250, room3X + 700, room3X + 930, room4X + 900, room6X + 40, room6X + 525, room6X + 920, room7X + 170, room7X + 315, room7X + 910];
for (const x of nonBlockingTriggerPositions) {
  debug.player.placeAt(x, 420, { grounded: true });
  debug.update(16 / 1000);
}
debug.player.placeAt(room6X + 835, 94, { resetGravity: false, grounded: true });
debug.player.gravitySign = -1;
debug.update(16 / 1000);
const triggerLogCounts = new Map();
for (const trigger of debug.systemMessageTriggers.filter((candidate) => !candidate.blocking)) {
  for (const text of trigger.messages) {
    if (trigger.id === "l1r4-orientation-shift") continue;
    const count = debug.systemDialogue.logs.filter((entry) => entry.id === trigger.id && entry.text === text).length;
    if (count !== 1) throw new Error(`Expected one log entry for "${text}" from ${trigger.id}, got ${count}.`);
    triggerLogCounts.set(`${trigger.id}:${text}`, count);
  }
}
for (const x of nonBlockingTriggerPositions) {
  debug.player.placeAt(x, 420, { grounded: true });
  debug.update(16 / 1000);
}
debug.player.placeAt(room6X + 835, 94, { resetGravity: false, grounded: true });
debug.player.gravitySign = -1;
debug.update(16 / 1000);
for (const trigger of debug.systemMessageTriggers.filter((candidate) => !candidate.blocking)) {
  for (const text of trigger.messages) {
    if (trigger.id === "l1r4-orientation-shift") continue;
    const count = debug.systemDialogue.logs.filter((entry) => entry.id === trigger.id && entry.text === text).length;
    if (count !== triggerLogCounts.get(`${trigger.id}:${text}`)) throw new Error(`Repeated trigger duplicated log entry for "${text}" from ${trigger.id}.`);
  }
}


// Room 4's Gravity Field unlock is blocking, advances one line per Enter, logs
// every unlock line once, and enables Gravity Field with the ready-pulse animation.
for (const trigger of debug.systemMessageTriggers) {
  if (trigger.id === "l1r4-gravity-unlock") trigger.fired = false;
}
debug.room4Progress.gravityUnlockStarted = false;
debug.room4Progress.gravityUnlocked = false;
const gravityAbility = debug.abilities.find((ability) => ability.id === "gravity");
if (!gravityAbility) throw new Error("Gravity Field ability is missing.");
gravityAbility.unlocked = false;
gravityAbility.cooldownRemaining = 0;
gravityAbility.activeRemaining = 0;
gravityAbility.readyPulseTimer = 0;
debug.systemDialogue.logs.length = 0;
debug.systemDialogue.loggedMessageKeys.clear();
debug.systemDialogue.activeBlocking = null;
debug.systemDialogue.blockingQueue.length = 0;
debug.systemDialogue.activeAmbient = null;
debug.systemDialogue.ambientQueue.length = 0;
debug.enterRoom("room-4", { x: room4X + 18, y: 420 }, { grounded: true, facing: 1 });
debug.player.placeAt(room4X + 90, 420, { grounded: true });
debug.update(16 / 1000);
if (!debug.systemDialogue.activeBlocking) throw new Error("Room 4 unlock trigger did not start blocking system text.");
if (gravityAbility.unlocked) throw new Error("Gravity Field unlocked before the Room 4 sequence completed.");
function advanceBlockingLine() {
  for (let frame = 0; frame < 60; frame += 1) debug.update(16 / 1000);
  dispatch("keydown", keyEvent("Enter", "Enter"));
  debug.update(16 / 1000);
  dispatch("keyup", keyEvent("Enter", "Enter"));
}
for (let line = 0; line < 4; line += 1) advanceBlockingLine();
if (debug.systemDialogue.activeBlocking || debug.systemDialogue.blockingQueue.length > 0) {
  throw new Error("Room 4 unlock sequence did not clear after the final Enter press.");
}
if (!gravityAbility.unlocked || debug.room4Progress.gravityUnlocked !== true) {
  throw new Error("Gravity Field did not unlock after the Room 4 system text sequence.");
}
if (gravityAbility.readyPulseTimer <= 0) throw new Error("Gravity Field unlock did not start the ready-pulse icon animation.");
if (debug.abilityUnlockNotice.abilityId !== "gravity") throw new Error("Gravity Field unlock did not start the ability unlock popup.");
if (debug.abilityUnlockNotice.timer <= 0 || debug.abilityUnlockNotice.worldAnimTimer <= 0) {
  throw new Error("Gravity Field unlock did not start both popup and world animation timers.");
}
context.calls.length = 0;
debug.draw();
if (!context.calls.some((call) => call.name === "fillText" && call.args[0] === "ABILITY UNLOCKED")) {
  throw new Error("Ability unlock popup did not draw its title text.");
}
if (!context.calls.some((call) => call.name === "fillText" && call.args[0] === "GRAVITY FIELD")) {
  throw new Error("Ability unlock popup did not draw the unlocked ability name.");
}
for (const text of ["New function detected.", "Gravitational override available.", "Input authorization granted.", "Gravity Field unlocked."]) {
  const count = debug.systemDialogue.logs.filter((entry) => entry.id === "l1r4-gravity-unlock" && entry.text === text).length;
  if (count !== 1) throw new Error(`Expected one Room 4 unlock log for "${text}", got ${count}.`);
}
debug.player.placeAt(room4X + 260, 420, { grounded: true });
if (!debug.activateSelectedAbility()) throw new Error("Gravity Field should be usable after the Room 4 unlock.");
if (debug.player.gravitySign !== -1) throw new Error("Gravity Field did not flip the player's gravity in Room 4.");
const orientationLogCount = debug.systemDialogue.logs.filter((entry) => entry.id === "l1r4-orientation-shift" && entry.text === "Orientation shift confirmed.").length;
if (orientationLogCount !== 1) throw new Error(`Expected one orientation shift log, got ${orientationLogCount}.`);
debug.player.y = -debug.player.h - 4;
debug.player.onSurface = false;
debug.update(16 / 1000);
if (debug.getActiveAbilityEffectState().gravityFieldActive) throw new Error("Top-boundary fall recovery should clear Gravity Field.");
if (gravityAbility.cooldownRemaining <= 0) throw new Error("Top-boundary fall recovery should start Gravity Field cooldown.");
if (gravityAbility.cooldownRemaining > gravityAbility.cooldownDuration) throw new Error("Gravity Field cooldown exceeded its configured duration after fall recovery.");
debug.resetGravityField(true, false);
gravityAbility.cooldownRemaining = 0;
debug.enterRoom("room-1", { x: 86, y: 420 }, { grounded: true, facing: 1 });

// System Pulse remains available as the basic attack even though the ability
// wheel's Force Pulse upgrade stays locked.
debug.pulses.length = 0;
debug.player.placeAt(100, 170, { grounded: false });
debug.player.attackFacing = 1;
debug.player.attackPulseQueued = true;
debug.player.releasePulse();
const pulse = debug.pulses.at(-1);
if (!pulse) throw new Error("System Pulse basic attack did not spawn in Room 1.");
if (Math.abs(pulse.endX - debug.getCurrentRoom().w) > 0.001) {
  throw new Error(`Room 1 System Pulse should reach the right screen edge when unobstructed; got ${pulse.endX}.`);
}

// Right screen-edge contact moves from Room 1 to Room 2 with the existing fade
// transition, and Room 2 supports the backward left-edge transition.
debug.systemDialogue.activeAmbient = null;
debug.systemDialogue.ambientQueue.length = 0;
debug.player.placeAt(debug.getCurrentRoom().x + debug.getCurrentRoom().w - debug.player.w, 420, { grounded: true });
debug.player.damageTimer = 0;
debug.player.fallRespawnGraceTimer = 0;
debug.player.vx = 0;
debug.player.vy = 0;
dispatch("keydown", keyEvent("d", "KeyD"));
debug.checkRoomEdgeTransitions();
for (let frame = 0; frame < 24; frame += 1) debug.update(16 / 1000);
dispatch("keyup", keyEvent("d", "KeyD"));
if (debug.getCurrentRoomId() !== "room-2") {
  throw new Error(`Room 1 right-edge transition should enter Room 2; got ${debug.getCurrentRoomId()}.`);
}
if (debug.player.x < room2X || debug.player.x > room2X + 60) {
  throw new Error(`Room 2 entry should place the player at the left start, got x=${debug.player.x}.`);
}

debug.player.placeAt(room2X, 420, { grounded: true });
dispatch("keydown", keyEvent("a", "KeyA"));
debug.checkRoomEdgeTransitions();
for (let frame = 0; frame < 24; frame += 1) debug.update(16 / 1000);
dispatch("keyup", keyEvent("a", "KeyA"));
if (debug.getCurrentRoomId() !== "room-1") {
  throw new Error(`Room 2 left-edge transition should return to Room 1; got ${debug.getCurrentRoomId()}.`);
}

// Room 2 right edge now connects to Room 3. Room 3 can return left to Room 2.
debug.enterRoom("room-2", { x: room2X + 900, y: 420 }, { grounded: true, facing: 1 });
debug.player.placeAt(room2X + 960 - debug.player.w, 420, { grounded: true });
dispatch("keydown", keyEvent("d", "KeyD"));
debug.checkRoomEdgeTransitions();
for (let frame = 0; frame < 24; frame += 1) debug.update(16 / 1000);
dispatch("keyup", keyEvent("d", "KeyD"));
if (debug.getCurrentRoomId() !== "room-3") {
  throw new Error(`Room 2 right-edge transition should enter Room 3; got ${debug.getCurrentRoomId()}.`);
}
if (debug.player.x < room3X || debug.player.x > room3X + 60) {
  throw new Error(`Room 3 entry should place the player at the left start, got x=${debug.player.x}.`);
}

debug.player.placeAt(room3X, 420, { grounded: true });
dispatch("keydown", keyEvent("a", "KeyA"));
debug.checkRoomEdgeTransitions();
for (let frame = 0; frame < 24; frame += 1) debug.update(16 / 1000);
dispatch("keyup", keyEvent("a", "KeyA"));
if (debug.getCurrentRoomId() !== "room-2") {
  throw new Error(`Room 3 left-edge transition should return to Room 2; got ${debug.getCurrentRoomId()}.`);
}

// Room 3 right edge connects to Room 4, and Room 4 can return left to Room 3.
debug.enterRoom("room-3", { x: room3X + 900, y: 420 }, { grounded: true, facing: 1 });
debug.systemDialogue.activeAmbient = null;
debug.systemDialogue.ambientQueue.length = 0;
debug.player.placeAt(room3X + 960 - debug.player.w, 420, { grounded: true });
dispatch("keydown", keyEvent("d", "KeyD"));
debug.checkRoomEdgeTransitions();
for (let frame = 0; frame < 24; frame += 1) debug.update(16 / 1000);
dispatch("keyup", keyEvent("d", "KeyD"));
if (debug.getCurrentRoomId() !== "room-4") {
  throw new Error(`Room 3 right-edge transition should enter Room 4; got ${debug.getCurrentRoomId()}.`);
}
if (debug.player.x < room4X || debug.player.x > room4X + 60) {
  throw new Error(`Room 4 entry should place the player at the left start, got x=${debug.player.x}.`);
}

debug.player.placeAt(room4X, 420, { grounded: true });
dispatch("keydown", keyEvent("a", "KeyA"));
debug.checkRoomEdgeTransitions();
for (let frame = 0; frame < 24; frame += 1) debug.update(16 / 1000);
dispatch("keyup", keyEvent("a", "KeyA"));
if (debug.getCurrentRoomId() !== "room-3") {
  throw new Error(`Room 4 left-edge transition should return to Room 3; got ${debug.getCurrentRoomId()}.`);
}

// Room 4 right edge connects to Room 5, and Room 5 can return left to Room 4.
debug.enterRoom("room-4", { x: room4X + 900, y: 420 }, { grounded: true, facing: 1 });
debug.systemDialogue.activeAmbient = null;
debug.systemDialogue.ambientQueue.length = 0;
debug.player.placeAt(room4X + 960 - debug.player.w, 420, { grounded: true });
dispatch("keydown", keyEvent("d", "KeyD"));
debug.checkRoomEdgeTransitions();
for (let frame = 0; frame < 24; frame += 1) debug.update(16 / 1000);
dispatch("keyup", keyEvent("d", "KeyD"));
if (debug.getCurrentRoomId() !== "room-5") {
  throw new Error(`Room 4 right-edge transition should enter Room 5; got ${debug.getCurrentRoomId()}.`);
}
if (debug.player.x < room5X || debug.player.x > room5X + 60) {
  throw new Error(`Room 5 entry should place the player at the left start, got x=${debug.player.x}.`);
}

debug.player.placeAt(room5X, 420, { grounded: true });
dispatch("keydown", keyEvent("a", "KeyA"));
debug.checkRoomEdgeTransitions();
for (let frame = 0; frame < 24; frame += 1) debug.update(16 / 1000);
dispatch("keyup", keyEvent("a", "KeyA"));
if (debug.getCurrentRoomId() !== "room-4") {
  throw new Error(`Room 5 left-edge transition should return to Room 4; got ${debug.getCurrentRoomId()}.`);
}

// Room 5 right edge now connects to Room 6, and Room 6 can return left to Room 5.
debug.enterRoom("room-5", { x: room5X + 900, y: 420 }, { grounded: true, facing: 1 });
debug.systemDialogue.activeAmbient = null;
debug.systemDialogue.ambientQueue.length = 0;
debug.player.placeAt(room5X + 960 - debug.player.w, 420, { grounded: true });
dispatch("keydown", keyEvent("d", "KeyD"));
debug.checkRoomEdgeTransitions();
for (let frame = 0; frame < 24; frame += 1) debug.update(16 / 1000);
dispatch("keyup", keyEvent("d", "KeyD"));
if (debug.getCurrentRoomId() !== "room-6") {
  throw new Error(`Room 5 right-edge transition should enter Room 6; got ${debug.getCurrentRoomId()}.`);
}
if (debug.player.x < room6X || debug.player.x > room6X + 60) {
  throw new Error(`Room 6 entry should place the player at the left start, got x=${debug.player.x}.`);
}

debug.player.placeAt(room6X, 420, { grounded: true });
dispatch("keydown", keyEvent("a", "KeyA"));
debug.checkRoomEdgeTransitions();
for (let frame = 0; frame < 24; frame += 1) debug.update(16 / 1000);
dispatch("keyup", keyEvent("a", "KeyA"));
if (debug.getCurrentRoomId() !== "room-5") {
  throw new Error(`Room 6 left-edge transition should return to Room 5; got ${debug.getCurrentRoomId()}.`);
}

// Room 6 right edge now connects to Room 7, and Room 7 can return left to Room 6.
debug.enterRoom("room-6", { x: room6X + 900, y: 420 }, { grounded: true, facing: 1 });
debug.systemDialogue.activeAmbient = null;
debug.systemDialogue.ambientQueue.length = 0;
debug.player.placeAt(room6X + 960 - debug.player.w, 420, { grounded: true });
dispatch("keydown", keyEvent("d", "KeyD"));
debug.checkRoomEdgeTransitions();
for (let frame = 0; frame < 24; frame += 1) debug.update(16 / 1000);
dispatch("keyup", keyEvent("d", "KeyD"));
if (debug.getCurrentRoomId() !== "room-7") {
  throw new Error(`Room 6 right-edge transition should enter Room 7; got ${debug.getCurrentRoomId()}.`);
}
if (debug.player.x < room7X || debug.player.x > room7X + 60) {
  throw new Error(`Room 7 entry should place the player at the left start, got x=${debug.player.x}.`);
}
if (debug.getActiveEnemies().length !== 1) {
  throw new Error("Room 7 should activate exactly one Walker.");
}
const activeRoom7Walker = debug.getActiveEnemies()[0];
if (activeRoom7Walker.gravitySign !== -1 || activeRoom7Walker.defaultGravitySign !== -1) {
  throw new Error("Room 7 Walker should spawn with reversed default gravity.");
}
const room7TopPlatform = debug.platforms.find((platform) => platform.id === "room7-top-platform");
if (!room7TopPlatform || room7TopPlatform.moveSpeed !== 18 || room7TopPlatform.moveDirection !== -1) {
  throw new Error("Room 7 top platform should start moving slowly to the left.");
}
activeRoom7Walker.gravitySign = 1;
activeRoom7Walker.gravityFieldRemaining = 0.001;
debug.update(0.01);
if (activeRoom7Walker.gravitySign !== -1) {
  throw new Error("Room 7 Walker should return to reversed gravity when Gravity Field times out.");
}
debug.resetRoomState("room-7");

debug.player.placeAt(room7X, 420, { grounded: true });
dispatch("keydown", keyEvent("a", "KeyA"));
debug.checkRoomEdgeTransitions();
for (let frame = 0; frame < 24; frame += 1) debug.update(16 / 1000);
dispatch("keyup", keyEvent("a", "KeyA"));
if (debug.getCurrentRoomId() !== "room-6") {
  throw new Error(`Room 7 left-edge transition should return to Room 6; got ${debug.getCurrentRoomId()}.`);
}

// Room 7 right edge is reserved for the future Room 8 transition.
debug.enterRoom("room-7", { x: room7X + 900, y: 420 }, { grounded: true, facing: 1 });
debug.systemDialogue.activeAmbient = null;
debug.systemDialogue.ambientQueue.length = 0;
debug.player.placeAt(room7X + 960 - debug.player.w, 420, { grounded: true });
dispatch("keydown", keyEvent("d", "KeyD"));
debug.checkRoomEdgeTransitions();
dispatch("keyup", keyEvent("d", "KeyD"));
if (debug.getCurrentRoomId() !== "room-7") {
  throw new Error(`Room 7 right-edge pending transition should not leave Room 7; got ${debug.getCurrentRoomId()}.`);
}
if (!debug.systemDialogue.logs.some((entry) => entry.id === "room-7-right-pending" && entry.text === "Room transition pending.")) {
  throw new Error("Room 7 right screen-edge transition did not log the pending transition message.");
}

const room7Walker = debug.enemies[0];
debug.resetRoomState("room-7");
debug.room7Progress.indirectTerminationConfirmed = false;
debug.systemDialogue.logs.length = 0;
debug.systemDialogue.loggedMessageKeys.clear();
room7Walker.x = room7X + 440;
room7Walker.y = 402;
room7Walker.hp = 2;
room7Walker.isDying = false;
room7Walker.gravitySign = 1;
room7Walker.walkerState = "gravity-flipped";
if (!debug.spikes.some((spike) => spike.side === "top" && spike.x === room7X + 385 && spike.w === 150)) {
  throw new Error("Room 7 lower-platform spike strip is missing or misplaced.");
}
debug.update(16 / 1000);
if (!room7Walker.isDying || !debug.room7Progress.indirectTerminationConfirmed) {
  throw new Error("Room 7 Walker did not die and confirm indirect termination when touching ceiling spikes.");
}
if (!debug.systemDialogue.logs.some((entry) => entry.id === "l1r7-indirect-termination" && entry.text === "Indirect termination confirmed.")) {
  throw new Error("Room 7 spike kill did not log the indirect termination message.");
}

const room6ShaftGap = { left: room6X + 620, right: room6X + 770 };
if (room6ShaftGap.right - room6ShaftGap.left <= debug.player.w * 2) {
  throw new Error("Room 6 shaft gap is too narrow to teach midair gravity timing.");
}
for (const ability of debug.abilities) {
  if (ability.id === "gravity") {
    ability.unlocked = true;
  } else if (ability.unlocked) {
    throw new Error(`${ability.name} should remain locked in Room 6.`);
  }
}

const sprintGap = { left: room3X + 430, right: room3X + 660 };
const walkingJumpRange = 230 * Math.abs((-480 * 2) / 1200);
const sprintJumpRange = 340 * Math.abs((-480 * 2) / 1200);
if (sprintGap.right - sprintGap.left <= walkingJumpRange + debug.player.w) {
  throw new Error("Room 3 sprint gap is short enough for a walking jump.");
}
if (sprintGap.right - sprintGap.left >= sprintJumpRange) {
  throw new Error("Room 3 sprint gap leaves no forgiving sprint-jump clearance.");
}
