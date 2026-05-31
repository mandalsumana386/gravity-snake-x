// GRAVITY SNAKE X - Core Game Engine

// --- CONFIGURATION ---
const EARTH_RADIUS = 10;
const BASE_SPEED = 0.05;
const BOOST_SPEED_MULTIPLIER = 1.7;
const SPACING = 7; // Frames between snake body segments
const LEVEL_DATA = {
  1: { name: "NEO-EARTH", speed: 1.0, target: 10, difficulty: "LOW RISK", color: 0x00d2ff, desc: "Clean orbital path. Slow rotation. Perfect for diagnostic runs." },
  2: { name: "CYBER SHIELD", speed: 1.25, target: 15, difficulty: "MODERATE RISK", color: 0x00f6ff, desc: "Grid shields activated. Static defense cubes populate the orbit." },
  3: { name: "SPACE STORM", speed: 1.5, target: 20, difficulty: "HIGH RISK", color: 0xff007f, desc: "Active orbital satellite arrays sweep across the spherical grid." },
  4: { name: "VOLCANIC CORE", speed: 1.8, target: 25, difficulty: "CRITICAL", color: 0xff3333, desc: "Extreme thermal anomalies. Rapid speed and shifting solar magma flares." }
};

// --- STATE MANAGEMENT ---
let gameState = "MENU"; // MENU, LEVEL_SELECT, PLAYING, PAUSED, GAMEOVER
let currentLevel = 1;
let score = 0;
let highscore = 0;
let unlockedLevels = [1];
let isMuted = false;

// Snake properties
let headPos = new THREE.Vector3(0, 0, EARTH_RADIUS);
let dir = new THREE.Vector3(0, 0.1, 0); // Movement direction (tangent vector)
let nextTurn = null; // Buffer next turn input (left / right)
let history = []; // Array of Vector3 positions
let snakeSegments = [];
let snakeBodyLength = 4;
let boostCharge = 100; // 0 - 100
let isBoosting = false;

// Food properties
let foodPos = new THREE.Vector3();
let foodMesh = null;
let foodOuterRing = null;

// Level elements
let obstacles = []; // Array of obstacle meshes and properties
let satelliteGroup = null; // Group for rotating satellites
let magmaZones = []; // Volcanic hazards

// Particle Effects
let particles = [];

// Three.js Core Variables
let scene, camera, renderer;
let earthMesh, atmosphereMesh, starfield;
let pointLight, sunLight;
let requestID = null;

// Initialize on Load
window.addEventListener('load', () => {
  // Load High Score & unlocked levels from Local Storage
  highscore = parseInt(localStorage.getItem('snake_highscore')) || 0;
  unlockedLevels = JSON.parse(localStorage.getItem('snake_unlocked_levels')) || [1];
  
  updateLockedCards();
  document.getElementById('highscore-val').innerText = highscore;
  
  // Set up WebGL Scene
  init3D();
  
  // Setup Resize Listener
  window.addEventListener('resize', onWindowResize);
  
  // Event listener for Keyboard controls
  window.addEventListener('keydown', handleKeyDown);
  
  // Start general game loop (idle menu rotation)
  animate(0);
  
  // Subtle entry animation
  gsap.from("#welcome-screen .screen-content", { duration: 1.2, scale: 0.8, opacity: 0, ease: "power3.out" });
});

// --- AUDIO SYNTHESIZER ENGINE (Web Audio API) ---
let audioCtx = null;
let mainVolumeNode = null;
let bgMusicInterval = null;

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  
  mainVolumeNode = audioCtx.createGain();
  mainVolumeNode.gain.setValueAtTime(isMuted ? 0 : 0.25, audioCtx.currentTime);
  mainVolumeNode.connect(audioCtx.destination);
  
  startBackgroundMusic();
}

function toggleMute() {
  isMuted = !isMuted;
  const icon = document.getElementById('sound-icon');
  icon.innerText = isMuted ? "🔇" : "🔊";
  
  if (mainVolumeNode) {
    mainVolumeNode.gain.setValueAtTime(isMuted ? 0 : 0.25, audioCtx.currentTime);
  }
  
  playClickSound();
}

// Generate synthesizer sound effects
function playSFX(type) {
  if (!audioCtx) initAudio();
  if (isMuted) return;
  
  const now = audioCtx.currentTime;
  
  if (type === "eat") {
    // Cyber Arpeggio chime
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      
      gain.gain.setValueAtTime(0.3, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.25);
      
      osc.connect(gain);
      gain.connect(mainVolumeNode);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.35);
    });
  } 
  else if (type === "levelup") {
    // Sci-fi Riser Sweep
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.8);
    
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    
    osc.connect(gain);
    gain.connect(mainVolumeNode);
    osc.start(now);
    osc.stop(now + 0.95);
  } 
  else if (type === "gameover") {
    // Bass Drop and Crash
    const osc = audioCtx.createOscillator();
    const noise = audioCtx.createOscillator(); // Or simple noise filter
    const gain = audioCtx.createGain();
    
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(250, now);
    osc.frequency.linearRampToValueAtTime(40, now + 0.6);
    
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    
    osc.connect(gain);
    gain.connect(mainVolumeNode);
    osc.start(now);
    osc.stop(now + 0.85);
  }
}

function playClickSound() {
  if (!audioCtx) initAudio();
  if (isMuted) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
  osc.connect(gain);
  gain.connect(mainVolumeNode);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.1);
}

