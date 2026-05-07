const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// Easy-to-tune prototype constants. Distances are pixels, time is seconds.
const GRAVITY = 1200;
const JUMP_VELOCITY = -460;
const MAX_FALL_SPEED = 900;
const WALK_SPEED = 230;
const RUN_SPEED = 340;
const CROUCH_HEIGHT = 82;
const STAND_HEIGHT = 124;
const PULSE_SPEED = 620;
const PULSE_COOLDOWN = 0.35;
const PULSE_DAMAGE = 1;
const GRAVITY_FIELD_RADIUS = 260;
const GRAVITY_FLIP_DAMPING = 0.45;
const CONTACT_DAMAGE_COOLDOWN = 0.8;
const FALL_LIMIT = 640;
const ROOM_WIDTH = 1280;

const checkpoint = { x: 86, y: 346 };
const safeAnchor = { x: 92, y: 346 };

const keys = new Set();
const pressedThisFrame = new Set();
const pulses = [];
let lastTime = performance.now();
let gravityCastId = 0;
let gravityFieldActive = false;
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
    if (this.gravitySign !== 1) {
      this.gravitySign = 1;
      this.vy = Math.abs(this.vy) * GRAVITY_FLIP_DAMPING;
    }
  }
}

class Player extends Entity {
  constructor() {
    super(checkpoint.x, checkpoint.y, 54, STAND_HEIGHT);
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
    const outline = "#4ea2f2";
    const fill = "rgba(255, 255, 255, 0.96)";
    const inner = "rgba(226, 245, 255, 0.82)";
    const glow = "rgba(82, 166, 240, 0.34)";
    const facing = this.facing;
    const baseX = this.x + this.w / 2;
    const topY = this.gravitySign > 0 ? this.y + this.h - STAND_HEIGHT : this.y + STAND_HEIGHT;
    const verticalFlip = this.gravitySign > 0 ? 1 : -1;
    const speed = Math.abs(this.vx);
    const grounded = this.onSurface;
    const moving = speed > 2;
    const sprinting = this.isRunning && grounded;
    const walking = moving && grounded && !sprinting;
    const airborne = !grounded;
    const crouching = this.isCrouching;
    const cycle = Math.sin(this.animTime);
    const counterCycle = Math.sin(this.animTime + Math.PI);
    const bob = grounded ? Math.abs(cycle) * (sprinting ? 4 : walking ? 2 : 0.7) : 0;
    const lean = sprinting ? 8 : walking ? 2.5 * cycle : airborne ? (this.vy * this.gravitySign < 0 ? -4 : 5) : 0;
    const squash = crouching ? 0.76 : 1;

    ctx.save();
    ctx.translate(baseX, topY + bob);
    ctx.scale(facing, verticalFlip * squash);
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

    function drawBodyPath(points) {
      ctx.fillStyle = fill;
      ctx.strokeStyle = outline;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i += 1) {
        const p = points[i];
        if (p.cx !== undefined) ctx.quadraticCurveTo(p.cx, p.cy, p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    let pose;
    if (crouching) {
      pose = {
        shoulder: { x: -9, y: 43 }, hip: { x: 2, y: 77 }, head: { x: -2, y: 22 },
        torso: [{ x: -11, y: 39 }, { cx: -23, cy: 47, x: -29, y: 67 }, { cx: -23, cy: 80, x: -5, y: 82 }, { x: 16, y: 77 }, { cx: 14, cy: 51, x: 2, y: 41 }],
        farArm: [{ x: 0, y: 48 }, { x: 20, y: 62 }, { x: 35, y: 54 }],
        nearArm: [{ x: -10, y: 45 }, { x: -17, y: 65 }, { x: 13, y: 75 }],
        farLeg: [{ x: 2, y: 77 }, { x: -12, y: 94 }, { x: -39, y: 96 }],
        nearLeg: [{ x: 8, y: 78 }, { x: 24, y: 96 }, { x: 4, y: 105 }]
      };
    } else if (sprinting) {
      // The long-stride silhouette from the player drawing is reserved for Shift-running.
      const s = cycle >= 0 ? 1 : -1;
      pose = {
        shoulder: { x: -7 + lean * 0.2, y: 39 }, hip: { x: 6 + lean * 0.35, y: 73 }, head: { x: 1 + lean * 0.55, y: 15 },
        torso: [{ x: -8 + lean * 0.45, y: 33 }, { cx: -18 + lean * 0.2, cy: 40, x: -27 + lean * 0.1, y: 64 }, { cx: -25 + lean * 0.2, cy: 72, x: -14 + lean * 0.25, y: 75 }, { x: 14 + lean * 0.4, y: 85 }, { cx: 18 + lean * 0.55, cy: 63, x: 9 + lean * 0.5, y: 43 }, { cx: 5 + lean * 0.55, cy: 33, x: -8 + lean * 0.45, y: 33 }],
        farArm: [{ x: 3, y: 43 }, { x: 22 + 7 * s, y: 59 - 8 * s }, { x: 42 + 10 * s, y: 47 - 5 * s }],
        nearArm: [{ x: -7, y: 39 }, { x: -19 - 7 * s, y: 63 + 5 * s }, { x: 17 - 10 * s, y: 78 + 3 * s }],
        farLeg: s > 0 ? [{ x: 1, y: 70 }, { x: -13, y: 101 }, { x: -46, y: 110 }] : [{ x: 2, y: 72 }, { x: 20, y: 97 }, { x: 10, y: 124 }],
        nearLeg: s > 0 ? [{ x: 6, y: 73 }, { x: 23, y: 97 }, { x: 10, y: 124 }] : [{ x: 6, y: 73 }, { x: -18, y: 101 }, { x: -52, y: 112 }]
      };
    } else if (walking) {
      pose = {
        shoulder: { x: -8 + lean * 0.2, y: 40 }, hip: { x: 4, y: 75 }, head: { x: 0, y: 17 },
        torso: [{ x: -10, y: 35 }, { cx: -20, cy: 43, x: -26, y: 65 }, { cx: -22, cy: 75, x: -8, y: 81 }, { x: 13, y: 86 }, { cx: 17, cy: 63, x: 8, y: 44 }, { cx: 4, cy: 35, x: -10, y: 35 }],
        farArm: [{ x: 2, y: 45 }, { x: 14 + 13 * cycle, y: 61 }, { x: 23 + 14 * cycle, y: 75 }],
        nearArm: [{ x: -9, y: 42 }, { x: -17 - 13 * cycle, y: 61 }, { x: -9 - 18 * cycle, y: 80 }],
        farLeg: [{ x: 1, y: 75 }, { x: -6 + 16 * counterCycle, y: 97 }, { x: -8 + 24 * counterCycle, y: 123 }],
        nearLeg: [{ x: 7, y: 76 }, { x: 10 + 16 * cycle, y: 98 }, { x: 7 + 24 * cycle, y: 123 }]
      };
    } else if (airborne) {
      const rising = this.vy * this.gravitySign < 0;
      pose = {
        shoulder: { x: -8 + lean * 0.25, y: 39 }, hip: { x: 5 + lean * 0.25, y: 74 }, head: { x: 0 + lean * 0.45, y: 16 },
        torso: [{ x: -10 + lean * 0.35, y: 35 }, { cx: -21, cy: 43, x: -27, y: 65 }, { cx: -22, cy: 75, x: -8, y: 81 }, { x: 13 + lean * 0.2, y: 86 }, { cx: 17 + lean * 0.3, cy: 63, x: 8 + lean * 0.35, y: 44 }, { cx: 4 + lean * 0.35, cy: 35, x: -10 + lean * 0.35, y: 35 }],
        farArm: rising ? [{ x: 1, y: 43 }, { x: 17, y: 30 }, { x: 29, y: 42 }] : [{ x: 2, y: 43 }, { x: 21, y: 58 }, { x: 36, y: 54 }],
        nearArm: rising ? [{ x: -9, y: 41 }, { x: -25, y: 53 }, { x: -13, y: 68 }] : [{ x: -9, y: 41 }, { x: -20, y: 62 }, { x: 5, y: 76 }],
        farLeg: rising ? [{ x: 1, y: 75 }, { x: -18, y: 92 }, { x: -34, y: 112 }] : [{ x: 1, y: 75 }, { x: -8, y: 100 }, { x: -5, y: 124 }],
        nearLeg: rising ? [{ x: 7, y: 76 }, { x: 22, y: 96 }, { x: 21, y: 118 }] : [{ x: 7, y: 76 }, { x: 19, y: 99 }, { x: 33, y: 119 }]
      };
    } else {
      const breathe = Math.sin(this.animTime * 0.55) * 1.2;
      pose = {
        shoulder: { x: -8, y: 40 + breathe }, hip: { x: 4, y: 76 }, head: { x: 0, y: 17 + breathe },
        torso: [{ x: -10, y: 35 + breathe }, { cx: -20, cy: 43, x: -25, y: 65 }, { cx: -21, cy: 76, x: -8, y: 81 }, { x: 13, y: 86 }, { cx: 16, cy: 64, x: 8, y: 44 + breathe }, { cx: 4, cy: 35 + breathe, x: -10, y: 35 + breathe }],
        farArm: [{ x: 1, y: 44 }, { x: 13, y: 61 }, { x: 24, y: 72 }],
        nearArm: [{ x: -9, y: 42 }, { x: -17, y: 62 }, { x: -9, y: 82 }],
        farLeg: [{ x: 0, y: 76 }, { x: -5, y: 99 }, { x: -8, y: 124 }],
        nearLeg: [{ x: 8, y: 77 }, { x: 10, y: 100 }, { x: 8, y: 124 }]
      };
    }

    strokeLimb(pose.farLeg, 19, 11);
    strokeLimb(pose.farArm, 16, 9);
    drawBodyPath(pose.torso);
    strokeLimb(pose.nearLeg, 20, 12);
    strokeLimb(pose.nearArm, 18, 10);

    ctx.fillStyle = fill;
    ctx.strokeStyle = outline;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(pose.head.x, pose.head.y, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.ellipse(pose.hip.x + 3, 69, 8, 24, -0.2, 0, Math.PI * 2);
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

requestAnimationFrame(gameLoop);
