// === HOOP RUSH — 3-lane street runner ===
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
const STATE = { MENU: 0, PLAYING: 1, PAUSED: 2, OVER: 3 };
let state = STATE.MENU;
let menuView = 'main'; // main | skins | howto

let score = 0;
let coins = 0;            // coins this run
let totalCoins = parseInt(localStorage.getItem('hr_coins') || '0', 10);
let highScore = parseInt(localStorage.getItem('hr_high') || '0', 10);

const baseSpeed = 11;
let speed = baseSpeed;
let distance = 0;
let runDistanceM = 0;     // meters for HUD
let spawnTimer = 1.0;

let obstacles = [];
let collectibles = [];
let particles = [];
let scenery = [];

// Power-ups (timers in seconds; 0 = inactive)
const power = { magnet: 0, multi: 0, shield: 0, rocket: 0 };

// === Skins ===
// All skins are unlocked by default for fun OR cost coins
const SKINS = [
  { id: 'rookie',  name: 'ROOKIE',  cost: 0,    jersey1: '#e74c3c', jersey2: '#c8102e', shorts: '#1a2330', skinTone: '#d49b6b', hair: '#1a0e08', headband: '#ff8c3a', shoeStripe: '#ff8c3a', number: '1' },
  { id: 'allstar', name: 'ALL-STAR', cost: 200,  jersey1: '#9b59b6', jersey2: '#6a2a8a', shorts: '#fff7d0', skinTone: '#c08850', hair: '#3a1a08', headband: '#ffd84a', shoeStripe: '#ffd84a', number: '7' },
  { id: 'champ',   name: 'CHAMP',    cost: 500,  jersey1: '#2ea83a', jersey2: '#176022', shorts: '#fff',    skinTone: '#5a3520', hair: '#0a0500', headband: '#fff',    shoeStripe: '#2ea83a', number: '23' },
  { id: 'mvp',     name: 'MVP',      cost: 1000, jersey1: '#ffd84a', jersey2: '#c8a022', shorts: '#1a2330', skinTone: '#e6c090', hair: '#c8a022', headband: '#fff',    shoeStripe: '#ffd84a', number: '0' },
  { id: 'shadow',  name: 'SHADOW',   cost: 1500, jersey1: '#3a3a4a', jersey2: '#0a0a14', shorts: '#0a0a14', skinTone: '#a07050', hair: '#1a1a24', headband: '#ff3a3a', shoeStripe: '#ff3a3a', number: '8' },
  { id: 'ice',     name: 'ICE',      cost: 2000, jersey1: '#a8e0ff', jersey2: '#3a98e8', shorts: '#fff',    skinTone: '#e8c8a8', hair: '#dfe8f2', headband: '#3a98e8', shoeStripe: '#a8e0ff', number: '3' },
];

let unlockedSkins = JSON.parse(localStorage.getItem('hr_unlocked') || '["rookie"]');
let currentSkinId = localStorage.getItem('hr_skin') || 'rookie';

function getSkin() {
  return SKINS.find((s) => s.id === currentSkinId) || SKINS[0];
}
function saveProgress() {
  localStorage.setItem('hr_coins', String(totalCoins));
  localStorage.setItem('hr_high', String(highScore));
  localStorage.setItem('hr_unlocked', JSON.stringify(unlockedSkins));
  localStorage.setItem('hr_skin', currentSkinId);
}

// === Pseudo-3D perspective for 3 lanes ===
function vanishY() { return H * 0.36; }
function groundY() { return H * 0.84; }
function getScale(d) { return 360 / (360 + Math.max(0, d)); }
function projectY(d) {
  const s = getScale(d);
  return vanishY() + (groundY() - vanishY()) * s;
}
// Lane 0 = left, 1 = center, 2 = right
const LANE_BASE_X = [0.32, 0.50, 0.68]; // fraction of W at ground
function laneXAt(laneIdx, d) {
  const s = getScale(d);
  const baseX = LANE_BASE_X[laneIdx] * W;
  return W / 2 + (baseX - W / 2) * s;
}
function laneXAtVisual(laneVisual, d) {
  const s = getScale(d);
  // interpolate between LANE_BASE_X positions based on float lane
  const i0 = Math.floor(laneVisual);
  const i1 = Math.min(2, i0 + 1);
  const f = laneVisual - i0;
  const baseX = (LANE_BASE_X[i0] + (LANE_BASE_X[i1] - LANE_BASE_X[i0]) * f) * W;
  return W / 2 + (baseX - W / 2) * s;
}
// Edges of the street (slightly outside outer lanes)
function streetEdgeXAt(side, d) {
  const s = getScale(d);
  const baseX = (side === 'L' ? 0.18 : 0.82) * W;
  return W / 2 + (baseX - W / 2) * s;
}

// === Player ===
const player = {
  lane: 1,
  visualLane: 1,
  y: 0,
  vy: 0,
  state: 'run',          // run | crossover | slide | dunk | rocket
  stateTimer: 0,
  animTime: 0,
  trail: 0,
};

const ANIM = { lanechange: 0.22, slide: 0.85 };
const JUMP_VY = -1080;
const GRAVITY = 2950;

// === Spawning ===
// difficulty rises with distance
function difficulty() {
  return Math.min(1, distance / 28000);
}

function spawnPattern() {
  if (power.rocket > 0) return; // no danger spawns during rocket
  const r = Math.random();
  const d = 1700;
  const diff = difficulty();

  // Coin row
  if (r < 0.30) {
    const lane = Math.floor(Math.random() * 3);
    const count = 5 + Math.floor(Math.random() * 4);
    const pattern = Math.random();
    for (let i = 0; i < count; i++) {
      let cy = 0;
      if (pattern < 0.2) cy = -Math.sin((i / (count - 1)) * Math.PI) * 90; // arc up
      collectibles.push({ kind: 'coin', lane, d: d + i * 70, yOff: cy });
    }
    return;
  }

  // Power-up
  if (r < 0.36) {
    const kinds = ['magnet', 'multi', 'shield'];
    if (diff > 0.4) kinds.push('rocket');
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const lane = Math.floor(Math.random() * 3);
    collectibles.push({ kind: 'powerup', sub: kind, lane, d });
    return;
  }

  // Single defender
  if (r < 0.50) {
    obstacles.push({ kind: 'defender', lane: Math.floor(Math.random() * 3), d });
    return;
  }

  // Cone
  if (r < 0.62) {
    obstacles.push({ kind: 'cone', lane: Math.floor(Math.random() * 3), d });
    return;
  }

  // Hurdle (slide under) — single lane
  if (r < 0.72) {
    obstacles.push({ kind: 'hurdle', lane: Math.floor(Math.random() * 3), d });
    return;
  }

  // Trash bin (jump over OR change lane)
  if (r < 0.80) {
    obstacles.push({ kind: 'bin', lane: Math.floor(Math.random() * 3), d });
    return;
  }

  // Full-width hurdle (must slide)
  if (r < 0.86) {
    obstacles.push({ kind: 'hurdle', lane: 0, d });
    obstacles.push({ kind: 'hurdle', lane: 1, d });
    obstacles.push({ kind: 'hurdle', lane: 2, d });
    return;
  }

  // Two-lane block: leaves one open lane
  if (r < 0.94) {
    const open = Math.floor(Math.random() * 3);
    const kindA = Math.random() < 0.5 ? 'cone' : 'bin';
    const kindB = Math.random() < 0.5 ? 'defender' : 'cone';
    for (let l = 0; l < 3; l++) {
      if (l === open) {
        // sometimes drop coins in the open lane
        if (Math.random() < 0.6) {
          for (let i = 0; i < 3; i++) collectibles.push({ kind: 'coin', lane: l, d: d - 60 + i * 70 });
        }
      } else {
        obstacles.push({ kind: l === 0 ? kindA : kindB, lane: l, d });
      }
    }
    return;
  }

  // Defender + open lane coins
  const dl = Math.floor(Math.random() * 3);
  obstacles.push({ kind: 'defender', lane: dl, d });
  let cl = (dl + 1) % 3;
  if (Math.random() < 0.5) cl = (dl + 2) % 3;
  for (let i = 0; i < 4; i++) collectibles.push({ kind: 'coin', lane: cl, d: d - 80 + i * 70 });
}