// Background Soundtrack Loop
function startBackgroundMusic() {
  if (bgMusicInterval) clearInterval(bgMusicInterval);
  
  const tempo = 220; // ms per beat (approx 136 BPM)
  let beatCount = 0;
  
  const bassline = [
    55.0, 55.0, 65.41, 65.41, // A1, A1, C2, C2
    73.42, 73.42, 55.0, 55.0, // D2, D2, A1, A1
    55.0, 55.0, 87.31, 87.31, // A1, A1, F2, F2
    98.0, 87.31, 55.0, 55.0   // G2, F2, A1, A1
  ];
  
  const leadArp = [
    220.0, 261.63, 329.63, 392.00, // A3, C4, E4, G4
    440.0, 392.00, 329.63, 261.63  // A4, G4, E4, C4
  ];

  bgMusicInterval = setInterval(() => {
    if (gameState !== "PLAYING" || isMuted) return;
    
    const now = audioCtx.currentTime;
    
    // Play Bass Note on every 2 beats
    if (beatCount % 2 === 0) {
      const bassIndex = (beatCount / 2) % bassline.length;
      const bassOsc = audioCtx.createOscillator();
      const bassGain = audioCtx.createGain();
      
      bassOsc.type = "triangle";
      bassOsc.frequency.setValueAtTime(bassline[bassIndex], now);
      
      bassGain.gain.setValueAtTime(0.18, now);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      
      bassOsc.connect(bassGain);
      bassGain.connect(mainVolumeNode);
      bassOsc.start(now);
      bassOsc.stop(now + 0.4);
    }
    
    // Play Lead Note on Level 3 and 4 for increased intensity
    if (currentLevel >= 3 && beatCount % 2 !== 0) {
      const leadIndex = beatCount % leadArp.length;
      const leadOsc = audioCtx.createOscillator();
      const leadGain = audioCtx.createGain();
      
      leadOsc.type = "sine";
      leadOsc.frequency.setValueAtTime(leadArp[leadIndex], now);
      
      leadGain.gain.setValueAtTime(0.05, now);
      leadGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      
      leadOsc.connect(leadGain);
      leadGain.connect(mainVolumeNode);
      leadOsc.start(now);
      leadOsc.stop(now + 0.25);
    }
    
    beatCount++;
  }, tempo);
}

// --- SCREEN TRANSITIONS ---
function showLevelSelection() {
  playClickSound();
  initAudio(); // Initialize audio context on first user button click
  
  gsap.to("#welcome-screen", { duration: 0.4, opacity: 0, scale: 0.9, display: "none" });
  gsap.to("#level-screen", { duration: 0.5, delay: 0.2, opacity: 1, scale: 1, display: "flex", onStart: () => {
    document.getElementById("level-screen").classList.add("active");
  }});
  gameState = "LEVEL_SELECT";
}

function backToMenu() {
  playClickSound();
  gsap.to("#level-screen", { duration: 0.4, opacity: 0, scale: 0.9, display: "none" });
  gsap.to("#welcome-screen", { duration: 0.5, delay: 0.2, opacity: 1, scale: 1, display: "flex", onStart: () => {
    document.getElementById("welcome-screen").classList.add("active");
  }});
  gameState = "MENU";
}

function exitToMenu() {
  playClickSound();
  resetGameEnvironment();
  
  gsap.to("#pause-overlay", { duration: 0.3, opacity: 0, display: "none" });
  gsap.to("#hud", { duration: 0.3, opacity: 0, display: "none" });
  gsap.to("#welcome-screen", { duration: 0.5, delay: 0.2, opacity: 1, scale: 1, display: "flex", onStart: () => {
    document.getElementById("welcome-screen").classList.add("active");
  }});
  
  gameState = "MENU";
}

function exitToLevels() {
  playClickSound();
  resetGameEnvironment();
  
  gsap.to("#pause-overlay", { duration: 0.3, opacity: 0, display: "none" });
  gsap.to("#gameover-screen", { duration: 0.3, opacity: 0, display: "none" });
  gsap.to("#hud", { duration: 0.3, opacity: 0, display: "none" });
  gsap.to("#level-screen", { duration: 0.5, delay: 0.2, opacity: 1, scale: 1, display: "flex", onStart: () => {
    document.getElementById("level-screen").classList.add("active");
  }});
  
  gameState = "LEVEL_SELECT";
}

function updateLockedCards() {
  for (let lvl = 2; lvl <= 4; lvl++) {
    const card = document.getElementById(`card-lvl-${lvl}`);
    if (unlockedLevels.includes(lvl)) {
      card.classList.remove('locked');
      card.querySelector('.lock-overlay').style.display = 'none';
      card.classList.add('active');
    } else {
      card.classList.add('locked');
      card.querySelector('.lock-overlay').style.display = 'flex';
      card.classList.remove('active');
    }
  }
}

// --- 3D ENVIRONMENT INITIALIZATION (THREE.JS) ---
function init3D() {
  const canvas = document.getElementById("game-canvas");
  
  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  
  // Scene
  scene = new THREE.Scene();
  
  // Camera
  camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 0, 32); // Menu/Idle view
  
  // Ambient Light
  ambientLight = new THREE.AmbientLight(0xffffff, 0.12);
  scene.add(ambientLight);
  
  // Directional Light (Sun)
  sunLight = new THREE.DirectionalLight(0xffffff, 1.25);
  sunLight.position.set(30, 20, 25);
  scene.add(sunLight);
  
  // Point Light (Following Snake Head, initialized but added to scene only during play)
  pointLight = new THREE.PointLight(0x00f6ff, 1.6, 12, 1.5);
  
  // Starfield
  createStarfield();
  
  // Earth Planet
  createProceduralEarth();
}

