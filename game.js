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
let floatingTexts = [];


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
// SPAWN PATTERNS  (defender rate reduced, real slide barrier added)
// =====================================================================
function spawnPattern() {
  const r = Math.random();
  const dist = 1500;

  // Probability budget (sums to 1):
  //  0.00 - 0.10  defender + hoop          (10%)  ← reduced
  //  0.10 - 0.30  cone(s) - jump           (20%)
  //  0.30 - 0.50  barrier - hard slide     (20%)  ← NEW: clearly low ground obstacle
  //  0.50 - 0.66  lowbar - slide under     (16%)
  //  0.66 - 0.78  banner - overhead slide  (12%)
  //  0.78 - 0.94  ball pickups             (16%)
  //  0.94 - 1.00  combo balls + cone       (6%)

  if (r < 0.10) {
    // Defender with hoop behind him
    const lane = Math.random() < 0.5 ? 0 : 1;
    const def = {
      kind: 'defender', lane, d: dist,
      jumpProgress: 0, fallProgress: 0,
    };
    const hoop = { kind: 'hoop', lane, d: dist + 240, scored: false };
    def.linkedHoop = hoop;
    obstacles.push(def, hoop);
  } else if (r < 0.30) {
    // Cone(s) - jump over
    const both = Math.random() < 0.18;
    if (both) {
      const firstLane = Math.random() < 0.5 ? 0 : 1;
      obstacles.push({ kind: 'cone', lane: firstLane, d: dist });
      obstacles.push({ kind: 'cone', lane: 1 - firstLane, d: dist + 280 });
    } else {
      obstacles.push({ kind: 'cone', lane: Math.random() < 0.5 ? 0 : 1, d: dist });
    }
  } else if (r < 0.50) {
    // BARRIER - low construction barrier on the ground (slide!)
    const span = Math.random();
    if (span < 0.35) {
      // span both lanes -> must slide
      obstacles.push({ kind: 'barrier', lane: -1, d: dist });
    } else {
      obstacles.push({ kind: 'barrier', lane: Math.random() < 0.5 ? 0 : 1, d: dist });
    }
  } else if (r < 0.66) {
    // LOWBAR - limbo bar at chest height
    const span = Math.random();
    if (span < 0.4) {
      obstacles.push({ kind: 'lowbar', lane: -1, d: dist });
    } else {
      obstacles.push({ kind: 'lowbar', lane: Math.random() < 0.5 ? 0 : 1, d: dist });
    }
  } else if (r < 0.78) {
    const both = Math.random() < 0.6;
    obstacles.push({
      kind: 'banner',
      lane: both ? -1 : (Math.random() < 0.5 ? 0 : 1),
      d: dist,
    });
  } else if (r < 0.94) {
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
  obstacles = [];
  collectibles = [];
  particles = [];
  floatingTexts = [];
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

  // floating toast texts
  for (const t of floatingTexts) {
    t.y -= 60 * dt;
    t.life -= dt;
  }
  floatingTexts = floatingTexts.filter((t) => t.life > 0);

  if (state !== STATE.PLAYING) return;

  // ========== DUNK-ATTACK SCRIPTED SEQUENCE ==========
  if (player.state === 'dunkAttack') {
    player.dunkPhase += dt / player.dunkDuration;
    const p = Math.min(1, player.dunkPhase);

    if (player.dunkTarget) {
      // Defender BLOCK ATTEMPT: rises 0..0.35, peaks 0.35..0.45, comes down by 0.55
      let jp;
      if (p < 0.35) jp = p / 0.35;            // jumping up
      else if (p < 0.55) jp = 1 - (p - 0.35) / 0.2; // coming back down
      else jp = 0;
      player.dunkTarget.jumpProgress = Math.max(0, jp);

      // Defender starts falling backward at 0.55 (after he comes down empty-handed)
      if (p > 0.55) {
        const fp = Math.min(1, (p - 0.55) / 0.3);
        player.dunkTarget.fallProgress = fp;
        // Dust as he hits the floor
        if (fp > 0.4 && fp < 0.7 && Math.random() < 0.7) {
          const dx = laneXAt(player.dunkTarget.lane, Math.max(0, player.dunkTarget.d));
          const dy = projectY(Math.max(0, player.dunkTarget.d));
          particles.push({
            x: dx + (Math.random() - 0.5) * 50, y: dy,
            vx: (Math.random() - 0.5) * 240, vy: -Math.random() * 140,
            life: 0.45, maxLife: 0.45, color: '#d9a574',
          });
        }
      }
    }

    // when slam happens (~0.85), spawn celebration burst from hoop
    if (player.dunkHoop && !player.dunkHoop.scored && p >= 0.82) {
      player.dunkHoop.scored = true;
      const hx = laneXAt(player.dunkHoop.lane, Math.max(0, player.dunkHoop.d));
      const hy = projectY(Math.max(0, player.dunkHoop.d)) - 300 * getScale(Math.max(0, player.dunkHoop.d));
      for (let i = 0; i < 32; i++) {
        particles.push({
          x: hx, y: hy,
          vx: (Math.random() - 0.5) * 560,
          vy: -Math.random() * 420 - 80,
          life: 0.9, maxLife: 0.9,
          color: ['#ffcc33', '#ff6b1a', '#ffffff', '#2ecc71'][i % 4],
        });
      }
      // floating "+500 PERFECT!" toast
      floatingTexts.push({
        text: '+500  PERFECT!',
        x: hx, y: hy - 30,
        life: 1.2, maxLife: 1.2,
        color: '#ffcc33',
      });
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
      for (const o of obstacles) o.d -= advance;
      for (const c of collectibles) c.d -= advance;
      distance += advance;
      if (player.dunkTarget) player.dunkTarget.processed = true;
      if (player.dunkHoop) player.dunkHoop.processed = true;
      obstacles = obstacles.filter((o) => o !== player.dunkTarget && o !== player.dunkHoop);
      // landing dust
      const lx = laneXAtVisual(player.visualLane, 0);
      const ly = projectY(0);
      for (let i = 0; i < 18; i++) {
        particles.push({
          x: lx + (Math.random() - 0.5) * 60, y: ly,
          vx: (Math.random() - 0.5) * 340, vy: -Math.random() * 240,
          life: 0.55, maxLife: 0.55, color: '#d9a574',
        });
      }
      player.state = 'run';
      player.dunkPhase = 0;
      player.dunkTarget = null;
      player.dunkHoop = null;
      player.y = 0;
      player.vy = 0;
      player.visualLane = player.lane;
      player.prevLane = player.lane;
      player.laneSwitchT = 1;
    }

    player.animTime += dt;
    scoreEl.textContent = Math.floor(score);
    coinsHudEl.textContent = runCoins;
    return;
  }

  // ========== NORMAL UPDATE ==========
  speed = baseSpeed + Math.min(distance / 9000, 1) * 10;
  distance += speed;
  score += speed * dt * 2.2;

  // Smooth lane interpolation with ease-out (a bit snappier now)
  player.laneSwitchT = Math.min(1, player.laneSwitchT + dt * 7.5);
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
        (o.kind === 'barrier' && player.state === 'slide') ||
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
function spawnLaneDust() {
  const fx = laneXAtVisual(player.visualLane, 0);
  const fy = projectY(0);
  for (let i = 0; i < 9; i++) {
    particles.push({
      x: fx + (Math.random() - 0.5) * 30,
      y: fy + (Math.random() - 0.5) * 4,
      vx: (Math.random() - 0.5) * 220,
      vy: -Math.random() * 110 - 20,
      life: 0.4, maxLife: 0.4,
      color: '#d9a574',
    });
  }
}

function setLane(targetLane) {
  if (state !== STATE.PLAYING) return;
  if (player.state === 'dunkAttack') return;
  if (player.lane !== targetLane) {
    spawnLaneDust();
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
  if (o.kind === 'barrier' && o.lane === -1) {
    drawBarrierSpan(d, scale);
    return;
  }

  const x = laneXAt(o.lane, d);

  if (o.kind === 'defender') drawDefender(x, y, scale, o);
  else if (o.kind === 'cone') drawCone(x, y, scale);
  else if (o.kind === 'banner') drawSingleBanner(x, y, scale);
  else if (o.kind === 'lowbar') drawLowBarSingle(x, y, scale);
  else if (o.kind === 'barrier') drawBarrierSingle(x, y, scale);
  else if (o.kind === 'hoop') drawHoop(x, y, scale, o);
}


function drawDefender(x, y, scale, o) {
  const fall = o ? (o.fallProgress || 0) : 0;
  const jump = o ? (o.jumpProgress || 0) : 0;
  const h = 200 * scale;
  const w = 56 * scale;

  // shadow (smaller while jumping)
  const shAlpha = 0.35 * (1 - jump * 0.55);
  const shScale = 1 - jump * 0.35;
  ctx.fillStyle = `rgba(0,0,0,${shAlpha})`;
  ctx.beginPath();
  ctx.ellipse(x, y + 2, w * 0.7 * shScale, w * 0.22 * shScale, 0, 0, Math.PI * 2);
  ctx.fill();

  // Block-jump body lift (arc shape)
  const liftY = -Math.sin(jump * Math.PI) * 80 * scale;
  // body squash: takeoff crouch when jump just starts
  const sqZ = jump > 0 && jump < 0.12 ? 1 - jump * 0.6 : 1;
  const sqX = jump > 0 && jump < 0.12 ? 1 + jump * 0.4 : 1;

  ctx.save();
  ctx.translate(x, y + liftY);

  if (fall > 0) {
    // Falling backwards: rotate around feet (lift back to original ground)
    ctx.translate(0, -liftY); // cancel any leftover lift
    const ang = -Math.PI / 2 * Math.min(1, fall * 1.1);
    ctx.rotate(ang);
    if (fall > 0.6) {
      ctx.fillStyle = '#ffcc33';
      const t = (player.animTime * 6) % (Math.PI * 2);
      for (let i = 0; i < 3; i++) {
        const a = t + i * (Math.PI * 2 / 3);
        const sx = Math.cos(a) * 22 * scale;
        const sy = -h * 0.2 + Math.sin(a) * 10 * scale;
        drawStar(sx, sy, 5 * scale);
      }
    }
  } else {
    ctx.scale(sqX, sqZ);
  }

  // legs (shorts)
  ctx.fillStyle = '#1a3a8a';
  ctx.fillRect(-w * 0.4, -h * 0.45, w * 0.3, h * 0.2);
  ctx.fillRect(w * 0.1, -h * 0.45, w * 0.3, h * 0.2);
  ctx.fillStyle = '#5a3520';
  // legs bend slightly during jump (knees up)
  const kneeBend = jump * 12 * scale;
  ctx.fillRect(-w * 0.36, -h * 0.25 + kneeBend, w * 0.22, h * 0.22 - kneeBend);
  ctx.fillRect(w * 0.14, -h * 0.25 + kneeBend, w * 0.22, h * 0.22 - kneeBend);
  ctx.fillStyle = '#fff';
  ctx.fillRect(-w * 0.42, -4 * scale + kneeBend, w * 0.32, 8 * scale);
  ctx.fillRect(w * 0.1, -4 * scale + kneeBend, w * 0.32, 8 * scale);

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

  // ARMS - block pose: stretch up high while jumping; drop on fall
  // raise factor = 1 when jumping, fades on fall
  const armRaise = Math.max(0, Math.max(jump, 1) - Math.max(0, fall * 1.5));
  const baseArmTop = -h * 0.78;
  const reachExtra = 70 * scale * jump; // arms reach much higher mid-block
  const armTopY = baseArmTop - reachExtra * armRaise;
  const handY = armTopY - 28 * scale * armRaise;

  ctx.fillStyle = '#5a3520';
  ctx.lineWidth = 12 * scale;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#5a3520';

  if (fall > 0.3) {
    // dropped arms when fallen
    ctx.fillRect(-w * 1.05, baseArmTop + 20 * scale, w * 0.3, w * 0.22);
    ctx.fillRect(w * 0.75, baseArmTop + 20 * scale, w * 0.3, w * 0.22);
    ctx.beginPath();
    ctx.arc(-w * 1.1, baseArmTop + 20 * scale + w * 0.11, w * 0.18, 0, Math.PI * 2);
    ctx.arc(w * 1.1, baseArmTop + 20 * scale + w * 0.11, w * 0.18, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Arms stroked from shoulder up to overhead reach
    const shoulderY = baseArmTop;
    ctx.beginPath();
    ctx.moveTo(-w * 0.42, shoulderY);
    ctx.lineTo(-w * 0.55, armTopY);
    ctx.lineTo(-w * 0.32, handY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w * 0.42, shoulderY);
    ctx.lineTo(w * 0.55, armTopY);
    ctx.lineTo(w * 0.32, handY);
    ctx.stroke();
    // hands
    ctx.fillStyle = '#5a3520';
    ctx.beginPath();
    ctx.arc(-w * 0.32, handY, w * 0.22, 0, Math.PI * 2);
    ctx.arc(w * 0.32, handY, w * 0.22, 0, Math.PI * 2);
    ctx.fill();
    // motion lines on hands when peaking the block
    if (jump > 0.6) {
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 2 * scale;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-w * 0.6 - i * 4 * scale, handY - 8 * scale - i * 4 * scale);
        ctx.lineTo(-w * 0.4 - i * 4 * scale, handY - 8 * scale - i * 4 * scale);
        ctx.moveTo(w * 0.4 + i * 4 * scale, handY - 8 * scale - i * 4 * scale);
        ctx.lineTo(w * 0.6 + i * 4 * scale, handY - 8 * scale - i * 4 * scale);
        ctx.stroke();
      }
    }
  }

  // head
  ctx.fillStyle = '#5a3520';
  ctx.beginPath();
  ctx.arc(0, -h * 0.88, w * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a0e08';
  ctx.beginPath();
  ctx.arc(0, -h * 0.92, w * 0.32, Math.PI, 0);
  ctx.fill();
  // X eyes when fallen
  if (fall > 0.4) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2 * scale;
    const eyeY = -h * 0.88;
    [-w * 0.12, w * 0.12].forEach((ex) => {
      ctx.beginPath();
      ctx.moveTo(ex - 4 * scale, eyeY - 4 * scale);
      ctx.lineTo(ex + 4 * scale, eyeY + 4 * scale);
      ctx.moveTo(ex + 4 * scale, eyeY - 4 * scale);
      ctx.lineTo(ex - 4 * scale, eyeY + 4 * scale);
      ctx.stroke();
    });
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
}

// BARRIER: low construction barrier on the ground - clearly forces a slide
function drawBarrierBox(x, y, w, h) {
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.ellipse(x, y + 2, w * 0.55, h * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  // base feet (water-fill style)
  ctx.fillStyle = '#1a0a00';
  ctx.fillRect(x - w * 0.5, y - 4, w, 6);
  // body
  ctx.fillStyle = '#ffcc33';
  ctx.fillRect(x - w * 0.5, y - h, w, h);
  // diagonal hazard stripes
  ctx.save();
  ctx.beginPath();
  ctx.rect(x - w * 0.5, y - h, w, h);
  ctx.clip();
  ctx.fillStyle = '#1a0a00';
  const sw = h * 0.55;
  for (let sx = -h; sx < w + h * 2; sx += sw * 2) {
    ctx.beginPath();
    ctx.moveTo(x - w * 0.5 + sx, y);
    ctx.lineTo(x - w * 0.5 + sx + sw, y);
    ctx.lineTo(x - w * 0.5 + sx + sw + h, y - h);
    ctx.lineTo(x - w * 0.5 + sx + h, y - h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // outline
  ctx.strokeStyle = '#1a0a00';
  ctx.lineWidth = Math.max(1, h * 0.06);
  ctx.strokeRect(x - w * 0.5, y - h, w, h);
  // top reflector strip
  ctx.fillStyle = '#fff';
  ctx.fillRect(x - w * 0.45, y - h - 2, w * 0.9, 3);
  ctx.fillStyle = '#c8102e';
  ctx.fillRect(x - w * 0.4, y - h - 2, w * 0.18, 3);
  ctx.fillRect(x + w * 0.22, y - h - 2, w * 0.18, 3);
}

function drawBarrierSingle(x, y, scale) {
  const w = 110 * scale;
  const h = 44 * scale;   // very low — clearly slide-only
  drawBarrierBox(x, y, w, h);
}

function drawBarrierSpan(d, scale) {
  const xL = laneXAt(0, d);
  const xR = laneXAt(1, d);
  const y = projectY(d);
  const cx = (xL + xR) / 2;
  const w = (xR - xL) + 200 * scale;
  const h = 44 * scale;
  drawBarrierBox(cx, y, w, h);
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

  // Lane-switch hop (vertical bounce as we slide sideways)
  let hopOffset = 0;
  if (player.laneSwitchT < 1) {
    hopOffset = -Math.sin(player.laneSwitchT * Math.PI) * 22;
  }
  const baseY = groundYpos + player.y + hopOffset;

  // Trail/echo when lane switching fast (more echoes, stronger fade)
  if (player.laneSwitchT < 1) {
    const switchT = player.laneSwitchT;
    const echoes = 5;
    for (let i = 1; i <= echoes; i++) {
      const t = Math.max(0, switchT - i * 0.05);
      const eased = 1 - Math.pow(1 - t, 3);
      const echoLane = player.prevLane + (player.lane - player.prevLane) * eased;
      const ex = laneXAtVisual(echoLane, 0);
      const eHop = -Math.sin(t * Math.PI) * 22;
      const ey = groundYpos + eHop;
      const alpha = (1 - t) * 0.32 - i * 0.05;
      if (alpha <= 0) continue;
      ctx.globalAlpha = alpha;
      ctx.save();
      ctx.translate(ex, ey);
      drawPlayerSilhouette(skin);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  const airFactor = Math.max(0, Math.min(1, (-player.y - hopOffset) / 220));
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

  // Lane-switch side-step kick + stronger lean into the turn
  if (player.laneSwitchT < 1) {
    const dir = Math.sign(player.lane - player.prevLane) || 0;
    const sw = 1 - Math.pow(1 - player.laneSwitchT, 2);
    sideStep = dir * Math.sin(sw * Math.PI) * 0.7;
    lean += dir * Math.sin(sw * Math.PI) * 0.32;
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
  // Higher arc so the player visibly clears the defender's outstretched arms
  const arc = -Math.sin(p * Math.PI) * 440;
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
    const ty = projectY(cd) - Math.sin(tp * Math.PI) * 440;
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

  // Floating texts (e.g., +500 PERFECT!)
  for (const t of floatingTexts) {
    const a = Math.max(0, t.life / t.maxLife);
    ctx.globalAlpha = a;
    ctx.font = '900 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#1a0a00';
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color || '#ffcc33';
    ctx.fillText(t.text, t.x, t.y);
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
  // Animate the shop preview canvas while the shop is open
  if (state === STATE.SHOP) {
    shopAnimT += dt;
    drawShopStage();
  }
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

const previewCanvasEl = document.getElementById('preview-canvas');
const stageNameEl = document.getElementById('stage-name');
const stageRarityEl = document.getElementById('stage-rarity');
const stagePriceEl = document.getElementById('stage-price');
const thumbRowEl = document.getElementById('thumb-row');
const stagePrevBtn = document.getElementById('stage-prev');
const stageNextBtn = document.getElementById('stage-next');
const shopActionBtn = document.getElementById('shop-action-btn');

document.getElementById('play-btn').addEventListener('click', startGame);
document.getElementById('retry-btn').addEventListener('click', startGame);
document.getElementById('shop-btn').addEventListener('click', openShop);
document.getElementById('shop-back').addEventListener('click', closeShop);
document.getElementById('gameover-menu-btn').addEventListener('click', backToMenu);
stagePrevBtn.addEventListener('click', () => navigateShop(-1));
stageNextBtn.addEventListener('click', () => navigateShop(1));

let selectedShopSkinId = equippedSkinId;
let shopAnimT = 0;

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
// SHOP
// =====================================================================
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

function navigateShop(dir) {
  const idx = SKINS.findIndex((s) => s.id === selectedShopSkinId);
  const next = (idx + dir + SKINS.length) % SKINS.length;
  selectShopSkin(SKINS[next].id, true);
}

function buildShop() {
  // Build the thumbnail row (compact horizontal cards)
  thumbRowEl.innerHTML = '';
  for (const skin of SKINS) {
    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    thumb.dataset.id = skin.id;
    if (!unlockedSkins.has(skin.id)) thumb.classList.add('locked');
    if (skin.id === equippedSkinId) thumb.classList.add('equipped');
    if (skin.id === selectedShopSkinId) thumb.classList.add('selected');

    // rarity dot
    const dot = document.createElement('span');
    dot.className = 'thumb-rarity-dot ' + skin.rarity;
    thumb.appendChild(dot);

    // mini canvas
    const c = document.createElement('canvas');
    c.width = 140;
    c.height = 180;
    thumb.appendChild(c);

    thumb.addEventListener('click', () => selectShopSkin(skin.id, true));
    thumbRowEl.appendChild(thumb);

    drawThumbPreview(c, skin);
  }
  refreshShopFooter();
  // scroll to selected thumbnail
  scrollSelectedThumbIntoView(false);
}

function selectShopSkin(id, scroll) {
  selectedShopSkinId = id;
  for (const el of thumbRowEl.querySelectorAll('.thumb')) {
    el.classList.toggle('selected', el.dataset.id === id);
  }
  refreshShopFooter();
  if (scroll) scrollSelectedThumbIntoView(true);
}

function scrollSelectedThumbIntoView(smooth) {
  const sel = thumbRowEl.querySelector('.thumb.selected');
  if (!sel) return;
  const rect = sel.getBoundingClientRect();
  const parentRect = thumbRowEl.getBoundingClientRect();
  const offset = rect.left - parentRect.left
    - parentRect.width / 2 + rect.width / 2
    + thumbRowEl.scrollLeft;
  thumbRowEl.scrollTo({ left: offset, behavior: smooth ? 'smooth' : 'auto' });
}

function refreshShopFooter() {
  const skin = getSkin(selectedShopSkinId);
  const owned = unlockedSkins.has(skin.id);
  const equipped = skin.id === equippedSkinId;

  // stage info
  stageNameEl.textContent = skin.name;
  stageRarityEl.className = 'stage-rarity ' + skin.rarity;
  stageRarityEl.textContent = skin.rarity.toUpperCase();

  stagePriceEl.className = 'stage-price';
  stagePriceEl.innerHTML = '';
  if (equipped) {
    stagePriceEl.classList.add('equipped');
    stagePriceEl.textContent = 'EQUIPPED';
  } else if (owned) {
    stagePriceEl.classList.add('owned');
    stagePriceEl.textContent = 'OWNED';
  } else {
    if (coins < skin.price) stagePriceEl.classList.add('cant-afford');
    const dot = document.createElement('span');
    dot.className = 'coin-dot';
    stagePriceEl.appendChild(dot);
    const num = document.createElement('span');
    num.textContent = skin.price.toLocaleString();
    stagePriceEl.appendChild(num);
  }

  // action button
  shopActionBtn.classList.remove('btn-secondary', 'btn-gold');
  shopActionBtn.disabled = false;

  if (owned) {
    if (equipped) {
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

// === Big animated character on the shop stage ===
function drawShopStage() {
  if (!previewCanvasEl) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = previewCanvasEl.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  if (
    previewCanvasEl.width !== Math.round(rect.width * dpr) ||
    previewCanvasEl.height !== Math.round(rect.height * dpr)
  ) {
    previewCanvasEl.width = Math.round(rect.width * dpr);
    previewCanvasEl.height = Math.round(rect.height * dpr);
  }
  const c = previewCanvasEl.getContext('2d');
  const cw = previewCanvasEl.width / dpr;
  const ch = previewCanvasEl.height / dpr;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, cw, ch);

  // soft floor disk
  const grad = c.createRadialGradient(cw / 2, ch * 0.86, 0, cw / 2, ch * 0.86, cw * 0.55);
  grad.addColorStop(0, 'rgba(255,107,26,0.35)');
  grad.addColorStop(1, 'rgba(255,107,26,0)');
  c.fillStyle = grad;
  c.fillRect(0, 0, cw, ch);
  c.fillStyle = 'rgba(0,0,0,0.45)';
  c.beginPath();
  c.ellipse(cw / 2, ch * 0.92, cw * 0.28, 12, 0, 0, Math.PI * 2);
  c.fill();

  // animated character (light idle dribble)
  const skin = getSkin(selectedShopSkinId);
  const runT = shopAnimT * 1.6;
  const bob = -Math.abs(Math.sin(runT * 2)) * 4;
  const bodyHeight = 200; // body coords roughly span -180..0
  const fitScale = Math.min(cw / 240, ch / 260) * 1.05;

  // draw on preview ctx by swapping the global ctx (consistent with existing helpers)
  const prev = ctx;
  ctx = c;
  c.save();
  c.translate(cw / 2, ch * 0.92 + bob);
  c.scale(fitScale, fitScale);
  drawPlayerBody(Math.sin(runT) * 14, runT, 'dribble', skin);
  c.restore();
  ctx = prev;

  // small platform sparkle
  c.globalAlpha = 0.55 + Math.sin(shopAnimT * 4) * 0.25;
  c.fillStyle = '#ffcc33';
  for (let i = 0; i < 5; i++) {
    const a = shopAnimT * 0.7 + i * (Math.PI * 2 / 5);
    const sx = cw / 2 + Math.cos(a) * cw * 0.32;
    const sy = ch * 0.92 + Math.sin(a) * 10;
    c.beginPath();
    c.arc(sx, sy, 2, 0, Math.PI * 2);
    c.fill();
  }
  c.globalAlpha = 1;
}

// === Tiny thumbnail preview (drawn once per build) ===
function drawThumbPreview(canvasEl, skin) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvasEl.width = canvasEl.width; // reset
  const c = canvasEl.getContext('2d');
  const cw = canvasEl.width;
  const ch = canvasEl.height;
  c.clearRect(0, 0, cw, ch);

  // background
  const bg = c.createLinearGradient(0, 0, 0, ch);
  bg.addColorStop(0, 'rgba(255,107,26,0.10)');
  bg.addColorStop(1, 'rgba(255,107,26,0.02)');
  c.fillStyle = bg;
  c.fillRect(0, 0, cw, ch);

  // floor
  c.fillStyle = 'rgba(0,0,0,0.25)';
  c.beginPath();
  c.ellipse(cw / 2, ch * 0.88, cw * 0.34, 6, 0, 0, Math.PI * 2);
  c.fill();

  // character (static dribble pose)
  const fitScale = Math.min(cw / 230, ch / 240);
  const prev = ctx;
  ctx = c;
  c.save();
  c.translate(cw / 2, ch * 0.94);
  c.scale(fitScale, fitScale);
  drawPlayerBody(0, 0, 'dribble', skin);
  c.restore();
  ctx = prev;
}


requestAnimationFrame(loop);
