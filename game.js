// === BASKETBALL RUNS ===
'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// === Game state ===
const STATE = { MENU: 0, PLAYING: 1, OVER: 2 };
let state = STATE.MENU;
let score = 0;
let highScore = parseInt(localStorage.getItem('bbr_high') || '0', 10);
let baseSpeed = 12;
let speed = baseSpeed;
let distance = 0;
let spawnTimer = 1.0;

let obstacles = [];
let collectibles = [];
let particles = [];


// === Pseudo-3D perspective ===
function vanishY() { return H * 0.38; }
function groundY() { return H * 0.82; }
function getScale(d) { return 350 / (350 + Math.max(0, d)); }
function projectY(d) {
  const s = getScale(d);
  return vanishY() + (groundY() - vanishY()) * s;
}
function laneXAt(laneIdx, d) {
  const s = getScale(d);
  const baseX = laneIdx === 0 ? W * 0.34 : W * 0.66;
  return W / 2 + (baseX - W / 2) * s;
}
function laneXAtVisual(laneVisual, d) {
  const s = getScale(d);
  const baseLeft = W * 0.34;
  const baseRight = W * 0.66;
  const baseX = baseLeft + (baseRight - baseLeft) * laneVisual;
  return W / 2 + (baseX - W / 2) * s;
}

// === Player ===
const player = {
  lane: 0,        // 0 = left, 1 = right (logical)
  visualLane: 0,  // smooth interpolated for rendering
  y: 0,           // negative when jumping
  vy: 0,
  state: 'run',   // run | crossover | behindBack | slide | dunk
  stateTimer: 0,
  animTime: 0,
};

const ANIM = {
  crossover: 0.35,
  behindBack: 0.35,
  slide: 0.65,
};

const JUMP_VY = -1000;
const GRAVITY = 2800;


// === Spawning patterns ===
function spawnPattern() {
  const r = Math.random();
  const dist = 1500;
  if (r < 0.32) {
    obstacles.push({ kind: 'defender', lane: Math.random() < 0.5 ? 0 : 1, d: dist });
  } else if (r < 0.55) {
    obstacles.push({ kind: 'cone', lane: Math.random() < 0.5 ? 0 : 1, d: dist });
  } else if (r < 0.72) {
    const both = Math.random() < 0.55;
    obstacles.push({
      kind: 'banner',
      lane: both ? -1 : Math.random() < 0.5 ? 0 : 1,
      d: dist,
    });
  } else if (r < 0.88) {
    const lane = Math.random() < 0.5 ? 0 : 1;
    for (let i = 0; i < 4; i++) {
      collectibles.push({ kind: 'ball', lane, d: dist + i * 90 });
    }
  } else {
    // Combo: defender + balls in opposite lane
    const lane = Math.random() < 0.5 ? 0 : 1;
    obstacles.push({ kind: 'defender', lane, d: dist });
    for (let i = 0; i < 3; i++) {
      collectibles.push({ kind: 'ball', lane: 1 - lane, d: dist - 100 + i * 80 });
    }
  }
}

function reset() {
  player.lane = 0;
  player.visualLane = 0;
  player.y = 0;
  player.vy = 0;
  player.state = 'run';
  player.stateTimer = 0;
  player.animTime = 0;
  obstacles = [];
  collectibles = [];
  particles = [];
  speed = baseSpeed;
  distance = 0;
  score = 0;
  spawnTimer = 1.0;
}


