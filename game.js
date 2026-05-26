// === HOOP RUSH 3D — Three.js endless 3-lane runner ===
// Renders with WebGL via Three.js (loaded as global THREE from CDN).
// Preserves the original gameplay: 3 lanes, skins, power-ups, coins,
// obstacle patterns, persistence keys (hr_coins, hr_high, hr_unlocked, hr_skin).
'use strict';

/* =============================================================
 * 1. THREE.js core setup
 * ============================================================= */
const canvas = document.getElementById('game');

const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
  antialias: true,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const SKY_COLOR    = new THREE.Color('#7ec8ff');
const HORIZON_FOG  = new THREE.Color('#ffd9a8');

const scene = new THREE.Scene();
scene.background = SKY_COLOR;
scene.fog = new THREE.Fog(HORIZON_FOG, 35, 130);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / Math.max(1, window.innerHeight),
  0.1,
  300,
);
camera.position.set(0, 4.4, 8.5);
camera.lookAt(0, 1.4, -6);

window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
});

/* =============================================================
 * 2. Game state / constants
 * ============================================================= */
const STATE = { MENU: 0, PLAYING: 1, PAUSED: 2, OVER: 3 };
let state = STATE.MENU;
let menuView = 'main';

let score = 0;
let coins = 0;
let totalCoins = parseInt(localStorage.getItem('hr_coins') || '0', 10);
let highScore  = parseInt(localStorage.getItem('hr_high')  || '0', 10);

const LANES_X = [-3, 0, 3];
const LANE_W  = 3;

// World units / second
const BASE_SPEED   = 22;
const MAX_SPEED    = 38;
const ROCKET_BOOST = 8;
let speed = BASE_SPEED;
let distance = 0;       // in world units
let runDistanceM = 0;   // displayed in HUD
let spawnTimer = 1.0;

// Jump physics
const GRAVITY = 28;     // m/s^2
const JUMP_VY = 12;     // m/s initial upward
const SLIDE_TIME = 0.85;

// Lane change duration (visual)
const LANE_CHANGE_TIME = 0.22;

const power = { magnet: 0, multi: 0, shield: 0, rocket: 0 };

let obstacles    = [];
let collectibles = [];
let particles    = [];
let scenery      = [];
let stripes      = [];

/* =============================================================
 * 3. Skins (same schema as the original 2D game)
 * ============================================================= */
const SKINS = [
  { id: 'rookie',  name: 'ROOKIE',   cost: 0,    jersey1: '#e74c3c', jersey2: '#c8102e', shorts: '#1a2330', skinTone: '#d49b6b', hair: '#1a0e08', headband: '#ff8c3a', shoeStripe: '#ff8c3a', number: '1' },
  { id: 'allstar', name: 'ALL-STAR', cost: 200,  jersey1: '#9b59b6', jersey2: '#6a2a8a', shorts: '#fff7d0', skinTone: '#c08850', hair: '#3a1a08', headband: '#ffd84a', shoeStripe: '#ffd84a', number: '7' },
  { id: 'champ',   name: 'CHAMP',    cost: 500,  jersey1: '#2ea83a', jersey2: '#176022', shorts: '#ffffff', skinTone: '#5a3520', hair: '#0a0500', headband: '#ffffff', shoeStripe: '#2ea83a', number: '23' },
  { id: 'mvp',     name: 'MVP',      cost: 1000, jersey1: '#ffd84a', jersey2: '#c8a022', shorts: '#1a2330', skinTone: '#e6c090', hair: '#c8a022', headband: '#ffffff', shoeStripe: '#ffd84a', number: '0' },
  { id: 'shadow',  name: 'SHADOW',   cost: 1500, jersey1: '#3a3a4a', jersey2: '#0a0a14', shorts: '#0a0a14', skinTone: '#a07050', hair: '#1a1a24', headband: '#ff3a3a', shoeStripe: '#ff3a3a', number: '8' },
  { id: 'ice',     name: 'ICE',      cost: 2000, jersey1: '#a8e0ff', jersey2: '#3a98e8', shorts: '#ffffff', skinTone: '#e8c8a8', hair: '#dfe8f2', headband: '#3a98e8', shoeStripe: '#a8e0ff', number: '3' },
];

let unlockedSkins = JSON.parse(localStorage.getItem('hr_unlocked') || '["rookie"]');
let currentSkinId = localStorage.getItem('hr_skin') || 'rookie';

function getSkin() {
  return SKINS.find((s) => s.id === currentSkinId) || SKINS[0];
}

function saveProgress() {
  localStorage.setItem('hr_coins',    String(totalCoins));
  localStorage.setItem('hr_high',     String(highScore));
  localStorage.setItem('hr_unlocked', JSON.stringify(unlockedSkins));
  localStorage.setItem('hr_skin',     currentSkinId);
}

/* =============================================================
 * 4. Lighting
 * ============================================================= */
const hemi = new THREE.HemisphereLight(0xbfe4ff, 0x4a6a3a, 0.85);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff2c8, 1.15);
sun.position.set(18, 28, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far  = 80;
sun.shadow.camera.left   = -16;
sun.shadow.camera.right  =  16;
sun.shadow.camera.top    =  20;
sun.shadow.camera.bottom = -20;
sun.shadow.bias = -0.0005;
scene.add(sun);
scene.add(sun.target);

// Visible sun disk in the sky (large, far, additive-ish glow)
const sunDisk = new THREE.Mesh(
  new THREE.SphereGeometry(6, 24, 24),
  new THREE.MeshBasicMaterial({ color: 0xfff5c8, fog: false }),
);
sunDisk.position.set(60, 50, -120);
scene.add(sunDisk);

const sunHalo = new THREE.Mesh(
  new THREE.SphereGeometry(11, 24, 24),
  new THREE.MeshBasicMaterial({
    color: 0xffd99a,
    transparent: true,
    opacity: 0.35,
    fog: false,
  }),
);
sunHalo.position.copy(sunDisk.position);
scene.add(sunHalo);

/* =============================================================
 * 5. World — ground, road, sidewalks, curbs, lane stripes
 * ============================================================= */
const ROAD_LENGTH = 240; // visible road plane length
const ROAD_WIDTH  = 9.6; // 3 lanes * 3.2

// Grass
const grass = new THREE.Mesh(
  new THREE.PlaneGeometry(400, ROAD_LENGTH * 1.2),
  new THREE.MeshLambertMaterial({ color: 0x6cbf5a }),
);
grass.rotation.x = -Math.PI / 2;
grass.position.y = -0.02;
grass.receiveShadow = true;
scene.add(grass);

// Asphalt road (3 lanes wide)
const road = new THREE.Mesh(
  new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_LENGTH * 1.2),
  new THREE.MeshLambertMaterial({ color: 0x3a3f48 }),
);
road.rotation.x = -Math.PI / 2;
road.position.y = 0.0;
road.receiveShadow = true;
scene.add(road);

// Sidewalks (light concrete band on each side)
const sidewalkMat = new THREE.MeshLambertMaterial({ color: 0xb8b8b0 });
const sidewalkGeo = new THREE.PlaneGeometry(2.6, ROAD_LENGTH * 1.2);
const sidewalkL = new THREE.Mesh(sidewalkGeo, sidewalkMat);
sidewalkL.rotation.x = -Math.PI / 2;
sidewalkL.position.set(-(ROAD_WIDTH / 2 + 1.3), 0.05, 0);
sidewalkL.receiveShadow = true;
scene.add(sidewalkL);