// === Scenery (palm trees, lampposts, benches on side) ===
function spawnScenery() {
  const types = ['palm', 'lamp', 'bench', 'bush', 'sign'];
  const type = types[Math.floor(Math.random() * types.length)];
  const side = Math.random() < 0.5 ? 'L' : 'R';
  scenery.push({ type, side, d: 1800, sway: Math.random() * Math.PI * 2 });
}

function reset() {
  player.lane = 1;
  player.visualLane = 1;
  player.y = 0;
  player.vy = 0;
  player.state = 'run';
  player.stateTimer = 0;
  player.animTime = 0;
  player.trail = 0;
  obstacles = [];
  collectibles = [];
  particles = [];
  scenery = [];
  speed = baseSpeed;
  distance = 0;
  runDistanceM = 0;
  score = 0;
  coins = 0;
  spawnTimer = 0.8;
  power.magnet = 0;
  power.multi = 0;
  power.shield = 0;
  power.rocket = 0;
  // pre-fill scenery so it doesn't look empty at start
  for (let i = 0; i < 8; i++) scenery.push({
    type: ['palm','lamp','bush','bench','sign'][i % 5],
    side: i % 2 === 0 ? 'L' : 'R',
    d: 200 + i * 200,
    sway: Math.random() * Math.PI * 2,
  });
}

// === Update ===
function update(dt) {
  // particles always update (death + ambient)
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.gravity !== false) p.vy += 1500 * dt;
    p.life -= dt;
  }
  particles = particles.filter((p) => p.life > 0);

  if (state !== STATE.PLAYING) return;

  // Speed ramps with distance; rocket boosts
  const targetSpeed = baseSpeed + Math.min(distance / 9000, 1) * 12 + (power.rocket > 0 ? 7 : 0);
  speed += (targetSpeed - speed) * Math.min(1, dt * 3);
  distance += speed;
  runDistanceM = Math.floor(distance / 80);
  const scoreMult = power.multi > 0 ? 2 : 1;
  score += speed * dt * 2.6 * scoreMult;

  // Power-up timers
  if (power.magnet > 0) power.magnet -= dt;
  if (power.multi > 0)  power.multi -= dt;
  if (power.shield > 0) power.shield -= dt;
  if (power.rocket > 0) power.rocket -= dt;
  refreshPowerupHUD();

  // Smooth lane interp
  player.visualLane += (player.lane - player.visualLane) * Math.min(1, dt * 16);

  // State timer
  if (player.stateTimer > 0) {
    player.stateTimer -= dt;
    if (player.stateTimer <= 0 && player.state !== 'dunk' && player.state !== 'rocket') {
      player.state = 'run';
    }
  }

  // Rocket: float in the air
  if (power.rocket > 0) {
    player.state = 'rocket';
    const targetY = -210;
    player.y += (targetY - player.y) * Math.min(1, dt * 6);
    player.vy = 0;
    // exhaust particles
    if (Math.random() < 0.6) {
      const px = laneXAtVisual(player.visualLane, 0);
      const py = projectY(0) + player.y + 20;
      particles.push({
        x: px + (Math.random() - 0.5) * 14,
        y: py,
        vx: (Math.random() - 0.5) * 60,
        vy: 200 + Math.random() * 80,
        life: 0.45, maxLife: 0.45,
        color: Math.random() < 0.5 ? '#ffb066' : '#ffd84a',
        size: 5,
        gravity: false,
      });
    }
  } else if (player.state === 'rocket') {
    // landing after rocket
    player.state = 'dunk';
    player.vy = -300;
  }

  // Jump physics
  if (player.state === 'dunk') {
    player.y += player.vy * dt;
    player.vy += GRAVITY * dt;
    if (player.y >= 0) {
      player.y = 0;
      player.vy = 0;
      player.state = 'run';
      const lx = laneXAtVisual(player.visualLane, 0);
      const ly = projectY(0);
      for (let i = 0; i < 12; i++) {
        particles.push({
          x: lx + (Math.random() - 0.5) * 36,
          y: ly,
          vx: (Math.random() - 0.5) * 280,
          vy: -Math.random() * 140,
          life: 0.45, maxLife: 0.45,
          color: '#d9b58a', size: 4,
        });
      }
    }
  }

  // Move world toward player
  for (const o of obstacles) o.d -= speed;
  for (const c of collectibles) c.d -= speed;
  for (const s of scenery) s.d -= speed * 0.95;

  // Magnet: pull coins toward player (when within range)
  if (power.magnet > 0) {
    for (const c of collectibles) {
      if (c.collected) continue;
      if (c.kind !== 'coin') continue;
      if (c.d > 600 || c.d < -50) continue;
      // bend lane toward player's lane
      const targetLane = player.lane;
      c._mLane = c._mLane !== undefined ? c._mLane : c.lane;
      c._mLane += (targetLane - c._mLane) * Math.min(1, dt * 6);
      c.lane = c._mLane;
      // pull forward
      if (c.d > 60) c.d -= 600 * dt;
    }
  }

  // Obstacle collision
  for (const o of obstacles) {
    if (o.processed) continue;
    if (o.d <= 0) {
      o.processed = true;
      // Rocket flies over everything
      if (power.rocket > 0) continue;
      const inLane = Math.round(player.visualLane) === o.lane;
      if (!inLane) continue;
      const evaded =
        ((o.kind === 'cone' || o.kind === 'bin') && player.state === 'dunk' && player.y < -50) ||
        (o.kind === 'hurdle' && player.state === 'slide') ||
        (o.kind === 'defender' && player.state === 'dunk' && player.y < -100);
      if (!evaded) {
        if (power.shield > 0) {
          power.shield = 0;
          // shield-pop effect
          const px = laneXAtVisual(player.visualLane, 0);
          const py = projectY(0) - 90;
          for (let i = 0; i < 26; i++) {
            const a = (i / 26) * Math.PI * 2;
            particles.push({
              x: px, y: py,
              vx: Math.cos(a) * 280, vy: Math.sin(a) * 280,
              life: 0.55, maxLife: 0.55,
              color: '#a8e0ff', size: 4, gravity: false,
            });
          }
          continue;
        }
        gameOver();
        return;
      }
    }
  }

  // Collectibles
  for (const c of collectibles) {
    if (c.collected) continue;
    if (c.d > 50 || c.d < -50) continue;
    const sameLane = Math.round(player.visualLane) === Math.round(c.lane);
    const reachable =
      sameLane &&
      (c.kind === 'coin' ? true : true);
    if (!reachable) continue;

    // For coins floating up arc, check vertical reach
    if (c.kind === 'coin') {
      c.collected = true;
      coins += 1;
      totalCoins += 1;
      score += 10 * (power.multi > 0 ? 2 : 1);
      const cx = laneXAtVisual(c.lane, 0);
      const cy = projectY(0) - 60 + (c.yOff || 0);
      for (let i = 0; i < 4; i++) {
        particles.push({
          x: cx, y: cy,
          vx: (Math.random() - 0.5) * 160,
          vy: -Math.random() * 160 - 30,
          life: 0.45, maxLife: 0.45,
          color: i % 2 === 0 ? '#ffd84a' : '#fff5b0', size: 4,
        });
      }
      coinCountEl.textContent = coins;
    } else if (c.kind === 'powerup') {
      c.collected = true;
      activatePowerup(c.sub);
      const cx = laneXAtVisual(c.lane, 0);
      const cy = projectY(0) - 80;
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * Math.PI * 2;
        particles.push({
          x: cx, y: cy,
          vx: Math.cos(a) * 240, vy: Math.sin(a) * 240,
          life: 0.6, maxLife: 0.6,
          color: powerupColor(c.sub), size: 4, gravity: false,
        });
      }
    }
  }

  // Cleanup
  obstacles = obstacles.filter((o) => o.d > -200);
  collectibles = collectibles.filter((c) => c.d > -200 && !c.collected);
  scenery = scenery.filter((s) => s.d > -100);

  // Spawn timing
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnPattern();
    spawnTimer = 0.85 - Math.min(distance / 30000, 0.45);
  }
  if (Math.random() < 0.04) spawnScenery();

  player.animTime += dt;

  // HUD
  scoreEl.textContent = Math.floor(score);
}

