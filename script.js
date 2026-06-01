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
  4: { name: "VOLCANIC CORE", speed: 1.8, target: 25, difficulty: "CRITICAL", color: 0xff3333, desc: "Extreme thermal anomalies. Rapid speed and shifting solar magma flares." },
  5: { name: "ABYSSAL ZONE", speed: 2.2, target: 30, difficulty: "NIGHTMARE", color: 0xff00ff, desc: "Deep space darkness. Sporadic lighting and high velocity impacts." },
  6: { name: "QUANTUM FRACTURE", speed: 2.5, target: 40, difficulty: "TERMINAL", color: 0x00f6ff, desc: "Reality distorts. Maximum speed with unpredictable physics anomalies." },
  7: { name: "SINGULARITY", speed: 3.0, target: 50, difficulty: "GODSPEED", color: 0xff3333, desc: "The center of the galaxy. Survive the impossible." }
};

// --- STATE MANAGEMENT ---
let gameState = "MENU"; // MENU, LEVEL_SELECT, PLAYING, PAUSED, GAMEOVER
let currentLevel = 1;
let score = 0;
let highscore = 0;
let unlockedLevels = [1, 2, 3, 4, 5, 6, 7];
let isMuted = false;

// Premium Progression State
let coins = 0;
let unlockedSkins = ['classic'];
let equippedSkin = 'classic';
let achievements = { gamesPlayed: 0, orbsCollected: 0, powerupsUsed: 0, coinsCollected: 0, claimed: [] };
let dailyChallenges = [];
let activePowerups = { shield: false, magnet: 0, doubleScore: 0 }; // 0 means time remaining

const SKIN_DATA = {
  'classic': { name: 'Classic Neon', price: 0, color: null, type: 'standard' },
  'gold': { name: 'Gold Plated', price: 50, color: 0xffaa00, type: 'metallic' },
  'magma': { name: 'Magma Core', price: 100, color: 0xff3300, type: 'emissive' },
  'ghost': { name: 'Ghost Mode', price: 200, color: 0xffffff, type: 'transparent' }
};

const ACHIEVEMENT_DEFS = [
  { id: 'first_blood', name: 'Initiation', desc: 'Play 5 games', target: 5, key: 'gamesPlayed', reward: 20 },
  { id: 'orb_collector', name: 'Energy Hoarder', desc: 'Collect 100 orbs', target: 100, key: 'orbsCollected', reward: 50 },
  { id: 'power_user', name: 'Power Overwhelming', desc: 'Use 10 power-ups', target: 10, key: 'powerupsUsed', reward: 30 },
  { id: 'rich_snake', name: 'Gold Rush', desc: 'Collect 500 coins', target: 500, key: 'coinsCollected', reward: 100 }
];

// Snake properties
let headPos = new THREE.Vector3(0, 0, EARTH_RADIUS);
let dir = new THREE.Vector3(0, 0.1, 0); // Movement direction (tangent vector)
let nextTurn = null; // Buffer next turn input (left / right)
let history = []; // Array of Vector3 positions
let snakeSegments = [];
let snakeBodyLength = 4;
let boostCharge = 100; // 0 - 100
let isBoosting = false;
let wasBoostingLastFrame = false;

// Food & Pickups properties
let foodPos = new THREE.Vector3();
let foodMesh = null;
let foodOuterRing = null;

let coinPos = new THREE.Vector3();
let coinMesh = null;
let coinOuterRing = null;

let powerupPos = new THREE.Vector3();
let powerupMesh = null;
let powerupOuterRing = null;
let powerupType = null; // 'shield', 'magnet', 'score'

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
  unlockedLevels = [1, 2, 3, 4, 5, 6, 7];
  
  // Premium Progression Loading
  coins = parseInt(localStorage.getItem('snake_coins')) || 0;
  unlockedSkins = JSON.parse(localStorage.getItem('snake_unlocked_skins')) || ['classic'];
  equippedSkin = localStorage.getItem('snake_equipped_skin') || 'classic';
  achievements = JSON.parse(localStorage.getItem('snake_achievements')) || { gamesPlayed: 0, orbsCollected: 0, powerupsUsed: 0, coinsCollected: 0, claimed: [] };
  if (!achievements.claimed) achievements.claimed = [];
  
  updateGlobalCoinDisplay();
  generateDailyChallenges();
  
  updateLockedCards();
  document.getElementById('highscore-val').innerText = highscore;
  
  // Set up local storage settings immediately
  soundEngine.musicEnabled = localStorage.getItem('audio_music_enabled') !== 'false';
  soundEngine.sfxEnabled = localStorage.getItem('audio_sfx_enabled') !== 'false';
  soundEngine.masterVolume = parseInt(localStorage.getItem('audio_master_volume')) ?? 80;
  if (isNaN(soundEngine.masterVolume)) soundEngine.masterVolume = 80;
  soundEngine.syncUI();
  
  // Set up WebGL Scene
  init3D();
  
  // Setup Resize Listener
  window.addEventListener('resize', onWindowResize);
  
  // Event listener for Keyboard controls
  window.addEventListener('keydown', handleKeyDown);
  
  // Start general game loop (idle menu rotation)
  animate(0);
  
  // Unlock browser audio context on first click/tap anywhere on start screen
  window.addEventListener('click', handleFirstInteraction, { once: true });
  window.addEventListener('touchstart', handleFirstInteraction, { once: true });
  
  // Subtle entry animation
  gsap.from("#welcome-screen .screen-content", { duration: 1.2, scale: 0.8, opacity: 0, ease: "power3.out" });
});