function createStarfield() {
  const count = 1600;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  
  for(let i=0; i<count*3; i+=3) {
    // Distribute stars spherically far away
    const r = 150 + Math.random() * 80;
    const u = Math.random();
    const v = Math.random();
    const theta = u * 2.0 * Math.PI;
    const phi = Math.acos(2.0 * v - 1.0);
    
    positions[i]   = r * Math.sin(phi) * Math.cos(theta);
    positions[i+1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i+2] = r * Math.cos(phi);
    
    // Star Colors (cyan, magenta, yellow, white)
    const rand = Math.random();
    if(rand < 0.25) {
      colors[i] = 0.0; colors[i+1] = 0.9; colors[i+2] = 1.0; // Cyan
    } else if(rand < 0.5) {
      colors[i] = 1.0; colors[i+1] = 0.0; colors[i+2] = 0.8; // Magenta
    } else if(rand < 0.7) {
      colors[i] = 1.0; colors[i+1] = 0.7; colors[i+2] = 0.0; // Orange
    } else {
      colors[i] = 1.0; colors[i+1] = 1.0; colors[i+2] = 1.0; // White
    }
  }
  
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  
  const material = new THREE.PointsMaterial({
    size: 0.8,
    vertexColors: true,
    transparent: true,
    opacity: 0.85
  });
  
  starfield = new THREE.Points(geometry, material);
  scene.add(starfield);
}

// Procedural Earth texture generation
function createProceduralEarth() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  
  // Background ocean
  ctx.fillStyle = '#050a1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw digital grids
  ctx.strokeStyle = 'rgba(0, 210, 255, 0.07)';
  ctx.lineWidth = 1;
  const gridSpacing = 32;
  for (let x = 0; x < canvas.width; x += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  
  // Stylized Futuristic Continents
  const continents = [
    // North America (scaled to 1024x512)
    [[120, 100], [280, 80], [350, 150], [330, 220], [280, 260], [240, 240], [240, 280], [210, 270], [160, 180]],
    // South America
    [[240, 280], [280, 295], [320, 340], [300, 440], [260, 480], [240, 440], [220, 360], [225, 305]],
    // Africa
    [[460, 240], [530, 220], [600, 260], [620, 310], [600, 380], [560, 440], [520, 445], [490, 380], [450, 310]],
    // Eurasia
    [[450, 210], [480, 120], [550, 80], [700, 60], [920, 70], [940, 160], [880, 260], [800, 275], [740, 220], [670, 250], [580, 230], [500, 240]],
    // Australia
    [[820, 360], [890, 370], [910, 410], [840, 430], [810, 390]],
    // Antarctica (Bottom outline strip)
    [[50, 480], [200, 490], [450, 480], [750, 490], [974, 480], [974, 512], [50, 512]]
  ];
  
  ctx.fillStyle = '#0b1933';
  ctx.strokeStyle = '#00f6ff';
  
  continents.forEach(poly => {
    ctx.beginPath();
    ctx.moveTo(poly[0][0], poly[0][1]);
    for(let i=1; i<poly.length; i++) {
      ctx.lineTo(poly[i][0], poly[i][1]);
    }
    ctx.closePath();
    ctx.fill();
    
    // Neon Outline stroke
    ctx.shadowColor = '#00f6ff';
    ctx.shadowBlur = 4;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Draw cyber city lights inside continents
    ctx.shadowBlur = 0; // reset shadow
    ctx.fillStyle = 'rgba(255, 170, 0, 0.85)';
    
    // Bounding Box to scatter dots
    let minX = 1024, maxX = 0, minY = 512, maxY = 0;
    poly.forEach(pt => {
      if (pt[0] < minX) minX = pt[0];
      if (pt[0] > maxX) maxX = pt[0];
      if (pt[1] < minY) minY = pt[1];
      if (pt[1] > maxY) maxY = pt[1];
    });
    
    const dotCount = Math.floor((maxX - minX) * (maxY - minY) * 0.0016);
    for (let d = 0; d < dotCount; d++) {
      const rx = minX + Math.random() * (maxX - minX);
      const ry = minY + Math.random() * (maxY - minY);
      
      // Check if point is mathematically inside the continent polygon
      if (isPointInPoly(poly, [rx, ry])) {
        // Draw tiny glow point
        ctx.fillStyle = Math.random() < 0.2 ? '#ffe600' : '#ff5500';
        ctx.fillRect(rx, ry, Math.random() * 2 + 1, Math.random() * 2 + 1);
      }
    }
  });
  
  const texture = new THREE.CanvasTexture(canvas);
  
  const earthGeometry = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64);
  const earthMaterial = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.6,
    metalness: 0.45,
    emissive: new THREE.Color(0x00aaff),
    emissiveMap: texture,
    emissiveIntensity: 0.18
  });
  
  earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
  scene.add(earthMesh);
  
  // Atmosphere Rim Glow Sphere
  const atmosGeom = new THREE.SphereGeometry(EARTH_RADIUS + 0.45, 32, 32);
  const atmosMat = new THREE.MeshBasicMaterial({
    color: 0x00f6ff,
    transparent: true,
    opacity: 0.15,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide
  });
  atmosphereMesh = new THREE.Mesh(atmosGeom, atmosMat);
  scene.add(atmosphereMesh);
}