const sidewalkR = sidewalkL.clone();
sidewalkR.position.x = (ROAD_WIDTH / 2 + 1.3);
scene.add(sidewalkR);

// Raised curbs
const curbMat = new THREE.MeshLambertMaterial({ color: 0x868682 });
const curbGeo = new THREE.BoxGeometry(0.2, 0.2, ROAD_LENGTH * 1.2);
const curbL = new THREE.Mesh(curbGeo, curbMat);
curbL.position.set(-(ROAD_WIDTH / 2 + 0.1), 0.1, 0);
curbL.receiveShadow = true;
curbL.castShadow = true;
scene.add(curbL);
const curbR = curbL.clone();
curbR.position.x = (ROAD_WIDTH / 2 + 0.1);
scene.add(curbR);

// Lane stripes — recycled pool of small white planes
const STRIPE_COUNT = 24;
const STRIPE_LENGTH = 3.0;
const STRIPE_GAP    = 5.0;
const STRIPE_TOTAL  = STRIPE_LENGTH + STRIPE_GAP;
const stripeGeo = new THREE.PlaneGeometry(0.18, STRIPE_LENGTH);
const stripeMat = new THREE.MeshBasicMaterial({ color: 0xfff5d8 });

for (let i = 0; i < STRIPE_COUNT; i++) {
  // Two divider rows: between lane 0/1 and lane 1/2
  for (const lineX of [(LANES_X[0] + LANES_X[1]) / 2, (LANES_X[1] + LANES_X[2]) / 2]) {
    const m = new THREE.Mesh(stripeGeo, stripeMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(lineX, 0.011, -i * STRIPE_TOTAL + 8);
    scene.add(m);
    stripes.push(m);
  }
}

/* =============================================================
 * 6. Scenery — palms, lampposts, low buildings (recycled pool)
 * ============================================================= */
const SCENERY_COUNT = 20;
const SCENERY_RANGE_NEAR =  10;
const SCENERY_RANGE_FAR  = -180;

function buildPalm() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.24, 4.4, 8),
    new THREE.MeshLambertMaterial({ color: 0x7a4a22 }),
  );
  trunk.position.y = 2.2;
  trunk.castShadow = true;
  g.add(trunk);

  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2ea83a });
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 6), leafMat);
    const a = (i / 7) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 0.7, 4.4, Math.sin(a) * 0.7);
    leaf.rotation.z = Math.cos(a) * 0.9 + Math.PI;
    leaf.rotation.x = Math.sin(a) * 0.9;
    leaf.castShadow = true;
    g.add(leaf);
  }
  const top = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 10, 10),
    new THREE.MeshLambertMaterial({ color: 0x3a8a2a }),
  );
  top.position.y = 4.4;
  g.add(top);

  // coconuts
  const coconutMat = new THREE.MeshLambertMaterial({ color: 0x3a2008 });
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 6), coconutMat);
    const a = (i / 3) * Math.PI * 2;
    c.position.set(Math.cos(a) * 0.25, 4.2, Math.sin(a) * 0.25);
    g.add(c);
  }
  return g;
}

function buildLamp() {
  const g = new THREE.Group();
  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.1, 4.6, 8),
    new THREE.MeshLambertMaterial({ color: 0x2a2e36 }),
  );
  post.position.y = 2.3;
  post.castShadow = true;
  g.add(post);
  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.08, 0.08),
    new THREE.MeshLambertMaterial({ color: 0x2a2e36 }),
  );
  arm.position.set(0.5, 4.55, 0);
  g.add(arm);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xfff2a8 }),
  );
  lamp.position.set(0.95, 4.45, 0);
  g.add(lamp);
  return g;
}

function buildBuilding() {
  const g = new THREE.Group();
  const w = 3 + Math.random() * 4;
  const h = 6 + Math.random() * 9;
  const d = 3 + Math.random() * 4;
  const colorPool = [0xc8b8a0, 0xe0d4b8, 0xb8a890, 0x9bb6c8, 0xd0a888, 0xc4a87a];
  const c = colorPool[Math.floor(Math.random() * colorPool.length)];
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color: c }),
  );
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  // Roof block
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.9, 0.4, d * 0.9),
    new THREE.MeshLambertMaterial({ color: 0x4a4a4a }),
  );
  roof.position.y = h + 0.2;
  g.add(roof);

  // Window strip suggestion (a darker plane on facade facing road)
  const winMat = new THREE.MeshLambertMaterial({ color: 0x3a4a6a, emissive: 0x223348, emissiveIntensity: 0.4 });
  for (let row = 0; row < Math.floor(h / 1.6); row++) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.78, 0.6), winMat);
    win.position.set(0, 1.0 + row * 1.6, d / 2 + 0.01);
    g.add(win);
  }
  return g;
}

function buildBush() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x2ea83a });
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.5 + Math.random() * 0.3, 8, 8), mat);
    b.position.set((Math.random() - 0.5) * 0.6, 0.5, (Math.random() - 0.5) * 0.6);
    b.castShadow = true;
    g.add(b);
  }
  return g;
}

function spawnSceneryItem(side, z) {
  const types = ['palm', 'lamp', 'building', 'bush'];
  const w = Math.random();
  const type = w < 0.4 ? 'palm' : w < 0.65 ? 'lamp' : w < 0.85 ? 'building' : 'bush';
  let mesh;
  if (type === 'palm') mesh = buildPalm();
  else if (type === 'lamp') mesh = buildLamp();
  else if (type === 'building') mesh = buildBuilding();
  else mesh = buildBush();
  const baseX = (ROAD_WIDTH / 2 + 4) + Math.random() * 12;
  mesh.position.x = side === 'L' ? -baseX : baseX;
  mesh.position.z = z;
  scene.add(mesh);
  scenery.push({ type, side, mesh });
}

// Pre-fill scenery on both sides
for (let i = 0; i < SCENERY_COUNT; i++) {
  const z = SCENERY_RANGE_NEAR - (i / SCENERY_COUNT) * (SCENERY_RANGE_NEAR - SCENERY_RANGE_FAR);
  spawnSceneryItem(i % 2 === 0 ? 'L' : 'R', z);
}

/* =============================================================
 * 7. Player — hierarchical mesh-bone group
 * ============================================================= */
const playerMats = {
  jersey:   new THREE.MeshLambertMaterial({ color: 0xe74c3c }),
  jersey2:  new THREE.MeshLambertMaterial({ color: 0xc8102e }),
  shorts:   new THREE.MeshLambertMaterial({ color: 0x1a2330 }),
  skin:     new THREE.MeshLambertMaterial({ color: 0xd49b6b }),
  hair:     new THREE.MeshLambertMaterial({ color: 0x1a0e08 }),
  headband: new THREE.MeshLambertMaterial({ color: 0xff8c3a }),
  shoe:     new THREE.MeshLambertMaterial({ color: 0xffffff }),
  shoeStripe: new THREE.MeshLambertMaterial({ color: 0xff8c3a }),
  white:    new THREE.MeshLambertMaterial({ color: 0xffffff }),
  black:    new THREE.MeshLambertMaterial({ color: 0x111111 }),
  ball:     new THREE.MeshLambertMaterial({ color: 0xff8c3a }),
};

