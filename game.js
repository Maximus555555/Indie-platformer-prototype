const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// Easy-to-tune prototype constants. Distances are pixels, time is seconds.
const GRAVITY = 1200;
const JUMP_VELOCITY = -460;
const MAX_FALL_SPEED = 900;
const WALK_SPEED = 230;
const RUN_SPEED = 340;
const CROUCH_HEIGHT = 46;
const STAND_HEIGHT = 74;
const PULSE_SPEED = 620;
const PULSE_COOLDOWN = 0.35;
const PULSE_DAMAGE = 1;
const GRAVITY_FIELD_RADIUS = 260;
const GRAVITY_FLIP_DAMPING = 0.45;
const CONTACT_DAMAGE_COOLDOWN = 0.8;
const FALL_LIMIT = 640;
const ROOM_WIDTH = 1280;

const checkpoint = { x: 86, y: 396 };
const safeAnchor = { x: 92, y: 396 };

const keys = new Set();
const pressedThisFrame = new Set();
const pulses = [];
let lastTime = performance.now();
let gravityCastId = 0;
let gravityFieldActive = false;
let cameraX = 0;

const platforms = [
  { x: 0, y: 470, w: 300, h: 70 },
  { x: 410, y: 470, w: 360, h: 70 },
  { x: 860, y: 470, w: 420, h: 70 },
  { x: 220, y: 365, w: 150, h: 20 },
  { x: 535, y: 300, w: 190, h: 20 },
  { x: 805, y: 385, w: 155, h: 20 },
  { x: 1010, y: 260, w: 155, h: 20 }
];

