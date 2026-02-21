import Phaser from 'phaser';

// Game constants
const TILE_SIZE = 32;
const MAP_WIDTH = 20;
const MAP_HEIGHT = 15;
const PLAYER_SPEED = 200;
const GUARD_SPEED = 80;
const GHOST_ALPHA = 0.3;

class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainScene' });
    this.player = null;
    this.guard = null;
    this.ghost = null;
    this.cursors = null;
    this.wasd = null;
    this.timerText = null;
    this.runText = null;
    this.elapsedTime = 0;
    this.isRunning = false;
    this.currentRun = [];
    this.previousRun = null;
    this.ghostFrame = 0;
    this.guardPatrolPoints = [];
    this.currentPatrolIndex = 0;
    this.guardDirection = 1;
  }

  create() {
    // Create map bounds (simple bordered area)
    this.createMap();

    // Create player (blue square)
    this.player = this.add.rectangle(TILE_SIZE * 2, TILE_SIZE * 2, TILE_SIZE - 4, TILE_SIZE - 4, 0x4488ff);
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);

    // Create guard (red square)
    this.guard = this.add.rectangle(TILE_SIZE * 15, TILE_SIZE * 7, TILE_SIZE - 4, TILE_SIZE - 4, 0xff4444);
    this.physics.add.existing(this.guard);
    this.guard.body.setCollideWorldBounds(true);
    
    // Setup guard patrol path
    this.guardPatrolPoints = [
      { x: TILE_SIZE * 15, y: TILE_SIZE * 7 },
      { x: TILE_SIZE * 5, y: TILE_SIZE * 7 },
      { x: TILE_SIZE * 5, y: TILE_SIZE * 12 },
      { x: TILE_SIZE * 15, y: TILE_SIZE * 12 }
    ];

    // Create ghost (translucent, will be shown on restart)
    this.ghost = this.add.rectangle(-100, -100, TILE_SIZE - 4, TILE_SIZE - 4, 0x88ffff);
    this.ghost.setAlpha(GHOST_ALPHA);
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

    // UI
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

    this.add.text(10, 60, 'ARROWS/WASD: Move | R: Restart', { 
      fontSize: '12px', 
      fill: '#666666',
      fontFamily: 'Courier New'
    });

    // Start the game
    this.isRunning = true;
    this.currentRun = [];
    this.time.addEvent({ delay: 100, callback: this.recordFrame, callbackScope: this, loop: true });
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
    const walls = this.add.group();

    // Top and bottom walls
    for (let x = 0; x < MAP_WIDTH; x++) {
      walls.add(this.add.rectangle(x * TILE_SIZE + TILE_SIZE/2, TILE_SIZE/2, TILE_SIZE, TILE_SIZE, wallColor));
      walls.add(this.add.rectangle(x * TILE_SIZE + TILE_SIZE/2, MAP_HEIGHT * TILE_SIZE - TILE_SIZE/2, TILE_SIZE, TILE_SIZE, wallColor));
    }

    // Left and right walls
    for (let y = 1; y < MAP_HEIGHT - 1; y++) {
      walls.add(this.add.rectangle(TILE_SIZE/2, y * TILE_SIZE + TILE_SIZE/2, TILE_SIZE, TILE_SIZE, wallColor));
      walls.add(this.add.rectangle(MAP_WIDTH * TILE_SIZE - TILE_SIZE/2, y * TILE_SIZE + TILE_SIZE/2, TILE_SIZE, TILE_SIZE, wallColor));
    }

    // Add some obstacles
    const obstacles = [
      { x: 8, y: 4 }, { x: 9, y: 4 }, { x: 10, y: 4 },
      { x: 8, y: 5 }, { x: 10, y: 5 },
      { x: 8, y: 6 }, { x: 10, y: 6 },
      { x: 3, y: 10 }, { x: 4, y: 10 },
      { x: 14, y: 8 }, { x: 15, y: 8 }
    ];

    obstacles.forEach(obs => {
      const wall = this.add.rectangle(
        obs.x * TILE_SIZE + TILE_SIZE/2,
        obs.y * TILE_SIZE + TILE_SIZE/2,
        TILE_SIZE - 2,
        TILE_SIZE - 2,
        0x4a4a5a
      );
      walls.add(wall);
      this.physics.add.existing(wall, true);
    });

    this.physics.add.collider(this.player, walls);
    this.physics.add.collider(this.guard, walls);
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
    if (!this.isRunning) return;

    this.elapsedTime += delta;
    this.updateTimer();
    this.updatePlayer();
    this.updateGuard();
    this.updateGhost();
    this.checkWin();
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
      this.guard.body.setVelocity(
        (dx / dist) * GUARD_SPEED,
        (dy / dist) * GUARD_SPEED
      );
    }
  }

  updateGhost() {
    if (!this.previousRun || this.ghostFrame >= this.previousRun.length) {
      this.ghost.setVisible(false);
      return;
    }

    const frame = this.previousRun[this.ghostFrame];
    this.ghost.x = frame.px;
    this.ghost.y = frame.py;
    this.ghost.setVisible(true);
    
    // Guard ghost position
    if (this.ghost.getData('guardX') !== undefined) {
      // We could add a second ghost for the guard if desired
    }

    this.ghostFrame++;
  }

  checkWin() {
    // Simple win condition: reach the right side of the map
    if (this.player.x > MAP_WIDTH * TILE_SIZE - TILE_SIZE * 2) {
      this.winGame();
    }
  }

  winGame() {
    this.isRunning = false;
    this.add.rectangle(
      MAP_WIDTH * TILE_SIZE / 2,
      MAP_HEIGHT * TILE_SIZE / 2,
      300,
      150,
      0x000000,
      0.8
    );
    
    this.add.text(
      MAP_WIDTH * TILE_SIZE / 2,
      MAP_HEIGHT * TILE_SIZE / 2 - 20,
      'YOU ESCAPED!',
      { fontSize: '32px', fill: '#00ffaa', fontFamily: 'Courier New' }
    ).setOrigin(0.5);

    this.add.text(
      MAP_WIDTH * TILE_SIZE / 2,
      MAP_HEIGHT * TILE_SIZE /  + 30,
      `Time: ${this.timerText.text}\nPress R to play again`,
      { fontSize: '16px', fill: '#ffffff', align: 'center', fontFamily: 'Courier New' }
    ).setOrigin(0.5);
  }

  restart() {
    // Save current run as previous for ghost replay
    if (this.currentRun.length > 0) {
      this.previousRun = [...this.currentRun];
    }

    // Reset positions
    this.player.x = TILE_SIZE * 2;
    this.player.y = TILE_SIZE * 2;
    this.guard.x = TILE_SIZE * 15;
    this.guard.y = TILE_SIZE * 7;
    this.currentPatrolIndex = 0;
    this.ghostFrame = 0;

    // Reset timer
    this.elapsedTime = 0;
    this.currentRun = [];
    this.isRunning = true;

    // Update run counter
    const currentRunNum = parseInt(this.runText.text.split(':')[1]) || 1;
    this.runText.setText(`Run: ${currentRunNum + 1}`);

    // Hide any win text
    this.children.list
      .filter(child => child.type === 'Rectangle' && child.fillAlpha === 0.8)
      .forEach(child => child.destroy());
    this.children.list
      .filter(child => child.type === 'Text' && child.text.includes('ESCAPED'))
      .forEach(child => child.destroy());
  }
}

class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create() {
    this.add.text(200, 250, 'GHOSTSHIFT', {
      fontSize: '48px',
      fill: '#4488ff',
      fontFamily: 'Courier New'
    });
    
    this.add.text(200, 320, 'Press any key to start', {
      fontSize: '18px',
      fill: '#888888',
      fontFamily: 'Courier New'
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
  scene: [BootScene, MainScene]
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
