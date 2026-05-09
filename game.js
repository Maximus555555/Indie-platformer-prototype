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
const WALKER_WIDTH = config.walkerWidth ?? 32;
const WALKER_HEIGHT = config.walkerHeight ?? 28;
const WALKER_VISUAL_SCALE = config.walkerVisualScale ?? 0.78;

const WALKER_PLATE_STROKE = "#37b6e6";
const WALKER_PLATE_FILL = "rgba(49, 173, 219, 0.18)";
const WALKER_DETAIL_STROKE = "rgba(93, 213, 244, 0.58)";
const WALKER_DETAIL_STROKE_DIM = "rgba(76, 195, 232, 0.36)";
const WALKER_CORE_STROKE = "#229bd1";
const WALKER_CORE_FILL = "rgba(46, 169, 214, 0.2)";
const WALKER_INNER_STROKE = "rgba(108, 221, 250, 0.68)";
const WALKER_INNER_FILL = "rgba(90, 207, 239, 0.1)";
const WALKER_CENTER_FILL = "rgba(125, 232, 250, 0.32)";
const WALKER_CENTER_STROKE = "rgba(190, 248, 255, 0.9)";
const DRONE_WIDTH = config.droneWidth ?? 32;
const DRONE_HEIGHT = config.droneHeight ?? 28;
const DRONE_DETECTION_RANGE = config.droneDetectionRange ?? 440;
const DRONE_FIRE_COOLDOWN = config.droneFireCooldown ?? 1.85;
const DRONE_WINDUP = config.droneWindup ?? 0.34;
const DRONE_PROJECTILE_SPEED = config.droneProjectileSpeed ?? 360;
const DRONE_PROJECTILE_SIZE = config.droneProjectileSize ?? 10;
const JUMPER_WIDTH = config.jumperWidth ?? 30;
const JUMPER_HEIGHT = config.jumperHeight ?? 32;
const JUMPER_DETECTION_X = config.jumperDetectionX ?? 260;
const JUMPER_DETECTION_Y = config.jumperDetectionY ?? 130;
const JUMPER_CHARGE_DURATION = config.jumperChargeDuration ?? 0.34;
const JUMPER_CROUCH_HOLD = config.jumperCrouchHold ?? 0.1;
const JUMPER_RECOVERY_DURATION = config.jumperRecoveryDuration ?? 0.24;
const JUMPER_RECOVERY_DELAY = config.jumperRecoveryDelay ?? 0.34;
const JUMPER_LEAP_MIN_SPEED = config.jumperLeapMinSpeed ?? 130;
const JUMPER_LEAP_MAX_SPEED = config.jumperLeapMaxSpeed ?? 180;
const JUMPER_LEAP_IMPULSE = config.jumperLeapImpulse ?? 430;
const JUMPER_EDGE_SUPPORT_TOLERANCE = config.jumperEdgeSupportTolerance ?? 4;
const DRONE_ORBIT_SLOT_COUNT = 2;
const DRONE_ORBIT_RADIUS_X = 38;
const DRONE_ORBIT_RADIUS_Y = 25;
const DRONE_ORBIT_SPEED = 2.1;
const DRONE_OUTER_DIAMOND_RX = 7;
const DRONE_OUTER_DIAMOND_RY = 10;
const DRONE_CORE_DIAMOND_RX = 12.5;
const DRONE_CORE_DIAMOND_RY = 20;
const DRONE_AIM_TURN_SPEED = 14;
const DRONE_OUTER_DIAMOND_FILL = "rgb(255, 153, 25)";
const DRONE_OUTER_DIAMOND_STROKE = "rgb(46, 26, 14)";
const DRONE_DIAMOND_DETACH_MIN_DURATION = 0.42;
const DRONE_DIAMOND_DETACH_MAX_DURATION = 0.85;
const DRONE_DIAMOND_REFORM_DURATION = 0.24;
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
const GRAVITY_FLIP_VISUAL_DURATION = 0.18;
const GRAVITY_FIELD_COOLDOWN = config.gravityFieldCooldown ?? 3.0;
const GRAVITY_FIELD_DURATION = config.gravityFieldDuration ?? 3.5;
const TIME_SLOW_RADIUS = config.timeSlowRadius ?? 260;
const TIME_SLOW_DURATION = config.timeSlowDuration ?? 2.75;
const TIME_SLOW_COOLDOWN = config.timeSlowCooldown ?? 7.0;
const TIME_SLOW_MULTIPLIER = config.timeSlowMultiplier ?? 0.4;
const TIME_SLOW_FADE_DURATION = 0.22;
const PHASE_SHIFT_DURATION = config.phaseShiftDuration ?? 1.75;
const PHASE_SHIFT_COOLDOWN = config.phaseShiftCooldown ?? 6.0;
const PHASE_SHIFT_FLICKER_DURATION = 0.16;
const PHASE_SHIFT_EXPOSURE_RADIUS = 96;
const ANCHOR_FIELD_RADIUS = config.anchorFieldRadius ?? 160;
const ANCHOR_FIELD_DURATION = config.anchorFieldDuration ?? 2.5;
const ANCHOR_FIELD_COOLDOWN = config.anchorFieldCooldown ?? 7.0;
const ANCHOR_FIELD_FADE_DURATION = 0.16;
const ANCHOR_SILVER_FILL = "rgba(192, 192, 192, 0.14)";
const ANCHOR_SILVER_STROKE = "rgba(224, 224, 224, 0.92)";
const ANCHOR_SILVER_CORE = "rgba(245, 245, 245, 0.96)";
const ANCHOR_SILVER_SHADOW = "rgba(192, 192, 192, 0.72)";
const FORCE_PULSE_RANGE = config.forcePulseRange ?? 280;
const FORCE_PULSE_HALF_ANGLE = Math.PI / 6;
const FORCE_PULSE_KNOCKBACK = config.forcePulseKnockback ?? 780;
const FORCE_PULSE_MIN_FORCE_SCALE = 0.65;
const FORCE_PULSE_STUN = config.forcePulseStun ?? 0.18;
const FORCE_PULSE_VISUAL_DURATION = config.forcePulseVisualDuration ?? 0.14;
const FORCE_PULSE_EXPAND_DURATION = Math.min(config.forcePulseExpandDuration ?? 0.07, FORCE_PULSE_VISUAL_DURATION);
const FORCE_PULSE_ARM_PUSH_DURATION = config.forcePulseArmPushDuration ?? 0.15;
const FORCE_PULSE_ARM_RECOVERY_DURATION = config.forcePulseArmRecoveryDuration ?? 0.13;
const FORCE_PULSE_ARM_DURATION = FORCE_PULSE_ARM_PUSH_DURATION + FORCE_PULSE_ARM_RECOVERY_DURATION;
const FORCE_PULSE_DRONE_RECOVERY = config.forcePulseDroneRecovery ?? 0.28;
const FORCE_PULSE_COOLDOWN = config.forcePulseCooldown ?? 4.0;
const CONTACT_DAMAGE_COOLDOWN = config.contactDamageCooldown ?? 0.8;
const DAMAGE_RECOIL_DURATION = 0.15;
const DAMAGE_RECOIL_SPEED = 230;
const DAMAGE_RECOIL_CONTROL_SCALE = 0.35;
const DAMAGE_RECOIL_BUMP_SPEED = 72;
const DEATH_FLASH_DURATION = 0.1;
const DEATH_DESTABILIZE_DURATION = 0.16;
const DEATH_FRAGMENT_DURATION = 0.28;
const DEATH_FADE_DURATION = 0.2;
const DEATH_TOTAL_DURATION = DEATH_FLASH_DURATION + DEATH_DESTABILIZE_DURATION + DEATH_FRAGMENT_DURATION + DEATH_FADE_DURATION;
const ENEMY_DEATH_FLASH_DURATION = 0.055;
const ENEMY_DEATH_DESTABILIZE_DURATION = 0.08;
const ENEMY_DEATH_FRAGMENT_DURATION = 0.16;
const ENEMY_DEATH_FADE_DURATION = 0.1;
const ENEMY_DEATH_TOTAL_DURATION = ENEMY_DEATH_FLASH_DURATION + ENEMY_DEATH_DESTABILIZE_DURATION + ENEMY_DEATH_FRAGMENT_DURATION + ENEMY_DEATH_FADE_DURATION;
const FALL_BOUNDARY_OFFSET = config.fallBoundaryOffset ?? 48;
const FALL_RESPAWN_GRACE = config.fallRespawnGrace ?? 0.22;
const EDGE_RESPAWN_INSET = config.edgeRespawnInset ?? 18;
const ROOM_WIDTH = config.roomWidth ?? 2200;
const ENEMY_VERTICAL_EDGE_KILL_TOLERANCE = config.enemyVerticalEdgeKillTolerance ?? 4;
const ENEMY_VERTICAL_EDGE_KILL_ARM_DURATION = config.enemyVerticalEdgeKillArmDuration ?? 0.9;
const HUD_MARGIN = 20;
const HP_DIAMOND_SIZE = 14;
const HP_DIAMOND_SPACING = 8;
const GRAVITY_MARKER_HEIGHT = 9;
const GRAVITY_MARKER_GAP = 8;
const SPIKE_HEIGHT = config.spikeHeight ?? 18;
const SPIKE_WIDTH = config.spikeWidth ?? 16;
const SPIKE_FILL = "#245c93";
const SPIKE_STROKE = "rgba(24, 62, 111, 0.82)";
const SPIKE_BASE_FILL = "rgba(31, 91, 143, 0.78)";
const ABILITY_HOLD_THRESHOLD = 0.24;
const ABILITY_ICON_SIZE = 46;
const ABILITY_ICON_MARGIN = 24;
const ABILITY_WHEEL_RADIUS = 118;
const ABILITY_WHEEL_INNER_RADIUS = 34;
const ABILITY_READY_PULSE_DURATION = 0.22;
const SYSTEM_TEXT_SPEED = 48;
const SYSTEM_AMBIENT_DURATION = 3.2;
const SYSTEM_AMBIENT_FADE = 0.45;

const checkpoint = config.checkpoint ?? { x: 86, y: 362 };
const safeAnchor = config.safeAnchor ?? { x: 92, y: 362 };

const keys = new Set();
const pressedThisFrame = new Set();
const pulses = [];
const forcePulseVisuals = [];
const droneProjectiles = [];
let lastTime = performance.now();
let pointerScreen = { x: canvas.width / 2, y: canvas.height / 2 };
let eHoldTimer = 0;
let eReleasedThisFrame = false;
let eWheelOpenedThisHold = false;
let gravityCastId = 0;
let forcePulseCastId = 0;
let gravityFieldActive = false;
let activeGravityEntities = new Set();
let timeSlowActive = false;
let timeSlowFadeTimer = 0;
let phaseShiftActive = false;
let anchorFieldActive = false;
let anchorField = null;
let anchorFieldFade = null;
let phaseCastId = 0;
let currentPhaseExposure = new Set();
let cameraX = 0;

const platforms = [
  { x: 0, y: 0, w: ROOM_WIDTH, h: 28 },
  { x: 0, y: 470, w: 300, h: 70 },
  { x: 410, y: 470, w: 360, h: 70 },
  { x: 860, y: 470, w: 420, h: 70 },
  // Right-side arena extension: spaced floor spans create a future patrol zone
  // and a gravity-focused zone without crowding the open air between them.
  { x: 1360, y: 470, w: 300, h: 70 },
  { x: 1780, y: 470, w: 420, h: 70 },
  { x: 220, y: 365, w: 150, h: 20 },
  { x: 535, y: 300, w: 190, h: 20 },
  { x: 805, y: 385, w: 155, h: 20 },
  { x: 1010, y: 260, w: 155, h: 20 },
  { x: 1325, y: 360, w: 190, h: 20 },
  { x: 1500, y: 245, w: 210, h: 20 },
  { x: 1720, y: 390, w: 180, h: 20 },
  { x: 1900, y: 310, w: 240, h: 20 },
  { x: 1985, y: 150, w: 150, h: 20 }
];

const phaseBarriers = [];

const spikes = [
  // Floor strip: leaves safe space around the platform edges for recovery while
  // giving the player and grounded enemies a readable hazard test.
  { platform: platforms[3], side: "top", x: 930, w: 96, spikeWidth: SPIKE_WIDTH, spikeHeight: SPIKE_HEIGHT },
  // Ceiling strips: attached to the underside of the top platform so Gravity
  // Field can launch nearby enemies upward into clean geometric hazards.
  { platform: platforms[0], side: "bottom", x: 620, w: 128, spikeWidth: SPIKE_WIDTH, spikeHeight: SPIKE_HEIGHT },
  { platform: platforms[0], side: "bottom", x: 1030, w: 112, spikeWidth: SPIKE_WIDTH, spikeHeight: SPIKE_HEIGHT }
];

const bottomFallBoundary = config.fallBoundary
  ?? Math.max(...platforms.map((platform) => platform.y)) + FALL_BOUNDARY_OFFSET;

function createAbility(id, name, label, unlocked, cooldownDuration, activeDuration = 0) {
  return {
    id,
    name,
    label,
    unlocked,
    cooldownDuration,
    cooldownRemaining: 0,
    activeDuration,
    activeRemaining: 0,
    readyPulseTimer: 0,
    unavailableTimer: 0
  };
}

const abilities = [
  createAbility("gravity", "Gravity Field", "Gravity", true, GRAVITY_FIELD_COOLDOWN, GRAVITY_FIELD_DURATION),
  createAbility("time", "Time Slow", "Time", true, TIME_SLOW_COOLDOWN, TIME_SLOW_DURATION),
  createAbility("pulse", "Force Pulse", "Pulse", true, FORCE_PULSE_COOLDOWN),
  createAbility("anchor", "Anchor Field", "Anchor", true, ANCHOR_FIELD_COOLDOWN, ANCHOR_FIELD_DURATION),
  createAbility("phase", "Phase Shift", "Phase", true, PHASE_SHIFT_COOLDOWN, PHASE_SHIFT_DURATION),
  createAbility("link", "Energy Link", "Link", false, 8.0)
];
let selectedAbilityId = "gravity";
const abilityWheel = {
  open: false,
  hoveredIndex: 0,
  centerX: canvas.width / 2,
  centerY: canvas.height / 2
};
// Mouse-driven wheel selection will be restored behind a future settings toggle.
const MOUSE_ABILITY_WHEEL_SELECTION_ENABLED = false;

function getSelectedAbility() {
  return abilities.find((ability) => ability.id === selectedAbilityId) ?? abilities[0];
}

function isAbilityReady(ability) {
  return ability.unlocked && ability.cooldownRemaining <= 0 && ability.activeRemaining <= 0;
}

function getAbilityById(id) {
  return abilities.find((ability) => ability.id === id);
}


function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function rectsTouchOrOverlap(a, b, margin = 0) {
  return a.x <= b.x + b.w + margin
    && a.x + a.w >= b.x - margin
    && a.y <= b.y + b.h + margin
    && a.y + a.h >= b.y - margin;
}

function spikeStripBounds(spike) {
  const baseY = spike.side === "top" ? spike.platform.y : spike.platform.y + spike.platform.h;
  return {
    x: spike.x,
    y: spike.side === "top" ? baseY - spike.spikeHeight : baseY,
    w: spike.w,
    h: spike.spikeHeight
  };
}

function getSpikeTriangles(spike) {
  const count = Math.max(1, Math.floor(spike.w / spike.spikeWidth));
  const width = spike.w / count;
  const baseY = spike.side === "top" ? spike.platform.y : spike.platform.y + spike.platform.h;
  const apexY = spike.side === "top" ? baseY - spike.spikeHeight : baseY + spike.spikeHeight;
  const triangles = [];

  for (let i = 0; i < count; i += 1) {
    const left = spike.x + i * width;
    const right = spike.x + (i + 1) * width;
    triangles.push([
      { x: left, y: baseY },
      { x: right, y: baseY },
      { x: left + width / 2, y: apexY }
    ]);
  }

  return triangles;
}

function pointInRect(point, rect) {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}

function pointInTriangle(point, triangle) {
  const [a, b, c] = triangle;
  const area = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
  if (Math.abs(area) < 0.0001) return false;

  const weightA = ((b.y - c.y) * (point.x - c.x) + (c.x - b.x) * (point.y - c.y)) / area;
  const weightB = ((c.y - a.y) * (point.x - c.x) + (a.x - c.x) * (point.y - c.y)) / area;
  const weightC = 1 - weightA - weightB;
  return weightA >= 0 && weightB >= 0 && weightC >= 0;
}

function segmentsIntersect(a, b, c, d) {
  function orientation(p, q, r) {
    const value = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
    if (Math.abs(value) < 0.0001) return 0;
    return value > 0 ? 1 : 2;
  }

  function onSegment(p, q, r) {
    return q.x <= Math.max(p.x, r.x) && q.x >= Math.min(p.x, r.x)
      && q.y <= Math.max(p.y, r.y) && q.y >= Math.min(p.y, r.y);
  }

  const o1 = orientation(a, b, c);
  const o2 = orientation(a, b, d);
  const o3 = orientation(c, d, a);
  const o4 = orientation(c, d, b);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(a, c, b)) return true;
  if (o2 === 0 && onSegment(a, d, b)) return true;
  if (o3 === 0 && onSegment(c, a, d)) return true;
  if (o4 === 0 && onSegment(c, b, d)) return true;
  return false;
}

function rectIntersectsTriangle(rect, triangle) {
  const rectPoints = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.w, y: rect.y },
    { x: rect.x + rect.w, y: rect.y + rect.h },
    { x: rect.x, y: rect.y + rect.h },
    { x: rect.x + rect.w / 2, y: rect.y },
    { x: rect.x + rect.w / 2, y: rect.y + rect.h },
    { x: rect.x, y: rect.y + rect.h / 2 },
    { x: rect.x + rect.w, y: rect.y + rect.h / 2 },
    { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 }
  ];
  if (rectPoints.some((point) => pointInTriangle(point, triangle))) return true;
  if (triangle.some((point) => pointInRect(point, rect))) return true;

  const rectEdges = [
    [rectPoints[0], rectPoints[1]],
    [rectPoints[1], rectPoints[2]],
    [rectPoints[2], rectPoints[3]],
    [rectPoints[3], rectPoints[0]]
  ];
  const triangleEdges = [
    [triangle[0], triangle[1]],
    [triangle[1], triangle[2]],
    [triangle[2], triangle[0]]
  ];

  return rectEdges.some((rectEdge) => triangleEdges.some((triangleEdge) => (
    segmentsIntersect(rectEdge[0], rectEdge[1], triangleEdge[0], triangleEdge[1])
  )));
}

function rectTouchesSpikeStrip(rect, spike) {
  if (!rectsOverlap(rect, spikeStripBounds(spike))) return false;
  return getSpikeTriangles(spike).some((triangle) => rectIntersectsTriangle(rect, triangle));
}

function rectTouchesSpikes(rect) {
  return spikes.some((spike) => rectTouchesSpikeStrip(rect, spike));
}

function getFirstTouchedSpike(rect) {
  return spikes.find((spike) => rectTouchesSpikeStrip(rect, spike)) ?? null;
}

function hasSpikesAtSurface(platform, x, gravitySign = 1, width = 1) {
  const side = gravitySign > 0 ? "top" : "bottom";
  return spikes.some((spike) => spike.platform === platform
    && spike.side === side
    && x + width / 2 >= spike.x
    && x - width / 2 <= spike.x + spike.w);
}

function intersectionDepth(a, b) {
  const aCenterX = a.x + a.w / 2;
  const bCenterX = b.x + b.w / 2;
  const aCenterY = a.y + a.h / 2;
  const bCenterY = b.y + b.h / 2;
  return {
    x: (a.w + b.w) / 2 - Math.abs(aCenterX - bCenterX),
    y: (a.h + b.h) / 2 - Math.abs(aCenterY - bCenterY),
    signX: aCenterX < bCenterX ? -1 : 1,
    signY: aCenterY < bCenterY ? -1 : 1
  };
}

function centerOf(entity) {
  return { x: entity.x + entity.w / 2, y: entity.y + entity.h / 2 };
}

function enemyTouchesVerticalWorldEdge(enemy) {
  const left = enemy.x;
  const right = enemy.x + enemy.w;
  return left <= ENEMY_VERTICAL_EDGE_KILL_TOLERANCE || right >= ROOM_WIDTH - ENEMY_VERTICAL_EDGE_KILL_TOLERANCE;
}

