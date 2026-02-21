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

class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainScene' });
    this.player = null;
    this.guard = null;
    this.ghost = null;
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
  }

  create() {
    // Create map bounds
    this.createMap();

    // Create player (blue square)
    this.player = this.add.rectangle(TILE_SIZE * 2, TILE_SIZE * 2, TILE_SIZE - 8, TILE_SIZE - 8, 0x4488ff);
    this.player.setStrokeStyle(2, 0x88ccff);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);

    // Create guard (red square)
    this.guard = this.add.rectangle(TILE_SIZE * 15, TILE_SIZE * 7, TILE_SIZE - 8, TILE_SIZE - 8, 0xff4444);
    this.guard.setStrokeStyle(2, 0xff8888);
    this.physics.add.existing(this.guard);
    this.guard.body.setCollideWorldBounds(true);
    
    // Setup guard patrol path
    this.guardPatrolPoints = [
      { x: TILE_SIZE * 15, y: TILE_SIZE * 7 },
      { x: TILE_SIZE * 5, y: TILE_SIZE * 7 },
      { x: TILE_SIZE * 5, y: TILE_SIZE * 12 },
      { x: TILE_SIZE * 15, y: TILE_SIZE * 12 }
    ];

    // Create vision cone (triangle shape)
    this.createVisionCone();

    // Create data core (collectible objective)
    this.dataCore = this.add.rectangle(TILE_SIZE * 16, TILE_SIZE * 3, TILE_SIZE - 4, TILE_SIZE - 4, 0xffaa00);
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

    // Create exit zone (initially locked)
    this.exitZone = this.add.rectangle(
      MAP_WIDTH * TILE_SIZE - TILE_SIZE / 2,
      MAP_HEIGHT * TILE_SIZE / 2,
      TILE_SIZE * 2,
      TILE_SIZE * 3,
      0x222222,
      0.5
    );
    this.physics.add.existing(this.exitZone, true);
    
    // Exit indicator text
    this.exitText = this.add.text(
      MAP_WIDTH * TILE_SIZE - TILE_SIZE / 2,
      MAP_HEIGHT * TILE_SIZE / 2,
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

  createVisionCone() {
    // Create a triangle graphics for vision cone
    const graphics = this.add.graphics();
    
    // Store the graphics for updating
    this.visionGraphics = graphics;
    
    // Initial position (will be updated in updateGuard)
    this.visionCone = {
      graphics: graphics,
      points: []
    };
  }

  createUI() {
    // Timer display
    this.timerText = this.add.text(10, 10, '00:00.00', { 
      fontSize: '24px', 
      fill: '#00ffaa',
      fontFamily: 'Courier New'
    });
    
    // Run counter
    this.runText = this.add.text(10, 40, 'Run: 1', { 
      fontSize: '14px', 
      fill: '#888888',
      fontFamily: 'Courier New'
    });

    // Objective status
    this.objectiveText = this.add.text(10, 60, '[○] Data Core', { 
      fontSize: '14px', 
      fill: '#ffaa00',
      fontFamily: 'Courier New'
    });

    // Status message
    this.statusText = this.add.text(10, 85, 'Sneak to the data core!', { 
      fontSize: '12px', 
      fill: '#666666',
      fontFamily: 'Courier New'
    });

    // Controls hint
    this.add.text(10, MAP_HEIGHT * TILE_SIZE - 25, 'ARROWS/WASD: Move | R: Restart', { 
      fontSize: '11px', 
      fill: '#444455',
      fontFamily: 'Courier New'
    });
  }

  createMap() {
    // Create background
    this.add.rectangle(
      MAP_WIDTH * TILE_SIZE / 2,
      MAP_HEIGHT * TILE_SIZE / 2,
      MAP_WIDTH * TILE_SIZE,
      MAP_HEIGHT * TILE_SIZE,
      0x1a1a2a
    );

    // Create walls (border)
    const wallColor = 0x3a3a4a;
    this.walls = this.add.group();

    // Top and bottom walls
    for (let x = 0; x < MAP_WIDTH; x++) {
      this.walls.add(this.add.rectangle(x * TILE_SIZE + TILE_SIZE/2, TILE_SIZE/2, TILE_SIZE, TILE_SIZE, wallColor));
      this.walls.add(this.add.rectangle(x * TILE_SIZE + TILE_SIZE/2, MAP_HEIGHT * TILE_SIZE - TILE_SIZE/2, TILE_SIZE, TILE_SIZE, wallColor));
    }

    // Left and right walls
    for (let y = 1; y < MAP_HEIGHT - 1; y++) {
      this.walls.add(this.add.rectangle(TILE_SIZE/2, y * TILE_SIZE + TILE_SIZE/2, TILE_SIZE, TILE_SIZE, wallColor));
      this.walls.add(this.add.rectangle(MAP_WIDTH * TILE_SIZE - TILE_SIZE/2, y * TILE_SIZE + TILE_SIZE/2, TILE_SIZE, TILE_SIZE, wallColor));
    }

    // Add obstacles
    const obstacles = [
      { x: 8, y: 4 }, { x: 9, y: 4 }, { x: 10, y: 4 },
      { x: 8, y: 5 }, { x: 10, y: 5 },
      { x: 8, y: 6 }, { x: 10, y: 6 },
      { x: 3, y: 10 }, { x: 4, y: 10 },
      { x: 14, y: 8 }, { x: 15, y: 8 },
      { x: 12, y: 3 }, { x: 13, y: 3 },
      { x: 6, y: 8 }, { x: 7, y: 8 }
    ];

    obstacles.forEach(obs => {
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

    // Colliders
    this.physics.add.collider(this.player, this.walls);
    this.physics.add.collider(this.guard, this.walls);
    
    // Overlap for data core
    this.physics.add.overlap(this.player, this.dataCore, this.collectDataCore, null, this);
    
    // Overlap for exit
    this.physics.add.overlap(this.player, this.exitZone, this.reachExit, null, this);
  }

  collectDataCore(player, dataCore) {
    if (!this.hasDataCore) {
      this.hasDataCore = true;
      dataCore.destroy();
      
      // Update objective text
      this.objectiveText.setText('[✓] Data Core');
      this.objectiveText.setFill('#00ff00');
      this.statusText.setText('Exit unlocked! Escape now!');
      this.statusText.setFill('#00ffaa');
      
      // Unlock exit zone
      this.exitZone.fillColor = 0x00ff66;
      this.exitZone.fillAlpha = 0.3;
      this.exitText.setText('OPEN');
      this.exitText.setFill('#00ff66');
      
      // Flash effect
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
      time: this.elapsedTime
    });
  }

  update(time, delta) {
    if (!this.isRunning || this.isDetected) return;

    this.elapsedTime += delta;
    this.updateTimer();
    this.updatePlayer();
    this.updateGuard();
    this.updateGhost();
    this.checkDetection();
  }

  updateTimer() {
    const minutes = Math.floor(this.elapsedTime / 60000);
    const seconds = Math.floor((this.elapsedTime % 60000) / 1000);
    const ms = Math.floor((this.elapsedTime % 1000) / 10);
    this.timerText.setText(
      `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
    );
  }

  updatePlayer() {
    const body = this.player.body;
    body.setVelocity(0);

    if (this.cursors.left.isDown || this.wasd.left.isDown) {
      body.setVelocityX(-PLAYER_SPEED);
    } else if (this.cursors.right.isDown || this.wasd.right.isDown) {
      body.setVelocityX(PLAYER_SPEED);
    }

    if (this.cursors.up.isDown || this.wasd.up.isDown) {
      body.setVelocityY(-PLAYER_SPEED);
    } else if (this.cursors.down.isDown || this.wasd.down.isDown) {
      body.setVelocityY(PLAYER_SPEED);
    }

    // Normalize diagonal movement
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
      // Calculate guard angle for vision cone
      this.guardAngle = Math.atan2(dy, dx);
      
      this.guard.body.setVelocity(
        (dx / dist) * GUARD_SPEED,
        (dy / dist) * GUARD_SPEED
      );
    }

    // Update vision cone
    this.updateVisionCone();
  }

  updateVisionCone() {
    this.visionGraphics.clear();
    
    // Only show vision cone when guard is active
    if (!this.isRunning) return;
    
    const coneLength = VISION_CONE_DISTANCE;
    const halfAngle = (VISION_CONE_ANGLE * Math.PI) / 360;
    
    // Calculate cone points
    const tipX = this.guard.x;
    const tipY = this.guard.y;
    
    const leftAngle = this.guardAngle - halfAngle;
    const rightAngle = this.guardAngle + halfAngle;
    
    const leftX = tipX + Math.cos(leftAngle) * coneLength;
    const leftY = tipY + Math.sin(leftAngle) * coneLength;
    
    const rightX = tipX + Math.cos(rightAngle) * coneLength;
    const rightY = tipY + Math.sin(rightAngle) * coneLength;
    
    // Draw vision cone (yellow, semi-transparent)
    this.visionGraphics.fillStyle(0xffff00, 0.15);
    this.visionGraphics.beginPath();
    this.visionGraphics.moveTo(tipX, tipY);
    this.visionGraphics.lineTo(leftX, leftY);
    this.visionGraphics.lineTo(rightX, rightY);
    this.visionGraphics.closePath();
    this.visionGraphics.fillPath();
    
    // Draw cone outline
    this.visionGraphics.lineStyle(1, 0xffff00, 0.3);
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
    
    // Calculate distance to guard
    const dx = this.player.x - this.guard.x;
    const dy = this.player.y - this.guard.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > VISION_CONE_DISTANCE) return;
    
    // Check if player is within vision cone angle
    const angleToPlayer = Math.atan2(dy, dx);
    let angleDiff = angleToPlayer - this.guardAngle;
    
    // Normalize angle difference to -PI to PI
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    
    const halfAngle = (VISION_CONE_ANGLE * Math.PI) / 360;
    
    if (Math.abs(angleDiff) < halfAngle) {
      // Check for wall obstruction using raycast
      if (!this.isLineBlocked(this.guard.x, this.guard.y, this.player.x, this.player.y)) {
        this.detected();
      }
    }
    
    // Also detect if player is very close (touching guard)
    if (dist < TILE_SIZE) {
      this.detected();
    }
  }

  isLineBlocked(x1, y1, x2, y2) {
    // Simple line-of-sight check against walls
    const steps = Math.ceil(Math.sqrt((x2-x1)**2 + (y2-y1)**2) / (TILE_SIZE / 4));
    
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const checkX = x1 + (x2 - x1) * t;
      const checkY = y1 + (y2 - y1) * t;
      
      // Check if point is inside any wall
      for (const wall of this.walls.getChildren()) {
        if (wall.body) {
          const bounds = wall.getBounds();
          if (checkX >= bounds.left && checkX <= bounds.right &&
              checkY >= bounds.top && checkY <= bounds.bottom) {
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
    
    // Alarm effects
    this.alarmActive = true;
    
    // Red vignette effect
    this.tweens.add({
      targets: this.vignette,
      alpha: 0.4,
      duration: 100,
      yoyo: true,
      repeat: 5
    });
    
    // Screen shake
    this.cameras.main.shake(300, 0.02);
    
    // Flash red
    this.cameras.main.flash(300, 255, 0, 0);
    
    // Show detected message
    this.showFailBanner();
  }

  showFailBanner() {
    // Dark overlay
    const overlay = this.add.rectangle(
      MAP_WIDTH * TILE_SIZE / 2,
      MAP_HEIGHT * TILE_SIZE / 2,
      MAP_WIDTH * TILE_SIZE,
      MAP_HEIGHT * TILE_SIZE,
      0x000000,
      0.7
    );
    
    // Fail banner
    const banner = this.add.rectangle(
      MAP_WIDTH * TILE_SIZE / 2,
      MAP_HEIGHT * TILE_SIZE / 2 - 30,
      280,
      80,
      0x330000,
      0.9
    );
    banner.setStrokeStyle(2, 0xff4444);
    
    this.add.text(
      MAP_WIDTH * TILE_SIZE / 2,
      MAP_HEIGHT * TILE_SIZE / 2 - 45,
      'DETECTED!',
      { fontSize: '28px', fill: '#ff4444', fontFamily: 'Courier New', fontStyle: 'bold' }
    ).setOrigin(0.5);
    
    this.add.text(
      MAP_WIDTH * TILE_SIZE / 2,
      MAP_HEIGHT * TILE_SIZE / 2 - 10,
      'The guard spotted you!',
      { fontSize: '14px', fill: '#ff8888', fontFamily: 'Courier New' }
    ).setOrigin(0.5);
    
    this.add.text(
      MAP_WIDTH * TILE_SIZE / 2,
      MAP_HEIGHT * TILE_SIZE / 2 + 20,
      'Press R to retry',
      { fontSize: '16px', fill: '#ffffff', fontFamily: 'Courier New' }
    ).setOrigin(0.5);
  }

  updateGhost() {
    if (!this.previousRun || this.ghostFrame >= this.previousRun.length) {
      this.ghost.setVisible(false);
      // Clear trail
      this.ghostTrail.forEach(t => t.destroy());
      this.ghostTrail = [];
      return;
    }

    const frame = this.previousRun[this.ghostFrame];
    
    // Smooth interpolation
    const prevFrame = this.ghostFrame > 0 ? this.previousRun[this.ghostFrame - 1] : frame;
    const t = 0.5; // Interpolate halfway
    
    this.ghost.x = prevFrame.px + (frame.px - prevFrame.px) * t;
    this.ghost.y = prevFrame.py + (frame.py - prevFrame.py) * t;
    this.ghost.setVisible(true);
    
    // Add to trail
    this.addGhostTrailPoint(this.ghost.x, this.ghost.y);
    
    // Update guard ghost position (optional - can show guard replay too)
    // This would require storing guard positions in the replay
    
    this.ghostFrame++;
  }

  addGhostTrailPoint(x, y) {
    // Create trail particle
    const trail = this.add.rectangle(x, y, TILE_SIZE / 3, TILE_SIZE / 3, 0x88ffff);
    trail.setAlpha(GHOST_ALPHA * 0.5);
    
    this.ghostTrail.push(trail);
    
    // Fade out old trail points
    if (this.ghostTrail.length > GHOST_TRAIL_LENGTH) {
      const oldTrail = this.ghostTrail.shift();
      oldTrail.destroy();
    }
    
    // Fade all trail points
    this.ghostTrail.forEach((t, i) => {
      const alpha = (i / this.ghostTrail.length) * GHOST_ALPHA * 0.5;
      t.setAlpha(alpha);
    });
  }

  winGame() {
    this.isRunning = false;
    
    // Success flash
    this.cameras.main.flash(500, 0, 255, 100);
    
    // Show win overlay
    const overlay = this.add.rectangle(
      MAP_WIDTH * TILE_SIZE / 2,
      MAP_HEIGHT * TILE_SIZE / 2,
      MAP_WIDTH * TILE_SIZE,
      MAP_HEIGHT * TILE_SIZE,
      0x000000,
      0.7
    );
    
    // Win banner
    const banner = this.add.rectangle(
      MAP_WIDTH * TILE_SIZE / 2,
      MAP_HEIGHT * TILE_SIZE / 2 - 30,
      300,
      120,
      0x003300,
      0.9
    );
    banner.setStrokeStyle(2, 0x00ff66);
    
    this.add.text(
      MAP_WIDTH * TILE_SIZE / 2,
      MAP_HEIGHT * TILE_SIZE / 2 - 50,
      'ESCAPED!',
      { fontSize: '32px', fill: '#00ff66', fontFamily: 'Courier New', fontStyle: 'bold' }
    ).setOrigin(0.5);
    
    this.add.text(
      MAP_WIDTH * TILE_SIZE / 2,
      MAP_HEIGHT * TILE_SIZE / 2 - 5,
      `Time: ${this.timerText.text}`,
      { fontSize: '16px', fill: '#88ffaa', fontFamily: 'Courier New' }
    ).setOrigin(0.5);
    
    this.add.text(
      MAP_WIDTH * TILE_SIZE / 2,
      MAP_HEIGHT * TILE_SIZE / 2 + 30,
      'Press R to play again',
      { fontSize: '14px', fill: '#ffffff', fontFamily: 'Courier New' }
    ).setOrigin(0.5);
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
    this.player.x = TILE_SIZE * 2;
    this.player.y = TILE_SIZE * 2;
    this.guard.x = TILE_SIZE * 15;
    this.guard.y = TILE_SIZE * 7;
    this.currentPatrolIndex = 0;
    this.ghostFrame = 0;
    
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
    
    // Recreate data core
    if (!this.dataCore.active) {
      this.dataCore = this.add.rectangle(TILE_SIZE * 16, TILE_SIZE * 3, TILE_SIZE - 4, TILE_SIZE - 4, 0xffaa00);
      this.dataCore.setStrokeStyle(2, 0xffdd44);
      this.physics.add.existing(this.dataCore, true);
      this.physics.add.overlap(this.player, this.dataCore, this.collectDataCore, null, this);
      
      this.tweens.add({
        targets: this.dataCore,
        alpha: 0.6,
        duration: 500,
        yoyo: true,
        repeat: -1
      });
    }
    
    // Reset exit zone
    this.exitZone.fillColor = 0x222222;
    this.exitZone.fillAlpha = 0.5;
    this.exitText.setText('LOCKED');
    this.exitText.setFill('#ff4444');

    // Reset timer
    this.elapsedTime = 0;
    this.currentRun = [];
    this.isRunning = true;

    // Update run counter
    this.runCount++;
    this.runText.setText(`Run: ${this.runCount}`);

    // Clear any overlays/banners
    this.children.list
      .filter(child => child.type === 'Rectangle' && child.fillAlpha >= 0.7)
      .forEach(child => {
        if (child !== this.vignette) child.destroy();
      });
    this.children.list
      .filter(child => child.type === 'Text' && (child.text.includes('DETECTED') || child.text.includes('ESCAPED')))
      .forEach(child => child.destroy());
      
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
      '▸ Collect the DATA CORE (orange)',
      '▸ Avoid the GUARD vision cone (yellow)',
      '▸ Reach the EXIT (right side)',
      '▸ Ghost shows your previous run'
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

// Handle restart key globally
document.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') {
    const mainScene = game.scene.getScene('MainScene');
    if (mainScene) {
      mainScene.restart();
    }
  }
});