function setMeshShadow(m) {
  m.castShadow = true;
  m.receiveShadow = false;
}

function buildPlayer() {
  const root = new THREE.Group();
  const bodyHolder = new THREE.Group();
  root.add(bodyHolder);

  // Torso (jersey)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.05, 0.6), playerMats.jersey);
  torso.position.y = 1.6;
  setMeshShadow(torso);
  bodyHolder.add(torso);

  // Jersey trim (a thin lower band)
  const trim = new THREE.Mesh(new THREE.BoxGeometry(1.07, 0.08, 0.62), playerMats.white);
  trim.position.y = 1.13;
  bodyHolder.add(trim);

  // Shorts
  const shorts = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.55, 0.62), playerMats.shorts);
  shorts.position.y = 0.85;
  setMeshShadow(shorts);
  bodyHolder.add(shorts);

  // Neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.18, 10), playerMats.skin);
  neck.position.y = 2.2;
  setMeshShadow(neck);
  bodyHolder.add(neck);

  // Head group (so we can wobble)
  const headGroup = new THREE.Group();
  headGroup.position.y = 2.5;
  bodyHolder.add(headGroup);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16), playerMats.skin);
  setMeshShadow(head);
  headGroup.add(head);

  // Hair (top hemisphere)
  const hairGeom = new THREE.SphereGeometry(0.34, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const hair = new THREE.Mesh(hairGeom, playerMats.hair);
  hair.position.y = 0.04;
  headGroup.add(hair);

  // Headband (torus)
  const headband = new THREE.Mesh(
    new THREE.TorusGeometry(0.32, 0.05, 8, 24),
    playerMats.headband,
  );
  headband.rotation.x = Math.PI / 2;
  headband.position.y = 0.05;
  headGroup.add(headband);

  // Eyes
  const eyeMat = playerMats.white;
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), eyeMat);
  eyeL.position.set(-0.11, 0.02, 0.27);
  headGroup.add(eyeL);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.11;
  headGroup.add(eyeR);

  const pupL = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), playerMats.black);
  pupL.position.set(-0.11, 0.02, 0.32);
  headGroup.add(pupL);
  const pupR = pupL.clone();
  pupR.position.x = 0.11;
  headGroup.add(pupR);

  // Arms — hierarchical
  function buildArm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.62, 2.05, 0);

    const upper = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.11, 0.55, 10),
      playerMats.skin,
    );
    upper.position.y = -0.27;
    setMeshShadow(upper);
    shoulder.add(upper);

    const elbow = new THREE.Group();
    elbow.position.y = -0.55;
    shoulder.add(elbow);

    const fore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.1, 0.5, 10),
      playerMats.skin,
    );
    fore.position.y = -0.25;
    setMeshShadow(fore);
    elbow.add(fore);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), playerMats.skin);
    hand.position.y = -0.55;
    setMeshShadow(hand);
    elbow.add(hand);

    return { shoulder, upper, elbow, fore, hand };
  }
  const armL = buildArm(-1);
  const armR = buildArm(+1);
  bodyHolder.add(armL.shoulder);
  bodyHolder.add(armR.shoulder);

  // Legs
  function buildLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.27, 0.6, 0);

    const upper = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.14, 0.6, 10),
      playerMats.skin,
    );
    upper.position.y = -0.3;
    setMeshShadow(upper);
    hip.add(upper);

    const knee = new THREE.Group();
    knee.position.y = -0.6;
    hip.add(knee);

    const lower = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.12, 0.5, 10),
      playerMats.skin,
    );
    lower.position.y = -0.25;
    setMeshShadow(lower);
    knee.add(lower);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.5), playerMats.shoe);
    shoe.position.set(0, -0.55, 0.08);
    setMeshShadow(shoe);
    knee.add(shoe);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.18), playerMats.shoeStripe);
    stripe.position.set(0, -0.5, 0.0);
    knee.add(stripe);

    return { hip, upper, knee, lower, shoe, stripe };
  }
  const legL = buildLeg(-1);
  const legR = buildLeg(+1);
  bodyHolder.add(legL.hip);
  bodyHolder.add(legR.hip);

  // Basketball attached to right hand (its own group so we can hide/show)
  const ballGroup = new THREE.Group();
  ballGroup.position.set(0, -0.7, 0.05);
  armR.elbow.add(ballGroup);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 16), playerMats.ball);
  setMeshShadow(ball);
  ballGroup.add(ball);
  // ball seam (a thin torus)
  const seamMat = new THREE.MeshLambertMaterial({ color: 0x1a0a00 });
  const seam = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.012, 6, 18), seamMat);
  seam.rotation.x = Math.PI / 2;
  ballGroup.add(seam);
  const seam2 = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.012, 6, 18), seamMat);
  ballGroup.add(seam2);

  // Shield aura (hidden by default)
  const auraGeo = new THREE.SphereGeometry(1.15, 24, 24);
  const auraMat = new THREE.MeshBasicMaterial({
    color: 0x6cd8ff,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
  });
  const aura = new THREE.Mesh(auraGeo, auraMat);
  aura.position.y = 1.3;
  aura.visible = false;
  bodyHolder.add(aura);

  // Rocket pack (hidden by default)
  const pack = new THREE.Group();
  pack.position.set(0, 1.5, -0.36);
  pack.visible = false;
  const packBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.7, 0.35),
    new THREE.MeshLambertMaterial({ color: 0x3a3f48 }),
  );
  pack.add(packBody);
  const packNoseMat = new THREE.MeshLambertMaterial({ color: 0xff8c3a });
  const nL = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.55, 8), packNoseMat);
  nL.position.set(-0.18, 0, 0);
  pack.add(nL);
  const nR = nL.clone();
  nR.position.x = 0.18;
  pack.add(nR);
  bodyHolder.add(pack);

  return {
    root, bodyHolder, torso, shorts, trim, neck, head, hair, headband,
    armL, armR, legL, legR,
    ballGroup, ball, seam, seam2,
    aura, pack,
  };
}

const playerObj = buildPlayer();
playerObj.root.position.set(0, 0, 0);
scene.add(playerObj.root);

const player = {
  lane: 1,                // integer target lane
  visualLane: 1,          // float (smooth interp)
  x: 0,                   // smoothed world x
  y: 0,                   // jump height (>=0)
  vy: 0,
  state: 'run',           // run | crossover | slide | dunk | rocket
  stateTimer: 0,
  animTime: 0,
  lean: 0,                // current z-rotation lean
};

function applySkin(skin) {
  playerMats.jersey.color.set(skin.jersey1);
  playerMats.shorts.color.set(skin.shorts);
  playerMats.skin.color.set(skin.skinTone);
  playerMats.hair.color.set(skin.hair);
  playerMats.headband.color.set(skin.headband);
  playerMats.shoeStripe.color.set(skin.shoeStripe);
}
applySkin(getSkin());

/* =============================================================
 * 8. Obstacles — defender, cone, hurdle, bin
 * ============================================================= */
