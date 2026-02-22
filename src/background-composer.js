// ==================== BACKGROUND COMPOSER ====================
// Premium cyber-heist background system for GhostShift menus
// Provides layered visual design with scene-specific variants

// Note: saveManager is accessed via window.saveManager (set in main.js)

// Background layer types
const LAYER_DEPTHS = {
  BASE: -10,
  GRADIENT: -9,
  SCANLINES: -8,
  ARCHITECTURAL: -7,
  GRID: -6,
  FOG: -5,
  LIGHT_ACCENTS: -4,
  VIGNETTE: -3
};

// Quality presets
const QUALITY_PRESETS = {
  low: {
    gridAnimationDelay: 200,
    particleCount: 5,
    fogEnabled: false,
    lightAccentCount: 1,
    architecturalDetail: 'minimal',
    shadowBlur: 0
  },
  medium: {
    gridAnimationDelay: 100,
    particleCount: 10,
    fogEnabled: true,
    lightAccentCount: 2,
    architecturalDetail: 'standard',
    shadowBlur: 4
  },
  high: {
    gridAnimationDelay: 50,
    particleCount: 20,
    fogEnabled: true,
    lightAccentCount: 3,
    architecturalDetail: 'detailed',
    shadowBlur: 8
  }
};

export class BackgroundComposer {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.width = scene.scale.width;
    this.height = scene.scale.height;
    
    // Get quality settings
    this.quality = this._getQuality(options.quality);
    this.qualitySettings = QUALITY_PRESETS[this.quality];
    
    // Scene variant type
    this.variant = options.variant || 'default';
    
    // Cache for static layers
    this.cachedLayers = new Map();
    this.animationTimers = [];
    this.particles = [];
    this.lightAccents = [];
    
