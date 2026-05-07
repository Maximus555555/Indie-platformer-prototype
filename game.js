(() => {
const canvas = document.getElementById("game");
const ctx = canvas?.getContext("2d");

if (!canvas || !ctx) {
  console.error("Indie platformer could not start: missing canvas element or 2D context.");
  return;
}

if (window.__indiePlatformerStarted) {
  console.warn("Indie platformer script was loaded more than once; ignoring duplicate boot.");
  return;
}
window.__indiePlatformerStarted = true;

// Easy-to-tune prototype constants. Distances are pixels, time is seconds.
// Prefer editing game-config.js for tuning so future merges touch a small file.
const config = window.IndiePlatformerConfig ?? {};
const GRAVITY = config.gravity ?? 1200;
const JUMP_VELOCITY = config.jumpVelocity ?? -460;
const MAX_FALL_SPEED = config.maxFallSpeed ?? 900;
const WALK_SPEED = config.walkSpeed ?? 230;
const RUN_SPEED = config.runSpeed ?? 340;
const PLAYER_WIDTH = config.playerWidth ?? 46;
const CROUCH_HEIGHT = config.crouchHeight ?? 70;
const STAND_HEIGHT = config.standHeight ?? 108;
const PLAYER_VISUAL_SCALE = config.playerVisualScale ?? 0.72;
const PULSE_SPEED = config.pulseSpeed ?? 620;
const PULSE_COOLDOWN = config.pulseCooldown ?? 0.35;
const PULSE_DAMAGE = config.pulseDamage ?? 1;
const GRAVITY_FIELD_RADIUS = config.gravityFieldRadius ?? 260;
const GRAVITY_FLIP_DAMPING = config.gravityFlipDamping ?? 0.45;
const CONTACT_DAMAGE_COOLDOWN = config.contactDamageCooldown ?? 0.8;
const FALL_LIMIT = config.fallLimit ?? 640;
const ROOM_WIDTH = config.roomWidth ?? 1280;

const checkpoint = config.checkpoint ?? { x: 86, y: 362 };
const safeAnchor = config.safeAnchor ?? { x: 92, y: 362 };

const keys = new Set();
const pressedThisFrame = new Set();
const pulses = [];
let lastTime = performance.now();
let gravityCastId = 0;
let gravityFieldActive = false;
let activeGravityEntities = new Set();
let cameraX = 0;

const platforms = [
  { x: 0, y: 0, w: ROOM_WIDTH, h: 28 },
  { x: 0, y: 470, w: 300, h: 70 },
  { x: 410, y: 470, w: 360, h: 70 },
  { x: 860, y: 470, w: 420, h: 70 },
  { x: 220, y: 365, w: 150, h: 20 },
  { x: 535, y: 300, w: 190, h: 20 },
  { x: 805, y: 385, w: 155, h: 20 },
  { x: 1010, y: 260, w: 155, h: 20 }
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function centerOf(entity) {
  return { x: entity.x + entity.w / 2, y: entity.y + entity.h / 2 };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

class Entity {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.vx = 0;
    this.vy = 0;
    this.gravitySign = 1;
    this.onSurface = false;
    this.lastGravityCastId = 0; // Later enemy adaptation can key off one response per cast ID.
  }

  applyGravity(dt) {
    this.vy += GRAVITY * this.gravitySign * dt;
    this.vy = clamp(this.vy, -MAX_FALL_SPEED, MAX_FALL_SPEED);
  }

  moveAndCollide(dt) {
    this.x += this.vx * dt;
    for (const platform of platforms) {
      if (!rectsOverlap(this, platform)) continue;
      if (this.vx > 0) this.x = platform.x - this.w;
      if (this.vx < 0) this.x = platform.x + platform.w;
      this.vx = 0;
    }

    this.y += this.vy * dt;
    this.onSurface = false;
    for (const platform of platforms) {
      if (!rectsOverlap(this, platform)) continue;

      if (this.vy * this.gravitySign > 0) {
        if (this.gravitySign > 0) this.y = platform.y - this.h;
        else this.y = platform.y + platform.h;
        this.onSurface = true;
      } else if (this.vy < 0) {
        this.y = platform.y + platform.h;
      } else if (this.vy > 0) {
        this.y = platform.y - this.h;
      }
      this.vy = 0;
    }
  }

  flipGravity(castId) {
    if (this.lastGravityCastId === castId) return;
    this.lastGravityCastId = castId;
    this.gravitySign *= -1;
    this.vy = -this.vy * GRAVITY_FLIP_DAMPING;
  }

  resetGravity() {
    this.lastGravityCastId = 0;
    this.onSurface = false;
    if (this.gravitySign !== 1) {
      this.gravitySign = 1;
      this.vy = Math.abs(this.vy) * GRAVITY_FLIP_DAMPING;
    }
  }
}

class Player extends Entity {
  constructor() {
    super(checkpoint.x, checkpoint.y, PLAYER_WIDTH, STAND_HEIGHT);
    this.hp = 3;
    this.facing = 1;
    this.pulseTimer = 0;
    this.damageTimer = 0;
    this.isCrouching = false;
    this.isRunning = false;
    this.animTime = 0;
    this.landTimer = 0;
    this.attackTimer = 0;
  }

  update(dt) {
    const left = keys.has("a") || keys.has("arrowleft");
    const right = keys.has("d") || keys.has("arrowright");
    const crouch = keys.has("s") || keys.has("arrowdown");
    const runHeld = keys.has("shift");
    const input = Number(right) - Number(left);

    this.setCrouch(crouch && (this.onSurface || this.isCrouching));

    this.isRunning = runHeld && input !== 0 && !this.isCrouching;
    this.vx = input * (this.isRunning ? RUN_SPEED : WALK_SPEED);
    if (input !== 0) this.facing = input;
    this.animTime += dt * (Math.abs(this.vx) * 0.055 + (this.onSurface ? 1 : 0));

    if ((pressedThisFrame.has("w") || pressedThisFrame.has("arrowup")) && this.onSurface) {
      this.vy = JUMP_VELOCITY * this.gravitySign;
      this.onSurface = false;
    }

    if (this.pulseTimer > 0) this.pulseTimer -= dt;
    if (this.damageTimer > 0) this.damageTimer -= dt;

    const wasOnSurface = this.onSurface;
    this.applyGravity(dt);
    this.moveAndCollide(dt);
    if (!wasOnSurface && this.onSurface) this.landTimer = 0.16;
    if (this.landTimer > 0) this.landTimer -= dt;
    if (this.attackTimer > 0) this.attackTimer -= dt;
    this.x = clamp(this.x, 0, ROOM_WIDTH - this.w);
  }

  setCrouch(shouldCrouch) {
    if (shouldCrouch === this.isCrouching) return;
    const surfaceAnchor = this.gravitySign > 0 ? this.y + this.h : this.y;
    const nextHeight = shouldCrouch ? CROUCH_HEIGHT : STAND_HEIGHT;
    const nextY = this.gravitySign > 0 ? surfaceAnchor - nextHeight : surfaceAnchor;
    const nextRect = { x: this.x, y: nextY, w: this.w, h: nextHeight };

    // Never expand from crouch into a platform. This is especially important on
    // the frame after a gravity flip, when the player may still be beside the
    // previous surface while the held crouch input is changing state.
    if (!shouldCrouch && platforms.some((platform) => rectsOverlap(nextRect, platform))) return;

    this.isCrouching = shouldCrouch;
    this.h = nextHeight;

    // Resize from the body/top while keeping the feet glued to the touched surface.
    // This prevents both visual hovering and collision drift when crouching on
    // either floor or ceiling gravity.
    this.y = nextY;
  }

  flipGravity(castId) {
    if (this.lastGravityCastId === castId) return;
    const contacts = platforms.filter((platform) => this.isTouchingVerticalSurface(platform));
    super.flipGravity(castId);
    this.onSurface = false;

    // Gravity flips should release the player from the current contact side, not
    // let the collision solver see a crouched overlap and eject sideways or
    // through the platform on the next frame.
    for (const platform of contacts) {
      if (Math.abs(this.y + this.h - platform.y) <= 1.5) this.y = platform.y - this.h - 0.1;
      else if (Math.abs(this.y - (platform.y + platform.h)) <= 1.5) this.y = platform.y + platform.h + 0.1;
    }
  }

  isTouchingVerticalSurface(platform) {
    const overlapsX = this.x + this.w > platform.x && this.x < platform.x + platform.w;
    if (!overlapsX) return false;
    return Math.abs(this.y + this.h - platform.y) <= 1.5 || Math.abs(this.y - (platform.y + platform.h)) <= 1.5;
  }

  firePulse() {
    if (this.pulseTimer > 0) return;
    const pulseX = this.facing > 0 ? this.x + this.w + 3 : this.x - 15;
    pulses.push(new SystemPulse(pulseX, this.y + this.h * 0.45, this.facing));
    this.pulseTimer = PULSE_COOLDOWN;
    this.attackTimer = 0.18;
  }

  takeDamage(amount) {
    if (this.damageTimer > 0) return false;
    this.hp -= amount;

    if (this.hp <= 0) {
      this.fullRespawn();
      return true;
    }

    this.damageTimer = CONTACT_DAMAGE_COOLDOWN;
    return true;
  }

  fallOutOfWorld() {
    // Death-zone recovery must always move the player back into the room, even
    // if contact-damage invulnerability is active while they are falling.
    if (this.damageTimer <= 0) this.hp -= 1;

    if (this.hp <= 0) {
      this.fullRespawn();
      return;
    }

    this.damageTimer = CONTACT_DAMAGE_COOLDOWN;
    this.respawnAtSafeAnchor();
  }

  respawnAtSafeAnchor() {
    resetGravityField(true);
    this.placeAt(safeAnchor.x, safeAnchor.y);
  }

  fullRespawn() {
    resetGravityField(true);
    this.hp = 3;
    this.damageTimer = 0;
    this.placeAt(checkpoint.x, checkpoint.y);
  }

  placeAt(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.gravitySign = 1;
    this.lastGravityCastId = 0;
    this.isCrouching = false;
    this.h = STAND_HEIGHT;
    this.onSurface = false;
  }

  draw() {
    const outline = "#4ea2f2";
    const fill = "rgba(255, 255, 255, 0.96)";
    const inner = "rgba(226, 245, 255, 0.82)";
    const glow = "rgba(82, 166, 240, 0.34)";
    const facing = this.facing;
    const speed = Math.abs(this.vx);
    const grounded = this.onSurface;
    const moving = speed > 2;
    const sprinting = this.isRunning && grounded;
    const walking = moving && grounded && !sprinting;
    const airborne = !grounded;
    const crouching = this.isCrouching;
    const visualScale = PLAYER_VISUAL_SCALE;
    const modelFeetY = STAND_HEIGHT;
    const baseX = this.x + this.w / 2;
    const surfaceY = this.gravitySign > 0 ? this.y + this.h : this.y;
    const verticalFlip = this.gravitySign > 0 ? 1 : -1;
    const stride = sprinting ? 1.35 : walking ? 0.85 : 0.45;
    const phase = this.animTime * stride;
    const step = Math.sin(phase);
    const counterStep = -step;
    const lift = Math.max(0, Math.cos(phase));
    const counterLift = Math.max(0, -Math.cos(phase));
    const bob = grounded && moving ? (sprinting ? 3.8 : 1.7) * Math.abs(Math.cos(phase)) : 0;
    const landSquash = this.landTimer > 0 ? this.landTimer / 0.16 : 0;
    const poseSquash = crouching ? 0 : landSquash * 0.045;
    const scaleY = visualScale * (1 - poseSquash);
    const originY = this.gravitySign > 0
      ? surfaceY - bob - modelFeetY * scaleY
      : surfaceY + bob + modelFeetY * scaleY;

    ctx.save();
    if (this.damageTimer > 0 && Math.floor(this.damageTimer * 18) % 2 === 0) ctx.globalAlpha = 0.62;
    ctx.translate(baseX, originY);
    ctx.scale(facing * visualScale, verticalFlip * scaleY);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = glow;
    ctx.shadowBlur = 12;

    function strokeLimb(points, outlineWidth, fillWidth) {
      ctx.strokeStyle = outline;
      ctx.lineWidth = outlineWidth;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
      ctx.stroke();

      ctx.strokeStyle = fill;
      ctx.lineWidth = fillWidth;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
      ctx.stroke();
    }

    function drawTorso(cx, cy, rx, ry, rotation) {
      ctx.fillStyle = fill;
      ctx.strokeStyle = outline;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, rotation, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    function walkingLeg(sideStep, footLift) {
      return [
        { x: sideStep * 4, y: 79 },
        { x: sideStep * 13, y: 101 - footLift * 3 },
        { x: sideStep * 22, y: modelFeetY - footLift * 5 }
      ];
    }

    function runningLeg(sideStep, footLift) {
      const direction = Math.sign(sideStep || 1);
      return [
        { x: sideStep * 4, y: 78 },
        { x: sideStep * 13 + direction * 2, y: 96 - footLift * 7 },
        { x: sideStep * 27, y: modelFeetY - footLift * 9 }
      ];
    }

    function arm(swing, energetic) {
      const reach = energetic ? 17 : 10;
      const bend = energetic ? 7 : 4;
      return [
        { x: -swing * 3, y: 45 },
        { x: -swing * reach * 0.55, y: 63 - Math.abs(swing) * bend },
        { x: -swing * reach, y: 78 - Math.abs(swing) * bend * 0.3 }
      ];
    }

    let pose;
    if (crouching) {
      pose = {
        head: { x: -1, y: 40, r: 12 },
        torso: { x: 2, y: 66, rx: 19, ry: 18, rot: -0.08 },
        farArm: [{ x: 8, y: 58 }, { x: 16, y: 76 }, { x: 2, y: 89 }],
        nearArm: [{ x: -8, y: 58 }, { x: -16, y: 76 }, { x: -2, y: 90 }],
        farLeg: [{ x: -2, y: 80 }, { x: -18, y: 98 }, { x: -24, y: modelFeetY }],
        nearLeg: [{ x: 8, y: 81 }, { x: 20, y: 99 }, { x: 6, y: modelFeetY }]
      };
    } else if (sprinting) {
      const lean = 3;
      pose = {
        head: { x: lean * 0.5, y: 18, r: 14 },
        torso: { x: lean * 0.25, y: 61, rx: 16, ry: 29, rot: -0.06 },
        farArm: arm(counterStep, true),
        nearArm: arm(step, true),
        farLeg: runningLeg(counterStep, counterLift),
        nearLeg: runningLeg(step, lift)
      };
    } else if (walking) {
      pose = {
        head: { x: 0, y: 18, r: 14 },
        torso: { x: 0, y: 61, rx: 16, ry: 30, rot: 0 },
        farArm: arm(counterStep * 0.65, false),
        nearArm: arm(step * 0.65, false),
        farLeg: walkingLeg(counterStep, counterLift),
        nearLeg: walkingLeg(step, lift)
      };
    } else if (airborne) {
      const rising = this.vy * this.gravitySign < 0;
      const tuck = rising ? -1 : 1;
      pose = {
        head: { x: tuck * 2, y: 18, r: 14 },
        torso: { x: tuck * 1.5, y: 61, rx: 16, ry: 30, rot: tuck * 0.06 },
        farArm: rising ? [{ x: 8, y: 44 }, { x: 22, y: 31 }, { x: 32, y: 45 }] : [{ x: 8, y: 44 }, { x: 22, y: 62 }, { x: 36, y: 58 }],
        nearArm: rising ? [{ x: -8, y: 44 }, { x: -23, y: 55 }, { x: -11, y: 70 }] : [{ x: -8, y: 44 }, { x: -21, y: 64 }, { x: 2, y: 78 }],
        farLeg: rising ? [{ x: -2, y: 80 }, { x: -20, y: 100 }, { x: -30, y: 118 }] : [{ x: -2, y: 80 }, { x: -7, y: 103 }, { x: -4, y: modelFeetY }],
        nearLeg: rising ? [{ x: 7, y: 80 }, { x: 20, y: 100 }, { x: 18, y: 119 }] : [{ x: 7, y: 80 }, { x: 20, y: 102 }, { x: 31, y: 120 }]
      };
    } else {
      const breathe = Math.sin(this.animTime * 0.9) * 0.9;
      pose = {
        head: { x: 0, y: 18 + breathe, r: 14 },
        torso: { x: 0, y: 61 + breathe, rx: 16, ry: 30, rot: 0 },
        farArm: [{ x: 8, y: 44 + breathe }, { x: 14, y: 64 }, { x: 10, y: 82 }],
        nearArm: [{ x: -8, y: 44 + breathe }, { x: -14, y: 64 }, { x: -10, y: 82 }],
        farLeg: [{ x: -4, y: 80 }, { x: -6, y: 103 }, { x: -6, y: modelFeetY }],
        nearLeg: [{ x: 6, y: 80 }, { x: 7, y: 103 }, { x: 7, y: modelFeetY }]
      };
    }

    strokeLimb(pose.farLeg, 15, 8);
    strokeLimb(pose.farArm, 12, 7);
    drawTorso(pose.torso.x, pose.torso.y, pose.torso.rx, pose.torso.ry, pose.torso.rot);
    strokeLimb(pose.nearLeg, 16, 9);
    strokeLimb(pose.nearArm, 13, 8);

    ctx.fillStyle = fill;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(pose.head.x, pose.head.y, pose.head.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.ellipse(pose.torso.x + 3, pose.torso.y + 5, pose.torso.rx * 0.48, pose.torso.ry * 0.72, pose.torso.rot, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    drawGravityMarker(this);
  }
}

class Enemy extends Entity {
  constructor(x, y) {
    super(x, y, 38, 34);
    this.hp = 2;
    this.speed = 86;
    this.direction = -1;
    this.patrolMin = x - 120;
    this.patrolMax = x + 120;
  }

  update(dt) {
    if (this.hp <= 0) return;
    this.vx = this.speed * this.direction;
    this.applyGravity(dt);
    this.moveAndCollide(dt);
    if (this.x < this.patrolMin || this.x + this.w > this.patrolMax || this.vx === 0) {
      this.direction *= -1;
    }
  }

  hit(amount) {
    this.hp -= amount;
  }

  draw() {
    if (this.hp <= 0) return;
    ctx.save();
    ctx.fillStyle = this.gravitySign < 0 ? "#ffb86b" : "#ff6f91";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
    ctx.lineWidth = 2;
    ctx.shadowColor = "rgba(255, 111, 145, 0.35)";
    ctx.shadowBlur = 12;
    ctx.fillRect(this.x, this.y, this.w, this.h);
    ctx.strokeRect(this.x + 1, this.y + 1, this.w - 2, this.h - 2);
    ctx.fillStyle = "#07101c";
    ctx.fillRect(this.x + 8, this.y + 11, 7, 7);
    ctx.fillRect(this.x + 23, this.y + 11, 7, 7);
    ctx.restore();
    drawGravityMarker(this);
  }
}

class SystemPulse {
  constructor(x, y, direction) {
    this.x = x;
    this.y = y;
    this.w = 16;
    this.h = 8;
    this.vx = PULSE_SPEED * direction;
    this.active = true;
  }

  update(dt) {
    this.x += this.vx * dt;
    if (this.x < 0 || this.x > ROOM_WIDTH) this.active = false;

    for (const platform of platforms) {
      if (rectsOverlap(this, platform)) this.active = false;
    }

    for (const enemy of enemies) {
      if (enemy.hp > 0 && rectsOverlap(this, enemy)) {
        enemy.hit(PULSE_DAMAGE);
        this.active = false;
      }
    }
  }

  draw() {
    ctx.save();
    ctx.fillStyle = "#aef4ff";
    ctx.shadowColor = "rgba(100, 216, 255, 0.85)";
    ctx.shadowBlur = 14;
    ctx.fillRect(this.x, this.y, this.w, this.h);
    ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
    ctx.fillRect(this.x + 3, this.y + 2, this.w - 6, 2);
    ctx.restore();
  }
}

const player = new Player();
const enemies = [new Enemy(660, 435)];

function drawGravityMarker(entity) {
  if (entity.gravitySign === 1) return;
  const cx = entity.x + entity.w / 2;
  const y = entity.y - 14;
  ctx.save();
  ctx.fillStyle = "#87ffc6";
  ctx.beginPath();
  ctx.moveTo(cx, y);
  ctx.lineTo(cx - 6, y + 9);
  ctx.lineTo(cx + 6, y + 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function resetGravityField(resetAll = false) {
  const entitiesToReset = resetAll ? [player, ...enemies] : activeGravityEntities;
  for (const entity of entitiesToReset) entity.resetGravity();
  activeGravityEntities.clear();
  gravityFieldActive = false;
}

function toggleGravityField() {
  if (gravityFieldActive) {
    resetGravityField();
    return;
  }

  gravityCastId += 1;
  gravityFieldActive = true;
  activeGravityEntities.clear();

  const origin = centerOf(player);
  const candidates = [player, ...enemies.filter((enemy) => enemy.hp > 0)];
  for (const entity of candidates) {
    if (distance(origin, centerOf(entity)) <= GRAVITY_FIELD_RADIUS) {
      entity.flipGravity(gravityCastId);
      activeGravityEntities.add(entity);
    }
  }
}

function update(dt) {
  if (pressedThisFrame.has(" ")) player.firePulse();
  if (pressedThisFrame.has("e")) toggleGravityField();

  player.update(dt);
  enemies.forEach((enemy) => enemy.update(dt));
  pulses.forEach((pulse) => pulse.update(dt));

  for (let i = pulses.length - 1; i >= 0; i -= 1) {
    if (!pulses[i].active) pulses.splice(i, 1);
  }

  for (const enemy of enemies) {
    if (enemy.hp > 0 && rectsOverlap(player, enemy)) player.takeDamage(1);
  }

  if (player.y > FALL_LIMIT || player.y + player.h < -120) player.fallOutOfWorld();

  cameraX = clamp(player.x + player.w / 2 - canvas.width / 2, 0, ROOM_WIDTH - canvas.width);
  pressedThisFrame.clear();
}

function drawGrid() {
  ctx.strokeStyle = "rgba(80, 140, 200, 0.12)";
  ctx.lineWidth = 1;
  for (let x = -cameraX % 40; x < canvas.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function drawRoom() {
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#dff5ff");
  sky.addColorStop(1, "#bfe7ff");
  ctx.fillStyle = sky;
  ctx.fillRect(cameraX, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#9fd0f4";
  ctx.strokeStyle = "rgba(45, 126, 204, 0.48)";
  for (const platform of platforms) {
    ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
    ctx.strokeRect(platform.x + 0.5, platform.y + 0.5, platform.w - 1, platform.h - 1);
  }
}

function drawHud() {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#24577d";
  ctx.font = "16px system-ui, sans-serif";
  ctx.fillText(`HP: ${player.hp}/3`, 20, 30);
  ctx.fillText("A/D move  Shift run  W jump  S crouch  Space/click System Pulse", 20, 55);
  ctx.fillText("Hold Q preview range  E toggle Gravity Field", 20, 80);
  ctx.fillStyle = gravityFieldActive ? "#138a57" : "rgba(36, 87, 125, 0.72)";
  ctx.fillText(`Gravity Field: ${gravityFieldActive ? "ACTIVE" : "ready"}  Cast ID ${gravityCastId}`, 20, 105);
  ctx.restore();
}

function drawGravityPreview() {
  if (!keys.has("q")) return;
  const origin = centerOf(player);
  ctx.save();
  ctx.strokeStyle = "rgba(135, 255, 198, 0.85)";
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 2;
  ctx.shadowColor = "rgba(135, 255, 198, 0.45)";
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.arc(origin.x, origin.y, GRAVITY_FIELD_RADIUS, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(-cameraX, 0);
  drawRoom();
  drawGravityPreview();
  pulses.forEach((pulse) => pulse.draw());
  enemies.forEach((enemy) => enemy.draw());
  player.draw();
  ctx.restore();
  drawHud();
}

function gameLoop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.033);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(gameLoop);
}

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) event.preventDefault();
  if (!keys.has(key)) pressedThisFrame.add(key);
  keys.add(key);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

canvas.addEventListener("pointerdown", () => {
  player.firePulse();
});

window.__indiePlatformerDebug = {
  player,
  enemies,
  platforms,
  update,
  draw,
  toggleGravityField,
  resetGravityField,
  checkpoint,
  safeAnchor,
  constants: { PLAYER_WIDTH, STAND_HEIGHT, CROUCH_HEIGHT }
};

requestAnimationFrame(gameLoop);
})();
