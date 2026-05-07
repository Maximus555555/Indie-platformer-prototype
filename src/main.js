const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const keys = {};

const player = {
  x: 100,
  y: 380,
  w: 28,
  h: 48,
  vx: 0,
  vy: 0,
  speed: 4,
  jumpPower: -15,
  onGround: false
};

const gravity = 0.8;

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

function update() {
  player.vx = 0;

  if (keys["a"] || keys["arrowleft"]) {
    player.vx = -player.speed;
  }

  if (keys["d"] || keys["arrowright"]) {
    player.vx = player.speed;
  }

  if ((keys["w"] || keys[" "] || keys["arrowup"]) && player.onGround) {
    player.vy = player.jumpPower;
    player.onGround = false;
  }

  player.vy += gravity;

  player.x += player.vx;
  player.y += player.vy;

  player.onGround = false;

  for (const p of platforms) {
    const touching =
      player.x < p.x + p.w &&
      player.x + player.w > p.x &&
      player.y < p.y + p.h &&
      player.y + player.h > p.y;

    if (touching && player.vy >= 0) {
      player.y = p.y - player.h;
      player.vy = 0;
      player.onGround = true;
    }
  }

  if (player.x < 0) player.x = 0;
  if (player.x + player.w > canvas.width) player.x = canvas.width - player.w;
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

functEOF
