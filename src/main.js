import Phaser from 'phaser';

// ==================== SAVE/LOAD SYSTEM ====================
const SAVE_KEY = 'ghostshift_save';

const defaultSaveData = {
  credits: 0,
  totalRuns: 0,
  bestTime: null,
  perks: { speed: 1, stealth: 1, luck: 1 },
  settings: { audioEnabled: true }
};

function loadSave() {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...defaultSaveData, ...parsed, perks: { ...defaultSaveData.perks, ...parsed.perks }, settings: { ...defaultSaveData.settings, ...parsed.settings } };
    }
  } catch (e) { console.warn('Failed to load save:', e); }
  return { ...defaultSaveData };
}

function saveSaveData(data) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { console.warn('Failed to save:', e); }
}

let gameSave = loadSave();

// ==================== GAME CONSTANTS ====================
const TILE_SIZE = 32;
const MAP_WIDTH = 20;
const MAP_HEIGHT = 15;
const BASE_PLAYER_SPEED = 180;
const GUARD_SPEED = 70;
const GHOST_ALPHA = 0.25;
const VISION_CONE_ANGLE = 60;
const VISION_CONE_DISTANCE = 150;

// ==================== AUDIO SYSTEM ====================
class SFXManager {
  constructor() { this.ctx = null; this.initialized = false; this.enabled = gameSave.settings.audioEnabled; }
  init() { if (this.initialized) return; try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); this.initialized = true; } catch (e) { console.warn('WebAudio not available'); } }
  setEnabled(enabled) { this.enabled = enabled; gameSave.settings.audioEnabled = enabled; saveSaveData(gameSave); }
  playTone(freq, duration, type = 'square', volume = 0.1) {
    if (!this.ctx || !this.enabled) return;
    const osc = this.ctx.createOscillator(); const gain = this.ctx.createGain();
    osc.type = type; osc.frequency.value = freq; gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain); gain.connect(this.ctx.destination); osc.start(); osc.stop(this.ctx.currentTime + duration);
  }
  alert() { this.playTone(880, 0.15, 'square', 0.08); setTimeout(() => this.playTone(1100, 0.15, 'square', 0.08), 100); }
  win() { this.playTone(523, 0.1, 'sine', 0.1); setTimeout(() => this.playTone(659, 0.1, 'sine', 0.1), 100); setTimeout(() => this.playTone(784, 0.2, 'sine', 0.1), 200); }
  fail() { this.playTone(200, 0.3, 'sawtooth', 0.1); setTimeout(() => this.playTone(150, 0.4, 'sawtooth', 0.1), 200); }
  collect() { this.playTone(1200, 0.05, 'sine', 0.08); setTimeout(() => this.playTone(1500, 0.1, 'sine', 0.08), 50); }
  select() { this.playTone(600, 0.08, 'sine', 0.08); }
  pause() { this.playTone(400, 0.1, 'sine', 0.08); }
}
const sfx = new SFXManager();