// === Update ===
function update(dt) {
  // Particles always update so death effect plays
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 1400 * dt;
    p.life -= dt;
  }
  particles = particles.filter((p) => p.life > 0);

  if (state !== STATE.PLAYING) return;

  // Speed ramp
  speed = baseSpeed + Math.min(distance / 9000, 1) * 10;
  distance += speed;
  score += speed * dt * 2.2;

  // Smooth lane interpolation
  player.visualLane += (player.lane - player.visualLane) * Math.min(1, dt * 14);

  // State timer (for crossover, behindBack, slide)
  if (player.stateTimer > 0) {
    player.stateTimer -= dt;
    if (player.stateTimer <= 0 && player.state !== 'dunk') {
      player.state = 'run';
    }
  }

  // Jump physics (dunk)
  if (player.state === 'dunk') {
    player.y += player.vy * dt;
    player.vy += GRAVITY * dt;
    if (player.y >= 0) {
      player.y = 0;
      player.vy = 0;
      player.state = 'run';
      // Landing dust
      const lx = laneXAtVisual(player.visualLane, 0);
      const ly = projectY(0);
      for (let i = 0; i < 10; i++) {
        particles.push({
          x: lx + (Math.random() - 0.5) * 30,
          y: ly,
          vx: (Math.random() - 0.5) * 250,
          vy: -Math.random() * 120,
          life: 0.45,
          maxLife: 0.45,
          color: '#d9a574',
        });
      }
    }
  }

  // Move obstacles & collectibles toward player
  for (const o of obstacles) o.d -= speed;
  for (const c of collectibles) c.d -= speed;


  // Obstacle collisions (process when crossing the player plane)
  for (const o of obstacles) {
    if (o.processed) continue;
    if (o.d <= 0) {
      o.processed = true;
      const inLane = o.lane === -1 || o.lane === player.lane;
      if (!inLane) continue;
      const evaded =
        (o.kind === 'cone' && player.state === 'dunk' && player.y < -40) ||
        (o.kind === 'banner' && player.state === 'slide');
      if (!evaded) {
        gameOver();
        return;
      }
    }
  }

  // Collectibles
  for (const c of collectibles) {
    if (c.collected) continue;
    if (c.d <= 30 && c.d >= -30 && c.lane === player.lane) {
      c.collected = true;
      score += 50;
      const cx = laneXAtVisual(c.lane, 0);
      const cy = projectY(0) - 60;
      for (let i = 0; i < 8; i++) {
        particles.push({
          x: cx,
          y: cy,
          vx: (Math.random() - 0.5) * 220,
          vy: -Math.random() * 220 - 60,
          life: 0.55,
          maxLife: 0.55,
          color: i % 2 === 0 ? '#ffcc33' : '#ff6b1a',
        });
      }
    }
  }

  // Cleanup
  obstacles = obstacles.filter((o) => o.d > -200);
  collectibles = collectibles.filter((c) => c.d > -200 && !c.collected);

  // Spawn
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnPattern();
    spawnTimer = 0.85 - Math.min(distance / 30000, 0.4);
  }

  player.animTime += dt;

  // HUD
  scoreEl.textContent = Math.floor(score);
}


// === Input handlers ===
function setLane(targetLane) {
  if (state !== STATE.PLAYING) return;
  player.lane = targetLane;
  if (player.state === 'slide' || player.state === 'dunk') return;
  player.state = targetLane === 0 ? 'crossover' : 'behindBack';
  player.stateTimer = ANIM.crossover;
}

function swipeLeft() {
  if (state !== STATE.PLAYING) return;
  if (player.lane === 0) {
    if (player.state !== 'slide' && player.state !== 'dunk') {
      player.state = 'crossover';
      player.stateTimer = ANIM.crossover;
    }
  } else {
    setLane(0);
  }
}

function swipeRight() {
  if (state !== STATE.PLAYING) return;
  if (player.lane === 1) {
    if (player.state !== 'slide' && player.state !== 'dunk') {
      player.state = 'behindBack';
      player.stateTimer = ANIM.behindBack;
    }
  } else {
    setLane(1);
  }
}

function swipeDown() {
  if (state !== STATE.PLAYING) return;
  if (player.state === 'dunk') return; // cannot slide while airborne
  player.state = 'slide';
  player.stateTimer = ANIM.slide;
}

function swipeUp() {
  if (state !== STATE.PLAYING) return;
  if (player.state === 'dunk') return;
  player.state = 'dunk';
  player.vy = JUMP_VY;
  player.y = -1;
  player.stateTimer = 0;
}


// Touch swipe detection
let touchStart = null;
canvas.addEventListener(
  'touchstart',
  (e) => {
    if (state !== STATE.PLAYING) return;
    e.preventDefault();
    const t = e.touches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  },
  { passive: false }
);
canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
canvas.addEventListener(
  'touchend',
  (e) => {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    const min = 30;
    if (Math.max(adx, ady) >= min) {
      if (adx > ady) (dx < 0 ? swipeLeft : swipeRight)();
      else (dy < 0 ? swipeUp : swipeDown)();
    }
    touchStart = null;
  },
  { passive: true }
);

