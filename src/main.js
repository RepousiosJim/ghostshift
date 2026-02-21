import Phaser from 'phaser';

// Game constants
const TILE_SIZE = 32;
const MAP_WIDTH = 20;
const MAP_HEIGHT = 15;
const PLAYER_SPEED = 180;
const GUARD_SPEED = 70;
const GHOST_ALPHA = 0.25;
const VISION_CONE_ANGLE = 60;
const VISION_CONE_DISTANCE = 150;
const GHOST_TRAIL_LENGTH = 20;

// Audio system (WebAudio beeps)
class SFXManager {
  constructor() {
    this.ctx = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.initialized = true;
    } catch (e) {
      console.warn('WebAudio not available');
    }
  }

  playTone(freq, duration, type = 'square', volume = 0.1) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  alert() {
    this.playTone(880, 0.15, 'square', 0.08);
    setTimeout(() => this.playTone(1100, 0.15, 'square', 0.08), 100);
  }

  win() {
    this.playTone(523, 0.1, 'sine', 0.1);
    setTimeout(() => this.playTone(659, 0.1, 'sine', 0.1), 100);
    setTimeout(() => this.playTone(784, 0.2, 'sine', 0.1), 200);
  }

  fail() {
    this.playTone(200, 0.3, 'sawtooth', 0.1);
    setTimeout(() => this.playTone(150, 0.4, 'sawtooth', 0.1), 200);
  }

  collect() {
    this.playTone(1200, 0.05, 'sine', 0.08);
    setTimeout(() => this.playTone(1500, 0.1, 'sine', 0.08), 50);
  }

  select() {
    this.playTone(600, 0.08, 'sine', 0.08);
  }
}

const sfx = new SFXManager();

// Level layout definitions
const LEVEL_LAYOUTS = [
  // Layout 1: Warehouse - central obstacles
  {
    name: 'Warehouse',
    obstacles: [
      { x: 8, y: 4 }, { x: 9, y: 4 }, { x: 10, y: 4 },
      { x: 8, y: 5 }, { x: 10, y: 5 },
      { x: 8, y: 6 }, { x: 10, y: 6 },
      { x: 3, y: 10 }, { x: 4, y: 10 },
      { x: 14, y: 8 }, { x: 15, y: 8 },
      { x: 12, y: 3 }, { x: 13, y: 3 },
      { x: 6, y: 8 }, { x: 7, y: 8 }
    ],
    guardPatrol: [
      { x: 15, y: 7 }, { x: 5, y: 7 }, { x: 5, y: 12 }, { x: 15, y: 12 }
    ],
    dataCore: { x: 16, y: 3 },
    playerStart: { x: 2, y: 2 },
    exitZone: { x: 19, y: 7 }
  },
  // Layout 2: Labs - more corridor-like
  {
    name: 'Labs',
    obstacles: [
      { x: 5, y: 3 }, { x: 5, y: 4 }, { x: 5, y: 5 }, { x: 5, y: 6 },
      { x: 10, y: 8 }, { x: 11, y: 8 }, { x: 12, y: 8 },
      { x: 10, y: 9 }, { x: 12, y: 9 },
      { x: 10, y: 10 }, { x: 11, y: 10 }, { x: 12, y: 10 },
      { x: 15, y: 3 }, { x: 16, y: 3 }, { x: 17, y: 3 },
      { x: 3, y: 11 }, { x: 4, y: 11 }, { x: 5, y: 11 },
      { x: 8, y: 13 }, { x: 9, y: 13 }
    ],
    guardPatrol: [
      { x: 14, y: 5 }, { x: 6, y: 5 }, { x: 6, y: 13 }, { x: 14, y: 13 }
    ],
    dataCore: { x: 17, y: 2 },
    playerStart: { x: 2, y: 13 },
    exitZone: { x: 19, y: 3 }
  },
  // Layout 3: Server Farm - scattered small blocks
  {
    name: 'Server Farm',
    obstacles: [
      { x: 4, y: 3 }, { x: 5, y: 3 }, { x: 9, y: 3 }, { x: 10, y: 3 },
      { x: 4, y: 5 }, { x: 10, y: 5 },
      { x: 4, y: 7 }, { x: 5, y: 7 }, { x: 9, y: 7 }, { x: 10, y: 7 },
      { x: 7, y: 9 }, { x: 8, y: 9 },
      { x: 3, y: 11 }, { x: 7, y: 11 }, { x: 12, y: 11 }, { x: 16, y: 11 },
      { x: 3, y: 13 }, { x: 4, y: 13 }, { x: 15, y: 13 }, { x: 16, y: 13 }
    ],
    guardPatrol: [
      { x: 2, y: 9 }, { x: 18, y: 9 }, { x: 18, y: 5 }, { x: 2, y: 5 }
    ],
    dataCore: { x: 18, y: 13 },
    playerStart: { x: 2, y: 2 },
    exitZone: { x: 19, y: 7 }
  }
];

