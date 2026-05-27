// === BASKETBALL RUNS ===
'use strict';

const canvas = document.getElementById('game');
let ctx = canvas.getContext('2d');
const mainCtx = ctx;

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


// =====================================================================
// SKINS
// =====================================================================
const SKINS = [
  {
    id: 'rookie', name: 'Rookie', price: 0, rarity: 'common',
    body: '#5a3520', hair: '#1a0e08',
    jersey: ['#e74c3c', '#c8102e'], jerseyTrim: '#ffffff',
    shorts: '#c8102e', shortsTrim: '#ffffff',
    headband: '#ff6b1a', sneaker: '#ffffff', stripe: '#ff6b1a',
    number: '1', numberColor: '#ffffff',
  },
  {
    id: 'captain', name: 'Captain', price: 100, rarity: 'common',
    body: '#5a3520', hair: '#1a0e08',
    jersey: ['#3a76e8', '#1a3a8a'], jerseyTrim: '#ffcc33',
    shorts: '#1a3a8a', shortsTrim: '#ffcc33',
    headband: '#ffcc33', sneaker: '#ffffff', stripe: '#ffcc33',
    number: '23', numberColor: '#ffffff',
  },
  {
    id: 'forester', name: 'Forester', price: 250, rarity: 'rare',
    body: '#7a4a30', hair: '#3a1a08',
    jersey: ['#2ecc71', '#1a8a4a'], jerseyTrim: '#ffffff',
    shorts: '#1a8a4a', shortsTrim: '#ffffff',
    headband: '#ffffff', sneaker: '#222222', stripe: '#ffffff',
    number: '7', numberColor: '#ffffff',
  },
  {
    id: 'flame', name: 'Flame', price: 400, rarity: 'rare',
    body: '#5a3520', hair: '#ff6b1a',
    jersey: ['#ff8c4a', '#c44a10'], jerseyTrim: '#ffe066',
    shorts: '#c44a10', shortsTrim: '#ffe066',
    headband: '#ffe066', sneaker: '#ffffff', stripe: '#c44a10',
    number: '99', numberColor: '#ffe066',
  },
  {
    id: 'galaxy', name: 'Galaxy', price: 700, rarity: 'epic',
    body: '#5a3520', hair: '#ffffff',
    jersey: ['#a35bd8', '#5a2a8a'], jerseyTrim: '#ffcc33',
    shorts: '#5a2a8a', shortsTrim: '#ffcc33',
    headband: '#ffcc33', sneaker: '#ffffff', stripe: '#ffcc33',
    number: '88', numberColor: '#ffcc33',
  },
  {
    id: 'shadow', name: 'Ninja', price: 1000, rarity: 'epic',
    body: '#3a2010', hair: '#000000',
    jersey: ['#2a2a2a', '#000000'], jerseyTrim: '#c8102e',
    shorts: '#000000', shortsTrim: '#c8102e',
    headband: '#c8102e', sneaker: '#c8102e', stripe: '#000000',
    number: '0', numberColor: '#c8102e',
  },
  {
    id: 'ice', name: 'Iceman', price: 1200, rarity: 'epic',
    body: '#7a5a4a', hair: '#bce6ff',
    jersey: ['#bce6ff', '#4a90e2'], jerseyTrim: '#ffffff',
    shorts: '#4a90e2', shortsTrim: '#ffffff',
    headband: '#ffffff', sneaker: '#bce6ff', stripe: '#4a90e2',
    number: '11', numberColor: '#ffffff',
  },
  {
    id: 'legend', name: 'Legend', price: 2000, rarity: 'legendary',
    body: '#5a3520', hair: '#1a0e08',
    jersey: ['#ffe066', '#c89a00'], jerseyTrim: '#000000',
    shorts: '#c89a00', shortsTrim: '#000000',
    headband: '#000000', sneaker: '#000000', stripe: '#ffe066',
    number: '24', numberColor: '#000000',
  },
];


// =====================================================================
// PERSISTENCE
// =====================================================================
let highScore = parseInt(localStorage.getItem('bbr_high') || '0', 10);
let coins = parseInt(localStorage.getItem('bbr_coins') || '0', 10);
let unlockedSkins = (function () {
  try {
    const raw = JSON.parse(localStorage.getItem('bbr_unlocked') || '["rookie"]');
    return new Set(Array.isArray(raw) ? raw : ['rookie']);
  } catch { return new Set(['rookie']); }
})();
let equippedSkinId = localStorage.getItem('bbr_skin') || 'rookie';
if (!SKINS.some((s) => s.id === equippedSkinId) || !unlockedSkins.has(equippedSkinId)) {
  equippedSkinId = 'rookie';
  unlockedSkins.add('rookie');
}
function getSkin(id) { return SKINS.find((s) => s.id === id) || SKINS[0]; }
function saveCoins() { localStorage.setItem('bbr_coins', String(coins)); }
function saveUnlocked() {
  localStorage.setItem('bbr_unlocked', JSON.stringify([...unlockedSkins]));
}
function saveEquipped() { localStorage.setItem('bbr_skin', equippedSkinId); }


// =====================================================================
// GAME STATE
// =====================================================================
const STATE = { MENU: 0, PLAYING: 1, OVER: 2, SHOP: 3 };
let state = STATE.MENU;
let score = 0;
let runCoins = 0;
let baseSpeed = 12;
let speed = baseSpeed;
let distance = 0;
let spawnTimer = 1.0;

let obstacles = [];
let collectibles = [];
let particles = [];


// =====================================================================
// PERSPECTIVE
// =====================================================================
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


// =====================================================================
// PLAYER
// =====================================================================
const player = {
  lane: 0,
  visualLane: 0,
  prevLane: 0,
  laneSwitchT: 1,    // 0 -> 1 (1 = settled)
  y: 0,
  vy: 0,
  state: 'run',
  stateTimer: 0,
  animTime: 0,
  // dunk-attack
  dunkPhase: 0,
  dunkDuration: 0.85,
  dunkTarget: null,    // defender obstacle reference
  dunkHoop: null,      // hoop obstacle reference
  dunkStartLane: 0,
};

const ANIM = { crossover: 0.35, behindBack: 0.35, slide: 0.65 };
const JUMP_VY = -1000;
const GRAVITY = 2800;


// =====================================================================
// SPAWN PATTERNS  (defender rate further reduced, slide obstacles emphasized)
// =====================================================================
function spawnPattern() {
  const r = Math.random();
  const dist = 1500;

  // Probabilities (sum = 1)
  //  0.00 - 0.10  defender + hoop  (10%)
  //  0.10 - 0.34  cone (single or double)  (24%)
  //  0.34 - 0.62  lowbar slide  (28%)
  //  0.62 - 0.74  banner overhead slide  (12%)
  //  0.74 - 0.93  ball pickups  (19%)
  //  0.93 - 1.00  combo balls + cone  (7%)

  if (r < 0.10) {
    // Defender with hoop behind him
    const lane = Math.random() < 0.5 ? 0 : 1;
    const def = { kind: 'defender', lane, d: dist, fallProgress: 0 };
    const hoop = { kind: 'hoop', lane, d: dist + 240, scored: false };
    def.linkedHoop = hoop;
    obstacles.push(def, hoop);
  } else if (r < 0.34) {
    // Cone(s) - jump over
    const both = Math.random() < 0.18;
    if (both) {
      // Two cones across lanes but staggered so a path exists
      const firstLane = Math.random() < 0.5 ? 0 : 1;
      obstacles.push({ kind: 'cone', lane: firstLane, d: dist });
      obstacles.push({ kind: 'cone', lane: 1 - firstLane, d: dist + 280 });
    } else {
      obstacles.push({ kind: 'cone', lane: Math.random() < 0.5 ? 0 : 1, d: dist });
    }
  } else if (r < 0.62) {
    // LOWBAR - real slide obstacle (limbo bar at chest height)
    const span = Math.random();
    if (span < 0.4) {
      obstacles.push({ kind: 'lowbar', lane: -1, d: dist });
    } else {
      obstacles.push({ kind: 'lowbar', lane: Math.random() < 0.5 ? 0 : 1, d: dist });
    }
  } else if (r < 0.74) {
    const both = Math.random() < 0.6;
    obstacles.push({
      kind: 'banner',
      lane: both ? -1 : (Math.random() < 0.5 ? 0 : 1),
      d: dist,
    });
  } else if (r < 0.93) {
    const lane = Math.random() < 0.5 ? 0 : 1;
    for (let i = 0; i < 4; i++) {
      collectibles.push({ kind: 'ball', lane, d: dist + i * 90 });
    }
  } else {
    // Cone + balls in opposite lane
    const lane = Math.random() < 0.5 ? 0 : 1;
    obstacles.push({ kind: 'cone', lane, d: dist });
    for (let i = 0; i < 3; i++) {
      collectibles.push({ kind: 'ball', lane: 1 - lane, d: dist - 100 + i * 80 });
    }
  }
}


