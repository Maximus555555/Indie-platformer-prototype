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
if (debug.levelRooms.length !== 4 || debug.levelRooms[0].id !== "room-1" || debug.levelRooms[1].id !== "room-2" || debug.levelRooms[2].id !== "room-3" || debug.levelRooms[3].id !== "room-4") {
  throw new Error(`Expected Level 1 Rooms 1 through 4 only, got ${debug.levelRooms.map((room) => room.id).join(", ")}.`);
}
if (debug.enemies.length !== 0 || debug.getActiveEnemies().length !== 0) {
  throw new Error("Level 1 Rooms 1-4 should not create or activate any enemies.");
}
if (debug.spikes.length !== 0 || debug.phaseBarriers.length !== 0) {
  throw new Error("Level 1 Rooms 1-4 should not include hazards, spikes, or phase barriers.");
}
if (debug.doors.length !== 0 || debug.exitMarker !== null) {
  throw new Error("Level 1 Rooms 1-4 should not include doors, gates, or exit markers.");
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
  { x: room4X + 245, y: 96, w: 470, h: 24 },
  { x: room4X + 365, y: 260, w: 54, h: 280 },
  { x: room4X + 430, y: 505, w: 170, h: 35 },
  { x: room4X + 650, y: 470, w: 310, h: 70 }
];
const expectedAllPlatforms = [...expectedPlatforms, ...expectedRoom2Platforms, ...expectedRoom3Platforms, ...expectedRoom4Platforms];
if (debug.platforms.length !== expectedAllPlatforms.length) {
  throw new Error(`Expected ${expectedAllPlatforms.length} Level 1 Room 1-4 platforms, got ${debug.platforms.length}.`);
}
for (const expected of expectedAllPlatforms) {
  if (!debug.platforms.some((platform) => platform.x === expected.x && platform.y === expected.y && platform.w === expected.w && platform.h === expected.h)) {
    throw new Error(`Missing expected platform ${JSON.stringify(expected)}.`);
  }
}

for (const ability of debug.abilities) {
  if (ability.unlocked) throw new Error(`${ability.name} should be locked at Level 1, Room 1 start.`);
}

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
  "Gravity Field unlocked."
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
const nonBlockingTriggerPositions = [86, 250, 360, 850, room2X + 40, room2X + 525, room2X + 780, room2X + 920, room3X + 40, room3X + 250, room3X + 700, room3X + 930, room4X + 900];
for (const x of nonBlockingTriggerPositions) {
  debug.player.placeAt(x, 420, { grounded: true });
  debug.update(16 / 1000);
}
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
debug.resetGravityField(true, false);
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

// Room 4 right edge is reserved for a future Room 5 transition without creating Room 5.
debug.enterRoom("room-4", { x: room4X + 900, y: 420 }, { grounded: true, facing: 1 });
debug.systemDialogue.activeAmbient = null;
debug.systemDialogue.ambientQueue.length = 0;
debug.player.placeAt(room4X + 960 - debug.player.w, 420, { grounded: true });
dispatch("keydown", keyEvent("d", "KeyD"));
debug.checkRoomEdgeTransitions();
dispatch("keyup", keyEvent("d", "KeyD"));
if (debug.getCurrentRoomId() !== "room-4") {
  throw new Error(`Room 4 right-edge pending transition should not leave Room 4; got ${debug.getCurrentRoomId()}.`);
}
if (debug.levelRooms.some((room) => room.id === "room-5")) {
  throw new Error("Room 5 should not be created yet.");
}
if (!debug.systemDialogue.logs.some((entry) => entry.id === "room-4-right-pending" && entry.text === "Room transition pending.")) {
  throw new Error("Room 4 right screen-edge transition did not log the pending transition message.");
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