function updateGlobalCoinDisplay() {
  const globalEl = document.getElementById('global-coin-val');
  const hudEl = document.getElementById('hud-coin-val');
  if (globalEl) globalEl.innerText = coins;
  if (hudEl) hudEl.innerText = coins;
  localStorage.setItem('snake_coins', coins);
}

function saveAchievements() {
  localStorage.setItem('snake_achievements', JSON.stringify(achievements));
}

function saveSkins() {
  localStorage.setItem('snake_unlocked_skins', JSON.stringify(unlockedSkins));
  localStorage.setItem('snake_equipped_skin', equippedSkin);
}

function handleFirstInteraction() {
  if (soundEngine && !soundEngine.ctx) {
    initAudio();
  } else if (soundEngine && soundEngine.ctx && soundEngine.ctx.state === 'suspended') {
    soundEngine.ctx.resume();
  }
}

// // --- DYNAMIC AUDIO ENGINE & SETTINGS SYSTEM ---
class SpaceAudioEngine {
  constructor() {
    this.ctx = null;
    this.sfxVolumeNode = null;
    
    // Audio State Configuration
    this.musicEnabled = true;
    this.sfxEnabled = true;
    this.masterVolume = 80; // 0 to 100
    
    // Music track configuration
    this.tracks = {
      menu: 'assets/audio/menu.wav',
      level1: 'assets/audio/level1.wav',
      level2: 'assets/audio/level2.wav',
      level3: 'assets/audio/level3.wav',
      level4: 'assets/audio/boss.wav',
      level5: 'assets/audio/level1.wav',
      level6: 'assets/audio/level2.wav',
      level7: 'assets/audio/boss.wav',
      gameover: 'assets/audio/menu.wav', // falling back to smooth tune for defeat
      victory: 'assets/audio/victory.wav',
      complete: 'assets/audio/victory.wav'
    };
    
    this.currentTrackKey = null;
    this.activeAudio = null;
    this.fadeInterval = null;
    this.isInitialized = false;
  }
  
  init() {
    if (this.isInitialized) return;
    
    // Load settings from LocalStorage
    this.musicEnabled = localStorage.getItem('audio_music_enabled') !== 'false';
    this.sfxEnabled = localStorage.getItem('audio_sfx_enabled') !== 'false';
    this.masterVolume = parseInt(localStorage.getItem('audio_master_volume')) ?? 80;
    if (isNaN(this.masterVolume)) this.masterVolume = 80;
    
    // Setup Audio Context for SFX
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.sfxVolumeNode = this.ctx.createGain();
      this.sfxVolumeNode.connect(this.ctx.destination);
      this.updateVolumeLevels();
    } catch(e) {
      console.warn("Web Audio API not supported", e);
    }
    
    this.isInitialized = true;
    this.syncUI();
    
