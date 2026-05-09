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