function buildDefender() {
  const g = new THREE.Group();
  const blue = new THREE.MeshLambertMaterial({ color: 0x2a4ad8 });
  const blueDark = new THREE.MeshLambertMaterial({ color: 0x102060 });
  const skin = new THREE.MeshLambertMaterial({ color: 0x8a5a3a });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1a1010 });
  const white = new THREE.MeshLambertMaterial({ color: 0xffffff });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.0, 0.7), blue);
  torso.position.y = 1.6;
  setMeshShadow(torso);
  g.add(torso);

  const trim = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.07, 0.72), white);
  trim.position.y = 1.12;
  g.add(trim);

  const shorts = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.55, 0.72), blueDark);
  shorts.position.y = 0.83;
  setMeshShadow(shorts);
  g.add(shorts);

  // Legs
  const legGeo = new THREE.CylinderGeometry(0.16, 0.14, 0.6, 8);
  const legL = new THREE.Mesh(legGeo, skin);
  legL.position.set(-0.3, 0.3, 0);
  setMeshShadow(legL);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.3;
  g.add(legR);

  // Shoes
  const shoeGeo = new THREE.BoxGeometry(0.34, 0.16, 0.5);
  const shoeL = new THREE.Mesh(shoeGeo, white);
  shoeL.position.set(-0.3, 0.05, 0.08);
  setMeshShadow(shoeL);
  g.add(shoeL);
  const shoeR = shoeL.clone();
  shoeR.position.x = 0.3;
  g.add(shoeR);

  // Arms held out wide (challenger pose)
  const armGeo = new THREE.CylinderGeometry(0.13, 0.11, 0.95, 8);
  const armL = new THREE.Mesh(armGeo, skin);
  armL.position.set(-0.95, 1.65, 0);
  armL.rotation.z = Math.PI / 2.4;
  setMeshShadow(armL);
  g.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.95;
  armR.rotation.z = -Math.PI / 2.4;
  g.add(armR);

  // Hands
  const hand = new THREE.SphereGeometry(0.13, 8, 8);
  const hL = new THREE.Mesh(hand, skin);
  hL.position.set(-1.45, 1.65, 0);
  g.add(hL);
  const hR = hL.clone();
  hR.position.x = 1.45;
  g.add(hR);

  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16), skin);
  head.position.y = 2.45;
  setMeshShadow(head);
  g.add(head);

  // Hair / cap
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    dark,
  );
  cap.position.y = 2.49;
  g.add(cap);

  return g;
}

function buildCone() {
  const g = new THREE.Group();
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.45, 1.0, 16),
    new THREE.MeshLambertMaterial({ color: 0xff7a1a }),
  );
  cone.position.y = 0.5;
  setMeshShadow(cone);
  g.add(cone);

  const stripe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.36, 0.13, 16),
    new THREE.MeshLambertMaterial({ color: 0xffffff }),
  );
  stripe.position.y = 0.42;
  g.add(stripe);

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.06, 0.9),
    new THREE.MeshLambertMaterial({ color: 0xc44a10 }),
  );
  base.position.y = 0.03;
  setMeshShadow(base);
  g.add(base);

  return g;
}

function buildHurdle() {
  const g = new THREE.Group();
  const white = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const red   = new THREE.MeshLambertMaterial({ color: 0xc8102e });

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, 0.08), white);
  legL.position.set(-0.9, 0.5, 0);
  setMeshShadow(legL);
  g.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.9;
  g.add(legR);

  // Foot pads
  const footGeo = new THREE.BoxGeometry(0.5, 0.06, 0.4);
  const footMat = new THREE.MeshLambertMaterial({ color: 0xdadada });
  const footL = new THREE.Mesh(footGeo, footMat);
  footL.position.set(-0.9, 0.03, 0);
  g.add(footL);
  const footR = footL.clone();
  footR.position.x = 0.9;
  g.add(footR);

  // Striped top beam (assemble out of segments)
  const beamY = 1.0;
  for (let i = 0; i < 6; i++) {
    const seg = new THREE.Mesh(
      new THREE.BoxGeometry(0.32, 0.18, 0.18),
      i % 2 === 0 ? red : white,
    );
    seg.position.set(-0.8 + i * 0.32, beamY, 0);
    setMeshShadow(seg);
    g.add(seg);
  }
  // Reflector top
  const refl = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.06, 0.06),
    new THREE.MeshLambertMaterial({ color: 0xffd84a, emissive: 0x554400, emissiveIntensity: 0.4 }),
  );
  refl.position.set(0, beamY + 0.12, 0);
  g.add(refl);

  return g;
}

function buildBin() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.5, 1.2, 16),
    new THREE.MeshLambertMaterial({ color: 0x4a5260 }),
  );
  body.position.y = 0.6;
  setMeshShadow(body);
  g.add(body);

  // Stripes
  const stripeMatA = new THREE.MeshLambertMaterial({ color: 0x2a3340 });
  for (let i = 0; i < 2; i++) {
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.503, 0.503, 0.05, 16), stripeMatA);
    r.position.y = 0.4 + i * 0.5;
    g.add(r);
  }

  const lid = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.55, 0.12, 16),
    new THREE.MeshLambertMaterial({ color: 0x1a2330 }),
  );
  lid.position.y = 1.27;
  setMeshShadow(lid);
  g.add(lid);

  // recycle dot
  const dot = new THREE.Mesh(
    new THREE.CircleGeometry(0.18, 16),
    new THREE.MeshLambertMaterial({ color: 0x2ea83a, side: THREE.DoubleSide }),
  );
  dot.position.set(0, 0.85, 0.51);
  g.add(dot);

  return g;
}

/* =============================================================
 * 9. Pickups — coin & power-up
 * ============================================================= */
const coinMat = new THREE.MeshLambertMaterial({
  color: 0xffd84a,
  emissive: 0x553300,
  emissiveIntensity: 0.5,
});
const coinGeo = new THREE.TorusGeometry(0.28, 0.085, 10, 22);

function buildCoin() {
  const m = new THREE.Mesh(coinGeo, coinMat);
  m.castShadow = true;
  m.rotation.x = Math.PI / 2; // face forward
  return m;
}

function powerupColorHex(kind) {
  switch (kind) {
    case 'magnet': return 0xff5050;
    case 'multi':  return 0x4ed64e;
    case 'shield': return 0x6cd8ff;
    case 'rocket': return 0xff9a3a;
  }
  return 0xffffff;
}

function buildPowerup(kind) {
  const g = new THREE.Group();
  const innerColor = powerupColorHex(kind);
  // Outer translucent shell
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 16, 16),
    new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.45,
      emissive: innerColor,
      emissiveIntensity: 0.2,
    }),
  );
  shell.castShadow = true;
  g.add(shell);

  // Inner glowing core
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 16, 16),
    new THREE.MeshLambertMaterial({
      color: innerColor,
      emissive: innerColor,
      emissiveIntensity: 0.95,
    }),
  );
  g.add(core);

  // Decorative ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.04, 8, 24),
    new THREE.MeshLambertMaterial({
      color: innerColor,
      emissive: innerColor,
      emissiveIntensity: 0.6,
    }),
  );
  ring.rotation.x = Math.PI / 2;
  g.add(ring);

  return g;
}

/* =============================================================
 * 10. Particle system (manual mesh pool)
 * ============================================================= */