class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainScene' });
    this.player = null;
    this.guard = null;
    this.ghost = null;
    this.scannerDrone = null;
    this.ghostTrail = [];
    this.dataCore = null;
    this.exitZone = null;
    this.cursors = null;
    this.wasd = null;
    this.timerText = null;
    this.runText = null;
    this.objectiveText = null;
    this.statusText = null;
    this.elapsedTime = 0;
    this.isRunning = false;
    this.isDetected = false;
    this.hasDataCore = false;
    this.currentRun = [];
    this.previousRun = null;
    this.ghostFrame = 0;
    this.guardPatrolPoints = [];
    this.currentPatrolIndex = 0;
    this.guardDirection = 1;
    this.guardAngle = 0;
    this.visionCone = null;
    this.walls = null;
    this.runCount = 1;
    this.alarmActive = false;
    this.vignette = null;
    this.currentLayout = null;
    this.currentLevelIndex = 0;
    this.upgrades = null;
    this.scannerAngle = 0;
    this.scannerDirection = 1;
    this.applySpeedBoost = false;
    this.applyStealth = false;
    this.applyTimeBonus = false;
    this.selectionMade = false;
    this.transientUi = [];
  }

  create() {
    // Initialize audio on first interaction
    this.input.keyboard.once('keydown', () => sfx.init());
    this.input.on('pointerdown', () => sfx.init(), this);

    // Select random layout
    this.currentLevelIndex = Math.floor(Math.random() * LEVEL_LAYOUTS.length);
    this.currentLayout = LEVEL_LAYOUTS[this.currentLevelIndex];

    // Create map with current layout
    this.createMap();

    // Create player (blue square)
    const startPos = this.currentLayout.playerStart;
    this.player = this.add.rectangle(startPos.x * TILE_SIZE, startPos.y * TILE_SIZE, TILE_SIZE - 8, TILE_SIZE - 8, 0x4488ff);
    this.player.setStrokeStyle(2, 0x88ccff);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);

    // Create guard (red square)
    this.guard = this.add.rectangle(TILE_SIZE * 15, TILE_SIZE * 7, TILE_SIZE - 8, TILE_SIZE - 8, 0xff4444);
    this.guard.setStrokeStyle(2, 0xff8888);
    this.physics.add.existing(this.guard);
    this.guard.body.setCollideWorldBounds(true);
    
    // Setup guard patrol path from layout
    this.guardPatrolPoints = this.currentLayout.guardPatrol.map(p => ({
      x: p.x * TILE_SIZE,
      y: p.y * TILE_SIZE
    }));

    // Create scanner drone (new enemy type)
    this.createScannerDrone();

    // Create vision cone (triangle shape)
    this.createVisionCone();

    // Create data core from layout
    const dcPos = this.currentLayout.dataCore;
    this.dataCore = this.add.rectangle(dcPos.x * TILE_SIZE, dcPos.y * TILE_SIZE, TILE_SIZE - 4, TILE_SIZE - 4, 0xffaa00);
    this.dataCore.setStrokeStyle(2, 0xffdd44);
    this.physics.add.existing(this.dataCore, true);
    
    // Pulsing effect for data core
    this.tweens.add({
      targets: this.dataCore,
      alpha: 0.6,
      duration: 500,
      yoyo: true,
      repeat: -1
    });

    // Create exit zone from layout
    const exitPos = this.currentLayout.exitZone;
    this.exitZone = this.add.rectangle(
      exitPos.x * TILE_SIZE,
      exitPos.y * TILE_SIZE,
      TILE_SIZE * 2,
      TILE_SIZE * 3,
      0x222222,
      0.5
    );
    this.physics.add.existing(this.exitZone, true);
    
    // Exit indicator text
    this.exitText = this.add.text(
      exitPos.x * TILE_SIZE,
      exitPos.y * TILE_SIZE,
      'LOCKED',
      { fontSize: '12px', fill: '#ff4444', fontFamily: 'Courier New' }
    ).setOrigin(0.5);

    // Create ghost (translucent replay)
    this.ghost = this.add.rectangle(-100, -100, TILE_SIZE - 8, TILE_SIZE - 8, 0x88ffff);
    this.ghost.setAlpha(GHOST_ALPHA);
    this.ghost.setStrokeStyle(1, 0xaaffff);
    this.physics.add.existing(this.ghost);
    this.ghost.body.setCollideWorldBounds(true);
    this.ghost.setVisible(false);

    // Physics links (create once)
    this.playerWallCollider = this.physics.add.collider(this.player, this.walls);
    this.guardWallCollider = this.physics.add.collider(this.guard, this.walls);
    this.scannerWallCollider = this.physics.add.collider(this.scannerDrone, this.walls);
    this.playerDataCoreOverlap = this.physics.add.overlap(this.player, this.dataCore, this.collectDataCore, null, this);
    this.playerExitOverlap = this.physics.add.overlap(this.player, this.exitZone, this.reachExit, null, this);

    // Input
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D
    });

    // UI elements
    this.createUI();

    // Create vignette overlay for alarm effect
    this.vignette = this.add.rectangle(
      MAP_WIDTH * TILE_SIZE / 2,
      MAP_HEIGHT * TILE_SIZE / 2,
      MAP_WIDTH * TILE_SIZE,
      MAP_HEIGHT * TILE_SIZE,
      0xff0000,
      0
    );

    // Start the game
    this.isRunning = true;
    this.currentRun = [];
    this.time.addEvent({ delay: 50, callback: this.recordFrame, callbackScope: this, loop: true });
  }

  createScannerDrone() {
    const droneX = 10 * TILE_SIZE;
    const droneY = 10 * TILE_SIZE;
    
    this.scannerDrone = this.add.circle(droneX, droneY, TILE_SIZE / 2, 0x9900ff);
    this.scannerDrone.setStrokeStyle(2, 0xcc66ff);
    this.physics.add.existing(this.scannerDrone);
    this.scannerDrone.body.setCollideWorldBounds(true);
    this.scannerDrone.body.setImmovable(true);
    
    this.scannerDronePatrolPoints = [
      { x: 10, y: 10 }, { x: 14, y: 10 }, { x: 14, y: 6 }, { x: 10, y: 6 }
    ].map(p => ({ x: p.x * TILE_SIZE, y: p.y * TILE_SIZE }));
    
    this.scannerPatrolIndex = 0;
    this.scannerAngle = 0;
    this.scannerBeam = this.add.graphics();
  }

  createVisionCone() {
    const graphics = this.add.graphics();
    this.visionGraphics = graphics;
    this.visionCone = { graphics, points: [] };
  }

  createUI() {
    this.timerText = this.add.text(10, 10, '00:00.00', { 
      fontSize: '24px', 
      fill: '#00ffaa',
      fontFamily: 'Courier New'
    });
    
    this.runText = this.add.text(10, 40, 'Run: 1', { 
      fontSize: '14px', 
      fill: '#888888',
      fontFamily: 'Courier New'
    });

    this.levelText = this.add.text(10, 60, `Level: ${this.currentLayout.name}`, { 
      fontSize: '14px', 
      fill: '#8888ff',
      fontFamily: 'Courier New'
    });

    this.objectiveText = this.add.text(10, 80, '[○] Data Core', { 
      fontSize: '14px', 
      fill: '#ffaa00',
      fontFamily: 'Courier New'
    });

    this.statusText = this.add.text(10, 105, 'Sneak to the data core!', { 
      fontSize: '12px', 
      fill: '#666666',
      fontFamily: 'Courier New'
    });

    this.add.text(10, MAP_HEIGHT * TILE_SIZE - 25, 'ARROWS/WASD: Move | R: Restart', { 
      fontSize: '11px', 
      fill: '#444455',
      fontFamily: 'Courier New'
    });
  }

  createMap() {
    this.add.rectangle(
      MAP_WIDTH * TILE_SIZE / 2,
      MAP_HEIGHT * TILE_SIZE / 2,
      MAP_WIDTH * TILE_SIZE,
      MAP_HEIGHT * TILE_SIZE,
      0x1a1a2a
    );

    const wallColor = 0x3a3a4a;
    this.walls = this.add.group();

    for (let x = 0; x < MAP_WIDTH; x++) {
      const topWall = this.add.rectangle(x * TILE_SIZE + TILE_SIZE/2, TILE_SIZE/2, TILE_SIZE, TILE_SIZE, wallColor);
      const bottomWall = this.add.rectangle(x * TILE_SIZE + TILE_SIZE/2, MAP_HEIGHT * TILE_SIZE - TILE_SIZE/2, TILE_SIZE, TILE_SIZE, wallColor);
      this.physics.add.existing(topWall, true);
      this.physics.add.existing(bottomWall, true);
      this.walls.add(topWall);
      this.walls.add(bottomWall);
    }

    for (let y = 1; y < MAP_HEIGHT - 1; y++) {
      const leftWall = this.add.rectangle(TILE_SIZE/2, y * TILE_SIZE + TILE_SIZE/2, TILE_SIZE, TILE_SIZE, wallColor);
      const rightWall = this.add.rectangle(MAP_WIDTH * TILE_SIZE - TILE_SIZE/2, y * TILE_SIZE + TILE_SIZE/2, TILE_SIZE, TILE_SIZE, wallColor);
      this.physics.add.existing(leftWall, true);
      this.physics.add.existing(rightWall, true);
      this.walls.add(leftWall);
      this.walls.add(rightWall);
    }

    this.currentLayout.obstacles.forEach(obs => {
      const wall = this.add.rectangle(
        obs.x * TILE_SIZE + TILE_SIZE/2,
        obs.y * TILE_SIZE + TILE_SIZE/2,
        TILE_SIZE - 2,
        TILE_SIZE - 2,
        0x4a4a5a
      );
      this.walls.add(wall);
      this.physics.add.existing(wall, true);
    });

  }

  collectDataCore(player, dataCore) {
    if (!this.hasDataCore) {
      this.hasDataCore = true;
      dataCore.setVisible(false);
      if (dataCore.body) dataCore.body.enable = false;
      sfx.collect();
      this.objectiveText.setText('[✓] Data Core');
      this.objectiveText.setFill('#00ff00');
      this.statusText.setText('Exit unlocked! Escape now!');
      this.statusText.setFill('#00ffaa');
      this.exitZone.fillColor = 0x00ff66;
      this.exitZone.fillAlpha = 0.3;
      this.exitText.setText('OPEN');
      this.exitText.setFill('#00ff66');
      this.cameras.main.flash(200, 0, 255, 100);
    }
  }

  reachExit(player, exit) {
    if (this.hasDataCore && !this.isDetected) {
      this.winGame();
    }
  }

  recordFrame() {
    if (!this.isRunning) return;
    this.currentRun.push({
      px: this.player.x,
      py: this.player.y,
      gx: this.guard.x,
      gy: this.guard.y,
      dx: this.scannerDrone ? this.scannerDrone.x : 0,
      dy: this.scannerDrone ? this.scannerDrone.y : 0,
      time: this.elapsedTime
    });
  }

  update(time, delta) {
    if (!this.isRunning || this.isDetected) return;
    this.elapsedTime += delta;
    this.updateTimer();
    this.updatePlayer();
    this.updateGuard();
    this.updateScannerDrone();
    this.updateGhost();
    this.checkDetection();
    this.checkScannerDetection();
  }

  updateTimer() {
    let time = this.elapsedTime;
    if (this.applyTimeBonus) {
      time = Math.max(0, time - 5000);
    }
    const minutes = Math.floor(time / 60000);
    const seconds = Math.floor((time % 60000) / 1000);
    const ms = Math.floor((time % 1000) / 10);
    this.timerText.setText(
      `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
    );
  }

  updatePlayer() {
    const body = this.player.body;
    body.setVelocity(0);
    let speed = PLAYER_SPEED;
    if (this.applySpeedBoost) speed *= 1.3;

    if (this.cursors.left.isDown || this.wasd.left.isDown) body.setVelocityX(-speed);
    else if (this.cursors.right.isDown || this.wasd.right.isDown) body.setVelocityX(speed);

    if (this.cursors.up.isDown || this.wasd.up.isDown) body.setVelocityY(-speed);
    else if (this.cursors.down.isDown || this.wasd.down.isDown) body.setVelocityY(speed);

    if (body.velocity.x !== 0 && body.velocity.y !== 0) {
      body.setVelocityX(body.velocity.x * 0.707);
      body.setVelocityY(body.velocity.y * 0.707);
    }
  }

  updateGuard() {
    const target = this.guardPatrolPoints[this.currentPatrolIndex];
    const dx = target.x - this.guard.x;
    const dy = target.y - this.guard.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 5) {
      this.currentPatrolIndex = (this.currentPatrolIndex + 1) % this.guardPatrolPoints.length;
    } else {
      this.guardAngle = Math.atan2(dy, dx);
      this.guard.body.setVelocity((dx / dist) * GUARD_SPEED, (dy / dist) * GUARD_SPEED);
    }
    this.updateVisionCone();
  }

  updateScannerDrone() {
    if (!this.scannerDrone) return;
    
    const target = this.scannerDronePatrolPoints[this.scannerPatrolIndex];
    const dx = target.x - this.scannerDrone.x;
    const dy = target.y - this.scannerDrone.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < 5) {
      this.scannerPatrolIndex = (this.scannerPatrolIndex + 1) % this.scannerDronePatrolPoints.length;
    } else {
      this.scannerDrone.body.setVelocity((dx / dist) * 50, (dy / dist) * 50);
    }
    
    this.scannerAngle += this.scannerDirection * 0.03;
    if (this.scannerAngle > Math.PI) { this.scannerAngle = Math.PI; this.scannerDirection = -1; }
    else if (this.scannerAngle < 0) { this.scannerAngle = 0; this.scannerDirection = 1; }
    
    this.scannerBeam.clear();
    const beamLength = 120;
    this.scannerBeam.fillStyle(0x9900ff, 0.2);
    this.scannerBeam.beginPath();
    this.scannerBeam.moveTo(this.scannerDrone.x, this.scannerDrone.y);
    const leftAngle = this.scannerAngle - 0.2;
    const rightAngle = this.scannerAngle + 0.2;
    this.scannerBeam.lineTo(this.scannerDrone.x + Math.cos(leftAngle) * beamLength, this.scannerDrone.y + Math.sin(leftAngle) * beamLength);
    this.scannerBeam.lineTo(this.scannerDrone.x + Math.cos(rightAngle) * beamLength, this.scannerDrone.y + Math.sin(rightAngle) * beamLength);
    this.scannerBeam.closePath();
    this.scannerBeam.fillPath();
    this.scannerBeam.lineStyle(1, 0xcc66ff, 0.4);
    this.scannerBeam.beginPath();
    this.scannerBeam.moveTo(this.scannerDrone.x, this.scannerDrone.y);
    this.scannerBeam.lineTo(this.scannerDrone.x + Math.cos(leftAngle) * beamLength, this.scannerDrone.y + Math.sin(leftAngle) * beamLength);
    this.scannerBeam.strokePath();
  }

  updateVisionCone() {
    this.visionGraphics.clear();
    if (!this.isRunning) return;
    
    const coneLength = VISION_CONE_DISTANCE;
    const halfAngle = (VISION_CONE_ANGLE * Math.PI) / 360;
    const tipX = this.guard.x;
    const tipY = this.guard.y;
    const leftAngle = this.guardAngle - halfAngle;
    const rightAngle = this.guardAngle + halfAngle;
    const leftX = tipX + Math.cos(leftAngle) * coneLength;
    const leftY = tipY + Math.sin(leftAngle) * coneLength;
    const rightX = tipX + Math.cos(rightAngle) * coneLength;
    const rightY = tipY + Math.sin(rightAngle) * coneLength;
    const stealthReduction = this.applyStealth ? 0.6 : 1.0;
    
    this.visionGraphics.fillStyle(0xffff00, 0.15 * stealthReduction);
    this.visionGraphics.beginPath();
    this.visionGraphics.moveTo(tipX, tipY);
    this.visionGraphics.lineTo(leftX, leftY);
    this.visionGraphics.lineTo(rightX, rightY);
    this.visionGraphics.closePath();
    this.visionGraphics.fillPath();
    
    this.visionGraphics.lineStyle(1, 0xffff00, 0.3 * stealthReduction);
    this.visionGraphics.beginPath();
    this.visionGraphics.moveTo(tipX, tipY);
    this.visionGraphics.lineTo(leftX, leftY);
    this.visionGraphics.strokePath();
    this.visionGraphics.beginPath();
    this.visionGraphics.moveTo(tipX, tipY);
    this.visionGraphics.lineTo(rightX, rightY);
    this.visionGraphics.strokePath();
  }

  checkDetection() {
    if (this.isDetected) return;
    const dx = this.player.x - this.guard.x;
    const dy = this.player.y - this.guard.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > VISION_CONE_DISTANCE) return;
    
    const angleToPlayer = Math.atan2(dy, dx);
    let angleDiff = angleToPlayer - this.guardAngle;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    
    const halfAngle = this.applyStealth ? ((VISION_CONE_ANGLE * Math.PI) / 360) * 1.5 : (VISION_CONE_ANGLE * Math.PI) / 360;
    
    if (Math.abs(angleDiff) < halfAngle) {
      if (!this.isLineBlocked(this.guard.x, this.guard.y, this.player.x, this.player.y)) {
        this.detected();
      }
    }
    if (dist < TILE_SIZE) this.detected();
  }

  checkScannerDetection() {
    if (this.isDetected || !this.scannerDrone) return;
    const dx = this.player.x - this.scannerDrone.x;
    const dy = this.player.y - this.scannerDrone.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 120) return;
    
    const angleToPlayer = Math.atan2(dy, dx);
    let angleDiff = angleToPlayer - this.scannerAngle;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    
    if (Math.abs(angleDiff) < 0.3) {
      if (!this.isLineBlocked(this.scannerDrone.x, this.scannerDrone.y, this.player.x, this.player.y)) {
        this.detected();
      }
    }
  }

  isLineBlocked(x1, y1, x2, y2) {
    const steps = Math.ceil(Math.sqrt((x2-x1)**2 + (y2-y1)**2) / (TILE_SIZE / 4));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const checkX = x1 + (x2 - x1) * t;
      const checkY = y1 + (y2 - y1) * t;
      for (const wall of this.walls.getChildren()) {
        if (wall.body) {
          const bounds = wall.getBounds();
          if (checkX >= bounds.left && checkX <= bounds.right && checkY >= bounds.top && checkY <= bounds.bottom) {
            return true;
          }
        }
      }
    }
    return false;
  }

  detected() {
    if (this.isDetected) return;
    this.isDetected = true;
    this.isRunning = false;
    sfx.alert();
    this.alarmActive = true;
    this.tweens.add({ targets: this.vignette, alpha: 0.4, duration: 100, yoyo: true, repeat: 5 });
    this.cameras.main.shake(300, 0.02);
    this.cameras.main.flash(300, 255, 0, 0);
    this.showFailBanner();
  }

  showFailBanner() {
    const overlay = this.add.rectangle(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE, 0x000000, 0.7);
    const banner = this.add.rectangle(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2 - 30, 280, 80, 0x330000, 0.9);
    banner.setStrokeStyle(2, 0xff4444);
    const t1 = this.add.text(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2 - 45, 'DETECTED!', { fontSize: '28px', fill: '#ff4444', fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(0.5);
    const t2 = this.add.text(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2 - 10, 'The guard spotted you!', { fontSize: '14px', fill: '#ff8888', fontFamily: 'Courier New' }).setOrigin(0.5);
    const t3 = this.add.text(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2 + 20, 'Press R to retry', { fontSize: '16px', fill: '#ffffff', fontFamily: 'Courier New' }).setOrigin(0.5);
    this.transientUi.push(overlay, banner, t1, t2, t3);
  }

  updateGhost() {
    if (!this.previousRun || this.ghostFrame >= this.previousRun.length) {
      this.ghost.setVisible(false);
      this.ghostTrail.forEach(t => t.destroy());
      this.ghostTrail = [];
      return;
    }
    const frame = this.previousRun[this.ghostFrame];
    const prevFrame = this.ghostFrame > 0 ? this.previousRun[this.ghostFrame - 1] : frame;
    const t = 0.5;
    this.ghost.x = prevFrame.px + (frame.px - prevFrame.px) * t;
    this.ghost.y = prevFrame.py + (frame.py - prevFrame.py) * t;
    this.ghost.setVisible(true);
    this.addGhostTrailPoint(this.ghost.x, this.ghost.y);
    this.ghostFrame++;
  }

  addGhostTrailPoint(x, y) {
    const trail = this.add.rectangle(x, y, TILE_SIZE / 3, TILE_SIZE / 3, 0x88ffff);
    trail.setAlpha(GHOST_ALPHA * 0.5);
    this.ghostTrail.push(trail);
    if (this.ghostTrail.length > GHOST_TRAIL_LENGTH) {
      const oldTrail = this.ghostTrail.shift();
      oldTrail.destroy();
    }
    this.ghostTrail.forEach((tr, i) => {
      const alpha = (i / this.ghostTrail.length) * GHOST_ALPHA * 0.5;
      tr.setAlpha(alpha);
    });
  }

  winGame() {
    this.isRunning = false;
    sfx.win();
    this.cameras.main.flash(500, 0, 255, 100);
    this.showUpgradeSelection();
  }

  showUpgradeSelection() {
    const overlay = this.add.rectangle(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2, MAP_WIDTH * TILE_SIZE, MAP_HEIGHT * TILE_SIZE, 0x000000, 0.8);
    const banner = this.add.rectangle(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2 - 80, 320, 50, 0x003300, 0.9);
    banner.setStrokeStyle(2, 0x00ff66);
    const t1 = this.add.text(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2 - 95, 'ESCAPED!', { fontSize: '32px', fill: '#00ff66', fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(0.5);
    const t2 = this.add.text(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2 - 55, `Time: ${this.timerText.text}`, { fontSize: '16px', fill: '#88ffaa', fontFamily: 'Courier New' }).setOrigin(0.5);
    const t3 = this.add.text(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2 - 20, 'Choose an upgrade:', { fontSize: '14px', fill: '#ffffff', fontFamily: 'Courier New' }).setOrigin(0.5);
    
    // Option 1: Speed Boost
    const opt1 = this.add.rectangle(MAP_WIDTH * TILE_SIZE / 2 - 100, MAP_HEIGHT * TILE_SIZE / 2 + 30, 160, 60, 0x224466, 0.9);
    opt1.setStrokeStyle(2, 0x4488ff);
    const t4 = this.add.text(MAP_WIDTH * TILE_SIZE / 2 - 100, MAP_HEIGHT * TILE_SIZE / 2 + 15, 'SPEED', { fontSize: '16px', fill: '#88ccff', fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(0.5);
    const t5 = this.add.text(MAP_WIDTH * TILE_SIZE / 2 - 100, MAP_HEIGHT * TILE_SIZE / 2 + 35, '+30% Movement', { fontSize: '11px', fill: '#aaaacc', fontFamily: 'Courier New' }).setOrigin(0.5);
    
    // Option 2: Stealth
    const opt2 = this.add.rectangle(MAP_WIDTH * TILE_SIZE / 2 + 100, MAP_HEIGHT * TILE_SIZE / 2 + 30, 160, 60, 0x224466, 0.9);
    opt2.setStrokeStyle(2, 0x4488ff);
    const t6 = this.add.text(MAP_WIDTH * TILE_SIZE / 2 + 100, MAP_HEIGHT * TILE_SIZE / 2 + 15, 'STEALTH', { fontSize: '16px', fill: '#88ccff', fontFamily: 'Courier New', fontStyle: 'bold' }).setOrigin(0.5);
    const t7 = this.add.text(MAP_WIDTH * TILE_SIZE / 2 + 100, MAP_HEIGHT * TILE_SIZE / 2 + 35, 'Wider cone', { fontSize: '11px', fill: '#aaaacc', fontFamily: 'Courier New' }).setOrigin(0.5);
    
    const t8 = this.add.text(MAP_WIDTH * TILE_SIZE / 2 - 100, MAP_HEIGHT * TILE_SIZE / 2 + 75, '[1] Select', { fontSize: '12px', fill: '#666688', fontFamily: 'Courier New' }).setOrigin(0.5);
    const t9 = this.add.text(MAP_WIDTH * TILE_SIZE / 2 + 100, MAP_HEIGHT * TILE_SIZE / 2 + 75, '[2] Select', { fontSize: '12px', fill: '#666688', fontFamily: 'Courier New' }).setOrigin(0.5);

    this.transientUi.push(overlay, banner, opt1, opt2, t1, t2, t3, t4, t5, t6, t7, t8, t9);
    
    // Listen for upgrade selection
    this.selectionMade = false;
    this.input.keyboard.on('keydown-ONE', () => this.selectUpgrade(1));
    this.input.keyboard.on('keydown-TWO', () => this.selectUpgrade(2));
  }

  selectUpgrade(choice) {
    if (this.selectionMade) return;
    this.selectionMade = true;
    sfx.select();
    
    if (choice === 1) {
      this.applySpeedBoost = true;
      this.statusText.setText('Speed Boost activated!');
    } else if (choice === 2) {
      this.applyStealth = true;
      this.statusText.setText('Stealth Mode activated!');
    }
    
    // Brief pause then restart
    this.time.delayedCall(500, () => {
      this.restart();
    });
  }

  restart() {
    // Save current run as previous for ghost replay
    if (this.currentRun.length > 0) {
      this.previousRun = [...this.currentRun];
    }

    // Reset detection state
    this.isDetected = false;
    this.alarmActive = false;
    
    // Reset positions
    const startPos = this.currentLayout.playerStart;
    this.player.x = startPos.x * TILE_SIZE;
    this.player.y = startPos.y * TILE_SIZE;
    this.guard.x = TILE_SIZE * 15;
    this.guard.y = TILE_SIZE * 7;
    this.currentPatrolIndex = 0;
    this.ghostFrame = 0;
    
    // Reset scanner drone
    if (this.scannerDrone) {
      this.scannerDrone.x = 10 * TILE_SIZE;
      this.scannerDrone.y = 10 * TILE_SIZE;
      this.scannerPatrolIndex = 0;
    }
    
    // Reset ghost trail
    this.ghostTrail.forEach(t => t.destroy());
    this.ghostTrail = [];
    this.ghost.setVisible(false);

    // Reset objective
    this.hasDataCore = false;
    this.objectiveText.setText('[○] Data Core');
    this.objectiveText.setFill('#ffaa00');
    this.statusText.setText('Sneak to the data core!');
    this.statusText.setFill('#666666');
    
    // Reset existing data core safely (avoid replacing overlap targets)
    const dcPos = this.currentLayout.dataCore;
    this.dataCore.x = dcPos.x * TILE_SIZE;
    this.dataCore.y = dcPos.y * TILE_SIZE;
    this.dataCore.setVisible(true);
    if (this.dataCore.body) {
      this.dataCore.body.enable = true;
      if (typeof this.dataCore.body.updateFromGameObject === 'function') {
        this.dataCore.body.updateFromGameObject();
      }
    }
    this.dataCore.alpha = 1;
    
    this.tweens.add({
      targets: this.dataCore,
      alpha: 0.6,
      duration: 500,
      yoyo: true,
      repeat: -1
    });
    
    // Reset exit zone
    const exitPos = this.currentLayout.exitZone;
    this.exitZone.x = exitPos.x * TILE_SIZE;
    this.exitZone.y = exitPos.y * TILE_SIZE;
    this.exitZone.fillColor = 0x222222;
    this.exitZone.fillAlpha = 0.5;
    this.exitText.x = exitPos.x * TILE_SIZE;
    this.exitText.y = exitPos.y * TILE_SIZE;
    this.exitText.setText('LOCKED');
    this.exitText.setFill('#ff4444');

    // Reset timer
    this.elapsedTime = 0;
    this.currentRun = [];
    this.isRunning = true;

    // Update run counter
    this.runCount++;
    this.runText.setText(`Run: ${this.runCount}`);

    // Clear only transient overlays (never destroy gameplay objects)
    this.transientUi.forEach((obj) => {
      if (obj && obj.active) obj.destroy();
    });
    this.transientUi = [];

    // Reset vignette
    this.vignette.setAlpha(0);
  }
}

class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create() {
    // Title
    this.add.text(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2 - 60, 'GHOSTSHIFT', {
      fontSize: '48px',
      fill: '#4488ff',
      fontFamily: 'Courier New',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    // Subtitle
    this.add.text(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2 - 10, 'Stealth Mission', {
      fontSize: '16px',
      fill: '#88aacc',
      fontFamily: 'Courier New'
    }).setOrigin(0.5);
    
    // Instructions
    const instructions = [
      '-> Collect the DATA CORE (orange)',
      '-> Avoid the GUARD vision cone (yellow)',
      '-> Avoid the SCANNER DRONE beam (purple)',
      '-> Reach the EXIT (right side)',
      '-> Ghost shows your previous run'
    ];
    
    instructions.forEach((text, i) => {
      this.add.text(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE / 2 + 40 + i * 24, text, {
        fontSize: '14px',
        fill: '#666688',
        fontFamily: 'Courier New'
      }).setOrigin(0.5);
    });
    
    // Start prompt
    const startText = this.add.text(MAP_WIDTH * TILE_SIZE / 2, MAP_HEIGHT * TILE_SIZE - 50, 'Press any key to start', {
      fontSize: '16px',
      fill: '#00ffaa',
      fontFamily: 'Courier New'
    }).setOrigin(0.5);
    
    // Blink effect
    this.tweens.add({
      targets: startText,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1
    });

    this.input.keyboard.once('keydown', () => {
      this.scene.start('MainScene');
    });
  }
}

// Game configuration
const config = {
  type: Phaser.AUTO,
  width: MAP_WIDTH * TILE_SIZE,
  height: MAP_HEIGHT * TILE_SIZE,
  parent: 'game-container',
  physics: {
    default: 'arcade',
    arcade: {
      debug: false
    }
  },
  scene: [BootScene, MainScene],
  backgroundColor: '#0a0a0f'
};

// Initialize game
const game = new Phaser.Game(config);
window.__ghostGame = game;

// Handle restart key globally
document.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') {
    const mainScene = game.scene.getScene('MainScene');
    if (mainScene) {
      mainScene.restart();
    }
  }
});