function reset() {
  player.lane = 0;
  player.visualLane = 0;
  player.prevLane = 0;
  player.laneSwitchT = 1;
  player.y = 0;
  player.vy = 0;
  player.state = 'run';
  player.stateTimer = 0;
  player.animTime = 0;
  player.dunkPhase = 0;
  player.dunkTarget = null;
  player.dunkHoop = null;
  player.dunkPunched = false;
  obstacles = [];
  collectibles = [];
  particles = [];
  speed = baseSpeed;
  distance = 0;
  score = 0;
  runCoins = 0;
  spawnTimer = 1.0;
}


// =====================================================================
// UPDATE
// =====================================================================
function update(dt) {
  // particles always update
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 1400 * dt;
    p.life -= dt;
  }
  particles = particles.filter((p) => p.life > 0);

  if (state !== STATE.PLAYING) return;

  // ========== DUNK-ATTACK SCRIPTED SEQUENCE ==========
  if (player.state === 'dunkAttack') {
    player.dunkPhase += dt / player.dunkDuration;
    const p = Math.min(1, player.dunkPhase);

    // defender starts falling at 0.30
    if (player.dunkTarget && p > 0.3) {
      const fp = Math.min(1, (p - 0.3) / 0.4);
      player.dunkTarget.fallProgress = fp;
      // dust as he falls
      if (fp > 0.4 && fp < 0.6 && Math.random() < 0.6) {
        const dx = laneXAt(player.dunkTarget.lane, Math.max(0, player.dunkTarget.d));
        const dy = projectY(Math.max(0, player.dunkTarget.d));
        particles.push({
          x: dx + (Math.random() - 0.5) * 40, y: dy,
          vx: (Math.random() - 0.5) * 200, vy: -Math.random() * 120,
          life: 0.4, maxLife: 0.4, color: '#d9a574',
        });
      }
    }

    // POSTERIZE flash when player passes over defender (~0.50)
    if (player.dunkTarget && !player.dunkPunched && p >= 0.5) {
      player.dunkPunched = true;
      const dscale = getScale(Math.max(0, player.dunkTarget.d));
      const dx = laneXAt(player.dunkTarget.lane, Math.max(0, player.dunkTarget.d));
      const dy = projectY(Math.max(0, player.dunkTarget.d)) - 110 * dscale;
      // Big radial burst
      for (let i = 0; i < 28; i++) {
        const ang = (i / 28) * Math.PI * 2 + Math.random() * 0.2;
        const sp = 380 + Math.random() * 320;
        particles.push({
          x: dx, y: dy,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp - 60,
          life: 0.55, maxLife: 0.55,
          color: ['#ffffff', '#ffcc33', '#ff6b1a'][i % 3],
        });
      }
    }

    // when slam happens (~0.85), spawn celebration burst from hoop
    if (player.dunkHoop && !player.dunkHoop.scored && p >= 0.82) {
      player.dunkHoop.scored = true;
      const hx = laneXAt(player.dunkHoop.lane, Math.max(0, player.dunkHoop.d));
      const hy = projectY(Math.max(0, player.dunkHoop.d)) - 300 * getScale(Math.max(0, player.dunkHoop.d));
      for (let i = 0; i < 26; i++) {
        particles.push({
          x: hx, y: hy,
          vx: (Math.random() - 0.5) * 500,
          vy: -Math.random() * 380 - 60,
          life: 0.8, maxLife: 0.8,
          color: ['#ffcc33', '#ff6b1a', '#ffffff', '#2ecc71'][i % 4],
        });
      }
      score += 500;
      runCoins += 10;
      coins += 10;
      saveCoins();
      flashHud();
    }

    // smooth lane interpolation still runs visually
    player.visualLane += (player.lane - player.visualLane) * Math.min(1, dt * 14);

    if (p >= 1) {
      // Finish: advance world by hoop's distance, remove dunked entities
      const advance = player.dunkHoop ? Math.max(0, player.dunkHoop.d) : 0;
      // Advance world (so it looks like the player flew into the scene)
      for (const o of obstacles) o.d -= advance;
      for (const c of collectibles) c.d -= advance;
      distance += advance;
      // mark dunk target & hoop processed/removed
      if (player.dunkTarget) player.dunkTarget.processed = true;
      if (player.dunkHoop) player.dunkHoop.processed = true;
      obstacles = obstacles.filter((o) => o !== player.dunkTarget && o !== player.dunkHoop);
      // landing dust
      const lx = laneXAtVisual(player.visualLane, 0);
      const ly = projectY(0);
      for (let i = 0; i < 14; i++) {
        particles.push({
          x: lx + (Math.random() - 0.5) * 50, y: ly,
          vx: (Math.random() - 0.5) * 300, vy: -Math.random() * 200,
          life: 0.5, maxLife: 0.5, color: '#d9a574',
        });
      }
      player.state = 'run';
      player.dunkPhase = 0;
      player.dunkTarget = null;
      player.dunkHoop = null;
      player.y = 0;
      player.vy = 0;
      // Snap visual to current lane (no slide animation back)
      player.visualLane = player.lane;
      player.prevLane = player.lane;
      player.laneSwitchT = 1;
    }

    // No normal world movement during dunk attack (paused)
    player.animTime += dt;
    scoreEl.textContent = Math.floor(score);
    coinsHudEl.textContent = runCoins;
    return;
  }

  // ========== NORMAL UPDATE ==========
  speed = baseSpeed + Math.min(distance / 9000, 1) * 10;
  distance += speed;
  score += speed * dt * 2.2;

  // Smooth lane interpolation with snappy ease-out cubic (Subway Surfers-style juke)
  player.laneSwitchT = Math.min(1, player.laneSwitchT + dt * 9);
  const tEased = 1 - Math.pow(1 - player.laneSwitchT, 3); // ease-out cubic
  player.visualLane = player.prevLane + (player.lane - player.prevLane) * tEased;

  if (player.stateTimer > 0) {
    player.stateTimer -= dt;
    if (player.stateTimer <= 0 && player.state !== 'jump') {
      player.state = 'run';
    }
  }

  // Jump physics
  if (player.state === 'jump') {
    player.y += player.vy * dt;
    player.vy += GRAVITY * dt;
    if (player.y >= 0) {
      player.y = 0;
      player.vy = 0;
      player.state = 'run';
      const lx = laneXAtVisual(player.visualLane, 0);
      const ly = projectY(0);
      for (let i = 0; i < 8; i++) {
        particles.push({
          x: lx + (Math.random() - 0.5) * 30, y: ly,
          vx: (Math.random() - 0.5) * 220, vy: -Math.random() * 110,
          life: 0.4, maxLife: 0.4, color: '#d9a574',
        });
      }
    }
  }

  // Move obstacles & collectibles
  for (const o of obstacles) o.d -= speed;
  for (const c of collectibles) c.d -= speed;

  // Collisions
  for (const o of obstacles) {
    if (o.processed) continue;
    if (o.d <= 0) {
      o.processed = true;
      if (o.kind === 'hoop') continue; // hoops never kill
      const inLane = o.lane === -1 || o.lane === player.lane;
      if (!inLane) continue;
      const evaded =
        (o.kind === 'cone' && player.state === 'jump' && player.y < -60) ||
        (o.kind === 'banner' && player.state === 'slide') ||
        (o.kind === 'lowbar' && player.state === 'slide') ||
        // defender: only dunk attack clears him; if fallen (dunked) pass through
        (o.kind === 'defender' && o.fallProgress > 0.2);
      if (!evaded) { gameOver(); return; }
    }
  }

  // Collectibles
  for (const c of collectibles) {
    if (c.collected) continue;
    if (c.d <= 30 && c.d >= -30 && c.lane === player.lane) {
      c.collected = true;
      score += 50;
      runCoins += 1;
      coins += 1;
      saveCoins();
      const cx = laneXAtVisual(c.lane, 0);
      const cy = projectY(0) - 60;
      for (let i = 0; i < 8; i++) {
        particles.push({
          x: cx, y: cy,
          vx: (Math.random() - 0.5) * 220,
          vy: -Math.random() * 220 - 60,
          life: 0.55, maxLife: 0.55,
          color: i % 2 === 0 ? '#ffcc33' : '#ff6b1a',
        });
      }
    }
  }

  obstacles = obstacles.filter((o) => o.d > -260);
  collectibles = collectibles.filter((c) => c.d > -260 && !c.collected);

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnPattern();
    spawnTimer = 0.95 - Math.min(distance / 30000, 0.45);
  }

  player.animTime += dt;
  scoreEl.textContent = Math.floor(score);
  coinsHudEl.textContent = runCoins;
}