// Ray-casting algorithm to test polygon intersection
function isPointInPoly(poly, pt) {
  const x = pt[0], y = pt[1];
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// --- LEVEL SETUP AND OBSTACLES ---
function selectLevel(lvl) {
  if (gameState !== "LEVEL_SELECT") return;
  
  // If clicked card is locked, skip
  if (!unlockedLevels.includes(lvl)) {
    // Play error sound/shake card
    const card = document.getElementById(`card-lvl-${lvl}`);
    gsap.to(card, { duration: 0.1, x: -10, yoyo: true, repeat: 3 });
    return;
  }
  
  currentLevel = lvl;
  playClickSound();
  
  // Reset highscore display
  document.getElementById('highscore-val').innerText = highscore;
  
  // Update Level targets/labels
  const info = LEVEL_DATA[lvl];
  document.getElementById('level-display').innerText = `SECTOR 0${lvl}: ${info.name}`;
  document.querySelector('.target-val').innerText = `/${info.target}`;
  document.getElementById('score-val').innerText = "0";
  updateProgressBar(0);
  
  // Shift overlay out, slide HUD in
  gsap.to("#level-screen", { duration: 0.4, opacity: 0, scale: 0.9, display: "none" });
  gsap.to("#hud", { duration: 0.4, delay: 0.2, opacity: 1, display: "flex", onStart: () => {
    document.getElementById("hud").classList.add("active");
  }});
  
  // Start Gameplay
  initGamePlay(lvl);
}

function initGamePlay(lvl) {
  gameState = "PLAYING";
  score = 0;
  isBoosting = false;
  boostCharge = 100;
  document.getElementById('boost-charge-fill').style.width = '100%';
  
  // Update Earth Material glow colors based on Sector
  const info = LEVEL_DATA[lvl];
  earthMesh.material.emissive.setHex(info.color);
  atmosphereMesh.material.color.setHex(info.color);
  
  // Position Snake Head on sphere
  headPos.set(0, 0, EARTH_RADIUS);
  dir.set(0, 0.08, 0); // Start moving North
  
  history = [];
  // Populate initial snake position history
  for (let i = 0; i < 200; i++) {
    history.push(headPos.clone());
  }
  
  // Clean old snake segments
  snakeSegments.forEach(s => scene.remove(s));
  snakeSegments = [];
  
  // Re-create initial snake head & body segments
  snakeBodyLength = 4;
  createSnakeMesh();
  
  // Spawn initial food
  spawnFood();
  
  // Clear old level obstacles
  clearObstacles();
  
  // Build Obstacles based on Level
  buildObstacles(lvl);
  
  // Add Point Light to Scene
  pointLight.color.setHex(info.color);
  scene.add(pointLight);
  
  // Cinematic Camera zoom-in from space
  camera.position.set(0, 0, 32);
  const normal = headPos.clone().normalize();
  const targetCamPos = headPos.clone()
    .addScaledVector(normal, 8)
    .addScaledVector(dir.clone().normalize(), -6);
  
  gsap.to(camera.position, {
    duration: 1.5,
    x: targetCamPos.x,
    y: targetCamPos.y,
    z: targetCamPos.z,
    ease: "power2.out"
  });
  
  // Trigger system notification
  triggerAlertMessage(`SECTOR 0${lvl} SECURED`);
}

function createSnakeMesh() {
  const colorHex = LEVEL_DATA[currentLevel].color;
  
  // Sleek polygon Diamond head
  const headGeom = new THREE.ConeGeometry(0.55, 1.4, 4);
  headGeom.rotateX(Math.PI / 2); // align forward
  const headMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.1,
    metalness: 0.9,
    emissive: colorHex,
    emissiveIntensity: 0.8
  });
  
  const headMesh = new THREE.Mesh(headGeom, headMat);
  headMesh.position.copy(headPos);
  scene.add(headMesh);
  snakeSegments.push(headMesh);
  
  // Body segments (spheres decreasing in size)
  for (let i = 1; i < snakeBodyLength; i++) {
    const size = 0.45 * (1 - (i / (snakeBodyLength + 4)));
    const segGeom = new THREE.SphereGeometry(size, 12, 12);
    const segMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.2,
      metalness: 0.7,
      emissive: colorHex,
      emissiveIntensity: 0.45 * (1 - i / snakeBodyLength)
    });
    const segMesh = new THREE.Mesh(segGeom, segMat);
    segMesh.position.copy(headPos);
    scene.add(segMesh);
    snakeSegments.push(segMesh);
  }
}

function growSnake() {
  snakeBodyLength++;
  const colorHex = LEVEL_DATA[currentLevel].color;
  const i = snakeBodyLength - 1;
  const size = 0.45 * (1 - (i / (snakeBodyLength + 4)));
  
  const segGeom = new THREE.SphereGeometry(size, 12, 12);
  const segMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.2,
    metalness: 0.7,
    emissive: colorHex,
    emissiveIntensity: 0.45 * (1 - i / snakeBodyLength)
  });
  
  const segMesh = new THREE.Mesh(segGeom, segMat);
  segMesh.position.copy(history[Math.max(0, history.length - 1 - i * SPACING)]);
  scene.add(segMesh);
  snakeSegments.push(segMesh);
  
  // Re-adjust all segment emissive intensity & scale
  for (let idx = 1; idx < snakeSegments.length; idx++) {
    const sizeScale = 1 - (idx / (snakeSegments.length + 4));
    snakeSegments[idx].scale.set(sizeScale, sizeScale, sizeScale);
    snakeSegments[idx].material.emissiveIntensity = 0.45 * (1 - idx / snakeSegments.length);
  }
}