function powerupColor(kind) {
  switch (kind) {
    case 'magnet': return '#ff5a5a';
    case 'multi':  return '#6adf6a';
    case 'shield': return '#a8e0ff';
    case 'rocket': return '#ffb066';
  }
  return '#fff';
}

function activatePowerup(kind) {
  switch (kind) {
    case 'magnet': power.magnet = 8; break;
    case 'multi':  power.multi  = 10; break;
    case 'shield': power.shield = 999; break; // until used
    case 'rocket': power.rocket = 5; player.state = 'rocket'; break;
  }
  refreshPowerupHUD();
}

// === Input ===
function setLane(targetLane) {
  if (state !== STATE.PLAYING) return;
  targetLane = Math.max(0, Math.min(2, targetLane));
  if (targetLane === player.lane) return;
  player.lane = targetLane;
  if (player.state === 'slide' || player.state === 'dunk' || player.state === 'rocket') return;
  player.state = 'crossover';
  player.stateTimer = ANIM.lanechange;
}

function swipeLeft()  { setLane(player.lane - 1); }
function swipeRight() { setLane(player.lane + 1); }
function swipeUp() {
  if (state !== STATE.PLAYING) return;
  if (player.state === 'dunk' || player.state === 'rocket') return;
  player.state = 'dunk';
  player.vy = JUMP_VY;
  player.y = -1;
  player.stateTimer = 0;
}
function swipeDown() {
  if (state !== STATE.PLAYING) return;
  if (player.state === 'dunk' || player.state === 'rocket') return;
  // air-slam from jump?
  player.state = 'slide';
  player.stateTimer = ANIM.slide;
}

// Touch swipe
let touchStart = null;
canvas.addEventListener('touchstart', (e) => {
  if (state !== STATE.PLAYING) return;
  e.preventDefault();
  const t = e.touches[0];
  touchStart = { x: t.clientX, y: t.clientY };
}, { passive: false });
canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
canvas.addEventListener('touchend', (e) => {
  if (!touchStart) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStart.x;
  const dy = t.clientY - touchStart.y;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  const min = 25;
  if (Math.max(adx, ady) >= min) {
    if (adx > ady) (dx < 0 ? swipeLeft : swipeRight)();
    else (dy < 0 ? swipeUp : swipeDown)();
  }
  touchStart = null;
}, { passive: true });

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
    if (state === STATE.PLAYING) pauseGame();
    else if (state === STATE.PAUSED) resumeGame();
    return;
  }
  switch (e.key) {
    case 'ArrowLeft':  case 'a': case 'A': swipeLeft(); break;
    case 'ArrowRight': case 'd': case 'D': swipeRight(); break;
    case 'ArrowUp':    case 'w': case 'W': swipeUp(); break;
    case 'ArrowDown':  case 's': case 'S': swipeDown(); break;
  }
});

// === Render: background (sky, sun, clouds, hills, skyline) ===
let cloudOffset = 0;
let bgScrollX = 0;

function drawBackground(dt) {
  const vy = vanishY();

  // Sky gradient (day)
  const sky = ctx.createLinearGradient(0, 0, 0, vy);
  sky.addColorStop(0, '#5dbcff');
  sky.addColorStop(0.6, '#a8dcff');
  sky.addColorStop(1, '#ffe3b0');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, vy);

  // Sun
  const sunX = W * 0.78;
  const sunY = vy * 0.45;
  const sunR = Math.min(W, H) * 0.07;
  const sunGrad = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 3);
  sunGrad.addColorStop(0, 'rgba(255, 250, 220, 0.9)');
  sunGrad.addColorStop(0.4, 'rgba(255, 220, 150, 0.5)');
  sunGrad.addColorStop(1, 'rgba(255, 220, 150, 0)');
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR * 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fffbe0';
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();

  // Clouds (parallax)
  cloudOffset += dt * 6;
  drawCloud((W * 0.15 - (cloudOffset * 0.4) % (W + 200) + W) % (W + 200) - 100, vy * 0.30, 1.0);
  drawCloud((W * 0.55 - (cloudOffset * 0.3) % (W + 220) + W) % (W + 220) - 110, vy * 0.20, 0.7);
  drawCloud((W * 0.85 - (cloudOffset * 0.5) % (W + 200) + W) % (W + 200) - 100, vy * 0.45, 0.85);
  drawCloud((W * 0.30 - (cloudOffset * 0.25) % (W + 240) + W) % (W + 240) - 120, vy * 0.55, 0.6);

  // Distant skyline
  drawSkyline(vy);

  // Distant hills
  drawHills(vy);
}

