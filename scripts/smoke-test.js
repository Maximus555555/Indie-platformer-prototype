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
if (debug.levelRooms.length !== 1 || debug.levelRooms[0].id !== "room-1") {
  throw new Error(`Expected only Room 1 to exist, got ${debug.levelRooms.map((room) => room.id).join(", ")}.`);
}
if (debug.enemies.length !== 0 || debug.getActiveEnemies().length !== 0) {
  throw new Error("Room 1 should not create or activate any enemies.");
}
if (debug.spikes.length !== 0 || debug.phaseBarriers.length !== 0) {
  throw new Error("Room 1 should not include hazards, spikes, or phase barriers.");
}
if (debug.doors.length !== 0 || debug.exitMarker !== null) {
  throw new Error("Room 1 should not include doors, gates, or exit markers.");
}

const expectedPlatforms = [
  { x: 0, y: 470, w: 360, h: 70 },
  { x: 410, y: 420, w: 150, h: 20 },
  { x: 560, y: 505, w: 70, h: 35 },
  { x: 630, y: 390, w: 160, h: 20 },
  { x: 760, y: 470, w: 200, h: 70 }
];
if (debug.platforms.length !== expectedPlatforms.length) {
  throw new Error(`Expected ${expectedPlatforms.length} Room 1 platforms, got ${debug.platforms.length}.`);
}
for (const expected of expectedPlatforms) {
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
  "Proceed."
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
for (const x of [86, 250, 360, 850]) {
  debug.player.placeAt(x, 420, { grounded: true });
  debug.update(16 / 1000);
}
for (const text of expectedTriggerMessages) {
  const count = debug.systemDialogue.logs.filter((entry) => entry.text === text).length;
  if (count !== 1) throw new Error(`Expected one log entry for "${text}", got ${count}.`);
}
for (const x of [86, 250, 360, 850]) {
  debug.player.placeAt(x, 420, { grounded: true });
  debug.update(16 / 1000);
}
for (const text of expectedTriggerMessages) {
  const count = debug.systemDialogue.logs.filter((entry) => entry.text === text).length;
  if (count !== 1) throw new Error(`Repeated trigger duplicated log entry for "${text}".`);
}

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

// Right screen-edge contact is recognized as a future transition point, but no
// Room 2 exists yet and the player remains in Room 1.
debug.systemDialogue.activeAmbient = null;
debug.systemDialogue.ambientQueue.length = 0;
debug.player.placeAt(debug.getCurrentRoom().w - debug.player.w, 420, { grounded: true });
debug.player.damageTimer = 0;
debug.player.fallRespawnGraceTimer = 0;
debug.player.vx = 0;
debug.player.vy = 0;
dispatch("keydown", keyEvent("d", "KeyD"));
debug.checkRoomEdgeTransitions();
dispatch("keyup", keyEvent("d", "KeyD"));
if (debug.getCurrentRoomId() !== "room-1") {
  throw new Error(`Pending right-edge transition should not leave Room 1; got ${debug.getCurrentRoomId()}.`);
}
if (!debug.systemDialogue.logs.some((entry) => entry.text === "Room transition pending.")) {
  throw new Error("Right screen-edge transition did not log the pending transition message.");
}
