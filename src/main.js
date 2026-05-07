// Visible main.js edit for GitHub sync check.
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// Codex GitHub visibility test comment.

const keys = {};
const previousKeys = {};

const movement = {
  acceleration: 0.7,
  friction: 0.82,
  gravity: 0.8,
  maxFallSpeed: 18,
  coyoteTime: 8,
  jumpBufferTime: 8,
  jumpCutMultiplier: 0.45
};

const player = {
  x: 100,
  y: 380,
  w: 28,
  h: 48,
  vx: 0,
  vy: 0,
  maxSpeed: 4.8,
  jumpPower: -15,
  onGround: false,
  coyoteTimer: 0,
  jumpBufferTimer: 0
};

const platforms = [
  { x: 0, y: 470, w: 960, h: 70 },
  { x: 360, y: 360, w: 180, h: 20 }
];

window.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
});

window.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
});

function isJumpPressed() {
  return keys["w"] || keys[" "] || keys["arrowup"];
}

function wasJumpPressed() {
  return previousKeys["w"] || previousKeys[" "] || previousKeys["arrowup"];
}

function isJumpJustPressed() {
  return isJumpPressed() && !wasJumpPressed();
}

function isJumpJustReleased() {
  return !isJumpPressed() && wasJumpPressed();
}

function isTouching(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function moveHorizontally() {
  const moveLeft = keys["a"] || keys["arrowleft"];
  const moveRight = keys["d"] || keys["arrowright"];
  const input = Number(moveRight) - Number(moveLeft);

  if (input !== 0) {
    player.vx += input * movement.acceleration;
    player.vx = Math.max(-player.maxSpeed, Math.min(player.vx, player.maxSpeed));
  } else {
    player.vx *= movement.friction;

    if (Math.abs(player.vx) < 0.05) {
      player.vx = 0;
    }
  }

  player.x += player.vx;

  for (const p of platforms) {
    if (!isTouching(player, p)) continue;

    if (player.vx > 0) {
      player.x = p.x - player.w;
    } else if (player.vx < 0) {
      player.x = p.x + p.w;
    }

    player.vx = 0;
  }

  if (player.x < 0) {
    player.x = 0;
    player.vx = 0;
  }

  if (player.x + player.w > canvas.width) {
    player.x = canvas.width - player.w;
    player.vx = 0;
  }
}

function moveVertically() {
  player.vy = Math.min(player.vy + movement.gravity, movement.maxFallSpeed);
  player.y += player.vy;
  player.onGround = false;

  for (const p of platforms) {
    if (!isTouching(player, p)) continue;

    if (player.vy > 0) {
      player.y = p.y - player.h;
      player.onGround = true;
    } else if (player.vy < 0) {
      player.y = p.y + p.h;
    }

    player.vy = 0;
  }
}

function updateJumpTimers() {
  if (player.onGround) {
    player.coyoteTimer = movement.coyoteTime;
  } else if (player.coyoteTimer > 0) {
    player.coyoteTimer -= 1;
  }

  if (isJumpJustPressed()) {
    player.jumpBufferTimer = movement.jumpBufferTime;
  } else if (player.jumpBufferTimer > 0) {
    player.jumpBufferTimer -= 1;
  }
}

function applyJump() {
  // Coyote time lets a jump still fire for a few frames after leaving a ledge.
  if (player.jumpBufferTimer > 0 && player.coyoteTimer > 0) {
    player.vy = player.jumpPower;
    player.onGround = false;
    player.coyoteTimer = 0;
    player.jumpBufferTimer = 0;
  }

  // Releasing jump early cuts upward velocity for a shorter, controllable hop.
  if (isJumpJustReleased() && player.vy < 0) {
    player.vy *= movement.jumpCutMultiplier;
  }
}

function rememberInputState() {
  previousKeys["a"] = keys["a"];
  previousKeys["d"] = keys["d"];
  previousKeys["w"] = keys["w"];
  previousKeys[" "] = keys[" "];
  previousKeys["arrowleft"] = keys["arrowleft"];
  previousKeys["arrowright"] = keys["arrowright"];
  previousKeys["arrowup"] = keys["arrowup"];
}

function update() {
  updateJumpTimers();
  applyJump();
  moveHorizontally();
  moveVertically();
  rememberInputState();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(80, 140, 200, 0.12)";
  ctx.lineWidth = 1;

  for (let x = 0; x < canvas.width; x += 40) {
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

  ctx.fillStyle = "#1a3147";
  for (const p of platforms) {
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }

  ctx.fillStyle = "#dff6ff";
  ctx.fillRect(player.x, player.y, player.w, player.h);

  ctx.fillStyle = "#dff6ff";
  ctx.font = "18px Arial";
  ctx.fillText("Indie Platformer Prototype", 20, 30);
  ctx.fillText("Move: A/D or Arrows | Jump: W/Space/Up", 20, 55);
}

function gameLoop() {
  update();
  draw();
  requestAnimationFrame(gameLoop);
}

gameLoop();