    // Start main menu music immediately if allowed
    this.playMusic('menu');
  }
  
  syncUI() {
    // Sync buttons and sliders in the HTML Settings panel
    const musicBtn = document.getElementById('music-toggle-btn');
    const sfxBtn = document.getElementById('sfx-toggle-btn');
    const slider = document.getElementById('volume-slider');
    const soundIcon = document.getElementById('sound-icon');
    
    if (musicBtn) {
      musicBtn.innerText = this.musicEnabled ? 'ON' : 'OFF';
      musicBtn.classList.toggle('active', this.musicEnabled);
    }
    if (sfxBtn) {
      sfxBtn.innerText = this.sfxEnabled ? 'ON' : 'OFF';
      sfxBtn.classList.toggle('active', this.sfxEnabled);
    }
    if (slider) {
      slider.value = this.masterVolume;
    }
    if (soundIcon) {
      soundIcon.innerText = (this.musicEnabled || this.sfxEnabled) && this.masterVolume > 0 ? "🔊" : "🔇";
    }
  }
  
  updateVolumeLevels() {
    const finalVolume = (this.masterVolume / 100);
    
    // Set SFX gain
    if (this.sfxVolumeNode && this.ctx) {
      const sfxVol = this.sfxEnabled ? finalVolume * 0.7 : 0.0;
      this.sfxVolumeNode.gain.setValueAtTime(sfxVol, this.ctx.currentTime);
    }
    
    // Set Music volume
    if (this.activeAudio) {
      const musicVol = this.musicEnabled ? finalVolume * 0.35 : 0.0;
      this.activeAudio.volume = musicVol;
    }
  }
  
  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    localStorage.setItem('audio_music_enabled', this.musicEnabled);
    this.updateVolumeLevels();
    this.syncUI();
    this.playSFX('click');
    
    if (this.musicEnabled) {
      if (this.activeAudio) {
        this.activeAudio.play().catch(e => console.log("Play interrupted", e));
      } else {
        this.playMusic(this.currentTrackKey || 'menu');
      }
    } else {
      if (this.activeAudio) {
        this.activeAudio.pause();
      }
    }
  }
  
  toggleSFX() {
    this.sfxEnabled = !this.sfxEnabled;
    localStorage.setItem('audio_sfx_enabled', this.sfxEnabled);
    this.updateVolumeLevels();
    this.syncUI();
    this.playSFX('click');
  }
  
  setMasterVolume(val) {
    this.masterVolume = parseInt(val);
    localStorage.setItem('audio_master_volume', this.masterVolume);
    this.updateVolumeLevels();
    this.syncUI();
  }
  
  playMusic(trackKey) {
    if (!this.isInitialized) return;
    if (this.currentTrackKey === trackKey && this.activeAudio && !this.activeAudio.paused) return;
    
    const trackUrl = this.tracks[trackKey];
    if (!trackUrl) return;
    
    this.currentTrackKey = trackKey;
    
    // Smooth Fade-out previous track and Fade-in new track
    if (this.activeAudio) {
      this.activeAudio.pause();
      this.activeAudio.currentTime = 0;
    }
    
    // Initialize and play new track
    const newAudio = new Audio(trackUrl);
    newAudio.loop = true;
    newAudio.crossOrigin = "anonymous";
    
    const finalVolume = (this.masterVolume / 100);
    const targetVolume = this.musicEnabled ? finalVolume * 0.35 : 0.0;
    
    newAudio.volume = targetVolume;
    this.activeAudio = newAudio;
    
    if (this.musicEnabled) {
      newAudio.play().catch(err => {
        console.warn("Music play blocked by browser policies", err);
      });
    }
  }
  
  pauseMusic() {
    if (this.activeAudio) {
      this.activeAudio.pause();
    }
  }
  
  resumeMusic() {
    if (this.activeAudio && this.musicEnabled) {
      this.activeAudio.play().catch(e => console.log("Play error", e));
    }
  }
  
  playSFX(type) {
    if (!this.isInitialized) return;
    if (!this.sfxEnabled || !this.ctx) return;
    
    const now = this.ctx.currentTime;
    
    if (type === "eat") {
      // Arpeggiated space chime synth
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.05);
        
        gain.gain.setValueAtTime(0.0, now + idx * 0.05);
        gain.gain.linearRampToValueAtTime(0.25, now + idx * 0.05 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.22);
        
        osc.connect(gain);
        gain.connect(this.sfxVolumeNode);
        
        osc.start(now + idx * 0.05);
        osc.stop(now + idx * 0.05 + 0.3);
      });
    } 
    else if (type === "boost") {
      // Sci-fi high velocity swoosh
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.22);
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(200, now);
      filter.frequency.exponentialRampToValueAtTime(1800, now + 0.22);
      filter.Q.setValueAtTime(4.0, now);
      
      gain.gain.setValueAtTime(0.0, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxVolumeNode);
      
      osc.start(now);
      osc.stop(now + 0.26);
    } 
    else if (type === "levelup") {
      // Futuristic sweep riser for Level Up
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.8);
      
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.linearRampToValueAtTime(0.35, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
      
      osc.connect(gain);
      gain.connect(this.sfxVolumeNode);
      
      osc.start(now);
      osc.stop(now + 0.9);
    } 
    else if (type === "gameover") {
      // Deep dramatic failure drop SFX
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.linearRampToValueAtTime(40, now + 0.8);
      
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
      
      osc.connect(gain);
      gain.connect(this.sfxVolumeNode);
      
      osc.start(now);
      osc.stop(now + 0.9);
      
      // Defeat explosion noise sweep
      const bufferSize = this.ctx.sampleRate * 0.7;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(400, now);
      filter.frequency.linearRampToValueAtTime(20, now + 0.7);
      
      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.2, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
      
      noise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(this.sfxVolumeNode);
      
      noise.start(now);
      noise.stop(now + 0.8);
    } 
    else if (type === "click") {
      // Rhythmic cyber click sound
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1400, now);
      
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      
      osc.connect(gain);
      gain.connect(this.sfxVolumeNode);
      
      osc.start(now);
      osc.stop(now + 0.06);
    }
  }
}

const soundEngine = new SpaceAudioEngine();

// UI functions mapping to settings
function toggleAudioPanel() {
  soundEngine.playSFX('click');
  const panel = document.getElementById('audio-settings-panel');
  if (panel) {
    panel.classList.toggle('active');
  }
}

function toggleMusicChannel() {
  soundEngine.toggleMusic();
}

function toggleSFXChannel() {
  soundEngine.toggleSFX();
}

function changeMasterVolume(val) {
  soundEngine.setMasterVolume(val);
}

function initAudio() {
  soundEngine.init();
}

function playSFX(type) {
  soundEngine.playSFX(type);
}

function playClickSound() {
  soundEngine.playSFX("click");
}


// --- GARAGE (SHOP) LOGIC ---
function showGarage() {
  playClickSound();
  renderGarage();
  gsap.to("#welcome-screen", { duration: 0.4, opacity: 0, scale: 0.9, display: "none" });
  gsap.to("#garage-screen", { duration: 0.5, delay: 0.2, opacity: 1, scale: 1, display: "flex" });
  gameState = "MENU_GARAGE";
}