// ==================== LEVEL LAYOUTS ====================
const LEVEL_LAYOUTS = [
  { name: 'Warehouse', obstacles: [{x:8,y:4},{x:9,y:4},{x:10,y:4},{x:8,y:5},{x:10,y:5},{x:8,y:6},{x:10,y:6},{x:3,y:10},{x:4,y:10},{x:14,y:8},{x:15,y:8},{x:12,y:3},{x:13,y:3},{x:6,y:8},{x:7,y:8}], guardPatrol:[{x:15,y:7},{x:5,y:7},{x:5,y:12},{x:15,y:12}], dataCore:{x:16,y:3}, keyCard:{x:3,y:12}, hackTerminal:{x:10,y:7}, playerStart:{x:2,y:2}, exitZone:{x:19,y:7}, cameras:[{x:5,y:2},{x:15,y:12}], motionSensors:[{x:8,y:7},{x:12,y:10}], laserGrids:[{x:10,y:9,h:true},{x:6,y:3,v:true}], patrolDrones:[{x:12,y:6,patrol:[{x:12,y:6},{x:16,y:6},{x:16,y:10},{x:12,y:10}]}], securityCode:{x:4,y:8}, powerCell:{x:14,y:4} },
  { name: 'Labs', obstacles: [{x:5,y:3},{x:5,y:4},{x:5,y:5},{x:5,y:6},{x:10,y:8},{x:11,y:8},{x:12,y:8},{x:10,y:9},{x:12,y:9},{x:10,y:10},{x:11,y:10},{x:12,y:10},{x:15,y:3},{x:16,y:3},{x:17,y:3},{x:3,y:11},{x:4,y:11},{x:5,y:11},{x:8,y:13},{x:9,y:13}], guardPatrol:[{x:14,y:5},{x:6,y:5},{x:6,y:13},{x:14,y:13}], dataCore:{x:17,y:2}, keyCard:{x:2,y:3}, hackTerminal:{x:8,y:5}, playerStart:{x:2,y:13}, exitZone:{x:19,y:3}, cameras:[{x:10,y:2},{x:3,y:8}], motionSensors:[{x:12,y:6},{x:7,y:11}], laserGrids:[{x:8,y:7,h:true},{x:14,y:9,v:true}], patrolDrones:[{x:10,y:10,patrol:[{x:10,y:10},{x:14,y:10},{x:14,y:4},{x:10,y:4}]}], securityCode:{x:6,y:2}, powerCell:{x:16,y:12} },
  { name: 'Server Farm', obstacles: [{x:4,y:3},{x:5,y:3},{x:9,y:3},{x:10,y:3},{x:4,y:5},{x:10,y:5},{x:4,y:7},{x:5,y:7},{x:9,y:7},{x:10,y:7},{x:7,y:9},{x:8,y:9},{x:3,y:11},{x:7,y:11},{x:12,y:11},{x:16,y:11},{x:3,y:13},{x:4,y:13},{x:15,y:13},{x:16,y:13}], guardPatrol:[{x:2,y:9},{x:18,y:9},{x:18,y:5},{x:2,y:5}], dataCore:{x:18,y:13}, keyCard:{x:7,y:3}, hackTerminal:{x:14,y:9}, playerStart:{x:2,y:2}, exitZone:{x:19,y:7}, cameras:[{x:2,y:5},{x:17,y:11}], motionSensors:[{x:7,y:7},{x:12,y:5}], laserGrids:[{x:6,y:5,v:true},{x:12,y:9,h:true}], patrolDrones:[{x:8,y:6,patrol:[{x:8,y:6},{x:14,y:6},{x:14,y:12},{x:8,y:12}]}], securityCode:{x:2,y:12}, powerCell:{x:18,y:3} }
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

// ==================== MAIN SCENE ====================
class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainScene' });
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
  }
  
  // Manual restart method for testing
  manualRestart() {
    this._restarted = true;
    this.scene.restart();
  }
  
  create() {
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
    this.applySpeedBoost = gameSave.perks.speed > 0;
    this.applyStealth = gameSave.perks.stealth > 0;
    this.currentLevelIndex = Math.floor(Math.random() * LEVEL_LAYOUTS.length);
    this.currentLayout = LEVEL_LAYOUTS[this.currentLevelIndex];
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
    this.creditsText = this.add.text(10, 35, 'Credits: ' + gameSave.credits, { fontSize: '12px', fill: '#ffaa00', fontFamily: 'Courier New' });
    this.runText = this.add.text(10, 55, 'Run: ' + this.runCount, { fontSize: '12px', fill: '#888888', fontFamily: 'Courier New' });
    this.levelText = this.add.text(10, 70, 'Level: ' + this.currentLayout.name, { fontSize: '12px', fill: '#8888ff', fontFamily: 'Courier New' });
    this.objectiveText = this.add.text(10, 90, '[O] Key Card', { fontSize: '12px', fill: '#00aaff', fontFamily: 'Courier New' });
    this.objectiveText2 = this.add.text(10, 105, '[O] Hack Terminal', { fontSize: '12px', fill: '#00ff88', fontFamily: 'Courier New' });
    this.objectiveText3 = this.add.text(10, 120, '[O] Data Core', { fontSize: '12px', fill: '#ffaa00', fontFamily: 'Courier New' });
    this.statusText = this.add.text(10, 140, 'Find the Key Card!', { fontSize: '11px', fill: '#666666', fontFamily: 'Courier New' });
    this.perksText = this.add.text(10, 155, 'Perks: S' + gameSave.perks.speed + '/L' + gameSave.perks.luck + '/St' + gameSave.perks.stealth, { fontSize: '10px', fill: '#666666', fontFamily: 'Courier New' });
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
    else { this.guardAngle = Math.atan2(dy, dx); this.guard.body.setVelocity((dx / dist) * GUARD_SPEED, (dy / dist) * GUARD_SPEED); }
    
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
        if (dist < sensor.detectionRadius && sensor.cooldown <= 0) {
          this.detected();
          sensor.cooldown = 120;
        }
      }
      if (sensor.cooldown > 0) sensor.cooldown--;
      sensor.graphics.fillStyle(0xff0066, sensor.cooldown > 0 ? 0.5 : 0.2);
      sensor.graphics.fillCircle(sensor.x, sensor.y, sensor.detectionRadius);
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
    
    const coneLength = VISION_CONE_DISTANCE;
    const halfAngle = (VISION_CONE_ANGLE * Math.PI) / 360;
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
    if (dist < VISION_CONE_DISTANCE) {
      const angleToPlayer = Math.atan2(dy, dx);
      let angleDiff = angleToPlayer - this.guardAngle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      if (Math.abs(angleDiff) < VISION_CONE_ANGLE * Math.PI / 360) {
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
    if (this.statusText) {
      this.statusText.setText('DETECTED! Press R to restart');
      this.statusText.setFill('#ff0000');
    }
    if (this.vignette) this.vignette.setAlpha(0.5);
    if (this.cameras?.main) this.cameras.main.shake(300, 0.02);
    
    // Store reference for restart check
    const sceneKey = this.scene.key;
    const sceneRef = this;
    this.detectedSceneEvent = this.time.addEvent({ delay: 2000, callback: () => {
      // Only transition if we're still the same scene instance and not restarted
      if (sceneRef.isDetected && sceneRef.scene.key === sceneKey && !sceneRef._restarted) {
        sceneRef.scene.start('BootScene');
      }
    }, callbackScope: this });
  }

  winGame() {
    if (!this.isRunning) return;
    this.physics.pause();
    sfx.win();
    const timeBonus = Math.max(0, 30000 - Math.floor(this.elapsedTime));
    const creditsEarned = 20 + Math.floor(timeBonus / 1000) + getLuckBonus();
    gameSave.credits += creditsEarned;
    gameSave.totalRuns++;
    gameSave.bestTime = gameSave.bestTime ? Math.min(gameSave.bestTime, this.elapsedTime) : this.elapsedTime;
    saveSaveData(gameSave);
    
    const overlay = this.add.rectangle(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE, 0x000000, 0.8);
    const winText = this.add.text(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2 - 50, 'MISSION COMPLETE!', { fontSize: '32px', fill: '#00ff88', fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(0.5);
    const credText = this.add.text(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2 + 10, `+${creditsEarned} Credits`, { fontSize: '20px', fill: '#ffaa00', fontFamily: 'Courier New' }).setOrigin(0.5);
    const contText = this.add.text(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2 + 60, 'Press R to continue', { fontSize: '14px', fill: '#888888', fontFamily: 'Courier New' }).setOrigin(0.5);
    
    // Mark as won - keep isRunning true for test compatibility
    this.hasWon = true;
    
    this.input.keyboard.once('keydown-R', () => {
      this.scene.start('BootScene');
    });
  }
}

// ==================== BOOT SCENE ====================
class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
    this.selectedPerk = null;
  }

  create() {
    this.add.rectangle(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE, 0x0a0a0f);
    
    const title = this.add.text(MAP_WIDTH * TILE_SIZE / 2, 40, 'GHOSTSHIFT', { fontSize: '36px', fill: '#4488ff', fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(MAP_WIDTH * TILE_SIZE / 2, 80, 'Infiltrate. Hack. Escape.', { fontSize: '14px', fill: '#666688', fontFamily: 'Courier New' }).setOrigin(0.5);
    
    // Stats display
    const statsY = 120;
    this.add.text(40, statsY, `Total Runs: ${gameSave.totalRuns}`, { fontSize: '14px', fill: '#888888', fontFamily: 'Courier New' });
    this.add.text(40, statsY + 25, `Best Time: ${gameSave.bestTime ? this.formatTime(gameSave.bestTime) : '--:--.--'}`, { fontSize: '14px', fill: '#888888', fontFamily: 'Courier New' });
    this.creditsText = this.add.text(40, statsY + 50, `Credits: ${gameSave.credits}`, { fontSize: '18px', fill: '#ffaa00', fontFamily: 'Courier New' });
    
    // Perk shop
    const shopY = 220;
    this.add.text(40, shopY, 'PERK SHOP', { fontSize: '16px', fill: '#4488ff', fontFamily: 'Courier New', fontStyle: 'bold' });
    
    const perks = ['speed', 'stealth', 'luck'];
    const perkLabels = { speed: 'SPEED', stealth: 'STEALTH', luck: 'LUCK' };
    const perkDescs = { speed: '+Move Speed', stealth: '-Detection Range', luck: '+Credit Bonus' };
    
    perks.forEach((perk, i) => {
      const y = shopY + 35 + i * 45;
      const level = gameSave.perks[perk];
      const maxLevel = 4;
      const nextCost = level < maxLevel ? PERK_INFO[perk].costs[level] : 'MAX';
      const canAfford = level < maxLevel && gameSave.credits >= PERK_INFO[perk].costs[level];
      
      const bg = this.add.rectangle(MAP_WIDTH * TILE_SIZE / 2, y, 350, 40, canAfford ? 0x1a2a1a : 0x1a1a1a);
      bg.setStrokeStyle(1, canAfford ? 0x44ff44 : 0x333333);
      bg.setInteractive({ useHandCursor: canAfford });
      
      const name = this.add.text(30, y, perkLabels[perk], { fontSize: '14px', fill: '#ffffff', fontFamily: 'Courier New' }).setOrigin(0, 0.5);
      const desc = this.add.text(30, y + 15, perkDescs[perk], { fontSize: '10px', fill: '#666666', fontFamily: 'Courier New' }).setOrigin(0, 0.5);
      const lvlStr = '★'.repeat(level) + '☆'.repeat(maxLevel - level);
      this.add.text(MAP_WIDTH * TILE_SIZE - 100, y, lvlStr, { fontSize: '12px', fill: '#ffaa00', fontFamily: 'Courier New' }).setOrigin(0, 0.5);
      const costText = this.add.text(MAP_WIDTH * TILE_SIZE - 30, y, level < maxLevel ? `${nextCost}c` : 'MAX', { fontSize: '14px', fill: canAfford ? '#00ff00' : '#666666', fontFamily: 'Courier New' }).setOrigin(1, 0.5);
      
      bg.on('pointerdown', () => {
        if (canAfford) {
          gameSave.credits -= PERK_INFO[perk].costs[level];
          gameSave.perks[perk]++;
          saveSaveData(gameSave);
          sfx.select();
          this.scene.restart();
        }
      });
    });
    
    // Play button
    const playBtn = this.add.rectangle(MAP_WIDTH * TILE_SIZE / 2, 450, 200, 50, 0x2244aa);
    playBtn.setStrokeStyle(2, 0x4488ff);
    playBtn.setInteractive({ useHandCursor: true });
    const playText = this.add.text(MAP_WIDTH * TILE_SIZE / 2, 450, 'START MISSION', { fontSize: '18px', fill: '#ffffff', fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(0.5);
    
    playBtn.on('pointerdown', () => {
      sfx.select();
      this.scene.start('MainScene');
    });
    
    // Controls info
    this.add.text(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE - 30, 'ARROWS/WASD: Move | R: Restart | ESC: Pause | SPACE: Start', { fontSize: '10px', fill: '#444455', fontFamily: 'Courier New' }).setOrigin(0.5);
    
    // Start game on Space
    this.input.keyboard.on('keydown-SPACE', () => {
      this.scene.start('MainScene');
    });
    
    this.input.keyboard.once('keydown', () => sfx.init());
    this.input.on('pointerdown', () => sfx.init(), this);
  }

  formatTime(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const centis = Math.floor((ms % 1000) / 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centis.toString().padStart(2, '0')}`;
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
  scene: [BootScene, MainScene]
};

const game = new Phaser.Game(config);
window.__ghostGame = game;
