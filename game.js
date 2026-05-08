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
const CROUCH_SPEED = config.crouchSpeed ?? WALK_SPEED * 0.52;
const PLAYER_WIDTH = config.playerWidth ?? 24;
const CROUCH_HEIGHT = config.crouchHeight ?? 34;
const STAND_HEIGHT = config.standHeight ?? 50;
const PLAYER_VISUAL_SCALE = config.playerVisualScale ?? 1.17;
const PULSE_COOLDOWN = config.pulseCooldown ?? 0.35;
const PULSE_DAMAGE = config.pulseDamage ?? 1;
const PULSE_THICKNESS = config.pulseThickness ?? 5;
const PULSE_LIFETIME = config.pulseLifetime ?? 0.13;
const LANDING_ANIM_DURATION = 0.12;
const LANDING_MIN_AIR_TIME = 0.07;
const LANDING_MIN_IMPACT_SPEED = 120;
const ATTACK_ANIM_DURATION = 0.19;
const ATTACK_RELEASE_TIME = 0.075;
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
    this.walkTime = 0;
    this.crouchWalkTime = 0;
    this.crouchBlend = 0;
    this.fallPoseBlend = 0;
    this.landTimer = 0;
    this.airTime = 0;
    this.attackTimer = 0;
    this.attackReleaseTimer = 0;
    this.attackPulseQueued = false;
    this.attackFacing = 1;
  }

  update(dt) {
    const left = keys.has("a") || keys.has("arrowleft");
    const right = keys.has("d") || keys.has("arrowright");
    const crouchHeld = keys.has("s") || keys.has("arrowdown");
    const runHeld = keys.has("shift");
    const input = Number(right) - Number(left);
    const wantsGroundCrouch = crouchHeld && this.onSurface;

    this.setCrouch(wantsGroundCrouch);
    this.updateCrouchShape(dt);

    // Held crouch has priority over sprinting and uses a slower, careful speed.
    this.isRunning = runHeld && input !== 0 && !this.isCrouching && !wantsGroundCrouch;
    this.vx = input * (this.isCrouching ? CROUCH_SPEED : (this.isRunning ? RUN_SPEED : WALK_SPEED));
    if (input !== 0) this.facing = input;
    this.animTime += dt;
    if (input !== 0 && !runHeld && this.onSurface && !this.isCrouching) this.walkTime += dt;
    else this.walkTime = 0;
    if (input !== 0 && this.onSurface && this.isCrouching) this.crouchWalkTime += dt;
    else this.crouchWalkTime = 0;

    if ((pressedThisFrame.has("w") || pressedThisFrame.has("arrowup")) && this.onSurface) {
      this.vy = JUMP_VELOCITY * this.gravitySign;
      this.onSurface = false;
    }

    if (this.pulseTimer > 0) this.pulseTimer -= dt;
    if (this.damageTimer > 0) this.damageTimer -= dt;

    const wasOnSurface = this.onSurface;
    if (!wasOnSurface) this.airTime += dt;
    this.applyGravity(dt);
    const impactVy = this.vy;
    this.moveAndCollide(dt);
    const fallingDownward = !this.onSurface && this.vy * this.gravitySign > 0;
    this.fallPoseBlend = fallingDownward
      ? clamp(this.fallPoseBlend + dt / 0.11, 0, 1)
      : 0;
    if (!wasOnSurface && this.onSurface) {
      const landedWithImpact = impactVy * this.gravitySign > LANDING_MIN_IMPACT_SPEED;
      if (this.airTime >= LANDING_MIN_AIR_TIME && landedWithImpact) this.landTimer = LANDING_ANIM_DURATION;
      this.airTime = 0;
    } else if (this.onSurface) {
      this.airTime = 0;
    }
    if (!this.onSurface) this.landTimer = 0;
    else if (this.landTimer > 0) this.landTimer -= dt;
    if (this.attackPulseQueued) {
      this.attackReleaseTimer -= dt;
      if (this.attackReleaseTimer <= 0) this.releasePulse();
    }
    if (this.attackTimer > 0) this.attackTimer -= dt;
    this.x = clamp(this.x, 0, ROOM_WIDTH - this.w);
  }

  setCrouch(shouldCrouch) {
    if (shouldCrouch) {
      this.isCrouching = true;
      return;
    }

    const surfaceAnchor = this.gravitySign > 0 ? this.y + this.h : this.y;
    const standY = this.gravitySign > 0 ? surfaceAnchor - STAND_HEIGHT : surfaceAnchor;
    const standRect = { x: this.x, y: standY, w: this.w, h: STAND_HEIGHT };

    // Never expand from crouch into a platform. This is especially important on
    // the frame after a gravity flip, when the player may still be beside the
    // previous surface while the held crouch input is changing state.
    if (platforms.some((platform) => rectsOverlap(standRect, platform))) return;

    this.isCrouching = false;
  }

  updateCrouchShape(dt) {
    const surfaceAnchor = this.gravitySign > 0 ? this.y + this.h : this.y;
    const targetHeight = this.isCrouching ? CROUCH_HEIGHT : STAND_HEIGHT;
    const heightDelta = targetHeight - this.h;
    const heightStep = (STAND_HEIGHT - CROUCH_HEIGHT) * dt / 0.14;

    if (Math.abs(heightDelta) <= heightStep) this.h = targetHeight;
    else this.h += Math.sign(heightDelta) * heightStep;

    // Resize from the body/top while keeping the feet glued to the touched surface.
    // This prevents both visual hovering and collision drift when crouching on
    // either floor or ceiling gravity.
    this.y = this.gravitySign > 0 ? surfaceAnchor - this.h : surfaceAnchor;
    this.crouchBlend = clamp((STAND_HEIGHT - this.h) / (STAND_HEIGHT - CROUCH_HEIGHT), 0, 1);
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
    this.pulseTimer = PULSE_COOLDOWN;
    this.attackTimer = ATTACK_ANIM_DURATION;
    this.attackReleaseTimer = ATTACK_RELEASE_TIME;
    this.attackPulseQueued = true;
    this.attackFacing = this.facing;
  }

  releasePulse() {
    if (!this.attackPulseQueued) return;
    const origin = this.getPulseSpawnPoint();
    pulses.push(SystemPulse.fire(origin.x, origin.y, this.attackFacing));
    this.attackPulseQueued = false;
  }

  getPulseSpawnPoint() {
    const modelFeetY = 50;
    const surfaceY = this.gravitySign > 0 ? this.y + this.h : this.y;
    const verticalFlip = this.gravitySign > 0 ? 1 : -1;
    const originY = this.gravitySign > 0
      ? surfaceY - modelFeetY * PLAYER_VISUAL_SCALE
      : surfaceY + modelFeetY * PLAYER_VISUAL_SCALE;
    const handLocalX = this.isCrouching ? 20.5 : 18.7;
    const handLocalY = this.isCrouching ? 32.8 : 22.8;
    const handX = this.x + this.w / 2 + this.attackFacing * PLAYER_VISUAL_SCALE * handLocalX;
    const handY = originY + verticalFlip * PLAYER_VISUAL_SCALE * handLocalY;
    return {
      // Start at the gathered hand position so the instant bolt is anchored to
      // the firing animation instead of the player's torso or a detached bullet.
      x: handX + this.attackFacing * 2,
      y: handY
    };
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
    this.fallPoseBlend = 0;
    this.landTimer = 0;
    this.airTime = 0;
    this.attackTimer = 0;
    this.attackPulseQueued = false;
    this.onSurface = false;
  }

  draw() {
    const outline = "#4ea2f2";
    const fill = "rgba(255, 255, 255, 0.96)";
    const inner = "rgba(226, 245, 255, 0.82)";
    const glow = "rgba(82, 166, 240, 0.34)";
    const facing = this.attackTimer > 0 ? this.attackFacing : this.facing;
    const speed = Math.abs(this.vx);
    const grounded = this.onSurface;
    const moving = speed > 2;
    const sprinting = moving && this.isRunning && grounded && !this.isCrouching;
    const walking = moving && grounded && !sprinting && !this.isCrouching;
    const airborne = !grounded;
    const upwardJumping = airborne && this.vy * this.gravitySign <= 0;
    const falling = airborne && this.vy * this.gravitySign > 0;
    const crouching = this.isCrouching && grounded;
    const visualScale = PLAYER_VISUAL_SCALE;
    const modelFeetY = 50;
    const characterOutlineWidth = 1.25;
    const torsoRadiusX = 5.4;
    // Pull shoulder anchors just off the front edge so arms attach near the upper-middle torso.
    const armAttachmentBackShift = 0.65;
    const baseX = this.x + this.w / 2;
    const surfaceY = this.gravitySign > 0 ? this.y + this.h : this.y;
    const verticalFlip = this.gravitySign > 0 ? 1 : -1;
    const crouchBlend = grounded ? this.crouchBlend : 0;
    const landProgress = this.landTimer > 0
      ? 1 - clamp(this.landTimer / LANDING_ANIM_DURATION, 0, 1)
      : 1;
    // Visual-only impact envelope: starts and ends at rest, peaks briefly in the
    // middle of the landing window, and keeps the collision body surface-anchored.
    const landCompression = grounded && this.landTimer > 0
      ? Math.sin(landProgress * Math.PI)
      : 0;
    const scaleY = visualScale;
    const originY = this.gravitySign > 0
      ? surfaceY - modelFeetY * scaleY
      : surfaceY + modelFeetY * scaleY;

    ctx.save();
    if (this.damageTimer > 0 && Math.floor(this.damageTimer * 18) % 2 === 0) ctx.globalAlpha = 0.62;
    ctx.translate(baseX, originY);
    ctx.scale(facing * visualScale, verticalFlip * scaleY);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = glow;
    ctx.shadowBlur = 10;

    function strokeLimb(points, fillWidth) {
      ctx.strokeStyle = outline;
      ctx.lineWidth = fillWidth + characterOutlineWidth * 2;
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
      const sideHalf = Math.max(ry - rx, ry * 0.42);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rotation);
      ctx.fillStyle = fill;
      ctx.strokeStyle = outline;
      ctx.lineWidth = characterOutlineWidth;
      ctx.beginPath();
      ctx.moveTo(-rx, -sideHalf);
      ctx.lineTo(-rx, sideHalf);
      ctx.quadraticCurveTo(-rx, ry, 0, ry);
      ctx.quadraticCurveTo(rx, ry, rx, sideHalf);
      ctx.lineTo(rx, -sideHalf);
      ctx.quadraticCurveTo(rx, -ry, 0, -ry);
      ctx.quadraticCurveTo(-rx, -ry, -rx, -sideHalf);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    function mix(a, b, amount) {
      return a + (b - a) * amount;
    }

    function interpolateKeyframes(frames, cycle) {
      const wrapped = ((cycle % 1) + 1) % 1;
      const scaled = wrapped * frames.length;
      const index = Math.floor(scaled) % frames.length;
      const nextIndex = (index + 1) % frames.length;
      const amount = scaled - Math.floor(scaled);
      const current = frames[index];
      const next = frames[nextIndex];
      return current.map((point, pointIndex) => ({
        x: mix(point.x, next[pointIndex].x, amount),
        y: mix(point.y, next[pointIndex].y, amount)
      }));
    }

    function blendPoint(from, to, amount) {
      return { x: mix(from.x, to.x, amount), y: mix(from.y, to.y, amount) };
    }

    function blendLimb(from, to, amount) {
      return from.map((point, index) => blendPoint(point, to[index], amount));
    }

    function interpolateTimeline(frames, progress) {
      const clampedProgress = clamp(progress, 0, 1);
      const lastIndex = frames.length - 1;
      const scaled = clampedProgress * lastIndex;
      const index = Math.min(Math.floor(scaled), lastIndex - 1);
      const amount = scaled - index;
      return blendLimb(frames[index], frames[index + 1], amount);
    }

    function interpolateTimedTimeline(frames, progress) {
      const clampedProgress = clamp(progress, 0, 1);
      for (let i = 0; i < frames.length - 1; i += 1) {
        const current = frames[i];
        const next = frames[i + 1];
        if (clampedProgress <= next.time) {
          const span = Math.max(next.time - current.time, 0.001);
          return blendLimb(current.limb, next.limb, (clampedProgress - current.time) / span);
        }
      }
      return frames[frames.length - 1].limb;
    }

    // Eight keyed contact/down/passing/up stages are interpolated into a calm
    // side-view walk. Feet remain anchored to modelFeetY at contact poses while
    // torso/head bob is applied separately so collision stays glued to ground.
    function walkingLeg(cycle, hipOffsetY) {
      const hipX = -1;
      const hipY = 28 + hipOffsetY;
      const facingKneeBend = 3.1;
      const frames = [
        { hipY: hipY, footX: 10, footY: modelFeetY, kneeY: 39, kneeBend: 2.7 },
        { hipY: 29 + hipOffsetY, footX: 6, footY: modelFeetY, kneeY: 41, kneeBend: 3.1 },
        { hipY: hipY, footX: 0, footY: modelFeetY - 2, kneeY: 39, kneeBend: 3.4 },
        { hipY: 27 + hipOffsetY, footX: -8, footY: modelFeetY - 1, kneeY: 38, kneeBend: 3.8 },
        { hipY: hipY, footX: -10, footY: modelFeetY, kneeY: 40, kneeBend: 4.3 },
        { hipY: 29 + hipOffsetY, footX: -6, footY: modelFeetY, kneeY: 41, kneeBend: 4.0 },
        { hipY: hipY, footX: 0, footY: modelFeetY - 3, kneeY: 38, kneeBend: 3.5 },
        { hipY: 27 + hipOffsetY, footX: 8, footY: modelFeetY - 1, kneeY: 38, kneeBend: 2.9 }
      ];

      return interpolateKeyframes(frames.map((frame) => {
        const hip = { x: hipX, y: frame.hipY };
        const foot = { x: frame.footX, y: frame.footY };
        // Local +X is the character's facing direction after the draw transform,
        // so this keeps both knees bending forward instead of following whichever
        // way the individual foot is swinging.
        const knee = {
          x: mix(hip.x, foot.x, 0.42) + facingKneeBend + frame.kneeBend * 0.18,
          y: frame.kneeY
        };
        return [hip, knee, foot];
      }), cycle);
    }

    function walkingArm(legCycle, shoulderOffsetY, depthOffset) {
      const swing = -Math.cos(legCycle * Math.PI * 2);
      const shoulder = { x: 2.8 - armAttachmentBackShift + depthOffset, y: 18 + shoulderOffsetY };
      return [
        shoulder,
        { x: 2.4 + depthOffset + swing * 4.4, y: 25 + shoulderOffsetY },
        { x: 2 + depthOffset + swing * 8.8, y: 33 + shoulderOffsetY }
      ];
    }

    function restingArm(side, breathe) {
      return [
        { x: 2.8 - armAttachmentBackShift + side * 1.2, y: 18 + breathe },
        { x: 2.4 + side * 3.6, y: 27 + breathe * 0.4 },
        { x: 2 + side * 2.6, y: 36 }
      ];
    }

    function restingLeg(side) {
      return [
        { x: side * 2, y: 29 },
        { x: side * 2.5, y: 40 },
        { x: side * 3, y: modelFeetY }
      ];
    }

    let pose;
    if (walking) {
      const cycle = (this.walkTime % 0.62) / 0.62;
      const bob = [0, 1.4, 0, -0.8, 0, 1.4, 0, -0.8];
      const scaled = cycle * bob.length;
      const bobIndex = Math.floor(scaled) % bob.length;
      const bodyY = mix(bob[bobIndex], bob[(bobIndex + 1) % bob.length], scaled - Math.floor(scaled));
      const torsoTilt = Math.sin(cycle * Math.PI * 4) * 0.035;
      pose = {
        head: { x: 0, y: 5.8 + bodyY * 0.35, r: 5.4 },
        torso: { x: 0, y: 23 + bodyY, rx: torsoRadiusX, ry: 12, rot: torsoTilt },
        farArm: walkingArm((cycle + 0.5) % 1, bodyY, -1.2),
        nearArm: walkingArm(cycle, bodyY, 0.6),
        farLeg: walkingLeg((cycle + 0.5) % 1, bodyY * 0.35),
        nearLeg: walkingLeg(cycle, bodyY * 0.35)
      };
    } else if (crouching) {
      const crouchWalking = moving && grounded;
      const settle = crouchWalking ? 0 : Math.sin(this.animTime * 1.6) * 0.28;
      const bodyY = crouchWalking
        ? Math.sin((this.crouchWalkTime % 0.76) / 0.76 * Math.PI * 4) * 0.45
        : settle;
      const lower = crouchBlend;
      const torsoLean = 0.18 * lower;
      // Keep crouched hips in the torso's lower third so folded legs stay visibly attached.
      const hipY = mix(29, 40.6 + bodyY * 0.3, lower);
      const shoulderY = mix(18, 27 + bodyY, lower);
      const torsoCenter = {
        x: mix(0, 2.1, lower),
        y: mix(23, 31.5 + bodyY, lower)
      };

      const crouchWalkCycle = (this.crouchWalkTime % 0.76) / 0.76;

      function crouchArm(side, phaseOffset) {
        const cycle = crouchWalking ? crouchWalkCycle : 0;
        const balancePulse = crouchWalking ? Math.sin((cycle + phaseOffset) * Math.PI * 2) : 0;
        const handShift = crouchWalking ? -Math.cos((cycle + phaseOffset) * Math.PI * 2) : 0;
        const elbowShift = crouchWalking ? handShift * 0.28 : 0;
        const shoulder = {
          x: mix(2.8 - armAttachmentBackShift + side * 1.2, 2.3 - armAttachmentBackShift + side * 0.65, lower),
          y: shoulderY
        };
        // Local +X is always the player's facing direction after mirroring.
        // Keep crouched elbows compact around the middle/back of the torso while
        // the forearms can still reach forward for balance.
        const elbow = {
          x: mix(2.4 + side * 3.6, -0.6 + side * 0.42 + elbowShift, lower),
          y: mix(27, 31.5 + bodyY * 0.25 + balancePulse * 0.18, lower)
        };
        const hand = {
          x: mix(2 + side * 2.6, 11.2 + side * 0.35 + handShift * 0.75, lower),
          y: mix(36, 30.4 + bodyY * 0.2 - balancePulse * 0.22, lower)
        };
        return [shoulder, elbow, hand];
      }

      function crouchLeg(legCycle, hipOffsetX) {
        const cycle = crouchWalking ? legCycle : 0;
        const frames = [
          { footX: 8, footY: modelFeetY, kneeY: 44.5, kneeForward: 6.4 },
          { footX: 5, footY: modelFeetY, kneeY: 45.2, kneeForward: 7.2 },
          { footX: 0, footY: modelFeetY - 0.8, kneeY: 43.8, kneeForward: 7.8 },
          { footX: -6, footY: modelFeetY, kneeY: 44.6, kneeForward: 6.8 },
          { footX: -8, footY: modelFeetY, kneeY: 44.5, kneeForward: 6.4 },
          { footX: -5, footY: modelFeetY, kneeY: 45.2, kneeForward: 7.2 },
          { footX: 0, footY: modelFeetY - 0.8, kneeY: 43.8, kneeForward: 7.8 },
          { footX: 6, footY: modelFeetY, kneeY: 44.6, kneeForward: 6.8 }
        ];
        const folded = interpolateKeyframes(frames.map((frame) => {
          const hip = { x: hipOffsetX, y: hipY };
          const foot = { x: frame.footX, y: frame.footY };
          const knee = {
            x: mix(hip.x, foot.x, 0.42) + frame.kneeForward,
            y: frame.kneeY + bodyY * 0.2
          };
          return [hip, knee, foot];
        }), cycle);
        const standing = restingLeg(hipOffsetX < 0 ? -1 : 1);
        return folded.map((point, index) => ({
          x: mix(standing[index].x, point.x, lower),
          y: mix(standing[index].y, point.y, lower)
        }));
      }

      const cycle = crouchWalkCycle;
      const headRadius = 5.4;
      const crouchHeadDistance = 12 + headRadius + 0.5;
      const crouchHeadCenter = {
        x: torsoCenter.x + Math.sin(torsoLean) * crouchHeadDistance,
        y: torsoCenter.y - Math.cos(torsoLean) * crouchHeadDistance + bodyY * 0.08
      };
      pose = {
        head: { x: mix(0, crouchHeadCenter.x, lower), y: mix(5.8, crouchHeadCenter.y, lower), r: headRadius },
        torso: { x: torsoCenter.x, y: torsoCenter.y, rx: torsoRadiusX, ry: 12, rot: torsoLean },
        farArm: crouchArm(1, 0.5),
        nearArm: crouchArm(-1, 0),
        farLeg: crouchLeg((cycle + 0.5) % 1, -1.2),
        nearLeg: crouchLeg(cycle, 1.2)
      };
    } else if (sprinting) {
      const cycle = (this.animTime % 0.4) / 0.4;
      const runBobFrames = [0, 1.6, 0.2, -1, 0, 1.6, 0.2, -1];
      const scaledBob = cycle * runBobFrames.length;
      const bobIndex = Math.floor(scaledBob) % runBobFrames.length;
      const bodyY = mix(
        runBobFrames[bobIndex],
        runBobFrames[(bobIndex + 1) % runBobFrames.length],
        scaledBob - Math.floor(scaledBob)
      );
      // Positive rotation is forward in the player-local coordinate space;
      // the outer facing scale mirrors it when running left. Anchor the lean
      // around the hips so the feet and stable collision body stay grounded.
      const runLean = Math.PI / 18;
      const torsoHipAnchorX = 0.4;
      const torsoLeanX = Math.sin(runLean) * 12;
      const torsoCenterX = torsoHipAnchorX + torsoLeanX;
      const shoulderLeanX = torsoLeanX + 2.4;
      const headLeanX = Math.sin(runLean) * 25;

      // A mirrored eight-pose run keeps contact/compression/passing/push-off
      // readable while interpolation prevents snapping between key poses.
      function runningLeg(legCycle, hipOffsetX) {
        const hip = { x: hipOffsetX, y: 28 + bodyY * 0.25 };
        const frames = [
          { footX: 14, footY: modelFeetY, kneeY: 39.5, kneeForward: 5.2 },
          { footX: 9, footY: modelFeetY, kneeY: 42.5, kneeForward: 7.2 },
          { footX: 1, footY: modelFeetY - 3, kneeY: 38.5, kneeForward: 8.4 },
          { footX: -10, footY: modelFeetY - 3.5, kneeY: 37, kneeForward: 6.8 },
          { footX: -14, footY: modelFeetY, kneeY: 40, kneeForward: 5.8 },
          { footX: -8, footY: modelFeetY - 1, kneeY: 40.5, kneeForward: 7.6 },
          { footX: 0, footY: modelFeetY - 4, kneeY: 37, kneeForward: 8.8 },
          { footX: 10, footY: modelFeetY - 2.5, kneeY: 37.5, kneeForward: 7 }
        ];

        return interpolateKeyframes(frames.map((frame) => {
          const foot = { x: frame.footX, y: frame.footY };
          const knee = {
            x: mix(hip.x, foot.x, 0.46) + frame.kneeForward,
            y: frame.kneeY + bodyY * 0.2
          };
          return [hip, knee, foot];
        }), legCycle);
      }

      function runningArm(legCycle, depthOffset) {
        const frames = [
          { elbowX: -6.5, elbowY: 24, handX: -11, handY: 33 },
          { elbowX: -2.5, elbowY: 24.5, handX: -4, handY: 33 },
          { elbowX: 1.5, elbowY: 24, handX: 3, handY: 32 },
          { elbowX: 7, elbowY: 23, handX: 12, handY: 29 },
          { elbowX: 7.5, elbowY: 23, handX: 13, handY: 28 },
          { elbowX: 3, elbowY: 24.5, handX: 5, handY: 32 },
          { elbowX: -1, elbowY: 25, handX: -2, handY: 33 },
          { elbowX: -6, elbowY: 24, handX: -10, handY: 32 }
        ];
        const shoulder = { x: 3.4 - armAttachmentBackShift + shoulderLeanX + depthOffset, y: 18 + bodyY };

        return interpolateKeyframes(frames.map((frame) => [
          shoulder,
          { x: frame.elbowX + shoulderLeanX * 0.7 + depthOffset, y: frame.elbowY + bodyY * 0.7 },
          { x: frame.handX + shoulderLeanX * 0.45 + depthOffset, y: frame.handY + bodyY * 0.55 }
        ]), legCycle);
      }

      pose = {
        head: { x: 1.4 + headLeanX, y: 5.8 + bodyY * 0.35, r: 5.4 },
        torso: { x: torsoCenterX, y: 23 + bodyY, rx: torsoRadiusX, ry: 12, rot: runLean },
        farArm: runningArm(cycle, -1.2),
        nearArm: runningArm((cycle + 0.5) % 1, 0.6),
        farLeg: runningLeg((cycle + 0.5) % 1, -1.2),
        nearLeg: runningLeg(cycle, 1.2)
      };
    } else if (upwardJumping || falling) {
      // Jump is intentionally a single upward-motion pose: a slight forward
      // lean, compact balancing arms, and bent legs that hold steady until downward fall.
      const jumpLean = Math.PI / 40;
      const jumpTorso = { x: 0.6, y: 23, rx: torsoRadiusX, ry: 12, rot: jumpLean };
      const jumpPose = {
        head: {
          x: jumpTorso.x + Math.sin(jumpLean) * 17.1,
          y: jumpTorso.y - Math.cos(jumpLean) * 17.1,
          r: 5.4
        },
        torso: jumpTorso,
        farArm: [
          { x: 1.4 - armAttachmentBackShift, y: 18 },
          { x: 1.6, y: 22.1 },
          { x: 2.2, y: 27.2 }
        ],
        nearArm: [
          { x: 3.8 - armAttachmentBackShift, y: 18 },
          { x: 5.6, y: 22.3 },
          { x: 7.1, y: 27.8 }
        ],
        farLeg: [
          { x: -1.4, y: 29 },
          { x: 4.8, y: 38.7 },
          { x: -8.8, y: modelFeetY - 4.6 }
        ],
        nearLeg: [
          { x: 2.4, y: 29 },
          { x: 9.4, y: 37.1 },
          { x: 5.6, y: modelFeetY - 5.2 }
        ]
      };

      // Falling is a mostly single, side-view balancing pose: upright torso,
      // raised arms, and softly bent legs. A tiny settle keeps the transition
      // from the jump pose smooth without creating a cycling animation.
      const fallBlend = falling ? this.fallPoseBlend : 0;
      const fallSettle = Math.sin(this.animTime * 2.2) * 0.55 * fallBlend;
      const fallLean = -Math.PI / 40;
      const fallPose = {
        head: { x: -0.65 + Math.sin(fallLean) * 11, y: 5.9 + fallSettle * 0.25, r: 5.4 },
        torso: { x: -0.65, y: 23 + fallSettle, rx: torsoRadiusX, ry: 12, rot: fallLean },
        farArm: [
          { x: 1.2 - armAttachmentBackShift, y: 18 + fallSettle },
          { x: -5.8, y: 16.2 + fallSettle * 0.55 },
          { x: -9.4, y: 22.6 + fallSettle * 0.35 }
        ],
        nearArm: [
          { x: 3.8 - armAttachmentBackShift, y: 18 + fallSettle },
          { x: 7.2, y: 23.8 + fallSettle * 0.45 },
          { x: 8.8, y: 30.4 + fallSettle * 0.35 }
        ],
        farLeg: [
          { x: -1.2, y: 29 + fallSettle * 0.4 },
          { x: -1.5, y: 39.2 + fallSettle * 0.3 },
          { x: -7.8, y: modelFeetY - 1.2 + fallSettle * 0.2 }
        ],
        nearLeg: [
          { x: 2.2, y: 29 + fallSettle * 0.4 },
          { x: 7.4, y: 39.1 + fallSettle * 0.3 },
          { x: 6.8, y: modelFeetY - 2.2 + fallSettle * 0.2 }
        ]
      };

      pose = {
        head: {
          x: mix(jumpPose.head.x, fallPose.head.x, fallBlend),
          y: mix(jumpPose.head.y, fallPose.head.y, fallBlend),
          r: jumpPose.head.r
        },
        torso: {
          x: mix(jumpPose.torso.x, fallPose.torso.x, fallBlend),
          y: mix(jumpPose.torso.y, fallPose.torso.y, fallBlend),
          rx: torsoRadiusX,
          ry: 12,
          rot: mix(jumpPose.torso.rot, fallPose.torso.rot, fallBlend)
        },
        farArm: blendLimb(jumpPose.farArm, fallPose.farArm, fallBlend),
        nearArm: blendLimb(jumpPose.nearArm, fallPose.nearArm, fallBlend),
        farLeg: blendLimb(jumpPose.farLeg, fallPose.farLeg, fallBlend),
        nearLeg: blendLimb(jumpPose.nearLeg, fallPose.nearLeg, fallBlend)
      };
    } else {
      const breathe = Math.sin(this.animTime * 1.2) * 0.45;
      pose = {
        head: { x: 0, y: 5.8 + breathe * 0.35, r: 5.4 },
        torso: { x: 0, y: 23 + breathe, rx: torsoRadiusX, ry: 12, rot: 0 },
        farArm: null,
        nearArm: restingArm(-1, breathe),
        farLeg: restingLeg(-1),
        nearLeg: restingLeg(1)
      };
    }

    if (landCompression > 0) {
      const compression = landCompression * (this.isCrouching ? 0.55 : 1);
      const bodyDrop = compression * 3.2;
      const subtleForwardLean = compression * 0.04;
      pose.torso = {
        ...pose.torso,
        y: pose.torso.y + bodyDrop,
        rot: pose.torso.rot + subtleForwardLean
      };
      pose.head = { ...pose.head, y: pose.head.y + bodyDrop * 0.96 };

      function compressLandingLeg(leg, side) {
        return leg.map((point, index) => {
          if (index === 0) return { x: point.x + compression * 0.25, y: point.y + compression * 2.15 };
          if (index === 1) return { x: point.x + compression * (2.2 + side * 0.2), y: point.y + compression * 2.85 };
          // Keep every grounded foot visually locked to the current floor/ceiling surface.
          return { x: point.x, y: modelFeetY };
        });
      }

      function balanceLandingArm(arm, side) {
        if (!arm) return arm;
        return arm.map((point, index) => {
          if (index === 0) return { x: point.x + compression * 0.12, y: point.y + compression * 1.65 };
          if (index === 1) return { x: point.x + compression * 1.25, y: point.y + compression * 2.15 };
          return { x: point.x + compression * (2.1 + side * 0.25), y: point.y + compression * 2.45 };
        });
      }

      pose.farLeg = compressLandingLeg(pose.farLeg, -1);
      pose.nearLeg = compressLandingLeg(pose.nearLeg, 1);
      pose.farArm = balanceLandingArm(pose.farArm, -1);
      pose.nearArm = balanceLandingArm(pose.nearArm, 1);
    }

    let attackChargePoint = null;
    let attackProgress = 0;
    if (this.attackTimer > 0) {
      attackProgress = 1 - clamp(this.attackTimer / ATTACK_ANIM_DURATION, 0, 1);
      const baseFarArm = pose.farArm ?? restingArm(1, 0);
      const baseNearArm = pose.nearArm ?? restingArm(-1, 0);
      const crouchTightness = this.isCrouching ? 1 : 0;
      const chestX = pose.torso.x + Math.cos(pose.torso.rot) * mix(8.2, 7.1, crouchTightness);
      const chestY = pose.torso.y - mix(2.4, 0.9, crouchTightness) + Math.sin(pose.torso.rot) * 2.5;
      const releaseLean = attackProgress > 0.44 && attackProgress < 0.68
        ? Math.sin((attackProgress - 0.44) / 0.24 * Math.PI) * 0.06
        : 0;
      pose.torso = { ...pose.torso, rot: pose.torso.rot + releaseLean };
      pose.head = { ...pose.head, x: pose.head.x + releaseLean * 7, y: pose.head.y + releaseLean * 1.1 };

      function attackArm(baseArm, side) {
        const shoulder = baseArm[0];
        const prepHand = {
          x: chestX + mix(1.1, 0.45, crouchTightness) + side * mix(2.15, 1.35, crouchTightness),
          y: chestY + mix(5.1, 3.1, crouchTightness) + side * 0.45
        };
        const meetHand = {
          x: chestX + mix(3.35, 2.55, crouchTightness) + side * 0.16,
          y: chestY + mix(1.75, 1.35, crouchTightness) + side * 0.14
        };
        const releaseHand = {
          x: chestX + mix(10.45, 8.25, crouchTightness) + side * 0.38,
          y: chestY + mix(2.15, 1.75, crouchTightness) + side * 0.18
        };
        const recoverHand = blendPoint(baseArm[2], releaseHand, 0.38);
        const prepElbow = { x: mix(shoulder.x, prepHand.x, 0.54), y: mix(shoulder.y, prepHand.y, 0.72) };
        const meetElbow = {
          x: chestX + mix(0.8, 0.35, crouchTightness) + side * mix(1.85, 1.1, crouchTightness),
          y: chestY + mix(4.45, 3.0, crouchTightness)
        };
        const releaseElbow = {
          x: chestX + mix(4.85, 3.65, crouchTightness) + side * 0.9,
          y: chestY + mix(4.05, 2.85, crouchTightness)
        };
        const recoverElbow = blendPoint(baseArm[1], releaseElbow, 0.42);
        // Four clear firing poses: prepare, hands meet/focus, release, recover.
        return interpolateTimedTimeline([
          { time: 0, limb: [shoulder, prepElbow, prepHand] },
          { time: 0.34, limb: [shoulder, meetElbow, meetHand] },
          { time: 0.58, limb: [shoulder, releaseElbow, releaseHand] },
          { time: 0.84, limb: [shoulder, recoverElbow, recoverHand] },
          { time: 1, limb: baseArm }
        ], attackProgress);
      }

      pose.farArm = attackArm(baseFarArm, -1);
      pose.nearArm = attackArm(baseNearArm, 1);
      const farHand = pose.farArm[2];
      const nearHand = pose.nearArm[2];
      const focusStrength = attackProgress < 0.6
        ? Math.sin(clamp(attackProgress / 0.6, 0, 1) * Math.PI)
        : Math.max(0, 1 - (attackProgress - 0.6) / 0.24);
      attackChargePoint = {
        x: mix(farHand.x, nearHand.x, 0.5),
        y: mix(farHand.y, nearHand.y, 0.5),
        strength: focusStrength,
        release: attackProgress > 0.42 && attackProgress < 0.68
      };
    }

    strokeLimb(pose.farLeg, 2.8);
    if (pose.farArm) strokeLimb(pose.farArm, 2.4);
    drawTorso(pose.torso.x, pose.torso.y, pose.torso.rx, pose.torso.ry, pose.torso.rot);
    strokeLimb(pose.nearLeg, 3.2);
    if (attackChargePoint && attackChargePoint.strength > 0.04) {
      ctx.save();
      ctx.shadowColor = "rgba(174, 244, 255, 0.95)";
      ctx.shadowBlur = 8 + attackChargePoint.strength * 10;
      ctx.strokeStyle = `rgba(78, 162, 242, ${0.45 + attackChargePoint.strength * 0.4})`;
      ctx.fillStyle = `rgba(174, 244, 255, ${0.28 + attackChargePoint.strength * 0.42})`;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.arc(attackChargePoint.x, attackChargePoint.y, 1.7 + attackChargePoint.strength * 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (attackChargePoint.release) {
        ctx.beginPath();
        ctx.arc(attackChargePoint.x + 3.2, attackChargePoint.y, 4.6 + attackChargePoint.strength * 2.1, -0.72, 0.72);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(attackChargePoint.x + 1.7, attackChargePoint.y - 2.3);
        ctx.lineTo(attackChargePoint.x + 7.2, attackChargePoint.y);
        ctx.lineTo(attackChargePoint.x + 1.7, attackChargePoint.y + 2.3);
        ctx.stroke();
      }
      ctx.restore();
    }
    if (pose.nearArm) strokeLimb(pose.nearArm, 2.7);

    ctx.fillStyle = fill;
    ctx.strokeStyle = outline;
    ctx.lineWidth = characterOutlineWidth;
    ctx.beginPath();
    ctx.arc(pose.head.x, pose.head.y, pose.head.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.save();
    ctx.translate(pose.torso.x + 1.2, pose.torso.y + 1.7);
    ctx.rotate(pose.torso.rot);
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.roundRect(-pose.torso.rx * 0.24, -pose.torso.ry * 0.42, pose.torso.rx * 0.48, pose.torso.ry * 0.84, pose.torso.rx * 0.22);
    ctx.fill();
    ctx.restore();

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
  constructor(startX, y, endX, direction) {
    this.startX = startX;
    this.y = y;
    this.endX = endX;
    this.direction = direction;
    this.age = 0;
    this.active = true;
  }

  static fire(startX, y, direction) {
    const endX = findPulseEndpoint(startX, y, direction);
    const hitEnemy = findFirstEnemyOnPulse(startX, y, endX, direction);
    if (hitEnemy) hitEnemy.hit(PULSE_DAMAGE);
    return new SystemPulse(startX, y, endX, direction);
  }

  update(dt) {
    this.age += dt;
    if (this.age >= PULSE_LIFETIME) this.active = false;
  }

  draw() {
    const progress = clamp(this.age / PULSE_LIFETIME, 0, 1);
    const visibleStartX = this.startX + (this.endX - this.startX) * progress;
    const visibleLength = Math.abs(this.endX - visibleStartX);
    if (visibleLength <= 1) return;

    const alpha = clamp((1 - progress) * 1.4, 0, 1);
    const tipX = this.endX;
    const tailX = visibleStartX;
    const direction = this.direction;
    const halfThickness = PULSE_THICKNESS / 2;
    const tailInset = Math.min(16, visibleLength * 0.32);
    const tipInset = Math.min(10, visibleLength * 0.22);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.lineJoin = "miter";

    // Minimal blue glow around a single continuous white core keeps the pulse
    // crisp and digital, without making it read as fire, smoke, or magic.
    ctx.shadowColor = "rgba(126, 222, 255, 0.55)";
    ctx.shadowBlur = 9;
    ctx.strokeStyle = "rgba(126, 222, 255, 0.42)";
    ctx.lineWidth = PULSE_THICKNESS + 4;
    ctx.lineCap = "butt";
    ctx.beginPath();
    ctx.moveTo(tailX, this.y);
    ctx.lineTo(tipX, this.y);
    ctx.stroke();

    const core = ctx.createLinearGradient(tailX, this.y, tipX, this.y);
    core.addColorStop(0, "rgba(255, 255, 255, 0)");
    core.addColorStop(0.18, "rgba(190, 238, 255, 0.72)");
    core.addColorStop(0.7, "rgba(255, 255, 255, 0.97)");
    core.addColorStop(1, "rgba(255, 255, 255, 1)");

    ctx.shadowColor = "rgba(174, 244, 255, 0.42)";
    ctx.shadowBlur = 5;
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.moveTo(tailX, this.y);
    ctx.lineTo(tailX + direction * tailInset, this.y - halfThickness);
    ctx.lineTo(tipX - direction * tipInset, this.y - halfThickness * 0.72);
    ctx.lineTo(tipX, this.y);
    ctx.lineTo(tipX - direction * tipInset, this.y + halfThickness * 0.72);
    ctx.lineTo(tailX + direction * tailInset, this.y + halfThickness);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
    ctx.lineWidth = 1.15;
    ctx.beginPath();
    ctx.moveTo(tailX + direction * tailInset * 0.4, this.y);
    ctx.lineTo(tipX, this.y);
    ctx.stroke();

    ctx.restore();
  }
}

function findPulseEndpoint(startX, y, direction) {
  const screenEdge = direction > 0 ? cameraX + canvas.width : cameraX;
  let endX = clamp(screenEdge, 0, ROOM_WIDTH);
  let bestDistance = Math.abs(endX - startX);

  function consider(hitX) {
    const distanceToHit = (hitX - startX) * direction;
    if (distanceToHit >= 0 && distanceToHit < bestDistance) {
      endX = hitX;
      bestDistance = distanceToHit;
    }
  }

  for (const platform of platforms) {
    if (!pulseLineOverlapsY(y, platform)) continue;
    consider(direction > 0 ? platform.x : platform.x + platform.w);
  }

  for (const enemy of enemies) {
    if (enemy.hp <= 0 || !pulseLineOverlapsY(y, enemy)) continue;
    consider(direction > 0 ? enemy.x : enemy.x + enemy.w);
  }

  return endX;
}

function pulseLineOverlapsY(y, rect) {
  const halfThickness = PULSE_THICKNESS / 2;
  return y + halfThickness >= rect.y && y - halfThickness <= rect.y + rect.h;
}

function findFirstEnemyOnPulse(startX, y, endX, direction) {
  let firstEnemy = null;
  let bestDistance = Math.abs(endX - startX) + 0.001;

  for (const enemy of enemies) {
    if (enemy.hp <= 0 || !pulseLineOverlapsY(y, enemy)) continue;
    const hitX = direction > 0 ? enemy.x : enemy.x + enemy.w;
    const distanceToHit = (hitX - startX) * direction;
    if (distanceToHit >= 0 && distanceToHit <= bestDistance) {
      firstEnemy = enemy;
      bestDistance = distanceToHit;
    }
  }

  return firstEnemy;
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