function backToMenuFromGarage() {
  playClickSound();
  gsap.to("#garage-screen", { duration: 0.4, opacity: 0, scale: 0.9, display: "none" });
  gsap.to("#welcome-screen", { duration: 0.5, delay: 0.2, opacity: 1, scale: 1, display: "flex" });
  gameState = "MENU";
}

function renderGarage() {
  const grid = document.getElementById('garage-grid');
  grid.innerHTML = '';
  
  for (const [key, data] of Object.entries(SKIN_DATA)) {
    const isUnlocked = unlockedSkins.includes(key);
    const isEquipped = equippedSkin === key;
    
    const card = document.createElement('div');
    card.className = `skin-card ${isUnlocked ? '' : 'locked'} ${isEquipped ? 'equipped' : ''}`;
    
    // Icon based on type
    let colorStyle = data.color ? `background: #${data.color.toString(16).padStart(6, '0')}` : 'background: var(--neon-cyan)';
    if (data.type === 'transparent') colorStyle = `background: transparent; border-color: #fff; box-shadow: inset 0 0 10px #fff;`;
    
    card.innerHTML = `
      <div class="skin-icon" style="${colorStyle}"></div>
      <div class="skin-name">${data.name}</div>
      ${!isUnlocked ? `<div style="color:var(--neon-orange); font-size: 0.9rem;">🪙 ${data.price}</div>` : ''}
    `;
    
    const btn = document.createElement('button');
    btn.className = `cyber-btn skin-status-btn ${isEquipped ? 'secondary-btn' : ''}`;
    
    if (isEquipped) {
      btn.innerText = "EQUIPPED";
      btn.disabled = true;
    } else if (isUnlocked) {
      btn.innerText = "EQUIP";
      btn.onclick = () => equipSkin(key);
    } else {
      btn.innerText = "PURCHASE";
      btn.onclick = () => buySkin(key, data.price);
    }
    
    card.appendChild(btn);
    grid.appendChild(card);
  }
}

function equipSkin(key) {
  playClickSound();
  equippedSkin = key;
  saveSkins();
  renderGarage();
}

function buySkin(key, price) {
  if (coins >= price) {
    playSFX('levelup');
    coins -= price;
    updateGlobalCoinDisplay();
    unlockedSkins.push(key);
    equipSkin(key);
  } else {
    playSFX('click');
  }
}

// --- DATA LOGS (ACHIEVEMENTS) LOGIC ---
function showAchievements() {
  playClickSound();
  renderAchievements();
  renderDailyChallenges();
  gsap.to("#welcome-screen", { duration: 0.4, opacity: 0, scale: 0.9, display: "none" });
  gsap.to("#achievements-screen", { duration: 0.5, delay: 0.2, opacity: 1, scale: 1, display: "flex" });
  gameState = "MENU_LOGS";
}

function backToMenuFromAchievements() {
  playClickSound();
  gsap.to("#achievements-screen", { duration: 0.4, opacity: 0, scale: 0.9, display: "none" });
  gsap.to("#welcome-screen", { duration: 0.5, delay: 0.2, opacity: 1, scale: 1, display: "flex" });
  gameState = "MENU";
}

function generateDailyChallenges() {
  const today = new Date().toDateString();
  const savedDate = localStorage.getItem('snake_daily_date');
  
  if (savedDate !== today) {
    dailyChallenges = [
      { id: 'daily_orbs', name: 'Gatherer', desc: 'Collect 30 Orbs today', target: 30, progress: 0, reward: 25, claimed: false },
      { id: 'daily_coins', name: 'Scavenger', desc: 'Collect 10 Coins today', target: 10, progress: 0, reward: 25, claimed: false },
      { id: 'daily_play', name: 'Pilot', desc: 'Play 3 Games today', target: 3, progress: 0, reward: 20, claimed: false }
    ];
    localStorage.setItem('snake_daily_date', today);
    saveDailyChallenges();
  } else {
    dailyChallenges = JSON.parse(localStorage.getItem('snake_daily_challenges')) || [];
    if (!dailyChallenges.length || !dailyChallenges[0].hasOwnProperty('progress')) {
      dailyChallenges = [
        { id: 'daily_orbs', name: 'Gatherer', desc: 'Collect 30 Orbs today', target: 30, progress: 0, reward: 25, claimed: false },
        { id: 'daily_coins', name: 'Scavenger', desc: 'Collect 10 Coins today', target: 10, progress: 0, reward: 25, claimed: false },
        { id: 'daily_play', name: 'Pilot', desc: 'Play 3 Games today', target: 3, progress: 0, reward: 20, claimed: false }
      ];
      saveDailyChallenges();
    }
  }
}

function saveDailyChallenges() {
  localStorage.setItem('snake_daily_challenges', JSON.stringify(dailyChallenges));
}