function enemyShouldDieOnVerticalWorldEdge(enemy) {
  return enemyTouchesVerticalWorldEdge(enemy) && (enemy.verticalEdgeKillTimer ?? 0) > 0;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function shortestAngleDelta(from, to) {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
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
    this.lastGravityCastId = 0;
    this.gravityFlipVisualTimer = 0;
    this.phaseFlickerTimer = 0;
    this.gravityFlipVisualFromSign = this.gravitySign;
    this.gravityFlipVisualToSign = this.gravitySign;
    this.forcePulseStunTimer = 0;
    this.lastForcePulseCastId = 0;
    this.verticalEdgeKillTimer = 0;
    this.anchorLocked = false;
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
    this.resolveHorizontalEnemyContacts();
    this.resolveWorldHorizontalBounds();

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
    this.resolveVerticalEnemyContacts();
  }

  getOtherSolidEnemyRects() {
    if (typeof enemies === "undefined") return [];
    return enemies
      .filter((enemy) => enemy !== this && enemy.hp > 0 && !enemy.isDying)
      .map((enemy) => enemy.getCollisionRect());
  }

  resolveHorizontalEnemyContacts() {
    let hitEnemy = false;

    for (const solid of this.getOtherSolidEnemyRects()) {
      const body = this.getCollisionRect();
      if (!rectsOverlap(body, solid)) continue;

      const bodyOffsetX = body.x - this.x;
      if (this.vx > 0) this.x = solid.x - body.w - bodyOffsetX;
      else if (this.vx < 0) this.x = solid.x + solid.w - bodyOffsetX;
      else {
        const depth = intersectionDepth(body, solid);
        this.x += depth.signX * (depth.x + 0.1);
      }

      this.vx = 0;
      hitEnemy = true;
    }

    return hitEnemy;
  }

  resolveVerticalEnemyContacts() {
    let hitEnemy = false;

    for (const solid of this.getOtherSolidEnemyRects()) {
      const body = this.getCollisionRect();
      if (!rectsOverlap(body, solid)) continue;

      const bodyOffsetY = body.y - this.y;
      if (this.vy * this.gravitySign > 0) {
        this.y = this.gravitySign > 0
          ? solid.y - body.h - bodyOffsetY
          : solid.y + solid.h - bodyOffsetY;
        this.onSurface = true;
      } else if (this.vy < 0) {
        this.y = solid.y + solid.h - bodyOffsetY;
      } else if (this.vy > 0) {
        this.y = solid.y - body.h - bodyOffsetY;
      } else {
        const depth = intersectionDepth(body, solid);
        this.y += depth.signY * (depth.y + 0.1);
      }

      this.vy = 0;
      hitEnemy = true;
    }

    return hitEnemy;
  }

  resolveWorldHorizontalBounds() {
    const oldX = this.x;
    this.x = clamp(this.x, 0, ROOM_WIDTH - this.w);
    if (this.x !== oldX) {
      this.vx = 0;
      return true;
    }
    return false;
  }

  armVerticalEdgeKill(duration = ENEMY_VERTICAL_EDGE_KILL_ARM_DURATION) {
    this.verticalEdgeKillTimer = Math.max(this.verticalEdgeKillTimer ?? 0, duration);
  }

  updateVerticalEdgeKillTimer(dt) {
    this.verticalEdgeKillTimer = Math.max(0, (this.verticalEdgeKillTimer ?? 0) - dt);
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

  startGravityFlipVisual(fromSign, toSign) {
    if (fromSign === toSign) return;
    this.gravityFlipVisualFromSign = fromSign;
    this.gravityFlipVisualToSign = toSign;
    this.gravityFlipVisualTimer = GRAVITY_FLIP_VISUAL_DURATION;
  }

  updateGravityFlipVisual(dt) {
    if (this.gravityFlipVisualTimer <= 0) return;
    this.gravityFlipVisualTimer = Math.max(0, this.gravityFlipVisualTimer - dt);
  }

  receiveForcePulse(direction, speed, stunDuration, castId) {
    if (this.lastForcePulseCastId === castId || this.isDying || this.hp <= 0) return false;
    this.lastForcePulseCastId = castId;
    this.forcePulseStunTimer = Math.max(this.forcePulseStunTimer ?? 0, stunDuration);
    this.hitTimer = Math.max(this.hitTimer ?? 0, stunDuration);
    this.hitJoltX = direction * 2.6;
    this.hitJoltY = -this.gravitySign * 1.6;

    if (this.anchorLocked) {
      // Anchored enemies can react visually, but the anchor prevents knockback
      // from moving or dislodging them until the active window ends.
      this.vx = 0;
      this.vy = 0;
      return true;
    }

    // Treat the pulse as a short impulse: preserve useful existing momentum,
    // then add a small lift so grounded enemies visibly break from AI control.
    const existingAwaySpeed = Math.max(0, this.vx * direction);
    const impulseSpeed = Math.max(speed, existingAwaySpeed + speed * 0.62);
    this.vx = direction * impulseSpeed;
    this.vy -= this.gravitySign * speed * 0.18;
    // The shove is an impulse only; clear any stale grounded contact so each
    // enemy's gravity/collision update decides whether it is still supported.
    this.onSurface = false;

    this.armVerticalEdgeKill();
    return true;
  }

  updateAnchorHold(dt) {
    if (!this.anchorLocked) return false;
    this.vx = 0;
    this.vy = 0;
    this.onSurface = false;
    this.updateGravityFlipVisual(dt);
    this.updateHitReaction?.(dt);
    this.updateVerticalEdgeKillTimer?.(dt);
    return true;
  }

  updateForcePulseStun(dt) {
    if ((this.forcePulseStunTimer ?? 0) <= 0) return false;
    this.forcePulseStunTimer = Math.max(0, this.forcePulseStunTimer - dt);
    return true;
  }

  getGravityFlipVisualTransform() {
    if (this.gravityFlipVisualTimer <= 0) return { rotation: 0, scaleX: 1 };
    const progress = 1 - clamp(this.gravityFlipVisualTimer / GRAVITY_FLIP_VISUAL_DURATION, 0, 1);
    const eased = progress * progress * (3 - 2 * progress);
    const direction = this.gravityFlipVisualToSign < this.gravityFlipVisualFromSign ? 1 : -1;
    return {
      rotation: direction * Math.PI * (1 - eased),
      // Starts inverted to counter the already-applied gravity orientation, then
      // settles without changing horizontal patrol or facing direction.
      scaleX: -1 + eased * 2
    };
  }
}

class Player extends Entity {
  constructor() {
    super(checkpoint.x, checkpoint.y, PLAYER_WIDTH, STAND_HEIGHT);
    this.maxHp = 3;
    this.hp = this.maxHp;
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
    this.forcePulsePoseTimer = 0;
    this.forcePulsePoseFacing = 1;
    this.recoilTimer = 0;
    this.recoilDirection = 0;
    this.isDying = false;
    this.deathTimer = 0;
    this.deathFragments = [];
    this.lastGroundedPlatform = findPlatformAtSurfacePoint(this.x + this.w / 2, this.y + this.h, 1) ?? platforms[1];
    this.lastGroundedPosition = { x: this.x, y: this.y };
    this.lastGroundedEdge = getClosestPlatformEdge(this.lastGroundedPlatform, this.x + this.w / 2);
    this.fallRespawnGraceTimer = 0;
    this.gravityFlipVisualTimer = 0;
    this.phaseFlickerTimer = 0;
    this.gravityFlipVisualFromSign = this.gravitySign;
    this.gravityFlipVisualToSign = this.gravitySign;
  }

  update(dt) {
    this.updateGravityFlipVisual(dt);
    if (this.isDying) {
      this.updateDeath(dt);
      return;
    }

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
    const inputSpeed = input * (this.isCrouching ? CROUCH_SPEED : (this.isRunning ? RUN_SPEED : WALK_SPEED));
    this.vx = inputSpeed;
    if (this.recoilTimer > 0) {
      const recoilProgress = clamp(this.recoilTimer / DAMAGE_RECOIL_DURATION, 0, 1);
      const controlScale = DAMAGE_RECOIL_CONTROL_SCALE + (1 - DAMAGE_RECOIL_CONTROL_SCALE) * (1 - recoilProgress);
      // Keep input responsive, but let the first impact frames read clearly even
      // when the player is holding toward the source of damage.
      this.vx = inputSpeed * controlScale + this.recoilDirection * DAMAGE_RECOIL_SPEED * recoilProgress;
      this.recoilTimer -= dt;
      if (this.recoilTimer <= 0) this.recoilDirection = 0;
    }
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
    if (this.phaseFlickerTimer > 0) this.phaseFlickerTimer = Math.max(0, this.phaseFlickerTimer - dt);
    if (this.fallRespawnGraceTimer > 0) this.fallRespawnGraceTimer -= dt;

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
    if (this.forcePulsePoseTimer > 0) this.forcePulsePoseTimer -= dt;
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
    const blockedByPlatform = getPlayerPlatformSolids().some((platform) => rectsOverlap(standRect, platform));
    const blockedByEnemy = getPlayerEnemyCollisionRects().some((enemyRect) => rectsOverlap(standRect, enemyRect));
    if (blockedByPlatform || blockedByEnemy) return;

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

  moveAndCollide(dt) {
    this.x += this.vx * dt;
    this.resolveHorizontalSolids(getPlayerPlatformSolids(), true);
    this.resolveHorizontalSolids(getPlayerEnemyCollisionRects(), true);

    this.y += this.vy * dt;
    this.onSurface = false;
    this.resolveVerticalSolids(getPlayerPlatformSolids(), true);
    this.resolveVerticalSolids(getPlayerEnemyCollisionRects(), false);

    // Moving enemies or spawn/reset positions can still create an overlap after
    // the axis passes. Nudge the player along the shallowest safe axis so
    // enemies remain solid without trapping or violently launching the player.
    this.resolveEnemyOverlaps();
  }

  resolveHorizontalSolids(solids, cancelOnHit) {
    for (const solid of solids) {
      if (!rectsOverlap(this, solid)) continue;
      if (this.vx > 0) this.x = solid.x - this.w;
      else if (this.vx < 0) this.x = solid.x + solid.w;
      else continue;
      if (cancelOnHit) this.vx = 0;
    }
  }

  resolveVerticalSolids(solids, isPlatform) {
    for (const solid of solids) {
      if (!rectsOverlap(this, solid)) continue;

      if (this.vy * this.gravitySign > 0) {
        if (this.gravitySign > 0) this.y = solid.y - this.h;
        else this.y = solid.y + solid.h;
        this.onSurface = true;
        if (isPlatform) this.recordGroundedPlatform(solid);
      } else if (this.vy < 0) {
        this.y = solid.y + solid.h;
      } else if (this.vy > 0) {
        this.y = solid.y - this.h;
      } else if (!isPlatform) {
        this.separateFromEnemyRect(solid);
      }
      this.vy = 0;
    }
  }

  recordGroundedPlatform(platform) {
    // Only real level platforms become fall-recovery anchors; enemies and other
    // transient solids deliberately never update this remembered contact.
    if (!platforms.includes(platform)) return;

    const centerX = this.x + this.w / 2;
    const movingTowardEdge = Math.abs(this.vx) > 1;
    this.lastGroundedPlatform = platform;
    this.lastGroundedPosition = { x: this.x, y: this.y };
    this.lastGroundedEdge = movingTowardEdge
      ? (this.vx > 0 ? "right" : "left")
      : getClosestPlatformEdge(platform, centerX);
  }

  resolveEnemyOverlaps() {
    for (const solid of getPlayerEnemyCollisionRects()) {
      if (rectsOverlap(this, solid)) this.separateFromEnemyRect(solid);
    }
  }

  separateFromEnemyRect(solid) {
    const depth = intersectionDepth(this, solid);
    if (depth.x <= 0 || depth.y <= 0) return;

    const favorHorizontal = depth.x <= depth.y + 4;
    if (favorHorizontal) {
      this.x += depth.signX * (depth.x + 0.1);
      this.vx = 0;
      return;
    }

    this.y += depth.signY * (depth.y + 0.1);
    if (depth.signY === -this.gravitySign) this.onSurface = true;
    this.vy = 0;
  }

  flipGravity(castId) {
    if (this.lastGravityCastId === castId) return;
    const contacts = platforms.filter((platform) => this.isTouchingVerticalSurface(platform));
    const previousGravitySign = this.gravitySign;
    super.flipGravity(castId);
    this.startGravityFlipVisual(previousGravitySign, this.gravitySign);
    this.onSurface = false;

    // Gravity flips should release the player from the current contact side, not
    // let the collision solver see a crouched overlap and eject sideways or
    // through the platform on the next frame.
    for (const platform of contacts) {
      if (Math.abs(this.y + this.h - platform.y) <= 1.5) this.y = platform.y - this.h - 0.1;
      else if (Math.abs(this.y - (platform.y + platform.h)) <= 1.5) this.y = platform.y + platform.h + 0.1;
    }
  }

  resetGravity() {
    const previousGravitySign = this.gravitySign;
    super.resetGravity();
    this.startGravityFlipVisual(previousGravitySign, this.gravitySign);
  }

  startGravityFlipVisual(fromSign, toSign) {
    if (fromSign === toSign) return;
    this.gravityFlipVisualFromSign = fromSign;
    this.gravityFlipVisualToSign = toSign;
    this.gravityFlipVisualTimer = GRAVITY_FLIP_VISUAL_DURATION;
  }

  updateGravityFlipVisual(dt) {
    if (this.gravityFlipVisualTimer <= 0) return;
    this.gravityFlipVisualTimer = Math.max(0, this.gravityFlipVisualTimer - dt);
  }


  getGravityFlipVisualTransform() {
    if (this.gravityFlipVisualTimer <= 0) return { rotation: 0, scaleX: 1 };
    const progress = 1 - clamp(this.gravityFlipVisualTimer / GRAVITY_FLIP_VISUAL_DURATION, 0, 1);
    const eased = progress * progress * (3 - 2 * progress);
    const direction = this.gravityFlipVisualToSign < this.gravityFlipVisualFromSign ? 1 : -1;
    return {
      rotation: direction * Math.PI * (1 - eased),
      // Starts inverted to counter the newly applied gravity orientation, then
      // narrows through the middle like a fast body turn before ending at rest.
      scaleX: -1 + eased * 2
    };
  }

  isTouchingVerticalSurface(platform) {
    const overlapsX = this.x + this.w > platform.x && this.x < platform.x + platform.w;
    if (!overlapsX) return false;
    return Math.abs(this.y + this.h - platform.y) <= 1.5 || Math.abs(this.y - (platform.y + platform.h)) <= 1.5;
  }

  firePulse() {
    if (this.isDying || isPlayerPhased() || this.pulseTimer > 0) return;
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

  getForwardHandPoint(direction = this.facing) {
    const modelFeetY = 50;
    const surfaceY = this.gravitySign > 0 ? this.y + this.h : this.y;
    const verticalFlip = this.gravitySign > 0 ? 1 : -1;
    const originY = this.gravitySign > 0
      ? surfaceY - modelFeetY * PLAYER_VISUAL_SCALE
      : surfaceY + modelFeetY * PLAYER_VISUAL_SCALE;
    const handLocalX = this.isCrouching ? 20.5 : 18.7;
    const handLocalY = this.isCrouching ? 32.8 : 22.8;
    const handX = this.x + this.w / 2 + direction * PLAYER_VISUAL_SCALE * handLocalX;
    const handY = originY + verticalFlip * PLAYER_VISUAL_SCALE * handLocalY;
    return {
      // Start forward abilities at the gathered hand position so effects stay
      // anchored to the player's pose instead of the torso center.
      x: handX + direction * 2,
      y: handY
    };
  }

  getPulseSpawnPoint() {
    return this.getForwardHandPoint(this.attackFacing);
  }

  getForcePulsePoseAmount() {
    if (this.forcePulsePoseTimer <= 0 || FORCE_PULSE_ARM_DURATION <= 0) return 0;

    const progress = 1 - clamp(this.forcePulsePoseTimer / FORCE_PULSE_ARM_DURATION, 0, 1);
    const pushPortion = clamp(FORCE_PULSE_ARM_PUSH_DURATION / FORCE_PULSE_ARM_DURATION, 0.01, 0.99);
    if (progress <= pushPortion) {
      const pushProgress = clamp(progress / pushPortion, 0, 1);
      return pushProgress * pushProgress * (3 - 2 * pushProgress);
    }

    const recoveryProgress = clamp((progress - pushPortion) / (1 - pushPortion), 0, 1);
    const easedRecovery = recoveryProgress * recoveryProgress * (3 - 2 * recoveryProgress);
    return 1 - easedRecovery;
  }

  getForcePulseHandPoint(direction = this.forcePulsePoseFacing) {
    const baseHand = this.getForwardHandPoint(direction);
    const poseAmount = this.forcePulsePoseFacing === direction ? this.getForcePulsePoseAmount() : 0;
    return {
      x: baseHand.x + direction * PLAYER_VISUAL_SCALE * 1.3 * poseAmount,
      y: baseHand.y
    };
  }

  startForcePulsePose(direction) {
    this.forcePulsePoseFacing = direction;
    this.forcePulsePoseTimer = FORCE_PULSE_ARM_DURATION;
  }

  takeDamage(amount, source = null) {
    if (this.isDying || this.damageTimer > 0) return false;
    this.hp -= amount;

    if (this.hp <= 0) {
      this.beginDeath(source);
      return true;
    }

    this.damageTimer = CONTACT_DAMAGE_COOLDOWN;
    this.startRecoil(source);
    return true;
  }

  startRecoil(source = null) {
    let direction = 0;
    if (source) {
      const playerCenter = this.x + this.w / 2;
      const sourceCenter = source.x + source.w / 2;
      direction = playerCenter < sourceCenter ? -1 : 1;
    }
    if (direction === 0) direction = -this.facing || -1;

    this.recoilDirection = direction;
    this.recoilTimer = DAMAGE_RECOIL_DURATION;
    this.vx = direction * DAMAGE_RECOIL_SPEED;
    // A tiny bump away from the current floor/ceiling makes the hit readable
    // without launching the player or changing left/right behavior under gravity flips.
    if (Math.abs(this.vy) < DAMAGE_RECOIL_BUMP_SPEED) this.vy = -this.gravitySign * DAMAGE_RECOIL_BUMP_SPEED;
    // Damage flinch briefly interrupts the firing pose without changing attack rules.
    this.attackTimer = 0;
    this.attackPulseQueued = false;
    this.attackReleaseTimer = 0;
  }

  beginDeath(source = null) {
    if (this.isDying) return;
    if (phaseShiftActive) forceEndPhaseShift(false);
    this.hp = 0;
    this.isDying = true;
    this.deathTimer = 0;
    this.damageTimer = CONTACT_DAMAGE_COOLDOWN;
    this.startRecoil(source);
    this.recoilTimer = 0;
    this.vx = 0;
    this.vy = 0;
    this.attackTimer = 0;
    this.attackPulseQueued = false;
    this.attackReleaseTimer = 0;
    this.deathFragments = this.createDeathFragments();
  }

  updateDeath(dt) {
    this.deathTimer += dt;
    if (this.deathTimer >= DEATH_TOTAL_DURATION) this.fullRespawn();
  }

  createDeathFragments() {
    const baseX = this.x + this.w / 2;
    const surfaceY = this.gravitySign > 0 ? this.y + this.h : this.y;
    const scale = PLAYER_VISUAL_SCALE;
    const originY = this.gravitySign > 0 ? surfaceY - 50 * scale : surfaceY + 50 * scale;
    const verticalFlip = this.gravitySign > 0 ? 1 : -1;
    const anchors = [
      { x: 0, y: 6, size: 4.8 },
      { x: 0, y: 21, size: 5.4 },
      { x: -5, y: 27, size: 3.6 },
      { x: 6, y: 27, size: 3.6 },
      { x: -4, y: 39, size: 3.8 },
      { x: 5, y: 40, size: 3.8 },
      { x: -8, y: 48, size: 2.9 },
      { x: 8, y: 48, size: 2.9 },
      { x: -9, y: 18, size: 2.7 },
      { x: 10, y: 18, size: 2.7 },
      { x: -12, y: 31, size: 2.4 },
      { x: 13, y: 31, size: 2.4 }
    ];

    return anchors.map((anchor, index) => {
      const worldX = baseX + anchor.x * scale;
      const worldY = originY + anchor.y * verticalFlip * scale;
      const angle = Math.atan2(worldY - (this.y + this.h / 2), worldX - baseX) + (index % 3 - 1) * 0.28;
      const speed = 28 + (index % 4) * 9;
      return {
        x: worldX,
        y: worldY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: anchor.size,
        rot: (index * 0.71) % Math.PI,
        spin: (index % 2 === 0 ? 1 : -1) * (1.8 + index * 0.08),
        shape: index % 3
      };
    });
  }

  fallOutOfWorld() {
    if (this.isDying || this.fallRespawnGraceTimer > 0) return;

    this.hp -= 1;
    if (this.hp <= 0) {
      this.beginDeath();
      return;
    }

    this.damageTimer = CONTACT_DAMAGE_COOLDOWN;
    this.respawnAtLastGroundedEdge();
  }

  takeSpikeDamage(spike) {
    if (this.isDying || this.fallRespawnGraceTimer > 0) return;

    const spikeBounds = spikeStripBounds(spike);
    const canTakeDamage = this.damageTimer <= 0;
    if (canTakeDamage) {
      this.takeDamage(1, spikeBounds);
      if (this.isDying) return;
    }

    // Damage invulnerability should prevent repeated HP loss, not make spikes
    // non-solid. Always eject the player so they cannot walk through a strip.
    this.recoverFromSpikeDamage(spike, spikeBounds);
  }

  recoverFromSpikeDamage(spike, spikeBounds) {
    // Spike recovery is a knockback, not a fall respawn: preserve reversed
    // gravity, but always eject from the side where the spike geometry lives.
    // This keeps gravity flips from turning spike contact into a platform warp.
    this.h = STAND_HEIGHT;
    const recoveryPoint = this.getSpikeRecoveryPoint(spike, spikeBounds);
    this.x = recoveryPoint.x;
    this.y = recoveryPoint.y;
    this.onSurface = false;
    this.vx = recoveryPoint.direction * DAMAGE_RECOIL_SPEED;
    this.vy = recoveryPoint.outwardY * DAMAGE_RECOIL_BUMP_SPEED;
    this.recoilDirection = recoveryPoint.direction;
    this.recoilTimer = DAMAGE_RECOIL_DURATION;
  }

  getSpikeRecoveryPoint(spike, spikeBounds) {
    const platform = spike.platform;
    const centerX = this.x + this.w / 2;
    const spikeCenterX = spikeBounds.x + spikeBounds.w / 2;
    const preferredDirection = centerX < spikeCenterX ? -1 : 1;
    const outwardY = spike.side === "top" ? -1 : 1;
    const y = spike.side === "top" ? platform.y - STAND_HEIGHT : platform.y + platform.h;
    const margin = 6;
    const minX = platform.x + EDGE_RESPAWN_INSET;
    const maxX = platform.x + platform.w - this.w - EDGE_RESPAWN_INSET;

    const scanDirection = (direction) => {
      const startX = direction < 0
        ? spikeBounds.x - this.w - margin
        : spikeBounds.x + spikeBounds.w + margin;

      for (let distance = 0; distance <= platform.w; distance += 6) {
        const x = clamp(startX + direction * distance, minX, maxX);
        const candidate = { x, y, w: this.w, h: STAND_HEIGHT };
        const blockedByEnemy = getSolidEnemyRects().some((enemyRect) => rectsOverlap(candidate, enemyRect));
        if (!blockedByEnemy && !rectTouchesSpikes(candidate)) return x;
        if (x === minX || x === maxX) break;
      }

      return null;
    };

    const x = scanDirection(preferredDirection)
      ?? scanDirection(-preferredDirection)
      ?? findSafePlatformEdgeX(platform, getClosestPlatformEdge(platform, centerX), this.w, STAND_HEIGHT, y);

    return { x, y, direction: preferredDirection, outwardY };
  }

  respawnAtLastGroundedEdge() {
    // Preserve the existing fall-recovery rule that clears Gravity Field effects,
    // but recover to the last solid platform edge instead of the checkpoint.
    resetGravityField(true);
    this.h = STAND_HEIGHT;
    const respawnPoint = this.getLastGroundedRespawnPoint();
    this.placeAt(respawnPoint.x, respawnPoint.y, { resetGravity: false, grounded: true });
    this.recordGroundedPlatform(respawnPoint.platform);
    this.fallRespawnGraceTimer = FALL_RESPAWN_GRACE;
  }

  getLastGroundedRespawnPoint() {
    const platform = this.lastGroundedPlatform ?? findPlatformAtSurfacePoint(safeAnchor.x + this.w / 2, safeAnchor.y + this.h, 1) ?? platforms[1];
    const edge = this.lastGroundedEdge ?? getClosestPlatformEdge(platform, this.lastGroundedPosition?.x + this.w / 2 || platform.x + platform.w / 2);
    const gravitySign = this.gravitySign;
    const y = gravitySign > 0 ? platform.y - STAND_HEIGHT : platform.y + platform.h;
    const x = findSafePlatformEdgeX(platform, edge, this.w, STAND_HEIGHT, y);
    return { x, y, platform };
  }

  respawnAtSafeAnchor() {
    resetGravityField(true);
    this.placeAt(safeAnchor.x, safeAnchor.y);
  }

  fullRespawn() {
    resetGravityField(true);
    if (phaseShiftActive) forceEndPhaseShift(false);
    this.hp = this.maxHp;
    this.damageTimer = 0;
    this.placeAt(checkpoint.x, checkpoint.y);
  }

  placeAt(x, y, options = {}) {
    const { resetGravity = true, grounded = false } = options;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    if (resetGravity) this.gravitySign = 1;
    this.lastGravityCastId = 0;
    this.gravityFlipVisualTimer = 0;
    this.phaseFlickerTimer = 0;
    this.gravityFlipVisualFromSign = this.gravitySign;
    this.gravityFlipVisualToSign = this.gravitySign;
    this.isCrouching = false;
    this.h = STAND_HEIGHT;
    this.fallPoseBlend = 0;
    this.landTimer = 0;
    this.airTime = 0;
    this.attackTimer = 0;
    this.attackPulseQueued = false;
    this.attackReleaseTimer = 0;
    this.phaseFlickerTimer = 0;
    this.recoilTimer = 0;
    this.recoilDirection = 0;
    this.isDying = false;
    this.deathTimer = 0;
    this.deathFragments = [];
    this.onSurface = grounded;
  }


  drawDeath() {
    const flashEnd = DEATH_FLASH_DURATION;
    const destabilizeEnd = flashEnd + DEATH_DESTABILIZE_DURATION;
    const fragmentEnd = destabilizeEnd + DEATH_FRAGMENT_DURATION;
    const progress = clamp(this.deathTimer / DEATH_TOTAL_DURATION, 0, 1);
    const baseX = this.x + this.w / 2;
    const surfaceY = this.gravitySign > 0 ? this.y + this.h : this.y;
    const verticalFlip = this.gravitySign > 0 ? 1 : -1;
    const scale = PLAYER_VISUAL_SCALE;
    const originY = this.gravitySign > 0 ? surfaceY - 50 * scale : surfaceY + 50 * scale;

    ctx.save();
    ctx.shadowColor = "rgba(174, 244, 255, 0.78)";
    ctx.shadowBlur = 14;

    if (this.deathTimer < destabilizeEnd) {
      const flashAlpha = this.deathTimer < flashEnd ? 1 : 0.86;
      const jitter = this.deathTimer < flashEnd
        ? 0
        : Math.sin(this.deathTimer * 95) * 1.7;
      const glitch = this.deathTimer < flashEnd
        ? 0
        : Math.sin(this.deathTimer * 131) * 0.75;

      ctx.translate(baseX + jitter, originY + glitch * verticalFlip);
      ctx.scale(this.facing * scale, verticalFlip * scale);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalAlpha = flashAlpha;
      ctx.strokeStyle = "rgba(175, 237, 255, 0.95)";
      ctx.fillStyle = "rgba(255, 255, 255, 0.98)";
      ctx.lineWidth = 1.45;

      ctx.beginPath();
      ctx.ellipse(0, 23, 5.8 + Math.abs(glitch) * 0.35, 12.4, jitter * 0.012, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(glitch * 0.35, 6, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.lineWidth = 2.6;
      const limbs = [
        [{ x: -2, y: 30 }, { x: -5.5 + glitch, y: 40 }, { x: -7, y: 50 }],
        [{ x: 2, y: 30 }, { x: 5.5 - glitch, y: 40 }, { x: 7, y: 50 }],
        [{ x: -4.95, y: 17.4 }, { x: -9 - glitch, y: 24.4 }, { x: -12, y: 32 }],
        [{ x: 2.95, y: 17.4 }, { x: 9 + glitch, y: 24.4 }, { x: 12, y: 32 }]
      ];
      for (const limb of limbs) {
        ctx.beginPath();
        ctx.moveTo(limb[0].x, limb[0].y);
        ctx.lineTo(limb[1].x, limb[1].y);
        ctx.lineTo(limb[2].x, limb[2].y);
        ctx.stroke();
      }

      ctx.globalAlpha = 0.38 + progress * 0.24;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
      ctx.lineWidth = 0.9;
      for (let i = -1; i <= 1; i += 1) {
        ctx.beginPath();
        ctx.moveTo(-13, 15 + i * 11 + glitch);
        ctx.lineTo(13, 15 + i * 11 - glitch);
        ctx.stroke();
      }
    } else {
      const fragmentProgress = clamp((this.deathTimer - destabilizeEnd) / (fragmentEnd - destabilizeEnd), 0, 1);
      const fadeProgress = this.deathTimer > fragmentEnd
        ? clamp((this.deathTimer - fragmentEnd) / DEATH_FADE_DURATION, 0, 1)
        : 0;
      const alpha = 1 - fadeProgress;
      ctx.globalAlpha = alpha;

      for (const fragment of this.deathFragments) {
        const travel = Math.sin(fragmentProgress * Math.PI * 0.5);
        const x = fragment.x + fragment.vx * travel * 0.42;
        const y = fragment.y + fragment.vy * travel * 0.42;
        const size = fragment.size * (1 - fadeProgress * 0.28);

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(fragment.rot + fragment.spin * fragmentProgress);
        ctx.fillStyle = fragment.shape === 0 ? "rgba(255, 255, 255, 0.96)" : "rgba(174, 244, 255, 0.9)";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.84)";
        ctx.lineWidth = 0.8;
        if (fragment.shape === 0) {
          ctx.fillRect(-size * 0.5, -size * 0.35, size, size * 0.7);
          ctx.strokeRect(-size * 0.5, -size * 0.35, size, size * 0.7);
        } else if (fragment.shape === 1) {
          ctx.beginPath();
          ctx.moveTo(0, -size * 0.72);
          ctx.lineTo(size * 0.72, size * 0.58);
          ctx.lineTo(-size * 0.62, size * 0.42);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(-size, 0);
          ctx.lineTo(size, 0);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    ctx.restore();
  }

  draw() {
    if (this.isDying) {
      this.drawDeath();
      return;
    }

    let outline = "#4ea2f2";
    let fill = "rgba(255, 255, 255, 0.96)";
    let glow = "rgba(82, 166, 240, 0.34)";
    const facing = this.attackTimer > 0 ? this.attackFacing : (this.forcePulsePoseTimer > 0 ? this.forcePulsePoseFacing : this.facing);
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
    // Shared upper-back shoulder anchor used by every visible player-arm pose
    // so attacks, movement, landings, and recoil do not pop between states.
    const armAttachmentBackShift = 2.45;
    const shoulderBaseY = 16.4;
    const crouchShoulderY = 25.8;
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
    const phased = isPlayerPhased();
    const phaseSnap = clamp(this.phaseFlickerTimer / PHASE_SHIFT_FLICKER_DURATION, 0, 1);
    const phaseEdgePulse = 0.5 + 0.5 * Math.sin(this.animTime * 18);
    if (phased) {
      // Phase Shift removes the character interior entirely; keep only a
      // readable spectral outline so the active state feels hollow.
      outline = "rgba(5, 37, 105, 0.96)";
      glow = "rgba(5, 30, 92, 0.38)";
      ctx.globalAlpha *= 0.62 + phaseEdgePulse * 0.08;
    } else if (phaseSnap > 0) ctx.globalAlpha *= 0.82 + phaseEdgePulse * 0.06;
    ctx.translate(baseX, originY);
    ctx.scale(facing * visualScale, verticalFlip * scaleY);
    const gravityFlipVisual = this.getGravityFlipVisualTransform();
    if (gravityFlipVisual.rotation !== 0 || gravityFlipVisual.scaleX !== 1) {
      // Rotate only the rendered character around its body center; the collision
      // rectangle and gravity response have already changed immediately. The
      // horizontal compensation prevents a left/right facing reversal at either
      // end of the vertical flip.
      ctx.translate(0, modelFeetY * 0.5);
      ctx.rotate(gravityFlipVisual.rotation);
      ctx.scale(gravityFlipVisual.scaleX, 1);
      ctx.translate(0, -modelFeetY * 0.5);
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = phased ? "rgba(5, 37, 105, 0.5)" : glow;
    ctx.shadowBlur = phased ? 12 : 10;

    if (!phased && phaseSnap > 0) {
      const snapBoost = phaseSnap * phaseSnap;
      ctx.save();
      ctx.globalAlpha *= 0.18 + snapBoost * 0.18;
      ctx.strokeStyle = "rgba(190, 248, 255, 0.86)";
      ctx.lineWidth = 0.9;
      // Three calm scanline fragments suggest desynchronization without noise.
      for (let i = 0; i < 3; i += 1) {
        const y = 11 + i * 13 + Math.sin(this.animTime * 8 + i) * 0.45;
        const offset = (i % 2 === 0 ? 1 : -1) * (1.1 + snapBoost * 1.7);
        ctx.beginPath();
        ctx.moveTo(-7.5 + offset, y);
        ctx.lineTo(7.5 + offset * 0.45, y + (i % 2 === 0 ? 0.45 : -0.45));
        ctx.stroke();
      }
      ctx.restore();
    }

    function strokeLimb(points, fillWidth) {
      function drawHollowPhaseLimb() {
        const outerRadius = fillWidth * 0.5 + characterOutlineWidth;
        const edgeWidth = characterOutlineWidth * 0.82;

        function segmentNormal(from, to) {
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const length = Math.hypot(dx, dy) || 1;
          return { x: -dy / length, y: dx / length };
        }

        function offsetPoint(index, side) {
          const previous = points[Math.max(0, index - 1)];
          const point = points[index];
          const next = points[Math.min(points.length - 1, index + 1)];
          const before = index > 0 ? segmentNormal(previous, point) : null;
          const after = index < points.length - 1 ? segmentNormal(point, next) : null;
          const normal = before && after
            ? { x: before.x + after.x, y: before.y + after.y }
            : (before ?? after);
          const normalLength = Math.hypot(normal.x, normal.y) || 1;
          const unit = { x: normal.x / normalLength, y: normal.y / normalLength };
          const reference = after ?? before;
          const alignment = Math.max(0.38, Math.abs(unit.x * reference.x + unit.y * reference.y));
          const distance = Math.min(outerRadius / alignment, outerRadius * 1.65);
          return { x: point.x + unit.x * distance * side, y: point.y + unit.y * distance * side };
        }

        const outerA = points.map((_, index) => offsetPoint(index, 1));
        const outerB = points.map((_, index) => offsetPoint(index, -1));

        ctx.strokeStyle = outline;
        ctx.lineWidth = edgeWidth;
        ctx.beginPath();
        ctx.moveTo(outerA[0].x, outerA[0].y);
        for (let i = 1; i < outerA.length; i += 1) ctx.lineTo(outerA[i].x, outerA[i].y);
        ctx.moveTo(outerB[0].x, outerB[0].y);
        for (let i = 1; i < outerB.length; i += 1) ctx.lineTo(outerB[i].x, outerB[i].y);

        // Round end caps complete the limb outline without painting its center.
        for (const point of [points[0], points[points.length - 1]]) {
          ctx.moveTo(point.x + outerRadius, point.y);
          ctx.arc(point.x, point.y, outerRadius, 0, Math.PI * 2);
        }
        ctx.stroke();
      }

      if (phased) {
        drawHollowPhaseLimb();
        return;
      }

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
      if (!phased) ctx.fill();
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
      const shoulder = { x: 2.8 - armAttachmentBackShift + depthOffset, y: shoulderBaseY + shoulderOffsetY };
      const hand = { x: shoulder.x + 1.8 + swing * 6.4, y: 32.6 + shoulderOffsetY };
      // Bend walking elbows back in player-local space so the arm hinge points
      // away from the stride direction during the walk cycle.
      const elbow = { x: mix(shoulder.x, hand.x, 0.46) - 1.7, y: 24.7 + shoulderOffsetY };
      return [shoulder, elbow, hand];
    }

    function restingArm(side, breathe) {
      return [
        { x: 2.8 - armAttachmentBackShift + side * 1.2, y: shoulderBaseY + breathe },
        { x: 2.4 + side * 3.6, y: 27 + breathe * 0.4 },
        { x: 2 + side * 2.6, y: 36 }
      ];
    }

    function idleFrontArm(breathe) {
      const shoulder = { x: 2.8 - armAttachmentBackShift + 0.85, y: shoulderBaseY + breathe };
      return [
        shoulder,
        { x: shoulder.x - 2.2, y: 27 + breathe * 0.4 },
        { x: shoulder.x - 0.75, y: 36 }
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
      const shoulderY = mix(shoulderBaseY, crouchShoulderY + bodyY, lower);
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
        const crouchArmCenterX = torsoCenter.x - 0.45;
        const shoulder = {
          x: mix(2.8 - armAttachmentBackShift + side * 1.2, crouchArmCenterX + side * 0.5, lower),
          y: shoulderY
        };
        // Local +X is always the player's facing direction after mirroring.
        // Keep crouched upper arms tucked closer to the torso center while the
        // forearms can still reach forward for balance.
        const elbow = {
          x: mix(2.4 + side * 3.6, crouchArmCenterX + side * 0.35 + elbowShift, lower),
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
        const shoulder = { x: 3.4 - armAttachmentBackShift + shoulderLeanX + depthOffset, y: shoulderBaseY + bodyY };

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
          { x: 1.4 - armAttachmentBackShift, y: shoulderBaseY },
          { x: 1.6, y: 22.1 },
          { x: 2.2, y: 27.2 }
        ],
        nearArm: [
          { x: 3.8 - armAttachmentBackShift, y: shoulderBaseY },
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
          { x: 1.2 - armAttachmentBackShift, y: shoulderBaseY + fallSettle },
          { x: -5.8, y: 16.2 + fallSettle * 0.55 },
          { x: -9.4, y: 22.6 + fallSettle * 0.35 }
        ],
        nearArm: [
          { x: 3.8 - armAttachmentBackShift, y: shoulderBaseY + fallSettle },
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
        // Keep the idle front arm fully visible, but bend it inward toward the
        // body so the standing-only pose no longer looks reversed.
        nearArm: idleFrontArm(breathe),
        // Cross the idle stance depth: the back leg now rests slightly
        // forward while the front leg sits slightly back.
        farLeg: restingLeg(1),
        nearLeg: restingLeg(-1)
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

    if (this.recoilTimer > 0) {
      const flinch = clamp(this.recoilTimer / DAMAGE_RECOIL_DURATION, 0, 1);
      const snap = Math.sin(flinch * Math.PI * 0.5);
      const localRecoil = this.recoilDirection * facing;
      const lean = localRecoil * 0.24 * snap;
      const brace = grounded ? snap : snap * 0.65;
      const chest = { x: pose.torso.x + localRecoil * 1.6, y: pose.torso.y + 3.5 };

      pose.torso = {
        ...pose.torso,
        x: pose.torso.x + localRecoil * 3.2 * snap,
        y: pose.torso.y + 0.5 * snap,
        rot: pose.torso.rot + lean
      };
      pose.head = {
        ...pose.head,
        x: pose.head.x + localRecoil * 4.0 * snap,
        y: pose.head.y + 1.0 * snap
      };

      function flinchArm(arm, side) {
        if (!arm) return arm;
        return arm.map((point, index) => {
          if (index === 0) return { x: point.x + localRecoil * 1.7 * snap, y: point.y + 0.8 * snap };
          const pull = index === 1 ? 0.36 : 0.52;
          const inward = {
            x: mix(point.x, chest.x + side * 1.1, pull * snap),
            y: mix(point.y, chest.y + index * 2.1, pull * snap)
          };
          return {
            x: inward.x + localRecoil * (index === 1 ? 0.4 : 0.9) * snap,
            y: inward.y + (index === 1 ? 0.25 : -0.35) * snap
          };
        });
      }

      function flinchLeg(leg, side) {
        return leg.map((point, index) => {
          if (index === 0) return { x: point.x + localRecoil * 0.85 * brace, y: point.y + 0.5 * brace };
          if (index === 1) return { x: point.x - localRecoil * side * 1.45 * brace, y: point.y + 1.5 * brace };
          if (grounded) return { x: point.x - localRecoil * side * 0.45 * brace, y: modelFeetY };
          return { x: point.x - localRecoil * 0.9 * brace, y: point.y + 0.6 * brace };
        });
      }

      pose.farArm = flinchArm(pose.farArm, -1);
      pose.nearArm = flinchArm(pose.nearArm, 1);
      pose.farLeg = flinchLeg(pose.farLeg, -1);
      pose.nearLeg = flinchLeg(pose.nearLeg, 1);
    }

    if (this.forcePulsePoseTimer > 0 && this.attackTimer <= 0) {
      const pushAmount = this.getForcePulsePoseAmount();
      const baseFarArm = pose.farArm ?? restingArm(1, 0);
      const baseNearArm = pose.nearArm ?? restingArm(-1, 0);
      const crouchTightness = this.isCrouching ? 1 : 0;
      const chestX = pose.torso.x + Math.cos(pose.torso.rot) * mix(7.8, 6.2, crouchTightness);
      const chestY = pose.torso.y - mix(1.5, 0.7, crouchTightness);
      const handSocketX = mix(18.7, 20.5, crouchTightness);
      const handSocketY = mix(22.8, 32.8, crouchTightness);
      const reachX = handSocketX - 1.2 + pushAmount * 1.1;
      const handY = handSocketY + 0.4;
      const elbowX = mix(chestX + 5.6, reachX - 6.2, 0.45) + pushAmount * 0.8;
      pose.torso = { ...pose.torso, rot: pose.torso.rot + pushAmount * 0.035 };
      pose.farArm = blendLimb(baseFarArm, [baseFarArm[0], { x: elbowX - 1.8, y: handY + 3.4 }, { x: reachX - 0.6, y: handY + 1.2 }], 0.88);
      pose.nearArm = blendLimb(baseNearArm, [baseNearArm[0], { x: elbowX + 1.2, y: handY + 4.1 }, { x: reachX + 1.2, y: handY - 0.4 }], 0.94);
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

    function drawPhaseGhostSilhouette(offsetX, color, alpha) {
      ctx.save();
      ctx.translate(offsetX, 0);
      ctx.globalAlpha *= alpha;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 5;

      function ghostLimb(points, width) {
        if (!points) return;
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
        ctx.stroke();
      }

      function ghostTorso(torso) {
        const sideHalf = Math.max(torso.ry - torso.rx, torso.ry * 0.42);
        ctx.save();
        ctx.translate(torso.x, torso.y);
        ctx.rotate(torso.rot);
        ctx.beginPath();
        ctx.moveTo(-torso.rx, -sideHalf);
        ctx.lineTo(-torso.rx, sideHalf);
        ctx.quadraticCurveTo(-torso.rx, torso.ry, 0, torso.ry);
        ctx.quadraticCurveTo(torso.rx, torso.ry, torso.rx, sideHalf);
        ctx.lineTo(torso.rx, -sideHalf);
        ctx.quadraticCurveTo(torso.rx, -torso.ry, 0, -torso.ry);
        ctx.quadraticCurveTo(-torso.rx, -torso.ry, -torso.rx, -sideHalf);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      ghostLimb(pose.farLeg, 2.8);
      ghostLimb(pose.farArm, 2.4);
      ghostTorso(pose.torso);
      ghostLimb(pose.nearLeg, 3.2);
      ghostLimb(pose.nearArm, 2.7);
      ctx.beginPath();
      ctx.arc(pose.head.x, pose.head.y, pose.head.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (!phased && phaseSnap > 0) {
      const snapBoost = phaseSnap * phaseSnap;
      const pulseOffset = Math.sin(this.animTime * 10) * 0.35;
      const cyanOffset = 2.4 + pulseOffset + snapBoost * 2.2;
      const violetOffset = -2.1 + pulseOffset * 0.5 - snapBoost * 1.7;
      drawPhaseGhostSilhouette(cyanOffset, "rgba(169, 244, 255, 0.92)", 0.22 * snapBoost);
      drawPhaseGhostSilhouette(violetOffset, "rgba(137, 111, 255, 0.88)", 0.18 * snapBoost);
    }

    strokeLimb(pose.farLeg, 2.8);
    if (pose.farArm) strokeLimb(pose.farArm, 2.4);
    drawTorso(pose.torso.x, pose.torso.y, pose.torso.rx, pose.torso.ry, pose.torso.rot);
    strokeLimb(pose.nearLeg, 3.2);
    if (!phased && attackChargePoint && attackChargePoint.strength > 0.04) {
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
      }
      ctx.restore();
    }
    if (pose.nearArm) strokeLimb(pose.nearArm, 2.7);

    ctx.fillStyle = fill;
    ctx.strokeStyle = outline;
    ctx.lineWidth = characterOutlineWidth;
    ctx.beginPath();
    ctx.arc(pose.head.x, pose.head.y, pose.head.r, 0, Math.PI * 2);
    if (!phased) ctx.fill();
    ctx.stroke();

    if (!phased && phaseSnap > 0) {
      ctx.save();
      const snapBoost = phaseSnap * phaseSnap;
      ctx.globalAlpha *= snapBoost * 0.28;
      ctx.strokeStyle = "rgba(202, 251, 255, 0.78)";
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(-6.7 + snapBoost * 1.2, pose.head.y - pose.head.r * 0.4);
      ctx.lineTo(-4.8 + snapBoost * 1.2, pose.torso.y + pose.torso.ry * 0.9);
      ctx.moveTo(6.4 - snapBoost, pose.head.y - pose.head.r * 0.2);
      ctx.lineTo(4.9 - snapBoost, pose.torso.y + pose.torso.ry);
      ctx.stroke();

      ctx.fillStyle = "rgba(190, 248, 255, 0.82)";
      const fragments = [
        { y: 9.5, w: 7.4, h: 1.1, dx: 2.4 + snapBoost * 1.8 },
        { y: 22.5, w: 9.2, h: 1.25, dx: -1.4 - snapBoost * 1.1 },
        { y: 35.5, w: 8.0, h: 1.1, dx: 1.5 + snapBoost * 0.8 }
      ];
      for (const fragment of fragments) {
        const drift = Math.sin(this.animTime * 7 + fragment.y) * 0.35;
        ctx.fillRect(fragment.dx + drift, fragment.y, fragment.w, fragment.h);
      }
      ctx.restore();
    }

    ctx.shadowBlur = 0;

    ctx.restore();
    drawGravityMarker(this);
  }
}

class Enemy extends Entity {
  constructor(x, y) {
    super(x, y, WALKER_WIDTH, WALKER_HEIGHT);
    this.hp = 2;
    this.speed = 86;
    this.direction = -1;
    this.reverseCooldown = 0;
    this.walkerState = "recovering";
    this.landingRecoveryTimer = 0.1;
    this.groundedPlatform = null;
    this.idleTimer = 0;
    this.hitTimer = 0;
    this.hitJoltX = 0;
    this.hitJoltY = 0;
    this.isDying = false;
    this.deathTimer = 0;
    this.deathFragments = [];
  }

  update(dt) {
    if (this.isDying) {
      this.updateDeath(dt);
      return;
    }
    if (this.hp <= 0) return;

    const timeScale = getTimeSlowScaleForTarget(this);
    const simDt = dt * timeScale;

    if (this.updateAnchorHold(simDt)) return;

    this.idleTimer += simDt;
    this.updateGravityFlipVisual(simDt);
    this.updateHitReaction(simDt);
    this.reverseCooldown = Math.max(0, this.reverseCooldown - simDt);

    this.updateVerticalEdgeKillTimer(simDt);

    if (enemyShouldDieOnVerticalWorldEdge(this) || this.isOutsideVerticalWorldBounds()) {
      this.beginDeath();
      return;
    }

    if (this.forcePulseStunTimer > 0) {
      this.updateForcePulseStun(simDt);
      this.updateAirbornePhysics(simDt);
    } else if (this.walkerState === "patrolling" || this.walkerState === "recovering") {
      this.updateGroundedPatrol(simDt);
    } else {
      this.updateAirbornePhysics(simDt);
    }

    if (!this.isDying && (enemyShouldDieOnVerticalWorldEdge(this) || this.isOutsideVerticalWorldBounds())) this.beginDeath();
  }

  updateHitReaction(dt) {
    if (this.hitTimer <= 0) {
      this.hitJoltX = 0;
      this.hitJoltY = 0;
      return;
    }

    this.hitTimer = Math.max(0, this.hitTimer - dt);
    const progress = this.hitTimer / 0.12;
    this.hitJoltX = (player.facing || 1) * 2.2 * progress;
    this.hitJoltY = -this.gravitySign * 1.8 * progress;
  }

  isTouchingVerticalWorldEdge() {
    return enemyTouchesVerticalWorldEdge(this);
  }

  isOutsideVerticalWorldBounds() {
    const body = this.getCollisionRect();
    // Match the player fall envelope so Walkers shatter instead of persisting
    // forever once gravity or a platform gap pushes them off the playable area.
    return body.y + body.h >= bottomFallBoundary || body.y <= -120;
  }

  updateGroundedPatrol(dt) {
    const platform = this.getDirectSurfacePlatformAt(this.x + this.w / 2);
    if (!platform) {
      this.enterAirborneState();
      return;
    }

    this.groundedPlatform = platform;
    this.onSurface = true;
    this.attachToPatrolSurface(platform);

    if (this.walkerState === "recovering") {
      this.vx = 0;
      this.landingRecoveryTimer = Math.max(0, this.landingRecoveryTimer - dt);
      if (this.landingRecoveryTimer <= 0) this.walkerState = "patrolling";
      return;
    }

    const shouldReverse = this.reverseCooldown <= 0
      && (this.hasWallAhead() || !this.hasGroundAhead());
    if (shouldReverse) this.reverseDirection();

    this.vx = this.speed * this.direction;
    this.x += this.vx * dt;

    const hitWall = this.resolvePlatformWallContacts();
    const hitEnemy = this.resolveHorizontalEnemyContacts();
    if ((hitWall || hitEnemy) && this.reverseCooldown <= 0) this.reverseDirection();

    const currentPlatform = this.getDirectSurfacePlatformAt(this.x + this.w / 2);
    if (currentPlatform) {
      this.groundedPlatform = currentPlatform;
      this.attachToPatrolSurface(currentPlatform);
    } else {
      this.enterAirborneState();
    }
  }

  updateAirbornePhysics(dt) {
    // While falling or gravity-flipped, Walker edge checks are fully suspended;
    // only velocity and collision physics can produce a new patrol surface.
    this.groundedPlatform = null;
    this.onSurface = false;
    this.applyGravity(dt);
    this.moveAndCollide(dt);

    if (!this.onSurface) return;

    const landingPlatform = this.getDirectSurfacePlatformAt(this.x + this.w / 2);
    if (landingPlatform) this.beginLandingRecovery(landingPlatform);
    else this.enterAirborneState();
  }

  getCollisionRect() {
    // Keep the solid body close to the visible core so the enemy blocks the
    // player without invisible oversized edges or hover-animation range.
    return { x: this.x + 2, y: this.y + 3, w: this.w - 4, h: this.h - 6 };
  }

  getHoverGap() {
    // The visual plates extend slightly past the collision body, so keep the
    // anchored body high enough that the lowest bob frame still shows air.
    return 10;
  }

  getGroundContactRange() {
    // The Walker hovers above its patrol surface, so direct support means only
    // that controlled hover gap plus collision-rect inset is present.
    return this.getHoverGap() + 4;
  }

  getEdgeProbeRange() {
    // Edge detection is only a short support check ahead of a grounded Walker;
    // it decides whether to turn and never becomes a platform target.
    return this.getGroundContactRange() + 2;
  }

  getGroundProbeX() {
    const body = this.getCollisionRect();
    const leadingEdge = this.direction > 0 ? body.x + body.w : body.x;
    return leadingEdge + this.direction * 5;
  }

  getSurfacePlatformAt(probeX = this.x + this.w / 2, maxDistance = this.getGroundContactRange()) {
    const body = this.getCollisionRect();
    const surfaceEdgeY = this.gravitySign > 0 ? body.y + body.h : body.y;
    let bestPlatform = null;
    let bestDistance = Infinity;

    for (const platform of platforms) {
      if (probeX < platform.x || probeX > platform.x + platform.w) continue;

      const surfaceY = this.gravitySign > 0 ? platform.y : platform.y + platform.h;
      const distanceToSurface = (surfaceY - surfaceEdgeY) * this.gravitySign;
      if (distanceToSurface < -0.5 || distanceToSurface > maxDistance) continue;

      if (distanceToSurface < bestDistance) {
        bestPlatform = platform;
        bestDistance = distanceToSurface;
      }
    }

    return bestPlatform;
  }

  getDirectSurfacePlatformAt(probeX = this.x + this.w / 2) {
    return this.getSurfacePlatformAt(probeX, this.getGroundContactRange());
  }

  hasGroundAhead() {
    const probeX = this.getGroundProbeX();
    const platform = this.getSurfacePlatformAt(probeX, this.getEdgeProbeRange());
    return Boolean(platform) && !hasSpikesAtSurface(platform, probeX, this.gravitySign, this.w * 0.45);
  }

  hasWallAhead() {
    const body = this.getCollisionRect();
    if (this.direction < 0 && body.x <= ENEMY_VERTICAL_EDGE_KILL_TOLERANCE) return true;
    if (this.direction > 0 && body.x + body.w >= ROOM_WIDTH - ENEMY_VERTICAL_EDGE_KILL_TOLERANCE) return true;
    const wallProbe = {
      x: this.direction > 0 ? body.x + body.w : body.x - 3,
      y: body.y + 4,
      w: 3,
      h: Math.max(4, body.h - 8)
    };

    return platforms.some((platform) => rectsOverlap(wallProbe, platform));
  }

  reverseDirection() {
    this.direction *= -1;
    this.vx = 0;
    this.reverseCooldown = 0.1;
  }

  resolvePlatformWallContacts() {
    let hitWall = false;
    const oldX = this.x;

    for (const platform of platforms) {
      if (!rectsOverlap(this.getCollisionRect(), platform)) continue;

      const body = this.getCollisionRect();
      if (this.vx > 0) this.x = platform.x - body.w - 2;
      else if (this.vx < 0) this.x = platform.x + platform.w - 2;
      else continue;

      hitWall = true;
      this.vx = 0;
    }

    hitWall = this.resolveWorldHorizontalBounds() || hitWall;
    return hitWall && this.x !== oldX;
  }

  attachToPatrolSurface(platform) {
    const hoverGap = this.getHoverGap();
    this.y = this.gravitySign > 0
      ? platform.y - this.h - hoverGap
      : platform.y + platform.h + hoverGap;
    this.vy = 0;
  }

  beginLandingRecovery(platform) {
    this.walkerState = "recovering";
    this.landingRecoveryTimer = 0.1;
    this.reverseCooldown = Math.max(this.reverseCooldown, 0.1);
    this.groundedPlatform = platform;
    this.onSurface = true;
    this.vx = 0;
    this.attachToPatrolSurface(platform);
  }

  enterAirborneState(state = "airborne") {
    this.walkerState = state;
    this.landingRecoveryTimer = 0;
    this.groundedPlatform = null;
    this.onSurface = false;
  }

  receiveForcePulse(direction, speed, stunDuration, castId) {
    if (!super.receiveForcePulse(direction, speed, stunDuration, castId)) return false;
    this.enterAirborneState("force-pulsed");
    this.reverseCooldown = Math.max(this.reverseCooldown, stunDuration + 0.08);
    return true;
  }

  flipGravity(castId) {
    if (this.lastGravityCastId === castId) return;
    const previousGravitySign = this.gravitySign;
    super.flipGravity(castId);
    this.startGravityFlipVisual(previousGravitySign, this.gravitySign);
    this.enterAirborneState("gravity-flipped");
  }

  resetGravity() {
    const previousGravitySign = this.gravitySign;
    super.resetGravity();
    this.startGravityFlipVisual(previousGravitySign, this.gravitySign);
    this.enterAirborneState();
    this.reverseCooldown = 0;

    const platform = this.getDirectSurfacePlatformAt(this.x + this.w / 2);
    if (platform) this.beginLandingRecovery(platform);
  }

  getDamageRect() {
    return this.getCollisionRect();
  }

  hit(amount, impact = null) {
    if (this.isDying || this.hp <= 0) return;
    if (impact?.armsVerticalEdgeKill) this.armVerticalEdgeKill();
    this.hp -= amount;
    this.hitTimer = 0.12;
    this.hitJoltX = (player.facing || 1) * 2.2;
    this.hitJoltY = -this.gravitySign * 1.8;
    if (this.hp <= 0) this.beginDeath();
  }

  beginDeath() {
    if (this.isDying) return;
    this.hp = 0;
    this.isDying = true;
    this.deathTimer = 0;
    this.vx = 0;
    this.vy = 0;
    this.hitTimer = 0;
    this.hitJoltX = 0;
    this.hitJoltY = 0;
    this.walkerState = "destroyed";
    this.deathFragments = this.createDeathFragments();
    activeGravityEntities.delete(this);
  }

  updateDeath(dt) {
    this.deathTimer += dt;
    if (this.deathTimer >= ENEMY_DEATH_TOTAL_DURATION) {
      this.isDying = false;
      this.deathFragments = [];
    }
  }

  createDeathFragments() {
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;
    const anchors = [
      { x: -16, y: 13, size: 4.2, shape: 0 },
      { x: 16, y: 13, size: 4.2, shape: 0 },
      { x: -7, y: -14, size: 3.3, shape: 1 },
      { x: 7, y: -14, size: 3.3, shape: 1 },
      { x: 0, y: -6, size: 3.9, shape: 1 },
      { x: 0, y: 7, size: 4.5, shape: 1 },
      { x: -6, y: 0, size: 2.7, shape: 2 },
      { x: 6, y: 0, size: 2.7, shape: 2 }
    ];

    return anchors.map((anchor, index) => {
      const worldX = cx + anchor.x;
      const worldY = cy + anchor.y * this.gravitySign;
      const angle = Math.atan2(worldY - cy, worldX - cx) + (index % 3 - 1) * 0.18;
      const speed = 18 + (index % 4) * 5;
      return {
        x: worldX,
        y: worldY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: anchor.size,
        rot: (index * 0.62) % Math.PI,
        spin: (index % 2 === 0 ? 1 : -1) * (1.2 + index * 0.06),
        shape: anchor.shape
      };
    });
  }

  drawDeath() {
    const flashEnd = ENEMY_DEATH_FLASH_DURATION;
    const destabilizeEnd = flashEnd + ENEMY_DEATH_DESTABILIZE_DURATION;
    const fragmentEnd = destabilizeEnd + ENEMY_DEATH_FRAGMENT_DURATION;
    const progress = clamp(this.deathTimer / ENEMY_DEATH_TOTAL_DURATION, 0, 1);
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;

    ctx.save();
    ctx.shadowColor = "rgba(174, 244, 255, 0.5)";
    ctx.shadowBlur = 8;

    if (this.deathTimer < destabilizeEnd) {
      const flashAlpha = this.deathTimer < flashEnd ? 0.92 : 0.72;
      const jitter = this.deathTimer < flashEnd
        ? 0
        : Math.sin(this.deathTimer * 86) * 0.85;
      const glitch = this.deathTimer < flashEnd
        ? 0
        : Math.sin(this.deathTimer * 119) * 0.45;

      ctx.translate(cx + jitter, cy + glitch);
      ctx.scale(1, this.gravitySign > 0 ? 1 : -1);
      ctx.lineJoin = "miter";
      ctx.lineCap = "butt";
      ctx.globalAlpha = flashAlpha;
      ctx.strokeStyle = "rgba(175, 237, 255, 0.88)";
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.lineWidth = 1.15;

      const shards = [
        [{ x: -20, y: 17 }, { x: -12, y: 16 }, { x: -5, y: -16 }, { x: -8, y: -18 }],
        [{ x: 20, y: 17 }, { x: 12, y: 16 }, { x: 5, y: -16 }, { x: 8, y: -18 }],
        [{ x: 0, y: -14 }, { x: 8, y: 0 }, { x: 0, y: 16 }, { x: -8, y: 0 }]
      ];

      for (const shard of shards) {
        ctx.beginPath();
        ctx.moveTo(shard[0].x + glitch * 0.35, shard[0].y);
        for (let i = 1; i < shard.length; i += 1) ctx.lineTo(shard[i].x - glitch * 0.25, shard[i].y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      ctx.globalAlpha = 0.24 + progress * 0.18;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.78)";
      ctx.lineWidth = 0.75;
      for (let i = -1; i <= 1; i += 1) {
        ctx.beginPath();
        ctx.moveTo(-11, i * 7 + glitch);
        ctx.lineTo(11, i * 7 - glitch);
        ctx.stroke();
      }
    } else {
      const fragmentProgress = clamp((this.deathTimer - destabilizeEnd) / (fragmentEnd - destabilizeEnd), 0, 1);
      const fadeProgress = this.deathTimer > fragmentEnd
        ? clamp((this.deathTimer - fragmentEnd) / ENEMY_DEATH_FADE_DURATION, 0, 1)
        : 0;
      ctx.globalAlpha = 1 - fadeProgress;

      for (const fragment of this.deathFragments) {
        const travel = Math.sin(fragmentProgress * Math.PI * 0.5);
        const x = fragment.x + fragment.vx * travel * 0.32;
        const y = fragment.y + fragment.vy * travel * 0.32;
        const size = fragment.size * (1 - fadeProgress * 0.34);

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(fragment.rot + fragment.spin * fragmentProgress);
        ctx.fillStyle = fragment.shape === 0 ? "rgba(255, 255, 255, 0.88)" : "rgba(174, 244, 255, 0.82)";
        ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
        ctx.lineWidth = 0.7;
        if (fragment.shape === 0) {
          ctx.fillRect(-size * 0.5, -size * 0.3, size, size * 0.6);
          ctx.strokeRect(-size * 0.5, -size * 0.3, size, size * 0.6);
        } else if (fragment.shape === 1) {
          ctx.beginPath();
          ctx.moveTo(0, -size * 0.72);
          ctx.lineTo(size * 0.68, size * 0.5);
          ctx.lineTo(-size * 0.58, size * 0.38);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(-size, 0);
          ctx.lineTo(size, 0);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    ctx.restore();
  }

  draw() {
    if (this.isDying) {
      this.drawDeath();
      return;
    }
    if (this.hp <= 0) return;

    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;
    // Visual-only bob: the physics body remains anchored to the patrol surface
    // so collision, System Pulse hits, and edge detection stay unchanged. Keep
    // the fluctuation nearly still so the Walker reads as a controlled hover.
    const hoverBob = Math.sin(this.idleTimer * 2.35) * 1 * (this.gravitySign > 0 ? -1 : 1);
    const hitFlash = this.hitTimer > 0 ? this.hitTimer / 0.12 : 0;

    function tracePolygon(points) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
      ctx.closePath();
    }

    function drawPolygon(points) {
      tracePolygon(points);
      ctx.fill();
      ctx.stroke();
    }

    function strokeLine(from, to) {
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(cx + this.hitJoltX, cy + hoverBob + this.hitJoltY);
    ctx.scale(WALKER_VISUAL_SCALE, (this.gravitySign > 0 ? 1 : -1) * WALKER_VISUAL_SCALE);
    const gravityFlipVisual = this.getGravityFlipVisualTransform();
    if (gravityFlipVisual.rotation !== 0 || gravityFlipVisual.scaleX !== 1) {
      ctx.rotate(gravityFlipVisual.rotation);
      ctx.scale(gravityFlipVisual.scaleX, 1);
    }
    ctx.lineJoin = "miter";
    ctx.lineCap = "butt";
    if (this.anchorLocked) drawAnchorTargetGlow(28, 28);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = hitFlash > 0.45 ? "rgba(255, 255, 255, 0.96)" : WALKER_PLATE_STROKE;
    ctx.fillStyle = hitFlash > 0.45 ? "rgba(210, 245, 255, 0.42)" : WALKER_PLATE_FILL;
    ctx.lineWidth = 1.8;

    const leftPlate = [
      { x: -25, y: 21 },
      { x: -17, y: 20 },
      { x: -7, y: -21 },
      { x: -11, y: -24 }
    ];
    const rightPlate = leftPlate.map((point) => ({ x: -point.x, y: point.y }));
    const core = [
      { x: 0, y: -17 },
      { x: 10, y: 0 },
      { x: 0, y: 20 },
      { x: -10, y: 0 }
    ];
    const innerCore = [
      { x: 0, y: -10 },
      { x: 6, y: 0 },
      { x: 0, y: 11 },
      { x: -6, y: 0 }
    ];
    const centerGlow = [
      { x: 0, y: -5 },
      { x: 3, y: 0 },
      { x: 0, y: 5 },
      { x: -3, y: 0 }
    ];

    drawPolygon(leftPlate);
    drawPolygon(rightPlate);

    ctx.strokeStyle = WALKER_DETAIL_STROKE;
    ctx.lineWidth = 1.05;
    strokeLine({ x: -20.5, y: 16 }, { x: -12.4, y: -16 });
    strokeLine({ x: 20.5, y: 16 }, { x: 12.4, y: -16 });
    ctx.strokeStyle = WALKER_DETAIL_STROKE_DIM;
    ctx.lineWidth = 0.9;
    strokeLine({ x: -17.5, y: 10 }, { x: -13.8, y: -5 });
    strokeLine({ x: 17.5, y: 10 }, { x: 13.8, y: -5 });

    ctx.strokeStyle = hitFlash > 0.45 ? "rgba(255, 255, 255, 0.96)" : WALKER_CORE_STROKE;
    ctx.fillStyle = hitFlash > 0.45 ? "rgba(210, 245, 255, 0.46)" : WALKER_CORE_FILL;
    ctx.lineWidth = 1.8;
    drawPolygon(core);

    ctx.strokeStyle = WALKER_INNER_STROKE;
    ctx.fillStyle = WALKER_INNER_FILL;
    ctx.lineWidth = 1;
    drawPolygon(innerCore);

    ctx.fillStyle = hitFlash > 0.45 ? "rgba(255, 255, 255, 0.76)" : WALKER_CENTER_FILL;
    ctx.strokeStyle = hitFlash > 0.45 ? "rgba(255, 255, 255, 0.98)" : WALKER_CENTER_STROKE;
    ctx.lineWidth = 0.8;
    drawPolygon(centerGlow);

    ctx.restore();
    const walkerVisualTopY = cy + hoverBob + this.hitJoltY - 24 * WALKER_VISUAL_SCALE;
    drawGravityMarker(this, walkerVisualTopY);
  }
}


class Drone extends Entity {
  constructor(x, y) {
    super(x, y, DRONE_WIDTH, DRONE_HEIGHT);
    this.hp = 2;
    this.hoverTimer = Math.random() * Math.PI * 2;
    this.fireCooldown = 0.75;
    this.windupTimer = 0;
    this.hitTimer = 0;
    this.hitJoltX = 0;
    this.hitJoltY = 0;
    this.isDying = false;
    this.deathTimer = 0;
    this.deathFragments = [];
    this.droneState = "hovering";
    this.forcePulseRecoveryTimer = 0;
    this.orbitSlots = Array.from({ length: DRONE_ORBIT_SLOT_COUNT }, (_, index) => ({
      // Orbit phase remains continuous; firing hides this matching body diamond
      // briefly so the spawned projectile reads as the diamond detaching.
      aimAngle: 0,
      phaseOffset: index * Math.PI,
      detached: false,
      detachTimer: 0,
      detachMaxTimer: 0,
      reformTimer: 0,
      reformShards: this.createReformShards(index)
    }));
    this.waitingForFrontShot = false;
  }

  update(dt) {
    if (this.isDying) {
      this.updateDeath(dt);
      return;
    }
    if (this.hp <= 0) return;

    const timeScale = getTimeSlowScaleForTarget(this);
    const simDt = dt * timeScale;

    if (this.updateAnchorHold(simDt)) return;

    this.hoverTimer += simDt;
    this.updateGravityFlipVisual(simDt);
    this.updateHitReaction(simDt);
    this.updateOrbitDetachVisuals(simDt);

    this.updateVerticalEdgeKillTimer(simDt);

    if (enemyShouldDieOnVerticalWorldEdge(this) || this.isOutsideVerticalWorldBounds()) {
      this.beginDeath();
      return;
    }

    if (this.forcePulseStunTimer > 0) {
      this.updateForcePulseStun(simDt);
      this.windupTimer = 0;
      this.fireCooldown = Math.max(this.fireCooldown, 0.35);
      this.applyGravity(simDt);
      this.moveAndCollide(simDt);
    } else if (this.droneState === "hovering") {
      this.vx = 0;
      this.vy = 0;
      this.updateShooting(simDt);
    } else {
      this.windupTimer = 0;
      this.fireCooldown = Math.max(this.fireCooldown, 0.35);
      this.forcePulseRecoveryTimer = Math.max(0, this.forcePulseRecoveryTimer - simDt);
      this.applyGravity(simDt);
      this.moveAndCollide(simDt);

      // After hitstun, keep a short damped drift instead of snapping back to
      // hover immediately so Force Pulse reads as real displacement.
      const horizontalDrag = Math.max(0, 1 - simDt * 3.6);
      const verticalDrag = Math.max(0, 1 - simDt * 1.4);
      this.vx *= horizontalDrag;
      this.vy *= verticalDrag;

      // Do not let recovery time alone restore hover: a shoved Drone must keep
      // falling until collision physics finds a real platform/surface below it.
      if (this.onSurface) this.beginHoveringOnSurface();
    }
  }

  updateHitReaction(dt) {
    if (this.hitTimer <= 0) {
      this.hitJoltX = 0;
      this.hitJoltY = 0;
      return;
    }

    this.hitTimer = Math.max(0, this.hitTimer - dt);
    const progress = this.hitTimer / 0.12;
    this.hitJoltX *= Math.max(0, 1 - dt * 16);
    this.hitJoltY = -this.gravitySign * 2.2 * progress;
  }

  updateShooting(dt) {
    this.updateOrbitSlotAiming(dt);

    const playerCenter = centerOf(player);
    const droneCenter = centerOf(this);
    const playerInRange = distance(playerCenter, droneCenter) <= DRONE_DETECTION_RANGE && !player.isDying;

    if (!playerInRange) {
      this.waitingForFrontShot = false;
    }

    if (this.windupTimer > 0) {
      this.windupTimer = Math.max(0, this.windupTimer - dt);
      if (this.windupTimer > 0) return;
    }

    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (!playerInRange || this.fireCooldown > 0) return;

    if (!this.waitingForFrontShot) {
      this.waitingForFrontShot = true;
      this.windupTimer = DRONE_WINDUP;
      return;
    }

    // Once wound up, spawn the projectile at the active orbit diamond so the
    // shot reads as that outer diamond detaching from the Drone body.
    if (this.fireAtPlayer()) {
      this.fireCooldown = DRONE_FIRE_COOLDOWN;
      this.waitingForFrontShot = false;
    }
  }

  getOrbitAngle(slotIndex, hoverTimer = this.hoverTimer) {
    const slot = this.orbitSlots[slotIndex];
    const phaseOffset = slot?.phaseOffset ?? slotIndex * Math.PI;
    return hoverTimer * DRONE_ORBIT_SPEED + phaseOffset;
  }

  getOrbitParamAngleForDirection(directionAngle) {
    return Math.atan2(
      Math.sin(directionAngle) / DRONE_ORBIT_RADIUS_Y,
      Math.cos(directionAngle) / DRONE_ORBIT_RADIUS_X
    );
  }

  getOrbitSlotPosition(slotIndex, hoverTimer = this.hoverTimer, directionAngle = this.getSlotAimAngle()) {
    const angle = this.getOrbitAngle(slotIndex, hoverTimer);
    return this.getOrbitPositionFromAngle(angle, directionAngle);
  }

  getOrbitPositionFromAngle(angle, frontAngle = this.getSlotAimAngle()) {
    const x = Math.cos(angle) * DRONE_ORBIT_RADIUS_X;
    const y = Math.sin(angle) * DRONE_ORBIT_RADIUS_Y;
    const positionAngle = Math.atan2(y, x);
    // Front is the orbit direction facing the player, so right/left/angled
    // targets all use the same angular comparison in Drone-local space.
    const frontDelta = Math.abs(shortestAngleDelta(positionAngle, frontAngle));

    return {
      angle,
      x,
      y,
      positionAngle,
      isFront: frontDelta <= Math.PI / 2
    };
  }

  getSlotAimAngle() {
    const droneCenter = centerOf(this);
    const playerCenter = centerOf(player);
    const localDx = playerCenter.x - droneCenter.x;
    const localDy = (playerCenter.y - droneCenter.y) * this.gravitySign;
    return Math.atan2(localDy, localDx);
  }

  updateOrbitSlotAiming(dt) {
    if (player.isDying) return;

    const targetAngle = this.getSlotAimAngle();
    for (const slot of this.orbitSlots) {
      if (!Number.isFinite(slot.aimAngle)) {
        slot.aimAngle = targetAngle;
        continue;
      }

      const turnAmount = Math.min(1, dt * DRONE_AIM_TURN_SPEED);
      slot.aimAngle += shortestAngleDelta(slot.aimAngle, targetAngle) * turnAmount;
    }
  }

  fireAtPlayer() {
    if (player.isDying) return false;

    const slotIndex = this.getDetachableOrbitSlotIndex();
    if (slotIndex < 0) return false;

    const droneCenter = centerOf(this);
    const playerCenter = centerOf(player);
    const slot = this.orbitSlots[slotIndex];
    const localPosition = this.getOrbitSlotPosition(slotIndex, this.hoverTimer, slot.aimAngle);
    const from = {
      x: droneCenter.x + localPosition.x,
      y: droneCenter.y + localPosition.y * this.gravitySign
    };
    const launchAngle = Math.atan2(playerCenter.y - from.y, playerCenter.x - from.x);

    this.detachOrbitSlot(slotIndex);
    droneProjectiles.push(new DroneProjectile(
      from.x,
      from.y,
      Math.cos(launchAngle),
      Math.sin(launchAngle),
      launchAngle
    ));
    return true;
  }

  getDetachableOrbitSlotIndex() {
    const aimAngle = this.getSlotAimAngle();
    let bestIndex = -1;
    let bestFrontDelta = Infinity;

    for (let index = 0; index < this.orbitSlots.length; index += 1) {
      const slot = this.orbitSlots[index];
      if (slot.detached) continue;

      const position = this.getOrbitSlotPosition(index, this.hoverTimer, slot.aimAngle);
      if (!position.isFront) continue;

      const frontDelta = Math.abs(shortestAngleDelta(position.positionAngle, aimAngle));
      if (frontDelta < bestFrontDelta) {
        bestFrontDelta = frontDelta;
        bestIndex = index;
      }
    }

    if (bestIndex >= 0) return bestIndex;
    return this.orbitSlots.findIndex((slot) => !slot.detached);
  }

  detachOrbitSlot(slotIndex) {
    const slot = this.orbitSlots[slotIndex];
    if (!slot) return;
    slot.detached = true;
    slot.detachTimer = DRONE_DIAMOND_DETACH_MIN_DURATION;
    slot.detachMaxTimer = DRONE_DIAMOND_DETACH_MAX_DURATION;
    slot.reformTimer = 0;
  }

  updateOrbitDetachVisuals(dt) {
    if (this.isDying || this.hp <= 0) return;

    const aimAngle = this.getSlotAimAngle();
    for (let index = 0; index < this.orbitSlots.length; index += 1) {
      const slot = this.orbitSlots[index];
      if (!slot.detached) continue;

      if (slot.reformTimer > 0) {
        slot.reformTimer = Math.max(0, slot.reformTimer - dt);
        if (slot.reformTimer <= 0) slot.detached = false;
        continue;
      }

      slot.detachTimer = Math.max(0, slot.detachTimer - dt);
      slot.detachMaxTimer = Math.max(0, slot.detachMaxTimer - dt);
      const position = this.getOrbitSlotPosition(index, this.hoverTimer, aimAngle);
      const readyAtBackOrSide = !position.isFront;
      if (slot.detachTimer <= 0 && (readyAtBackOrSide || slot.detachMaxTimer <= 0)) {
        slot.reformTimer = DRONE_DIAMOND_REFORM_DURATION;
      }
    }
  }

  createReformShards(slotIndex) {
    const baseAngle = slotIndex * 0.83;
    return Array.from({ length: 7 }, (_, index) => {
      const angle = baseAngle + index * (Math.PI * 2 / 7);
      const distanceFromDiamond = 9 + (index % 3) * 4;
      return {
        offsetX: Math.cos(angle) * distanceFromDiamond,
        offsetY: Math.sin(angle) * distanceFromDiamond * 0.82,
        size: 1.5 + (index % 2) * 0.6,
        rotation: angle + Math.PI / 4
      };
    });
  }

  isTouchingVerticalWorldEdge() {
    return enemyTouchesVerticalWorldEdge(this);
  }

  isOutsideVerticalWorldBounds() {
    const body = this.getCollisionRect();
    return body.y + body.h >= bottomFallBoundary || body.y <= -120;
  }

  beginHoveringOnSurface() {
    const platform = this.getDirectSurfacePlatformAt(this.x + this.w / 2);
    if (!platform) {
      this.droneState = "falling";
      this.onSurface = false;
      return false;
    }

    this.attachToHoverSurface(platform);
    this.droneState = "hovering";
    this.onSurface = true;
    this.vx = 0;
    this.vy = 0;
    return true;
  }

  attachToHoverSurface(platform) {
    const hoverGap = this.getHoverGap();
    this.y = this.gravitySign > 0
      ? platform.y - this.h - hoverGap
      : platform.y + platform.h + hoverGap;
  }

  getHoverGap() {
    return 14;
  }

  getSurfacePlatformAt(probeX = this.x + this.w / 2, maxDistance = this.getHoverGap() + 8) {
    const body = this.getCollisionRect();
    const surfaceEdgeY = this.gravitySign > 0 ? body.y + body.h : body.y;
    let bestPlatform = null;
    let bestDistance = Infinity;

    for (const platform of platforms) {
      if (probeX < platform.x || probeX > platform.x + platform.w) continue;

      const surfaceY = this.gravitySign > 0 ? platform.y : platform.y + platform.h;
      const distanceToSurface = (surfaceY - surfaceEdgeY) * this.gravitySign;
      if (distanceToSurface < -0.5 || distanceToSurface > maxDistance) continue;

      if (distanceToSurface < bestDistance) {
        bestPlatform = platform;
        bestDistance = distanceToSurface;
      }
    }

    return bestPlatform;
  }

  getDirectSurfacePlatformAt(probeX = this.x + this.w / 2) {
    return this.getSurfacePlatformAt(probeX, this.getHoverGap() + 8);
  }

  getCollisionRect() {
    return { x: this.x + 4, y: this.y + 3, w: this.w - 8, h: this.h - 6 };
  }

  getDamageRect() {
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;
    return {
      x: cx - DRONE_CORE_DIAMOND_RX,
      y: cy - DRONE_CORE_DIAMOND_RY,
      w: DRONE_CORE_DIAMOND_RX * 2,
      h: DRONE_CORE_DIAMOND_RY * 2
    };
  }

  hit(amount, impact = null) {
    if (this.isDying || this.hp <= 0) return;
    if (impact?.armsVerticalEdgeKill) this.armVerticalEdgeKill();
    this.hp -= amount;
    this.hitTimer = 0.12;
    const playerFacing = player.facing || 1;
    this.hitJoltX = playerFacing * 2.5;
    this.hitJoltY = -this.gravitySign * 2;
    if (this.droneState !== "hovering") this.vy -= this.gravitySign * 45;
    if (this.hp <= 0) this.beginDeath();
  }

  receiveForcePulse(direction, speed, stunDuration, castId) {
    if (!super.receiveForcePulse(direction, speed, stunDuration, castId)) return false;
    this.droneState = "displaced";
    this.onSurface = false;
    this.forcePulseRecoveryTimer = FORCE_PULSE_DRONE_RECOVERY;
    this.windupTimer = 0;
    this.fireCooldown = Math.max(this.fireCooldown, 0.35);
    return true;
  }

  flipGravity(castId) {
    if (this.lastGravityCastId === castId) return;
    const previousGravitySign = this.gravitySign;
    super.flipGravity(castId);
    this.startGravityFlipVisual(previousGravitySign, this.gravitySign);
    this.droneState = "falling";
    this.windupTimer = 0;
    this.fireCooldown = Math.max(this.fireCooldown, 0.45);
  }

  resetGravity() {
    const previousGravitySign = this.gravitySign;
    super.resetGravity();
    this.startGravityFlipVisual(previousGravitySign, this.gravitySign);
    this.droneState = "falling";
    this.windupTimer = 0;
    this.fireCooldown = Math.max(this.fireCooldown, 0.45);
  }

  beginDeath() {
    if (this.isDying) return;
    this.hp = 0;
    this.isDying = true;
    this.deathTimer = 0;
    this.vx = 0;
    this.vy = 0;
    this.windupTimer = 0;
    this.deathFragments = this.createDeathFragments();
    activeGravityEntities.delete(this);
  }

  updateDeath(dt) {
    this.deathTimer += dt;
    if (this.deathTimer >= ENEMY_DEATH_TOTAL_DURATION) {
      this.isDying = false;
      this.deathFragments = [];
    }
  }

  createDeathFragments() {
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;
    const anchors = [
      { x: 0, y: -13, size: 4.6, shape: "diamond" },
      { x: 11, y: 0, size: 4.2, shape: "diamond" },
      { x: 0, y: 13, size: 4.6, shape: "diamond" },
      { x: -11, y: 0, size: 4.2, shape: "diamond" },
      { x: -22, y: 0, size: 3, shape: "diamond" },
      { x: 22, y: 0, size: 3, shape: "diamond" }
    ];

    return anchors.map((anchor, index) => {
      const worldX = cx + anchor.x;
      const worldY = cy + anchor.y * this.gravitySign;
      const angle = Math.atan2(worldY - cy, worldX - cx) + (index % 3 - 1) * 0.22;
      const speed = 22 + (index % 4) * 7;
      return {
        x: worldX,
        y: worldY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: anchor.size,
        rot: Math.PI / 4 + index * 0.38,
        spin: (index % 2 === 0 ? 1 : -1) * (1.8 + index * 0.05),
        shape: anchor.shape
      };
    });
  }

  drawDeath() {
    const flashEnd = ENEMY_DEATH_FLASH_DURATION;
    const destabilizeEnd = flashEnd + ENEMY_DEATH_DESTABILIZE_DURATION;
    const fragmentEnd = destabilizeEnd + ENEMY_DEATH_FRAGMENT_DURATION;
    const progress = clamp(this.deathTimer / ENEMY_DEATH_TOTAL_DURATION, 0, 1);
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;

    ctx.save();
    ctx.shadowColor = "rgba(255, 177, 47, 0.52)";
    ctx.shadowBlur = 10;

    if (this.deathTimer < destabilizeEnd) {
      const flashAlpha = this.deathTimer < flashEnd ? 0.95 : 0.68;
      const jitter = this.deathTimer < flashEnd ? 0 : Math.sin(this.deathTimer * 92) * 0.8;
      ctx.translate(cx + jitter, cy);
      ctx.scale(1, this.gravitySign > 0 ? 1 : -1);
      ctx.globalAlpha = flashAlpha;
      this.drawDroneBody(0, 0, 1, true);
    } else {
      const fragmentProgress = clamp((this.deathTimer - destabilizeEnd) / (fragmentEnd - destabilizeEnd), 0, 1);
      const fadeProgress = this.deathTimer > fragmentEnd
        ? clamp((this.deathTimer - fragmentEnd) / ENEMY_DEATH_FADE_DURATION, 0, 1)
        : 0;
      ctx.globalAlpha = 1 - fadeProgress;

      for (const fragment of this.deathFragments) {
        const travel = Math.sin(fragmentProgress * Math.PI * 0.5);
        const x = fragment.x + fragment.vx * travel * 0.32;
        const y = fragment.y + fragment.vy * travel * 0.32;
        const size = fragment.size * (1 - fadeProgress * 0.34);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(fragment.rot + fragment.spin * fragmentProgress);
        ctx.fillStyle = "rgba(255, 133, 24, 0.86)";
        ctx.strokeStyle = "rgba(78, 32, 10, 0.78)";
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size, 0);
        ctx.lineTo(0, size);
        ctx.lineTo(-size, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.restore();
  }

  drawDiamondShape(cx, cy, rx, ry) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - ry);
    ctx.lineTo(cx + rx, cy);
    ctx.lineTo(cx, cy + ry);
    ctx.lineTo(cx - rx, cy);
    ctx.closePath();
  }

  drawOrbitDiamond(position, charge, isArmed, aimAngle, scale = 1, alpha = 1) {
    ctx.save();
    ctx.translate(position.x, position.y);
    ctx.rotate(aimAngle + Math.PI / 2);
    ctx.scale(scale, scale);
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = DRONE_OUTER_DIAMOND_FILL;
    ctx.strokeStyle = DRONE_OUTER_DIAMOND_STROKE;
    ctx.lineWidth = isArmed ? 2.2 + charge * 0.35 : 2;
    this.drawDiamondShape(0, 0, DRONE_OUTER_DIAMOND_RX, DRONE_OUTER_DIAMOND_RY);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  drawOrbitReform(position, slot, aimAngle) {
    const progress = 1 - slot.reformTimer / DRONE_DIAMOND_REFORM_DURATION;
    const easedProgress = 1 - Math.pow(1 - progress, 3);

    ctx.save();
    ctx.shadowColor = "rgba(255, 168, 35, 0.62)";
    ctx.shadowBlur = 5;
    ctx.fillStyle = DRONE_OUTER_DIAMOND_FILL;
    ctx.strokeStyle = DRONE_OUTER_DIAMOND_STROKE;
    ctx.lineWidth = 0.75;

    for (const shard of slot.reformShards) {
      const x = position.x + shard.offsetX * (1 - easedProgress);
      const y = position.y + shard.offsetY * (1 - easedProgress);
      const shardScale = 1 - progress * 0.28;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(shard.rotation + progress * 0.8);
      ctx.globalAlpha = 0.38 + progress * 0.52;
      this.drawDiamondShape(0, 0, shard.size * shardScale, shard.size * 1.35 * shardScale);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    if (progress > 0.58) {
      const diamondProgress = clamp((progress - 0.58) / 0.42, 0, 1);
      this.drawOrbitDiamond(position, 0, false, aimAngle, 0.45 + diamondProgress * 0.55, diamondProgress);
    }

    ctx.restore();
  }

  drawOrbitLayer(drawFront, charge) {
    for (let index = 0; index < this.orbitSlots.length; index += 1) {
      const slot = this.orbitSlots[index];
      const position = this.getOrbitSlotPosition(index);
      if (position.isFront !== drawFront) continue;
      if (slot.detached) {
        if (slot.reformTimer > 0) this.drawOrbitReform(position, slot, slot.aimAngle);
        continue;
      }
      this.drawOrbitDiamond(position, charge, false, slot.aimAngle);
    }
  }

  drawDroneBody(xOffset = 0, yOffset = 0, charge = 0, deathFlash = false) {
    const coreFill = deathFlash ? "rgba(255, 245, 188, 0.98)" : "rgba(255, 136, 22, 0.96)";
    ctx.lineJoin = "miter";
    ctx.lineCap = "butt";

    ctx.save();
    ctx.translate(xOffset, yOffset);

    this.drawOrbitLayer(false, charge);

    ctx.strokeStyle = "rgba(42, 25, 14, 0.88)";
    ctx.fillStyle = "rgba(255, 143, 22, 0.34)";
    ctx.lineWidth = 2.2;
    this.drawDiamondShape(-6.5, 0, 10.5, 19);
    ctx.fill();
    ctx.stroke();
    this.drawDiamondShape(6.5, 0, 10.5, 19);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = coreFill;
    ctx.strokeStyle = "rgba(26, 19, 14, 0.96)";
    ctx.lineWidth = 2.6;
    this.drawDiamondShape(0, 0, DRONE_CORE_DIAMOND_RX, DRONE_CORE_DIAMOND_RY);
    ctx.fill();
    ctx.stroke();

    if (charge > 0 || deathFlash) {
      const glowAlpha = deathFlash ? 0.82 : 0.24 + charge * 0.32;
      ctx.fillStyle = `rgba(255, 224, 82, ${glowAlpha})`;
      this.drawDiamondShape(0, 0, 4 + charge * 1.5, 5 + charge * 1.5);
      ctx.fill();
    }

    this.drawOrbitLayer(true, charge);
    ctx.restore();
  }

  draw() {
    if (this.isDying) {
      this.drawDeath();
      return;
    }
    if (this.hp <= 0) return;

    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;
    const hoverBob = this.droneState === "hovering"
      ? Math.sin(this.hoverTimer * 2.4) * 2 * (this.gravitySign > 0 ? -1 : 1)
      : 0;
    const charge = this.windupTimer > 0 ? 1 - this.windupTimer / DRONE_WINDUP : 0;
    const hitFlash = this.hitTimer > 0 ? this.hitTimer / 0.12 : 0;

    ctx.save();
    ctx.translate(cx + this.hitJoltX, cy + hoverBob + this.hitJoltY);
    ctx.scale(1, this.gravitySign > 0 ? 1 : -1);
    const gravityFlipVisual = this.getGravityFlipVisualTransform();
    if (gravityFlipVisual.rotation !== 0 || gravityFlipVisual.scaleX !== 1) {
      ctx.rotate(gravityFlipVisual.rotation);
      ctx.scale(gravityFlipVisual.scaleX, 1);
    }
    if (this.anchorLocked) drawAnchorTargetGlow(30, 28);
    ctx.shadowColor = this.anchorLocked ? ANCHOR_SILVER_SHADOW : "rgba(255, 168, 35, 0.35)";
    ctx.shadowBlur = (this.anchorLocked ? 10 : 4) + charge * 7 + hitFlash * 5;
    this.drawDroneBody(0, 0, charge, hitFlash > 0.45);
    ctx.restore();
    const droneBodyTopY = cy + hoverBob + this.hitJoltY - DRONE_CORE_DIAMOND_RY;
    drawGravityMarker(this, droneBodyTopY);
  }
}


class Jumper extends Entity {
  constructor(x, y) {
    super(x, y, JUMPER_WIDTH, JUMPER_HEIGHT);
    this.hp = 3;
    this.facing = -1;
    this.jumperState = "idle";
    this.stateTimer = 0;
    this.recoveryDelayTimer = 0.12;
    this.hoverTimer = 0;
    this.poseBlend = 0;
    this.hitTimer = 0;
    this.hitJoltX = 0;
    this.hitJoltY = 0;
    this.groundedPlatform = null;
    this.isDying = false;
    this.deathTimer = 0;
    this.deathFragments = [];
  }

  update(dt) {
    if (this.isDying) {
      this.updateDeath(dt);
      return;
    }
    if (this.hp <= 0) return;

    const timeScale = getTimeSlowScaleForTarget(this);
    const simDt = dt * timeScale;

    if (this.updateAnchorHold(simDt)) return;

    this.hoverTimer += simDt;
    this.updateGravityFlipVisual(simDt);
    this.updateHitReaction(simDt);

    this.updateVerticalEdgeKillTimer(simDt);

    if (enemyShouldDieOnVerticalWorldEdge(this) || this.isOutsideWorld()) {
      this.beginDeath();
      return;
    }

    if (this.forcePulseStunTimer > 0) {
      this.updateForcePulseStun(simDt);
      this.enterAirborneState();
      this.updateAirborne(simDt);
      return;
    }

    if (this.jumperState === "jumping" || this.jumperState === "airborne") {
      this.updateAirborne(simDt);
      return;
    }

    const platform = this.getDirectSurfacePlatformAt(this.x + this.w / 2);
    if (!platform) {
      this.enterAirborneState();
      return;
    }

    this.groundedPlatform = platform;
    this.onSurface = true;
    this.attachToSurface(platform);
    this.facePlayerIfNearby();

    if (this.jumperState === "idle") this.updateIdle(simDt);
    else if (this.jumperState === "charging") this.updateCharging(simDt);
    else if (this.jumperState === "crouch-hold") this.updateCrouchHold(simDt);
    else if (this.jumperState === "recovering") this.updateRecovery(simDt);
  }

  updateHitReaction(dt) {
    if (this.hitTimer <= 0) {
      this.hitJoltX = 0;
      this.hitJoltY = 0;
      return;
    }

    this.hitTimer = Math.max(0, this.hitTimer - dt);
    const progress = this.hitTimer / 0.14;
    this.hitJoltX = -this.facing * 2.4 * progress;
    this.hitJoltY = -this.gravitySign * 1.8 * progress;
  }

  updateIdle(dt) {
    this.poseBlend = Math.max(0, this.poseBlend - dt / JUMPER_RECOVERY_DURATION);
    this.vx = 0;
    this.vy = 0;
    if (this.recoveryDelayTimer > 0) {
      this.recoveryDelayTimer = Math.max(0, this.recoveryDelayTimer - dt);
      return;
    }
    if (this.canStartAttack()) {
      this.jumperState = "charging";
      this.stateTimer = 0;
      this.poseBlend = 0;
    }
  }

  updateCharging(dt) {
    this.vx = 0;
    this.vy = 0;
    this.stateTimer += dt;
    const progress = clamp(this.stateTimer / JUMPER_CHARGE_DURATION, 0, 1);
    this.poseBlend = progress * progress * (3 - 2 * progress);
    if (progress >= 1) {
      this.jumperState = "crouch-hold";
      this.stateTimer = 0;
      this.poseBlend = 1;
    }
  }

  updateCrouchHold(dt) {
    this.vx = 0;
    this.vy = 0;
    this.poseBlend = 1;
    this.stateTimer += dt;
    if (this.stateTimer >= JUMPER_CROUCH_HOLD) this.launchAtPlayer();
  }

  updateRecovery(dt) {
    this.vx = 0;
    this.vy = 0;
    this.stateTimer += dt;
    const progress = clamp(this.stateTimer / JUMPER_RECOVERY_DURATION, 0, 1);
    this.poseBlend = 1 - progress * progress * (3 - 2 * progress);
    if (progress >= 1) {
      this.jumperState = "idle";
      this.stateTimer = 0;
      this.poseBlend = 0;
      this.recoveryDelayTimer = JUMPER_RECOVERY_DELAY;
    }
  }

  updateAirborne(dt) {
    this.groundedPlatform = null;
    this.onSurface = false;
    this.poseBlend = this.jumperState === "jumping" ? Math.max(0.25, this.poseBlend - dt * 1.8) : this.poseBlend;

    this.applyGravity(dt);
    this.moveAndCollide(dt);

    if (!this.onSurface) return;

    const landingPlatform = this.getDirectSurfacePlatformAt(this.x + this.w / 2);
    if (landingPlatform) this.beginLandingRecovery(landingPlatform);
    else this.enterAirborneState();
  }

  facePlayerIfNearby() {
    const dx = centerOf(player).x - (this.x + this.w / 2);
    if (Math.abs(dx) <= JUMPER_DETECTION_X * 1.25 && Math.abs(centerOf(player).y - (this.y + this.h / 2)) <= JUMPER_DETECTION_Y * 1.35) {
      this.facing = dx < 0 ? -1 : 1;
    }
  }

  canStartAttack() {
    if (player.isDying || !this.onSurface) return false;
    const jumperCenter = centerOf(this);
    const playerCenter = centerOf(player);
    const dx = playerCenter.x - jumperCenter.x;
    const dy = (playerCenter.y - jumperCenter.y) * this.gravitySign;
    if (Math.abs(dx) > JUMPER_DETECTION_X || Math.abs(dy) > JUMPER_DETECTION_Y) return false;

    // Spike hazards are not active yet, but the AI already routes its launch
    // choice through a landing-safety predicate so future spike-covered surfaces
    // can be rejected without rewriting the attack state machine.
    // Use the player's footprint as tolerance so standing flush against a wall or
    // platform side does not make their center point look barely unlandable.
    return Boolean(this.findSafeLandingSurface(playerCenter.x, player.w));
  }

  findSafeLandingSurface(targetX, targetWidth = 0) {
    const body = this.getCollisionRect();
    const surfaceEdgeY = this.gravitySign > 0 ? body.y + body.h : body.y;
    let bestPlatform = null;
    let bestScore = Infinity;

    for (const platform of platforms) {
      if (platform.safeForJumpers === false) continue;
      const minX = platform.x + this.w * 0.45;
      const maxX = platform.x + platform.w - this.w * 0.45;
      const landingX = clamp(targetX, minX, maxX);
      if (Math.abs(landingX - targetX) > targetWidth / 2) continue;
      if (!this.isSafeLandingSurface(platform, landingX, this.w)) continue;

      const surfaceY = this.gravitySign > 0 ? platform.y : platform.y + platform.h;
      const surfaceDelta = (surfaceY - surfaceEdgeY) * this.gravitySign;
      if (surfaceDelta < -24 || surfaceDelta > 185) continue;

      const score = Math.abs(surfaceDelta) + Math.abs(targetX - (this.x + this.w / 2)) * 0.15;
      if (score < bestScore) {
        bestPlatform = platform;
        bestScore = score;
      }
    }

    return bestPlatform;
  }

  isSafeLandingSurface(platform, landingX = this.x + this.w / 2, landingWidth = this.w) {
    // Partial spike strips only make their own footprint unsafe. This keeps
    // ceiling-landed jumpers active under reversed gravity even when another
    // section of the same platform underside has spikes.
    return platform.safeForJumpers !== false
      && !hasSpikesAtSurface(platform, landingX, this.gravitySign, landingWidth);
  }

  launchAtPlayer() {
    const target = centerOf(player);
    const origin = centerOf(this);
    const dx = target.x - origin.x;
    const direction = dx < 0 ? -1 : 1;
    const speed = clamp(Math.abs(dx) / 0.9, JUMPER_LEAP_MIN_SPEED, JUMPER_LEAP_MAX_SPEED);

    this.facing = direction;
    this.vx = direction * speed;
    this.vy = -this.gravitySign * JUMPER_LEAP_IMPULSE;
    this.onSurface = false;
    this.groundedPlatform = null;
    this.jumperState = "jumping";
    this.stateTimer = 0;
    this.poseBlend = 0.35;
  }

  beginLandingRecovery(platform) {
    this.groundedPlatform = platform;
    this.onSurface = true;
    this.attachToSurface(platform);
    this.vx = 0;
    this.vy = 0;
    this.jumperState = "recovering";
    this.stateTimer = 0;
    this.poseBlend = 1;
  }

  enterAirborneState() {
    this.jumperState = "airborne";
    this.groundedPlatform = null;
    this.onSurface = false;
  }

  attachToSurface(platform) {
    const hoverGap = this.getHoverGap();
    this.y = this.gravitySign > 0
      ? platform.y - this.h - hoverGap
      : platform.y + platform.h + hoverGap;
    this.vy = 0;
  }

  getHoverGap() {
    return 7;
  }

  getGroundContactRange() {
    return this.getHoverGap() + 4;
  }

  getSurfacePlatformAt(probeX = this.x + this.w / 2, maxDistance = this.getGroundContactRange()) {
    const body = this.getCollisionRect();
    const surfaceEdgeY = this.gravitySign > 0 ? body.y + body.h : body.y;
    let bestPlatform = null;
    let bestDistance = Infinity;

    for (const platform of platforms) {
      if (probeX < platform.x || probeX > platform.x + platform.w) continue;
      const surfaceY = this.gravitySign > 0 ? platform.y : platform.y + platform.h;
      const distanceToSurface = (surfaceY - surfaceEdgeY) * this.gravitySign;
      if (distanceToSurface < -0.5 || distanceToSurface > maxDistance) continue;
      if (distanceToSurface < bestDistance) {
        bestPlatform = platform;
        bestDistance = distanceToSurface;
      }
    }

    return bestPlatform;
  }

  getDirectSurfacePlatformAt(probeX = this.x + this.w / 2) {
    return this.getSurfacePlatformAt(probeX, this.getGroundContactRange())
      ?? this.getSurfacePlatformUnderFootprint(this.getGroundContactRange());
  }

  getSurfacePlatformUnderFootprint(maxDistance = this.getGroundContactRange()) {
    const body = this.getCollisionRect();
    const surfaceEdgeY = this.gravitySign > 0 ? body.y + body.h : body.y;
    let bestPlatform = null;
    let bestDistance = Infinity;

    for (const platform of platforms) {
      // A jumper can visually balance with only its edge on a ledge. Treat a
      // small amount of horizontal edge contact as support so it does not get
      // stuck in the airborne state while visibly standing on a platform lip.
      const overlapsFootprint = body.x < platform.x + platform.w + JUMPER_EDGE_SUPPORT_TOLERANCE
        && body.x + body.w > platform.x - JUMPER_EDGE_SUPPORT_TOLERANCE;
      if (!overlapsFootprint) continue;

      const surfaceY = this.gravitySign > 0 ? platform.y : platform.y + platform.h;
      const distanceToSurface = (surfaceY - surfaceEdgeY) * this.gravitySign;
      if (distanceToSurface < -0.5 || distanceToSurface > maxDistance) continue;
      if (distanceToSurface < bestDistance) {
        bestPlatform = platform;
        bestDistance = distanceToSurface;
      }
    }

    return bestPlatform;
  }

  isOutsideWorld() {
    const body = this.getCollisionRect();
    return body.y + body.h >= bottomFallBoundary || body.y <= -120;
  }

  getCollisionRect() {
    return { x: this.x + 3, y: this.y + 3, w: this.w - 6, h: this.h - 6 };
  }

  getDamageRect() {
    return this.getCollisionRect();
  }

  hit(amount, impact = null) {
    if (this.isDying || this.hp <= 0) return;
    if (impact?.armsVerticalEdgeKill) this.armVerticalEdgeKill();
    this.hp -= amount;
    this.hitTimer = 0.14;
    this.vx += this.x + this.w / 2 < player.x + player.w / 2 ? -26 : 26;

    if (this.hp <= 0) {
      this.beginDeath();
      return;
    }

    if (this.jumperState === "charging" || this.jumperState === "crouch-hold") {
      this.jumperState = "recovering";
      this.stateTimer = 0;
      this.poseBlend = Math.max(this.poseBlend, 0.55);
      this.recoveryDelayTimer = 0.18;
    }
  }

  receiveForcePulse(direction, speed, stunDuration, castId) {
    if (!super.receiveForcePulse(direction, speed, stunDuration, castId)) return false;
    if (this.jumperState === "charging" || this.jumperState === "crouch-hold") {
      this.poseBlend = Math.max(this.poseBlend, 0.55);
      this.recoveryDelayTimer = 0.18;
    }
    this.enterAirborneState();
    return true;
  }

  flipGravity(castId) {
    if (this.lastGravityCastId === castId) return;
    const previousGravitySign = this.gravitySign;
    super.flipGravity(castId);
    this.startGravityFlipVisual(previousGravitySign, this.gravitySign);
    this.enterAirborneState();
  }

  resetGravity() {
    const previousGravitySign = this.gravitySign;
    super.resetGravity();
    this.startGravityFlipVisual(previousGravitySign, this.gravitySign);
    this.enterAirborneState();
    const platform = this.getDirectSurfacePlatformAt(this.x + this.w / 2);
    if (platform) this.beginLandingRecovery(platform);
  }

  beginDeath() {
    if (this.isDying) return;
    this.hp = 0;
    this.isDying = true;
    this.deathTimer = 0;
    this.vx = 0;
    this.vy = 0;
    this.jumperState = "destroyed";
    this.deathFragments = this.createDeathFragments();
    activeGravityEntities.delete(this);
  }

  updateDeath(dt) {
    this.deathTimer += dt;
    if (this.deathTimer >= ENEMY_DEATH_TOTAL_DURATION) {
      this.isDying = false;
      this.deathFragments = [];
    }
  }

  createDeathFragments() {
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;
    const anchors = [
      { x: 0, y: -15, size: 5.2, shape: 0 },
      { x: 0, y: 5, size: 5.8, shape: 0 },
      { x: -18, y: 10, size: 5.5, shape: 1 },
      { x: 18, y: 10, size: 5.5, shape: 1 },
      { x: -12, y: 21, size: 4.2, shape: 1 },
      { x: 12, y: 21, size: 4.2, shape: 1 },
      { x: -6, y: -4, size: 3.3, shape: 2 },
      { x: 6, y: -4, size: 3.3, shape: 2 }
    ];

    return anchors.map((anchor, index) => {
      const worldX = cx + anchor.x;
      const worldY = cy + anchor.y * this.gravitySign;
      const angle = Math.atan2(worldY - cy, worldX - cx) + (index % 3 - 1) * 0.2;
      const speed = 22 + (index % 4) * 5;
      return {
        x: worldX,
        y: worldY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: anchor.size,
        rot: (index * 0.71) % Math.PI,
        spin: (index % 2 === 0 ? 1 : -1) * (1.35 + index * 0.08),
        shape: anchor.shape
      };
    });
  }

  drawDeath() {
    const flashEnd = ENEMY_DEATH_FLASH_DURATION;
    const destabilizeEnd = flashEnd + ENEMY_DEATH_DESTABILIZE_DURATION;
    const fragmentEnd = destabilizeEnd + ENEMY_DEATH_FRAGMENT_DURATION;
    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;

    ctx.save();
    if (this.deathTimer < destabilizeEnd) {
      const jitter = this.deathTimer < flashEnd ? 0 : Math.sin(this.deathTimer * 92) * 0.9;
      ctx.translate(cx + jitter, cy - jitter * 0.35);
      ctx.scale(1, this.gravitySign > 0 ? 1 : -1);
      ctx.globalAlpha = this.deathTimer < flashEnd ? 0.94 : 0.72;
      this.drawJumperBody(1, true, 0, 0);
    } else {
      const fragmentProgress = clamp((this.deathTimer - destabilizeEnd) / (fragmentEnd - destabilizeEnd), 0, 1);
      const fadeProgress = this.deathTimer > fragmentEnd
        ? clamp((this.deathTimer - fragmentEnd) / ENEMY_DEATH_FADE_DURATION, 0, 1)
        : 0;
      ctx.globalAlpha = 1 - fadeProgress;
      for (const fragment of this.deathFragments) {
        const travel = Math.sin(fragmentProgress * Math.PI * 0.5);
        const size = fragment.size * (1 - fadeProgress * 0.34);
        ctx.save();
        ctx.translate(fragment.x + fragment.vx * travel * 0.34, fragment.y + fragment.vy * travel * 0.34);
        ctx.rotate(fragment.rot + fragment.spin * fragmentProgress);
        ctx.fillStyle = fragment.shape === 0 ? "rgba(172, 214, 255, 0.88)" : "rgba(122, 106, 255, 0.8)";
        ctx.strokeStyle = "rgba(236, 244, 255, 0.78)";
        ctx.lineWidth = 0.8;
        if (fragment.shape === 0) this.traceDiamond(0, 0, size * 0.75, size * 1.1);
        else this.tracePlateShard(size, fragment.shape === 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
    ctx.restore();
  }

  getPose(blend) {
    const crouch = {
      coreY: -6,
      coreRx: 8.8,
      coreRy: 16.7,
      plateTopY: 2.3,
      plateInnerX: 6.6,
      plateOuterX: 16,
      plateInnerLowX: 4.2,
      plateInnerLowY: 9.9,
      plateTipX: 19,
      plateTipY: 19,
      plateFootX: 17.5,
      plateFootY: 13.7,
      plateTilt: 0.02
    };
    const stand = {
      coreY: -9,
      coreRx: 8.4,
      coreRy: 18.2,
      plateTopY: -0.8,
      plateInnerX: 8,
      plateOuterX: 17.5,
      plateInnerLowX: 5.7,
      plateInnerLowY: 8.4,
      plateTipX: 20.2,
      plateTipY: 20.5,
      plateFootX: 19.4,
      plateFootY: 13.7,
      plateTilt: -0.04
    };
    const pose = {};
    for (const key of Object.keys(crouch)) pose[key] = stand[key] + (crouch[key] - stand[key]) * blend;
    return pose;
  }

  traceDiamond(x, y, rx, ry) {
    ctx.beginPath();
    ctx.moveTo(x, y - ry);
    ctx.lineTo(x + rx, y);
    ctx.lineTo(x, y + ry);
    ctx.lineTo(x - rx, y);
    ctx.closePath();
  }

  tracePolygon(points) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) ctx.lineTo(points[index].x, points[index].y);
    ctx.closePath();
  }

  tracePlateShard(size, slim) {
    ctx.beginPath();
    ctx.moveTo(-size * 0.72, -size * 0.28);
    ctx.lineTo(size * (slim ? 0.35 : 0.72), -size * 0.45);
    ctx.lineTo(size * 0.28, size * 0.75);
    ctx.lineTo(-size * 0.52, size * 0.46);
    ctx.closePath();
  }

  drawSidePlate(side, pose, airShift, deathFlash = false) {
    const points = [
      { x: side * pose.plateOuterX, y: pose.plateTopY },
      { x: side * pose.plateInnerX, y: pose.plateTopY + 0.3 },
      { x: side * pose.plateInnerLowX, y: pose.plateInnerLowY },
      { x: side * pose.plateTipX, y: pose.plateTipY },
      { x: side * pose.plateFootX, y: pose.plateFootY }
    ];

    ctx.save();
    // Airborne motion now reads as rigid plate lag instead of organic squash.
    ctx.translate(0, airShift * 1.3);
    ctx.rotate(side * pose.plateTilt + side * airShift * 0.05);
    this.tracePolygon(points);
    const gradient = ctx.createLinearGradient(side * 6, pose.plateTopY, side * 21, pose.plateTipY);
    gradient.addColorStop(0, deathFlash ? "rgba(255, 255, 255, 0.96)" : "rgba(123, 177, 255, 0.94)");
    gradient.addColorStop(0.52, deathFlash ? "rgba(214, 236, 255, 0.92)" : "rgba(90, 94, 226, 0.94)");
    gradient.addColorStop(1, deathFlash ? "rgba(166, 167, 255, 0.88)" : "rgba(55, 42, 162, 0.96)");
    ctx.fillStyle = gradient;
    ctx.strokeStyle = deathFlash ? "rgba(255, 255, 255, 0.9)" : "rgba(27, 24, 96, 0.92)";
    ctx.lineWidth = 1.45;
    ctx.fill();
    ctx.stroke();

    // A clipped inner fill gives the side plates a clean energized glow
    // without adding extra decorative linework or outer shadows.
    this.tracePolygon(points);
    ctx.clip();
    const glow = ctx.createRadialGradient(
      side * pose.plateInnerX,
      pose.plateInnerLowY,
      0.6,
      side * pose.plateInnerX,
      pose.plateInnerLowY,
      12
    );
    glow.addColorStop(0, deathFlash ? "rgba(255, 255, 255, 0.42)" : "rgba(178, 117, 255, 0.34)");
    glow.addColorStop(0.55, deathFlash ? "rgba(213, 226, 255, 0.2)" : "rgba(92, 77, 255, 0.18)");
    glow.addColorStop(1, "rgba(92, 77, 255, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(side > 0 ? 0 : -24, -8, 24, 34);
    ctx.restore();
  }

  drawJumperBody(blend, deathFlash = false, airShift = 0, sideLag = 0) {
    const pose = this.getPose(blend);
    ctx.lineJoin = "miter";
    ctx.lineCap = "butt";
    ctx.shadowBlur = 0;

    ctx.save();
    // Keep the jumper rigid: shift armor pieces around the core rather than
    // scaling the whole body, which made the leap read as squishy.
    ctx.translate(0, -airShift * 1.8);

    this.drawSidePlate(-1, pose, airShift + sideLag, deathFlash);
    this.drawSidePlate(1, pose, airShift + sideLag, deathFlash);

    const coreY = pose.coreY - airShift * 1.4;
    const coreRy = pose.coreRy;
    const coreGradient = ctx.createLinearGradient(0, coreY - coreRy, 0, coreY + coreRy);
    coreGradient.addColorStop(0, deathFlash ? "rgba(255, 255, 255, 0.98)" : "rgba(121, 178, 255, 0.97)");
    coreGradient.addColorStop(0.5, deathFlash ? "rgba(214, 236, 255, 0.96)" : "rgba(88, 90, 226, 0.97)");
    coreGradient.addColorStop(1, deathFlash ? "rgba(166, 167, 255, 0.9)" : "rgba(48, 36, 160, 0.96)");
    this.traceDiamond(0, coreY, pose.coreRx, coreRy);
    ctx.fillStyle = coreGradient;
    ctx.strokeStyle = deathFlash ? "rgba(255, 255, 255, 0.96)" : "rgba(27, 24, 96, 0.96)";
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();

    this.traceDiamond(0, coreY, pose.coreRx, coreRy);
    ctx.save();
    ctx.clip();
    const coreGlow = ctx.createRadialGradient(0, coreY, 0.5, 0, coreY, coreRy * 0.8);
    coreGlow.addColorStop(0, deathFlash ? "rgba(255, 255, 255, 0.48)" : "rgba(184, 113, 255, 0.42)");
    coreGlow.addColorStop(0.58, deathFlash ? "rgba(215, 230, 255, 0.18)" : "rgba(91, 80, 255, 0.22)");
    coreGlow.addColorStop(1, "rgba(91, 80, 255, 0)");
    ctx.fillStyle = coreGlow;
    ctx.fillRect(-pose.coreRx, coreY - coreRy, pose.coreRx * 2, coreRy * 2);
    ctx.restore();
    ctx.restore();
  }

  draw() {
    if (this.isDying) {
      this.drawDeath();
      return;
    }
    if (this.hp <= 0) return;

    const cx = this.x + this.w / 2;
    const cy = this.y + this.h / 2;
    const hoverBob = this.jumperState === "idle"
      ? Math.sin(this.hoverTimer * 2.8) * 1.2 * (this.gravitySign > 0 ? -1 : 1)
      : 0;
    const airborne = this.jumperState === "jumping" || this.jumperState === "airborne";
    const airShift = airborne
      ? clamp((-this.vy * this.gravitySign) / JUMPER_LEAP_IMPULSE, -0.45, 1)
      : 0;
    const sideLag = airborne ? 0.12 : 0;
    const hitFlash = this.hitTimer > 0 ? this.hitTimer / 0.14 : 0;

    ctx.save();
    ctx.translate(cx + this.hitJoltX, cy + hoverBob + this.hitJoltY);
    ctx.scale(this.facing, this.gravitySign > 0 ? 1 : -1);
    const gravityFlipVisual = this.getGravityFlipVisualTransform();
    if (gravityFlipVisual.rotation !== 0 || gravityFlipVisual.scaleX !== 1) {
      ctx.rotate(gravityFlipVisual.rotation);
      ctx.scale(gravityFlipVisual.scaleX, 1);
    }
    this.drawJumperBody(this.poseBlend, hitFlash > 0.45, airShift, sideLag);
    ctx.restore();

    const visualTopY = cy + hoverBob + this.hitJoltY - 28;
    drawGravityMarker(this, visualTopY);
  }
}

class DroneProjectile {
  constructor(x, y, dx, dy, orientationAngle = Math.atan2(dy, dx)) {
    this.x = x;
    this.y = y;
    this.vx = dx * DRONE_PROJECTILE_SPEED;
    this.vy = dy * DRONE_PROJECTILE_SPEED;
    this.size = DRONE_PROJECTILE_SIZE;
    this.age = 0;
    this.orientationAngle = orientationAngle;
    this.active = true;
    this.anchorFrozen = false;
    this.anchorStoredVelocity = null;
  }

  restoreAnchorVelocity() {
    if (!this.anchorFrozen || !this.anchorStoredVelocity) return;
    this.vx = this.anchorStoredVelocity.vx;
    this.vy = this.anchorStoredVelocity.vy;
    this.anchorFrozen = false;
    this.anchorStoredVelocity = null;
  }

  updateAnchorFreeze() {
    if (!anchorFieldActive && this.anchorFrozen) this.restoreAnchorVelocity();
    return this.anchorFrozen;
  }

  deactivate() {
    if (!this.active) return;
    this.active = false;
  }

  getRect() {
    return {
      x: this.x - this.size / 2,
      y: this.y - this.size / 2,
      w: this.size,
      h: this.size
    };
  }

  update(dt) {
    if (!this.active) return;
    const anchored = this.updateAnchorFreeze();
    const simDt = anchored ? 0 : dt * getTimeSlowScaleForPoint(this.x, this.y);
    this.age += dt;
    this.x += this.vx * simDt;
    this.y += this.vy * simDt;

    const rect = this.getRect();
    if (this.x < -40 || this.x > ROOM_WIDTH + 40 || this.y < -80 || this.y > bottomFallBoundary + 80
      || this.x < cameraX - 28 || this.x > cameraX + canvas.width + 28) {
      this.deactivate();
      return;
    }

    if (platforms.some((platform) => rectsOverlap(rect, platform))) {
      this.deactivate();
      return;
    }

    if (!player.isDying && rectsOverlap(rect, player)) {
      if (!isPlayerPhased()) {
        player.takeDamage(1, rect);
        this.deactivate();
      }
    }
  }

  draw() {
    if (!this.active) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.orientationAngle + Math.PI / 2);
    ctx.shadowColor = "rgba(255, 168, 35, 0.75)";
    ctx.shadowBlur = 8;
    ctx.fillStyle = DRONE_OUTER_DIAMOND_FILL;
    ctx.strokeStyle = DRONE_OUTER_DIAMOND_STROKE;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -DRONE_OUTER_DIAMOND_RY);
    ctx.lineTo(DRONE_OUTER_DIAMOND_RX, 0);
    ctx.lineTo(0, DRONE_OUTER_DIAMOND_RY);
    ctx.lineTo(-DRONE_OUTER_DIAMOND_RX, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (this.anchorFrozen) {
      ctx.strokeStyle = ANCHOR_SILVER_STROKE;
      ctx.lineWidth = 1;
      ctx.shadowColor = ANCHOR_SILVER_SHADOW;
      ctx.shadowBlur = 7;
      ctx.beginPath();
      ctx.arc(0, 0, DRONE_OUTER_DIAMOND_RY + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
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
    if (hitEnemy) hitEnemy.hit(PULSE_DAMAGE, { armsVerticalEdgeKill: true, direction });
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

class ForcePulseVisual {
  constructor(caster, direction, origin) {
    this.caster = caster;
    this.origin = origin;
    this.direction = direction;
    this.age = 0;
    this.active = true;
  }

  getOrigin() {
    return this.caster?.getForcePulseHandPoint?.(this.direction) ?? this.origin;
  }

  update(dt) {
    this.age += dt;
    if (this.age >= FORCE_PULSE_VISUAL_DURATION) this.active = false;
  }

  draw() {
    const lifeProgress = clamp(this.age / FORCE_PULSE_VISUAL_DURATION, 0, 1);
    const expansionProgress = clamp(this.age / FORCE_PULSE_EXPAND_DURATION, 0, 1);
    const easedExpansion = expansionProgress * expansionProgress * (3 - 2 * expansionProgress);
    const fadeProgress = FORCE_PULSE_VISUAL_DURATION <= FORCE_PULSE_EXPAND_DURATION
      ? expansionProgress
      : clamp((this.age - FORCE_PULSE_EXPAND_DURATION) / (FORCE_PULSE_VISUAL_DURATION - FORCE_PULSE_EXPAND_DURATION), 0, 1);
    const alpha = expansionProgress < 1 ? 0.92 : Math.max(0, 0.92 * (1 - fadeProgress));
    if (alpha <= 0) return;

    const origin = this.getOrigin();
    const range = Math.max(8, FORCE_PULSE_RANGE * easedExpansion);
    const centerAngle = this.direction > 0 ? 0 : Math.PI;
    const upperAngle = centerAngle - FORCE_PULSE_HALF_ANGLE * this.direction;
    const lowerAngle = centerAngle + FORCE_PULSE_HALF_ANGLE * this.direction;
    const anticlockwise = this.direction < 0;

    function traceCone(drawRange) {
      const drawUpperX = origin.x + Math.cos(upperAngle) * drawRange;
      const drawUpperY = origin.y + Math.sin(upperAngle) * drawRange;
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(drawUpperX, drawUpperY);
      ctx.arc(origin.x, origin.y, drawRange, upperAngle, lowerAngle, anticlockwise);
      ctx.lineTo(origin.x, origin.y);
      ctx.closePath();
    }

    function strokeRippleArc(drawRange, width, strokeAlpha) {
      if (drawRange <= 2 || strokeAlpha <= 0) return;
      ctx.globalAlpha = alpha * strokeAlpha;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.arc(origin.x, origin.y, drawRange, upperAngle, lowerAngle, anticlockwise);
      ctx.stroke();
    }

    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Layered, expanding arc bands make the ability read as a force wave
    // rippling through the cone instead of a flat area flash.
    ctx.globalAlpha = alpha * 0.38;
    ctx.shadowColor = "rgba(255, 65, 95, 0.52)";
    ctx.shadowBlur = 20;
    ctx.fillStyle = "rgba(255, 24, 52, 0.16)";
    traceCone(range);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 177, 190, 0.96)";
    ctx.shadowColor = "rgba(255, 98, 124, 0.62)";
    ctx.shadowBlur = 16;
    strokeRippleArc(range, 3.2, 0.95);

    ctx.shadowBlur = 10;
    for (let i = 1; i <= 3; i += 1) {
      const delay = i * 0.14;
      const rawRippleProgress = lifeProgress * 1.35 - delay;
      if (rawRippleProgress <= 0) continue;
      const rippleProgress = clamp(rawRippleProgress, 0, 1);
      const rippleEase = rippleProgress * rippleProgress * (3 - 2 * rippleProgress);
      const rippleRadius = FORCE_PULSE_RANGE * (0.2 + rippleEase * 0.8);
      const rippleAlpha = (1 - rippleProgress) * (0.55 - i * 0.08);
      strokeRippleArc(rippleRadius, 2.6 - i * 0.35, rippleAlpha);
    }

    ctx.globalAlpha = alpha * 0.62;
    ctx.strokeStyle = "rgba(255, 116, 142, 0.64)";
    ctx.lineWidth = 1.35;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(origin.x + Math.cos(upperAngle) * range, origin.y + Math.sin(upperAngle) * range);
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(origin.x + Math.cos(lowerAngle) * range, origin.y + Math.sin(lowerAngle) * range);
    ctx.stroke();

    ctx.globalAlpha = alpha * (1 - lifeProgress * 0.65);
    ctx.strokeStyle = "rgba(255, 219, 224, 0.9)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, 9 + lifeProgress * 18, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }
}

function getClosestPlatformEdge(platform, playerCenterX) {
  const distanceToLeft = Math.abs(playerCenterX - platform.x);
  const distanceToRight = Math.abs(platform.x + platform.w - playerCenterX);
  return distanceToLeft <= distanceToRight ? "left" : "right";
}

function findPlatformAtSurfacePoint(x, surfaceY, gravitySign = 1) {
  return platforms.find((platform) => {
    const platformSurfaceY = gravitySign > 0 ? platform.y : platform.y + platform.h;
    return x >= platform.x && x <= platform.x + platform.w && Math.abs(surfaceY - platformSurfaceY) <= 2;
  }) ?? null;
}

function findSafePlatformEdgeX(platform, edge, playerWidth, playerHeight, playerY) {
  const minX = platform.x + EDGE_RESPAWN_INSET;
  const maxX = platform.x + platform.w - playerWidth - EDGE_RESPAWN_INSET;
  const fallbackX = clamp(platform.x + platform.w / 2 - playerWidth / 2, platform.x, platform.x + platform.w - playerWidth);
  const startX = edge === "right" ? maxX : minX;
  const direction = edge === "right" ? -1 : 1;

  if (minX > maxX) return fallbackX;

  const scanDistance = maxX - minX;
  for (let step = 0; step <= scanDistance; step += 6) {
    const candidateX = startX + direction * step;
    const candidate = { x: candidateX, y: playerY, w: playerWidth, h: playerHeight };
    const blockedByEnemy = getSolidEnemyRects().some((enemyRect) => rectsOverlap(candidate, enemyRect));
    if (!blockedByEnemy && !rectTouchesSpikes(candidate)) return candidateX;
  }

  const fallback = { x: fallbackX, y: playerY, w: playerWidth, h: playerHeight };
  const fallbackBlockedByEnemy = getSolidEnemyRects().some((enemyRect) => rectsOverlap(fallback, enemyRect));
  if (!fallbackBlockedByEnemy && !rectTouchesSpikes(fallback)) return fallbackX;

  return startX;
}

function isPlayerPhased() {
  return phaseShiftActive;
}

function getPlayerPlatformSolids() {
  return isPlayerPhased() ? platforms : [...platforms, ...phaseBarriers];
}

function getPlayerEnemyCollisionRects() {
  return isPlayerPhased() ? [] : getSolidEnemyRects();
}

function getSolidEnemyRects() {
  return enemies
    .filter((enemy) => enemy.hp > 0)
    .map((enemy) => enemy.getCollisionRect());
}

function findPulseEndpoint(startX, y, direction) {
  const screenEdge = direction > 0 ? cameraX + canvas.width : cameraX;
  let endX = clamp(screenEdge, 0, ROOM_WIDTH);
  let bestDistance = Math.abs(endX - startX);

  function consider(rect) {
    const hitX = getPulseHitX(startX, direction, rect);
    if (hitX === null) return;

    const distanceToHit = (hitX - startX) * direction;
    if (distanceToHit >= 0 && distanceToHit < bestDistance) {
      endX = hitX;
      bestDistance = distanceToHit;
    }
  }

  for (const platform of platforms) {
    if (!pulseLineOverlapsY(y, platform)) continue;
    consider(platform);
  }

  for (const enemy of enemies) {
    const damageRect = enemy.getDamageRect();
    if (enemy.hp <= 0 || !pulseLineOverlapsY(y, damageRect)) continue;
    consider(damageRect);
  }

  return endX;
}

function getPulseHitX(startX, direction, rect) {
  const nearEdge = direction > 0 ? rect.x : rect.x + rect.w;
  const farEdge = direction > 0 ? rect.x + rect.w : rect.x;
  const distanceToNearEdge = (nearEdge - startX) * direction;

  if (distanceToNearEdge >= 0) return nearEdge;

  // The pulse is spawned from the character's animated hand. When the player is
  // pressed close to a platform, that visual hand can begin inside the platform
  // even though the collision body is stopped outside it. Treat that as an
  // immediate wall hit so the pulse cannot originate beyond the blocker.
  const distanceToFarEdge = (farEdge - startX) * direction;
  if (distanceToFarEdge > 0) return startX;

  return null;
}

function pulseLineOverlapsY(y, rect) {
  const halfThickness = PULSE_THICKNESS / 2;
  return y + halfThickness >= rect.y && y - halfThickness <= rect.y + rect.h;
}

function findFirstEnemyOnPulse(startX, y, endX, direction) {
  let firstEnemy = null;
  let bestDistance = Math.abs(endX - startX) + 0.001;

  for (const enemy of enemies) {
    const damageRect = enemy.getDamageRect();
    if (enemy.hp <= 0 || !pulseLineOverlapsY(y, damageRect)) continue;
    const hitX = direction > 0 ? damageRect.x : damageRect.x + damageRect.w;
    const distanceToHit = (hitX - startX) * direction;
    if (distanceToHit >= 0 && distanceToHit <= bestDistance) {
      firstEnemy = enemy;
      bestDistance = distanceToHit;
    }
  }

  return firstEnemy;
}

function segmentIntersectsRect(from, to, rect) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  let tMin = 0;
  let tMax = 1;

  function clip(p, q) {
    if (p === 0) return q >= 0;
    const r = q / p;
    if (p < 0) {
      if (r > tMax) return false;
      if (r > tMin) tMin = r;
    } else {
      if (r < tMin) return false;
      if (r < tMax) tMax = r;
    }
    return true;
  }

  return clip(-dx, from.x - rect.x)
    && clip(dx, rect.x + rect.w - from.x)
    && clip(-dy, from.y - rect.y)
    && clip(dy, rect.y + rect.h - from.y)
    && tMax >= 0
    && tMin <= 1;
}

function rectSamplePoints(rect) {
  return [
    { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 },
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.w, y: rect.y },
    { x: rect.x, y: rect.y + rect.h },
    { x: rect.x + rect.w, y: rect.y + rect.h }
  ];
}

function isPointInForcePulseCone(origin, point, direction) {
  const dx = (point.x - origin.x) * direction;
  const dy = point.y - origin.y;
  if (dx < 0 || dx > FORCE_PULSE_RANGE) return false;
  if (dx <= 0.001) return Math.abs(dy) <= 3;
  return Math.abs(Math.atan2(dy, dx)) <= FORCE_PULSE_HALF_ANGLE;
}

function hasForcePulseLineOfSight(origin, targetPoint, targetRect) {
  return !platforms.some((platform) => {
    if (rectsOverlap(platform, targetRect)) return false;
    return segmentIntersectsRect(origin, targetPoint, platform);
  });
}

function getForcePulseHitPoint(origin, rect, direction) {
  let bestPoint = null;
  let bestDistance = Infinity;
  for (const point of rectSamplePoints(rect)) {
    if (!isPointInForcePulseCone(origin, point, direction)) continue;
    if (!hasForcePulseLineOfSight(origin, point, rect)) continue;
    const pointDistance = Math.hypot(point.x - origin.x, point.y - origin.y);
    if (pointDistance < bestDistance) {
      bestPoint = point;
      bestDistance = pointDistance;
    }
  }
  return bestPoint;
}

function castForcePulse() {
  const direction = player.facing || 1;
  player.startForcePulsePose(direction);
  const origin = player.getForcePulseHandPoint(direction);
  forcePulseCastId += 1;
  forcePulseVisuals.push(new ForcePulseVisual(player, direction, origin));

  for (const enemy of enemies) {
    if (enemy.hp <= 0 || enemy.isDying) continue;
    const damageRect = enemy.getDamageRect();
    const hitPoint = getForcePulseHitPoint(origin, damageRect, direction);
    if (!hitPoint) continue;

    const hitDistance = clamp(Math.hypot(hitPoint.x - origin.x, hitPoint.y - origin.y), 0, FORCE_PULSE_RANGE);
    const forceScale = 1 - (1 - FORCE_PULSE_MIN_FORCE_SCALE) * (hitDistance / FORCE_PULSE_RANGE);
    enemy.receiveForcePulse(direction, FORCE_PULSE_KNOCKBACK * forceScale, FORCE_PULSE_STUN, forcePulseCastId);
  }

  return true;
}

const player = new Player();
const enemies = [new Enemy(660, 435), new Drone(1085, 210), new Enemy(1590, 435), new Jumper(2010, 265)];

const systemDialogue = {
  activeBlocking: null,
  blockingQueue: [],
  activeAmbient: null,
  ambientQueue: []
};

const systemMessageTriggers = [
  {
    id: "start-movement-confirmed",
    x: 145,
    y: 320,
    w: 120,
    h: 170,
    repeat: false,
    fired: false,
    messages: ["Movement confirmed.", "Press Enter to continue."],
    blocking: true
  },
  {
    id: "first-gap-scan",
    x: 330,
    y: 280,
    w: 180,
    h: 210,
    repeat: false,
    fired: false,
    messages: ["Gap detected. Maintain momentum."],
    blocking: false
  },
  {
    id: "drone-contact",
    x: 980,
    y: 180,
    w: 260,
    h: 310,
    repeat: false,
    fired: false,
    messages: ["Hostile signal acquired.", "Abilities remain available after this prompt."],
    blocking: true
  },
  {
    id: "far-sector-noise",
    x: 1510,
    y: 250,
    w: 230,
    h: 240,
    repeat: false,
    fired: false,
    messages: ["Signal drift increasing."],
    blocking: false
  }
];

function normalizeSystemLines(messages) {
  const lines = Array.isArray(messages) ? messages : [messages];
  return lines.map((line) => String(line ?? "").trim()).filter(Boolean);
}

function createBlockingSystemMessage(messages) {
  return {
    lines: normalizeSystemLines(messages),
    lineIndex: 0,
    visibleChars: 0
  };
}

function createAmbientSystemMessage(messages, duration = SYSTEM_AMBIENT_DURATION) {
  const lines = normalizeSystemLines(messages);
  return {
    text: lines.join(" "),
    duration,
    age: 0,
    visibleChars: 0
  };
}

function enqueueSystemMessage(messages, options = {}) {
  const blocking = options.blocking ?? true;
  if (blocking) {
    const message = createBlockingSystemMessage(messages);
    if (message.lines.length <= 0) return false;
    systemDialogue.blockingQueue.push(message);
    startNextBlockingSystemMessage();
    return true;
  }

  const message = createAmbientSystemMessage(messages, options.duration ?? SYSTEM_AMBIENT_DURATION);
  if (!message.text) return false;

  // Blocking system output owns the interface. Ambient messages wait until the
  // blocking queue clears so flavor text never covers required prompts.
  if (isSystemMessageBlocking()) systemDialogue.ambientQueue.push(message);
  else systemDialogue.activeAmbient = message;
  return true;
}

function startNextBlockingSystemMessage() {
  if (systemDialogue.activeBlocking || systemDialogue.blockingQueue.length <= 0) return;
  systemDialogue.activeAmbient = null;
  systemDialogue.activeBlocking = systemDialogue.blockingQueue.shift();
}

function isSystemMessageBlocking() {
  return Boolean(systemDialogue.activeBlocking || systemDialogue.blockingQueue.length > 0);
}

function isCurrentSystemLineComplete() {
  const message = systemDialogue.activeBlocking;
  if (!message) return true;
  return message.visibleChars >= message.lines[message.lineIndex].length;
}

function advanceBlockingSystemMessage() {
  const message = systemDialogue.activeBlocking;
  if (!message) return;

  const line = message.lines[message.lineIndex];
  if (message.visibleChars < line.length) {
    message.visibleChars = line.length;
    return;
  }

  if (message.lineIndex < message.lines.length - 1) {
    message.lineIndex += 1;
    message.visibleChars = 0;
    return;
  }

  systemDialogue.activeBlocking = null;
  startNextBlockingSystemMessage();
}

function updateSystemMessages(dt) {
  startNextBlockingSystemMessage();

  const blocking = systemDialogue.activeBlocking;
  if (blocking) {
    const line = blocking.lines[blocking.lineIndex];
    blocking.visibleChars = Math.min(line.length, blocking.visibleChars + SYSTEM_TEXT_SPEED * dt);
    if (pressedThisFrame.has("enter")) advanceBlockingSystemMessage();
    return;
  }

  if (!systemDialogue.activeAmbient && systemDialogue.ambientQueue.length > 0) {
    systemDialogue.activeAmbient = systemDialogue.ambientQueue.shift();
  }

  const ambient = systemDialogue.activeAmbient;
  if (!ambient) return;
  ambient.age += dt;
  ambient.visibleChars = Math.min(ambient.text.length, ambient.visibleChars + SYSTEM_TEXT_SPEED * dt);
  if (ambient.age >= ambient.duration) {
    systemDialogue.activeAmbient = systemDialogue.ambientQueue.shift() ?? null;
  }
}

function updateSystemMessageTriggers() {
  const playerRect = { x: player.x, y: player.y, w: player.w, h: player.h };
  for (const trigger of systemMessageTriggers) {
    if (trigger.fired && !trigger.repeat) continue;
    if (!rectsOverlap(playerRect, trigger)) continue;
    enqueueSystemMessage(trigger.messages, { blocking: trigger.blocking, duration: trigger.duration });
    trigger.fired = true;
  }
}

function wrapSystemText(text, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }

  if (line) lines.push(line);
  return lines.length > 0 ? lines : [""];
}

function drawSystemMessageBox({ x, y, w, labelY, text, alpha, prompt = "" }) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(4, 13, 28, 0.82)";
  ctx.strokeStyle = "rgba(150, 228, 255, 0.78)";
  ctx.lineWidth = 1.5;
  ctx.shadowColor = "rgba(59, 194, 255, 0.22)";
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.roundRect(x, y, w, 94, 8);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.font = "11px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(155, 229, 255, 0.95)";
  ctx.fillText("[ SYSTEM ]", x + 18, labelY);

  ctx.font = "17px monospace";
  ctx.fillStyle = "rgba(235, 250, 255, 0.96)";
  const wrapped = wrapSystemText(text, w - 36).slice(0, 3);
  wrapped.forEach((line, index) => ctx.fillText(line, x + 18, y + 34 + index * 20));

  if (prompt) {
    ctx.font = "12px monospace";
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(155, 229, 255, 0.78)";
    ctx.fillText(prompt, x + w - 18, y + 70);
  }
  ctx.restore();
}

function drawSystemMessages() {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const blocking = systemDialogue.activeBlocking;
  if (blocking) {
    const line = blocking.lines[blocking.lineIndex];
    const text = line.slice(0, Math.floor(blocking.visibleChars));
    const prompt = "ENTER";
    const boxWidth = Math.min(620, canvas.width - 64);
    const x = (canvas.width - boxWidth) / 2;
    drawSystemMessageBox({
      x,
      y: canvas.height - 132,
      w: boxWidth,
      labelY: canvas.height - 154,
      text,
      alpha: 1,
      prompt
    });
  } else if (systemDialogue.activeAmbient) {
    const ambient = systemDialogue.activeAmbient;
    const fadeIn = clamp(ambient.age / SYSTEM_AMBIENT_FADE, 0, 1);
    const fadeOut = clamp((ambient.duration - ambient.age) / SYSTEM_AMBIENT_FADE, 0, 1);
    const alpha = Math.min(fadeIn, fadeOut);
    const text = ambient.text.slice(0, Math.floor(ambient.visibleChars));
    const boxWidth = Math.min(470, canvas.width - 72);
    drawSystemMessageBox({
      x: (canvas.width - boxWidth) / 2,
      y: 28,
      w: boxWidth,
      labelY: 40,
      text,
      alpha,
      prompt: ""
    });
  }

  ctx.restore();
}

function drawAnchorTargetGlow(rx = 28, ry = 28) {
  ctx.save();
  ctx.lineJoin = "miter";
  ctx.lineCap = "round";
  ctx.shadowColor = ANCHOR_SILVER_SHADOW;
  ctx.shadowBlur = 16;
  ctx.strokeStyle = ANCHOR_SILVER_STROKE;
  ctx.fillStyle = ANCHOR_SILVER_FILL;
  ctx.lineWidth = 1.5;

  ctx.beginPath();
  ctx.moveTo(0, -ry);
  ctx.lineTo(rx, 0);
  ctx.lineTo(0, ry);
  ctx.lineTo(-rx, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = ANCHOR_SILVER_CORE;
  ctx.lineWidth = 1;
  const tickStartX = rx * 0.54;
  const tickEndX = rx * 0.82;
  const tickStartY = ry * 0.54;
  const tickEndY = ry * 0.82;
  ctx.beginPath();
  ctx.moveTo(-tickStartX, 0);
  ctx.lineTo(-tickEndX, 0);
  ctx.moveTo(tickStartX, 0);
  ctx.lineTo(tickEndX, 0);
  ctx.moveTo(0, -tickStartY);
  ctx.lineTo(0, -tickEndY);
  ctx.moveTo(0, tickStartY);
  ctx.lineTo(0, tickEndY);
  ctx.stroke();

  ctx.restore();
}

function drawGravityMarker(entity, visualTopY = entity.y) {
  if (entity.gravitySign === 1) return;
  const cx = entity.x + entity.w / 2;
  // Anchor the arrow above the rendered art, not just the physics body, so it
  // remains readable without touching enemies even when that places it in a ceiling.
  const y = visualTopY - GRAVITY_MARKER_GAP - GRAVITY_MARKER_HEIGHT;
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

function getTimedAbilityProgress(ability) {
  if (!ability?.activeDuration || ability.activeRemaining <= 0) return 0;
  return clamp(ability.activeRemaining / ability.activeDuration, 0, 1);
}

function startTimedAbility(ability) {
  ability.cooldownRemaining = 0;
  ability.activeRemaining = Math.max(0, ability.activeDuration);
  ability.readyPulseTimer = 0;
}

function exposeEnemiesToPhaseShift() {
  if (!phaseShiftActive) return;
  const playerCenter = centerOf(player);
  for (const enemy of enemies) {
    if (enemy.hp <= 0 || enemy.isDying || enemy.lastPhaseCastId === phaseCastId) continue;
    if (distance(playerCenter, centerOf(enemy)) > PHASE_SHIFT_EXPOSURE_RADIUS) continue;
    enemy.lastPhaseCastId = phaseCastId;
    currentPhaseExposure.add(enemy);
    // Future adaptation hook: enemies in currentPhaseExposure saw this phase_cast_id.
  }
}

function activatePhaseShift() {
  const ability = getAbilityById("phase");
  if (!ability || phaseShiftActive) return false;
  phaseCastId += 1;
  currentPhaseExposure = new Set();
  phaseShiftActive = true;
  player.phaseFlickerTimer = PHASE_SHIFT_FLICKER_DURATION;
  player.attackTimer = 0;
  player.attackPulseQueued = false;
  player.attackReleaseTimer = 0;
  startTimedAbility(ability);
  exposeEnemiesToPhaseShift();
  return true;
}

function findNearestSafePhaseExit(overlappedBarrier) {
  const directions = Math.abs(player.vx) > 1 ? [Math.sign(player.vx)] : [player.facing || 1];
  directions.push(-directions[0]);

  for (const direction of directions) {
    const startX = direction > 0 ? overlappedBarrier.x + overlappedBarrier.w + 0.1 : overlappedBarrier.x - player.w - 0.1;
    for (let step = 0; step <= player.w + 48; step += 4) {
      const candidate = { x: startX + direction * step, y: player.y, w: player.w, h: player.h };
      if (candidate.x < 0 || candidate.x + candidate.w > ROOM_WIDTH) continue;
      const blockedByBarrier = phaseBarriers.some((barrier) => rectsOverlap(candidate, barrier));
      const blockedByPlatform = platforms.some((platform) => rectsOverlap(candidate, platform));
      if (!blockedByBarrier && !blockedByPlatform) return candidate;
    }
  }
  return null;
}

function resolvePhaseBarrierExit() {
  let moved = false;
  for (const barrier of phaseBarriers) {
    if (!rectsOverlap(player, barrier)) continue;
    const safe = findNearestSafePhaseExit(barrier);
    if (!safe) return false;
    player.x = safe.x;
    player.y = safe.y;
    player.vx = 0;
    moved = true;
  }
  return !moved || !phaseBarriers.some((barrier) => rectsOverlap(player, barrier));
}

function forceEndPhaseShift(startCooldown = true) {
  const ability = getAbilityById("phase");
  phaseShiftActive = false;
  player.phaseFlickerTimer = PHASE_SHIFT_FLICKER_DURATION;
  currentPhaseExposure.clear();
  if (ability) {
    ability.activeRemaining = 0;
    if (startCooldown) startAbilityCooldown(ability);
  }
}

function endPhaseShift(startCooldown = true) {
  const ability = getAbilityById("phase");
  if (!phaseShiftActive && (ability?.activeRemaining ?? 0) <= 0) return false;
  if (!resolvePhaseBarrierExit()) return false;
  forceEndPhaseShift(startCooldown);
  return true;
}


function resetGravityField(resetAll = false, startCooldown = false) {
  const entitiesToReset = resetAll ? [player, ...enemies] : activeGravityEntities;
  for (const entity of entitiesToReset) entity.resetGravity();
  activeGravityEntities.clear();
  gravityFieldActive = false;

  const ability = getAbilityById("gravity");
  if (ability) {
    ability.activeRemaining = 0;
    if (startCooldown) startAbilityCooldown(ability);
  }
}

function activateGravityField() {
  const ability = getAbilityById("gravity");
  if (!ability || gravityFieldActive) return false;

  gravityCastId += 1;
  gravityFieldActive = true;
  activeGravityEntities.clear();
  startTimedAbility(ability);

  const origin = centerOf(player);
  const candidates = [player, ...enemies.filter((enemy) => enemy.hp > 0)];
  for (const entity of candidates) {
    if (distance(origin, centerOf(entity)) <= GRAVITY_FIELD_RADIUS) {
      entity.flipGravity(gravityCastId);
      activeGravityEntities.add(entity);
    }
  }
  return true;
}

function toggleGravityField() {
  if (gravityFieldActive) {
    resetGravityField(false, true);
    return true;
  }
  return activateGravityField();
}

function getTimeSlowOrigin() {
  return centerOf(player);
}

function isPointInsideTimeSlow(point) {
  if (!timeSlowActive) return false;
  return distance(getTimeSlowOrigin(), point) <= TIME_SLOW_RADIUS;
}

function getTimeSlowScaleForTarget(target) {
  if (!timeSlowActive || !target) return 1;
  return isPointInsideTimeSlow(centerOf(target)) ? TIME_SLOW_MULTIPLIER : 1;
}

function getTimeSlowScaleForPoint(x, y) {
  return isPointInsideTimeSlow({ x, y }) ? TIME_SLOW_MULTIPLIER : 1;
}


function isPointInsideAnchorField(point) {
  return anchorFieldActive
    && anchorField
    && distance(anchorField, point) <= anchorField.radius;
}

function isTargetInsideAnchorField(target) {
  return isPointInsideAnchorField(centerOf(target));
}

function getAnchorFieldOrigin() {
  return centerOf(player);
}

function activateAnchorField() {
  const ability = getAbilityById("anchor");
  if (!ability || anchorFieldActive) return false;
  const origin = getAnchorFieldOrigin();
  anchorField = {
    x: origin.x,
    y: origin.y,
    radius: ANCHOR_FIELD_RADIUS,
    age: 0
  };
  // The visible range is only an activation flash; the capture snapshot below
  // decides what stays anchored for the full active duration.
  anchorFieldFade = { ...anchorField, fadeRemaining: ANCHOR_FIELD_FADE_DURATION };
  anchorFieldActive = true;
  startTimedAbility(ability);
  captureAnchorFieldTargets();
  return true;
}

function clearAnchorFieldEffects() {
  for (const enemy of enemies) enemy.anchorLocked = false;
  for (const projectile of droneProjectiles) projectile.restoreAnchorVelocity?.();
}

function endAnchorField(startCooldown = true) {
  const ability = getAbilityById("anchor");
  if (!anchorFieldActive && (ability?.activeRemaining ?? 0) <= 0) return false;
  anchorFieldActive = false;
  anchorField = null;
  clearAnchorFieldEffects();
  if (ability) {
    ability.activeRemaining = 0;
    if (startCooldown) startAbilityCooldown(ability);
  }
  return true;
}

function freezeAnchorProjectile(projectile) {
  if (!projectile?.active || projectile.anchorFrozen) return;
  projectile.anchorStoredVelocity = { vx: projectile.vx, vy: projectile.vy };
  projectile.vx = 0;
  projectile.vy = 0;
  projectile.anchorFrozen = true;
}

function captureAnchorFieldTargets() {
  if (!anchorFieldActive || !anchorField) return;

  for (const enemy of enemies) {
    enemy.anchorLocked = enemy.hp > 0 && !enemy.isDying && isTargetInsideAnchorField(enemy);
    if (enemy.anchorLocked) {
      enemy.vx = 0;
      enemy.vy = 0;
      if (enemy instanceof Drone) {
        enemy.windupTimer = 0;
        enemy.fireCooldown = Math.max(enemy.fireCooldown, 0.35);
      }
    }
  }

  for (const projectile of droneProjectiles) {
    if (isPointInsideAnchorField({ x: projectile.x, y: projectile.y })) freezeAnchorProjectile(projectile);
  }
}

function updateAnchorField(dt) {
  if (anchorFieldActive && anchorField) {
    anchorField.age += dt;
  }

  if (anchorFieldFade) {
    anchorFieldFade.fadeRemaining = Math.max(0, anchorFieldFade.fadeRemaining - dt);
    if (anchorFieldFade.fadeRemaining <= 0) anchorFieldFade = null;
  }
}

function activateTimeSlow() {
  const ability = getAbilityById("time");
  if (!ability || timeSlowActive) return false;
  timeSlowActive = true;
  timeSlowFadeTimer = 0;
  startTimedAbility(ability);
  return true;
}

function endTimeSlow(startCooldown = true) {
  const ability = getAbilityById("time");
  if (!timeSlowActive && (ability?.activeRemaining ?? 0) <= 0) return false;
  timeSlowActive = false;
  timeSlowFadeTimer = TIME_SLOW_FADE_DURATION;
  if (ability) {
    ability.activeRemaining = 0;
    if (startCooldown) startAbilityCooldown(ability);
  }
  return true;
}

function updateAbilityCooldowns(dt) {
  for (const ability of abilities) {
    const wasCoolingDown = ability.cooldownRemaining > 0;
    ability.cooldownRemaining = Math.max(0, ability.cooldownRemaining - dt);
    ability.readyPulseTimer = Math.max(0, ability.readyPulseTimer - dt);
    ability.unavailableTimer = Math.max(0, ability.unavailableTimer - dt);
    if (wasCoolingDown && ability.cooldownRemaining <= 0) {
      ability.readyPulseTimer = ABILITY_READY_PULSE_DURATION;
    }
  }

  const gravityAbility = getAbilityById("gravity");
  if (gravityFieldActive && gravityAbility?.activeRemaining > 0) {
    gravityAbility.activeRemaining = Math.max(0, gravityAbility.activeRemaining - dt);
    if (gravityAbility.activeRemaining <= 0) resetGravityField(false, true);
  }

  const timeAbility = getAbilityById("time");
  if (timeSlowActive && timeAbility?.activeRemaining > 0) {
    timeAbility.activeRemaining = Math.max(0, timeAbility.activeRemaining - dt);
    if (timeAbility.activeRemaining <= 0) endTimeSlow(true);
  }

  const phaseAbility = getAbilityById("phase");
  if (phaseShiftActive && phaseAbility?.activeRemaining > 0) {
    phaseAbility.activeRemaining = Math.max(0, phaseAbility.activeRemaining - dt);
    exposeEnemiesToPhaseShift();
    if (phaseAbility.activeRemaining <= 0) {
      if (!endPhaseShift(true)) phaseAbility.activeRemaining = 0.01;
    }
  }

  const anchorAbility = getAbilityById("anchor");
  if (anchorFieldActive && anchorAbility?.activeRemaining > 0) {
    anchorAbility.activeRemaining = Math.max(0, anchorAbility.activeRemaining - dt);
    if (anchorAbility.activeRemaining <= 0) endAnchorField(true);
  }

  updateAnchorField(dt);
  timeSlowFadeTimer = Math.max(0, timeSlowFadeTimer - dt);
}

function startAbilityCooldown(ability) {
  ability.cooldownRemaining = Math.max(0, ability.cooldownDuration);
  ability.readyPulseTimer = 0;
}

function selectAbility(ability) {
  if (!ability?.unlocked || ability.id === selectedAbilityId) return false;

  // Timed abilities continue independently while the wheel changes only which
  // ability a tap of E will activate or cancel next.
  selectedAbilityId = ability.id;
  return true;
}

function activateSelectedAbility() {
  const ability = getSelectedAbility();
  if (player.isDying) {
    ability.unavailableTimer = 0.16;
    return false;
  }

  if (ability.id === "gravity") {
    if (gravityFieldActive) {
      resetGravityField(false, true);
      return true;
    }

    if (!isAbilityReady(ability)) {
      ability.unavailableTimer = 0.16;
      return false;
    }

    return activateGravityField();
  }

  if (ability.id === "time") {
    if (timeSlowActive) return endTimeSlow(true);

    if (!isAbilityReady(ability)) {
      ability.unavailableTimer = 0.16;
      return false;
    }

    return activateTimeSlow();
  }

  if (ability.id === "phase") {
    if (phaseShiftActive) return endPhaseShift(true);

    if (!isAbilityReady(ability)) {
      ability.unavailableTimer = 0.16;
      return false;
    }

    return activatePhaseShift();
  }

  if (ability.id === "anchor") {
    if (anchorFieldActive) return endAnchorField(true);

    if (!isAbilityReady(ability)) {
      ability.unavailableTimer = 0.16;
      return false;
    }

    return activateAnchorField();
  }

  if (!isAbilityReady(ability)) {
    ability.unavailableTimer = 0.16;
    return false;
  }

  if (ability.id === "pulse") {
    if (isPlayerPhased()) {
      ability.unavailableTimer = 0.16;
      return false;
    }
    castForcePulse();
    startAbilityCooldown(ability);
    return true;
  }

  ability.unavailableTimer = 0.16;
  return false;
}

function openAbilityWheel() {
  abilityWheel.open = true;
  abilityWheel.centerX = canvas.width / 2;
  abilityWheel.centerY = canvas.height / 2;
  abilityWheel.hoveredIndex = Math.max(0, abilities.findIndex((ability) => ability.id === selectedAbilityId));
  updateAbilityWheelHover();
}

function closeAbilityWheel(confirmSelection = true) {
  if (confirmSelection) selectAbility(abilities[abilityWheel.hoveredIndex]);
  abilityWheel.open = false;
}

function stepAbilityWheelHover(delta) {
  for (let step = 0; step < abilities.length; step += 1) {
    abilityWheel.hoveredIndex = (abilityWheel.hoveredIndex + delta + abilities.length) % abilities.length;
    if (abilities[abilityWheel.hoveredIndex]?.unlocked) return;
  }
}

function updateAbilityWheelHover() {
  if (!abilityWheel.open || !MOUSE_ABILITY_WHEEL_SELECTION_ENABLED) return;
  const dx = pointerScreen.x - abilityWheel.centerX;
  const dy = pointerScreen.y - abilityWheel.centerY;
  const pointerDistance = Math.hypot(dx, dy);
  if (pointerDistance < ABILITY_WHEEL_INNER_RADIUS) return;

  const angle = (Math.atan2(dy, dx) + Math.PI * 2 + Math.PI / 2) % (Math.PI * 2);
  abilityWheel.hoveredIndex = Math.floor(angle / (Math.PI * 2 / abilities.length)) % abilities.length;
}

function updateAbilityInput(dt) {
  if (keys.has("e")) {
    eHoldTimer += dt;
    if (!eWheelOpenedThisHold && eHoldTimer >= ABILITY_HOLD_THRESHOLD) {
      openAbilityWheel();
      eWheelOpenedThisHold = true;
    }
  }

  if (abilityWheel.open) {
    updateAbilityWheelHover();
    if (pressedThisFrame.has("arrowright") || pressedThisFrame.has("d")) {
      stepAbilityWheelHover(1);
    }
    if (pressedThisFrame.has("arrowleft") || pressedThisFrame.has("a")) {
      stepAbilityWheelHover(-1);
    }
  }

  if (!eReleasedThisFrame) return;

  if (eWheelOpenedThisHold || abilityWheel.open) closeAbilityWheel(true);
  else activateSelectedAbility();

  eHoldTimer = 0;
  eWheelOpenedThisHold = false;
  eReleasedThisFrame = false;
}

function update(dt) {
  updateSystemMessages(dt);
  if (isSystemMessageBlocking()) {
    if (abilityWheel.open) closeAbilityWheel(false);
    eHoldTimer = 0;
    eWheelOpenedThisHold = false;
    eReleasedThisFrame = false;
    pressedThisFrame.clear();
    return;
  }

  updateAbilityInput(dt);
  if (abilityWheel.open) {
    // The ability menu is an intentional pause state: keep hover/selection
    // input live, but freeze world simulation and cooldown timers until closed.
    pressedThisFrame.clear();
    return;
  }

  updateAbilityCooldowns(dt);
  updateSystemMessageTriggers();

  if (!player.isDying && pressedThisFrame.has(" ")) player.firePulse();

  enemies.forEach((enemy) => enemy.update(dt));
  player.update(dt);
  pulses.forEach((pulse) => pulse.update(dt));
  forcePulseVisuals.forEach((visual) => visual.update(dt));
  droneProjectiles.forEach((projectile) => projectile.update(dt));

  for (let i = pulses.length - 1; i >= 0; i -= 1) {
    if (!pulses[i].active) pulses.splice(i, 1);
  }
  for (let i = forcePulseVisuals.length - 1; i >= 0; i -= 1) {
    if (!forcePulseVisuals[i].active) forcePulseVisuals.splice(i, 1);
  }
  for (let i = droneProjectiles.length - 1; i >= 0; i -= 1) {
    if (!droneProjectiles[i].active) droneProjectiles.splice(i, 1);
  }

  for (const enemy of enemies) {
    if (enemy.hp > 0 && !player.isDying && !isPlayerPhased() && rectsTouchOrOverlap(player, enemy.getDamageRect(), 0.75)) {
      player.takeDamage(1, enemy);
    }
  }

  const playerHazardRect = { x: player.x + 2, y: player.y + 2, w: player.w - 4, h: player.h - 4 };
  const touchedSpike = isPlayerPhased() ? null : getFirstTouchedSpike(playerHazardRect);
  if (touchedSpike) player.takeSpikeDamage(touchedSpike);

  for (const enemy of enemies) {
    if (enemy.hp <= 0 || enemy.isDying) continue;
    if (rectTouchesSpikes(enemy.getDamageRect())) enemy.beginDeath();
  }

  if (!player.isDying && (player.y > bottomFallBoundary || player.y + player.h < -120)) player.fallOutOfWorld();

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

function drawSpikes() {
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineWidth = 1.2;

  for (const spike of spikes) {
    const baseY = spike.side === "top" ? spike.platform.y : spike.platform.y + spike.platform.h;
    ctx.fillStyle = SPIKE_BASE_FILL;
    ctx.fillRect(spike.x, spike.side === "top" ? baseY - 3 : baseY, spike.w, 3);

    ctx.fillStyle = SPIKE_FILL;
    ctx.strokeStyle = SPIKE_STROKE;
    for (const triangle of getSpikeTriangles(spike)) {
      ctx.beginPath();
      ctx.moveTo(triangle[0].x, triangle[0].y);
      ctx.lineTo(triangle[1].x, triangle[1].y);
      ctx.lineTo(triangle[2].x, triangle[2].y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  ctx.restore();
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

  for (const barrier of phaseBarriers) {
    ctx.save();
    ctx.fillStyle = "rgba(112, 92, 255, 0.2)";
    ctx.strokeStyle = "rgba(185, 245, 255, 0.86)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 7]);
    ctx.fillRect(barrier.x, barrier.y, barrier.w, barrier.h);
    ctx.strokeRect(barrier.x + 0.5, barrier.y + 0.5, barrier.w - 1, barrier.h - 1);
    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(112, 92, 255, 0.5)";
    ctx.lineWidth = 1;
    for (let y = barrier.y + 12; y < barrier.y + barrier.h; y += 22) {
      ctx.beginPath();
      ctx.moveTo(barrier.x + 4, y);
      ctx.lineTo(barrier.x + barrier.w - 6, y + 6);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawSpikes();
}

function drawDiamond(x, y, size, filled) {
  const half = size / 2;

  ctx.beginPath();
  ctx.moveTo(x + half, y);
  ctx.lineTo(x + size, y + half);
  ctx.lineTo(x + half, y + size);
  ctx.lineTo(x, y + half);
  ctx.closePath();

  if (filled) {
    ctx.fillStyle = "rgba(246, 253, 255, 0.95)";
    ctx.strokeStyle = "rgba(82, 154, 209, 0.8)";
    ctx.shadowColor = "rgba(255, 255, 255, 0.55)";
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.shadowBlur = 0;
  } else {
    // Missing-health diamonds stay visible as a steady dark blue marker.
    // They intentionally do not flash, pulse, brighten, or disappear on damage.
    ctx.fillStyle = "rgba(13, 48, 89, 0.3)";
    ctx.strokeStyle = "rgba(5, 37, 82, 0.95)";
    ctx.lineWidth = 1.5;
    ctx.fill();
  }

  ctx.lineWidth = 1.5;
  ctx.stroke();
}


function drawTimeSlowField() {
  const ability = getAbilityById("time");
  const activeProgress = getTimedAbilityProgress(ability);
  const fadeProgress = timeSlowFadeTimer > 0 ? timeSlowFadeTimer / TIME_SLOW_FADE_DURATION : 0;
  if (!timeSlowActive && fadeProgress <= 0) return;

  const origin = getTimeSlowOrigin();
  const activeElapsed = ability?.activeDuration ? ability.activeDuration - (ability.activeRemaining ?? 0) : 0;
  const activationEase = timeSlowActive ? clamp(activeElapsed / 0.22, 0, 1) : 1;
  const radius = TIME_SLOW_RADIUS * (0.82 + 0.18 * activationEase);
  const alpha = timeSlowActive ? 0.72 : 0.72 * fadeProgress;
  const ripplePhase = (activeElapsed * 2.6) % 1;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "rgba(60, 210, 255, 0.09)";
  ctx.strokeStyle = "rgba(139, 236, 255, 0.88)";
  ctx.lineWidth = 2;
  ctx.shadowColor = "rgba(60, 210, 255, 0.4)";
  ctx.shadowBlur = 18;
  ctx.beginPath();
  ctx.arc(origin.x, origin.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.setLineDash([16, 10]);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "rgba(154, 244, 255, 0.42)";
  ctx.beginPath();
  ctx.arc(origin.x, origin.y, radius * (0.35 + ripplePhase * 0.55), 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  if (timeSlowActive && activeProgress > 0) {
    ctx.strokeStyle = "rgba(232, 253, 255, 0.84)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, radius + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * activeProgress);
    ctx.stroke();
  }
  ctx.restore();
}

function drawAbilitySymbol(ability, x, y, size, alpha = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = "rgba(244, 253, 255, 0.95)";
  ctx.fillStyle = "rgba(244, 253, 255, 0.92)";
  ctx.lineWidth = Math.max(1.4, size * 0.055);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const r = size * 0.24;
  if (ability.id === "gravity") {
    const arrowHeight = size * 0.28;
    const arrowWidth = size * 0.34;
    const stemWidth = size * 0.13;
    const headHeight = arrowHeight * 0.5;
    const gap = size * 0.07;

    const drawFilledArrowKey = (centerY, direction) => {
      const top = centerY - arrowHeight / 2;
      const bottom = centerY + arrowHeight / 2;
      const halfWidth = arrowWidth / 2;
      const halfStem = stemWidth / 2;

      ctx.beginPath();
      if (direction < 0) {
        ctx.moveTo(0, top);
        ctx.lineTo(halfWidth, top + headHeight);
        ctx.lineTo(halfStem, top + headHeight);
        ctx.lineTo(halfStem, bottom);
        ctx.lineTo(-halfStem, bottom);
        ctx.lineTo(-halfStem, top + headHeight);
        ctx.lineTo(-halfWidth, top + headHeight);
      } else {
        ctx.moveTo(0, bottom);
        ctx.lineTo(halfWidth, bottom - headHeight);
        ctx.lineTo(halfStem, bottom - headHeight);
        ctx.lineTo(halfStem, top);
        ctx.lineTo(-halfStem, top);
        ctx.lineTo(-halfStem, bottom - headHeight);
        ctx.lineTo(-halfWidth, bottom - headHeight);
      }
      ctx.closePath();
      ctx.fill();
    };

    // Gravity Field uses compact, green glowing keyboard-arrow glyphs so the
    // selected ability reads as an up/down gravity flip instead of thin lines.
    ctx.fillStyle = "rgba(135, 255, 198, 0.96)";
    ctx.shadowColor = "rgba(111, 255, 184, 0.72)";
    ctx.shadowBlur = size * 0.18;
    drawFilledArrowKey(-(arrowHeight + gap) / 2, -1);
    drawFilledArrowKey((arrowHeight + gap) / 2, 1);
    ctx.shadowBlur = 0;
  } else if (ability.id === "time") {
    const clockRadius = size * 0.29;
    const tickLength = size * 0.055;

    ctx.strokeStyle = "rgba(132, 239, 255, 0.96)";
    ctx.fillStyle = "rgba(132, 239, 255, 0.92)";
    ctx.shadowColor = "rgba(77, 218, 255, 0.72)";
    ctx.shadowBlur = size * 0.16;

    // Time Slow uses a simple clock face; cooldown and active timers are drawn
    // elsewhere so the glyph remains a stable ability identifier.
    ctx.beginPath();
    ctx.arc(0, 0, clockRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = Math.max(1.1, size * 0.04);
    for (let tick = 0; tick < 12; tick += 1) {
      const angle = -Math.PI / 2 + tick * (Math.PI * 2 / 12);
      const inner = clockRadius - (tick % 3 === 0 ? tickLength * 1.35 : tickLength);
      const outer = clockRadius - size * 0.018;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer);
      ctx.stroke();
    }

    ctx.lineWidth = Math.max(1.5, size * 0.055);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -clockRadius * 0.58);
    ctx.moveTo(0, 0);
    ctx.lineTo(clockRadius * 0.5, clockRadius * 0.28);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.035, 0, Math.PI * 2);
    ctx.fill();
  } else if (ability.id === "pulse") {
    // Force Pulse reads as a hot emitter blasting nested shockwave arcs forward.
    // The layered wedges keep the icon recognizable at both HUD and wheel sizes.
    const originX = -size * 0.28;
    const originY = 0;
    const range = size * 0.58;
    const halfAngle = 0.54;
    const upperAngle = -halfAngle;
    const lowerAngle = halfAngle;

    const tracePulseFan = (fanRange, insetAngle = 0) => {
      const startAngle = upperAngle + insetAngle;
      const endAngle = lowerAngle - insetAngle;
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(originX + Math.cos(startAngle) * fanRange, originY + Math.sin(startAngle) * fanRange);
      ctx.arc(originX, originY, fanRange, startAngle, endAngle);
      ctx.lineTo(originX, originY);
      ctx.closePath();
    };

    const strokePulseArc = (arcRange, insetAngle, width, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.arc(originX, originY, arcRange, upperAngle + insetAngle, lowerAngle - insetAngle);
      ctx.stroke();
    };

    ctx.shadowColor = "rgba(255, 40, 78, 0.62)";
    ctx.shadowBlur = size * 0.22;
    ctx.fillStyle = "rgba(255, 31, 69, 0.24)";
    tracePulseFan(range + size * 0.018);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 91, 111, 0.28)";
    tracePulseFan(range * 0.72, 0.08);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 174, 184, 0.94)";
    ctx.lineWidth = Math.max(1.5, size * 0.05);
    tracePulseFan(range, 0.02);
    ctx.stroke();

    ctx.shadowBlur = size * 0.1;
    strokePulseArc(range * 0.4, 0.24, Math.max(1, size * 0.028), "rgba(255, 218, 223, 0.78)");
    strokePulseArc(range * 0.62, 0.16, Math.max(1.1, size * 0.032), "rgba(255, 186, 197, 0.86)");
    strokePulseArc(range * 0.84, 0.08, Math.max(1.2, size * 0.036), "rgba(255, 135, 154, 0.82)");

    ctx.shadowColor = "rgba(255, 235, 239, 0.72)";
    ctx.shadowBlur = size * 0.13;
    ctx.fillStyle = "rgba(255, 235, 239, 0.96)";
    ctx.beginPath();
    ctx.moveTo(originX - size * 0.08, originY);
    ctx.lineTo(originX, originY - size * 0.1);
    ctx.lineTo(originX + size * 0.14, originY);
    ctx.lineTo(originX, originY + size * 0.1);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;
  } else if (ability.id === "anchor") {
    const circleRadius = size * 0.29;
    const diamondRadius = size * 0.105;
    ctx.strokeStyle = ANCHOR_SILVER_STROKE;
    ctx.fillStyle = ANCHOR_SILVER_CORE;
    ctx.shadowColor = ANCHOR_SILVER_SHADOW;
    ctx.shadowBlur = size * 0.14;

    ctx.beginPath();
    ctx.arc(0, 0, circleRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = Math.max(1.1, size * 0.038);
    const lineStart = diamondRadius * 1.45;
    const lineEnd = circleRadius * 0.78;
    ctx.beginPath();
    ctx.moveTo(0, -lineStart);
    ctx.lineTo(0, -lineEnd);
    ctx.moveTo(0, lineStart);
    ctx.lineTo(0, lineEnd);
    ctx.moveTo(-lineStart, 0);
    ctx.lineTo(-lineEnd, 0);
    ctx.moveTo(lineStart, 0);
    ctx.lineTo(lineEnd, 0);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, -diamondRadius);
    ctx.lineTo(diamondRadius, 0);
    ctx.lineTo(0, diamondRadius);
    ctx.lineTo(-diamondRadius, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
  } else if (ability.id === "phase") {
    const bodyTop = -size * 0.11;
    const bodyBottom = size * 0.36;
    const bodyW = size * 0.25;
    const bodyR = bodyW / 2;
    const bodyCenterY = (bodyTop + bodyBottom) / 2;
    const bodyH = bodyBottom - bodyTop;
    const headY = -size * 0.28;
    const headR = size * 0.105;

    function tracePhaseCapsule(offsetX = 0) {
      ctx.beginPath();
      ctx.moveTo(offsetX - bodyR, bodyTop + bodyR);
      ctx.lineTo(offsetX - bodyR, bodyBottom - bodyR);
      ctx.quadraticCurveTo(offsetX - bodyR, bodyBottom, offsetX, bodyBottom);
      ctx.quadraticCurveTo(offsetX + bodyR, bodyBottom, offsetX + bodyR, bodyBottom - bodyR);
      ctx.lineTo(offsetX + bodyR, bodyTop + bodyR);
      ctx.quadraticCurveTo(offsetX + bodyR, bodyTop, offsetX, bodyTop);
      ctx.quadraticCurveTo(offsetX - bodyR, bodyTop, offsetX - bodyR, bodyTop + bodyR);
      ctx.closePath();
    }

    function tracePhaseHead(offsetX = 0) {
      ctx.beginPath();
      ctx.arc(offsetX, headY, headR, 0, Math.PI * 2);
      ctx.closePath();
    }

    ctx.shadowColor = "rgba(151, 238, 255, 0.5)";
    ctx.shadowBlur = size * 0.13;

    // Phase Shift reads as a split figure: solid left side, displaced translucent
    // right side. The head mirrors the body's half-phased treatment.

    ctx.save();
    tracePhaseCapsule();
    ctx.clip();
    ctx.fillStyle = "rgba(162, 239, 255, 0.96)";
    ctx.fillRect(-bodyR, bodyTop, bodyR, bodyH);
    ctx.restore();

    ctx.save();
    tracePhaseHead();
    ctx.clip();
    ctx.fillStyle = "rgba(162, 239, 255, 0.96)";
    ctx.fillRect(-headR, headY - headR, headR, headR * 2);
    ctx.restore();

    ctx.globalAlpha *= 0.72;
    ctx.fillStyle = "rgba(139, 112, 255, 0.76)";
    const bodyFragments = [
      { y: bodyTop + size * 0.05, h: size * 0.1, dx: size * 0.045 },
      { y: bodyCenterY - size * 0.045, h: size * 0.13, dx: size * 0.1 },
      { y: bodyBottom - size * 0.14, h: size * 0.085, dx: size * 0.055 }
    ];
    for (const fragment of bodyFragments) {
      ctx.save();
      tracePhaseCapsule(fragment.dx);
      ctx.clip();
      ctx.fillRect(fragment.dx, fragment.y, bodyR + size * 0.02, fragment.h);
      ctx.restore();
    }

    const headFragments = [
      { y: headY - headR * 0.74, h: headR * 0.64, dx: size * 0.038 },
      { y: headY - headR * 0.06, h: headR * 0.8, dx: size * 0.082 }
    ];
    for (const fragment of headFragments) {
      ctx.save();
      tracePhaseHead(fragment.dx);
      ctx.clip();
      ctx.fillRect(fragment.dx, fragment.y, headR + size * 0.02, fragment.h);
      ctx.restore();
    }

    ctx.globalAlpha /= 0.72;
    ctx.strokeStyle = "rgba(215, 253, 255, 0.86)";
    ctx.lineWidth = Math.max(1.1, size * 0.038);
    tracePhaseCapsule();
    ctx.stroke();
    tracePhaseHead();
    ctx.stroke();

    ctx.strokeStyle = "rgba(132, 103, 255, 0.82)";
    ctx.lineWidth = Math.max(1, size * 0.032);
    ctx.beginPath();
    ctx.moveTo(0, headY - headR * 0.76);
    ctx.lineTo(0, headY + headR * 0.76);
    ctx.moveTo(0, bodyTop + size * 0.045);
    ctx.lineTo(0, bodyBottom - size * 0.055);
    ctx.stroke();

  } else if (ability.id === "link") {
    ctx.beginPath();
    ctx.moveTo(-r * 0.78, r * 0.52);
    ctx.lineTo(0, -r * 0.64);
    ctx.lineTo(r * 0.82, r * 0.48);
    ctx.stroke();
    for (const node of [[-r * 0.78, r * 0.52], [0, -r * 0.64], [r * 0.82, r * 0.48]]) {
      ctx.beginPath();
      ctx.arc(node[0], node[1], r * 0.24, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

function drawAbilityTile(ability, centerX, centerY, size, options = {}) {
  const activeProgress = getTimedAbilityProgress(ability);
  const coolingDown = ability.cooldownRemaining > 0;
  const progress = activeProgress > 0
    ? activeProgress
    : ability.cooldownDuration > 0
      ? 1 - clamp(ability.cooldownRemaining / ability.cooldownDuration, 0, 1)
      : 1;
  const locked = !ability.unlocked;
  const selected = options.selected ?? false;
  const highlighted = options.highlighted ?? false;
  const showReadyPulse = options.showReadyPulse ?? true;
  const pulse = showReadyPulse ? clamp(ability.readyPulseTimer / ABILITY_READY_PULSE_DURATION, 0, 1) : 0;
  const denied = clamp(ability.unavailableTimer / 0.16, 0, 1);
  const nudge = denied > 0 ? Math.sin(denied * Math.PI * 4) * 1.4 : 0;

  ctx.save();
  ctx.translate(centerX + nudge, centerY);
  ctx.globalAlpha *= locked ? 0.35 : 1;
  ctx.fillStyle = locked ? "rgba(6, 26, 55, 0.62)" : "rgba(7, 31, 66, 0.82)";
  ctx.strokeStyle = highlighted || selected ? "rgba(220, 251, 255, 0.92)" : "rgba(86, 168, 229, 0.76)";
  ctx.lineWidth = highlighted || selected ? 2.2 : 1.4;
  ctx.beginPath();
  ctx.roundRect(-size / 2, -size / 2, size, size, 8);
  ctx.fill();
  ctx.stroke();

  if (!locked) {
    const fillHeight = size * progress;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-size / 2 + 2, -size / 2 + 2, size - 4, size - 4, 6);
    ctx.clip();
    ctx.fillStyle = activeProgress > 0 ? "rgba(139, 245, 255, 0.22)" : "rgba(83, 184, 255, 0.32)";
    if (activeProgress > 0) ctx.fillRect(-size / 2 + 2, -size / 2 + 2, size - 4, fillHeight);
    else ctx.fillRect(-size / 2 + 2, size / 2 - 2 - fillHeight, size - 4, fillHeight);
    if (coolingDown) {
      ctx.fillStyle = "rgba(2, 10, 24, 0.34)";
      ctx.fillRect(-size / 2 + 2, -size / 2 + 2, size - 4, size - 4 - fillHeight);
    }
    ctx.restore();
  }

  // Keep active ability timing as tile fill only; avoid circular timer rings for all abilities.

  if (pulse > 0) {
    ctx.strokeStyle = `rgba(246, 253, 255, ${0.5 * pulse})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(-size / 2 - 3 * pulse, -size / 2 - 3 * pulse, size + 6 * pulse, size + 6 * pulse);
  }

  drawAbilitySymbol(ability, 0, 0, size, locked ? 0.55 : 1);

  if (locked) {
    ctx.strokeStyle = "rgba(188, 217, 240, 0.8)";
    ctx.lineWidth = 1.5;
    const lockW = size * 0.28;
    const lockY = size * 0.2;
    ctx.strokeRect(-lockW / 2, lockY, lockW, size * 0.18);
    ctx.beginPath();
    ctx.arc(0, lockY, lockW * 0.34, Math.PI, 0);
    ctx.stroke();
  }

  ctx.restore();
}

function drawSelectedAbilityIcon() {
  const ability = getSelectedAbility();
  const x = canvas.width - ABILITY_ICON_MARGIN - ABILITY_ICON_SIZE / 2;
  const y = canvas.height - ABILITY_ICON_MARGIN - ABILITY_ICON_SIZE / 2;
  drawAbilityTile(ability, x, y, ABILITY_ICON_SIZE, { selected: true, showReadyPulse: !abilityWheel.open });
}

function drawAbilityWheel() {
  if (!abilityWheel.open) return;

  const centerX = abilityWheel.centerX;
  const centerY = abilityWheel.centerY;
  const slice = Math.PI * 2 / abilities.length;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "rgba(4, 18, 42, 0.46)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < abilities.length; i += 1) {
    const start = -Math.PI / 2 + i * slice;
    const end = start + slice;
    const ability = abilities[i];
    const highlighted = i === abilityWheel.hoveredIndex;

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, ABILITY_WHEEL_RADIUS, start, end);
    ctx.closePath();
    ctx.fillStyle = highlighted ? "rgba(80, 174, 243, 0.26)" : "rgba(8, 36, 76, 0.62)";
    if (!ability.unlocked) ctx.fillStyle = highlighted ? "rgba(46, 75, 104, 0.28)" : "rgba(7, 23, 47, 0.56)";
    ctx.fill();
    ctx.strokeStyle = highlighted ? "rgba(220, 251, 255, 0.9)" : "rgba(89, 163, 220, 0.48)";
    ctx.lineWidth = highlighted ? 2 : 1;
    ctx.stroke();

    const angle = start + slice / 2;
    const iconX = centerX + Math.cos(angle) * (ABILITY_WHEEL_RADIUS * 0.64);
    const iconY = centerY + Math.sin(angle) * (ABILITY_WHEEL_RADIUS * 0.64);
    drawAbilityTile(ability, iconX, iconY, 42, {
      highlighted,
      selected: ability.id === selectedAbilityId,
      showReadyPulse: false
    });

    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = ability.unlocked ? "rgba(238, 251, 255, 0.92)" : "rgba(160, 183, 204, 0.58)";
    ctx.fillText(ability.label, centerX + Math.cos(angle) * (ABILITY_WHEEL_RADIUS + 23), centerY + Math.sin(angle) * (ABILITY_WHEEL_RADIUS + 23));
  }

  ctx.beginPath();
  ctx.arc(centerX, centerY, ABILITY_WHEEL_INNER_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(4, 20, 48, 0.88)";
  ctx.fill();
  ctx.strokeStyle = "rgba(156, 221, 255, 0.76)";
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.font = "10px system-ui, sans-serif";
  ctx.fillStyle = "rgba(236, 250, 255, 0.86)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("E", centerX, centerY - 5);
  ctx.fillStyle = "rgba(158, 214, 247, 0.72)";
  ctx.fillText("release", centerX, centerY + 8);
  ctx.restore();
}

function getHudPlacement(width, height) {
  const placement = {
    x: canvas.width - HUD_MARGIN - width,
    y: HUD_MARGIN,
    w: width,
    h: height
  };

  // Keep the screen-space HP counter visually below any visible ceiling/level
  // geometry so flipped-gravity play never hides the diamonds in a platform.
  let moved = true;
  while (moved) {
    moved = false;
    for (const platform of platforms) {
      const screenPlatform = {
        x: platform.x - cameraX,
        y: platform.y,
        w: platform.w,
        h: platform.h
      };

      if (!rectsOverlap(placement, screenPlatform)) continue;
      placement.y = screenPlatform.y + screenPlatform.h + HP_DIAMOND_SPACING;
      moved = true;
    }
  }

  return placement;
}

function drawHud() {
  const maxHp = Math.max(0, player.maxHp ?? 3);
  const currentHp = clamp(player.hp, 0, maxHp);
  if (maxHp <= 0) return;

  const rowWidth = maxHp * HP_DIAMOND_SIZE + (maxHp - 1) * HP_DIAMOND_SPACING;
  const placement = getHudPlacement(rowWidth, HP_DIAMOND_SIZE);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  for (let i = 0; i < maxHp; i += 1) {
    const x = placement.x + i * (HP_DIAMOND_SIZE + HP_DIAMOND_SPACING);
    const isFilled = i < currentHp;
    drawDiamond(x, placement.y, HP_DIAMOND_SIZE, isFilled);
  }
  ctx.restore();
}


function drawAnchorFieldInstance(field, alpha = 1) {
  if (!field || alpha <= 0) return;
  const hum = 0.86 + Math.sin((field.age ?? 0) * 5) * 0.08;
  const radius = field.radius;

  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = ANCHOR_SILVER_SHADOW;
  ctx.shadowBlur = 24;

  // Keep this activation flash independent from the smaller enemy anchor-lock
  // indicator so captured enemies do not inherit the stronger full-field bloom.
  const fill = ctx.createRadialGradient(field.x, field.y, radius * 0.04, field.x, field.y, radius);
  fill.addColorStop(0, "rgba(255, 255, 255, 0.20)");
  fill.addColorStop(0.42, "rgba(205, 218, 235, 0.14)");
  fill.addColorStop(0.78, "rgba(76, 86, 104, 0.16)");
  fill.addColorStop(1, "rgba(22, 27, 36, 0.04)");
  ctx.fillStyle = fill;
  ctx.strokeStyle = `rgba(245, 248, 255, ${Math.min(1, hum + 0.08)})`;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(field.x, field.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 18;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.48)";
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(field.x, field.y, radius * 0.72, 0, Math.PI * 2);
  ctx.stroke();

  ctx.shadowBlur = 10;
  ctx.strokeStyle = "rgba(234, 240, 252, 0.74)";
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 4; i += 1) {
    const angle = i * Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(field.x + Math.cos(angle) * 14, field.y + Math.sin(angle) * 14);
    ctx.lineTo(field.x + Math.cos(angle) * radius * 0.86, field.y + Math.sin(angle) * radius * 0.86);
    ctx.stroke();
  }

  ctx.strokeStyle = ANCHOR_SILVER_STROKE;
  ctx.fillStyle = ANCHOR_SILVER_CORE;
  ctx.lineWidth = 1.7;
  const diamond = 15;
  ctx.beginPath();
  ctx.moveTo(field.x, field.y - diamond);
  ctx.lineTo(field.x + diamond, field.y);
  ctx.lineTo(field.x, field.y + diamond);
  ctx.lineTo(field.x - diamond, field.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawAnchorFields() {
  if (anchorFieldFade) {
    const alpha = clamp(anchorFieldFade.fadeRemaining / ANCHOR_FIELD_FADE_DURATION, 0, 1);
    drawAnchorFieldInstance(anchorFieldFade, alpha);
  }
}

function drawSelectedAbilityRangePreview() {
  if (!keys.has("q")) return;

  const ability = getSelectedAbility();
  if (!ability.unlocked) return;

  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  if (ability.id === "gravity") {
    const origin = centerOf(player);
    const interiorGlow = ctx.createRadialGradient(
      origin.x,
      origin.y,
      GRAVITY_FIELD_RADIUS * 0.18,
      origin.x,
      origin.y,
      GRAVITY_FIELD_RADIUS,
    );

    interiorGlow.addColorStop(0, "rgba(135, 255, 198, 0.18)");
    interiorGlow.addColorStop(0.65, "rgba(86, 255, 167, 0.10)");
    interiorGlow.addColorStop(1, "rgba(86, 255, 167, 0.02)");

    ctx.fillStyle = interiorGlow;
    ctx.strokeStyle = "rgba(135, 255, 198, 0.85)";
    ctx.shadowColor = "rgba(135, 255, 198, 0.45)";
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, GRAVITY_FIELD_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (ability.id === "time") {
    const origin = centerOf(player);
    ctx.strokeStyle = "rgba(126, 233, 255, 0.86)";
    ctx.fillStyle = "rgba(47, 203, 255, 0.07)";
    ctx.shadowColor = "rgba(74, 218, 255, 0.38)";
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, TIME_SLOW_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (ability.id === "anchor") {
    const origin = getAnchorFieldOrigin();
    ctx.strokeStyle = "rgba(224, 224, 224, 0.86)";
    ctx.fillStyle = "rgba(192, 192, 192, 0.07)";
    ctx.shadowColor = "rgba(192, 192, 192, 0.42)";
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(origin.x, origin.y, ANCHOR_FIELD_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (ability.id === "pulse") {
    const direction = player.facing || 1;
    const origin = player.getForcePulseHandPoint(direction);
    const centerAngle = direction > 0 ? 0 : Math.PI;
    const upperAngle = centerAngle - FORCE_PULSE_HALF_ANGLE * direction;
    const lowerAngle = centerAngle + FORCE_PULSE_HALF_ANGLE * direction;

    ctx.strokeStyle = "rgba(255, 142, 158, 0.92)";
    ctx.fillStyle = "rgba(255, 36, 64, 0.08)";
    ctx.shadowColor = "rgba(255, 65, 95, 0.42)";
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(origin.x + Math.cos(upperAngle) * FORCE_PULSE_RANGE, origin.y + Math.sin(upperAngle) * FORCE_PULSE_RANGE);
    ctx.arc(origin.x, origin.y, FORCE_PULSE_RANGE, upperAngle, lowerAngle, direction < 0);
    ctx.lineTo(origin.x, origin.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(-cameraX, 0);
  drawRoom();
  drawSelectedAbilityRangePreview();
  drawTimeSlowField();
  drawAnchorFields();
  forcePulseVisuals.forEach((visual) => visual.draw());
  pulses.forEach((pulse) => pulse.draw());
  enemies.forEach((enemy) => enemy.draw());
  droneProjectiles.forEach((projectile) => projectile.draw());
  player.draw();
  ctx.restore();
  drawHud();
  drawSelectedAbilityIcon();
  drawAbilityWheel();
  drawSystemMessages();
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
  if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright", "enter", "e", "q"].includes(key)) event.preventDefault();
  if (!keys.has(key)) pressedThisFrame.add(key);
  keys.add(key);
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  keys.delete(key);
  if (key === "e") eReleasedThisFrame = true;
});

canvas.addEventListener("pointermove", (event) => {
  const bounds = canvas.getBoundingClientRect?.() ?? { left: 0, top: 0, width: canvas.width, height: canvas.height };
  const scaleX = bounds.width ? canvas.width / bounds.width : 1;
  const scaleY = bounds.height ? canvas.height / bounds.height : 1;
  pointerScreen = {
    x: (event.clientX - bounds.left) * scaleX,
    y: (event.clientY - bounds.top) * scaleY
  };
});

canvas.addEventListener("pointerdown", () => {
  if (!abilityWheel.open && !isSystemMessageBlocking()) player.firePulse();
});

window.__indiePlatformerDebug = {
  player,
  enemies,
  platforms,
  spikes,
  phaseBarriers,
  update,
  draw,
  toggleGravityField,
  resetGravityField,
  activateTimeSlow,
  endTimeSlow,
  activatePhaseShift,
  endPhaseShift,
  activateAnchorField,
  endAnchorField,
  isPointInsideAnchorField,
  isPlayerPhased,
  abilities,
  activateSelectedAbility,
  setSelectedAbility: (id) => {
    const ability = abilities.find((candidate) => candidate.id === id);
    return selectAbility(ability);
  },
  castForcePulse,
  forcePulseVisuals,
  droneProjectiles,
  abilityWheel,
  systemDialogue,
  systemMessageTriggers,
  enqueueSystemMessage,
  getSelectedAbility,
  checkpoint,
  safeAnchor,
  bottomFallBoundary,
  constants: { PLAYER_WIDTH, STAND_HEIGHT, CROUCH_HEIGHT, GRAVITY_FIELD_RADIUS, GRAVITY_FIELD_DURATION, TIME_SLOW_RADIUS, TIME_SLOW_DURATION, TIME_SLOW_COOLDOWN, TIME_SLOW_MULTIPLIER, ANCHOR_FIELD_RADIUS, ANCHOR_FIELD_DURATION, ANCHOR_FIELD_COOLDOWN, FORCE_PULSE_RANGE, FORCE_PULSE_KNOCKBACK, FORCE_PULSE_STUN, PHASE_SHIFT_DURATION, PHASE_SHIFT_COOLDOWN }
};

requestAnimationFrame(gameLoop);
})();
