import Phaser from 'phaser';

// ==================== SAVE MANAGER ====================
const SAVE_KEY = 'ghostshift_save';

const defaultSaveData = {
  credits: 0,
  totalRuns: 0,
  bestTime: null,
  bestTimes: {}, // per-level best times
  unlockedLevels: [0], // array of unlocked level indices
  perks: { speed: 1, stealth: 1, luck: 1 },
  settings: { 
    audioEnabled: true, 
    masterVolume: 0.8,
    effectsQuality: 'high',
    fullscreen: false,
    reducedMotion: false
  },
  lastPlayed: null,
  totalCreditsEarned: 0
};

class SaveManager {
  constructor() { this.data = this.load(); }
  load() {
    try {
      const saved = localStorage.getItem(SAVE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...defaultSaveData, ...parsed, perks: { ...defaultSaveData.perks, ...(parsed.perks || {}) }, settings: { ...defaultSaveData.settings, ...(parsed.settings || {}) }, bestTimes: parsed.bestTimes || {}, unlockedLevels: parsed.unlockedLevels || [0] };
      }
    } catch (e) { console.warn('Failed to load save, using defaults:', e); }
    return { ...defaultSaveData };
  }
  save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) { console.warn('Failed to save:', e); } }
  hasSave() { return this.data.totalRuns > 0 || this.data.credits > 0; }
  getLastPlayed() { return this.data.lastPlayed; }
  addCredits(amount) { this.data.credits += amount; this.data.totalCreditsEarned += amount; this.save(); }
  spendCredits(amount) { if (this.data.credits >= amount) { this.data.credits -= amount; this.save(); return true; } return false; }
  getPerkLevel(perk) { return this.data.perks[perk] || 1; }
  upgradePerk(perk) {
    const PERK_INFO = { speed: { costs: [0, 50, 100, 200], bonus: [0, 0.15, 0.35, 0.6] }, stealth: { costs: [0, 50, 100, 200], bonus: [0, 0.2, 0.4, 0.65] }, luck: { costs: [0, 50, 100, 200], bonus: [0, 10, 25, 50] } };
    const currentLevel = this.data.perks[perk] || 1;
    if (currentLevel >= 4) return false;
    const cost = PERK_INFO[perk].costs[currentLevel];
    if (this.spendCredits(cost)) { this.data.perks[perk] = currentLevel + 1; this.save(); return true; }
    return false;
  }
  isLevelUnlocked(levelIndex) { return this.data.unlockedLevels.includes(levelIndex); }
  unlockLevel(levelIndex) { if (!this.isLevelUnlocked(levelIndex)) { this.data.unlockedLevels.push(levelIndex); this.save(); } }
  getBestTime(levelIndex) { return this.data.bestTimes[levelIndex] || null; }
  setBestTime(levelIndex, time) { const current = this.data.bestTimes[levelIndex]; if (!current || time < current) { this.data.bestTimes[levelIndex] = time; this.save(); } }
  getSetting(key) { return this.data.settings[key]; }
  setSetting(key, value) { this.data.settings[key] = value; this.save(); }
  recordRun(levelIndex, time, creditsEarned) { this.data.totalRuns++; this.data.lastPlayed = Date.now(); this.addCredits(creditsEarned); this.setBestTime(levelIndex, time); if (levelIndex < LEVEL_LAYOUTS.length - 1) this.unlockLevel(levelIndex + 1); }
  resetSave() { this.data = { ...defaultSaveData }; this.save(); }
}

const saveManager = new SaveManager();

// Backwards compatibility
let gameSave = saveManager.data;
function loadSave() { return saveManager.data; }
function saveSaveData(data) { saveManager.data = data; saveManager.save(); }

// ==================== GAME CONSTANTS ====================
// Phase 4: Improved balancing with difficulty scaling
const TILE_SIZE = 32;
const MAP_WIDTH = 20;
const MAP_HEIGHT = 15;
const BASE_PLAYER_SPEED = 180;
// Guard speed now scales with difficulty (base 65, max 90)
const BASE_GUARD_SPEED = 65;
const GHOST_ALPHA = 0.25;
// Vision cone improvements - slightly reduced angle for fairness, increased distance for higher difficulty
const BASE_VISION_CONE_ANGLE = 55;
const BASE_VISION_CONE_DISTANCE = 140;
// Scanner drone settings - improved balancing
const SCANNER_SPEED = 50;
const SCANNER_BEAM_LENGTH = 110;
const SCANNER_BEAM_ANGLE = 0.25;
// Motion sensor improvements - faster cooldown for harder levels
const MOTION_SENSOR_RADIUS = 55;
const MOTION_SENSOR_COOLDOWN_BASE = 100;

// Difficulty-based settings helper
function getGuardSpeedForLevel(difficulty) {
  return BASE_GUARD_SPEED + (difficulty - 1) * 8; // +8 speed per difficulty level
}

function getVisionConeDistanceForLevel(difficulty) {
  return BASE_VISION_CONE_DISTANCE + (difficulty - 1) * 15;
}

function getVisionConeAngleForLevel(difficulty) {
  return (BASE_VISION_CONE_ANGLE + (difficulty - 1) * 3) * Math.PI / 180;
}

function getMotionSensorCooldownForLevel(difficulty) {
  return Math.max(50, MOTION_SENSOR_COOLDOWN_BASE - (difficulty - 1) * 15);
}

// ==================== AUDIO SYSTEM ====================
class SFXManager {
  constructor() { 
    this.ctx = null; 
    this.initialized = false; 
    this.enabled = saveManager.getSetting('audioEnabled') !== false;
    this.masterVolume = saveManager.getSetting('masterVolume') ?? 0.8;
  }
  init() { if (this.initialized) return; try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this.initialized = true; } catch (e) { console.warn('WebAudio not available'); } }
  setEnabled(enabled) { this.enabled = enabled; saveManager.setSetting('audioEnabled', enabled); }
  get isEnabled() { return this.enabled; }
  setMasterVolume(vol) { this.masterVolume = Math.max(0, Math.min(1, vol)); saveManager.setSetting('masterVolume', this.masterVolume); }
  get volume() { return this.masterVolume; }
  playTone(freq, duration, type = 'square', volume = 0.1) {
    if (!this.ctx || !this.enabled) return;
    const effectiveVolume = volume * this.masterVolume;
    const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
    osc.type = type; osc.frequency.value = freq; gain.gain.value = effectiveVolume;
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain); gain.connect(this.ctx.destination); osc.start(); osc.stop(this.ctx.currentTime + duration);
  }
  alert() { this.playTone(880, 0.15, 'square', 0.08); setTimeout(() => this.playTone(1100, 0.15, 'square', 0.08), 100); }
  win() { this.playTone(523, 0.1, 'sine', 0.1); setTimeout(() => this.playTone(659, 0.1, 'sine', 0.1), 100); setTimeout(() => this.playTone(784, 0.2, 'sine', 0.1), 200); }
  fail() { this.playTone(200, 0.3, 'sawtooth', 0.1); setTimeout(() => this.playTone(150, 0.4, 'sawtooth', 0.1), 200); }
  collect() { this.playTone(1200, 0.05, 'sine', 0.08); setTimeout(() => this.playTone(1500, 0.1, 'sine', 0.08), 50); }
  select() { this.playTone(600, 0.08, 'sine', 0.08); }
  menuHover() { this.playTone(400, 0.05, 'sine', 0.03); }
  pickup() { this.playTone(800, 0.08, 'sine', 0.06); }
  pause() { /* pause sound if we had background audio */ }
  detection() { this.playTone(150, 0.4, 'sawtooth', 0.15); setTimeout(() => this.playTone(100, 0.5, 'sawtooth', 0.15), 200); }
  restart() { this.playTone(300, 0.1, 'square', 0.05); setTimeout(() => this.playTone(400, 0.1, 'square', 0.05), 50); }
  click() { this.playTone(500, 0.06, 'sine', 0.05); }
}
const sfx = new SFXManager();

// ==================== SCENE TRANSITION MANAGER ====================
class SceneTransitionManager {
  constructor(scene) {
    this.scene = scene;
    this.isTransitioning = false;
  }

  async transition(targetSceneKey, data = null, duration = 400) {
    if (this.isTransitioning) return;
    this.isTransitioning = true;
    
    const { width, height } = this.scene.scale;
    const cx = width / 2;
    const cy = height / 2;
    
    // Create fade overlay
    const overlay = this.scene.add.rectangle(cx, cy, width, height, 0x000000);
    overlay.setDepth(999);
    overlay.setAlpha(0);
    
    // Fade in
    await new Promise(resolve => {
      this.scene.tweens.add({
        targets: overlay,
        alpha: 1,
        duration: duration / 2,
        ease: 'Quad.easeIn',
        onComplete: resolve
      });
    });
    
    // Start new scene
    if (data) {
      this.scene.scene.start(targetSceneKey, data);
    } else {
      this.scene.scene.start(targetSceneKey);
    }
    
    // Small delay to let scene initialize
    await new Promise(resolve => this.scene.time.delayedCall(50, resolve));
    
    // Fade out
    await new Promise(resolve => {
      this.scene.tweens.add({
        targets: overlay,
        alpha: 0,
        duration: duration / 2,
        ease: 'Quad.easeOut',
        onComplete: () => {
          overlay.destroy();
          this.isTransitioning = false;
          resolve();
        }
      });
    });
  }
}