// Keyboard for desktop
window.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'ArrowLeft': case 'a': case 'A': swipeLeft(); break;
    case 'ArrowRight': case 'd': case 'D': swipeRight(); break;
    case 'ArrowUp': case 'w': case 'W': swipeUp(); break;
    case 'ArrowDown': case 's': case 'S': swipeDown(); break;
  }
});


// === Render: court ===
function drawCourt() {
  // Sky / arena
  const sky = ctx.createLinearGradient(0, 0, 0, vanishY());
  sky.addColorStop(0, '#1a0e2e');
  sky.addColorStop(1, '#3a1d4a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, vanishY());

  // Crowd band
  ctx.fillStyle = '#0a0518';
  ctx.fillRect(0, vanishY() - 22, W, 24);
  // Pixel crowd dots
  const crowdColors = ['#ff6b1a', '#ffcc33', '#ffffff', '#4a90e2', '#e74c3c', '#9b59b6'];
  for (let i = 0; i < 80; i++) {
    const cx = (i * 17 + ((distance * 0.04) % 17)) % W;
    const cy = vanishY() - 4 - ((i * 13) % 14);
    ctx.fillStyle = crowdColors[i % crowdColors.length];
    ctx.fillRect(cx, cy, 3, 3);
  }

  // Floor
  const floor = ctx.createLinearGradient(0, vanishY(), 0, H);
  floor.addColorStop(0, '#7a4a22');
  floor.addColorStop(0.5, '#a0703a');
  floor.addColorStop(1, '#d49b5d');
  ctx.fillStyle = floor;
  ctx.fillRect(0, vanishY(), W, H - vanishY());

  // Court boundary lines
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(W / 2, vanishY());
  ctx.lineTo(W * 0.04, H);
  ctx.moveTo(W / 2, vanishY());
  ctx.lineTo(W * 0.96, H);
  ctx.stroke();

  // Center line dashed (between the 2 lanes)
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.setLineDash([18, 22]);
  ctx.lineDashOffset = -((distance * 1.2) % 40);
  ctx.beginPath();
  ctx.moveTo(W / 2, vanishY());
  ctx.lineTo(W / 2, H);
  ctx.stroke();
  ctx.setLineDash([]);

  // Floor stripes for motion
  ctx.strokeStyle = 'rgba(255,255,255,0.13)';
  ctx.lineWidth = 2;
  const spacing = 80;
  const offset = ((distance % spacing) + spacing) % spacing;
  for (let i = 0; i < 22; i++) {
    const d = (i * spacing) - offset + spacing;
    if (d < 0 || d > 1700) continue;
    const y = projectY(d);
    const xL = W / 2 + (W * 0.04 - W / 2) * getScale(d);
    const xR = W / 2 + (W * 0.96 - W / 2) * getScale(d);
    ctx.beginPath();
    ctx.moveTo(xL, y);
    ctx.lineTo(xR, y);
    ctx.stroke();
  }
}


// === Render: basketball helper ===
function drawBasketball(x, y, r, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.2, 0, 0, r);
  grad.addColorStop(0, '#ffae6b');
  grad.addColorStop(1, '#c44a10');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1a0a00';
  ctx.lineWidth = Math.max(1, r * 0.1);
  ctx.beginPath();
  ctx.moveTo(-r, 0); ctx.lineTo(r, 0);
  ctx.moveTo(0, -r); ctx.lineTo(0, r);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI * 0.62, -Math.PI * 0.38);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r, Math.PI * 0.38, Math.PI * 0.62);
  ctx.stroke();
  ctx.restore();
}