function renderAchievements() {
  const list = document.getElementById('achievements-list');
  list.innerHTML = '';
  
  ACHIEVEMENT_DEFS.forEach(def => {
    const progress = achievements[def.key] || 0;
    const isCompleted = progress >= def.target;
    const isClaimed = achievements.claimed.includes(def.id);
    
    const div = document.createElement('div');
    div.className = `log-item ${isCompleted ? 'completed' : ''}`;
    
    div.innerHTML = `
      <div class="log-item-info">
        <h4>${def.name}</h4>
        <p>${def.desc} (${Math.min(progress, def.target)}/${def.target})</p>
      </div>
    `;
    
    if (isCompleted && !isClaimed) {
      const btn = document.createElement('button');
      btn.className = 'cyber-btn reward-btn';
      btn.style.padding = '5px 10px';
      btn.style.fontSize = '0.75rem';
      btn.innerText = `CLAIM ${def.reward}`;
      btn.onclick = () => claimAchievement(def);
      div.appendChild(btn);
    } else if (isClaimed) {
      const span = document.createElement('span');
      span.className = 'log-item-reward';
      span.innerText = "SECURED";
      div.appendChild(span);
    } else {
      const span = document.createElement('span');
      span.className = 'log-item-reward';
      span.innerText = `🪙 ${def.reward}`;
      div.appendChild(span);
    }
    
    list.appendChild(div);
  });
}

function renderDailyChallenges() {
  const list = document.getElementById('daily-challenges-list');
  list.innerHTML = '';
  
  dailyChallenges.forEach(chal => {
    const isCompleted = chal.progress >= chal.target;
    
    const div = document.createElement('div');
    div.className = `log-item ${isCompleted ? 'completed' : ''}`;
    
    div.innerHTML = `
      <div class="log-item-info">
        <h4>${chal.name}</h4>
        <p>${chal.desc} (${Math.min(chal.progress, chal.target)}/${chal.target})</p>
      </div>
    `;
    
    if (isCompleted && !chal.claimed) {
      const btn = document.createElement('button');
      btn.className = 'cyber-btn reward-btn';
      btn.style.padding = '5px 10px';
      btn.style.fontSize = '0.75rem';
      btn.innerText = `CLAIM ${chal.reward}`;
      btn.onclick = () => claimDaily(chal.id);
      div.appendChild(btn);
    } else if (chal.claimed) {
      const span = document.createElement('span');
      span.className = 'log-item-reward';
      span.innerText = "SECURED";
      div.appendChild(span);
    } else {
      const span = document.createElement('span');
      span.className = 'log-item-reward';
      span.innerText = `🪙 ${chal.reward}`;
      div.appendChild(span);
    }
    
    list.appendChild(div);
  });
}

function claimAchievement(def) {
  playSFX('levelup');
  coins += def.reward;
  achievements.claimed.push(def.id);
  updateGlobalCoinDisplay();
  saveAchievements();
  renderAchievements();
}

function claimDaily(id) {
  playSFX('levelup');
  const chal = dailyChallenges.find(c => c.id === id);
  if (chal && !chal.claimed) {
    coins += chal.reward;
    chal.claimed = true;
    updateGlobalCoinDisplay();
    saveDailyChallenges();
    renderDailyChallenges();
  }
}

function checkAchievementsAndDailies(type, amount = 1) {
  if (achievements[type] !== undefined) {
    achievements[type] += amount;
    saveAchievements();
  }
  
  if (type === 'orbsCollected') {
    const c = dailyChallenges.find(c => c.id === 'daily_orbs');
    if (c && c.progress < c.target) c.progress += amount;
  } else if (type === 'coinsCollected') {
    const c = dailyChallenges.find(c => c.id === 'daily_coins');
    if (c && c.progress < c.target) c.progress += amount;
  } else if (type === 'gamesPlayed') {
    const c = dailyChallenges.find(c => c.id === 'daily_play');
    if (c && c.progress < c.target) c.progress += amount;
  }
  saveDailyChallenges();
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
  soundEngine.playMusic('menu');
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
  soundEngine.playMusic('menu');
}

function updateLockedCards() {
  for (let lvl = 2; lvl <= 7; lvl++) {
    const card = document.getElementById(`card-lvl-${lvl}`);
    if (!card) continue;
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
    if (card) {
      gsap.to(card, { duration: 0.1, x: -10, yoyo: true, repeat: 3 });
    }
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
  soundEngine.playMusic('level' + lvl);
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
  const skin = SKIN_DATA[equippedSkin];
  const defaultColorHex = LEVEL_DATA[currentLevel].color;
  const colorHex = skin.color !== null ? skin.color : defaultColorHex;
  
  let opacity = 1.0;
  let transparent = false;
  if (skin.type === 'transparent') {
    opacity = 0.4;
    transparent = true;
  }
  
  // Sleek polygon Diamond head
  const headGeom = new THREE.ConeGeometry(0.55, 1.4, 4);
  headGeom.rotateX(Math.PI / 2); // align forward
  const headMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: skin.type === 'metallic' ? 0.05 : 0.1,
    metalness: skin.type === 'metallic' ? 1.0 : 0.9,
    emissive: colorHex,
    emissiveIntensity: skin.type === 'emissive' ? 1.5 : 0.8,
    transparent: transparent,
    opacity: opacity
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
      roughness: skin.type === 'metallic' ? 0.1 : 0.2,
      metalness: skin.type === 'metallic' ? 0.9 : 0.7,
      emissive: colorHex,
      emissiveIntensity: (skin.type === 'emissive' ? 0.8 : 0.45) * (1 - i / snakeBodyLength),
      transparent: transparent,
      opacity: opacity
    });
    const segMesh = new THREE.Mesh(segGeom, segMat);
    segMesh.position.copy(headPos);
    scene.add(segMesh);
    snakeSegments.push(segMesh);
  }
}