const PARTICLE_GEOM = new THREE.BoxGeometry(0.18, 0.18, 0.18);
const partPool = [];
const PARTICLE_POOL_MAX = 240;

function spawnParticle(x, y, z, vx, vy, vz, life, color, gravity) {
  let entry = particles.find((p) => !p.alive);
  if (!entry) {
    if (particles.length >= PARTICLE_POOL_MAX) return;
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, fog: false });
    const m = new THREE.Mesh(PARTICLE_GEOM, mat);
    scene.add(m);
    entry = { mesh: m, mat, alive: false, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, gravity: true };
    particles.push(entry);
  }
  entry.alive = true;
  entry.mesh.visible = true;
  entry.mesh.position.set(x, y, z);
  const s = 0.6 + Math.random() * 0.8;
  entry.mesh.scale.set(s, s, s);
  entry.mesh.rotation.set(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28);
  entry.vx = vx;
  entry.vy = vy;
  entry.vz = vz;
  entry.life = entry.maxLife = life;
  entry.gravity = gravity !== false;
  entry.mat.color.set(color);
  entry.mat.opacity = 1;
}

function updateParticles(dt) {
  for (const p of particles) {
    if (!p.alive) continue;
    p.life -= dt;
    if (p.life <= 0) {
      p.alive = false;
      p.mesh.visible = false;
      continue;
    }
    p.mesh.position.x += p.vx * dt;
    p.mesh.position.y += p.vy * dt;
    p.mesh.position.z += p.vz * dt;
    if (p.gravity) p.vy -= 25 * dt;
    p.mesh.rotation.x += dt * 4;
    p.mesh.rotation.y += dt * 3;
    p.mat.opacity = Math.max(0, p.life / p.maxLife);
  }
}

/* =============================================================
 * 11. Spawning (ported probabilities from 2D version)
 * ============================================================= */
const SPAWN_Z = -90;

function difficulty() {
  return Math.min(1, distance / 1500);
}

function pushObstacle(kind, lane, z) {
  let mesh;
  if (kind === 'defender') mesh = buildDefender();
  else if (kind === 'cone') mesh = buildCone();
  else if (kind === 'hurdle') mesh = buildHurdle();
  else if (kind === 'bin') mesh = buildBin();
  if (!mesh) return;
  mesh.position.set(LANES_X[lane], 0, z);
  scene.add(mesh);
  obstacles.push({ kind, lane, mesh, processed: false, baseY: 0 });
}

function pushCoin(lane, z, yOff) {
  const m = buildCoin();
  m.position.set(LANES_X[lane], 1.0 + (yOff || 0), z);
  scene.add(m);
  collectibles.push({
    kind: 'coin',
    lane,
    mesh: m,
    z,
    yOff: yOff || 0,
    collected: false,
    bobPhase: Math.random() * Math.PI * 2,
    spinPhase: 0,
    magLane: lane,
  });
}

function pushPowerup(sub, lane, z) {
  const m = buildPowerup(sub);
  m.position.set(LANES_X[lane], 1.3, z);
  scene.add(m);
  collectibles.push({
    kind: 'powerup',
    sub,
    lane,
    mesh: m,
    z,
    collected: false,
    bobPhase: Math.random() * Math.PI * 2,
  });
}

function spawnPattern() {
  if (power.rocket > 0) return;
  const r = Math.random();
  const z = SPAWN_Z;
  const diff = difficulty();

  // Coin row
  if (r < 0.30) {
    const lane = Math.floor(Math.random() * 3);
    const count = 5 + Math.floor(Math.random() * 4);
    const arc = Math.random() < 0.25;
    for (let i = 0; i < count; i++) {
      const yOff = arc ? Math.sin((i / (count - 1)) * Math.PI) * 1.0 : 0;
      pushCoin(lane, z - i * 1.6, yOff);
    }
    return;
  }

  // Power-up
  if (r < 0.36) {
    const kinds = ['magnet', 'multi', 'shield'];
    if (diff > 0.4) kinds.push('rocket');
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const lane = Math.floor(Math.random() * 3);
    pushPowerup(kind, lane, z);
    return;
  }

  // Single defender
  if (r < 0.50) {
    pushObstacle('defender', Math.floor(Math.random() * 3), z);
    return;
  }
  // Cone
  if (r < 0.62) {
    pushObstacle('cone', Math.floor(Math.random() * 3), z);
    return;
  }
  // Hurdle (slide under)
  if (r < 0.72) {
    pushObstacle('hurdle', Math.floor(Math.random() * 3), z);
    return;
  }
  // Bin (jump or change lane)
  if (r < 0.80) {
    pushObstacle('bin', Math.floor(Math.random() * 3), z);
    return;
  }
  // Full-width hurdle (must slide)
  if (r < 0.86) {
    pushObstacle('hurdle', 0, z);
    pushObstacle('hurdle', 1, z);
    pushObstacle('hurdle', 2, z);
    return;
  }
  // Two-lane block: leaves one open lane
  if (r < 0.94) {
    const open = Math.floor(Math.random() * 3);
    const kindA = Math.random() < 0.5 ? 'cone' : 'bin';
    const kindB = Math.random() < 0.5 ? 'defender' : 'cone';
    for (let l = 0; l < 3; l++) {
      if (l === open) {
        if (Math.random() < 0.6) {
          for (let i = 0; i < 3; i++) pushCoin(l, z - 1 + i * 1.5, 0);
        }
      } else {
        pushObstacle(l === 0 ? kindA : kindB, l, z);
      }
    }
    return;
  }

  // Defender + open lane coins
  const dl = Math.floor(Math.random() * 3);
  pushObstacle('defender', dl, z);
  let cl = (dl + 1) % 3;
  if (Math.random() < 0.5) cl = (dl + 2) % 3;
  for (let i = 0; i < 4; i++) pushCoin(cl, z - 1 + i * 1.4, 0);
}

/* =============================================================
 * 12. Reset / start state
 * ============================================================= */
function clearWorld() {
  for (const o of obstacles) scene.remove(o.mesh);
  for (const c of collectibles) scene.remove(c.mesh);
  obstacles.length = 0;
  collectibles.length = 0;
  for (const p of particles) {
    p.alive = false;
    p.mesh.visible = false;
  }
}

function reset() {
  clearWorld();
  player.lane = 1;
  player.visualLane = 1;
  player.x = 0;
  player.y = 0;
  player.vy = 0;
  player.state = 'run';
  player.stateTimer = 0;
  player.animTime = 0;
  player.lean = 0;
  speed = BASE_SPEED;
  distance = 0;
  runDistanceM = 0;
  score = 0;
  coins = 0;
  spawnTimer = 0.8;
  power.magnet = power.multi = power.shield = power.rocket = 0;

  playerObj.bodyHolder.rotation.set(0, 0, 0);
  playerObj.root.rotation.set(0, 0, 0);
  playerObj.root.position.set(0, 0, 0);
  playerObj.aura.visible = false;
  playerObj.pack.visible = false;
}

/* =============================================================
 * 13. Player animation
 * ============================================================= */
function setRotXSafe(grp, rx) { if (grp) grp.rotation.x = rx; }