function clearObstacles() {
  obstacles.forEach(o => {
    if (o.mesh) scene.remove(o.mesh);
  });
  obstacles = [];
  
  if (satelliteGroup) {
    scene.remove(satelliteGroup);
    satelliteGroup = null;
  }
}

function buildObstacles(lvl) {
  if (lvl === 1) return; // Sector 1 is clean
  
  const colorHex = LEVEL_DATA[lvl].color;
  
  if (lvl === 2) {
    // Cyber Shield: 6-8 Static Grid Defense Cubes on Earth surface
    const boxCount = 7;
    for (let i = 0; i < boxCount; i++) {
      const oPos = getRandomPointOnSphere(EARTH_RADIUS);
      // Ensure we don't spawn right next to the snake spawn area (0,0,10)
      if (oPos.distanceTo(new THREE.Vector3(0, 0, EARTH_RADIUS)) < 3.5) {
        i--;
        continue;
      }
      
      const boxGeom = new THREE.BoxGeometry(1.2, 1.2, 1.2);
      const boxMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.1,
        metalness: 0.8,
        emissive: colorHex,
        emissiveIntensity: 0.6
      });
      const boxMesh = new THREE.Mesh(boxGeom, boxMat);
      boxMesh.position.copy(oPos);
      boxMesh.lookAt(0, 0, 0); // Align flat to surface normal
      scene.add(boxMesh);
      
      // Wireframe overlay for glowing tech look
      const wireGeom = new THREE.EdgesGeometry(boxGeom);
      const wireMat = new THREE.LineBasicMaterial({ color: colorHex, linewidth: 2 });
      const wireframe = new THREE.LineSegments(wireGeom, wireMat);
      boxMesh.add(wireframe);
      
      obstacles.push({ mesh: boxMesh, pos: oPos, type: "cube", radius: 0.95 });
    }
  } 
  else if (lvl === 3) {
    // Space Storm: Orbiting Satellite Arrays (move dynamically in update loop)
    satelliteGroup = new THREE.Group();
    scene.add(satelliteGroup);
    
    const satCount = 4;
    for (let i = 0; i < satCount; i++) {
      const satPos = getRandomPointOnSphere(EARTH_RADIUS + 0.3);
      if (satPos.distanceTo(new THREE.Vector3(0, 0, EARTH_RADIUS)) < 3.5) {
        i--; continue;
      }
      
      // Satellite Model (Mesh Group)
      const satModel = new THREE.Group();
      
      // Core sphere
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.4, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9, roughness: 0.1 })
      );
      satModel.add(core);
      
      // Solar panel panels
      const panelGeom = new THREE.BoxGeometry(0.1, 0.3, 1.3);
      const panelMat = new THREE.MeshStandardMaterial({ color: colorHex, emissive: colorHex, emissiveIntensity: 0.4 });
      const panels = new THREE.Mesh(panelGeom, panelMat);
      panels.position.set(0, 0, 0);
      satModel.add(panels);
      
      satModel.position.copy(satPos);
      satModel.lookAt(0, 0, 0);
      satelliteGroup.add(satModel);
      
      // Store in obstacles. We will update sat positions in main loop
      obstacles.push({
        mesh: satModel,
        pos: satPos,
        type: "satellite",
        radius: 0.9,
        axis: new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize(),
        orbitSpeed: 0.008 + Math.random() * 0.006
      });
    }
  } 
  else if (lvl === 4) {
    // Volcanic Core: Pulsing Magma Domes on Earth surface
    const volcanoCount = 6;
    for (let i = 0; i < volcanoCount; i++) {
      const oPos = getRandomPointOnSphere(EARTH_RADIUS - 0.2);
      if (oPos.distanceTo(new THREE.Vector3(0, 0, EARTH_RADIUS)) < 3.5) {
        i--; continue;
      }
      
      const domeGeom = new THREE.SphereGeometry(1.2, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2); // Half sphere dome
      const domeMat = new THREE.MeshStandardMaterial({
        color: 0xff3300,
        roughness: 0.8,
        metalness: 0.2,
        emissive: 0xff3300,
        emissiveIntensity: 0.85
      });
      const domeMesh = new THREE.Mesh(domeGeom, domeMat);
      domeMesh.position.copy(oPos);
      
      // Align dome flat on the sphere pointing outwards
      const up = new THREE.Vector3(0, 1, 0);
      const normal = oPos.clone().normalize();
      domeMesh.quaternion.setFromUnitVectors(up, normal);
      scene.add(domeMesh);
      
      obstacles.push({
        mesh: domeMesh,
        pos: oPos,
        type: "volcano",
        radius: 1.1,
        pulseSpeed: 0.03 + Math.random() * 0.02,
        pulseOffset: Math.random() * Math.PI
      });
    }
  }
}