function growSnake() {
  snakeBodyLength++;
  const skin = SKIN_DATA[equippedSkin];
  const defaultColorHex = LEVEL_DATA[currentLevel].color;
  const colorHex = skin.color !== null ? skin.color : defaultColorHex;
  
  let opacity = 1.0;
  let transparent = false;
  if (skin.type === 'transparent') {
    opacity = 0.4;
    transparent = true;
  }
  
  const i = snakeBodyLength - 1;
  const size = 0.45 * (1 - (i / (snakeBodyLength + 4)));
  
  const segGeom = new THREE.SphereGeometry(size, 12, 12);
  const segMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: skin.type === 'metallic' ? 0.1 : 0.2,
    metalness: skin.type === 'metallic' ? 0.9 : 0.7,
    emissive: colorHex,
    emissiveIntensity: (skin.type === 'emissive' ? 0.8 : 0.45) * (1 - i / snakeBodyLength),
    transparent: transparent,
    opacity: opacity
  });
  
  const segMesh = new THREE.Mesh(segGeom, segMat);
  segMesh.position.copy(history[Math.max(0, history.length - 1 - i * SPACING)]);
  scene.add(segMesh);
  snakeSegments.push(segMesh);
  
  // Re-adjust all segment emissive intensity & scale
  for (let idx = 1; idx < snakeSegments.length; idx++) {
    const sizeScale = 1 - (idx / (snakeSegments.length + 4));
    snakeSegments[idx].scale.set(sizeScale, sizeScale, sizeScale);
    snakeSegments[idx].material.emissiveIntensity = (skin.type === 'emissive' ? 0.8 : 0.45) * (1 - idx / snakeSegments.length);
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

function getValidSpawnPos() {
  let spawnPos = getRandomPointOnSphere(EARTH_RADIUS + 0.35);
  let valid = false;
  let attempts = 0;
  while (!valid && attempts < 50) {
    valid = true;
    if (spawnPos.distanceTo(headPos) < 2.0) valid = false;
    else {
      for (let i = 1; i < snakeSegments.length; i++) {
        if (spawnPos.distanceTo(snakeSegments[i].position) < 1.6) { valid = false; break; }
      }
    }
    if (valid) {
      for (let o of obstacles) {
        if (spawnPos.distanceTo(o.pos) < 2.2) { valid = false; break; }
      }
    }
    if (!valid) {
      spawnPos = getRandomPointOnSphere(EARTH_RADIUS + 0.35);
      attempts++;
    }
  }
  return spawnPos;
}

// Spawns energy orb
function spawnFood() {
  if (foodMesh) scene.remove(foodMesh);
  if (foodOuterRing) scene.remove(foodOuterRing);
  
  let spawnPos = getValidSpawnPos();
  
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

function spawnCoin() {
  if (coinMesh) scene.remove(coinMesh);
  if (coinOuterRing) scene.remove(coinOuterRing);
  if (Math.random() > 0.4) return; // 40% chance to spawn
  
  let spawnPos = getValidSpawnPos();
  coinPos.copy(spawnPos);
  
  const coinGeom = new THREE.CylinderGeometry(0.3, 0.3, 0.08, 16);
  coinGeom.rotateX(Math.PI / 2);
  const coinMat = new THREE.MeshStandardMaterial({
    color: 0xffaa00, emissive: 0xffaa00, emissiveIntensity: 0.8, metalness: 1.0, roughness: 0.1
  });
  coinMesh = new THREE.Mesh(coinGeom, coinMat);
  coinMesh.position.copy(coinPos);
  scene.add(coinMesh);
  
  const ringGeom = new THREE.RingGeometry(0.5, 0.55, 12);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
  coinOuterRing = new THREE.Mesh(ringGeom, ringMat);
  coinOuterRing.position.copy(coinPos);
  coinOuterRing.lookAt(0, 0, 0);
  scene.add(coinOuterRing);
}

function spawnPowerup() {
  if (powerupMesh) scene.remove(powerupMesh);
  if (powerupOuterRing) scene.remove(powerupOuterRing);
  if (Math.random() > 0.15) return; // 15% chance
  
  let spawnPos = getValidSpawnPos();
  powerupPos.copy(spawnPos);
  
  const types = ['shield', 'magnet', 'score'];
  powerupType = types[Math.floor(Math.random() * types.length)];
  let col = 0xffffff;
  if (powerupType === 'shield') col = 0x00d2ff;
  if (powerupType === 'magnet') col = 0x9d00ff;
  if (powerupType === 'score') col = 0xffaa00;
  
  const geom = new THREE.OctahedronGeometry(0.4, 0);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: col, emissiveIntensity: 1.2, metalness: 0.8, roughness: 0.2
  });
  powerupMesh = new THREE.Mesh(geom, mat);
  powerupMesh.position.copy(powerupPos);
  scene.add(powerupMesh);
  
  const ringGeom = new THREE.RingGeometry(0.6, 0.68, 8);
  const ringMat = new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
  powerupOuterRing = new THREE.Mesh(ringGeom, ringMat);
  powerupOuterRing.position.copy(powerupPos);
  powerupOuterRing.lookAt(0, 0, 0);
  scene.add(powerupOuterRing);
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
    if (!wasBoostingLastFrame) {
      soundEngine.playSFX("boost");
      wasBoostingLastFrame = true;
    }
    currentSpeed *= BOOST_SPEED_MULTIPLIER;
    boostCharge = Math.max(0, boostCharge - 0.95);
    document.getElementById('boost-charge-fill').style.width = `${boostCharge}%`;
  } else {
    wasBoostingLastFrame = false;
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
    if (!isMuted) {
      soundEngine.playSFX("click");
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
      if (activePowerups.shield) {
        breakShield();
        return;
      }
      triggerGameOver();
      return;
    }
  }
  
  // 7. Check Obstacle Collisions
  for (let o of obstacles) {
    if (headPos.distanceTo(o.pos) < o.radius) {
      if (activePowerups.shield) {
        breakShield();
        scene.remove(o.mesh);
        obstacles = obstacles.filter(obs => obs !== o);
        return;
      }
      triggerGameOver();
      return;
    }
  }
  
  // Magnet Logic
  if (activePowerups.magnet > 0) {
    if (foodPos && headPos.distanceTo(foodPos) < 4.0) {
      const pullDir = headPos.clone().sub(foodPos).normalize();
      foodPos.addScaledVector(pullDir, 0.2);
      foodPos.setLength(EARTH_RADIUS + 0.35);
    }
    if (coinMesh && coinPos && headPos.distanceTo(coinPos) < 4.0) {
      const pullDir = headPos.clone().sub(coinPos).normalize();
      coinPos.addScaledVector(pullDir, 0.2);
      coinPos.setLength(EARTH_RADIUS + 0.35);
    }
  }
  
  // Trail Particles
  if (history.length > 5 && Math.random() > 0.5) {
    const tailPos = snakeSegments[snakeSegments.length - 1].position;
    createTrailParticle(tailPos, LEVEL_DATA[currentLevel].color);
  }
  
  // 8. Check Food collision
  if (foodMesh && headPos.distanceTo(foodPos) < 0.95) eatFood();
  if (coinMesh && headPos.distanceTo(coinPos) < 0.95) eatCoin();
  if (powerupMesh && headPos.distanceTo(powerupPos) < 0.95) eatPowerup();
}

