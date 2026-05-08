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
const context = new Proxy({
  canvas: null,
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

console.log("Smoke test passed: game boots, schedules frames, and keeps a valid player state.");