// Spawns energy orb
function spawnFood() {
  if (foodMesh) scene.remove(foodMesh);
  if (foodOuterRing) scene.remove(foodOuterRing);
  
  // Find a random point on sphere
  let spawnPos = getRandomPointOnSphere(EARTH_RADIUS + 0.35);
  
  // Verify it doesn't spawn on top of snake body or existing obstacles
  let valid = false;
  while (!valid) {
    valid = true;
    
    // Check snake head
    if (spawnPos.distanceTo(headPos) < 2.0) {
      spawnPos = getRandomPointOnSphere(EARTH_RADIUS + 0.35);
      valid = false;
      continue;
    }
    
    // Check snake segments
    for (let i = 1; i < snakeSegments.length; i++) {
      if (spawnPos.distanceTo(snakeSegments[i].position) < 1.6) {
        spawnPos = getRandomPointOnSphere(EARTH_RADIUS + 0.35);
        valid = false;
        break;
      }
    }
    
    if (!valid) continue;
    
    // Check Level Obstacles
    for (let o of obstacles) {
      if (spawnPos.distanceTo(o.pos) < 2.2) {
        spawnPos = getRandomPointOnSphere(EARTH_RADIUS + 0.35);
        valid = false;
        break;
      }
    }
  }
  
  foodPos.copy(spawnPos);
  
  // Create Futuristic Energy Orb Model
  const colorHex = LEVEL_DATA[currentLevel].color;
  const orbGeom = new THREE.IcosahedronGeometry(0.38, 1);
  const orbMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: colorHex,
    emissiveIntensity: 1.3,
    roughness: 0.1,
    metalness: 0.9
  });
  foodMesh = new THREE.Mesh(orbGeom, orbMat);
  foodMesh.position.copy(foodPos);
  scene.add(foodMesh);
  
  // Outer glowing sensor ring
  const ringGeom = new THREE.RingGeometry(0.65, 0.73, 16);
  const ringMat = new THREE.MeshBasicMaterial({
    color: colorHex,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.7
  });
  foodOuterRing = new THREE.Mesh(ringGeom, ringMat);
  foodOuterRing.position.copy(foodPos);
  foodOuterRing.lookAt(0, 0, 0); // Lie flat relative to sphere center
  scene.add(foodOuterRing);
}

function getRandomPointOnSphere(radius) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos((Math.random() * 2) - 1);
  
  const x = radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.sin(phi) * Math.sin(theta);
  const z = radius * Math.cos(phi);
  
  return new THREE.Vector3(x, y, z);
}

// --- INTERACTIVE CONTROLS ---
function handleKeyDown(e) {
  if (gameState !== "PLAYING") return;
  
  if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
    nextTurn = "LEFT";
  }
  if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
    nextTurn = "RIGHT";
  }
  if (e.key === " " || e.key === "Shift") {
    isBoosting = true;
  }
}

window.addEventListener('keyup', (e) => {
  if (e.key === " " || e.key === "Shift") {
    isBoosting = false;
  }
});

// Mobile button steer APIs
function steerLeft(isPressed) {
  if (gameState !== "PLAYING") return;
  if (isPressed) {
    nextTurn = "LEFT";
  }
}

function steerRight(isPressed) {
  if (gameState !== "PLAYING") return;
  if (isPressed) {
    nextTurn = "RIGHT";
  }
}

function triggerBoost(isPressed) {
  isBoosting = isPressed;
}

// --- GAME LOGIC LOOPS ---
function updateSnake() {
  const levelInfo = LEVEL_DATA[currentLevel];
  
  // Calculate Speed
  let currentSpeed = BASE_SPEED * levelInfo.speed;
  if (isBoosting && boostCharge > 5) {
    currentSpeed *= BOOST_SPEED_MULTIPLIER;
    boostCharge = Math.max(0, boostCharge - 0.95);
    document.getElementById('boost-charge-fill').style.width = `${boostCharge}%`;
  } else {
    isBoosting = false;
    boostCharge = Math.min(100, boostCharge + 0.35); // slowly recharge boost
    document.getElementById('boost-charge-fill').style.width = `${boostCharge}%`;
  }
  
  // Apply Buffered Input Turn
  if (nextTurn) {
    const normal = headPos.clone().normalize();
    const turnAngle = nextTurn === "LEFT" ? Math.PI / 2 : -Math.PI / 2;
    
    // Rotate movement tangent vector around sphere normal at head position
    dir.applyAxisAngle(normal, turnAngle).normalize();
    nextTurn = null;
    
    // Play light drift click sound
    if (audioCtx && !isMuted) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(mainVolumeNode);
      osc.start(); osc.stop(audioCtx.currentTime + 0.06);
    }
  }
  
  // 1. Move Snake Head
  headPos.addScaledVector(dir, currentSpeed);
  headPos.setLength(EARTH_RADIUS + 0.3); // Maintain exact orbital offset
  
  // 2. Adjust Direction Tangent
  const normal = headPos.clone().normalize();
  dir.projectOnPlane(normal).normalize();
  
  // 3. Save History
  history.push(headPos.clone());
  
  // Keep history size optimized to prevent memory leaks
  const maxHistoryNeeded = snakeBodyLength * SPACING + 20;
  if (history.length > maxHistoryNeeded) {
    history.shift();
  }
  
  // 4. Update Segment Positions and Orientations
  // Segment 0 is Head
  const headMesh = snakeSegments[0];
  headMesh.position.copy(headPos);
  
  // Calculate head rotation to lie flat on sphere looking forward
  const forward = dir.clone().normalize();
  const right = new THREE.Vector3().crossVectors(forward, normal).normalize();
  const correctedForward = new THREE.Vector3().crossVectors(normal, right).normalize();
  
  const rotationMatrix = new THREE.Matrix4();
  rotationMatrix.set(
    right.x, normal.x, correctedForward.x, 0,
    right.y, normal.y, correctedForward.y, 0,
    right.z, normal.z, correctedForward.z, 0,
    0, 0, 0, 1
  );
  headMesh.quaternion.setFromRotationMatrix(rotationMatrix);
  
  // Update Body segment meshes trailing in history indices
  for (let i = 1; i < snakeSegments.length; i++) {
    const historyIndex = Math.max(0, history.length - 1 - i * SPACING);
    const pos = history[historyIndex];
    snakeSegments[i].position.copy(pos);
    
    // Make body segments face the Earth center so they lie flat
    snakeSegments[i].lookAt(0, 0, 0);
  }
  
  // 5. Update Head Point Light position
  pointLight.position.copy(headPos).addScaledVector(normal, 0.8);
  
  // 6. Check Self Collision
  // Ignore first few segments close to head
  for (let i = 5; i < snakeSegments.length; i++) {
    if (headPos.distanceTo(snakeSegments[i].position) < 0.62) {
      triggerGameOver();
      return;
    }
  }
  
  // 7. Check Obstacle Collisions
  for (let o of obstacles) {
    if (headPos.distanceTo(o.pos) < o.radius) {
      triggerGameOver();
      return;
    }
  }
  
  // 8. Check Food collision
  if (headPos.distanceTo(foodPos) < 0.95) {
    eatFood();
  }
}