const spikes = [
  { x: 470, y: 442, w: 70, h: 28, direction: -1 },
  { x: 980, y: 442, w: 80, h: 28, direction: -1 },
  { x: 1060, y: 232, w: 70, h: 28, direction: -1 }
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

function drawTriangleSpike(spike) {
  const count = Math.max(2, Math.floor(spike.w / 18));
  const tooth = spike.w / count;
  ctx.fillStyle = "#ff5578";
  ctx.shadowColor = "rgba(255, 85, 120, 0.45)";
  ctx.shadowBlur = 10;

  for (let i = 0; i < count; i += 1) {
    const x = spike.x + i * tooth;
    ctx.beginPath();
    if (spike.direction < 0) {
      ctx.moveTo(x, spike.y + spike.h);
      ctx.lineTo(x + tooth / 2, spike.y);
      ctx.lineTo(x + tooth, spike.y + spike.h);
    } else {
      ctx.moveTo(x, spike.y);
      ctx.lineTo(x + tooth / 2, spike.y + spike.h);
      ctx.lineTo(x + tooth, spike.y);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.shadowBlur = 0;
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
    if (this.gravitySign !== 1) {
      this.gravitySign = 1;
      this.vy = Math.abs(this.vy) * GRAVITY_FLIP_DAMPING;
    }
  }
}

class Player extends Entity {
  constructor() {
    super(checkpoint.x, checkpoint.y, 42, STAND_HEIGHT);
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

    this.setCrouch(crouch && this.onSurface);

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
    const oldHeight = this.h;
    this.isCrouching = shouldCrouch;
    this.h = shouldCrouch ? CROUCH_HEIGHT : STAND_HEIGHT;
    if (this.gravitySign > 0) this.y += oldHeight - this.h;
  }

  firePulse() {
    if (this.pulseTimer > 0) return;
    const pulseX = this.facing > 0 ? this.x + this.w + 3 : this.x - 15;
    pulses.push(new SystemPulse(pulseX, this.y + this.h * 0.45, this.facing));
    this.pulseTimer = PULSE_COOLDOWN;
    this.attackTimer = 0.18;
  }

  takeDamage(amount) {
    if (this.damageTimer > 0) return;
    this.hp -= amount;
    this.damageTimer = CONTACT_DAMAGE_COOLDOWN;
    if (this.hp <= 0) this.fullRespawn();
    else this.respawnAtSafeAnchor();
  }

  respawnAtSafeAnchor() {
    this.x = safeAnchor.x;
    this.y = safeAnchor.y;
    this.vx = 0;
    this.vy = 0;
    this.setCrouch(false);
    this.resetGravity();
  }

  fullRespawn() {
    this.hp = 3;
    this.x = checkpoint.x;
    this.y = checkpoint.y;
    this.vx = 0;
    this.vy = 0;
    this.setCrouch(false);
    this.resetGravity();
  }

  draw() {
    const glow = this.gravitySign < 0 ? "rgba(135, 255, 198, 0.68)" : "rgba(82, 166, 240, 0.5)";
    const outline = this.gravitySign < 0 ? "#7effc0" : "#4ea2f2";
    const fill = "rgba(255, 255, 255, 0.94)";
    const cx = this.x + this.w / 2;
    const footY = this.gravitySign > 0 ? this.y + this.h - 1 : this.y + 1;
    const facing = this.facing;
    const moving = Math.abs(this.vx) > 1 && this.onSurface;
    const runStride = this.isRunning ? 1 : 0.55;
    const phase = this.animTime * (this.isRunning ? 1.45 : 1);
    const stride = moving ? Math.sin(phase) * runStride : 0;
    const counter = moving ? Math.sin(phase + Math.PI) * runStride : 0;
    const airLift = this.onSurface ? 0 : clamp(this.vy / MAX_FALL_SPEED, -1, 1);
    const crouch = this.isCrouching ? 1 : 0;
    const landingSquash = this.landTimer > 0 ? this.landTimer / 0.16 : 0;

    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = outline;
    ctx.fillStyle = fill;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Side-view-only abstract humanoid inspired by the supplied running pose.
    const headR = crouch ? 10 : 13 - landingSquash * 1.5;
    const headX = cx - facing * 2;
    const headY = this.y + (crouch ? 12 : 14 + landingSquash * 2);
    const neck = { x: cx - facing * 1, y: this.y + (crouch ? 24 : 29) };
    const hip = { x: cx + facing * (crouch ? 2 : 4), y: this.y + (crouch ? 35 : 49 + landingSquash * 3) };
    const shoulder = { x: cx - facing * 3, y: neck.y + (crouch ? 2 : 4) };

    // Rounded head and tapered torso keep the character humanoid without details.
    ctx.beginPath();
    ctx.arc(headX, headY, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(neck.x - facing * 7, neck.y);
    ctx.quadraticCurveTo(cx - facing * 15, neck.y + 7, cx - facing * 14, hip.y - 8);
    ctx.quadraticCurveTo(cx - facing * 5, hip.y + 4, hip.x + facing * 9, hip.y + 1);
    ctx.quadraticCurveTo(cx + facing * 14, neck.y + 12, neck.x + facing * 7, neck.y + 1);
    ctx.quadraticCurveTo(cx + facing * 5, neck.y - 3, neck.x - facing * 7, neck.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const frontLeg = {
      knee: { x: hip.x + facing * (10 + stride * 4), y: hip.y + 13 - Math.max(stride, 0) * 11 - airLift * 4 },
      foot: { x: cx + facing * (14 + stride * 18), y: footY - Math.max(stride, 0) * 3 }
    };
    const backLeg = {
      knee: { x: hip.x - facing * (8 + counter * 3), y: hip.y + 16 - Math.max(counter, 0) * 8 + airLift * 2 },
      foot: { x: cx - facing * (21 + counter * 14), y: footY - Math.max(counter, 0) * 7 }
    };

    const frontArm = {
      elbow: { x: shoulder.x - facing * (10 + stride * 7), y: shoulder.y + 18 + Math.max(stride, 0) * 3 },
      hand: { x: cx - facing * (3 + stride * 15), y: shoulder.y + 30 - Math.max(stride, 0) * 6 }
    };
    const backArm = {
      elbow: { x: shoulder.x + facing * (18 + counter * 8), y: shoulder.y + 14 - Math.max(counter, 0) * 5 },
      hand: { x: cx + facing * (25 + counter * 15), y: shoulder.y + 20 - Math.max(counter, 0) * 8 }
    };

    if (crouch) {
      frontLeg.knee.x = hip.x + facing * 8;
      frontLeg.knee.y = footY - 14;
      frontLeg.foot.x = cx + facing * 24;
      backLeg.knee.x = hip.x - facing * 10;
      backLeg.knee.y = footY - 12;
      backLeg.foot.x = cx - facing * 18;
      frontArm.hand.y = shoulder.y + 21;
      backArm.hand.y = shoulder.y + 16;
    } else if (!this.onSurface) {
      frontLeg.foot.y -= airLift < 0 ? 6 : 0;
      backLeg.foot.y -= airLift > 0 ? 8 : 4;
      frontArm.hand.y -= airLift < 0 ? 10 : -2;
      backArm.hand.y -= airLift < 0 ? 2 : 8;
    }

    if (this.attackTimer > 0) {
      backArm.elbow.x = shoulder.x + facing * 20;
      backArm.hand.x = cx + facing * 32;
      backArm.hand.y = shoulder.y + 8;
    }

    function drawBentLimb(root, joint, end) {
      ctx.beginPath();
      ctx.moveTo(root.x, root.y);
      ctx.lineTo(joint.x, joint.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }

    // Draw far limbs first so the torso and near limbs read cleanly.
    ctx.globalAlpha = 0.72;
    drawBentLimb(hip, backLeg.knee, backLeg.foot);
    drawBentLimb(shoulder, backArm.elbow, backArm.hand);
    ctx.globalAlpha = 1;
    drawBentLimb(hip, frontLeg.knee, frontLeg.foot);
    drawBentLimb(shoulder, frontArm.elbow, frontArm.hand);

    ctx.strokeStyle = "rgba(160, 229, 255, 0.65)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(neck.x - facing * 5, neck.y + 2);
    ctx.quadraticCurveTo(cx - facing * 4, hip.y - 9, hip.x + facing * 4, hip.y - 2);
    ctx.stroke();

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

function toggleGravityField() {
  gravityFieldActive = !gravityFieldActive;
  gravityCastId += 1;

  if (!gravityFieldActive) {
    player.resetGravity();
    enemies.forEach((enemy) => enemy.resetGravity());
    return;
  }

  const origin = centerOf(player);
  const candidates = [player, ...enemies.filter((enemy) => enemy.hp > 0)];
  for (const entity of candidates) {
    if (distance(origin, centerOf(entity)) <= GRAVITY_FIELD_RADIUS) {
      entity.flipGravity(gravityCastId);
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

  for (const spike of spikes) {
    if (rectsOverlap(player, spike)) player.takeDamage(1);
    for (const enemy of enemies) {
      if (enemy.hp > 0 && rectsOverlap(enemy, spike)) enemy.hit(2);
    }
  }

  if (player.y > FALL_LIMIT || player.y + player.h < -120) player.takeDamage(1);

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

  ctx.fillStyle = "#c9ecff";
  ctx.strokeStyle = "rgba(78, 162, 242, 0.38)";
  for (const platform of platforms) {
    ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
    ctx.strokeRect(platform.x + 0.5, platform.y + 0.5, platform.w - 1, platform.h - 1);
  }

  spikes.forEach(drawTriangleSpike);

  ctx.fillStyle = "#87ffc6";
  ctx.fillRect(checkpoint.x - 12, checkpoint.y + STAND_HEIGHT - 70, 8, 70);
  ctx.fillRect(safeAnchor.x - 10, safeAnchor.y + STAND_HEIGHT + 8, 42, 5);
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

requestAnimationFrame(gameLoop);