function animatePlayer(dt) {
  const t = player.animTime * 11; // run cadence
  const isAir = player.y > 0.1 || player.state === 'rocket';

  // Default: arms hang
  let armLx = 0, armRx = 0, elbowLx = 0, elbowRx = 0;
  let legLx = 0, legRx = 0, kneeLx = 0, kneeRx = 0;
  let bodyTilt = 0;

  if (player.state === 'slide') {
    // legs straight forward, body forward
    legLx = -1.4; legRx = -1.4;
    kneeLx = 0.3; kneeRx = 0.3;
    armLx = -2.1; armRx = -2.1;
    elbowLx = 0.4; elbowRx = 0.4;
    playerObj.bodyHolder.rotation.x = -1.2;
  } else if (player.state === 'rocket') {
    legLx = -0.2; legRx = -0.2;
    armLx = 0.3; armRx = 0.3;
    elbowLx = 0; elbowRx = 0;
    playerObj.bodyHolder.rotation.x = -0.4;
  } else if (player.state === 'dunk' || isAir) {
    // tuck legs, raise arms
    const tuck = 0.9;
    legLx = -tuck;
    legRx = -tuck;
    kneeLx = 1.4;
    kneeRx = 1.4;
    armLx = -2.4;
    armRx = -2.6;
    elbowLx = 0.3;
    elbowRx = 0.3;
    playerObj.bodyHolder.rotation.x = -0.15;
  } else {
    // running: legs swing opposite
    const swing = Math.sin(t) * 0.95;
    const armSwing = Math.sin(t) * 0.7;
    legLx =  swing;
    legRx = -swing;
    // bend the back-swinging knee
    kneeLx = Math.max(0, -swing) * 1.4;
    kneeRx = Math.max(0,  swing) * 1.4;
    armLx = -armSwing - 0.15;
    armRx =  armSwing - 0.15;
    elbowLx = 0.6 + Math.max(0,  armSwing) * 0.4;
    elbowRx = 0.6 + Math.max(0, -armSwing) * 0.4;
    bodyTilt = Math.abs(Math.sin(t)) * -0.04 - 0.05;
    playerObj.bodyHolder.rotation.x = bodyTilt;
  }

  // Apply
  setRotXSafe(playerObj.legL.hip,  legLx);
  setRotXSafe(playerObj.legR.hip,  legRx);
  setRotXSafe(playerObj.legL.knee, kneeLx);
  setRotXSafe(playerObj.legR.knee, kneeRx);
  setRotXSafe(playerObj.armL.shoulder, armLx);
  setRotXSafe(playerObj.armR.shoulder, armRx);
  setRotXSafe(playerObj.armL.elbow, elbowLx);
  setRotXSafe(playerObj.armR.elbow, elbowRx);

  // Body bob (vertical only) for run
  let bob = 0;
  if (!isAir && player.state === 'run') {
    bob = Math.abs(Math.sin(t * 2)) * 0.06;
  }

  // Lane lean (z rotation toward target lane)
  const dxLane = player.lane - player.visualLane;
  const targetLean = THREE.MathUtils.clamp(-dxLane * 0.35, -0.45, 0.45);
  player.lean += (targetLean - player.lean) * Math.min(1, dt * 9);
  playerObj.root.rotation.z = player.lean;

  // Set vertical/y position with optional slide drop
  const slideDrop = player.state === 'slide' ? -0.55 : 0;
  // 0.65 is the baseline so that feet rest on the ground (y=0).
  playerObj.root.position.y = 0.65 + player.y + bob + slideDrop;

  // Smoothly move x to lane center
  const targetX = LANES_X[player.lane];
  player.visualLane += (player.lane - player.visualLane) * Math.min(1, dt * 14);
  player.x += (targetX - player.x) * Math.min(1, dt * 14);
  playerObj.root.position.x = player.x;

  // Ball spin
  playerObj.ball.rotation.x += dt * 9;
  playerObj.ball.rotation.y += dt * 5;
  playerObj.seam.rotation.z += dt * 4;
  playerObj.seam2.rotation.x += dt * 4;

  // Aura / pack visibility
  playerObj.aura.visible = power.shield > 0;
  if (playerObj.aura.visible) {
    const s = 1 + Math.sin(player.animTime * 4) * 0.05;
    playerObj.aura.scale.set(s, s, s);
    playerObj.aura.material.opacity = 0.28 + Math.sin(player.animTime * 6) * 0.08;
  }
  playerObj.pack.visible = power.rocket > 0;
}

/* =============================================================
 * 14. Update loop
 * ============================================================= */