// ==================== LEVEL LAYOUTS ====================
// Phase 4: Added Vault and Training Facility levels with improved balancing
const LEVEL_LAYOUTS = [
  { name: 'Warehouse', obstacles: [{x:8,y:4},{x:9,y:4},{x:10,y:4},{x:8,y:5},{x:10,y:5},{x:8,y:6},{x:10,y:6},{x:3,y:10},{x:4,y:10},{x:14,y:8},{x:15,y:8},{x:12,y:3},{x:13,y:3},{x:6,y:8},{x:7,y:8}], guardPatrol:[{x:15,y:7},{x:5,y:7},{x:5,y:12},{x:15,y:12}], dataCore:{x:16,y:3}, keyCard:{x:3,y:12}, hackTerminal:{x:10,y:7}, playerStart:{x:2,y:2}, exitZone:{x:19,y:7}, cameras:[{x:5,y:2},{x:15,y:12}], motionSensors:[{x:8,y:7},{x:12,y:10}], laserGrids:[{x:10,y:9,h:true},{x:6,y:3,v:true}], patrolDrones:[{x:12,y:6,patrol:[{x:12,y:6},{x:16,y:6},{x:16,y:10},{x:12,y:10}]}], securityCode:{x:4,y:8}, powerCell:{x:14,y:4}, difficulty: 1 },
  { name: 'Labs', obstacles: [{x:5,y:3},{x:5,y:4},{x:5,y:5},{x:5,y:6},{x:10,y:8},{x:11,y:8},{x:12,y:8},{x:10,y:9},{x:12,y:9},{x:10,y:10},{x:11,y:10},{x:12,y:10},{x:15,y:3},{x:16,y:3},{x:17,y:3},{x:3,y:11},{x:4,y:11},{x:5,y:11},{x:8,y:13},{x:9,y:13}], guardPatrol:[{x:14,y:5},{x:6,y:5},{x:6,y:13},{x:14,y:13}], dataCore:{x:17,y:2}, keyCard:{x:2,y:3}, hackTerminal:{x:8,y:5}, playerStart:{x:2,y:13}, exitZone:{x:19,y:3}, cameras:[{x:10,y:2},{x:3,y:8}], motionSensors:[{x:12,y:6},{x:7,y:11}], laserGrids:[{x:8,y:7,h:true},{x:14,y:9,v:true}], patrolDrones:[{x:10,y:10,patrol:[{x:10,y:10},{x:14,y:10},{x:14,y:4},{x:10,y:4}]}], securityCode:{x:6,y:2}, powerCell:{x:16,y:12}, difficulty: 1 },
  { name: 'Server Farm', obstacles: [{x:4,y:3},{x:5,y:3},{x:9,y:3},{x:10,y:3},{x:4,y:5},{x:10,y:5},{x:4,y:7},{x:5,y:7},{x:9,y:7},{x:10,y:7},{x:7,y:9},{x:8,y:9},{x:3,y:11},{x:7,y:11},{x:12,y:11},{x:16,y:11},{x:3,y:13},{x:4,y:13},{x:15,y:13},{x:16,y:13}], guardPatrol:[{x:2,y:9},{x:18,y:9},{x:18,y:5},{x:2,y:5}], dataCore:{x:18,y:13}, keyCard:{x:7,y:3}, hackTerminal:{x:14,y:9}, playerStart:{x:2,y:2}, exitZone:{x:19,y:7}, cameras:[{x:2,y:5},{x:17,y:11}], motionSensors:[{x:7,y:7},{x:12,y:5}], laserGrids:[{x:6,y:5,v:true},{x:12,y:9,h:true}], patrolDrones:[{x:8,y:6,patrol:[{x:8,y:6},{x:14,y:6},{x:14,y:12},{x:8,y:12}]}], securityCode:{x:2,y:12}, powerCell:{x:18,y:3}, difficulty: 2 },
  // Phase 4: New Level 4 - The Vault (high security bank vault)
  { name: 'The Vault', obstacles: [
      {x:4,y:3},{x:5,y:3},{x:6,y:3},{x:10,y:3},{x:11,y:3},{x:12,y:3},
      {x:4,y:5},{x:12,y:5},{x:4,y:7},{x:12,y:7},
      {x:4,y:9},{x:5,y:9},{x:6,y:9},{x:10,y:9},{x:11,y:9},{x:12,y:9},
      {x:4,y:11},{x:12,y:11},{x:7,y:12},{x:8,y:12}
    ], 
    guardPatrol: [
      {x:7,y:4},{x:10,y:4},{x:10,y:8},{x:7,y:8},
      {x:2,y:6},{x:17,y:6}
    ], 
    dataCore:{x:8,y:2}, 
    keyCard:{x:2,y:13}, 
    hackTerminal:{x:15,y:6}, 
    playerStart:{x:2,y:2}, 
    exitZone:{x:18,y:7}, 
    cameras:[
      {x:8,y:1},{x:2,y:10},{x:16,y:10}
    ], 
    motionSensors:[
      {x:8,y:6},{x:14,y:4},{x:5,y:10}
    ], 
    laserGrids:[
      {x:8,y:4,h:true},{x:3,y:6,v:true},{x:13,y:6,v:true},{x:8,y:10,h:true}
    ], 
    patrolDrones:[
      {x:5,y:7,patrol:[{x:5,y:7},{x:11,y:7},{x:11,y:5},{x:5,y:5}]},
      {x:15,y:9,patrol:[{x:15,y:9},{x:15,y:3},{x:18,y:3},{x:18,y:9}]}
    ], 
    securityCode:{x:6,y:13}, 
    powerCell:{x:16,y:12}, 
    difficulty: 3 
  },
  // Phase 4: New Level 5 - Training Facility (open area with multiple threats)
  { name: 'Training Facility', obstacles: [
      {x:6,y:3},{x:7,y:3},{x:13,y:3},{x:14,y:3},
      {x:3,y:6},{x:4,y:6},{x:16,y:6},{x:17,y:6},
      {x:6,y:9},{x:7,y:9},{x:13,y:9},{x:14,y:9},
      {x:6,y:12},{x:7,y:12},{x:13,y:12},{x:14,y:12},
      {x:9,y:5},{x:10,y:5},{x:9,y:10},{x:10,y:10}
    ], 
    guardPatrol: [
      {x:2,y:4},{x:18,y:4},
      {x:2,y:11},{x:18,y:11},
      {x:10,y:2},{x:10,y:13}
    ], 
    dataCore:{x:10,y:7}, 
    keyCard:{x:2,y:13}, 
    hackTerminal:{x:17,y:7}, 
    playerStart:{x:2,y:2}, 
    exitZone:{x:18,y:2}, 
    cameras:[
      {x:5,y:2},{x:15,y:2},{x:5,y:13},{x:15,y:13}
    ], 
    motionSensors:[
      {x:10,y:4},{x:10,y:10},{x:5,y:8},{x:15,y:8}
    ], 
    laserGrids:[
      {x:10,y:3,v:true},{x:10,y:12,v:true},{x:4,y:8,h:true},{x:16,y:8,h:true}
    ], 
    patrolDrones:[
      {x:8,y:4,patrol:[{x:8,y:4},{x:12,y:4},{x:12,y:11},{x:8,y:11}]},
      {x:5,y:7,patrol:[{x:5,y:7},{x:5,y:10},{x:8,y:10},{x:8,y:7}]},
      {x:15,y:7,patrol:[{x:15,y:7},{x:15,y:10},{x:12,y:10},{x:12,y:7}]}
    ], 
    securityCode:{x:3,y:4}, 
    powerCell:{x:17,y:12}, 
    difficulty: 3 
  }
];

// ==================== PERK DEFINITIONS ====================
const PERK_INFO = {
  speed: { name: 'SPEED', costs: [0, 50, 100, 200], bonus: [0, 0.15, 0.35, 0.6] },
  stealth: { name: 'STEALTH', costs: [0, 50, 100, 200], bonus: [0, 0.2, 0.4, 0.65] },
  luck: { name: 'LUCK', costs: [0, 50, 100, 200], bonus: [0, 10, 25, 50] }
};
function getSpeedBonus() { return PERK_INFO.speed.bonus[gameSave.perks.speed]; }
function getStealthBonus() { return PERK_INFO.stealth.bonus[gameSave.perks.stealth]; }
function getLuckBonus() { return PERK_INFO.luck.bonus[gameSave.perks.luck]; }

// ==================== BOOT SCENE (Loading) ====================
class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create() {
    // Simple loading screen
    this.add.rectangle(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE, 0x0a0a0f);
    
    const title = this.add.text(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2 - 30, 'GHOSTSHIFT', { fontSize: '36px', fill: '#4488ff', fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(0.5);
    const loading = this.add.text(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2 + 20, 'Loading...', { fontSize: '14px', fill: '#666688', fontFamily: 'Courier New' }).setOrigin(0.5);
    
    // Initialize audio on first interaction
    this.input.keyboard.once('keydown', () => sfx.init());
    this.input.on('pointerdown', () => sfx.init(), this);
    
    // Auto-transition to main menu with fade
    this.time.delayedCall(800, () => {
      this.scene.start('MainMenuScene');
    });
  }
}

// ==================== MAIN MENU SCENE ====================
class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create() {
    // Animated background grid
    this.createAnimatedBackground();
    