// =====================================================================
// INPUT
// =====================================================================
function setLane(targetLane) {
  if (state !== STATE.PLAYING) return;
  if (player.state === 'dunkAttack') return;
  if (player.lane !== targetLane) {
    player.prevLane = player.visualLane; // start from current visual position
    player.lane = targetLane;
    player.laneSwitchT = 0;
  }
  if (player.state === 'slide' || player.state === 'jump') return;
  player.state = targetLane === 0 ? 'crossover' : 'behindBack';
  player.stateTimer = ANIM.crossover;
}

function swipeLeft() {
  if (state !== STATE.PLAYING) return;
  if (player.lane === 0) {
    if (player.state !== 'slide' && player.state !== 'jump' && player.state !== 'dunkAttack') {
      player.state = 'crossover';
      player.stateTimer = ANIM.crossover;
    }
  } else { setLane(0); }
}

function swipeRight() {
  if (state !== STATE.PLAYING) return;
  if (player.lane === 1) {
    if (player.state !== 'slide' && player.state !== 'jump' && player.state !== 'dunkAttack') {
      player.state = 'behindBack';
      player.stateTimer = ANIM.behindBack;
    }
  } else { setLane(1); }
}

function swipeDown() {
  if (state !== STATE.PLAYING) return;
  if (player.state === 'jump' || player.state === 'dunkAttack') return;
  player.state = 'slide';
  player.stateTimer = ANIM.slide;
}

function swipeUp() {
  if (state !== STATE.PLAYING) return;
  if (player.state === 'jump' || player.state === 'dunkAttack') return;

  // Look for a defender + hoop in trigger range in player's lane
  let trigger = null;
  for (const o of obstacles) {
    if (o.kind !== 'defender' || !o.linkedHoop || o.processed) continue;
    if (o.lane !== player.lane) continue;
    if (o.d > 80 && o.d < 520) { trigger = o; break; }
  }

  if (trigger) {
    // start dunk attack
    player.state = 'dunkAttack';
    player.dunkPhase = 0;
    player.dunkPunched = false;
    player.dunkTarget = trigger;
    player.dunkHoop = trigger.linkedHoop;
    player.dunkStartLane = player.visualLane;
    // force lane to defender's
    if (player.lane !== trigger.lane) {
      player.prevLane = player.visualLane;
      player.lane = trigger.lane;
      player.laneSwitchT = 0;
    }
    return;
  }

  // Normal jump
  player.state = 'jump';
  player.vy = JUMP_VY;
  player.y = -1;
  player.stateTimer = 0;
}


// Touch swipe
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
canvas.addEventListener('touchmove', (e) => {
  if (state === STATE.PLAYING) e.preventDefault();
}, { passive: false });
canvas.addEventListener(
  'touchend',
  (e) => {
    if (!touchStart) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.x;
    const dy = t.clientY - touchStart.y;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    const min = 26;
    if (Math.max(adx, ady) >= min) {
      if (adx > ady) (dx < 0 ? swipeLeft : swipeRight)();
      else (dy < 0 ? swipeUp : swipeDown)();
    }
    touchStart = null;
  },
  { passive: true }
);

window.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'ArrowLeft': case 'a': case 'A': swipeLeft(); break;
    case 'ArrowRight': case 'd': case 'D': swipeRight(); break;
    case 'ArrowUp': case 'w': case 'W': swipeUp(); break;
    case 'ArrowDown': case 's': case 'S': swipeDown(); break;
  }
});