function breakShield() {
  activePowerups.shield = false;
  playSFX('gameover'); 
  createParticleBurst(headPos, 0x00d2ff, 40);
  triggerAlertMessage("SHIELD DEPLETED");
  screenShake();
  updatePowerupHUD();
}

function eatCoin() {
  const amount = activePowerups.doubleScore > 0 ? 2 : 1;
  coins += amount;
  playSFX("click");
  createParticleBurst(coinPos, 0xffaa00, 15);
  scene.remove(coinMesh);
  scene.remove(coinOuterRing);
  coinMesh = null;
  updateGlobalCoinDisplay();
  checkAchievementsAndDailies('coinsCollected', amount);
}

function eatPowerup() {
  playSFX("levelup");
  createParticleBurst(powerupPos, 0xffffff, 20);
  
  if (powerupType === 'shield') activePowerups.shield = true;
  if (powerupType === 'magnet') activePowerups.magnet = 10;
  if (powerupType === 'score') activePowerups.doubleScore = 10;
  
  scene.remove(powerupMesh);
  scene.remove(powerupOuterRing);
  powerupMesh = null;
  
  triggerAlertMessage(powerupType.toUpperCase() + " ACQUIRED");
  checkAchievementsAndDailies('powerupsUsed', 1);
  updatePowerupHUD();
}

function updatePowerupHUD() {
  const container = document.getElementById('powerup-hud');
  if (!container) return;
  container.innerHTML = '';
  
  if (activePowerups.shield) {
    container.innerHTML += `<div class="powerup-icon shield">🛡️</div>`;
  }
  if (activePowerups.magnet > 0) {
    container.innerHTML += `<div class="powerup-icon magnet">🧲<div class="powerup-timer">${Math.ceil(activePowerups.magnet)}s</div></div>`;
  }
  if (activePowerups.doubleScore > 0) {
    container.innerHTML += `<div class="powerup-icon score">2x<div class="powerup-timer">${Math.ceil(activePowerups.doubleScore)}s</div></div>`;
  }
}

let shakeOffset = new THREE.Vector3();
let isShaking = false;
function screenShake() {
  if (isShaking) return;
  isShaking = true;
  let shakes = 10;
  const shakeInt = setInterval(() => {
    shakeOffset.set((Math.random()-0.5)*1.5, (Math.random()-0.5)*1.5, (Math.random()-0.5)*1.5);
    shakes--;
    if (shakes <= 0) {
      clearInterval(shakeInt);
      shakeOffset.set(0,0,0);
      isShaking = false;
    }
  }, 40);
}