// === Render: obstacles ===
function drawObstacle(o) {
  const d = o.d;
  if (d > 1700) return;
  const scale = getScale(d);
  const y = projectY(d);

  if (o.kind === 'banner' && o.lane === -1) {
    // Banner spanning both lanes
    const xL = laneXAt(0, d);
    const xR = laneXAt(1, d);
    const w = (xR - xL) + 220 * scale;
    const h = 64 * scale;
    const cy = y - 230 * scale;
    ctx.fillStyle = '#1a0a00';
    ctx.fillRect(xL - 110 * scale, cy - 4, w, h + 8);
    ctx.fillStyle = '#c8102e';
    ctx.fillRect(xL - 110 * scale, cy, w, h);
    ctx.fillStyle = '#ffcc33';
    ctx.fillRect(xL - 110 * scale, cy + h - 6 * scale, w, 4 * scale);
    ctx.fillStyle = '#fff';
    ctx.font = `900 ${30 * scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CHAMPS', (xL + xR) / 2, cy + h / 2);
    return;
  }

  const x = laneXAt(o.lane, d);

  if (o.kind === 'defender') {
    drawDefender(x, y, scale);
  } else if (o.kind === 'cone') {
    drawCone(x, y, scale);
  } else if (o.kind === 'banner') {
    drawSingleBanner(x, y, scale);
  }
}


function drawDefender(x, y, scale) {
  const h = 200 * scale;
  const w = 56 * scale;
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y + 2, w * 0.7, w * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  // Legs (shorts)
  ctx.fillStyle = '#1a3a8a';
  ctx.fillRect(x - w * 0.4, y - h * 0.45, w * 0.3, h * 0.2);
  ctx.fillRect(x + w * 0.1, y - h * 0.45, w * 0.3, h * 0.2);
  // Lower legs
  ctx.fillStyle = '#5a3520';
  ctx.fillRect(x - w * 0.36, y - h * 0.25, w * 0.22, h * 0.22);
  ctx.fillRect(x + w * 0.14, y - h * 0.25, w * 0.22, h * 0.22);
  // Sneakers
  ctx.fillStyle = '#fff';
  ctx.fillRect(x - w * 0.42, y - 4 * scale, w * 0.32, 8 * scale);
  ctx.fillRect(x + w * 0.1, y - 4 * scale, w * 0.32, 8 * scale);
  // Jersey (blue)
  const jg = ctx.createLinearGradient(0, y - h, 0, y - h * 0.45);
  jg.addColorStop(0, '#3a76e8');
  jg.addColorStop(1, '#1a3a8a');
  ctx.fillStyle = jg;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.5, y - h * 0.45);
  ctx.lineTo(x + w * 0.5, y - h * 0.45);
  ctx.lineTo(x + w * 0.45, y - h * 0.78);
  ctx.lineTo(x - w * 0.45, y - h * 0.78);
  ctx.closePath();
  ctx.fill();
  // Number
  ctx.fillStyle = '#fff';
  ctx.font = `900 ${22 * scale}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('23', x, y - h * 0.6);
  // Arms out (defending pose)
  ctx.fillStyle = '#5a3520';
  ctx.fillRect(x - w * 1.05, y - h * 0.78, w * 0.3, w * 0.22);
  ctx.fillRect(x + w * 0.75, y - h * 0.78, w * 0.3, w * 0.22);
  // Hands (open)
  ctx.beginPath();
  ctx.arc(x - w * 1.1, y - h * 0.78 + w * 0.11, w * 0.18, 0, Math.PI * 2);
  ctx.arc(x + w * 1.1, y - h * 0.78 + w * 0.11, w * 0.18, 0, Math.PI * 2);
  ctx.fill();
  // Head
  ctx.fillStyle = '#5a3520';
  ctx.beginPath();
  ctx.arc(x, y - h * 0.88, w * 0.32, 0, Math.PI * 2);
  ctx.fill();
  // Hair
  ctx.fillStyle = '#1a0e08';
  ctx.beginPath();
  ctx.arc(x, y - h * 0.92, w * 0.32, Math.PI, 0);
  ctx.fill();
}


function drawCone(x, y, scale) {
  const h = 56 * scale;
  const w = 40 * scale;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y + 2, w * 0.65, w * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  // Base
  ctx.fillStyle = '#c44a10';
  ctx.fillRect(x - w * 0.6, y - 4 * scale, w * 1.2, 6 * scale);
  // Cone body
  const cg = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  cg.addColorStop(0, '#c44a10');
  cg.addColorStop(0.5, '#ff6b1a');
  cg.addColorStop(1, '#c44a10');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.lineTo(x + w / 2, y - 2 * scale);
  ctx.lineTo(x - w / 2, y - 2 * scale);
  ctx.closePath();
  ctx.fill();
  // White stripe
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(x - w * 0.3, y - h * 0.5);
  ctx.lineTo(x + w * 0.3, y - h * 0.5);
  ctx.lineTo(x + w * 0.36, y - h * 0.38);
  ctx.lineTo(x - w * 0.36, y - h * 0.38);
  ctx.closePath();
  ctx.fill();
}

function drawSingleBanner(x, y, scale) {
  const w = 110 * scale;
  const h = 56 * scale;
  const cy = y - 230 * scale;
  // Strings
  ctx.strokeStyle = '#666';
  ctx.lineWidth = Math.max(1, 2 * scale);
  ctx.beginPath();
  ctx.moveTo(x - w * 0.4, cy);
  ctx.lineTo(x - w * 0.4, cy - 36 * scale);
  ctx.moveTo(x + w * 0.4, cy);
  ctx.lineTo(x + w * 0.4, cy - 36 * scale);
  ctx.stroke();
  ctx.fillStyle = '#1a0a00';
  ctx.fillRect(x - w / 2 - 2, cy - 4, w + 4, h + 8);
  ctx.fillStyle = '#c8102e';
  ctx.fillRect(x - w / 2, cy, w, h);
  ctx.fillStyle = '#ffcc33';
  ctx.fillRect(x - w / 2, cy + h - 6 * scale, w, 4 * scale);
  ctx.fillStyle = '#fff';
  ctx.font = `900 ${22 * scale}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SLAM', x, cy + h / 2);
}

function drawCollectible(c) {
  const d = c.d;
  if (d > 1700) return;
  const scale = getScale(d);
  const x = laneXAt(c.lane, d);
  const bob = Math.sin((distance + d) * 0.012) * 6 * scale;
  const y = projectY(d) - 70 * scale + bob;
  // Glow
  const grad = ctx.createRadialGradient(x, y, 0, x, y, 36 * scale);
  grad.addColorStop(0, 'rgba(255,200,80,0.5)');
  grad.addColorStop(1, 'rgba(255,200,80,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, 36 * scale, 0, Math.PI * 2);
  ctx.fill();
  drawBasketball(x, y, 18 * scale, distance * 0.02);
}


// === Render: player ===
function drawPlayer() {
  const x = laneXAtVisual(player.visualLane, 0);
  const groundYpos = projectY(0);
  const baseY = groundYpos + player.y;

  // Shadow (smaller when airborne)
  const airFactor = Math.max(0, Math.min(1, -player.y / 200));
  const shadowAlpha = 0.45 * (1 - airFactor * 0.7);
  const shadowScale = 1 - airFactor * 0.4;
  ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
  ctx.beginPath();
  ctx.ellipse(x, groundYpos + 6, 50 * shadowScale, 13 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Animation params per state
  let lean = 0;
  let ballPos = 'dribble';
  let isSlide = false;

  if (player.state === 'crossover') {
    const t = 1 - player.stateTimer / ANIM.crossover;
    lean = Math.sin(t * Math.PI) * -0.45;
    ballPos = 'cross';
  } else if (player.state === 'behindBack') {
    const t = 1 - player.stateTimer / ANIM.behindBack;
    lean = Math.sin(t * Math.PI) * 0.45;
    ballPos = 'behind';
  } else if (player.state === 'slide') {
    isSlide = true;
    ballPos = 'forward';
  } else if (player.state === 'dunk') {
    ballPos = 'dunk';
  }

  ctx.save();
  ctx.translate(x, baseY);
  ctx.rotate(lean);

  // Run cycle
  const runT = player.animTime * 14;
  const isRunningPose = !isSlide && player.state !== 'dunk';
  const legSwing = isRunningPose ? Math.sin(runT) * 14 : 0;
  const bodyBob = isRunningPose ? -Math.abs(Math.sin(runT * 2)) * 4 : 0;
  ctx.translate(0, bodyBob);

  if (isSlide) {
    // Compress vertically, stretch horizontally to look slid
    ctx.scale(1.35, 0.45);
  }

  drawPlayerBody(legSwing, runT, ballPos);

  ctx.restore();
}


function drawPlayerBody(legSwing, runT, ballPos) {
  // Shorts (red)
  ctx.fillStyle = '#c8102e';
  ctx.beginPath();
  ctx.moveTo(-24, -78);
  ctx.lineTo(24, -78);
  ctx.lineTo(30, -46);
  ctx.lineTo(-30, -46);
  ctx.closePath();
  ctx.fill();
  // Shorts trim
  ctx.fillStyle = '#fff';
  ctx.fillRect(-30, -50, 60, 3);

  // Legs
  ctx.strokeStyle = '#5a3520';
  ctx.lineWidth = 13;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-12, -46);
  ctx.lineTo(-12 + legSwing * 0.3, -22);
  ctx.lineTo(-15 + legSwing, -2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(12, -46);
  ctx.lineTo(12 - legSwing * 0.3, -22);
  ctx.lineTo(15 - legSwing, -2);
  ctx.stroke();

  // Sneakers
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.ellipse(-15 + legSwing, 0, 15, 7, 0, 0, Math.PI * 2);
  ctx.ellipse(15 - legSwing, 0, 15, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  // Sneaker stripe
  ctx.fillStyle = '#ff6b1a';
  ctx.fillRect(-23 + legSwing, -3, 16, 3);
  ctx.fillRect(7 - legSwing, -3, 16, 3);

  // Torso (jersey)
  const jersey = ctx.createLinearGradient(0, -135, 0, -78);
  jersey.addColorStop(0, '#e74c3c');
  jersey.addColorStop(1, '#c8102e');
  ctx.fillStyle = jersey;
  ctx.beginPath();
  ctx.moveTo(-26, -135);
  ctx.lineTo(26, -135);
  ctx.lineTo(30, -78);
  ctx.lineTo(-30, -78);
  ctx.closePath();
  ctx.fill();
  // Jersey number
  ctx.fillStyle = '#fff';
  ctx.font = '900 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('1', 0, -104);

  // Neck
  ctx.fillStyle = '#5a3520';
  ctx.fillRect(-7, -145, 14, 12);

  // Head
  ctx.fillStyle = '#5a3520';
  ctx.beginPath();
  ctx.arc(0, -160, 18, 0, Math.PI * 2);
  ctx.fill();
  // Hair
  ctx.fillStyle = '#1a0e08';
  ctx.beginPath();
  ctx.arc(0, -165, 18, Math.PI, 0);
  ctx.fill();
  // Headband
  ctx.fillStyle = '#ff6b1a';
  ctx.fillRect(-19, -167, 38, 5);
  // Eyes
  ctx.fillStyle = '#fff';
  ctx.fillRect(-9, -160, 5, 4);
  ctx.fillRect(4, -160, 5, 4);
  ctx.fillStyle = '#1a0a00';
  ctx.fillRect(-7, -160, 3, 4);
  ctx.fillRect(5, -160, 3, 4);

  // Arms + ball
  ctx.strokeStyle = '#5a3520';
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';

  drawArmsAndBall(ballPos, runT, legSwing);
}


function drawArmsAndBall(ballPos, runT, legSwing) {
  if (ballPos === 'dribble') {
    const dribbleY = -10 + Math.abs(Math.sin(runT * 2)) * 28;
    // Right arm down dribbling
    ctx.beginPath();
    ctx.moveTo(22, -130);
    ctx.lineTo(32, -90);
    ctx.lineTo(40, -50);
    ctx.stroke();
    drawBasketball(42, dribbleY, 13, runT);
    // Left arm pumping
    ctx.beginPath();
    ctx.moveTo(-22, -130);
    ctx.lineTo(-28 - legSwing * 0.5, -95);
    ctx.lineTo(-34 - legSwing, -68);
    ctx.stroke();
  } else if (ballPos === 'cross') {
    const t = 1 - player.stateTimer / ANIM.crossover;
    const k = Math.sin(t * Math.PI);
    const ballX = -18 - 32 * k;
    const ballY = -22 + 12 * k;
    // Left arm reaching low across body
    ctx.beginPath();
    ctx.moveTo(-22, -130);
    ctx.lineTo(-30, -90);
    ctx.lineTo(ballX + 5, ballY - 10);
    ctx.stroke();
    // Right arm pulled back
    ctx.beginPath();
    ctx.moveTo(22, -130);
    ctx.lineTo(34, -100);
    ctx.lineTo(44, -82);
    ctx.stroke();
    drawBasketball(ballX, ballY, 13, t * 5);
    // Motion lines
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-50 - i * 8, -60 - i * 4);
      ctx.lineTo(-30 - i * 8, -60 - i * 4);
      ctx.stroke();
    }
  } else if (ballPos === 'behind') {
    const t = 1 - player.stateTimer / ANIM.behindBack;
    const k = Math.sin(t * Math.PI);
    const ballX = -8 + 36 * k;
    const ballY = -56;
    // Left arm reaching behind back
    ctx.beginPath();
    ctx.moveTo(-22, -130);
    ctx.lineTo(-2, -100);
    ctx.lineTo(ballX - 6, ballY);
    ctx.stroke();
    // Right arm extended forward
    ctx.beginPath();
    ctx.moveTo(22, -130);
    ctx.lineTo(38, -102);
    ctx.lineTo(50, -88);
    ctx.stroke();
    drawBasketball(ballX, ballY, 13, -t * 5);
    // Motion lines (right side)
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(50 + i * 8, -60 - i * 4);
      ctx.lineTo(30 + i * 8, -60 - i * 4);
      ctx.stroke();
    }
  } else if (ballPos === 'forward') {
    // Slide: arms forward, ball tucked at chest
    ctx.beginPath();
    ctx.moveTo(22, -130);
    ctx.lineTo(45, -115);
    ctx.lineTo(60, -105);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-22, -130);
    ctx.lineTo(-45, -115);
    ctx.lineTo(-60, -105);
    ctx.stroke();
    drawBasketball(0, -100, 13, player.animTime * 6);
  } else if (ballPos === 'dunk') {
    // Dunk: arm raised holding ball overhead
    ctx.beginPath();
    ctx.moveTo(15, -130);
    ctx.lineTo(22, -170);
    ctx.lineTo(18, -210);
    ctx.stroke();
    // Off-arm extended
    ctx.beginPath();
    ctx.moveTo(-15, -130);
    ctx.lineTo(-32, -112);
    ctx.lineTo(-44, -96);
    ctx.stroke();
    drawBasketball(18, -224, 15, player.animTime * 8);
  }
}


// === Particles & main render ===
function drawParticles() {
  for (const p of particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color || '#ffffff';
    ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
  }
  ctx.globalAlpha = 1;
}

function render() {
  ctx.clearRect(0, 0, W, H);
  drawCourt();

  // Sort entities by depth so far things render first
  const all = [];
  for (const o of obstacles) all.push({ kind: 'o', d: o.d, ref: o });
  for (const c of collectibles) all.push({ kind: 'c', d: c.d, ref: c });
  all.sort((a, b) => b.d - a.d);

  for (const e of all) {
    if (e.d < -50) continue;
    if (e.kind === 'o') drawObstacle(e.ref);
    else if (!e.ref.collected) drawCollectible(e.ref);
  }

  if (state !== STATE.MENU) drawPlayer();
  drawParticles();
}

// === Loop ===
let lastT = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - lastT) / 1000);
  lastT = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}


// === UI hookup ===
const menuEl = document.getElementById('menu');
const gameOverEl = document.getElementById('gameover');
const hudEl = document.getElementById('hud');
const scoreEl = document.getElementById('score');
const finalScoreEl = document.getElementById('final-score-val');
const highScoreEl = document.getElementById('high-score-val');

document.getElementById('play-btn').addEventListener('click', startGame);
document.getElementById('retry-btn').addEventListener('click', startGame);

function startGame() {
  reset();
  state = STATE.PLAYING;
  menuEl.classList.add('hidden');
  gameOverEl.classList.add('hidden');
  hudEl.classList.remove('hidden');
  scoreEl.textContent = '0';
}

function gameOver() {
  state = STATE.OVER;
  const finalScore = Math.floor(score);
  if (finalScore > highScore) {
    highScore = finalScore;
    localStorage.setItem('bbr_high', String(highScore));
  }
  finalScoreEl.textContent = finalScore;
  highScoreEl.textContent = highScore;
  gameOverEl.classList.remove('hidden');
  hudEl.classList.add('hidden');
  // Crash burst
  const px = laneXAtVisual(player.visualLane, 0);
  const py = projectY(0);
  for (let i = 0; i < 36; i++) {
    particles.push({
      x: px,
      y: py - 80,
      vx: (Math.random() - 0.5) * 700,
      vy: -Math.random() * 500 - 80,
      life: 1.0,
      maxLife: 1.0,
      color: ['#ff6b1a', '#ffcc33', '#ffffff', '#c8102e'][i % 4],
    });
  }
}

requestAnimationFrame(loop);