    // Title
    this.titleText = this.add.text(MAP_WIDTH * TILE_SIZE / 2, 50, 'GHOSTSHIFT', { fontSize: '40px', fill: '#4488ff', fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(0.5);
    this.subtitleText = this.add.text(MAP_WIDTH * TILE_SIZE / 2, 85, 'Infiltrate. Hack. Escape.', { fontSize: '14px', fill: '#666688', fontFamily: 'Courier New' }).setOrigin(0.5);
    
    // Title glow animation
    this.tweens.add({
      targets: this.titleText,
      alpha: 0.8,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    
    // Stats
    if (saveManager.hasSave()) {
      this.add.text(40, 110, 'Runs: ' + saveManager.data.totalRuns + ' | Best: ' + this.formatTime(saveManager.data.bestTime), { fontSize: '12px', fill: '#888888', fontFamily: 'Courier New' });
    }
    
    // Credits
    this.creditsText = this.add.text(MAP_WIDTH * TILE_SIZE - 40, 20, 'Credits: ' + saveManager.data.credits, { fontSize: '16px', fill: '#ffaa00', fontFamily: 'Courier New' }).setOrigin(1, 0);
    
    // Buttons
    const buttonWidth = 250, buttonHeight = 45, startY = 180, spacing = 60;
    
    this.createMenuButton(MAP_WIDTH * TILE_SIZE / 2, startY, buttonWidth, buttonHeight, '▶  PLAY', 0x2244aa, 0x4488ff, () => this.transitionTo('LevelSelectScene'));
    this.createMenuButton(MAP_WIDTH * TILE_SIZE / 2, startY + spacing, buttonWidth, buttonHeight, '▣  LEVEL SELECT', 0x1a2a3a, 0x4488ff, () => this.transitionTo('LevelSelectScene'));
    
    const canContinue = saveManager.hasSave();
    const lastPlayedLevel = saveManager.getLastPlayed() ? saveManager.data.unlockedLevels[saveManager.data.unlockedLevels.length - 1] : 0;
    this.createMenuButton(MAP_WIDTH * TILE_SIZE / 2, startY + spacing * 2, buttonWidth, buttonHeight, '↻  CONTINUE', canContinue ? 0x1a3a2a : 0x1a1a1a, canContinue ? 0x44ff88 : 0x444444, () => { 
      if (canContinue) {
        this.transitionTo('GameScene', { levelIndex: lastPlayedLevel, continueRun: true }); 
      }
    }, !canContinue);
    
    this.createMenuButton(MAP_WIDTH * TILE_SIZE / 2, startY + spacing * 3, buttonWidth, buttonHeight, '⚙  SETTINGS', 0x2a2a3a, 0x8888aa, () => this.transitionTo('SettingsScene'));
    this.createMenuButton(MAP_WIDTH * TILE_SIZE / 2, startY + spacing * 4, buttonWidth, buttonHeight, '?  CONTROLS', 0x2a2a3a, 0x8888aa, () => this.showControlsOverlay());
    this.createMenuButton(MAP_WIDTH * TILE_SIZE / 2, startY + spacing * 5, buttonWidth, buttonHeight, '★  CREDITS', 0x2a2a3a, 0x8888aa, () => this.showCreditsOverlay());
    
    this.input.keyboard.once('keydown', () => sfx.init());
    this.input.on('pointerdown', () => sfx.init(), this);
  }
  
  createAnimatedBackground() {
    // Subtle animated grid background
    this.bgGraphics = this.add.graphics();
    this.bgGraphics.setDepth(-1);
    
    // Grid animation offset
    this.gridOffset = 0;
    this.gridGraphics = this.add.graphics();
    this.gridGraphics.setDepth(-2);
    
    // Animate grid lines
    this.time.addEvent({
      delay: 50,
      callback: () => {
        this.gridOffset = (this.gridOffset + 0.5) % 32;
        this.drawAnimatedGrid();
      },
      loop: true
    });
    
    // Floating particles
    this.particles = [];
    for (let i = 0; i < 15; i++) {
      const particle = this.add.circle(
        Math.random() * MAP_WIDTH * TILE_SIZE,
        Math.random() * MAP_HEIGHT * TILE_SIZE,
        2 + Math.random() * 3,
        0x4488ff,
        0.1 + Math.random() * 0.15
      );
      particle.setDepth(-1);
      particle.speedX = (Math.random() - 0.5) * 0.5;
      particle.speedY = (Math.random() - 0.5) * 0.5;
      this.particles.push(particle);
    }
    
    // Animate particles
    this.time.addEvent({
      delay: 16,
      callback: () => {
        this.particles.forEach(p => {
          p.x += p.speedX;
          p.y += p.speedY;
          if (p.x < 0) p.x = MAP_WIDTH * TILE_SIZE;
          if (p.x > MAP_WIDTH * TILE_SIZE) p.x = 0;
          if (p.y < 0) p.y = MAP_HEIGHT * TILE_SIZE;
          if (p.y > MAP_HEIGHT * TILE_SIZE) p.y = 0;
        });
      },
      loop: true
    });
  }
  
  drawAnimatedGrid() {
    this.gridGraphics.clear();
    this.gridGraphics.lineStyle(1, 0x1a1a2a, 0.4);
    
    // Vertical lines with offset
    for (let x = 0; x <= MAP_WIDTH; x++) {
      const offsetX = (x * 32 + this.gridOffset) % 32;
      this.gridGraphics.lineBetween(x * 32 - offsetX, 0, x * 32 - offsetX, MAP_HEIGHT * TILE_SIZE);
    }
    
    // Horizontal lines with offset
    for (let y = 0; y <= MAP_HEIGHT; y++) {
      const offsetY = (y * 32 + this.gridOffset) % 32;
      this.gridGraphics.lineBetween(0, y * 32 - offsetY, MAP_WIDTH * TILE_SIZE, y * 32 - offsetY);
    }
  }
  
  transitionTo(sceneKey, data = null) {
    sfx.click();
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;
    
    const overlay = this.add.rectangle(cx, cy, width, height, 0x000000);
    overlay.setDepth(100);
    overlay.setAlpha(0);
    
    this.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 200,
      ease: 'Quad.easeIn',
      onComplete: () => {
        if (data) {
          this.scene.start(sceneKey, data);
        } else {
          this.scene.start(sceneKey);
        }
        this.time.delayedCall(50, () => {
          this.tweens.add({
            targets: overlay,
            alpha: 0,
            duration: 200,
            ease: 'Quad.easeOut',
            onComplete: () => overlay.destroy()
          });
        });
      }
    });
  }
  
  createMenuButton(x, y, width, height, text, bgColor, strokeColor, onClick, disabled = false) {
    const bg = this.add.rectangle(x, y, width, height, bgColor);
    bg.setStrokeStyle(2, strokeColor);
    bg.setInteractive({ useHandCursor: !disabled });
    
    const label = this.add.text(x, y, text, { fontSize: '16px', fill: disabled ? '#444444' : '#ffffff', fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(0.5);
    
    // Hover effects
    bg.on('pointerover', () => { 
      if (!disabled) { 
        bg.setFillStyle(bgColor + 0x202020); 
        bg.setStrokeStyle(2, 0xffffff);
        sfx.menuHover(); 
      } 
    });
    
    bg.on('pointerout', () => { 
      if (!disabled) {
        bg.setFillStyle(bgColor); 
        bg.setStrokeStyle(2, strokeColor);
      }
    });
    
    bg.on('pointerdown', () => { 
      // Button press animation
      this.tweens.add({
        targets: bg,
        scaleX: 0.95,
        scaleY: 0.95,
        duration: 50,
        yoyo: true,
        onComplete: () => {
          bg.setScale(1);
        }
      });
      onClick(); 
    });
    
    return { bg, label };
  }
  
  showControlsOverlay() {
    const overlay = this.add.rectangle(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE, 0x000000, 0.9);
    overlay.setDepth(100);
    const panel = this.add.container(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2);
    panel.setDepth(101);
    const bg = this.add.rectangle(0, 0, 400, 300, 0x1a1a2a);
    bg.setStrokeStyle(2, 0x4488ff);
    panel.add(bg);
    panel.add(this.add.text(0, -120, 'CONTROLS', { fontSize: '24px', fill: '#4488ff', fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(0.5));
    const controls = [{ key: 'WASD / Arrows', action: 'Move player' }, { key: 'R', action: 'Restart level' }, { key: 'ESC', action: 'Pause game' }, { key: 'SPACE', action: 'Start game' }];
    let yOffset = -80;
    controls.forEach(c => { panel.add(this.add.text(-150, yOffset, c.key, { fontSize: '14px', fill: '#ffaa00', fontFamily: 'Courier New' }).setOrigin(0, 0.5)); panel.add(this.add.text(50, yOffset, c.action, { fontSize: '14px', fill: '#cccccc', fontFamily: 'Courier New' }).setOrigin(0, 0.5)); yOffset += 30; });
    panel.add(this.add.text(0, 110, '[ Press any key or click to close ]', { fontSize: '12px', fill: '#666688', fontFamily: 'Courier New' }).setOrigin(0.5));
    const closeHandler = () => { this.input.keyboard.off('keydown', closeHandler); this.input.off('pointerdown', closeHandler); overlay.destroy(); panel.destroy(); };
    this.input.keyboard.on('keydown', closeHandler);
    this.input.on('pointerdown', closeHandler);
  }
  
  showCreditsOverlay() {
    const overlay = this.add.rectangle(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE, 0x000000, 0.9);
    overlay.setDepth(100);
    const panel = this.add.container(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2);
    panel.setDepth(101);
    const bg = this.add.rectangle(0, 0, 400, 280, 0x1a1a2a);
    bg.setStrokeStyle(2, 0x4488ff);
    panel.add(bg);
    panel.add(this.add.text(0, -110, 'CREDITS', { fontSize: '24px', fill: '#4488ff', fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(0.5));
    const credits = [{ role: 'Developer', name: 'GhostShift Team' }, { role: 'Engine', name: 'Phaser 3' }, { role: 'Version', name: '0.4.0 (Phase 4)' }, { role: 'Levels', name: '5 Total' }];
    let yOffset = -60;
    credits.forEach(c => { panel.add(this.add.text(-120, yOffset, c.role + ':', { fontSize: '14px', fill: '#ffaa00', fontFamily: 'Courier New' }).setOrigin(0, 0.5)); panel.add(this.add.text(30, yOffset, c.name, { fontSize: '14px', fill: '#cccccc', fontFamily: 'Courier New' }).setOrigin(0, 0.5)); yOffset += 35; });
    panel.add(this.add.text(0, 100, '[ Press any key or click to close ]', { fontSize: '12px', fill: '#666688', fontFamily: 'Courier New' }).setOrigin(0.5));
    const closeHandler = () => { this.input.keyboard.off('keydown', closeHandler); this.input.off('pointerdown', closeHandler); overlay.destroy(); panel.destroy(); };
    this.input.keyboard.on('keydown', closeHandler);
    this.input.on('pointerdown', closeHandler);
  }
  
  formatTime(ms) { if (!ms) return '--:--'; const minutes = Math.floor(ms / 60000); const seconds = Math.floor((ms % 60000) / 1000); const centis = Math.floor((ms % 1000) / 10); return minutes.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0') + '.' + centis.toString().padStart(2, '0'); }
}

// ==================== LEVEL SELECT SCENE ====================
class LevelSelectScene extends Phaser.Scene {
  constructor() { super({ key: 'LevelSelectScene' }); }
  create() {
    // Background
    this.add.rectangle(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE, 0x0a0a0f);
    
    // Animated grid
    this.gridGraphics = this.add.graphics();
    this.gridOffset = 0;
    this.time.addEvent({
      delay: 50,
      callback: () => {
        this.gridOffset = (this.gridOffset + 0.3) % 32;
        this.drawGrid();
      },
      loop: true
    });
    
    this.add.text(MAP_WIDTH * TILE_SIZE / 2, 30, 'SELECT LEVEL', { fontSize: '28px', fill: '#4488ff', fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(0.5);
    
    const backBtn = this.add.text(20, 15, '< BACK', { fontSize: '14px', fill: '#888888', fontFamily: 'Courier New' }).setInteractive({ useHandCursor: true });
    backBtn.on('pointerover', () => backBtn.setFill('#ffffff'));
    backBtn.on('pointerout', () => backBtn.setFill('#888888'));
    backBtn.on('pointerdown', () => this.transitionTo('MainMenuScene'));
    
    const startY = 80, spacingY = 70;
    LEVEL_LAYOUTS.forEach((level, index) => {
      const isUnlocked = saveManager.isLevelUnlocked(index);
      const bestTime = saveManager.getBestTime(index);
      const y = startY + index * spacingY;
      const cardBg = this.add.rectangle(MAP_WIDTH * TILE_SIZE / 2, y, 400, 55, isUnlocked ? 0x1a2a3a : 0x1a1a1a);
      cardBg.setStrokeStyle(2, isUnlocked ? 0x4488ff : 0x333333);
      cardBg.setInteractive({ useHandCursor: isUnlocked });
      
      // Level number with glow
      const levelNum = this.add.text(MAP_WIDTH * TILE_SIZE / 2 - 160, y, String(index + 1), { fontSize: '20px', fill: isUnlocked ? '#4488ff' : '#444444', fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(0.5);
      if (isUnlocked) {
        this.tweens.add({
          targets: levelNum,
          alpha: 0.7,
          duration: 1000,
          yoyo: true,
          repeat: -1
        });
      }
      
      this.add.text(MAP_WIDTH * TILE_SIZE / 2 - 100, y - 10, level.name, { fontSize: '14px', fill: isUnlocked ? '#ffffff' : '#444444', fontFamily: 'Courier New' }).setOrigin(0, 0.5);
      this.add.text(MAP_WIDTH * TILE_SIZE / 2 - 100, y + 10, 'Best: ' + (bestTime ? this.formatTime(bestTime) : '--:--'), { fontSize: '11px', fill: isUnlocked ? '#888888' : '#444444', fontFamily: 'Courier New' });
      this.add.text(MAP_WIDTH * TILE_SIZE / 2 + 140, y, isUnlocked ? '▶ PLAY' : '🔒 LOCKED', { fontSize: '12px', fill: isUnlocked ? '#44ff88' : '#444444', fontFamily: 'Courier New' }).setOrigin(0.5);
      
      if (isUnlocked) {
        cardBg.on('pointerover', () => { 
          cardBg.setFillStyle(0x2a3a4a); 
          cardBg.setStrokeStyle(2, 0x66aaff);
          sfx.menuHover(); 
        });
        cardBg.on('pointerout', () => cardBg.setFillStyle(0x1a2a3a).setStrokeStyle(2, 0x4488ff));
        cardBg.on('pointerdown', () => {
          // Click animation
          this.tweens.add({
            targets: cardBg,
            scaleX: 0.98,
            scaleY: 0.98,
            duration: 50,
            yoyo: true,
            onComplete: () => {
              sfx.select();
              this.transitionTo('GameScene', { levelIndex: index });
            }
          });
        });
      }
    });
    this.input.keyboard.once('keydown', () => sfx.init());
    this.input.on('pointerdown', () => sfx.init(), this);
  }
  
  drawGrid() {
    this.gridGraphics.clear();
    this.gridGraphics.lineStyle(1, 0x1a1a2a, 0.3);
    for (let x = 0; x <= MAP_WIDTH; x++) {
      this.gridGraphics.lineBetween(x * 32, 0, x * 32, MAP_HEIGHT * TILE_SIZE);
    }
    for (let y = 0; y <= MAP_HEIGHT; y++) {
      this.gridGraphics.lineBetween(0, y * 32, MAP_WIDTH * TILE_SIZE, y * 32);
    }
  }
  
  transitionTo(sceneKey, data = null) {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;
    
    const overlay = this.add.rectangle(cx, cy, width, height, 0x000000);
    overlay.setDepth(100);
    overlay.setAlpha(0);
    
    this.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 200,
      ease: 'Quad.easeIn',
      onComplete: () => {
        if (data) {
          this.scene.start(sceneKey, data);
        } else {
          this.scene.start(sceneKey);
        }
        this.time.delayedCall(50, () => {
          this.tweens.add({
            targets: overlay,
            alpha: 0,
            duration: 200,
            ease: 'Quad.easeOut',
            onComplete: () => overlay.destroy()
          });
        });
      }
    });
  }
  
  formatTime(ms) { if (!ms) return '--:--'; const minutes = Math.floor(ms / 60000); const seconds = Math.floor((ms % 60000) / 1000); const centis = Math.floor((ms % 1000) / 10); return minutes.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0') + '.' + centis.toString().padStart(2, '0'); }
}

// ==================== SETTINGS SCENE ====================
class SettingsScene extends Phaser.Scene {
  constructor() { super({ key: 'SettingsScene' }); }
  create() {
    // Background
    this.add.rectangle(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE, 0x0a0a0f);
    
    // Animated grid
    this.gridGraphics = this.add.graphics();
    this.gridOffset = 0;
    this.time.addEvent({
      delay: 50,
      callback: () => {
        this.gridOffset = (this.gridOffset + 0.3) % 32;
        this.drawGrid();
      },
      loop: true
    });
    
    this.add.text(MAP_WIDTH * TILE_SIZE / 2, 30, 'SETTINGS', { fontSize: '28px', fill: '#4488ff', fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(0.5);
    const backBtn = this.add.text(20, 15, '< BACK', { fontSize: '14px', fill: '#888888', fontFamily: 'Courier New' }).setInteractive({ useHandCursor: true });
    backBtn.on('pointerover', () => backBtn.setFill('#ffffff'));
    backBtn.on('pointerout', () => backBtn.setFill('#888888'));
    backBtn.on('pointerdown', () => this.transitionTo('MainMenuScene'));
    
    const panelY = 90;
    const spacing = 55;
    
    // Audio Enabled toggle
    this.add.text(40, panelY, 'Audio', { fontSize: '16px', fill: '#ffffff', fontFamily: 'Courier New' });
    const audioToggle = this.add.text(MAP_WIDTH * TILE_SIZE - 100, panelY, sfx.isEnabled ? '[X] ON' : '[ ] OFF', { fontSize: '14px', fill: sfx.isEnabled ? '#44ff88' : '#ff4444', fontFamily: 'Courier New' }).setInteractive({ useHandCursor: true });
    audioToggle.on('pointerdown', () => { 
      const newState = !sfx.isEnabled; 
      sfx.setEnabled(newState); 
      audioToggle.setText(newState ? '[X] ON' : '[ ] OFF'); 
      audioToggle.setFill(newState ? '#44ff88' : '#ff4444'); 
      sfx.select(); 
    });
    
    // Master Volume slider
    const volY = panelY + spacing;
    this.add.text(40, volY, 'Master Volume', { fontSize: '16px', fill: '#ffffff', fontFamily: 'Courier New' });
    const volBarBg = this.add.rectangle(MAP_WIDTH * TILE_SIZE - 100, volY, 120, 16, 0x222233);
    const volBarFill = this.add.rectangle(MAP_WIDTH * TILE_SIZE - 160 + (sfx.volume * 60), volY, sfx.volume * 120, 12, 0x4488ff);
    const volDown = this.add.text(MAP_WIDTH * TILE_SIZE - 180, volY, '[-]', { fontSize: '14px', fill: '#888888', fontFamily: 'Courier New' }).setInteractive({ useHandCursor: true });
    const volUp = this.add.text(MAP_WIDTH * TILE_SIZE - 40, volY, '[+]', { fontSize: '14px', fill: '#888888', fontFamily: 'Courier New' }).setInteractive({ useHandCursor: true });
    const updateVolDisplay = () => { volBarFill.width = sfx.volume * 120; volBarFill.x = MAP_WIDTH * TILE_SIZE - 160 + (sfx.volume * 60); };
    volDown.on('pointerdown', () => { sfx.setMasterVolume(sfx.volume - 0.1); updateVolDisplay(); sfx.select(); });
    volUp.on('pointerdown', () => { sfx.setMasterVolume(sfx.volume + 0.1); updateVolDisplay(); sfx.select(); });
    
    // Effects Quality
    const qualY = volY + spacing;
    this.add.text(40, qualY, 'Effects Quality', { fontSize: '16px', fill: '#ffffff', fontFamily: 'Courier New' });
    const currentQuality = saveManager.getSetting('effectsQuality') || 'high';
    const qualityBtn = this.add.text(MAP_WIDTH * TILE_SIZE - 100, qualY, currentQuality.toUpperCase(), { fontSize: '14px', fill: '#ffaa00', fontFamily: 'Courier New' }).setInteractive({ useHandCursor: true });
    const qualities = ['low', 'medium', 'high'];
    let qualIndex = qualities.indexOf(currentQuality);
    qualityBtn.on('pointerdown', () => { 
      qualIndex = (qualIndex + 1) % qualities.length; 
      const newQual = qualities[qualIndex];
      saveManager.setSetting('effectsQuality', newQual);
      qualityBtn.setText(newQual.toUpperCase());
      sfx.select();
    });
    
    // Fullscreen toggle
    const fullY = qualY + spacing;
    this.add.text(40, fullY, 'Fullscreen', { fontSize: '16px', fill: '#ffffff', fontFamily: 'Courier New' });
    const isFullscreen = saveManager.getSetting('fullscreen') || false;
    const fullToggle = this.add.text(MAP_WIDTH * TILE_SIZE - 100, fullY, isFullscreen ? '[X] ON' : '[ ] OFF', { fontSize: '14px', fill: isFullscreen ? '#44ff88' : '#ff4444', fontFamily: 'Courier New' }).setInteractive({ useHandCursor: true });
    fullToggle.on('pointerdown', () => { 
      const newState = !saveManager.getSetting('fullscreen');
      saveManager.setSetting('fullscreen', newState);
      fullToggle.setText(newState ? '[X] ON' : '[ ] OFF');
      fullToggle.setFill(newState ? '#44ff88' : '#ff4444');
      // Apply fullscreen
      if (newState) {
        this.scale.startFullscreen();
      } else {
        this.scale.stopFullscreen();
      }
      sfx.select();
    });
    
    // Reduced Motion toggle
    const motionY = fullY + spacing;
    this.add.text(40, motionY, 'Reduced Motion', { fontSize: '16px', fill: '#ffffff', fontFamily: 'Courier New' });
    const reducedMotion = saveManager.getSetting('reducedMotion') || false;
    const motionToggle = this.add.text(MAP_WIDTH * TILE_SIZE - 100, motionY, reducedMotion ? '[X] ON' : '[ ] OFF', { fontSize: '14px', fill: reducedMotion ? '#44ff88' : '#ff4444', fontFamily: 'Courier New' }).setInteractive({ useHandCursor: true });
    motionToggle.on('pointerdown', () => { 
      const newState = !saveManager.getSetting('reducedMotion');
      saveManager.setSetting('reducedMotion', newState);
      motionToggle.setText(newState ? '[X] ON' : '[ ] OFF');
      motionToggle.setFill(newState ? '#44ff88' : '#ff4444');
      sfx.select();
    });
    
    // Reset Progress
    const resetY = motionY + spacing + 20;
    this.add.text(40, resetY, 'Reset Progress', { fontSize: '16px', fill: '#ffffff', fontFamily: 'Courier New' });
    const resetBtn = this.add.text(MAP_WIDTH * TILE_SIZE - 100, resetY, '[RESET]', { fontSize: '14px', fill: '#ff4444', fontFamily: 'Courier New' }).setInteractive({ useHandCursor: true });
    resetBtn.on('pointerover', () => resetBtn.setFill('#ff6666'));
    resetBtn.on('pointerout', () => resetBtn.setFill('#ff4444'));
    resetBtn.on('pointerdown', () => { 
      if (confirm('Are you sure you want to reset all progress? This cannot be undone.')) { 
        saveManager.resetSave(); 
        sfx.fail(); 
        this.transitionTo('BootScene'); 
      } 
    });
    
    this.add.text(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE - 30, 'GhostShift v0.4.0 - Phase 4', { fontSize: '12px', fill: '#444455', fontFamily: 'Courier New' }).setOrigin(0.5);
    this.input.keyboard.once('keydown', () => sfx.init());
    this.input.on('pointerdown', () => sfx.init(), this);
  }
  
  drawGrid() {
    this.gridGraphics.clear();
    this.gridGraphics.lineStyle(1, 0x1a1a2a, 0.3);
    for (let x = 0; x <= MAP_WIDTH; x++) {
      this.gridGraphics.lineBetween(x * 32, 0, x * 32, MAP_HEIGHT * TILE_SIZE);
    }
    for (let y = 0; y <= MAP_HEIGHT; y++) {
      this.gridGraphics.lineBetween(0, y * 32, MAP_WIDTH * TILE_SIZE, y * 32);
    }
  }
  
  transitionTo(sceneKey) {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;
    
    const overlay = this.add.rectangle(cx, cy, width, height, 0x000000);
    overlay.setDepth(100);
    overlay.setAlpha(0);
    
    this.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 200,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.scene.start(sceneKey);
        this.time.delayedCall(50, () => {
          this.tweens.add({
            targets: overlay,
            alpha: 0,
            duration: 200,
            ease: 'Quad.easeOut',
            onComplete: () => overlay.destroy()
          });
        });
      }
    });
  }
}

// ==================== RESULTS SCENE ====================
class ResultsScene extends Phaser.Scene {
  constructor() { super({ key: 'ResultsScene' }); }
  
  init(data) {
    this.resultData = data || {};
    this.levelIndex = this.resultData.levelIndex || 0;
    this.success = this.resultData.success || false;
    this.time = this.resultData.time || 0;
    this.credits = this.resultData.credits || 0;
  }

  create() {
    // Background
    this.add.rectangle(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE, 0x0a0a0f);
    
    // Particles for win/lose
    this.createResultParticles();
    
    const titleText = this.success ? 'MISSION COMPLETE!' : 'MISSION FAILED';
    const titleColor = this.success ? '#00ff88' : '#ff4444';
    const title = this.add.text(MAP_WIDTH * TILE_SIZE / 2, 60, titleText, { fontSize: '32px', fill: titleColor, fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(0.5);
    
    // Title animation
    title.setAlpha(0);
    title.setScale(0.5);
    this.tweens.add({
      targets: title,
      alpha: 1,
      scale: 1,
      duration: 400,
      ease: 'Back.easeOut'
    });
    
    // Stats panel
    const statsY = 120;
    if (this.success) {
      const creditsText = this.add.text(MAP_WIDTH * TILE_SIZE / 2, statsY, '+' + this.credits + ' Credits', { fontSize: '20px', fill: '#ffaa00', fontFamily: 'Courier New' }).setOrigin(0.5);
      const timeText = this.add.text(MAP_WIDTH * TILE_SIZE / 2, statsY + 30, 'Time: ' + this.formatTime(this.time), { fontSize: '16px', fill: '#888888', fontFamily: 'Courier New' }).setOrigin(0.5);
      
      // Best time for this level
      const bestTime = saveManager.getBestTime(this.levelIndex);
      const bestText = this.add.text(MAP_WIDTH * TILE_SIZE / 2, statsY + 55, 'Best: ' + this.formatTime(bestTime), { fontSize: '14px', fill: '#4488ff', fontFamily: 'Courier New' }).setOrigin(0.5);
      
      // Animate stats
      [creditsText, timeText, bestText].forEach((t, i) => {
        t.setAlpha(0);
        t.setY(t.y + 20);
        this.tweens.add({
          targets: t,
          alpha: 1,
          y: t.y - 20,
          duration: 300,
          delay: 200 + i * 100,
          ease: 'Quad.easeOut'
        });
      });
    } else {
      const detectText = this.add.text(MAP_WIDTH * TILE_SIZE / 2, statsY, 'You were detected!', { fontSize: '16px', fill: '#ff4444', fontFamily: 'Courier New' }).setOrigin(0.5);
      const retryText = this.add.text(MAP_WIDTH * TILE_SIZE / 2, statsY + 30, 'Press R to retry', { fontSize: '14px', fill: '#888888', fontFamily: 'Courier New' }).setOrigin(0.5);
      
      // Animate failure text
      [detectText, retryText].forEach((t, i) => {
        t.setAlpha(0);
        this.tweens.add({
          targets: t,
          alpha: 1,
          duration: 300,
          delay: 200 + i * 100
        });
      });
    }
    
    // Buttons
    const buttonY = 230;
    const buttonWidth = 180;
    const buttonHeight = 40;
    const spacing = 55;
    
    // Retry button
    this.createButton(MAP_WIDTH * TILE_SIZE / 2 - spacing - 10, buttonY, buttonWidth, buttonHeight, '↻ RETRY', 0x2244aa, 0x4488ff, () => {
      sfx.select();
      this.transitionTo('GameScene', { levelIndex: this.levelIndex });
    });
    
    // Next Level button (only if success and next level exists)
    const nextLevelExists = this.success && this.levelIndex < LEVEL_LAYOUTS.length - 1;
    const isNextUnlocked = nextLevelExists && saveManager.isLevelUnlocked(this.levelIndex + 1);
    if (this.success && nextLevelExists) {
      this.createButton(MAP_WIDTH * TILE_SIZE / 2 + spacing + 10, buttonY, buttonWidth, buttonHeight, 'NEXT ▶', 0x1a4a2a, isNextUnlocked ? 0x44ff88 : 0x444444, () => {
        if (isNextUnlocked) {
          sfx.select();
          this.transitionTo('GameScene', { levelIndex: this.levelIndex + 1 });
        }
      }, !isNextUnlocked);
    } else if (this.success) {
      // Show "All Complete" if last level
      this.add.text(MAP_WIDTH * TILE_SIZE / 2 + spacing + 10, buttonY, 'COMPLETE!', { fontSize: '14px', fill: '#ffaa00', fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(0.5);
    }
    
    // Level Select button
    const menuY = buttonY + spacing;
    this.createButton(MAP_WIDTH * TILE_SIZE / 2 - spacing - 10, menuY, buttonWidth, buttonHeight, '▣ LEVELS', 0x2a2a3a, 0x8888aa, () => {
      sfx.select();
      this.transitionTo('LevelSelectScene');
    });
    
    // Main Menu button
    this.createButton(MAP_WIDTH * TILE_SIZE / 2 + spacing + 10, menuY, buttonWidth, buttonHeight, '⌂ MENU', 0x2a2a3a, 0x8888aa, () => {
      sfx.select();
      this.transitionTo('MainMenuScene');
    });
    
    // Keyboard shortcuts
    this.add.text(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE - 30, '[R] Retry | [ESC] Menu', { fontSize: '12px', fill: '#444455', fontFamily: 'Courier New' }).setOrigin(0.5);
    
    this.input.keyboard.on('keydown-R', () => {
      sfx.select();
      this.transitionTo('GameScene', { levelIndex: this.levelIndex });
    });
    this.input.keyboard.on('keydown-ESC', () => {
      sfx.select();
      this.transitionTo('MainMenuScene');
    });
    this.input.keyboard.once('keydown', () => sfx.init());
    this.input.on('pointerdown', () => sfx.init(), this);
  }
  
  createResultParticles() {
    // Create particles for win/lose effect
    this.resultParticles = [];
    const particleCount = this.success ? 30 : 20;
    const colors = this.success ? [0x00ff88, 0x44ffaa, 0x88ffcc, 0xffaa00] : [0xff4444, 0xff6644, 0xff2222];
    
    for (let i = 0; i < particleCount; i++) {
      const x = Math.random() * MAP_WIDTH * TILE_SIZE;
      const y = Math.random() * MAP_HEIGHT * TILE_SIZE;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const particle = this.add.circle(x, y, 2 + Math.random() * 4, color, 0.3 + Math.random() * 0.4);
      particle.speedX = (Math.random() - 0.5) * 2;
      particle.speedY = -1 - Math.random() * 2;
      particle.life = 1;
      particle.decay = 0.005 + Math.random() * 0.01;
      this.resultParticles.push(particle);
    }
    
    // Animate particles
    this.time.addEvent({
      delay: 16,
      callback: () => {
        this.resultParticles.forEach(p => {
          p.x += p.speedX;
          p.y += p.speedY;
          p.life -= p.decay;
          p.setAlpha(p.life * 0.5);
          
          if (p.life <= 0 || p.y < 0) {
            p.x = Math.random() * MAP_WIDTH * TILE_SIZE;
            p.y = MAP_HEIGHT * TILE_SIZE + 10;
            p.life = 1;
          }
        });
      },
      loop: true
    });
  }
  
  transitionTo(sceneKey, data = null) {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;
    
    const overlay = this.add.rectangle(cx, cy, width, height, 0x000000);
    overlay.setDepth(100);
    overlay.setAlpha(0);
    
    this.tweens.add({
      targets: overlay,
      alpha: 1,
      duration: 200,
      ease: 'Quad.easeIn',
      onComplete: () => {
        if (data) {
          this.scene.start(sceneKey, data);
        } else {
          this.scene.start(sceneKey);
        }
        this.time.delayedCall(50, () => {
          this.tweens.add({
            targets: overlay,
            alpha: 0,
            duration: 200,
            ease: 'Quad.easeOut',
            onComplete: () => overlay.destroy()
          });
        });
      }
    });
  }
  
  createButton(x, y, width, height, text, bgColor, strokeColor, onClick, disabled = false) {
    const bg = this.add.rectangle(x, y, width, height, disabled ? 0x1a1a1a : bgColor);
    bg.setStrokeStyle(2, disabled ? 0x333333 : strokeColor);
    bg.setInteractive({ useHandCursor: !disabled });
    const label = this.add.text(x, y, text, { fontSize: '14px', fill: disabled ? '#444444' : '#ffffff', fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(0.5);
    
    // Enhanced hover effects
    bg.on('pointerover', () => { 
      if (!disabled) { 
        bg.setFillStyle(bgColor + 0x202020); 
        bg.setStrokeStyle(2, 0xffffff);
        sfx.menuHover(); 
      } 
    });
    bg.on('pointerout', () => { 
      if (!disabled) {
        bg.setFillStyle(bgColor); 
        bg.setStrokeStyle(2, strokeColor);
      }
    });
    bg.on('pointerdown', () => {
      // Button press animation
      this.tweens.add({
        targets: bg,
        scaleX: 0.95,
        scaleY: 0.95,
        duration: 50,
        yoyo: true,
        onComplete: () => {
          bg.setScale(1);
        }
      });
      onClick();
    });
    return { bg, label };
  }
  
  formatTime(ms) { if (!ms) return '--:--'; const minutes = Math.floor(ms / 60000); const seconds = Math.floor((ms % 60000) / 1000); const centis = Math.floor((ms % 1000) / 10); return minutes.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0') + '.' + centis.toString().padStart(2, '0'); }
}

// ==================== GAME SCENE ====================
class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
    this.requestedLevelIndex = null;
  }
  
  init(data) {
    this.requestedLevelIndex = data?.levelIndex ?? null;
    this.continueRun = data?.continueRun ?? false;
  }

  // Manual restart method for testing
  manualRestart() {
    this._restarted = true;
    this.scene.restart();
  }
  
  create() {
    // Initialize instance variables
    this.player = null; this.guard = null; this.ghost = null;
    this.scannerDrone = null; this.cameras = []; this.motionSensors = [];
    this.dataCore = null; this.keyCard = null; this.hackTerminal = null; this.exitZone = null;
    this.cursors = null; this.wasd = null;
    this.timerText = null; this.runText = null; this.objectiveText = null;
    this.statusText = null; this.creditsText = null; this.perksText = null;
    this.elapsedTime = 0; this.isRunning = false; this.isPaused = false;
    this.isDetected = false; this.hasDataCore = false; this.hasKeyCard = false; this.isHacking = false; this.hackProgress = 0;
    this.currentRun = []; this.previousRun = null; this.ghostFrame = 0;
    this.guardPatrolPoints = []; this.currentPatrolIndex = 0; this.guardAngle = 0;
    this.visionGraphics = null; this.walls = null;
    this.scannerAngle = 0; this.applySpeedBoost = false; this.applyStealth = false;
    this.hasWon = false;
    this._restarted = false;
    
    // Set up keyboard handlers - must be set up immediately
    this.cursors = this.input.keyboard.createCursorKeys();
    this.rKey = this.input.keyboard.addKeys({ r: Phaser.Input.Keyboard.KeyCodes.R });
    
    // Listen to keyboard at document level using Phaser's global keyboard
    this.input.keyboard.on('keydown', (event) => {
      if (event.code === 'KeyR' || event.key === 'r' || event.key === 'R') {
        this._restarted = true;
        this.scene.restart();
      }
    });
    
    this.input.keyboard.once('keydown', () => sfx.init());
    this.input.on('pointerdown', () => sfx.init(), this);
    this.applySpeedBoost = saveManager.getPerkLevel('speed') > 0;
    this.applyStealth = saveManager.getPerkLevel('stealth') > 0;
    this.currentLevelIndex = this.requestedLevelIndex !== null ? this.requestedLevelIndex : Math.floor(Math.random() * LEVEL_LAYOUTS.length);
    this.currentLayout = LEVEL_LAYOUTS[this.currentLevelIndex];
    // Phase 4: Get difficulty settings for this level
    this.levelDifficulty = this.currentLayout.difficulty || 1;
    this.currentGuardSpeed = getGuardSpeedForLevel(this.levelDifficulty);
    this.currentVisionDistance = getVisionConeDistanceForLevel(this.levelDifficulty);
    this.currentVisionAngle = getVisionConeAngleForLevel(this.levelDifficulty);
    this.currentMotionCooldown = getMotionSensorCooldownForLevel(this.levelDifficulty);
    this.createMap();
    this.createEntities();
    this.createUI();
    this.createPauseMenu();
    // Vignette effect for atmosphere (using a large soft-edged circle approach via gradient simulation)
    this.vignette = this.add.graphics();
    const vignetteSize = Math.max(MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE) * 0.8;
    this.vignette.fillStyle(0x000000, 0.3);
    // Draw corners as approximate vignette
    this.vignette.fillRect(0, 0, MAP_WIDTH * TILE_SIZE, 40);
    this.vignette.fillRect(0, MAP_HEIGHT * TILE_SIZE - 40, MAP_WIDTH * TILE_SIZE, 40);
    this.vignette.fillRect(0, 0, 40, MAP_HEIGHT * TILE_SIZE);
    this.vignette.fillRect(MAP_WIDTH * TILE_SIZE - 40, 0, 40, MAP_HEIGHT * TILE_SIZE);
    this.isRunning = true;
    this.currentRun = [];
    this.time.addEvent({ delay: 50, callback: this.recordFrame, callbackScope: this, loop: true });
  }

  createEntities() {
    const startPos = this.currentLayout.playerStart;
    // Player with glow effect
    this.playerGlow = this.add.circle(startPos.x * TILE_SIZE, startPos.y * TILE_SIZE, TILE_SIZE / 2 + 4, 0x00ffff, 0.15);
    this.player = this.add.rectangle(startPos.x * TILE_SIZE, startPos.y * TILE_SIZE, TILE_SIZE - 8, TILE_SIZE - 8, 0x00d4ff);
    this.player.setStrokeStyle(2, 0x00ffff);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);
    // Player movement trail
    this.playerTrail = this.add.graphics();
    this.playerTrailPoints = [];

    // Guard with menacing glow
    this.guardGlow = this.add.circle(TILE_SIZE * 15, TILE_SIZE * 7, TILE_SIZE / 2 + 4, 0xff3344, 0.15);
    this.guard = this.add.rectangle(TILE_SIZE * 15, TILE_SIZE * 7, TILE_SIZE - 8, TILE_SIZE - 8, 0xff3344);
    this.guard.setStrokeStyle(2, 0xff6655);
    this.physics.add.existing(this.guard);
    this.guard.body.setCollideWorldBounds(true);
    this.guardPatrolPoints = this.currentLayout.guardPatrol.map(p => ({ x: p.x * TILE_SIZE, y: p.y * TILE_SIZE }));

    this.createScannerDrone();
    this.createCameras();
    this.createMotionSensors();
    this.createLaserGrids();
    this.createPatrolDrones();
    this.createVisionCone();

    const dcPos = this.currentLayout.dataCore;
    this.dataCore = this.add.rectangle(dcPos.x * TILE_SIZE, dcPos.y * TILE_SIZE, TILE_SIZE - 4, TILE_SIZE - 4, 0xffaa00);
    this.dataCore.setStrokeStyle(2, 0xffdd44);
    this.physics.add.existing(this.dataCore, true);
    this.tweens.add({ targets: this.dataCore, alpha: 0.6, duration: 500, yoyo: true, repeat: -1 });

    const kcPos = this.currentLayout.keyCard;
    this.keyCard = this.add.rectangle(kcPos.x * TILE_SIZE, kcPos.y * TILE_SIZE, TILE_SIZE - 8, TILE_SIZE - 8, 0x00aaff);
    this.keyCard.setStrokeStyle(2, 0x66ddff);
    this.physics.add.existing(this.keyCard, true);
    this.tweens.add({ targets: this.keyCard, alpha: 0.5, duration: 300, yoyo: true, repeat: -1 });

    const htPos = this.currentLayout.hackTerminal;
    this.hackTerminal = this.add.rectangle(htPos.x * TILE_SIZE, htPos.y * TILE_SIZE, TILE_SIZE, TILE_SIZE, 0x00ff88);
    this.hackTerminal.setStrokeStyle(2, 0x88ffbb);
    this.physics.add.existing(this.hackTerminal, true);
    this.hackTerminalArea = this.add.zone(htPos.x * TILE_SIZE, htPos.y * TILE_SIZE, TILE_SIZE * 2, TILE_SIZE * 2);

    // New objectives: Security Code and Power Cell
    this.hasSecurityCode = false;
    this.hasPowerCell = false;
    
    if (this.currentLayout.securityCode) {
      const scPos = this.currentLayout.securityCode;
      this.securityCode = this.add.rectangle(scPos.x * TILE_SIZE, scPos.y * TILE_SIZE, TILE_SIZE - 8, TILE_SIZE - 8, 0x00ffff);
      this.securityCode.setStrokeStyle(2, 0x88ffff);
      this.physics.add.existing(this.securityCode, true);
      this.tweens.add({ targets: this.securityCode, alpha: 0.5, duration: 400, yoyo: true, repeat: -1 });
    }
    
    if (this.currentLayout.powerCell) {
      const pcPos = this.currentLayout.powerCell;
      this.powerCell = this.add.rectangle(pcPos.x * TILE_SIZE, pcPos.y * TILE_SIZE, TILE_SIZE - 8, TILE_SIZE - 8, 0xff00ff);
      this.powerCell.setStrokeStyle(2, 0xff88ff);
      this.physics.add.existing(this.powerCell, true);
      this.tweens.add({ targets: this.powerCell, alpha: 0.5, duration: 350, yoyo: true, repeat: -1 });
    }

    const exitPos = this.currentLayout.exitZone;
    // Exit zone with glow
    this.exitZoneGlow = this.add.rectangle(exitPos.x * TILE_SIZE, exitPos.y * TILE_SIZE, TILE_SIZE * 2 + 10, TILE_SIZE * 3 + 10, 0x222222, 0.3);
    this.exitZone = this.add.rectangle(exitPos.x * TILE_SIZE, exitPos.y * TILE_SIZE, TILE_SIZE * 2, TILE_SIZE * 3, 0x222222, 0.5);
    this.exitZone.setStrokeStyle(2, 0x444455);
    this.physics.add.existing(this.exitZone, true);
    this.exitText = this.add.text(exitPos.x * TILE_SIZE, exitPos.y * TILE_SIZE, 'LOCKED', { fontSize: '12px', fill: '#ff4444', fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(0.5);

    this.ghost = this.add.rectangle(-100, -100, TILE_SIZE - 8, TILE_SIZE - 8, 0x44ffaa);
    this.ghost.setAlpha(GHOST_ALPHA);
    this.ghost.setStrokeStyle(2, 0x66ffbb);
    this.physics.add.existing(this.ghost);
    this.ghost.body.setCollideWorldBounds(true);
    this.ghost.setVisible(false);
    // Ghost trail effect
    this.ghostTrail = this.add.graphics();

    this.physics.add.collider(this.player, this.walls);
    this.physics.add.collider(this.guard, this.walls);
    this.physics.add.collider(this.scannerDrone, this.walls);
    this.physics.add.overlap(this.player, this.dataCore, this.collectDataCore, null, this);
    this.physics.add.overlap(this.player, this.keyCard, this.collectKeyCard, null, this);
    this.physics.add.overlap(this.player, this.hackTerminalArea, this.startHack, null, this);
    this.physics.add.overlap(this.player, this.exitZone, this.reachExit, null, this);
    if (this.securityCode) this.physics.add.overlap(this.player, this.securityCode, this.collectSecurityCode, null, this);
    if (this.powerCell) this.physics.add.overlap(this.player, this.powerCell, this.collectPowerCell, null, this);
    this.physics.add.overlap(this.player, this.exitZone, this.reachExit, null, this);
    
    // Laser grid collision (instant detection)
    this.laserGrids.forEach(grid => {
      this.physics.add.overlap(this.player, grid.body, () => this.detected(), null, this);
    });
    
    // Patrol drone collision
    this.patrolDrones.forEach(drone => {
      this.physics.add.overlap(this.player, drone.body, () => this.detected(), null, this);
    });

    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({ up: Phaser.Input.Keyboard.KeyCodes.W, down: Phaser.Input.Keyboard.KeyCodes.S, left: Phaser.Input.Keyboard.KeyCodes.A, right: Phaser.Input.Keyboard.KeyCodes.D });
    this.input.keyboard.on('keydown-ESC', () => this.togglePause());
  }
  
  createLaserGrids() {
    this.laserGrids = [];
    if (!this.currentLayout.laserGrids) return;
    this.currentLayout.laserGrids.forEach(pos => {
      const isHorizontal = pos.h;
      const laser = {
        x: pos.x * TILE_SIZE,
        y: pos.y * TILE_SIZE,
        horizontal: isHorizontal,
        graphics: this.add.graphics(),
        body: this.add.rectangle(pos.x * TILE_SIZE, pos.y * TILE_SIZE, isHorizontal ? TILE_SIZE * 3 : TILE_SIZE/2, isHorizontal ? TILE_SIZE/2 : TILE_SIZE * 3, 0xff0000, 0.8)
      };
      this.physics.add.existing(laser.body, true);
      this.laserGrids.push(laser);
    });
  }
  
  createPatrolDrones() {
    this.patrolDrones = [];
    if (!this.currentLayout.patrolDrones) return;
    this.currentLayout.patrolDrones.forEach(config => {
      const drone = this.add.rectangle(config.x * TILE_SIZE, config.y * TILE_SIZE, TILE_SIZE - 6, TILE_SIZE - 6, 0xff00ff);
      drone.setStrokeStyle(2, 0xff88ff);
      this.physics.add.existing(drone);
      drone.body.setCollideWorldBounds(true);
      
      const patrolPoints = config.patrol.map(p => ({ x: p.x * TILE_SIZE, y: p.y * TILE_SIZE }));
      this.patrolDrones.push({
        body: drone,
        patrolPoints: patrolPoints,
        patrolIndex: 0,
        speed: 60
      });
    });
  }

  collectSecurityCode(player, securityCode) {
    this.hasSecurityCode = true;
    securityCode.destroy();
    sfx.pickup();
    if (this.objectiveText4) {
      this.objectiveText4.setText('[+] Security Code');
      this.objectiveText4.setFill('#00ffff');
    }
    this.updateExitStatus();
  }
  
  collectPowerCell(player, powerCell) {
    this.hasPowerCell = true;
    powerCell.destroy();
    sfx.pickup();
    if (this.objectiveText5) {
      this.objectiveText5.setText('[+] Power Cell');
      this.objectiveText5.setFill('#ff00ff');
    }
  }

  createScannerDrone() {
    this.scannerDrone = this.add.circle(10 * TILE_SIZE, 10 * TILE_SIZE, TILE_SIZE / 2, 0x9900ff);
    this.scannerDrone.setStrokeStyle(2, 0xcc66ff);
    this.physics.add.existing(this.scannerDrone);
    this.scannerDrone.body.setCollideWorldBounds(true);
    this.scannerDrone.body.setImmovable(true);
    this.scannerDronePatrolPoints = [{ x: 10, y: 10 }, { x: 14, y: 10 }, { x: 14, y: 6 }, { x: 10, y: 6 }].map(p => ({ x: p.x * TILE_SIZE, y: p.y * TILE_SIZE }));
    this.scannerPatrolIndex = 0;
    this.scannerAngle = 0;
    this.scannerBeam = this.add.graphics();
  }

  createCameras() {
    this.cameras = [];
    this.currentLayout.cameras.forEach(pos => {
      const cam = { x: pos.x * TILE_SIZE, y: pos.y * TILE_SIZE, angle: 0, rotationSpeed: 0.015, visionDistance: 130, graphics: this.add.graphics(), body: this.add.rectangle(pos.x * TILE_SIZE, pos.y * TILE_SIZE, TILE_SIZE - 4, TILE_SIZE - 4, 0xff6600) };
      cam.body.setStrokeStyle(2, 0xffaa66);
      this.physics.add.existing(cam.body, true);
      this.cameras.push(cam);
    });
  }

  createMotionSensors() {
    this.motionSensors = [];
    this.currentLayout.motionSensors.forEach(pos => {
      const sensor = { x: pos.x * TILE_SIZE, y: pos.y * TILE_SIZE, detectionRadius: 60, cooldown: 0, graphics: this.add.graphics(), body: this.add.circle(pos.x * TILE_SIZE, pos.y * TILE_SIZE, TILE_SIZE / 3, 0xff0066) };
      sensor.body.setStrokeStyle(1, 0xff3388);
      this.physics.add.existing(sensor.body, true);
      this.motionSensors.push(sensor);
    });
  }

  createVisionCone() { this.visionGraphics = this.add.graphics(); }

  createUI() {
    this.timerText = this.add.text(10, 10, '00:00.00', { fontSize: '20px', fill: '#00ffaa', fontFamily: 'Courier New' });
    this.creditsText = this.add.text(10, 35, 'Credits: ' + saveManager.data.credits, { fontSize: '12px', fill: '#ffaa00', fontFamily: 'Courier New' });
    this.runText = this.add.text(10, 55, 'Run: ' + this.runCount, { fontSize: '12px', fill: '#888888', fontFamily: 'Courier New' });
    this.levelText = this.add.text(10, 70, 'Level: ' + this.currentLayout.name, { fontSize: '12px', fill: '#8888ff', fontFamily: 'Courier New' });
    this.objectiveText = this.add.text(10, 90, '[O] Key Card', { fontSize: '12px', fill: '#00aaff', fontFamily: 'Courier New' });
    this.objectiveText2 = this.add.text(10, 105, '[O] Hack Terminal', { fontSize: '12px', fill: '#00ff88', fontFamily: 'Courier New' });
    this.objectiveText3 = this.add.text(10, 120, '[O] Data Core', { fontSize: '12px', fill: '#ffaa00', fontFamily: 'Courier New' });
    // Phase 4: Additional objectives
    this.objectiveText4 = this.add.text(10, 135, '[O] Security Code', { fontSize: '12px', fill: '#00ffff', fontFamily: 'Courier New' });
    this.objectiveText5 = this.add.text(10, 150, '[O] Power Cell', { fontSize: '12px', fill: '#ff00ff', fontFamily: 'Courier New' });
    this.statusText = this.add.text(10, 170, 'Find the Key Card!', { fontSize: '11px', fill: '#666666', fontFamily: 'Courier New' });
    this.perksText = this.add.text(10, 185, 'Perks: S' + gameSave.perks.speed + '/L' + gameSave.perks.luck + '/St' + gameSave.perks.stealth, { fontSize: '10px', fill: '#666666', fontFamily: 'Courier New' });
    // Phase 4: Add difficulty indicator
    this.difficultyText = this.add.text(MAP_WIDTH * TILE_SIZE - 10, 10, 'DIFF: ' + this.levelDifficulty, { fontSize: '12px', fill: this.levelDifficulty >= 3 ? '#ff4444' : '#44ff88', fontFamily: 'Courier New' }).setOrigin(1, 0);
    this.add.text(10, MAP_HEIGHT * TILE_SIZE - 25, 'ARROWS/WASD: Move | R: Restart | ESC: Pause', { fontSize: '10px', fill: '#444455', fontFamily: 'Courier New' });
  }

  createPauseMenu() {
    this.pauseOverlay = this.add.rectangle(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE, 0x000000, 0);
    this.pauseOverlay.setDepth(100);
    this.pauseOverlay.setVisible(false);
    this.pauseMenu = this.add.container(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2);
    this.pauseMenu.setDepth(101);
    this.pauseMenu.setVisible(false);
    this.pauseMenu.setAlpha(0);
    const bg = this.add.rectangle(0, 0, 250, 200, 0x1a1a2a, 0.95);
    bg.setStrokeStyle(2, 0x4488ff);
    const title = this.add.text(0, -80, 'PAUSED', { fontSize: '24px', fill: '#4488ff', fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(0.5);
    const audioBtn = this.add.text(0, -30, sfx.enabled ? '[X] Audio ON' : '[ ] Audio OFF', { fontSize: '14px', fill: '#ffffff', fontFamily: 'Courier New' }).setOrigin(0.5);
    audioBtn.setInteractive({ useHandCursor: true });
    audioBtn.on('pointerdown', () => { sfx.setEnabled(!sfx.enabled); audioBtn.setText(sfx.enabled ? '[X] Audio ON' : '[ ] Audio OFF'); sfx.select(); });
    const resumeBtn = this.add.text(0, 20, 'Resume [ESC]', { fontSize: '14px', fill: '#ffffff', fontFamily: 'Courier New' }).setOrigin(0.5);
    resumeBtn.setInteractive({ useHandCursor: true });
    resumeBtn.on('pointerdown', () => this.togglePause());
    const quitBtn = this.add.text(0, 60, 'Main Menu [M]', { fontSize: '12px', fill: '#888888', fontFamily: 'Courier New' }).setOrigin(0.5);
    quitBtn.setInteractive({ useHandCursor: true });
    quitBtn.on('pointerdown', () => this.scene.start('BootScene'));
    this.pauseMenu.add([bg, title, audioBtn, resumeBtn, quitBtn]);
  }

  togglePause() {
    if (this.isDetected) return;
    sfx.pause();
    this.isPaused = !this.isPaused;
    if (this.isPaused) {
      this.physics.pause();
      this.pauseOverlay.setVisible(true);
      this.pauseOverlay.setAlpha(0.7);
      this.pauseMenu.setVisible(true);
      this.tweens.add({ targets: this.pauseMenu, alpha: 1, duration: 200 });
    } else {
      this.physics.resume();
      this.tweens.add({ targets: this.pauseMenu, alpha: 0, duration: 200, onComplete: () => { this.pauseMenu.setVisible(false); } });
      this.pauseOverlay.setAlpha(0);
      this.pauseOverlay.setVisible(false);
    }
  }

  createMap() {
    // Deep background layer
    this.add.rectangle(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE, 0x0d0d15);
    
    // Subtle grid pattern overlay for depth
    const gridGraphics = this.add.graphics();
    gridGraphics.lineStyle(1, 0x1a1a25, 0.3);
    for (let x = 0; x <= MAP_WIDTH; x++) {
      gridGraphics.lineBetween(x * TILE_SIZE, 0, x * TILE_SIZE, MAP_HEIGHT * TILE_SIZE);
    }
    for (let y = 0; y <= MAP_HEIGHT; y++) {
      gridGraphics.lineBetween(0, y * TILE_SIZE, MAP_WIDTH * TILE_SIZE, y * TILE_SIZE);
    }
    
    // Ambient floor texture (subtle scanlines)
    const floorGraphics = this.add.graphics();
    floorGraphics.lineStyle(1, 0x0a0a10, 0.15);
    for (let y = 0; y < MAP_HEIGHT * TILE_SIZE; y += 3) {
      floorGraphics.lineBetween(0, y, MAP_WIDTH * TILE_SIZE, y);
    }
    
    const wallColor = 0x2d2d3d;
    this.walls = this.add.group();
    for (let x = 0; x < MAP_WIDTH; x++) {
      const topWall = this.add.rectangle(x * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE / 2, TILE_SIZE, TILE_SIZE, wallColor);
      const bottomWall = this.add.rectangle(x * TILE_SIZE + TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE, wallColor);
      this.physics.add.existing(topWall, true);
      this.physics.add.existing(bottomWall, true);
      this.walls.add(topWall);
      this.walls.add(bottomWall);
    }
    for (let y = 1; y < MAP_HEIGHT - 1; y++) {
      const leftWall = this.add.rectangle(TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE, TILE_SIZE, wallColor);
      const rightWall = this.add.rectangle(MAP_WIDTH * TILE_SIZE - TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE, TILE_SIZE, wallColor);
      this.physics.add.existing(leftWall, true);
      this.physics.add.existing(rightWall, true);
      this.walls.add(leftWall);
      this.walls.add(rightWall);
    }
    this.currentLayout.obstacles.forEach(obs => {
      const wx = obs.x * TILE_SIZE + TILE_SIZE / 2;
      const wy = obs.y * TILE_SIZE + TILE_SIZE / 2;
      // Wall shadow for depth
      const shadow = this.add.rectangle(wx + 3, wy + 3, TILE_SIZE - 2, TILE_SIZE - 2, 0x000000, 0.4);
      // Wall body
      const wall = this.add.rectangle(wx, wy, TILE_SIZE - 2, TILE_SIZE - 2, 0x3d3d52);
      wall.setStrokeStyle(1, 0x4d4d62);
      this.walls.add(wall);
      this.physics.add.existing(wall, true);
    });
  }

  collectKeyCard(player, keyCard) {
    if (!this.hasKeyCard) {
      this.hasKeyCard = true;
      keyCard.setVisible(false);
      if (keyCard.body) keyCard.body.enable = false;
      sfx.collect();
      this.objectiveText.setText('[+] Key Card');
      this.objectiveText.setFill('#00ff00');
      this.statusText.setText('Key obtained! Hack the terminal!');
      this.statusText.setFill('#00aaff');
      this.cameras.main.flash(200, 0, 150, 255);
    }
  }

  collectDataCore(player, dataCore) {
    if (!this.hasDataCore && this.isHacking) {
      this.hasDataCore = true;
      dataCore.setVisible(false);
      if (dataCore.body) dataCore.body.enable = false;
      sfx.collect();
      this.objectiveText3.setText('[+] Data Core');
      this.objectiveText3.setFill('#00ff00');
      this.statusText.setText('Data secured! Exit unlocked!');
      this.statusText.setFill('#00ffaa');
      this.exitZone.fillColor = 0x22ff66;
      this.exitZone.fillAlpha = 0.4;
      this.exitZone.setStrokeStyle(2, 0x22ff66);
      // Enable exit glow
      if (this.exitZoneGlow) {
        this.exitZoneGlow.setFillStyle(0x22ff66, 0.2);
      }
      this.exitText.setText('OPEN');
      this.exitText.setFill('#22ff66');
      this.cameras.main.flash(200, 0, 255, 100);
    }
  }

  startHack(player, zone) {
    if (!this.hasKeyCard || this.isHacking) return;
    this.isHacking = true;
    this.hackProgress = 0;
    this.statusText.setText('HACKING... Stay in area!');
    this.statusText.setFill('#00ff88');
    this.hackTimer = this.time.addEvent({ delay: 100, callback: this.updateHack, callbackScope: this, loop: true });
  }

  updateHack() {
    if (!this.isHacking || this.isPaused) return;
    this.hackProgress += 2;
    if (this.hackProgress >= 100) {
      this.isHacking = false;
      if (this.hackTimer) this.hackTimer.remove();
      this.objectiveText2.setText('[+] Hack Terminal');
      this.objectiveText2.setFill('#00ff00');
      this.statusText.setText('Terminal hacked! Get the data core!');
      this.statusText.setFill('#ffaa00');
      sfx.win();
      this.cameras.main.flash(200, 255, 255, 100);
    }
  }

  reachExit(player, exit) { if (this.hasDataCore && !this.isDetected) { this.winGame(); } }

  recordFrame() {
    if (!this.isRunning) return;
    this.currentRun.push({ px: this.player.x, py: this.player.y, gx: this.guard.x, gy: this.guard.y, dx: this.scannerDrone ? this.scannerDrone.x : 0, dy: this.scannerDrone ? this.scannerDrone.y : 0, time: this.elapsedTime });
  }

  update(time, delta) {
    // Check for restart key even when detected - use event listener
    if (this.isDetected) {
      // Check directly via DOM event
      return;
    }
    if (!this.isRunning || this.isPaused || this.isDetected || this.hasWon) return;
    this.elapsedTime += delta;
    this.updateTimer();
    this.updatePlayer();
    this.updateGuard();
    this.updateScannerDrone();
    this.updateCameras();
    this.updateMotionSensors();
    this.updateLaserGrids();
    this.updatePatrolDrones();
    this.updateGhost();
    this.updateExitGlow();
    this.checkDetection();
    this.checkScannerDetection();
    this.checkCameraDetection();
    this.checkMotionSensorDetection();
  }

  updateTimer() {
    let time = this.elapsedTime;
    const minutes = Math.floor(time / 60000);
    const seconds = Math.floor((time % 60000) / 1000);
    const ms = Math.floor((time % 1000) / 10);
    this.timerText.setText(minutes.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0') + '.' + ms.toString().padStart(2, '0'));
  }

  updatePlayer() {
    const body = this.player.body;
    body.setVelocity(0);
    let speed = BASE_PLAYER_SPEED * (1 + getSpeedBonus());
    if (this.cursors.left.isDown || this.wasd.left.isDown) body.setVelocityX(-speed);
    else if (this.cursors.right.isDown || this.wasd.right.isDown) body.setVelocityX(speed);
    if (this.cursors.up.isDown || this.wasd.up.isDown) body.setVelocityY(-speed);
    else if (this.cursors.down.isDown || this.wasd.down.isDown) body.setVelocityY(speed);
    if (body.velocity.x !== 0 && body.velocity.y !== 0) { body.setVelocityX(body.velocity.x * 0.707); body.setVelocityY(body.velocity.y * 0.707); }
    
    // Update player glow position
    if (this.playerGlow) {
      this.playerGlow.setPosition(this.player.x, this.player.y);
      // Pulse the glow
      const pulse = 0.1 + Math.sin(this.time.now / 200) * 0.05;
      this.playerGlow.setAlpha(pulse);
    }
    
    // Player movement trail
    if (body.velocity.length() > 0) {
      this.playerTrailPoints.push({ x: this.player.x, y: this.player.y, alpha: 0.3 });
      if (this.playerTrailPoints.length > 8) this.playerTrailPoints.shift();
    }
    
    // Draw trail
    this.playerTrail.clear();
    this.playerTrailPoints.forEach((point, i) => {
      point.alpha -= 0.035;
      if (point.alpha > 0) {
        this.playerTrail.fillStyle(0x00d4ff, point.alpha * 0.5);
        this.playerTrail.fillCircle(point.x, point.y, 4 * point.alpha);
      }
    });
    this.playerTrailPoints = this.playerTrailPoints.filter(p => p.alpha > 0);
  }

  updateGuard() {
    const target = this.guardPatrolPoints[this.currentPatrolIndex];
    const dx = target.x - this.guard.x, dy = target.y - this.guard.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 5) { this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.guardPatrolPoints.length; }
    else { this.guardAngle = Math.atan2(dy, dx); this.guard.body.setVelocity((dx / dist) * this.currentGuardSpeed, (dy / dist) * this.currentGuardSpeed); }
    
    // Update guard glow position
    if (this.guardGlow) {
      this.guardGlow.setPosition(this.guard.x, this.guard.y);
      const pulse = 0.1 + Math.sin(this.time.now / 250) * 0.05;
      this.guardGlow.setAlpha(pulse);
    }
    
    this.updateVisionCone();
  }

  updateScannerDrone() {
    if (!this.scannerDrone) return;
    const target = this.scannerDronePatrolPoints[this.scannerPatrolIndex];
    const dx = target.x - this.scannerDrone.x, dy = target.y - this.scannerDrone.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 5) this.scannerPatrolIndex = (this.scannerPatrolIndex + 1) % this.scannerDronePatrolPoints.length;
    else this.scannerDrone.body.setVelocity((dx / dist) * 50, (dy / dist) * 50);
    this.scannerAngle += 0.03;
    this.scannerBeam.clear();
    const beamLength = 120;
    this.scannerBeam.fillStyle(0x9900ff, 0.2);
    this.scannerBeam.beginPath();
    this.scannerBeam.moveTo(this.scannerDrone.x, this.scannerDrone.y);
    this.scannerBeam.lineTo(this.scannerDrone.x + Math.cos(this.scannerAngle - 0.2) * beamLength, this.scannerDrone.y + Math.sin(this.scannerAngle - 0.2) * beamLength);
    this.scannerBeam.lineTo(this.scannerDrone.x + Math.cos(this.scannerAngle + 0.2) * beamLength, this.scannerDrone.y + Math.sin(this.scannerAngle + 0.2) * beamLength);
    this.scannerBeam.closePath();
    this.scannerBeam.fillPath();
  }

  updateCameras() {
    this.cameras.forEach(cam => {
      cam.angle += cam.rotationSpeed;
      if (cam.angle > Math.PI * 0.6) cam.rotationSpeed = -0.015;
      if (cam.angle < -Math.PI * 0.6) cam.rotationSpeed = 0.015;
      cam.graphics.clear();
      const coneLen = cam.visionDistance;
      cam.graphics.fillStyle(0xff6600, 0.15);
      cam.graphics.beginPath();
      cam.graphics.moveTo(cam.x, cam.y);
      cam.graphics.lineTo(cam.x + Math.cos(cam.angle - 0.25) * coneLen, cam.y + Math.sin(cam.angle - 0.25) * coneLen);
      cam.graphics.lineTo(cam.x + Math.cos(cam.angle + 0.25) * coneLen, cam.y + Math.sin(cam.angle + 0.25) * coneLen);
      cam.graphics.closePath();
      cam.graphics.fillPath();
    });
  }

  updateMotionSensors() {
    this.motionSensors.forEach(sensor => {
      sensor.graphics.clear();
      const playerSpeed = this.player.body.velocity.length();
      if (playerSpeed > 10) {
        const dx = this.player.x - sensor.x;
        const dy = this.player.y - sensor.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Use difficulty-based detection radius and cooldown
        const effectiveRadius = MOTION_SENSOR_RADIUS + (this.levelDifficulty - 1) * 5;
        if (dist < effectiveRadius && sensor.cooldown <= 0) {
          this.detected();
          sensor.cooldown = this.currentMotionCooldown;
        }
      }
      if (sensor.cooldown > 0) sensor.cooldown--;
      sensor.graphics.fillStyle(0xff0066, sensor.cooldown > 0 ? 0.5 : 0.2);
      sensor.graphics.fillCircle(sensor.x, sensor.y, MOTION_SENSOR_RADIUS);
    });
  }
  
  updateLaserGrids() {
    this.laserGrids.forEach(grid => {
      grid.graphics.clear();
      // Pulsing effect
      const alpha = 0.3 + Math.sin(this.time.now / 200) * 0.2;
      grid.graphics.fillStyle(0xff0000, alpha);
      const halfW = grid.horizontal ? TILE_SIZE * 1.5 : TILE_SIZE / 4;
      const halfH = grid.horizontal ? TILE_SIZE / 4 : TILE_SIZE * 1.5;
      grid.graphics.fillRect(grid.x - halfW, grid.y - halfH, halfW * 2, halfH * 2);
    });
  }
  
  updateExitGlow() {
    // Pulse the exit zone glow when unlocked
    if (this.exitZoneGlow && this.hasDataCore) {
      const pulse = 0.15 + Math.sin(this.time.now / 300) * 0.1;
      this.exitZoneGlow.setAlpha(pulse);
    }
  }
  
  updatePatrolDrones() {
    this.patrolDrones.forEach(drone => {
      const target = drone.patrolPoints[drone.patrolIndex];
      const dx = target.x - drone.body.x;
      const dy = target.y - drone.body.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 5) {
        drone.patrolIndex = (drone.patrolIndex + 1) % drone.patrolPoints.length;
      } else {
        const speed = drone.speed;
        drone.body.setVelocity((dx / dist) * speed, (dy / dist) * speed);
      }
      
      // Rotate towards movement direction
      drone.body.rotation = Math.atan2(dy, dx);
    });
  }

  updateVisionCone() {
    this.visionGraphics.clear();
    if (!this.isRunning || this.isDetected) return;
    
    // Use difficulty-based cone settings
    const coneLength = this.currentVisionDistance;
    const halfAngle = this.currentVisionAngle / 2;
    const tipX = this.guard.x, tipY = this.guard.y;
    const leftAngle = this.guardAngle - halfAngle, rightAngle = this.guardAngle + halfAngle;
    const leftX = tipX + Math.cos(leftAngle) * coneLength;
    const leftY = tipY + Math.sin(leftAngle) * coneLength;
    const rightX = tipX + Math.cos(rightAngle) * coneLength;
    const rightY = tipY + Math.sin(rightAngle) * coneLength;
    
    // Gradient effect - brighter at source, fading outward
    const pulseAlpha = 0.08 + Math.sin(this.time.now / 300) * 0.04;
    
    // Outer cone (faded)
    this.visionGraphics.fillStyle(0xff2200, pulseAlpha * 0.5);
    this.visionGraphics.beginPath();
    this.visionGraphics.moveTo(tipX, tipY);
    this.visionGraphics.lineTo(leftX, leftY);
    this.visionGraphics.lineTo(rightX, rightY);
    this.visionGraphics.closePath();
    this.visionGraphics.fillPath();
    
    // Inner cone (brighter, gradient feel)
    const innerLength = coneLength * 0.6;
    const innerLeftX = tipX + Math.cos(leftAngle) * innerLength;
    const innerLeftY = tipY + Math.sin(leftAngle) * innerLength;
    const innerRightX = tipX + Math.cos(rightAngle) * innerLength;
    const innerRightY = tipY + Math.sin(rightAngle) * innerLength;
    
    this.visionGraphics.fillStyle(0xff4422, pulseAlpha * 1.5);
    this.visionGraphics.beginPath();
    this.visionGraphics.moveTo(tipX, tipY);
    this.visionGraphics.lineTo(innerLeftX, innerLeftY);
    this.visionGraphics.lineTo(innerRightX, innerRightY);
    this.visionGraphics.closePath();
    this.visionGraphics.fillPath();
  }

  updateGhost() {
    if (!this.currentRun || this.currentRun.length < 10) return;
    this.ghostFrame++;
    if (this.ghostFrame >= this.currentRun.length) this.ghostFrame = 0;
    const frame = this.currentRun[Math.floor(this.ghostFrame)];
    if (frame) {
      this.ghost.setPosition(frame.px, frame.py);
      this.ghost.setVisible(true);
    }
  }

  checkDetection() {
    const dx = this.player.x - this.guard.x;
    const dy = this.player.y - this.guard.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 20) { this.detected(); return; }
    if (dist < this.currentVisionDistance) {
      const angleToPlayer = Math.atan2(dy, dx);
      let angleDiff = angleToPlayer - this.guardAngle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      if (Math.abs(angleDiff) < this.currentVisionAngle / 2) {
        if (!this.isLineBlocked(this.guard.x, this.guard.y, this.player.x, this.player.y)) {
          this.detected();
        }
      }
    }
  }

  checkScannerDetection() {
    if (!this.scannerDrone) return;
    const dx = this.player.x - this.scannerDrone.x;
    const dy = this.player.y - this.scannerDrone.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 30) { this.detected(); return; }
    const angleToPlayer = Math.atan2(dy, dx);
    let angleDiff = angleToPlayer - this.scannerAngle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    if (dist < 120 && Math.abs(angleDiff) < 0.3) {
      this.detected();
    }
  }

  checkCameraDetection() {
    this.cameras.forEach(cam => {
      const dx = this.player.x - cam.x;
      const dy = this.player.y - cam.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 25) { this.detected(); return; }
      if (dist < cam.visionDistance) {
        const angleToPlayer = Math.atan2(dy, dx);
        let angleDiff = angleToPlayer - cam.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        if (Math.abs(angleDiff) < 0.25) {
          if (!this.isLineBlocked(cam.x, cam.y, this.player.x, this.player.y)) {
            this.detected();
          }
        }
      }
    });
  }

  checkMotionSensorDetection() {
    // Handled in updateMotionSensors
  }

  isLineBlocked(x1, y1, x2, y2) {
    const steps = 10;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const checkX = x1 + (x2 - x1) * t;
      const checkY = y1 + (y2 - y1) * t;
      const tileX = Math.floor(checkX / TILE_SIZE);
      const tileY = Math.floor(checkY / TILE_SIZE);
      for (const obs of this.currentLayout.obstacles) {
        if (obs.x === tileX && obs.y === tileY) return true;
      }
    }
    return false;
  }

  detected() {
    if (this.isDetected) return;
    this.isDetected = true;
    // Don't pause physics completely - just stop player movement
    // This allows keyboard handlers to still work
    if (this.player?.body) this.player.body.setVelocity(0);
    sfx.alert();
    sfx.detection(); // Additional detection sound
    
    // Detection pulse effect - red flash overlay
    const { width, height } = this.scale;
    const pulseOverlay = this.add.rectangle(width/2, height/2, width, height, 0xff0000);
    pulseOverlay.setDepth(200);
    pulseOverlay.setAlpha(0);
    
    // Pulse animation
    this.tweens.add({
      targets: pulseOverlay,
      alpha: 0.4,
      duration: 100,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        pulseOverlay.destroy();
      }
    });
    
    // Player shake/glow red
    if (this.playerGlow) {
      this.playerGlow.setFillStyle(0xff0000, 0.5);
      this.tweens.add({
        targets: this.playerGlow,
        alpha: 0.8,
        duration: 100,
        yoyo: true,
        repeat: 3
      });
    }
    
    if (this.statusText) {
      this.statusText.setText('DETECTED! Press R to restart');
      this.statusText.setFill('#ff0000');
    }
    if (this.vignette) this.vignette.setAlpha(0.5);
    if (this.cameras?.main) this.cameras.main.shake(300, 0.02);
    
    // Store reference for restart check
    const sceneKey = this.scene.key;
    const levelIdx = this.currentLevelIndex;
    const sceneRef = this;
    this.detectedSceneEvent = this.time.addEvent({ delay: 1500, callback: () => {
      // Only transition if we're still the same scene instance and not restarted
      if (sceneRef.isDetected && sceneRef.scene.key === sceneKey && !sceneRef._restarted) {
        sceneRef.scene.start('ResultsScene', { 
          levelIndex: levelIdx,
          success: false, 
          time: sceneRef.elapsedTime, 
          credits: 0 
        });
      }
    }, callbackScope: this });
  }

  winGame() {
    if (!this.isRunning) return;
    this.physics.pause();
    sfx.win();
    const timeBonus = Math.max(0, 30000 - Math.floor(this.elapsedTime));
    const creditsEarned = 20 + Math.floor(timeBonus / 1000) + getLuckBonus();
    
    // Use SaveManager to properly record the run and unlock levels
    saveManager.recordRun(this.currentLevelIndex, this.elapsedTime, creditsEarned);
    
    // Mark as won - keep isRunning true for test compatibility
    this.hasWon = true;
    
    // Transition to ResultsScene
    this.scene.start('ResultsScene', { 
      levelIndex: this.currentLevelIndex,
      success: true, 
      time: this.elapsedTime, 
      credits: creditsEarned 
    });
  }
}

// ==================== GAME CONFIG ====================
const config = {
  type: Phaser.AUTO,
  width: MAP_WIDTH * TILE_SIZE,
  height: MAP_HEIGHT * TILE_SIZE,
  parent: 'game-container',
  backgroundColor: '#0a0a0f',
  physics: {
    default: 'arcade',
    arcade: { debug: false }
  },
  scene: [BootScene, MainMenuScene, LevelSelectScene, SettingsScene, ResultsScene, GameScene]
};

const game = new Phaser.Game(config);
window.__ghostGame = game;