function drawCloud(x, y, scale) {
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.beginPath();
  ctx.arc(x, y, 22 * scale, 0, Math.PI * 2);
  ctx.arc(x + 24 * scale, y - 6 * scale, 26 * scale, 0, Math.PI * 2);
  ctx.arc(x + 50 * scale, y, 22 * scale, 0, Math.PI * 2);
  ctx.arc(x + 30 * scale, y + 8 * scale, 20 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawSkyline(vy) {
  const baseY = vy - 4;
  ctx.fillStyle = '#9bb6c8';
  const offset = (distance * 0.05) % 100;
  for (let i = -1; i < Math.ceil(W / 36) + 1; i++) {
    const bx = i * 36 - offset;
    const seed = ((i * 3.7) % 1 + 1) % 1;
    const bh = 18 + seed * 36;
    ctx.fillRect(bx, baseY - bh, 32, bh);
    // windows
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    for (let wY = baseY - bh + 6; wY < baseY - 6; wY += 7) {
      for (let wX = bx + 4; wX < bx + 28; wX += 8) {
        ctx.fillRect(wX, wY, 3, 3);
      }
    }
    ctx.fillStyle = '#9bb6c8';
  }
}

function drawHills(vy) {
  ctx.fillStyle = '#7ab47a';
  ctx.beginPath();
  ctx.moveTo(0, vy);
  const offset = (distance * 0.08) % 200;
  for (let i = -1; i < Math.ceil(W / 100) + 1; i++) {
    const x = i * 100 - offset;
    ctx.quadraticCurveTo(x + 50, vy - 22, x + 100, vy);
  }
  ctx.lineTo(W, vy + 12);
  ctx.lineTo(0, vy + 12);
  ctx.closePath();
  ctx.fill();
}

// === Render: road (3 lanes) ===
function drawRoad() {
  const vy = vanishY();
  const gy = groundY();

  // Grass / sidewalk on sides
  ctx.fillStyle = '#7ab47a';
  ctx.fillRect(0, vy, W, H - vy);

  // Sidewalk lighter strip near road edge
  // Build the road polygon
  const roadL_top = streetEdgeXAt('L', 1700);
  const roadR_top = streetEdgeXAt('R', 1700);
  const roadL_bot = streetEdgeXAt('L', 0);
  const roadR_bot = streetEdgeXAt('R', 0);

  // Sidewalk band (between road edge and grass)
  ctx.fillStyle = '#cfcfcf';
  ctx.beginPath();
  ctx.moveTo(0, gy);
  ctx.lineTo(roadL_bot - 24, gy);
  ctx.lineTo(roadL_top - 6, vy);
  ctx.lineTo(0, vy);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(W, gy);
  ctx.lineTo(roadR_bot + 24, gy);
  ctx.lineTo(roadR_top + 6, vy);
  ctx.lineTo(W, vy);
  ctx.closePath();
  ctx.fill();

  // Road (asphalt)
  const road = ctx.createLinearGradient(0, vy, 0, gy);
  road.addColorStop(0, '#3a3f48');
  road.addColorStop(1, '#5a606a');
  ctx.fillStyle = road;
  ctx.beginPath();
  ctx.moveTo(roadL_top, vy);
  ctx.lineTo(roadR_top, vy);
  ctx.lineTo(roadR_bot, H);
  ctx.lineTo(roadL_bot, H);
  ctx.closePath();
  ctx.fill();

  // Curb line
  ctx.strokeStyle = '#1f2228';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(roadL_top, vy);
  ctx.lineTo(roadL_bot, H);
  ctx.moveTo(roadR_top, vy);
  ctx.lineTo(roadR_bot, H);
  ctx.stroke();

  // Lane dividers (dashed white)
  ctx.strokeStyle = '#fff7d0';
  ctx.lineWidth = 3;
  // dashed motion
  const spacing = 110;
  const offset = ((distance % spacing) + spacing) % spacing;

  // Two divider lines: between lane 0/1 and 1/2
  for (const dividerLane of [0.5, 1.5]) {
    const baseTop = (LANE_BASE_X[Math.floor(dividerLane)] +
                    (LANE_BASE_X[Math.ceil(dividerLane)] - LANE_BASE_X[Math.floor(dividerLane)]) *
                    (dividerLane - Math.floor(dividerLane))) * W;
    for (let i = -1; i < 22; i++) {
      const dStart = i * spacing - offset;
      const dEnd   = dStart + spacing * 0.55;
      if (dEnd < 0 || dStart > 1700) continue;
      const sStart = Math.max(0, dStart);
      const sEnd   = Math.min(1700, dEnd);
      const yA = projectY(sStart);
      const yB = projectY(sEnd);
      const sA = getScale(sStart);
      const sB = getScale(sEnd);
      const xA = W / 2 + (baseTop - W / 2) * sA;
      const xB = W / 2 + (baseTop - W / 2) * sB;
      ctx.lineWidth = Math.max(1.5, 4 * sB);
      ctx.beginPath();
      ctx.moveTo(xA, yA);
      ctx.lineTo(xB, yB);
      ctx.stroke();
    }
  }
}

// === Render: scenery (palm trees, lampposts, signs, benches, bushes) ===
function drawScenery() {
  // Sort by depth
  const sorted = [...scenery].sort((a, b) => b.d - a.d);
  for (const s of sorted) {
    if (s.d > 1700 || s.d < -100) continue;
    const scale = getScale(s.d);
    const y = projectY(s.d);
    const baseX = (s.side === 'L' ? 0.10 : 0.90) * W;
    const x = W / 2 + (baseX - W / 2) * scale;
    if (s.type === 'palm') drawPalm(x, y, scale, s.sway + s.d * 0.001);
    else if (s.type === 'lamp') drawLamp(x, y, scale);
    else if (s.type === 'bench') drawBench(x, y, scale);
    else if (s.type === 'bush') drawBush(x, y, scale);
    else if (s.type === 'sign') drawSign(x, y, scale);
  }
}

function drawPalm(x, y, scale, sway) {
  // Trunk
  ctx.fillStyle = '#7a4a22';
  ctx.fillRect(x - 6 * scale, y - 110 * scale, 12 * scale, 110 * scale);
  // Trunk rings
  ctx.fillStyle = '#5a3520';
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(x - 6 * scale, y - 110 * scale + i * 22 * scale, 12 * scale, 2 * scale);
  }
  // Leaves
  const swayX = Math.sin(sway) * 6 * scale;
  ctx.fillStyle = '#2ea83a';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + sway * 0.2;
    const lx = x + Math.cos(a) * 36 * scale + swayX;
    const ly = y - 110 * scale + Math.sin(a) * 18 * scale - 10 * scale;
    ctx.beginPath();
    ctx.ellipse(lx, ly, 28 * scale, 10 * scale, a, 0, Math.PI * 2);
    ctx.fill();
  }
  // Leaf highlight
  ctx.fillStyle = '#4ec84a';
  ctx.beginPath();
  ctx.arc(x + swayX, y - 116 * scale, 10 * scale, 0, Math.PI * 2);
  ctx.fill();
  // Coconuts
  ctx.fillStyle = '#3a2008';
  ctx.beginPath();
  ctx.arc(x - 5 * scale + swayX, y - 110 * scale + 4 * scale, 4 * scale, 0, Math.PI * 2);
  ctx.arc(x + 6 * scale + swayX, y - 110 * scale + 6 * scale, 4 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawLamp(x, y, scale) {
  ctx.fillStyle = '#3a3f48';
  ctx.fillRect(x - 3 * scale, y - 130 * scale, 6 * scale, 130 * scale);
  ctx.fillRect(x - 3 * scale, y - 130 * scale, 30 * scale, 4 * scale);
  // Light bulb
  ctx.fillStyle = '#fff5b0';
  ctx.beginPath();
  ctx.arc(x + 26 * scale, y - 124 * scale, 8 * scale, 0, Math.PI * 2);
  ctx.fill();
  // Glow
  const grad = ctx.createRadialGradient(x + 26 * scale, y - 124 * scale, 0, x + 26 * scale, y - 124 * scale, 28 * scale);
  grad.addColorStop(0, 'rgba(255, 245, 176, 0.5)');
  grad.addColorStop(1, 'rgba(255, 245, 176, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x + 26 * scale, y - 124 * scale, 28 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawBench(x, y, scale) {
  ctx.fillStyle = '#7a4a22';
  ctx.fillRect(x - 30 * scale, y - 24 * scale, 60 * scale, 6 * scale);
  ctx.fillRect(x - 30 * scale, y - 38 * scale, 60 * scale, 6 * scale);
  ctx.fillStyle = '#3a3f48';
  ctx.fillRect(x - 28 * scale, y - 18 * scale, 4 * scale, 18 * scale);
  ctx.fillRect(x + 24 * scale, y - 18 * scale, 4 * scale, 18 * scale);
}

function drawBush(x, y, scale) {
  ctx.fillStyle = '#2ea83a';
  ctx.beginPath();
  ctx.arc(x - 10 * scale, y - 10 * scale, 14 * scale, 0, Math.PI * 2);
  ctx.arc(x + 8 * scale,  y - 12 * scale, 16 * scale, 0, Math.PI * 2);
  ctx.arc(x,              y - 18 * scale, 14 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4ec84a';
  ctx.beginPath();
  ctx.arc(x - 4 * scale, y - 22 * scale, 6 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawSign(x, y, scale) {
  ctx.fillStyle = '#5a3520';
  ctx.fillRect(x - 2 * scale, y - 60 * scale, 4 * scale, 60 * scale);
  ctx.fillStyle = '#ff8c3a';
  ctx.fillRect(x - 26 * scale, y - 80 * scale, 52 * scale, 26 * scale);
  ctx.fillStyle = '#1a2330';
  ctx.fillRect(x - 26 * scale, y - 80 * scale, 52 * scale, 4 * scale);
  ctx.fillStyle = '#fff';
  ctx.font = `900 ${12 * scale}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('HOOPS', x, y - 67 * scale);
}

// === Basketball ===
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

// === Obstacles ===
function drawObstacle(o) {
  const d = o.d;
  if (d > 1700) return;
  const scale = getScale(d);
  const y = projectY(d);
  const x = laneXAt(o.lane, d);
  if (o.kind === 'defender') drawDefender(x, y, scale);
  else if (o.kind === 'cone') drawCone(x, y, scale);
  else if (o.kind === 'hurdle') drawHurdle(x, y, scale);
  else if (o.kind === 'bin') drawBin(x, y, scale);
}

function drawDefender(x, y, scale) {
  const h = 200 * scale;
  const w = 56 * scale;
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y + 2, w * 0.7, w * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  // Legs
  ctx.fillStyle = '#1a3a8a';
  ctx.fillRect(x - w * 0.4, y - h * 0.45, w * 0.3, h * 0.2);
  ctx.fillRect(x + w * 0.1, y - h * 0.45, w * 0.3, h * 0.2);
  ctx.fillStyle = '#5a3520';
  ctx.fillRect(x - w * 0.36, y - h * 0.25, w * 0.22, h * 0.22);
  ctx.fillRect(x + w * 0.14, y - h * 0.25, w * 0.22, h * 0.22);
  ctx.fillStyle = '#fff';
  ctx.fillRect(x - w * 0.42, y - 4 * scale, w * 0.32, 8 * scale);
  ctx.fillRect(x + w * 0.1,  y - 4 * scale, w * 0.32, 8 * scale);
  // Jersey
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
  ctx.fillStyle = '#fff';
  ctx.font = `900 ${22 * scale}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('D', x, y - h * 0.6);
  // Arms
  ctx.fillStyle = '#5a3520';
  ctx.fillRect(x - w * 1.05, y - h * 0.78, w * 0.3, w * 0.22);
  ctx.fillRect(x + w * 0.75, y - h * 0.78, w * 0.3, w * 0.22);
  ctx.beginPath();
  ctx.arc(x - w * 1.1, y - h * 0.78 + w * 0.11, w * 0.18, 0, Math.PI * 2);
  ctx.arc(x + w * 1.1, y - h * 0.78 + w * 0.11, w * 0.18, 0, Math.PI * 2);
  ctx.fill();
  // Head
  ctx.beginPath();
  ctx.arc(x, y - h * 0.88, w * 0.32, 0, Math.PI * 2);
  ctx.fill();
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
  ctx.fillStyle = '#c44a10';
  ctx.fillRect(x - w * 0.6, y - 4 * scale, w * 1.2, 6 * scale);
  const cg = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  cg.addColorStop(0, '#c44a10');
  cg.addColorStop(0.5, '#ff8c3a');
  cg.addColorStop(1, '#c44a10');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.moveTo(x, y - h);
  ctx.lineTo(x + w / 2, y - 2 * scale);
  ctx.lineTo(x - w / 2, y - 2 * scale);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(x - w * 0.3, y - h * 0.5);
  ctx.lineTo(x + w * 0.3, y - h * 0.5);
  ctx.lineTo(x + w * 0.36, y - h * 0.38);
  ctx.lineTo(x - w * 0.36, y - h * 0.38);
  ctx.closePath();
  ctx.fill();
}

function drawHurdle(x, y, scale) {
  const w = 72 * scale;
  const h = 70 * scale;
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x, y + 2, w * 0.6, w * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  // Legs
  ctx.fillStyle = '#fff';
  ctx.fillRect(x - w * 0.5, y - h, 4 * scale, h);
  ctx.fillRect(x + w * 0.5 - 4 * scale, y - h, 4 * scale, h);
  // Cross beam (red+white striped)
  const beamY = y - h * 0.85;
  const beamH = 14 * scale;
  ctx.fillStyle = '#fff';
  ctx.fillRect(x - w * 0.55, beamY, w * 1.1, beamH);
  ctx.fillStyle = '#c8102e';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(x - w * 0.55 + i * (w * 0.275), beamY, w * 0.135, beamH);
  }
  // Top reflector
  ctx.fillStyle = '#ffd84a';
  ctx.fillRect(x - 4 * scale, beamY - 4 * scale, 8 * scale, 4 * scale);
}

function drawBin(x, y, scale) {
  const w = 42 * scale;
  const h = 70 * scale;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y + 2, w * 0.6, w * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body
  const bg = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  bg.addColorStop(0, '#3a3f48');
  bg.addColorStop(0.5, '#6a707a');
  bg.addColorStop(1, '#3a3f48');
  ctx.fillStyle = bg;
  ctx.fillRect(x - w / 2, y - h, w, h);
  // Lid
  ctx.fillStyle = '#1a2330';
  ctx.fillRect(x - w / 2 - 3 * scale, y - h - 5 * scale, w + 6 * scale, 6 * scale);
  // Stripes
  ctx.fillStyle = '#1a2330';
  ctx.fillRect(x - w / 2, y - h * 0.5, w, 3 * scale);
  ctx.fillRect(x - w / 2, y - h * 0.2, w, 3 * scale);
  // Recycle symbol
  ctx.fillStyle = '#2ea83a';
  ctx.beginPath();
  ctx.arc(x, y - h * 0.6, w * 0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `900 ${10 * scale}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('R', x, y - h * 0.6);
}

// === Collectibles ===
function drawCollectible(c) {
  const d = c.d;
  if (d > 1700) return;
  const scale = getScale(d);
  const x = laneXAtVisual(typeof c.lane === 'number' ? c.lane : 1, d);
  const bob = Math.sin((distance + d) * 0.012) * 6 * scale;
  const baseY = projectY(d) - 60 * scale + (c.yOff || 0) * scale + bob;

  if (c.kind === 'coin') {
    drawCoin(x, baseY, 14 * scale, distance * 0.06);
  } else if (c.kind === 'powerup') {
    drawPowerup(x, baseY, 22 * scale, c.sub);
  }
}

function drawCoin(x, y, r, spin) {
  // Spinning ellipse to suggest rotation
  const w = Math.abs(Math.cos(spin)) * r;
  // Outer rim
  ctx.fillStyle = '#8a6e10';
  ctx.beginPath();
  ctx.ellipse(x, y, w + 1.5, r + 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Face gradient
  const grad = ctx.createRadialGradient(x - w * 0.3, y - r * 0.3, 0, x, y, r);
  grad.addColorStop(0, '#fff5b0');
  grad.addColorStop(0.6, '#ffd84a');
  grad.addColorStop(1, '#c8a022');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(x, y, w, r, 0, 0, Math.PI * 2);
  ctx.fill();
  // $ symbol — drawn in local space and squashed with the coin spin
  if (w > 4) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(Math.cos(spin), 1);
    ctx.fillStyle = '#8a6e10';
    ctx.font = `900 ${r * 1.2}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('$', 0, 0);
    ctx.restore();
  }
  // Sparkle
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.ellipse(x - w * 0.4, y - r * 0.4, w * 0.2, r * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawPowerup(x, y, r, kind) {
  // Outer pulsing glow
  const pulse = 1 + Math.sin(distance * 0.02) * 0.15;
  const glow = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4 * pulse);
  glow.addColorStop(0, powerupColor(kind) + 'cc');
  glow.addColorStop(1, powerupColor(kind) + '00');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.4 * pulse, 0, Math.PI * 2);
  ctx.fill();
  // Capsule
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = powerupColor(kind);
  ctx.beginPath();
  ctx.arc(x, y, r * 0.78, 0, Math.PI * 2);
  ctx.fill();
  // Icon
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = r * 0.18;
  ctx.lineCap = 'round';
  if (kind === 'magnet') {
    // U shape
    ctx.beginPath();
    ctx.arc(x, y + r * 0.1, r * 0.5, Math.PI, Math.PI * 2);
    ctx.stroke();
    ctx.fillRect(x - r * 0.6, y + r * 0.05, r * 0.25, r * 0.45);
    ctx.fillRect(x + r * 0.35, y + r * 0.05, r * 0.25, r * 0.45);
  } else if (kind === 'multi') {
    ctx.font = `900 ${r * 1.0}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('×2', x, y);
  } else if (kind === 'shield') {
    ctx.beginPath();
    ctx.moveTo(x, y - r * 0.55);
    ctx.lineTo(x + r * 0.45, y - r * 0.3);
    ctx.lineTo(x + r * 0.4, y + r * 0.3);
    ctx.lineTo(x, y + r * 0.55);
    ctx.lineTo(x - r * 0.4, y + r * 0.3);
    ctx.lineTo(x - r * 0.45, y - r * 0.3);
    ctx.closePath();
    ctx.fill();
  } else if (kind === 'rocket') {
    ctx.beginPath();
    ctx.moveTo(x, y - r * 0.55);
    ctx.lineTo(x + r * 0.3, y);
    ctx.lineTo(x + r * 0.18, y + r * 0.4);
    ctx.lineTo(x - r * 0.18, y + r * 0.4);
    ctx.lineTo(x - r * 0.3, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffd06b';
    ctx.beginPath();
    ctx.moveTo(x, y + r * 0.7);
    ctx.lineTo(x + r * 0.18, y + r * 0.4);
    ctx.lineTo(x - r * 0.18, y + r * 0.4);
    ctx.closePath();
    ctx.fill();
  }
}

// === Player ===
function drawPlayer(skinOverride, customX, customY) {
  const skin = skinOverride || getSkin();
  const x = customX !== undefined ? customX : laneXAtVisual(player.visualLane, 0);
  const groundYpos = customY !== undefined ? customY : projectY(0);
  const baseY = groundYpos + (customY !== undefined ? 0 : player.y);

  // Shadow
  if (customY === undefined) {
    const airFactor = Math.max(0, Math.min(1, -player.y / 220));
    const shadowAlpha = 0.4 * (1 - airFactor * 0.7);
    const shadowScale = 1 - airFactor * 0.45;
    ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
    ctx.beginPath();
    ctx.ellipse(x, groundYpos + 6, 50 * shadowScale, 13 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Trail when running fast
  if (customY === undefined && player.state !== 'rocket' && speed > 14) {
    player.trail = (player.trail || 0) + 1;
    if (player.trail % 3 === 0) {
      particles.push({
        x: x + (Math.random() - 0.5) * 18,
        y: groundYpos - 4,
        vx: -speed * 4,
        vy: -Math.random() * 30,
        life: 0.35, maxLife: 0.35,
        color: 'rgba(255, 255, 255, 0.5)', size: 3,
        gravity: false,
      });
    }
  }

  // Shield aura
  if (customY === undefined && power.shield > 0) {
    const t = distance * 0.02;
    ctx.strokeStyle = 'rgba(168, 224, 255, 0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x, baseY - 80, 50 + Math.sin(t) * 4, 100 + Math.cos(t) * 4, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(168, 224, 255, 0.3)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.ellipse(x, baseY - 80, 54 + Math.sin(t) * 4, 104 + Math.cos(t) * 4, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Multi aura
  if (customY === undefined && power.multi > 0) {
    const t = distance * 0.04;
    ctx.fillStyle = `rgba(106, 223, 106, ${0.25 + Math.sin(t) * 0.1})`;
    ctx.beginPath();
    ctx.ellipse(x, baseY - 80, 46, 96, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Animation params
  let lean = 0;
  let isSlide = false;
  let armPose = 'dribble';

  if (customY === undefined) {
    if (player.state === 'crossover') {
      const t = 1 - player.stateTimer / ANIM.lanechange;
      // lean toward direction of new lane (slight tilt)
      const dir = player.lane - player.visualLane;
      lean = Math.sin(t * Math.PI) * 0.35 * Math.sign(dir || 1);
      armPose = 'cross';
    } else if (player.state === 'slide') {
      isSlide = true;
      armPose = 'forward';
    } else if (player.state === 'dunk') {
      armPose = 'dunk';
    } else if (player.state === 'rocket') {
      armPose = 'rocket';
    }
  }

  ctx.save();
  ctx.translate(x, baseY);
  ctx.rotate(lean);

  const runT = (customY === undefined ? player.animTime : 0) * 14;
  const isRunningPose = !isSlide && player.state !== 'dunk' && player.state !== 'rocket';
  const legSwing = isRunningPose ? Math.sin(runT) * 14 : 0;
  const bodyBob  = isRunningPose ? -Math.abs(Math.sin(runT * 2)) * 4 : 0;
  ctx.translate(0, bodyBob);

  if (isSlide) {
    ctx.scale(1.35, 0.45);
  }
  if (player.state === 'rocket') {
    // ride angled
    ctx.rotate(-0.15);
  }

  drawPlayerBody(skin, legSwing, runT, armPose);

  ctx.restore();
}

function drawPlayerBody(skin, legSwing, runT, armPose) {
  // Shorts
  ctx.fillStyle = skin.shorts;
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

  // Legs (skin tone)
  ctx.strokeStyle = skin.skinTone;
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
  ctx.fillStyle = skin.shoeStripe;
  ctx.fillRect(-23 + legSwing, -3, 16, 3);
  ctx.fillRect(7 - legSwing, -3, 16, 3);

  // Torso (jersey)
  const jersey = ctx.createLinearGradient(0, -135, 0, -78);
  jersey.addColorStop(0, skin.jersey1);
  jersey.addColorStop(1, skin.jersey2);
  ctx.fillStyle = jersey;
  ctx.beginPath();
  ctx.moveTo(-26, -135);
  ctx.lineTo(26, -135);
  ctx.lineTo(30, -78);
  ctx.lineTo(-30, -78);
  ctx.closePath();
  ctx.fill();
  // Jersey trim
  ctx.fillStyle = '#fff';
  ctx.fillRect(-30, -82, 60, 3);
  // Number
  ctx.fillStyle = '#fff';
  ctx.font = '900 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(skin.number, 0, -106);

  // Neck
  ctx.fillStyle = skin.skinTone;
  ctx.fillRect(-7, -145, 14, 12);

  // Head
  ctx.beginPath();
  ctx.arc(0, -160, 18, 0, Math.PI * 2);
  ctx.fill();
  // Hair
  ctx.fillStyle = skin.hair;
  ctx.beginPath();
  ctx.arc(0, -165, 18, Math.PI, 0);
  ctx.fill();
  // Headband
  ctx.fillStyle = skin.headband;
  ctx.fillRect(-19, -167, 38, 5);
  // Eyes
  ctx.fillStyle = '#fff';
  ctx.fillRect(-9, -160, 5, 4);
  ctx.fillRect(4, -160, 5, 4);
  ctx.fillStyle = '#1a0a00';
  ctx.fillRect(-7, -160, 3, 4);
  ctx.fillRect(5, -160, 3, 4);
  // Smile (subtle)
  ctx.strokeStyle = '#3a1a08';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, -152, 4, 0, Math.PI);
  ctx.stroke();

  // Arms + ball
  ctx.strokeStyle = skin.skinTone;
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  drawArmsAndBall(armPose, runT, legSwing);
}

function drawArmsAndBall(armPose, runT, legSwing) {
  if (armPose === 'dribble') {
    const dribbleY = -10 + Math.abs(Math.sin(runT * 2)) * 28;
    ctx.beginPath();
    ctx.moveTo(22, -130);
    ctx.lineTo(32, -90);
    ctx.lineTo(40, -50);
    ctx.stroke();
    drawBasketball(42, dribbleY, 13, runT);
    ctx.beginPath();
    ctx.moveTo(-22, -130);
    ctx.lineTo(-28 - legSwing * 0.5, -95);
    ctx.lineTo(-34 - legSwing, -68);
    ctx.stroke();
  } else if (armPose === 'cross') {
    const t = 1 - player.stateTimer / ANIM.lanechange;
    const k = Math.sin(t * Math.PI);
    const ballX = -18 - 30 * k;
    const ballY = -28 + 12 * k;
    ctx.beginPath();
    ctx.moveTo(-22, -130);
    ctx.lineTo(-30, -90);
    ctx.lineTo(ballX + 5, ballY - 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(22, -130);
    ctx.lineTo(34, -100);
    ctx.lineTo(44, -82);
    ctx.stroke();
    drawBasketball(ballX, ballY, 13, t * 5);
    // Speed lines
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-50 - i * 8, -60 - i * 4);
      ctx.lineTo(-30 - i * 8, -60 - i * 4);
      ctx.stroke();
    }
  } else if (armPose === 'forward') {
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
  } else if (armPose === 'dunk') {
    ctx.beginPath();
    ctx.moveTo(15, -130);
    ctx.lineTo(22, -170);
    ctx.lineTo(18, -210);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-15, -130);
    ctx.lineTo(-32, -112);
    ctx.lineTo(-44, -96);
    ctx.stroke();
    drawBasketball(18, -224, 15, player.animTime * 8);
  } else if (armPose === 'rocket') {
    // Rocket strapped to back, arms forward
    ctx.beginPath();
    ctx.moveTo(22, -130);
    ctx.lineTo(36, -120);
    ctx.lineTo(50, -110);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-22, -130);
    ctx.lineTo(-36, -120);
    ctx.lineTo(-50, -110);
    ctx.stroke();
    // Rocket pack
    ctx.fillStyle = '#3a3f48';
    ctx.fillRect(-14, -118, 28, 30);
    ctx.fillStyle = '#ff8c3a';
    ctx.fillRect(-10, -100, 8, 12);
    ctx.fillRect(2, -100, 8, 12);
    // Ball tucked
    drawBasketball(0, -100, 11, player.animTime * 4);
  }
}

// === Particles ===
function drawParticles() {
  for (const p of particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color || '#ffffff';
    const s = p.size || 3;
    ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
  }
  ctx.globalAlpha = 1;
}

// === Render frame ===
let lastT = performance.now();
function render(dt) {
  ctx.clearRect(0, 0, W, H);
  drawBackground(dt);
  drawRoad();
  drawScenery();

  // Sort obstacles + collectibles by depth
  const all = [];
  for (const o of obstacles) all.push({ kind: 'o', d: o.d, ref: o });
  for (const c of collectibles) all.push({ kind: 'c', d: c.d, ref: c });
  all.sort((a, b) => b.d - a.d);
  for (const e of all) {
    if (e.d < -50) continue;
    if (e.kind === 'o') drawObstacle(e.ref);
    else if (!e.ref.collected) drawCollectible(e.ref);
  }

  if (state === STATE.PLAYING || state === STATE.PAUSED || state === STATE.OVER) drawPlayer();
  drawParticles();
}

function loop(now) {
  const dt = Math.min(0.033, (now - lastT) / 1000);
  lastT = now;
  if (state === STATE.PLAYING) update(dt);
  render(dt);
  requestAnimationFrame(loop);
}

// === Pause / Resume / Quit ===
function pauseGame() {
  if (state !== STATE.PLAYING) return;
  state = STATE.PAUSED;
  pauseEl.classList.remove('hidden');
}
function resumeGame() {
  if (state !== STATE.PAUSED) return;
  state = STATE.PLAYING;
  pauseEl.classList.add('hidden');
}
function quitToMenu() {
  state = STATE.MENU;
  pauseEl.classList.add('hidden');
  hudEl.classList.add('hidden');
  showMenu('main');
}

// === UI hookup ===
const menuEl = document.getElementById('menu');
const skinsEl = document.getElementById('skins');
const howtoEl = document.getElementById('howto');
const pauseEl = document.getElementById('pause');
const gameOverEl = document.getElementById('gameover');
const hudEl = document.getElementById('hud');
const scoreEl = document.getElementById('score');
const coinCountEl = document.getElementById('coin-count');
const finalScoreEl = document.getElementById('final-score-val');
const highScoreEl = document.getElementById('high-score-val');
const runCoinsEl = document.getElementById('run-coins-val');
const runDistEl = document.getElementById('run-dist-val');
const menuBestEl = document.getElementById('menu-best');
const menuCoinsEl = document.getElementById('menu-coins');
const skinsCoinsEl = document.getElementById('skins-coin-count');
const skinGridEl = document.getElementById('skin-grid');
const powerupsEl = document.getElementById('powerups');

document.getElementById('play-btn').addEventListener('click', startGame);
document.getElementById('retry-btn').addEventListener('click', startGame);
document.getElementById('home-btn').addEventListener('click', () => {
  gameOverEl.classList.add('hidden');
  state = STATE.MENU;
  showMenu('main');
});
document.getElementById('skins-btn').addEventListener('click', () => showMenu('skins'));
document.getElementById('skins-back').addEventListener('click', () => showMenu('main'));
document.getElementById('howto-btn').addEventListener('click', () => showMenu('howto'));
document.getElementById('howto-back').addEventListener('click', () => showMenu('main'));
document.getElementById('pause-btn').addEventListener('click', pauseGame);
document.getElementById('resume-btn').addEventListener('click', resumeGame);
document.getElementById('quit-btn').addEventListener('click', quitToMenu);

function showMenu(view) {
  menuView = view;
  menuEl.classList.toggle('hidden', view !== 'main');
  skinsEl.classList.toggle('hidden', view !== 'skins');
  howtoEl.classList.toggle('hidden', view !== 'howto');
  if (view === 'main') {
    menuBestEl.textContent = highScore;
    menuCoinsEl.textContent = totalCoins;
  }
  if (view === 'skins') {
    renderSkinGrid();
  }
}

function renderSkinGrid() {
  skinsCoinsEl.textContent = totalCoins;
  skinGridEl.innerHTML = '';
  for (const s of SKINS) {
    const isUnlocked = unlockedSkins.includes(s.id);
    const isEquipped = currentSkinId === s.id;
    const card = document.createElement('div');
    card.className = 'skin-card' + (isEquipped ? ' selected' : '') + (!isUnlocked ? ' locked' : '');
    const previewCanvas = document.createElement('canvas');
    previewCanvas.className = 'skin-preview';
    previewCanvas.width = 140;
    previewCanvas.height = 140;
    card.appendChild(previewCanvas);
    drawSkinPreview(previewCanvas, s);

    const name = document.createElement('div');
    name.className = 'skin-name';
    name.textContent = s.name;
    card.appendChild(name);

    const status = document.createElement('div');
    status.className = 'skin-status';
    if (isEquipped) {
      status.classList.add('equipped');
      status.textContent = 'EQUIPPED';
    } else if (isUnlocked) {
      status.classList.add('unlocked');
      status.textContent = 'TAP TO EQUIP';
    } else {
      status.classList.add('price');
      status.innerHTML = `<span class="coin-icon"></span> ${s.cost}`;
    }
    card.appendChild(status);

    card.addEventListener('click', () => {
      if (isEquipped) return;
      if (isUnlocked) {
        currentSkinId = s.id;
        saveProgress();
        renderSkinGrid();
      } else if (totalCoins >= s.cost) {
        totalCoins -= s.cost;
        unlockedSkins.push(s.id);
        currentSkinId = s.id;
        saveProgress();
        renderSkinGrid();
      } else {
        // Flash insufficient coins
        skinsCoinsEl.parentElement.animate(
          [{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }],
          { duration: 250 }
        );
      }
    });
    skinGridEl.appendChild(card);
  }
}

function drawSkinPreview(canvas, skin) {
  const c = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  c.clearRect(0, 0, w, h);
  // Backdrop
  const bg = c.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#a8dcff');
  bg.addColorStop(1, '#fff5d0');
  c.fillStyle = bg;
  c.fillRect(0, 0, w, h);
  // Floor
  c.fillStyle = '#5a606a';
  c.fillRect(0, h * 0.78, w, h * 0.22);
  // Center & scale
  c.save();
  c.translate(w / 2, h * 0.86);
  c.scale(0.6, 0.6);

  // Body draw
  drawPreviewBody(c, skin);

  c.restore();
}

function drawPreviewBody(c, skin) {
  // Shadow
  c.fillStyle = 'rgba(0,0,0,0.2)';
  c.beginPath();
  c.ellipse(0, 6, 50, 12, 0, 0, Math.PI * 2);
  c.fill();
  // Shorts
  c.fillStyle = skin.shorts;
  c.beginPath();
  c.moveTo(-24, -78); c.lineTo(24, -78); c.lineTo(30, -46); c.lineTo(-30, -46);
  c.closePath();
  c.fill();
  c.fillStyle = '#fff';
  c.fillRect(-30, -50, 60, 3);
  // Legs
  c.strokeStyle = skin.skinTone;
  c.lineWidth = 13; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-12, -46); c.lineTo(-15, -2); c.stroke();
  c.beginPath(); c.moveTo(12, -46); c.lineTo(15, -2); c.stroke();
  c.fillStyle = '#fff';
  c.beginPath(); c.ellipse(-15, 0, 15, 7, 0, 0, Math.PI * 2); c.ellipse(15, 0, 15, 7, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = skin.shoeStripe;
  c.fillRect(-23, -3, 16, 3); c.fillRect(7, -3, 16, 3);
  // Jersey
  const jg = c.createLinearGradient(0, -135, 0, -78);
  jg.addColorStop(0, skin.jersey1); jg.addColorStop(1, skin.jersey2);
  c.fillStyle = jg;
  c.beginPath(); c.moveTo(-26, -135); c.lineTo(26, -135); c.lineTo(30, -78); c.lineTo(-30, -78); c.closePath(); c.fill();
  c.fillStyle = '#fff';
  c.fillRect(-30, -82, 60, 3);
  c.font = '900 22px sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(skin.number, 0, -106);
  // Neck
  c.fillStyle = skin.skinTone;
  c.fillRect(-7, -145, 14, 12);
  // Head
  c.beginPath(); c.arc(0, -160, 18, 0, Math.PI * 2); c.fill();
  c.fillStyle = skin.hair;
  c.beginPath(); c.arc(0, -165, 18, Math.PI, 0); c.fill();
  c.fillStyle = skin.headband;
  c.fillRect(-19, -167, 38, 5);
  c.fillStyle = '#fff';
  c.fillRect(-9, -160, 5, 4); c.fillRect(4, -160, 5, 4);
  c.fillStyle = '#1a0a00';
  c.fillRect(-7, -160, 3, 4); c.fillRect(5, -160, 3, 4);
  c.strokeStyle = '#3a1a08'; c.lineWidth = 1.5;
  c.beginPath(); c.arc(0, -152, 4, 0, Math.PI); c.stroke();
  // Arms holding ball at hip
  c.strokeStyle = skin.skinTone;
  c.lineWidth = 12; c.lineCap = 'round';
  c.beginPath(); c.moveTo(22, -130); c.lineTo(40, -100); c.lineTo(34, -70); c.stroke();
  c.beginPath(); c.moveTo(-22, -130); c.lineTo(-40, -100); c.lineTo(-34, -70); c.stroke();
  // Ball
  c.save(); c.translate(34, -70);
  const bg = c.createRadialGradient(-4, -4, 2, 0, 0, 14);
  bg.addColorStop(0, '#ffae6b'); bg.addColorStop(1, '#c44a10');
  c.fillStyle = bg;
  c.beginPath(); c.arc(0, 0, 14, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#1a0a00'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(-14, 0); c.lineTo(14, 0); c.moveTo(0, -14); c.lineTo(0, 14); c.stroke();
  c.restore();
}

function refreshPowerupHUD() {
  if (!powerupsEl) return;
  const items = [];
  if (power.magnet > 0) items.push({ key: 'magnet', label: 'MAGNET', t: power.magnet });
  if (power.multi > 0)  items.push({ key: 'multi',  label: '×2',     t: power.multi });
  if (power.shield > 0) items.push({ key: 'shield', label: 'SHIELD', t: 0 });
  if (power.rocket > 0) items.push({ key: 'rocket', label: 'ROCKET', t: power.rocket });
  powerupsEl.innerHTML = '';
  for (const it of items) {
    const div = document.createElement('div');
    div.className = 'pu-badge ' + it.key;
    const dot = document.createElement('span');
    dot.className = 'dot';
    div.appendChild(dot);
    const lbl = document.createElement('span');
    lbl.textContent = it.t > 0 ? `${it.label} ${Math.ceil(it.t)}s` : it.label;
    div.appendChild(lbl);
    powerupsEl.appendChild(div);
  }
}

function startGame() {
  reset();
  state = STATE.PLAYING;
  menuEl.classList.add('hidden');
  skinsEl.classList.add('hidden');
  howtoEl.classList.add('hidden');
  gameOverEl.classList.add('hidden');
  pauseEl.classList.add('hidden');
  hudEl.classList.remove('hidden');
  scoreEl.textContent = '0';
  coinCountEl.textContent = '0';
  refreshPowerupHUD();
}

function gameOver() {
  state = STATE.OVER;
  const finalScore = Math.floor(score);
  if (finalScore > highScore) {
    highScore = finalScore;
  }
  saveProgress();
  finalScoreEl.textContent = finalScore;
  highScoreEl.textContent = highScore;
  runCoinsEl.textContent = coins;
  runDistEl.textContent = runDistanceM + 'm';
  gameOverEl.classList.remove('hidden');
  hudEl.classList.add('hidden');
  // Crash burst
  const px = laneXAtVisual(player.visualLane, 0);
  const py = projectY(0);
  for (let i = 0; i < 40; i++) {
    particles.push({
      x: px,
      y: py - 80,
      vx: (Math.random() - 0.5) * 700,
      vy: -Math.random() * 500 - 80,
      life: 1.0, maxLife: 1.0,
      color: ['#ff8c3a', '#ffd84a', '#ffffff', '#c44a10'][i % 4],
      size: 4,
    });
  }
}

// init menu
showMenu('main');
requestAnimationFrame(loop);