function eatFood() {
  score++;
  playSFX("eat");
  
  // Spawn particle burst
  createParticleBurst(foodPos, LEVEL_DATA[currentLevel].color);
  
  // Grow Snake length
  growSnake();
  
  // Update HUD
  document.getElementById('score-val').innerText = score;
  
  const levelInfo = LEVEL_DATA[currentLevel];
  const progressPercent = Math.min(100, (score / levelInfo.target) * 100);
  updateProgressBar(progressPercent);
  
  // Check if Level Target Met
  if (score >= levelInfo.target) {
    triggerLevelComplete();
  } else {
    // Spawn next food
    spawnFood();
  }
}

function updateProgressBar(pct) {
  document.getElementById('level-progress-bar').style.width = `${pct}%`;
}

// Particle system effects
function createParticleBurst(position, color) {
  const count = 30;
  for (let i = 0; i < count; i++) {
    const geom = new THREE.SphereGeometry(0.08 + Math.random() * 0.08, 6, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(position);
    scene.add(mesh);
    
    // Random velocity outward
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 0.2,
      (Math.random() - 0.5) * 0.2,
      (Math.random() - 0.5) * 0.2
    ).addScaledVector(position.clone().normalize(), 0.08); // bias outward from surface
    
    particles.push({
      mesh: mesh,
      velocity: vel,
      life: 1.0,
      decay: 0.02 + Math.random() * 0.02
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.mesh.position.add(p.velocity);
    p.life -= p.decay;
    p.mesh.material.opacity = p.life;
    
    if (p.life <= 0) {
      scene.remove(p.mesh);
      particles.splice(i, 1);
    }
  }
}

function updateObstacles() {
  if (currentLevel === 3 && satelliteGroup) {
    // Move orbiting satellites in Level 3
    obstacles.forEach(o => {
      if (o.type === "satellite") {
        // Rotate satellite position around its customized orbital axis
        o.pos.applyAxisAngle(o.axis, o.orbitSpeed);
        o.mesh.position.copy(o.pos);
        // Face Earth center + align rotation
        o.mesh.lookAt(0, 0, 0);
      }
    });
  } 
  else if (currentLevel === 4) {
    // Pulsate lava magma zones in Level 4
    const time = Date.now();
    obstacles.forEach(o => {
      if (o.type === "volcano") {
        const scaleVal = 1 + Math.sin(time * o.pulseSpeed + o.pulseOffset) * 0.25;
        o.mesh.scale.set(scaleVal, scaleVal, scaleVal);
        o.radius = 1.1 * scaleVal; // dynamic collision boundaries
      }
    });
  }
}

// --- CAMERA CHASE CONTROLLER ---
function updateCamera() {
  if (gameState !== "PLAYING") return;
  
  const normal = headPos.clone().normalize();
  
  // Position camera relative to snake head: 7 units above surface normal, and 6 units behind direction heading
  const heightOffset = 6.8;
  const behindOffset = 5.2;
  
  const targetCamPos = headPos.clone()
    .addScaledVector(normal, heightOffset)
    .addScaledVector(dir.clone().normalize(), -behindOffset);
  
  // Lerp smoothly to target position to create dynamic camera swings on turns
  camera.position.lerp(targetCamPos, 0.12);
  
  // Critical for spherical rotation: align camera 'UP' to local surface normal
  // This keeps the horizon flat for the player regardless of their coordinates on the sphere
  camera.up.lerp(normal, 0.15).normalize();
  
  camera.lookAt(headPos);
}

// Main Frame loop
function animate(timestamp) {
  requestID = requestAnimationFrame(animate);
  
  // 1. Slow Rotate starfield and Earth in menus
  if (gameState === "MENU" || gameState === "LEVEL_SELECT") {
    starfield.rotation.y += 0.0004;
    starfield.rotation.x += 0.0001;
    
    earthMesh.rotation.y += 0.0016;
    
    // Simple cinematic camera orbit in menus
    const time = timestamp * 0.0002;
    camera.position.x = 28 * Math.cos(time);
    camera.position.z = 28 * Math.sin(time);
    camera.position.y = 8 * Math.sin(time * 0.5);
    camera.lookAt(0, 0, 0);
  }
  
  // 2. Main Simulation updates during Play
  if (gameState === "PLAYING") {
    // Slow planetary spin under the snake
    earthMesh.rotation.y += 0.0008;
    
    // Twinkle background stars
    starfield.rotation.y += 0.0002;
    
    updateSnake();
    updateObstacles();
    updateParticles();
    
    // Rotate food ring and hover orb
    if (foodMesh && foodOuterRing) {
      foodOuterRing.rotation.z += 0.02;
      
      const hover = Math.sin(timestamp * 0.004) * 0.08;
      const normal = foodPos.clone().normalize();
      foodMesh.position.copy(foodPos).addScaledVector(normal, hover);
      foodMesh.rotation.y += 0.015;
      foodMesh.rotation.x += 0.01;
    }
    
    updateCamera();
  }
  
  renderer.render(scene, camera);
}

// --- WIN & LOSS MANAGEMENT ---
function triggerGameOver() {
  gameState = "GAMEOVER";
  playSFX("gameover");
  
  // Snake collapse animation
  snakeSegments.forEach((seg, idx) => {
    gsap.to(seg.scale, { duration: 0.8, x: 0, y: 0, z: 0, ease: "power2.in" });
    createParticleBurst(seg.position, LEVEL_DATA[currentLevel].color);
  });
  
  scene.remove(pointLight);
  
  // Update scores
  if (score > highscore) {
    highscore = score;
    localStorage.setItem('snake_highscore', highscore);
  }
  
  document.getElementById('final-score').innerText = score;
  document.getElementById('final-highscore').innerText = highscore;
  document.getElementById('final-sector').innerText = `0${currentLevel}`;
  
  // Glitch title effect for defeat
  document.getElementById('gameover-title').innerText = "SYSTEM FATAL";
  document.getElementById('gameover-desc').innerText = "Gravity Snake fuselage disintegrated. Cybernetic link severed.";
  
  // Shift HUD out, show GameOver screen
  gsap.to("#hud", { duration: 0.3, opacity: 0, display: "none" });
  gsap.to("#gameover-screen", { duration: 0.5, delay: 0.3, opacity: 1, scale: 1, display: "flex", onStart: () => {
    document.getElementById("gameover-screen").classList.add("active");
  }});
}

function triggerLevelComplete() {
  gameState = "PAUSED"; // Temporarily pause updates
  playSFX("levelup");
  
  // Update highscore
  if (score > highscore) {
    highscore = score;
    localStorage.setItem('snake_highscore', highscore);
  }
  
  triggerAlertMessage("SYSTEM UPLINK SUCCESSFUL");
  
  // Unlock next Level
  const nextLvl = currentLevel + 1;
  if (nextLvl <= 4 && !unlockedLevels.includes(nextLvl)) {
    unlockedLevels.push(nextLvl);
    localStorage.setItem('snake_unlocked_levels', JSON.stringify(unlockedLevels));
    updateLockedCards();
  }
  
  // Slide camera out into orbit
  gsap.to(camera.position, {
    duration: 2.2,
    x: 0,
    y: 0,
    z: 32,
    ease: "power2.inOut",
    onComplete: () => {
      // Transition to Level Selection
      resetGameEnvironment();
      gsap.to("#hud", { duration: 0.3, opacity: 0, display: "none" });
      gsap.to("#level-screen", { duration: 0.5, opacity: 1, scale: 1, display: "flex", onStart: () => {
        document.getElementById("level-screen").classList.add("active");
      }});
      gameState = "LEVEL_SELECT";
    }
  });
}

// Pause Game Overlay
function pauseGame() {
  if (gameState !== "PLAYING") return;
  playClickSound();
  gameState = "PAUSED";
  
  gsap.to("#pause-overlay", { duration: 0.3, opacity: 1, display: "flex", onStart: () => {
    document.getElementById("pause-overlay").classList.add("active");
  }});
}

function resumeGame() {
  if (gameState !== "PAUSED") return;
  playClickSound();
  
  gsap.to("#pause-overlay", { duration: 0.3, opacity: 0, display: "none", onComplete: () => {
    gameState = "PLAYING";
  }});
}

function restartLevel() {
  playClickSound();
  resetGameEnvironment();
  
  gsap.to("#pause-overlay", { duration: 0.3, opacity: 0, display: "none" });
  gsap.to("#gameover-screen", { duration: 0.3, opacity: 0, display: "none" });
  
  // Relaunch level setup
  gsap.to("#hud", { duration: 0.3, opacity: 1, display: "flex", onStart: () => {
    document.getElementById("hud").classList.add("active");
  }});
  initGamePlay(currentLevel);
}

// Reset 3D elements for a clean state
function resetGameEnvironment() {
  // Remove snake meshes
  snakeSegments.forEach(s => scene.remove(s));
  snakeSegments = [];
  
  // Remove food
  if (foodMesh) scene.remove(foodMesh);
  if (foodOuterRing) scene.remove(foodOuterRing);
  foodMesh = null;
  foodOuterRing = null;
  
  // Remove obstacles
  clearObstacles();
  
  // Remove particle leftovers
  particles.forEach(p => scene.remove(p.mesh));
  particles = [];
  
  scene.remove(pointLight);
}

// Alert Notifications UI system
function triggerAlertMessage(text) {
  const el = document.getElementById("game-message");
  el.innerText = text;
  
  gsap.killTweensOf(el);
  gsap.set(el, { opacity: 0, scale: 0.8 });
  
  gsap.timeline()
    .to(el, { duration: 0.4, opacity: 1, scale: 1, ease: "back.out(1.7)" })
    .to(el, { duration: 0.4, delay: 1.4, opacity: 0, scale: 0.9, ease: "power2.in" });
}

// Window resizing
function onWindowResize() {
  if (camera && renderer) {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