function update(dt) {
  // particles always update
  updateParticles(dt);

  if (state !== STATE.PLAYING) return;

  // speed ramp + rocket boost
  const targetSpeed = BASE_SPEED + difficulty() * (MAX_SPEED - BASE_SPEED) +
    (power.rocket > 0 ? ROCKET_BOOST : 0);
  speed += (targetSpeed - speed) * Math.min(1, dt * 2.5);
  distance += speed * dt;
  runDistanceM = Math.floor(distance);
  const scoreMult = power.multi > 0 ? 2 : 1;
  score += speed * dt * 1.2 * scoreMult;

  // power-up timers
  if (power.magnet > 0) power.magnet -= dt;
  if (power.multi  > 0) power.multi  -= dt;
  if (power.rocket > 0) power.rocket -= dt;
  // shield is persistent until used
  refreshPowerupHUD();

  // state timer
  if (player.stateTimer > 0) {
    player.stateTimer -= dt;
    if (player.stateTimer <= 0 && player.state !== 'dunk' && player.state !== 'rocket') {
      player.state = 'run';
    }
  }

  // Rocket: float in the air
  if (power.rocket > 0) {
    player.state = 'rocket';
    const targetY = 3.2;
    player.y += (targetY - player.y) * Math.min(1, dt * 4);
    player.vy = 0;
    // exhaust particles
    if (Math.random() < 0.7) {
      const px = player.x + (Math.random() - 0.5) * 0.4;
      const py = playerObj.root.position.y + 1.4;
      const pz = playerObj.root.position.z - 0.4;
      spawnParticle(
        px, py, pz,
        (Math.random() - 0.5) * 1.0,
        -2 - Math.random() * 1.5,
        2 + Math.random() * 1.5,
        0.5,
        Math.random() < 0.5 ? '#ffb066' : '#ffd84a',
        false,
      );
    }
  } else if (player.state === 'rocket') {
    // landing after rocket
    player.state = 'dunk';
    player.vy = -2.0;
  }

  // Jump physics
  if (player.state === 'dunk') {
    player.vy -= GRAVITY * dt;
    player.y  += player.vy * dt;
    if (player.y <= 0) {
      player.y = 0;
      player.vy = 0;
      player.state = 'run';
      // dust burst on landing
      const px = player.x;
      const py = 0.05;
      const pz = playerObj.root.position.z;
      for (let i = 0; i < 10; i++) {
        spawnParticle(
          px, py, pz,
          (Math.random() - 0.5) * 4,
          0.5 + Math.random() * 2,
          (Math.random() - 0.5) * 3,
          0.45,
          '#d9b58a',
          true,
        );
      }
    }
  }

  // Move world toward camera (positive z)
  const dz = speed * dt;
  for (const o of obstacles) o.mesh.position.z += dz;
  for (const c of collectibles) c.mesh.position.z += dz;

  // Scenery scroll + recycle
  for (const s of scenery) {
    s.mesh.position.z += dz * 0.95;
    if (s.mesh.position.z > 18) {
      // recycle to far end
      s.mesh.position.z -= 200 + Math.random() * 30;
      // re-randomize x slightly
      const baseX = (ROAD_WIDTH / 2 + 4) + Math.random() * 12;
      s.mesh.position.x = s.side === 'L' ? -baseX : baseX;
    }
  }

  // Lane stripes recycle
  for (const m of stripes) {
    m.position.z += dz;
    if (m.position.z > 12) {
      m.position.z -= STRIPE_TOTAL * STRIPE_COUNT;
    }
  }

  // Magnet: pull coins toward player lane
  if (power.magnet > 0) {
    for (const c of collectibles) {
      if (c.collected || c.kind !== 'coin') continue;
      if (c.mesh.position.z < -25 || c.mesh.position.z > 4) continue;
      const tx = LANES_X[player.lane];
      c.mesh.position.x += (tx - c.mesh.position.x) * Math.min(1, dt * 6);
      // pull forward
      if (c.mesh.position.z < -1.5) c.mesh.position.z += 12 * dt;
    }
  }

  // Coin / pickup spin + bob
  for (const c of collectibles) {
    if (c.collected) continue;
    c.bobPhase += dt * 3;
    if (c.kind === 'coin') {
      c.mesh.rotation.y += dt * 5;
      c.mesh.position.y = 1.0 + (c.yOff || 0) + Math.sin(c.bobPhase) * 0.18;
    } else {
      c.mesh.rotation.y += dt * 1.6;
      c.mesh.position.y = 1.3 + Math.sin(c.bobPhase) * 0.18;
    }
  }

  // Obstacle collision
  for (const o of obstacles) {
    if (o.processed) continue;
    const z = o.mesh.position.z;
    if (z >= -0.6 && z <= 1.5) {
      o.processed = true;
      if (power.rocket > 0) continue;
      if (o.lane !== Math.round(player.visualLane)) continue;
      const evaded = isObstacleEvaded(o);
      if (!evaded) {
        if (power.shield > 0) {
          power.shield = 0;
          // shield-pop effect
          const px = player.x, py = 1.4, pz = 0;
          for (let i = 0; i < 22; i++) {
            const a = (i / 22) * Math.PI * 2;
            spawnParticle(
              px, py, pz,
              Math.cos(a) * 6,
              0.5 + Math.random() * 1,
              Math.sin(a) * 6,
              0.6,
              '#a8e0ff',
              false,
            );
          }
          continue;
        }
        gameOver();
        return;
      }
    }
  }

  // Collectibles collection
  for (const c of collectibles) {
    if (c.collected) continue;
    const z = c.mesh.position.z;
    if (z < -0.7 || z > 1.0) continue;
    const sameLane = Math.abs(c.mesh.position.x - player.x) < 1.4;
    if (!sameLane) continue;
    // height check: coin at ~1m, player jumps reach >2.5; auto-collect on lane in z range
    if (c.kind === 'coin') {
      // crude height window: must not be too high above player
      const maxY = playerObj.root.position.y + 2.6;
      if (c.mesh.position.y > maxY) continue;
      c.collected = true;
      coins += 1;
      totalCoins += 1;
      score += 10 * (power.multi > 0 ? 2 : 1);
      // sparkle
      const cx = c.mesh.position.x, cy = c.mesh.position.y, cz = c.mesh.position.z;
      for (let i = 0; i < 5; i++) {
        spawnParticle(
          cx, cy, cz,
          (Math.random() - 0.5) * 4,
          1 + Math.random() * 2,
          (Math.random() - 0.5) * 4,
          0.45,
          i % 2 === 0 ? '#ffd84a' : '#fff5b0',
          true,
        );
      }
      coinCountEl.textContent = coins;
    } else if (c.kind === 'powerup') {
      c.collected = true;
      activatePowerup(c.sub);
      const cx = c.mesh.position.x, cy = c.mesh.position.y, cz = c.mesh.position.z;
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * Math.PI * 2;
        spawnParticle(
          cx, cy, cz,
          Math.cos(a) * 6,
          0.5 + Math.random() * 2,
          Math.sin(a) * 6,
          0.55,
          powerupColorString(c.sub),
          false,
        );
      }
    }
  }

  // Cleanup
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    if (o.mesh.position.z > 12) {
      scene.remove(o.mesh);
      obstacles.splice(i, 1);
    }
  }
  for (let i = collectibles.length - 1; i >= 0; i--) {
    const c = collectibles[i];
    if (c.collected || c.mesh.position.z > 12) {
      scene.remove(c.mesh);
      collectibles.splice(i, 1);
    }
  }

  // Spawn timing — distance-based gap so it scales with speed
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnPattern();
    spawnTimer = 0.85 - Math.min(distance / 4000, 0.45);
  }

  player.animTime += dt;

  // HUD
  scoreEl.textContent = Math.floor(score);

  // Camera follow
  const camTargetX = player.x * 0.35;
  camera.position.x += (camTargetX - camera.position.x) * Math.min(1, dt * 4);
  camera.position.y = 4.4;
  camera.position.z = 8.5;
  camera.lookAt(player.x * 0.5, 1.3, -6);

  // Sun follow (so shadow stays under player)
  sun.position.x = player.x + 18;
  sun.target.position.set(player.x, 0, 0);
  sun.target.updateMatrixWorld();

  animatePlayer(dt);
}

function isObstacleEvaded(o) {
  if (o.kind === 'cone') {
    return player.state === 'dunk' && player.y > 0.55;
  }
  if (o.kind === 'bin') {
    return player.state === 'dunk' && player.y > 1.05;
  }
  if (o.kind === 'defender') {
    return player.state === 'dunk' && player.y > 1.4;
  }
  if (o.kind === 'hurdle') {
    return player.state === 'slide';
  }
  return false;
}

function powerupColorString(kind) {
  switch (kind) {
    case 'magnet': return '#ff5050';
    case 'multi':  return '#4ed64e';
    case 'shield': return '#a8e0ff';
    case 'rocket': return '#ffb066';
  }
  return '#ffffff';
}

function activatePowerup(kind) {
  switch (kind) {
    case 'magnet': power.magnet = 8; break;
    case 'multi':  power.multi  = 10; break;
    case 'shield': power.shield = 999; break;
    case 'rocket':
      power.rocket = 5;
      player.state = 'rocket';
      player.vy = 0;
      break;
  }
  refreshPowerupHUD();
}

/* =============================================================
 * 15. Input
 * ============================================================= */
function setLane(targetLane) {
  if (state !== STATE.PLAYING) return;
  targetLane = Math.max(0, Math.min(2, targetLane));
  if (targetLane === player.lane) return;
  player.lane = targetLane;
  if (player.state === 'slide' || player.state === 'dunk' || player.state === 'rocket') return;
  player.state = 'crossover';
  player.stateTimer = LANE_CHANGE_TIME;
}