// =====================================================================
// RENDER: Court
// =====================================================================
function drawCourt() {
  const sky = ctx.createLinearGradient(0, 0, 0, vanishY());
  sky.addColorStop(0, '#1a0e2e');
  sky.addColorStop(1, '#3a1d4a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, vanishY());

  // crowd band
  ctx.fillStyle = '#0a0518';
  ctx.fillRect(0, vanishY() - 22, W, 24);
  const crowdColors = ['#ff6b1a', '#ffcc33', '#ffffff', '#4a90e2', '#e74c3c', '#9b59b6'];
  for (let i = 0; i < 80; i++) {
    const cx = (i * 17 + ((distance * 0.04) % 17)) % W;
    const cy = vanishY() - 4 - ((i * 13) % 14);
    ctx.fillStyle = crowdColors[i % crowdColors.length];
    ctx.fillRect(cx, cy, 3, 3);
  }

  const floor = ctx.createLinearGradient(0, vanishY(), 0, H);
  floor.addColorStop(0, '#7a4a22');
  floor.addColorStop(0.5, '#a0703a');
  floor.addColorStop(1, '#d49b5d');
  ctx.fillStyle = floor;
  ctx.fillRect(0, vanishY(), W, H - vanishY());

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(W / 2, vanishY());
  ctx.lineTo(W * 0.04, H);
  ctx.moveTo(W / 2, vanishY());
  ctx.lineTo(W * 0.96, H);
  ctx.stroke();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.setLineDash([18, 22]);
  ctx.lineDashOffset = -((distance * 1.2) % 40);
  ctx.beginPath();
  ctx.moveTo(W / 2, vanishY());
  ctx.lineTo(W / 2, H);
  ctx.stroke();
  ctx.setLineDash([]);

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


// =====================================================================
// RENDER: Basketball helper
// =====================================================================
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


// =====================================================================
// RENDER: Obstacles
// =====================================================================
function drawObstacle(o) {
  const d = o.d;
  if (d > 1900) return;
  const scale = getScale(d);
  const y = projectY(d);

  if (o.kind === 'banner' && o.lane === -1) {
    const xL = laneXAt(0, d);
    const xR = laneXAt(1, d);
    drawBannerSection(xL, xR, y, scale, 'CHAMPS');
    return;
  }
  if (o.kind === 'lowbar' && o.lane === -1) {
    drawLowBarSpan(d, scale);
    return;
  }

  const x = laneXAt(o.lane, d);

  if (o.kind === 'defender') drawDefender(x, y, scale, o);
  else if (o.kind === 'cone') drawCone(x, y, scale);
  else if (o.kind === 'banner') drawSingleBanner(x, y, scale);
  else if (o.kind === 'lowbar') drawLowBarSingle(x, y, scale);
  else if (o.kind === 'hoop') drawHoop(x, y, scale, o);
}


function drawDefender(x, y, scale, o) {
  const fall = o ? (o.fallProgress || 0) : 0;
  // approachT: 0 when far (d>=520), 1 when close (d<=120)
  const approachT = o ? Math.max(0, Math.min(1, (520 - Math.max(0, o.d)) / 400)) : 0;
  const h = 200 * scale;
  const w = 56 * scale;

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y + 2, w * 0.7, w * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);

  if (fall > 0) {
    // Falling backwards: rotate around feet
    const ang = -Math.PI / 2 * Math.min(1, fall * 1.1);
    ctx.rotate(ang);
    // Stars overhead when fully fallen
    if (fall > 0.6) {
      ctx.fillStyle = '#ffcc33';
      const t = (player.animTime * 6) % (Math.PI * 2);
      for (let i = 0; i < 3; i++) {
        const a = t + i * (Math.PI * 2 / 3);
        const sx = Math.cos(a) * 20 * scale;
        const sy = -h * 0.2 + Math.sin(a) * 10 * scale;
        drawStar(sx, sy, 5 * scale);
      }
    }
  } else {
    // Defensive crouch + bob as player approaches
    const crouch = approachT * 5 * scale;
    const bob = Math.sin(player.animTime * 9) * approachT * 1.5 * scale;
    ctx.translate(0, crouch + bob);
  }

  // Wider defensive stance when blocking
  const stance = 1 + approachT * 0.30 * (1 - fall);

  // legs (shorts)
  ctx.fillStyle = '#1a3a8a';
  ctx.fillRect(-w * 0.4 * stance, -h * 0.45, w * 0.3, h * 0.2);
  ctx.fillRect(w * 0.1 * stance, -h * 0.45, w * 0.3, h * 0.2);
  ctx.fillStyle = '#5a3520';
  ctx.fillRect(-w * 0.36 * stance, -h * 0.25, w * 0.22, h * 0.22);
  ctx.fillRect(w * 0.14 * stance, -h * 0.25, w * 0.22, h * 0.22);
  ctx.fillStyle = '#fff';
  ctx.fillRect(-w * 0.42 * stance, -4 * scale, w * 0.32, 8 * scale);
  ctx.fillRect(w * 0.1 * stance, -4 * scale, w * 0.32, 8 * scale);

  // jersey
  const jg = ctx.createLinearGradient(0, -h, 0, -h * 0.45);
  jg.addColorStop(0, '#3a76e8');
  jg.addColorStop(1, '#1a3a8a');
  ctx.fillStyle = jg;
  ctx.beginPath();
  ctx.moveTo(-w * 0.5, -h * 0.45);
  ctx.lineTo(w * 0.5, -h * 0.45);
  ctx.lineTo(w * 0.45, -h * 0.78);
  ctx.lineTo(-w * 0.45, -h * 0.78);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = `900 ${22 * scale}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('23', 0, -h * 0.6);

  // ARMS - block-up pose. Higher and wider as player approaches.
  // 0.35 reach when far, 1.0 reach when very close. Falls drop to 0.
  const armReach = Math.max(0, (0.35 + approachT * 0.65) * (1 - fall * 1.4));
  const armSpread = 1 + approachT * 0.40 * (1 - fall);
  const armY = -h * (0.55 + 0.40 * armReach);
  ctx.fillStyle = '#5a3520';
  // upper arm
  ctx.fillRect(-w * 1.05 * armSpread, armY, w * 0.3, w * 0.22);
  ctx.fillRect(w * 0.75 * armSpread, armY, w * 0.3, w * 0.22);
  // hands
  ctx.beginPath();
  ctx.arc(-w * 1.1 * armSpread, armY + w * 0.11, w * 0.18, 0, Math.PI * 2);
  ctx.arc(w * 1.1 * armSpread, armY + w * 0.11, w * 0.18, 0, Math.PI * 2);
  ctx.fill();

  // head (slight upward tilt while blocking high)
  const headY = -h * (0.88 + 0.04 * armReach);
  ctx.fillStyle = '#5a3520';
  ctx.beginPath();
  ctx.arc(0, headY, w * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a0e08';
  ctx.beginPath();
  ctx.arc(0, headY - w * 0.04, w * 0.32, Math.PI, 0);
  ctx.fill();
  // Eyes
  if (fall > 0.4) {
    // X eyes when KO'd
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2 * scale;
    [-w * 0.12, w * 0.12].forEach((ex) => {
      ctx.beginPath();
      ctx.moveTo(ex - 4 * scale, headY - 4 * scale);
      ctx.lineTo(ex + 4 * scale, headY + 4 * scale);
      ctx.moveTo(ex + 4 * scale, headY - 4 * scale);
      ctx.lineTo(ex - 4 * scale, headY + 4 * scale);
      ctx.stroke();
    });
  } else if (approachT > 0.5) {
    // Wide panic eyes when player is close
    ctx.fillStyle = '#fff';
    [-w * 0.13, w * 0.13].forEach((ex) => {
      ctx.beginPath();
      ctx.arc(ex, headY, 4.5 * scale, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = '#1a0e08';
    [-w * 0.13, w * 0.13].forEach((ex) => {
      ctx.beginPath();
      ctx.arc(ex, headY, 2.2 * scale, 0, Math.PI * 2);
      ctx.fill();
    });
  } else {
    // Normal alert eyes
    ctx.fillStyle = '#fff';
    ctx.fillRect(-w * 0.16, headY - 2.5 * scale, 5 * scale, 4 * scale);
    ctx.fillRect(w * 0.16 - 5 * scale, headY - 2.5 * scale, 5 * scale, 4 * scale);
    ctx.fillStyle = '#1a0e08';
    ctx.fillRect(-w * 0.13, headY - 2 * scale, 3 * scale, 3 * scale);
    ctx.fillRect(w * 0.13 - 3 * scale, headY - 2 * scale, 3 * scale, 3 * scale);
  }

  ctx.restore();
}


function drawStar(x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a1 = -Math.PI / 2 + i * (Math.PI * 2 / 5);
    const a2 = a1 + Math.PI / 5;
    ctx.lineTo(x + Math.cos(a1) * r, y + Math.sin(a1) * r);
    ctx.lineTo(x + Math.cos(a2) * r * 0.45, y + Math.sin(a2) * r * 0.45);
  }
  ctx.closePath();
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
  cg.addColorStop(0.5, '#ff6b1a');
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


function drawSingleBanner(x, y, scale) {
  const w = 110 * scale;
  const h = 56 * scale;
  const cy = y - 230 * scale;
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


function drawBannerSection(xL, xR, y, scale, label) {
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
  ctx.fillText(label, (xL + xR) / 2, cy + h / 2);
}


// LOWBAR: a clearly-low limbo bar requiring a slide
function drawLowBarSingle(x, y, scale) {
  const w = 130 * scale;
  const barY = y - 90 * scale;
  // posts
  ctx.fillStyle = '#1a0a00';
  ctx.fillRect(x - w * 0.5 - 4 * scale, y - 100 * scale, 6 * scale, 100 * scale);
  ctx.fillRect(x + w * 0.5 - 2 * scale, y - 100 * scale, 6 * scale, 100 * scale);
  // post caps
  ctx.fillStyle = '#ffcc33';
  ctx.fillRect(x - w * 0.5 - 6 * scale, y - 100 * scale - 6 * scale, 10 * scale, 6 * scale);
  ctx.fillRect(x + w * 0.5 - 4 * scale, y - 100 * scale - 6 * scale, 10 * scale, 6 * scale);
  // shadow under bar
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x, y + 1, w * 0.5, w * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  // candy striped bar
  drawStripedBar(x - w * 0.5, barY - 7 * scale, w, 14 * scale);
  // SLIDE chevrons + label hovering above bar
  drawSlideChevrons(x, barY - 22 * scale, scale);
}

function drawLowBarSpan(d, scale) {
  const xL = laneXAt(0, d);
  const xR = laneXAt(1, d);
  const y = projectY(d);
  const pad = 80 * scale;
  const left = xL - pad;
  const right = xR + pad;
  const barY = y - 90 * scale;
  ctx.fillStyle = '#1a0a00';
  ctx.fillRect(left - 4 * scale, y - 100 * scale, 6 * scale, 100 * scale);
  ctx.fillRect(right - 2 * scale, y - 100 * scale, 6 * scale, 100 * scale);
  ctx.fillStyle = '#ffcc33';
  ctx.fillRect(left - 6 * scale, y - 100 * scale - 6 * scale, 10 * scale, 6 * scale);
  ctx.fillRect(right - 4 * scale, y - 100 * scale - 6 * scale, 10 * scale, 6 * scale);
  drawStripedBar(left, barY - 7 * scale, right - left, 14 * scale);
  drawSlideChevrons((xL + xR) / 2, barY - 22 * scale, scale);
}

// Pulsing downward chevrons hint that a slide is required
function drawSlideChevrons(x, y, scale) {
  const pulse = 0.5 + 0.5 * Math.sin(player.animTime * 6);
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = `rgba(255,204,51,${0.55 + 0.4 * pulse})`;
  ctx.lineWidth = Math.max(2, 3 * scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < 3; i++) {
    const oy = -i * 9 * scale + pulse * 3 * scale;
    const ww = 14 * scale;
    ctx.beginPath();
    ctx.moveTo(-ww, oy);
    ctx.lineTo(0, oy + 7 * scale);
    ctx.lineTo(ww, oy);
    ctx.stroke();
  }
  ctx.restore();
}

function drawStripedBar(x, y, w, h) {
  ctx.fillStyle = '#fff';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#c8102e';
  const stripeW = h * 1.2;
  for (let sx = -h; sx < w + h; sx += stripeW * 2) {
    ctx.beginPath();
    ctx.moveTo(x + sx, y + h);
    ctx.lineTo(x + sx + stripeW, y + h);
    ctx.lineTo(x + sx + stripeW + h, y);
    ctx.lineTo(x + sx + h, y);
    ctx.closePath();
    ctx.fill();
  }
  // re-clip to bar area
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = '#1a0a00';
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.restore();
  // outline
  ctx.strokeStyle = '#1a0a00';
  ctx.lineWidth = Math.max(1, h * 0.12);
  ctx.strokeRect(x, y, w, h);
}


// HOOP: backboard + rim + net
function drawHoop(x, y, scale, o) {
  const baseY = y;
  const poleH = 360 * scale;
  // Pole
  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(x - 4 * scale, baseY - poleH, 8 * scale, poleH);
  // Pole base
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(x - 16 * scale, baseY - 6 * scale, 32 * scale, 6 * scale);
  // Backboard
  const bbW = 110 * scale;
  const bbH = 70 * scale;
  const bbY = baseY - poleH - 4 * scale;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - bbW / 2, bbY, bbW, bbH);
  ctx.strokeStyle = '#c8102e';
  ctx.lineWidth = Math.max(2, 4 * scale);
  ctx.strokeRect(x - bbW / 2, bbY, bbW, bbH);
  // Inner red square
  ctx.strokeRect(x - bbW * 0.18, bbY + bbH * 0.32, bbW * 0.36, bbH * 0.42);
  // Rim
  const rimY = bbY + bbH + 4 * scale;
  ctx.strokeStyle = '#ff6b1a';
  ctx.lineWidth = Math.max(2, 5 * scale);
  ctx.beginPath();
  ctx.ellipse(x, rimY, 26 * scale, 7 * scale, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Net
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = Math.max(1, 1.4 * scale);
  const netH = 28 * scale;
  for (let i = -3; i <= 3; i++) {
    const tx = i / 3;
    const top = x + tx * 26 * scale;
    const bot = x + tx * 14 * scale;
    ctx.beginPath();
    ctx.moveTo(top, rimY);
    ctx.lineTo(bot, rimY + netH);
    ctx.stroke();
  }
  // Cross strands
  for (let r = 1; r <= 3; r++) {
    const yy = rimY + (netH * r) / 3;
    const ww = 26 * scale - (r * 4 * scale);
    ctx.beginPath();
    ctx.ellipse(x, yy, ww, 4 * scale, 0, 0, Math.PI);
    ctx.stroke();
  }
  // Net shake when scored
  if (o && o.scored) {
    ctx.strokeStyle = 'rgba(255,204,51,0.85)';
    ctx.lineWidth = Math.max(2, 2.2 * scale);
    ctx.beginPath();
    ctx.ellipse(x, rimY + netH + Math.sin(player.animTime * 28) * 4 * scale, 18 * scale, 4 * scale, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}


function drawCollectible(c) {
  const d = c.d;
  if (d > 1700) return;
  const scale = getScale(d);
  const x = laneXAt(c.lane, d);
  const bob = Math.sin((distance + d) * 0.012) * 6 * scale;
  const y = projectY(d) - 70 * scale + bob;
  const grad = ctx.createRadialGradient(x, y, 0, x, y, 36 * scale);
  grad.addColorStop(0, 'rgba(255,200,80,0.5)');
  grad.addColorStop(1, 'rgba(255,200,80,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, 36 * scale, 0, Math.PI * 2);
  ctx.fill();
  drawBasketball(x, y, 18 * scale, distance * 0.02);
}


// =====================================================================
// RENDER: Player
// =====================================================================
function drawPlayer() {
  const skin = getSkin(equippedSkinId);

  // === Special: Dunk-attack scripted render ===
  if (player.state === 'dunkAttack') {
    drawPlayerDunkAttack(skin);
    return;
  }

  const x = laneXAtVisual(player.visualLane, 0);
  const groundYpos = projectY(0);

  // Snappy lane-switch HOP for that Subway Surfers juke
  let switchHop = 0;
  if (player.laneSwitchT < 1 && player.state !== 'jump' && player.state !== 'slide') {
    switchHop = -Math.sin(player.laneSwitchT * Math.PI) * 22;
  }
  const baseY = groundYpos + player.y + switchHop;

  // Trail/echo when lane switching fast
  if (player.laneSwitchT < 1) {
    const switchT = player.laneSwitchT;
    const echoes = 4;
    for (let i = 1; i <= echoes; i++) {
      const t = Math.max(0, switchT - i * 0.07);
      const eased = 1 - Math.pow(1 - t, 3);
      const echoLane = player.prevLane + (player.lane - player.prevLane) * eased;
      const ex = laneXAtVisual(echoLane, 0);
      const ehop = -Math.sin(t * Math.PI) * 22;
      const ey = groundYpos + ehop;
      const alpha = Math.max(0, 0.32 - i * 0.07) * (1 - switchT * 0.55);
      if (alpha <= 0) continue;
      ctx.globalAlpha = alpha;
      ctx.save();
      ctx.translate(ex, ey);
      drawPlayerSilhouette(skin);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  const airFactor = Math.max(0, Math.min(1, -player.y / 200));
  const shadowAlpha = 0.45 * (1 - airFactor * 0.7);
  const shadowScale = 1 - airFactor * 0.4;
  ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
  ctx.beginPath();
  ctx.ellipse(x, groundYpos + 6, 50 * shadowScale, 13 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

  let lean = 0;
  let ballPos = 'dribble';
  let isSlide = false;
  let sideStep = 0;     // -1..1 visual side-step kick
  let bodyTwist = 0;

  if (player.state === 'crossover') {
    const t = 1 - player.stateTimer / ANIM.crossover;
    lean = Math.sin(t * Math.PI) * -0.5;
    ballPos = 'cross';
    bodyTwist = -0.25 * Math.sin(t * Math.PI);
  } else if (player.state === 'behindBack') {
    const t = 1 - player.stateTimer / ANIM.behindBack;
    lean = Math.sin(t * Math.PI) * 0.5;
    ballPos = 'behind';
    bodyTwist = 0.25 * Math.sin(t * Math.PI);
  } else if (player.state === 'slide') {
    isSlide = true;
    ballPos = 'forward';
  } else if (player.state === 'jump') {
    ballPos = 'dunk';
  }

  // Lane-switch side-step kick (visual)
  if (player.laneSwitchT < 1) {
    const dir = Math.sign(player.lane - player.prevLane) || 0;
    const sw = 1 - Math.pow(1 - player.laneSwitchT, 2);
    sideStep = dir * Math.sin(sw * Math.PI) * 0.6;
    lean += dir * Math.sin(sw * Math.PI) * 0.18;
  }

  ctx.save();
  ctx.translate(x, baseY);
  ctx.rotate(lean);

  const runT = player.animTime * 14;
  const isRunningPose = !isSlide && player.state !== 'jump';
  const legSwing = isRunningPose
    ? Math.sin(runT) * 14 + sideStep * 18
    : 0;
  const bodyBob = isRunningPose ? -Math.abs(Math.sin(runT * 2)) * 4 : 0;
  ctx.translate(0, bodyBob);
  if (bodyTwist !== 0) ctx.transform(1, 0, bodyTwist, 1, 0, 0); // skew x by twist

  if (isSlide) ctx.scale(1.35, 0.45);

  drawPlayerBody(legSwing, runT, ballPos, skin);

  ctx.restore();
}


function drawPlayerSilhouette(skin) {
  ctx.fillStyle = skin.jersey[1];
  ctx.beginPath();
  ctx.moveTo(-26, -135);
  ctx.lineTo(26, -135);
  ctx.lineTo(30, -46);
  ctx.lineTo(-30, -46);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -160, 16, 0, Math.PI * 2);
  ctx.fill();
}


function drawPlayerBody(legSwing, runT, ballPos, skin) {
  // Shorts
  ctx.fillStyle = skin.shorts;
  ctx.beginPath();
  ctx.moveTo(-24, -78);
  ctx.lineTo(24, -78);
  ctx.lineTo(30, -46);
  ctx.lineTo(-30, -46);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = skin.shortsTrim;
  ctx.fillRect(-30, -50, 60, 3);

  // Legs
  ctx.strokeStyle = skin.body;
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
  ctx.fillStyle = skin.sneaker;
  ctx.beginPath();
  ctx.ellipse(-15 + legSwing, 0, 15, 7, 0, 0, Math.PI * 2);
  ctx.ellipse(15 - legSwing, 0, 15, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skin.stripe;
  ctx.fillRect(-23 + legSwing, -3, 16, 3);
  ctx.fillRect(7 - legSwing, -3, 16, 3);

  // Jersey
  const jersey = ctx.createLinearGradient(0, -135, 0, -78);
  jersey.addColorStop(0, skin.jersey[0]);
  jersey.addColorStop(1, skin.jersey[1]);
  ctx.fillStyle = jersey;
  ctx.beginPath();
  ctx.moveTo(-26, -135);
  ctx.lineTo(26, -135);
  ctx.lineTo(30, -78);
  ctx.lineTo(-30, -78);
  ctx.closePath();
  ctx.fill();
  // Jersey trim
  ctx.fillStyle = skin.jerseyTrim;
  ctx.fillRect(-30, -82, 60, 3);

  // Number
  ctx.fillStyle = skin.numberColor;
  ctx.font = '900 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(skin.number, 0, -104);

  // Neck
  ctx.fillStyle = skin.body;
  ctx.fillRect(-7, -145, 14, 12);

  // Head
  ctx.fillStyle = skin.body;
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

  ctx.strokeStyle = skin.body;
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';

  drawArmsAndBall(ballPos, runT, legSwing);
}


function drawArmsAndBall(ballPos, runT, legSwing) {
  if (ballPos === 'dribble') {
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
  } else if (ballPos === 'cross') {
    const t = 1 - player.stateTimer / ANIM.crossover;
    const k = Math.sin(t * Math.PI);
    const ballX = -18 - 32 * k;
    const ballY = -22 + 12 * k;
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
    ctx.beginPath();
    ctx.moveTo(-22, -130);
    ctx.lineTo(-2, -100);
    ctx.lineTo(ballX - 6, ballY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(22, -130);
    ctx.lineTo(38, -102);
    ctx.lineTo(50, -88);
    ctx.stroke();
    drawBasketball(ballX, ballY, 13, -t * 5);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(50 + i * 8, -60 - i * 4);
      ctx.lineTo(30 + i * 8, -60 - i * 4);
      ctx.stroke();
    }
  } else if (ballPos === 'forward') {
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
  }
}


// === Dunk-attack scripted player render ===
function drawPlayerDunkAttack(skin) {
  const p = Math.min(1, player.dunkPhase);
  // ease in-out
  const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  const startD = 0;
  const endD = player.dunkHoop ? Math.max(0, player.dunkHoop.d - 60) : 600;
  const currD = startD + (endD - startD) * ease;
  const baseX = laneXAtVisual(player.dunkTarget ? player.dunkTarget.lane : player.lane, currD);
  const baseY = projectY(currD);
  const arc = -Math.sin(p * Math.PI) * 320;
  const sc = getScale(currD);

  // Shadow on ground (where defender is)
  const shadowD = startD + (endD - startD) * Math.max(0, ease - 0.1);
  const sx = laneXAtVisual(player.dunkTarget ? player.dunkTarget.lane : player.lane, shadowD);
  const sy = projectY(shadowD);
  ctx.fillStyle = `rgba(0,0,0,${0.3 * (1 - Math.abs(arc) / 400)})`;
  ctx.beginPath();
  ctx.ellipse(sx, sy + 6, 45 * sc, 12 * sc, 0, 0, Math.PI * 2);
  ctx.fill();

  // Motion blur trail
  for (let i = 1; i <= 4; i++) {
    const tp = Math.max(0, p - i * 0.04);
    const e2 = tp < 0.5 ? 2 * tp * tp : 1 - Math.pow(-2 * tp + 2, 2) / 2;
    const cd = startD + (endD - startD) * e2;
    const tx = laneXAtVisual(player.dunkTarget ? player.dunkTarget.lane : player.lane, cd);
    const ty = projectY(cd) - Math.sin(tp * Math.PI) * 320;
    const a = 0.16 - i * 0.035;
    if (a <= 0) continue;
    ctx.globalAlpha = a;
    ctx.save();
    ctx.translate(tx, ty);
    ctx.scale(getScale(cd), getScale(cd));
    drawPlayerSilhouette(skin);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  ctx.save();
  ctx.translate(baseX, baseY + arc);
  ctx.scale(sc, sc);
  // Slight forward lean during flight
  ctx.rotate(-0.18);

  // Body in dunk pose, but evolve through phases
  const phase = p;
  // Shorts
  ctx.fillStyle = skin.shorts;
  ctx.beginPath();
  ctx.moveTo(-24, -78);
  ctx.lineTo(24, -78);
  ctx.lineTo(30, -46);
  ctx.lineTo(-30, -46);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = skin.shortsTrim;
  ctx.fillRect(-30, -50, 60, 3);

  // Legs tucked then extended for slam
  const legTuck = phase < 0.7 ? Math.sin(phase * 4) * 5 : -10;
  ctx.strokeStyle = skin.body;
  ctx.lineWidth = 13;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-12, -46);
  ctx.lineTo(-18, -28 + legTuck);
  ctx.lineTo(-22, -8 + legTuck * 1.2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(12, -46);
  ctx.lineTo(18, -28 + legTuck);
  ctx.lineTo(22, -8 + legTuck * 1.2);
  ctx.stroke();

  // Sneakers
  ctx.fillStyle = skin.sneaker;
  ctx.beginPath();
  ctx.ellipse(-22, -8 + legTuck * 1.2, 15, 7, 0, 0, Math.PI * 2);
  ctx.ellipse(22, -8 + legTuck * 1.2, 15, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skin.stripe;
  ctx.fillRect(-30, -11 + legTuck * 1.2, 16, 3);
  ctx.fillRect(14, -11 + legTuck * 1.2, 16, 3);

  // Jersey
  const jg = ctx.createLinearGradient(0, -135, 0, -78);
  jg.addColorStop(0, skin.jersey[0]);
  jg.addColorStop(1, skin.jersey[1]);
  ctx.fillStyle = jg;
  ctx.beginPath();
  ctx.moveTo(-26, -135);
  ctx.lineTo(26, -135);
  ctx.lineTo(30, -78);
  ctx.lineTo(-30, -78);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = skin.jerseyTrim;
  ctx.fillRect(-30, -82, 60, 3);
  ctx.fillStyle = skin.numberColor;
  ctx.font = '900 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(skin.number, 0, -104);

  // Neck
  ctx.fillStyle = skin.body;
  ctx.fillRect(-7, -145, 14, 12);
  // Head
  ctx.beginPath();
  ctx.arc(0, -160, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skin.hair;
  ctx.beginPath();
  ctx.arc(0, -165, 18, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = skin.headband;
  ctx.fillRect(-19, -167, 38, 5);
  ctx.fillStyle = '#fff';
  ctx.fillRect(-9, -160, 5, 4);
  ctx.fillRect(4, -160, 5, 4);
  ctx.fillStyle = '#1a0a00';
  ctx.fillRect(-7, -160, 3, 4);
  ctx.fillRect(5, -160, 3, 4);

  // Arms: dunk pose. Right arm up holding ball; ball stays high until ~0.85 then slams in.
  ctx.strokeStyle = skin.body;
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';

  // Off arm extended (left)
  ctx.beginPath();
  ctx.moveTo(-15, -130);
  ctx.lineTo(-32, -110 - phase * 30);
  ctx.lineTo(-50, -100 - phase * 30);
  ctx.stroke();

  // Right arm: rises to ~-220 then slams down at 0.8+
  let rArmTipY, ballY;
  if (phase < 0.8) {
    const tt = phase / 0.8;
    rArmTipY = -200 - tt * 30;
    ballY = rArmTipY - 24;
  } else {
    const tt = (phase - 0.8) / 0.2;
    rArmTipY = -230 + tt * 60;
    ballY = rArmTipY - 16;
  }
  ctx.beginPath();
  ctx.moveTo(15, -130);
  ctx.lineTo(20, -180);
  ctx.lineTo(18, rArmTipY);
  ctx.stroke();

  if (phase < 0.95) {
    drawBasketball(18, ballY, 15, player.animTime * 12);
  }

  // Speed lines
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(-60 - i * 6, -80 + i * 14);
    ctx.lineTo(-30 - i * 6, -80 + i * 14);
    ctx.stroke();
  }

  ctx.restore();
}


// =====================================================================
// PARTICLES
// =====================================================================
function drawParticles() {
  for (const p of particles) {
    const a = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color || '#ffffff';
    ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
  }
  ctx.globalAlpha = 1;
}


// =====================================================================
// MAIN RENDER
// =====================================================================
function render() {
  ctx.clearRect(0, 0, W, H);
  drawCourt();

  const all = [];
  for (const o of obstacles) all.push({ kind: 'o', d: o.d, ref: o });
  for (const c of collectibles) all.push({ kind: 'c', d: c.d, ref: c });
  all.sort((a, b) => b.d - a.d);

  for (const e of all) {
    if (e.d < -120) continue;
    if (e.kind === 'o') drawObstacle(e.ref);
    else if (!e.ref.collected) drawCollectible(e.ref);
  }

  if (state !== STATE.MENU && state !== STATE.SHOP) drawPlayer();
  drawParticles();
}


// =====================================================================
// MAIN LOOP
// =====================================================================
let lastT = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - lastT) / 1000);
  lastT = now;
  update(dt);
  render();
  if (typeof renderShopFrame === 'function') renderShopFrame(dt);
  requestAnimationFrame(loop);
}


// =====================================================================
// UI
// =====================================================================
const menuEl = document.getElementById('menu');
const gameOverEl = document.getElementById('gameover');
const hudEl = document.getElementById('hud');
const shopEl = document.getElementById('shop');
const scoreEl = document.getElementById('score');
const coinsHudEl = document.getElementById('coins-hud');
const coinsMenuEl = document.getElementById('coins-menu');
const coinsShopEl = document.getElementById('coins-shop');
const finalScoreEl = document.getElementById('final-score-val');
const coinsEarnedEl = document.getElementById('coins-earned-val');
const highScoreEl = document.getElementById('high-score-val');
const skinGridEl = document.getElementById('skin-grid');
const heroPreviewEl = document.getElementById('hero-preview');
const heroNameEl = document.getElementById('hero-name');
const heroRarityEl = document.getElementById('hero-rarity');
const shopActionBtn = document.getElementById('shop-action-btn');

document.getElementById('play-btn').addEventListener('click', startGame);
document.getElementById('retry-btn').addEventListener('click', startGame);
document.getElementById('shop-btn').addEventListener('click', openShop);
document.getElementById('shop-back').addEventListener('click', closeShop);
document.getElementById('gameover-menu-btn').addEventListener('click', backToMenu);

let selectedShopSkinId = equippedSkinId;

function startGame() {
  reset();
  state = STATE.PLAYING;
  menuEl.classList.add('hidden');
  gameOverEl.classList.add('hidden');
  shopEl.classList.add('hidden');
  hudEl.classList.remove('hidden');
  scoreEl.textContent = '0';
  coinsHudEl.textContent = '0';
}

function gameOver() {
  state = STATE.OVER;
  const finalScore = Math.floor(score);
  if (finalScore > highScore) {
    highScore = finalScore;
    localStorage.setItem('bbr_high', String(highScore));
  }
  finalScoreEl.textContent = finalScore;
  coinsEarnedEl.textContent = runCoins;
  highScoreEl.textContent = highScore;
  gameOverEl.classList.remove('hidden');
  hudEl.classList.add('hidden');
  const px = laneXAtVisual(player.visualLane, 0);
  const py = projectY(0);
  for (let i = 0; i < 36; i++) {
    particles.push({
      x: px, y: py - 80,
      vx: (Math.random() - 0.5) * 700,
      vy: -Math.random() * 500 - 80,
      life: 1.0, maxLife: 1.0,
      color: ['#ff6b1a', '#ffcc33', '#ffffff', '#c8102e'][i % 4],
    });
  }
}

function backToMenu() {
  state = STATE.MENU;
  reset();
  gameOverEl.classList.add('hidden');
  hudEl.classList.add('hidden');
  shopEl.classList.add('hidden');
  menuEl.classList.remove('hidden');
  refreshMenuCoins();
}

function refreshMenuCoins() {
  coinsMenuEl.textContent = coins;
  coinsShopEl.textContent = coins;
}
refreshMenuCoins();

function flashHud() {
  coinsHudEl.parentElement.animate(
    [
      { transform: 'scale(1)', filter: 'brightness(1)' },
      { transform: 'scale(1.15)', filter: 'brightness(1.5)' },
      { transform: 'scale(1)', filter: 'brightness(1)' },
    ],
    { duration: 360, easing: 'ease-out' }
  );
}


// =====================================================================
// SHOP  (Subway-Surfers-style: hero preview + grid + footer action)
// =====================================================================
let shopAnimT = 0;

function openShop() {
  state = STATE.SHOP;
  selectedShopSkinId = equippedSkinId;
  menuEl.classList.add('hidden');
  shopEl.classList.remove('hidden');
  refreshMenuCoins();
  buildShop();
}
function closeShop() {
  state = STATE.MENU;
  shopEl.classList.add('hidden');
  menuEl.classList.remove('hidden');
  refreshMenuCoins();
}

// Build mini cards in the grid
function buildShop() {
  skinGridEl.innerHTML = '';
  for (const skin of SKINS) {
    const card = document.createElement('div');
    card.className = 'skin-card';
    card.dataset.id = skin.id;

    const owned = unlockedSkins.has(skin.id);
    const equipped = skin.id === equippedSkinId;
    const selected = skin.id === selectedShopSkinId;

    if (selected) card.classList.add('selected');
    if (!owned) card.classList.add('locked');

    // Avatar canvas
    const avatar = document.createElement('canvas');
    avatar.className = 'avatar';
    avatar.width = 132;
    avatar.height = 176;
    card.appendChild(avatar);

    // Equipped tick
    if (equipped) {
      const tick = document.createElement('div');
      tick.className = 'equipped-tick';
      tick.textContent = '\u2713';
      card.appendChild(tick);
    }

    // Lock icon when not owned
    if (!owned) {
      const lock = document.createElement('div');
      lock.className = 'lock-icon';
      lock.textContent = '\u{1F512}';
      card.appendChild(lock);
    }

    // Price tag
    const price = document.createElement('div');
    price.className = 'price-tag';
    if (owned) {
      price.classList.add('owned');
      price.textContent = equipped ? 'EQUIPPED' : 'OWNED';
    } else {
      if (coins < skin.price) price.classList.add('cant-afford');
      const dot = document.createElement('span');
      dot.className = 'coin-dot';
      price.appendChild(dot);
      const num = document.createElement('span');
      num.textContent = skin.price.toLocaleString();
      price.appendChild(num);
    }
    card.appendChild(price);

    // Rarity bar at the bottom
    const rb = document.createElement('div');
    rb.className = 'rarity-bar ' + skin.rarity;
    card.appendChild(rb);

    card.addEventListener('click', () => selectShopSkin(skin.id));
    skinGridEl.appendChild(card);

    // Render avatar after attach
    drawSkinAvatar(avatar, skin, owned);
  }

  drawHeroPreview(true);
  refreshShopFooter();
}

function selectShopSkin(id) {
  selectedShopSkinId = id;
  shopAnimT = 0; // little replay animation on select
  for (const el of skinGridEl.querySelectorAll('.skin-card')) {
    el.classList.toggle('selected', el.dataset.id === id);
  }
  refreshShopFooter();
  drawHeroPreview(true);
}

function refreshShopFooter() {
  const skin = getSkin(selectedShopSkinId);
  heroNameEl.textContent = skin.name;
  heroRarityEl.textContent = skin.rarity.toUpperCase();
  heroRarityEl.className = 'hero-rarity ' + skin.rarity;

  shopActionBtn.classList.remove('btn-secondary', 'btn-gold');
  shopActionBtn.disabled = false;

  if (unlockedSkins.has(skin.id)) {
    if (skin.id === equippedSkinId) {
      shopActionBtn.textContent = 'EQUIPPED';
      shopActionBtn.disabled = true;
    } else {
      shopActionBtn.textContent = 'EQUIP';
    }
    shopActionBtn.onclick = () => {
      if (skin.id === equippedSkinId) return;
      equippedSkinId = skin.id;
      saveEquipped();
      buildShop();
    };
  } else {
    shopActionBtn.textContent = `BUY  ${skin.price.toLocaleString()}`;
    shopActionBtn.classList.add('btn-gold');
    if (coins < skin.price) shopActionBtn.disabled = true;
    shopActionBtn.onclick = () => {
      if (coins < skin.price) return;
      coins -= skin.price;
      saveCoins();
      unlockedSkins.add(skin.id);
      saveUnlocked();
      equippedSkinId = skin.id;
      saveEquipped();
      refreshMenuCoins();
      buildShop();
    };
  }
}

// Draw a single small avatar inside a grid card. Self-contained: never touches global ctx.
function drawSkinAvatar(canvasEl, skin, owned) {
  const c = canvasEl.getContext('2d');
  const cw = canvasEl.width;
  const ch = canvasEl.height;
  c.clearRect(0, 0, cw, ch);

  // Soft floor shadow
  c.fillStyle = 'rgba(0, 0, 0, 0.28)';
  c.beginPath();
  c.ellipse(cw / 2, ch * 0.92, cw * 0.30, 6, 0, 0, Math.PI * 2);
  c.fill();

  // Render the player using the same body code, with global ctx temporarily swapped.
  const oldCtx = ctx;
  ctx = c;
  try {
    c.save();
    c.translate(cw / 2, ch * 0.94);
    const sc = ch / 230;
    c.scale(sc, sc);
    drawPlayerBody(0, 0, 'dribble', skin);
    c.restore();
  } finally {
    ctx = oldCtx;
  }

  if (!owned) {
    // Light desat veil; CSS adds the rest
    c.fillStyle = 'rgba(10, 5, 24, 0.25)';
    c.fillRect(0, 0, cw, ch);
  }
}

// Big animated hero canvas. Called every frame from main loop while shop is open.
function drawHeroPreview(reset) {
  if (!heroPreviewEl) return;
  if (reset) shopAnimT = 0;
  const skin = getSkin(selectedShopSkinId);
  const c = heroPreviewEl.getContext('2d');
  const cw = heroPreviewEl.width;
  const ch = heroPreviewEl.height;
  c.clearRect(0, 0, cw, ch);

  // Spotlight + floor disc
  const grad = c.createRadialGradient(cw / 2, ch * 0.85, cw * 0.05, cw / 2, ch * 0.85, cw * 0.55);
  grad.addColorStop(0, 'rgba(255, 204, 51, 0.22)');
  grad.addColorStop(1, 'rgba(255, 204, 51, 0)');
  c.fillStyle = grad;
  c.beginPath();
  c.ellipse(cw / 2, ch * 0.92, cw * 0.45, 18, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = 'rgba(0, 0, 0, 0.45)';
  c.beginPath();
  c.ellipse(cw / 2, ch * 0.94, cw * 0.30, 9, 0, 0, Math.PI * 2);
  c.fill();

  // Body + gentle running animation
  const bob = Math.sin(shopAnimT * 6) * 3;
  const runT = shopAnimT * 9;
  const legSwing = Math.sin(runT) * 9;

  const oldCtx = ctx;
  ctx = c;
  try {
    c.save();
    c.translate(cw / 2, ch * 0.92 + bob);
    const sc = ch / 230;
    c.scale(sc, sc);
    drawPlayerBody(legSwing, runT, 'dribble', skin);
    c.restore();
  } finally {
    ctx = oldCtx;
  }
}

function renderShopFrame(dt) {
  if (state !== STATE.SHOP) return;
  shopAnimT += dt;
  drawHeroPreview(false);
}


requestAnimationFrame(loop);