function eatFood() {
  const amount = activePowerups.doubleScore > 0 ? 2 : 1;
  score += amount;
  playSFX("eat");
  
  // Spawn particle burst
  createParticleBurst(foodPos, LEVEL_DATA[currentLevel].color, 30);
  
  // Grow Snake length
  growSnake();
  
  // Update HUD
  document.getElementById('score-val').innerText = score;
  
  const levelInfo = LEVEL_DATA[currentLevel];
  const progressPercent = Math.min(100, (score / levelInfo.target) * 100);
  updateProgressBar(progressPercent);
  
  // Check if Level Target Met
  checkAchievementsAndDailies('orbsCollected', amount);
  if (score >= levelInfo.target) {
    triggerLevelComplete();
  } else {
    // Spawn next food
    spawnFood();
    spawnCoin();
    spawnPowerup();
  }
}

function updateProgressBar(pct) {
  document.getElementById('level-progress-bar').style.width = `${pct}%`;
}

// Particle system effects
function createParticleBurst(position, color, count = 30) {
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

function createTrailParticle(position, color) {
  const geom = new THREE.PlaneGeometry(0.4, 0.4);
  const mat = new THREE.MeshBasicMaterial({
    color: color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.copy(position);
  mesh.lookAt(0,0,0);
  scene.add(mesh);
  
  particles.push({
    mesh: mesh,
    velocity: new THREE.Vector3(0,0,0),
    life: 0.6,
    decay: 0.04
  });
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
  camera.position.add(shakeOffset);
  
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
    if (activePowerups.magnet > 0) {
      activePowerups.magnet -= 0.016;
      if (activePowerups.magnet <= 0) updatePowerupHUD();
      else if (Math.floor(activePowerups.magnet) !== Math.floor(activePowerups.magnet + 0.016)) updatePowerupHUD();
    }
    if (activePowerups.doubleScore > 0) {
      activePowerups.doubleScore -= 0.016;
      if (activePowerups.doubleScore <= 0) updatePowerupHUD();
      else if (Math.floor(activePowerups.doubleScore) !== Math.floor(activePowerups.doubleScore + 0.016)) updatePowerupHUD();
    }
    
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
  soundEngine.playMusic('gameover');
  
  checkAchievementsAndDailies('gamesPlayed', 1);
  screenShake();
  
  // Snake collapse animation
  snakeSegments.forEach((seg, idx) => {
    gsap.to(seg.scale, { duration: 0.8, x: 0, y: 0, z: 0, ease: "power2.in" });
    createParticleBurst(seg.position, LEVEL_DATA[currentLevel].color, 40);
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
  
  // Determine victory or total completion
  if (currentLevel === 7) {
    soundEngine.playMusic('complete');
  } else {
    soundEngine.playMusic('victory');
  }
  
  // Update highscore
  if (score > highscore) {
    highscore = score;
    localStorage.setItem('snake_highscore', highscore);
  }
  
  triggerAlertMessage("SYSTEM UPLINK SUCCESSFUL");
  
  // Unlock next Level
  const nextLvl = currentLevel + 1;
  if (nextLvl <= 7 && !unlockedLevels.includes(nextLvl)) {
    unlockedLevels.push(nextLvl);
    localStorage.setItem('snake_unlocked_levels', JSON.stringify(unlockedLevels));
    updateLockedCards();
  }
  
  // Cinematic hyperspace jump
  gsap.to(camera, { fov: 120, duration: 1.5, ease: "power2.in", onUpdate: () => camera.updateProjectionMatrix() });
  gsap.to(camera.position, {
    duration: 2.2,
    x: 0,
    y: 0,
    z: 60,
    ease: "power2.inOut",
    onComplete: () => {
      camera.fov = 55;
      camera.updateProjectionMatrix();
      
      // Transition to Level Selection
      resetGameEnvironment();
      gsap.to("#hud", { duration: 0.3, opacity: 0, display: "none" });
      gsap.to("#level-screen", { duration: 0.5, opacity: 1, scale: 1, display: "flex", onStart: () => {
        document.getElementById("level-screen").classList.add("active");
      }});
      gameState = "LEVEL_SELECT";
      soundEngine.playMusic('menu');
    }
  });
}

// Pause Game Overlay
function pauseGame() {
  if (gameState !== "PLAYING") return;
  playClickSound();
  gameState = "PAUSED";
  soundEngine.pauseMusic();
  
  gsap.to("#pause-overlay", { duration: 0.3, opacity: 1, display: "flex", onStart: () => {
    document.getElementById("pause-overlay").classList.add("active");
  }});
}

function resumeGame() {
  if (gameState !== "PAUSED") return;
  playClickSound();
  
  gsap.to("#pause-overlay", { duration: 0.3, opacity: 0, display: "none", onComplete: () => {
    gameState = "PLAYING";
    soundEngine.resumeMusic();
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
  soundEngine.playMusic('level' + currentLevel);
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
  
  if (coinMesh) scene.remove(coinMesh);
  if (coinOuterRing) scene.remove(coinOuterRing);
  coinMesh = null;
  coinOuterRing = null;
  
  if (powerupMesh) scene.remove(powerupMesh);
  if (powerupOuterRing) scene.remove(powerupOuterRing);
  powerupMesh = null;
  powerupOuterRing = null;
  
  activePowerups = { shield: false, magnet: 0, doubleScore: 0 };
  updatePowerupHUD();
  
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