function swipeLeft()  { setLane(player.lane - 1); }
function swipeRight() { setLane(player.lane + 1); }
function swipeUp() {
  if (state !== STATE.PLAYING) return;
  if (player.state === 'dunk' || player.state === 'rocket') return;
  player.state = 'dunk';
  player.vy = JUMP_VY;
  player.y = 0.01;
  player.stateTimer = 0;
}
function swipeDown() {
  if (state !== STATE.PLAYING) return;
  if (player.state === 'dunk' || player.state === 'rocket') return;
  player.state = 'slide';
  player.stateTimer = SLIDE_TIME;
}

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
    case 'ArrowLeft':  case 'a': case 'A': swipeLeft();  break;
    case 'ArrowRight': case 'd': case 'D': swipeRight(); break;
    case 'ArrowUp':    case 'w': case 'W': swipeUp();    break;
    case 'ArrowDown':  case 's': case 'S': swipeDown();  break;
  }
});

/* =============================================================
 * 16. Render loop
 * ============================================================= */
let lastT = performance.now();
function loop(now) {
  const dt = Math.min(0.033, (now - lastT) / 1000);
  lastT = now;
  update(dt);
  // animate menu player too (so the menu doesn't look frozen)
  if (state !== STATE.PLAYING) {
    player.animTime += dt;
    animatePlayer(dt);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

/* =============================================================
 * 17. Pause / quit
 * ============================================================= */
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

/* =============================================================
 * 18. UI hookup (preserved from original)
 * ============================================================= */
const menuEl     = document.getElementById('menu');
const skinsEl    = document.getElementById('skins');
const howtoEl    = document.getElementById('howto');
const pauseEl    = document.getElementById('pause');
const gameOverEl = document.getElementById('gameover');
const hudEl      = document.getElementById('hud');
const scoreEl       = document.getElementById('score');
const coinCountEl   = document.getElementById('coin-count');
const finalScoreEl  = document.getElementById('final-score-val');
const highScoreEl   = document.getElementById('high-score-val');
const runCoinsEl    = document.getElementById('run-coins-val');
const runDistEl     = document.getElementById('run-dist-val');
const menuBestEl    = document.getElementById('menu-best');
const menuCoinsEl   = document.getElementById('menu-coins');
const skinsCoinsEl  = document.getElementById('skins-coin-count');
const skinGridEl    = document.getElementById('skin-grid');
const powerupsEl    = document.getElementById('powerups');

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
    menuBestEl.textContent  = highScore;
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
        applySkin(s);
        saveProgress();
        renderSkinGrid();
      } else if (totalCoins >= s.cost) {
        totalCoins -= s.cost;
        unlockedSkins.push(s.id);
        currentSkinId = s.id;
        applySkin(s);
        saveProgress();
        renderSkinGrid();
      } else {
        skinsCoinsEl.parentElement.animate(
          [{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }],
          { duration: 250 },
        );
      }
    });
    skinGridEl.appendChild(card);
  }
}

/* 2D-canvas skin preview (kept from the original game) */
function drawSkinPreview(canvas, skin) {
  const c = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  c.clearRect(0, 0, w, h);
  const bg = c.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, '#a8dcff');
  bg.addColorStop(1, '#fff5d0');
  c.fillStyle = bg;
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#5a606a';
  c.fillRect(0, h * 0.78, w, h * 0.22);
  c.save();
  c.translate(w / 2, h * 0.86);
  c.scale(0.6, 0.6);
  drawPreviewBody(c, skin);
  c.restore();
}

function drawPreviewBody(c, skin) {
  c.fillStyle = 'rgba(0,0,0,0.2)';
  c.beginPath();
  c.ellipse(0, 6, 50, 12, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = skin.shorts;
  c.beginPath();
  c.moveTo(-24, -78); c.lineTo(24, -78); c.lineTo(30, -46); c.lineTo(-30, -46);
  c.closePath();
  c.fill();
  c.fillStyle = '#fff';
  c.fillRect(-30, -50, 60, 3);
  c.strokeStyle = skin.skinTone;
  c.lineWidth = 13; c.lineCap = 'round';
  c.beginPath(); c.moveTo(-12, -46); c.lineTo(-15, -2); c.stroke();
  c.beginPath(); c.moveTo(12, -46); c.lineTo(15, -2); c.stroke();
  c.fillStyle = '#fff';
  c.beginPath();
  c.ellipse(-15, 0, 15, 7, 0, 0, Math.PI * 2);
  c.ellipse(15, 0, 15, 7, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = skin.shoeStripe;
  c.fillRect(-23, -3, 16, 3); c.fillRect(7, -3, 16, 3);
  const jg = c.createLinearGradient(0, -135, 0, -78);
  jg.addColorStop(0, skin.jersey1); jg.addColorStop(1, skin.jersey2);
  c.fillStyle = jg;
  c.beginPath();
  c.moveTo(-26, -135); c.lineTo(26, -135); c.lineTo(30, -78); c.lineTo(-30, -78);
  c.closePath();
  c.fill();
  c.fillStyle = '#fff';
  c.fillRect(-30, -82, 60, 3);
  c.font = '900 22px sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(skin.number, 0, -106);
  c.fillStyle = skin.skinTone;
  c.fillRect(-7, -145, 14, 12);
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
  c.strokeStyle = skin.skinTone;
  c.lineWidth = 12; c.lineCap = 'round';
  c.beginPath(); c.moveTo(22, -130); c.lineTo(40, -100); c.lineTo(34, -70); c.stroke();
  c.beginPath(); c.moveTo(-22, -130); c.lineTo(-40, -100); c.lineTo(-34, -70); c.stroke();
  c.save(); c.translate(34, -70);
  const bg2 = c.createRadialGradient(-4, -4, 2, 0, 0, 14);
  bg2.addColorStop(0, '#ffae6b'); bg2.addColorStop(1, '#c44a10');
  c.fillStyle = bg2;
  c.beginPath(); c.arc(0, 0, 14, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#1a0a00'; c.lineWidth = 1.5;
  c.beginPath(); c.moveTo(-14, 0); c.lineTo(14, 0); c.moveTo(0, -14); c.lineTo(0, 14); c.stroke();
  c.restore();
}

function refreshPowerupHUD() {
  if (!powerupsEl) return;
  const items = [];
  if (power.magnet > 0) items.push({ key: 'magnet', label: 'MAGNET', t: power.magnet });
  if (power.multi  > 0) items.push({ key: 'multi',  label: '×2',     t: power.multi  });
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

/* =============================================================
 * 19. Game lifecycle
 * ============================================================= */
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
  if (finalScore > highScore) highScore = finalScore;
  saveProgress();
  finalScoreEl.textContent = finalScore;
  highScoreEl.textContent  = highScore;
  runCoinsEl.textContent   = coins;
  runDistEl.textContent    = runDistanceM + 'm';
  gameOverEl.classList.remove('hidden');
  hudEl.classList.add('hidden');

  // Crash burst
  const px = player.x, py = playerObj.root.position.y + 1.0, pz = 0;
  for (let i = 0; i < 36; i++) {
    spawnParticle(
      px, py, pz,
      (Math.random() - 0.5) * 12,
      Math.random() * 6 + 2,
      (Math.random() - 0.5) * 12,
      0.9,
      ['#ff8c3a', '#ffd84a', '#ffffff', '#c44a10'][i % 4],
      true,
    );
  }
}

/* =============================================================
 * 20. Boot
 * ============================================================= */
showMenu('main');
requestAnimationFrame(loop);