    // Initialize the background
    this.create();
  }
  
  _getQuality(override) {
    if (override) return override;
    // Check reduced motion setting - access via window for cross-file access
    const sm = typeof window !== 'undefined' ? window.saveManager : null;
    if (sm?.getSetting?.('reducedMotion')) return 'low';
    // Check effects quality setting
    const effectsQuality = sm?.getSetting?.('effectsQuality') || 'high';
    return effectsQuality;
  }
  
  create() {
    // Create layers based on variant
    switch (this.variant) {
      case 'hero':
        this._createHeroVariant();
        break;
      case 'tactical':
        this._createTacticalVariant();
        break;
      case 'quiet':
        this._createQuietVariant();
        break;
      default:
        this._createStandardVariant();
    }
    
    // Start animations
    this._startAnimations();
  }
  
  // ========== BASE LAYERS ==========
  
  _createBaseLayers() {
    // 1. Deep gradient background
    const gradient = this.scene.add.graphics();
    gradient.fillGradientStyle(0x0c0c16, 0x0c0c16, 0x080810, 0x080810, 1);
    gradient.fillRect(0, 0, this.width, this.height);
    gradient.setDepth(LAYER_DEPTHS.BASE);
    this.cachedLayers.set('gradient', gradient);
    
    // 2. Ambient scanlines (static, performance-friendly)
    const scanlines = this.scene.add.graphics();
    scanlines.lineStyle(1, 0x000000, 0.04);
    for (let y = 0; y < this.height; y += 3) {
      scanlines.lineBetween(0, y, this.width, y);
    }
    scanlines.setDepth(LAYER_DEPTHS.SCANLINES);
    this.cachedLayers.set('scanlines', scanlines);
    
    // 3. Corner vignette for depth
    const vignette = this.scene.add.graphics();
    vignette.fillStyle(0x000000, 0);
    const edgeSize = 80;
    vignette.fillRect(0, 0, this.width, edgeSize);
    vignette.fillRect(0, this.height - edgeSize, this.width, edgeSize);
    vignette.fillRect(0, 0, edgeSize, this.height);
    vignette.fillRect(this.width - edgeSize, 0, edgeSize, this.height);
    vignette.setDepth(LAYER_DEPTHS.VIGNETTE);
    this.cachedLayers.set('vignette', vignette);
  }
  
  // ========== ARCHITECTURAL SILHOUETTES ==========
  
  _createArchitecturalLayer(detail = 'standard') {
    const arch = this.scene.add.graphics();
    const color = 0x1a1a2a;
    const accentColor = 0x252535;
    
    if (detail === 'minimal') {
      // Simple bottom edge
      arch.fillStyle(color, 0.8);
      arch.fillRect(0, this.height - 60, this.width, 60);
      return;
    }
    
    // Standard or detailed: Add building silhouettes
    arch.fillStyle(color, 0.6);
    
    // Bottom buildings/structures
    const buildingData = [
      { x: 0, w: 180, h: 40 },
      { x: 160, w: 100, h: 70 },
      { x: 240, w: 140, h: 50 },
      { x: 360, w: 80, h: 90 },
      { x: 420, w: 120, h: 55 },
      { x: 520, w: 100, h: 75 },
      { x: 600, w: 140, h: 45 },
      { x: 720, w: 80, h: 65 }
    ];
    
    if (this.width > 800) {
      // Add more buildings for wider screens
      buildingData.push(
        { x: 800, w: 100, h: 55 },
        { x: 880, w: 120, h: 40 },
        { x: 980, w: 80, h: 80 }
      );
    }
    
    buildingData.forEach(b => {
      arch.fillRect(b.x, this.height - b.h, b.w, b.h);
    });
    
    // Add accent windows/lights for detailed mode
    if (detail === 'detailed') {
      arch.fillStyle(accentColor, 0.4);
      buildingData.forEach((b, bi) => {
        // Random window pattern
        const seed = bi * 137;
        for (let wx = b.x + 10; wx < b.x + b.w - 10; wx += 20) {
          for (let wy = this.height - b.h + 10; wy < this.height - 15; wy += 25) {
            if ((wx + wy + seed) % 7 !== 0) {
              arch.fillRect(wx, wy, 8, 12);
            }
          }
        }
      });
    }
    
    arch.setDepth(LAYER_DEPTHS.ARCHITECTURAL);
    this.cachedLayers.set('architectural', arch);
  }
  
  // ========== TACTICAL GRID ==========
  
  _createGridLayer() {
    this.gridGraphics = this.scene.add.graphics();
    this.gridOffset = 0;
    this.gridGraphics.setDepth(LAYER_DEPTHS.GRID);
    this.cachedLayers.set('grid', this.gridGraphics);
    
    // Initial draw
    this._drawGrid();
  }
  
  _drawGrid() {
    if (!this.gridGraphics) return;
    
    this.gridGraphics.clear();
    
    const tileSize = 32;
    const primaryColor = 0x1a2a3a;
    const secondaryColor = 0x2a4060;
    const primaryAlpha = 0.35;
    const secondaryAlpha = 0.12;
    
    // Primary grid lines
    this.gridGraphics.lineStyle(1, primaryColor, primaryAlpha);
    
    // Vertical lines
    for (let x = 0; x <= this.width / tileSize + 1; x++) {
      const drawX = x * tileSize - (this.gridOffset % tileSize);
      this.gridGraphics.lineBetween(drawX, 0, drawX, this.height);
    }
    
    // Horizontal lines (slower movement)
    const yOffset = this.gridOffset * 0.5;
    for (let y = 0; y <= this.height / tileSize + 1; y++) {
      const drawY = y * tileSize - (yOffset % tileSize);
      this.gridGraphics.lineBetween(0, drawY, this.width, drawY);
    }
    
    // Secondary accent lines - every 4th for performance
    if (this.quality !== 'low') {
      this.gridGraphics.lineStyle(1, secondaryColor, secondaryAlpha);
      for (let x = 0; x <= this.width / tileSize; x += 4) {
        const drawX = x * tileSize - (this.gridOffset % tileSize);
        this.gridGraphics.lineBetween(drawX, 0, drawX, this.height);
      }
      for (let y = 0; y <= this.height / tileSize; y += 4) {
        const drawY = y * tileSize - (yOffset % tileSize);
        this.gridGraphics.lineBetween(0, drawY, this.width, drawY);
      }
    }
  }
  
  // ========== FOG LAYER ==========
  
  _createFogLayer() {
    if (!this.qualitySettings.fogEnabled) return;
    
    this.fogGraphics = this.scene.add.graphics();
    this.fogGraphics.setDepth(LAYER_DEPTHS.FOG);
    this.cachedLayers.set('fog', this.fogGraphics);
    
    // Create fog patches
    this.fogPatches = [];
    const patchCount = 5;
    
    for (let i = 0; i < patchCount; i++) {
      const patch = this.scene.add.graphics();
      const x = Math.random() * this.width;
      const y = this.height - 100 + Math.random() * 80;
      const w = 200 + Math.random() * 300;
      const h = 60 + Math.random() * 40;
      
      // Draw soft gradient fog
      patch.fillStyle(0x4488ff, 0.03);
      patch.fillEllipse(x, y, w, h);
      patch.fillStyle(0x4488ff, 0.02);
      patch.fillEllipse(x, y, w * 1.3, h * 1.3);
      
      patch.setDepth(LAYER_DEPTHS.FOG);
      this.fogPatches.push({
        graphics: patch,
        baseX: x,
        baseY: y,
        speed: 0.2 + Math.random() * 0.3,
        phase: Math.random() * Math.PI * 2
      });
    }
  }
  
  _updateFog() {
    if (!this.fogPatches) return;
    
    this.fogPatches.forEach(patch => {
      patch.phase += 0.002;
      const drift = Math.sin(patch.phase) * 20;
      patch.graphics.x = patch.baseX + drift;
    });
  }
  
  // ========== LIGHT ACCENTS ==========
  
  _createLightAccents() {
    const count = this.qualitySettings.lightAccentCount;
    const accentPositions = [
      { x: 0.08, y: 0.12, angle: -0.3 },
      { x: 0.92, y: 0.78, angle: 0.25 },
      { x: 0.5, y: 0.95, angle: -0.15 }
    ];
    
    for (let i = 0; i < count; i++) {
      const pos = accentPositions[i % accentPositions.length];
      const accent = this.scene.add.graphics();
      const startX = this.width * pos.x;
      const startY = this.height * pos.y;
      
      // Draw subtle light beam
      accent.fillStyle(0x3366cc, 0.025);
      accent.fillTriangle(
        startX, startY,
        startX + Math.cos(pos.angle - 0.1) * 300,
        startY + Math.sin(pos.angle - 0.1) * 300,
        startX + Math.cos(pos.angle + 0.1) * 300,
        startY + Math.sin(pos.angle + 0.1) * 300
      );
      
      accent.setDepth(LAYER_DEPTHS.LIGHT_ACCENTS);
      
      this.lightAccents.push({
        graphics: accent,
        baseX: startX,
        baseY: startY,
        angle: pos.angle,
        phase: Math.random() * Math.PI * 2
      });
    }
  }
  
  _updateLightAccents() {
    this.lightAccents.forEach(accent => {
      accent.phase += 0.003;
      const alpha = 0.018 + Math.sin(accent.phase * 0.4) * 0.012;
      accent.graphics.setAlpha(Math.max(0.008, Math.min(0.035, alpha)));
    });
  }
  
  // ========== PARTICLES ==========
  
  _createParticles() {
    const count = this.qualitySettings.particleCount;
    const primaryColor = 0x4488ff;
    const accentColors = [0x44ffaa, 0xffaa00, 0x66ccff];
    
    for (let i = 0; i < count; i++) {
      const color = i % 3 === 0 ? primaryColor : accentColors[Math.floor(Math.random() * accentColors.length)];
      const particle = this.scene.add.circle(
        Math.random() * this.width,
        Math.random() * this.height,
        2 + Math.random() * 3,
        color,
        0.1 + Math.random() * 0.15
      );
      particle.setDepth(LAYER_DEPTHS.LIGHT_ACCENTS - 1);
      particle.speedX = (Math.random() - 0.5) * 0.5;
      particle.speedY = (Math.random() - 0.5) * 0.5;
      this.particles.push(particle);
    }
  }
  
  _updateParticles() {
    this.particles.forEach(p => {
      p.x += p.speedX;
      p.y += p.speedY;
      if (p.x < 0) p.x = this.width;
      if (p.x > this.width) p.x = 0;
      if (p.y < 0) p.y = this.height;
      if (p.y > this.height) p.y = 0;
    });
  }
  
  // ========== VARIANTS ==========
  
  _createHeroVariant() {
    // Hero variant - Main Menu: dramatic, animated, eye-catching
    this._createBaseLayers();
    this._createArchitecturalLayer(this.qualitySettings.architecturalDetail);
    this._createGridLayer();
    this._createFogLayer();
    this._createLightAccents();
    this._createParticles();
  }
  
  _createTacticalVariant() {
    // Tactical variant - Level Select: data-focused, clean, functional
    this._createBaseLayers();
    this._createArchitecturalLayer('minimal');
    this._createGridLayer();
    // No fog for cleaner tactical look
    this._createLightAccents();
    // Fewer particles for cleaner look
    this._createParticles();
  }
  
  _createQuietVariant() {
    // Quiet variant - Settings/Controls: subtle, calm, minimal distractions
    this._createBaseLayers();
    this._createArchitecturalLayer('minimal');
    this._createGridLayer();
    // Minimal fog
    if (this.qualitySettings.fogEnabled) {
      this._createFogLayer();
    }
    // Fewer light accents
    if (this.lightAccents.length < 2) {
      this._createLightAccents();
    }
  }
  
  _createStandardVariant() {
    // Default: balanced between hero and quiet
    this._createBaseLayers();
    this._createArchitecturalLayer(this.qualitySettings.architecturalDetail);
    this._createGridLayer();
    this._createFogLayer();
    this._createLightAccents();
    this._createParticles();
  }
  
  // ========== ANIMATION CONTROL ==========
  
  _startAnimations() {
    const gridDelay = this.qualitySettings.gridAnimationDelay;
    
    // Grid animation timer
    if (this.gridGraphics) {
      const gridTimer = this.scene.time.addEvent({
        delay: gridDelay,
        callback: () => {
          this.gridOffset = (this.gridOffset + 0.3) % 32;
          this._drawGrid();
        },
        loop: true
      });
      this.animationTimers.push(gridTimer);
    }
    
    // Particle animation timer (only if particles exist)
    if (this.particles.length > 0) {
      const particleTimer = this.scene.time.addEvent({
        delay: 16,
        callback: () => this._updateParticles(),
        loop: true
      });
      this.animationTimers.push(particleTimer);
    }
    
    // Light accent animation timer
    if (this.lightAccents.length > 0) {
      const lightTimer = this.scene.time.addEvent({
        delay: 50,
        callback: () => this._updateLightAccents(),
        loop: true
      });
      this.animationTimers.push(lightTimer);
    }
    
    // Fog animation timer
    if (this.fogPatches && this.fogPatches.length > 0) {
      const fogTimer = this.scene.time.addEvent({
        delay: 50,
        callback: () => this._updateFog(),
        loop: true
      });
      this.animationTimers.push(fogTimer);
    }
  }
  
  // ========== CLEANUP ==========
  
  destroy() {
    // Stop all animation timers
    this.animationTimers.forEach(timer => {
      if (timer) timer.remove();
    });
    this.animationTimers = [];
    
    // Destroy cached layers
    this.cachedLayers.forEach(layer => {
      if (layer) layer.destroy();
    });
    this.cachedLayers.clear();
    
    // Destroy particles
    this.particles.forEach(p => p.destroy());
    this.particles = [];
    
    // Destroy light accents
    this.lightAccents.forEach(a => a.graphics.destroy());
    this.lightAccents = [];
    
    // Destroy fog patches
    if (this.fogPatches) {
      this.fogPatches.forEach(f => f.graphics.destroy());
      this.fogPatches = [];
    }
  }
  
  // ========== PUBLIC API ==========
  
  // Update quality level dynamically
  setQuality(quality) {
    if (QUALITY_PRESETS[quality] && quality !== this.quality) {
      this.quality = quality;
      this.qualitySettings = QUALITY_PRESETS[quality];
      // Would need to recreate layers for quality change
      // For now, just update settings
    }
  }
  
  // Pause all animations
  pause() {
    this.animationTimers.forEach(timer => {
      if (timer) timer.paused = true;
    });
  }
  
  // Resume all animations
  resume() {
    this.animationTimers.forEach(timer => {
      if (timer) timer.paused = false;
    });
  }
  
  // Get current quality
  getQuality() {
    return this.quality;
  }
}

// Factory function for easy creation
export function createBackground(scene, variant = 'default', options = {}) {
  return new BackgroundComposer(scene, { variant, ...options });
}
