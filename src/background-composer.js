// ==================== BACKGROUND COMPOSER ====================
// Premium cyber-heist background system for GhostShift menus
// Provides layered visual design with scene-specific variants
// Now supports both image-based backgrounds and procedural elements

// Note: saveManager is accessed via window.saveManager (set in main.js)

// Background image paths (SVG format for scalability)
const BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) ? import.meta.env.BASE_URL : '/';
const withBase = (path) => `${BASE_URL}${path.replace(/^\//, '')}`;

const BACKGROUND_IMAGES = {
  'default': null,
  'hero': withBase('assets/backgrounds/main-menu.svg'),
  'tactical': withBase('assets/backgrounds/level-select.svg'),
  'quiet': withBase('assets/backgrounds/settings.svg'),
  'levelselect': withBase('assets/backgrounds/level-select.svg'),
  'settings': withBase('assets/backgrounds/settings.svg'),
  'controls': withBase('assets/backgrounds/controls.svg'),
  'results': withBase('assets/backgrounds/results.svg'),
  'victory': withBase('assets/backgrounds/victory.svg')
};

export const BACKGROUND_IMAGE_PATHS = Object.values(BACKGROUND_IMAGES).filter(Boolean);

// Background layer types
const LAYER_DEPTHS = {
  BASE: -10,
  GRADIENT: -9,
  BACKGROUND_IMAGE: -8,
  SCANLINES: -8,
  ARCHITECTURAL: -7,
  GRID: -6,
  FOG: -5,
  LIGHT_ACCENTS: -4,
  VIGNETTE: -3,
  PARTICLES: -2,
  DECORATIVE: -1
};

// Quality presets
const QUALITY_PRESETS = {
  low: {
    particleCount: 5,
    fogEnabled: false,
    lightAccentCount: 1,
    architecturalDetail: 'minimal',
    shadowBlur: 0,
    decorativeElements: false
  },
  medium: {
    particleCount: 10,
    fogEnabled: true,
    lightAccentCount: 2,
    architecturalDetail: 'standard',
    shadowBlur: 4,
    decorativeElements: true
  },
  high: {
    particleCount: 20,
    fogEnabled: true,
    lightAccentCount: 3,
    architecturalDetail: 'detailed',
    shadowBlur: 8,
    decorativeElements: true
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
    // First, try to load image-based background
    const imagePath = BACKGROUND_IMAGES[this.variant] || BACKGROUND_IMAGES['default'];
    
    if (imagePath) {
      this._createImageBackground(imagePath);
    } else {
      // Fallback to procedural-only backgrounds
      this._createProceduralBackground();
    }
    
    // Start animations (particles, fog, light accents)
    this._startAnimations();
  }
  
  // ========== IMAGE-BASED BACKGROUND ==========
  
  _createImageBackground(imagePath) {
    // Load the background image
    const bgImage = this.scene.add.image(this.width / 2, this.height / 2, imagePath);
    bgImage.setOrigin(0.5, 0.5);
    bgImage.setDisplaySize(this.width, this.height);
    bgImage.setDepth(LAYER_DEPTHS.BACKGROUND_IMAGE);
    
    this.cachedLayers.set('backgroundImage', bgImage);
    
    // Add subtle overlay to ensure UI readability
    const overlay = this.scene.add.rectangle(
      this.width / 2, 
      this.height / 2, 
      this.width, 
      this.height, 
      0x000000, 
      0.15
    );
    overlay.setDepth(LAYER_DEPTHS.BACKGROUND_IMAGE + 0.1);
    this.cachedLayers.set('imageOverlay', overlay);
    
    // Add variant-specific accent elements on top of image
    this._createVariantAccents();
  }
  
  // ========== PROCEDURAL FALLBACK (if no image) ==========
  
  _createProceduralBackground() {
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
      case 'levelselect':
        this._createLevelSelectVariant();
        break;
      case 'settings':
        this._createSettingsVariant();
        break;
      case 'controls':
        this._createControlsVariant();
        break;
      case 'results':
        this._createResultsVariant();
        break;
      case 'victory':
        this._createVictoryVariant();
        break;
      default:
        this._createStandardVariant();
    }
  }
  
  // ========== VARIANT-SPECIFIC ACCENTS (for image backgrounds) ==========
  
  _createVariantAccents() {
    // Add subtle animated accents on top of static image backgrounds
    // This keeps the background interesting while the image provides the base
    
    switch (this.variant) {
      case 'hero':
      case 'main-menu':
        // Main menu: particles, subtle fog
        this._createFogLayer();
        this._createParticles();
        this._createLightAccents();
        break;
        
      case 'levelselect':
      case 'tactical':
        // Level select: data particles only (cleaner)
        this._createDataParticles();
        break;
        
      case 'settings':
      case 'quiet':
        // Settings: very subtle ambient
        this._createAmbientParticles();
        break;
        
      case 'controls':
        // Controls: subtle dots
        this._createAmbientParticles();
        break;
        
      case 'results':
        // Results: result-specific particles
        this._createResultParticles();
        this._createLightAccents();
        break;
        
      case 'victory':
        // Victory: celebration particles and golden accents
        this._createVictoryParticles();
        this._createGoldenAccents();
        break;
        
      default:
        // Default: light accents and particles
        this._createParticles();
        this._createLightAccents();
    }
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
      // Golden accents pulse differently
      const baseAlpha = accent.isGolden ? 0.025 : 0.018;
      const alpha = baseAlpha + Math.sin(accent.phase * 0.4) * 0.015;
      accent.graphics.setAlpha(Math.max(0.008, Math.min(0.045, alpha)));
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
  // Grid pattern removed - all variants now use gradients, fog, light accents, and particles
  
  _createHeroVariant() {
    // Hero variant - Main Menu: dramatic, animated, eye-catching
    this._createBaseLayers();
    this._createArchitecturalLayer(this.qualitySettings.architecturalDetail);
    this._createFogLayer();
    this._createLightAccents();
    this._createParticles();
  }
  
  _createTacticalVariant() {
    // Tactical variant - Level Select: data-focused, clean, functional
    this._createBaseLayers();
    this._createArchitecturalLayer('minimal');
    // No fog for cleaner tactical look
    this._createLightAccents();
    // Fewer particles for cleaner look
    this._createParticles();
  }
  
  _createQuietVariant() {
    // Quiet variant - Settings/Controls: subtle, calm, minimal distractions
    this._createBaseLayers();
    this._createArchitecturalLayer('minimal');
    // Minimal fog
    if (this.qualitySettings.fogEnabled) {
      this._createFogLayer();
    }
    // Fewer light accents
    if (this.lightAccents.length < 2) {
      this._createLightAccents();
    }
  }
  
  // ========== NEW PREMIUM VARIANTS ==========
  
  _createLevelSelectVariant() {
    // Level Select variant - Premium tactical with data visualization feel
    // Deep dark base with subtle blue-green undertones
    this._createBaseLayers();
    
    // Subtle horizontal data lines (like a HUD) - replaces grid
    this._createDataLines();
    
    // Corner brackets for tech feel
    this._createCornerBrackets();
    
    // Minimal particles - floating data points
    this._createDataParticles();
    
    // Subtle light accents
    this._createLightAccents();
  }
  
  _createSettingsVariant() {
    // Settings variant - Calm, premium, minimal distractions
    this._createBaseLayers();
    
    // Minimal decorative elements - subtle horizontal lines
    this._createSettingDecorations();
    
    // Gentle ambient particles
    this._createAmbientParticles();
    
    // Very subtle light accents
    this._createSubtleAccents();
  }
  
  _createControlsVariant() {
    // Controls variant - Technical but approachable
    this._createBaseLayers();
    
    // Key indicator decorations
    this._createControlDecorations();
    
    // Friendly particles
    this._createAmbientParticles();
    
    // Subtle accents
    this._createSubtleAccents();
  }
  
  _createResultsVariant() {
    // Results variant - Dynamic, success/failure themed
    this._createBaseLayers();
    
    // Result-specific decorations
    this._createResultDecorations();
    
    // Particles that respond to success/failure (color set in scene)
    this._createResultParticles();
    
    // Light accents
    this._createLightAccents();
  }
  
  _createVictoryVariant() {
    // Victory variant - Celebratory, grand, golden
    this._createBaseLayers();
    
    // Victory decorations - golden rays, celebration elements
    this._createVictoryDecorations();
    
    // More particles for celebration
    this._createVictoryParticles();
    
    // Golden light accents
    this._createGoldenAccents();
  }
  
  // ========== RESULT & VICTORY DECORATIONS ==========
  
  _createResultDecorations() {
    const decor = this.scene.add.graphics();
    decor.setDepth(LAYER_DEPTHS.DECORATIVE);
    
    // Subtle horizontal scan lines (like a terminal readout)
    decor.lineStyle(1, 0x334455, 0.15);
    for (let y = this.height * 0.3; y < this.height * 0.7; y += 40) {
      decor.lineBetween(50, y, this.width - 50, y);
    }
    
    // Corner accents
    const cornerSize = 30;
    const cornerColor = 0x4488aa;
    
    // Top-left
    decor.lineStyle(2, cornerColor, 0.3);
    decor.lineBetween(20, 20, 20 + cornerSize, 20);
    decor.lineBetween(20, 20, 20, 20 + cornerSize);
    
    // Top-right
    decor.lineBetween(this.width - 20, 20, this.width - 20 - cornerSize, 20);
    decor.lineBetween(this.width - 20, 20, this.width - 20, 20 + cornerSize);
    
    // Bottom-left
    decor.lineBetween(20, this.height - 20, 20 + cornerSize, this.height - 20);
    decor.lineBetween(20, this.height - 20, 20, this.height - 20 - cornerSize);
    
    // Bottom-right
    decor.lineBetween(this.width - 20, this.height - 20, this.width - 20 - cornerSize, this.height - 20);
    decor.lineBetween(this.width - 20, this.height - 20, this.width - 20, this.height - 20 - cornerSize);
    
    this.cachedLayers.set('resultDecor', decor);
  }
  
  _createResultParticles() {
    // Fewer, more subtle particles for results
    const count = this.qualitySettings.particleCount * 0.5;
    const colors = [0x4488ff, 0x44ffaa, 0xffaa00];
    
    for (let i = 0; i < count; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const particle = this.scene.add.circle(
        Math.random() * this.width,
        Math.random() * this.height,
        1 + Math.random() * 2,
        color,
        0.08 + Math.random() * 0.1
      );
      particle.setDepth(LAYER_DEPTHS.PARTICLES);
      particle.speedX = (Math.random() - 0.5) * 0.3;
      particle.speedY = (Math.random() - 0.5) * 0.3;
      this.particles.push(particle);
    }
  }
  
  _createVictoryDecorations() {
    const decor = this.scene.add.graphics();
    decor.setDepth(LAYER_DEPTHS.DECORATIVE);
    
    // Golden radial lines from center-top (celebratory rays)
    const centerX = this.width / 2;
    const rayCount = 12;
    const rayLength = Math.min(this.width, this.height) * 0.4;
    
    decor.lineStyle(2, 0xffd700, 0.08);
    for (let i = 0; i < rayCount; i++) {
      const angle = (Math.PI * 2 * i) / rayCount - Math.PI / 2;
      const startY = this.height * 0.15;
      decor.lineBetween(
        centerX,
        startY,
        centerX + Math.cos(angle) * rayLength,
        startY + Math.sin(angle) * rayLength
      );
    }
    
    // Horizontal celebration lines
    decor.lineStyle(1, 0xffd700, 0.1);
    for (let y = this.height * 0.2; y < this.height * 0.8; y += 60) {
      const startX = 80 + Math.random() * 40;
      const endX = this.width - 80 - Math.random() * 40;
      decor.lineBetween(startX, y, endX, y);
    }
    
    // Corner brackets - golden
    const cornerSize = 40;
    const cornerColor = 0xffd700;
    
    decor.lineStyle(2, cornerColor, 0.25);
    // Top-left
    decor.lineBetween(20, 20, 20 + cornerSize, 20);
    decor.lineBetween(20, 20, 20, 20 + cornerSize);
    // Top-right
    decor.lineBetween(this.width - 20, 20, this.width - 20 - cornerSize, 20);
    decor.lineBetween(this.width - 20, 20, this.width - 20, 20 + cornerSize);
    // Bottom-left
    decor.lineBetween(20, this.height - 20, 20 + cornerSize, this.height - 20);
    decor.lineBetween(20, this.height - 20, 20, this.height - 20 - cornerSize);
    // Bottom-right
    decor.lineBetween(this.width - 20, this.height - 20, this.width - 20 - cornerSize, this.height - 20);
    decor.lineBetween(this.width - 20, this.height - 20, this.width - 20, this.height - 20 - cornerSize);
    
    this.cachedLayers.set('victoryDecor', decor);
  }
  
  _createVictoryParticles() {
    // More particles for victory celebration
    const count = this.qualitySettings.particleCount * 1.5;
    const colors = [0xffd700, 0xffaa00, 0x00ff88, 0x44ffaa, 0x88ffcc, 0xff66aa];
    
    for (let i = 0; i < count; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const particle = this.scene.add.circle(
        Math.random() * this.width,
        Math.random() * this.height,
        1.5 + Math.random() * 2.5,
        color,
        0.12 + Math.random() * 0.15
      );
      particle.setDepth(LAYER_DEPTHS.PARTICLES);
      particle.speedX = (Math.random() - 0.5) * 0.4;
      particle.speedY = (Math.random() - 0.5) * 0.4 - 0.2; // Slight upward drift
      this.particles.push(particle);
    }
  }
  
  _createGoldenAccents() {
    // Golden light beams from corners
    const accentPositions = [
      { x: 0.05, y: 0.1, angle: 0.4 },
      { x: 0.95, y: 0.1, angle: Math.PI - 0.4 },
      { x: 0.5, y: 0.98, angle: -Math.PI / 2 }
    ];
    
    accentPositions.forEach(pos => {
      const accent = this.scene.add.graphics();
      const startX = this.width * pos.x;
      const startY = this.height * pos.y;
      
      // Golden light beam
      accent.fillStyle(0xffd700, 0.02);
      accent.fillTriangle(
        startX, startY,
        startX + Math.cos(pos.angle - 0.15) * 350,
        startY + Math.sin(pos.angle - 0.15) * 350,
        startX + Math.cos(pos.angle + 0.15) * 350,
        startY + Math.sin(pos.angle + 0.15) * 350
      );
      
      accent.setDepth(LAYER_DEPTHS.LIGHT_ACCENTS);
      
      this.lightAccents.push({
        graphics: accent,
        baseX: startX,
        baseY: startY,
        angle: pos.angle,
        phase: Math.random() * Math.PI * 2,
        isGolden: true
      });
    });
  }
  
  // ========== DECORATIVE ELEMENTS (replacements for grid) ==========
  
  _createDataLines() {
    if (!this.qualitySettings.decorativeElements) return;
    
    const decor = this.scene.add.graphics();
    decor.setDepth(LAYER_DEPTHS.DECORATIVE);
    
    // Horizontal data lines at key positions
    const lineYPositions = [0.25, 0.5, 0.75];
    const lineColor = 0x2a4a5a;
    
    lineYPositions.forEach((pos, i) => {
      const y = this.height * pos;
      decor.lineStyle(1, lineColor, 0.1 + (i * 0.05));
      decor.lineBetween(0, y, this.width, y);
    });
    
    this.cachedLayers.set('datalines', decor);
  }
  
  _createCornerBrackets() {
    if (!this.qualitySettings.decorativeElements) return;
    
    const bracket = this.scene.add.graphics();
    bracket.setDepth(LAYER_DEPTHS.DECORATIVE);
    
    const bracketSize = 40;
    const color = 0x3a5a6a;
    
    // Top-left
    bracket.lineStyle(2, color, 0.3);
    bracket.lineBetween(20, 20, 20 + bracketSize, 20);
    bracket.lineBetween(20, 20, 20, 20 + bracketSize);
    
    // Top-right
    bracket.lineBetween(this.width - 20, 20, this.width - 20 - bracketSize, 20);
    bracket.lineBetween(this.width - 20, 20, this.width - 20, 20 + bracketSize);
    
    // Bottom-left
    bracket.lineBetween(20, this.height - 20, 20 + bracketSize, this.height - 20);
    bracket.lineBetween(20, this.height - 20, 20, this.height - 20 - bracketSize);
    
    // Bottom-right
    bracket.lineBetween(this.width - 20, this.height - 20, this.width - 20 - bracketSize, this.height - 20);
    bracket.lineBetween(this.width - 20, this.height - 20, this.width - 20, this.height - 20 - bracketSize);
    
    this.cachedLayers.set('brackets', bracket);
  }
  
  _createSettingDecorations() {
    if (!this.qualitySettings.decorativeElements) return;
    
    const decor = this.scene.add.graphics();
    decor.setDepth(LAYER_DEPTHS.DECORATIVE);
    
    // Subtle horizontal dividers
    const color = 0x2a3a4a;
    decor.lineStyle(1, color, 0.1);
    
    // Three subtle lines
    decor.lineBetween(0, this.height * 0.3, this.width * 0.3, this.height * 0.3);
    decor.lineBetween(this.width * 0.7, this.height * 0.5, this.width, this.height * 0.5);
    decor.lineBetween(0, this.height * 0.7, this.width * 0.2, this.height * 0.7);
    
    this.cachedLayers.set('settingdecor', decor);
  }
  
  _createControlDecorations() {
    if (!this.qualitySettings.decorativeElements) return;
    
    const decor = this.scene.add.graphics();
    decor.setDepth(LAYER_DEPTHS.DECORATIVE);
    
    // Key icon hints - subtle circles
    const color = 0x3a4a5a;
    decor.lineStyle(1, color, 0.15);
    
    // Decorative dots in corners
    const dotRadius = 4;
    decor.fillStyle(color, 0.2);
    decor.fillCircle(60, 60, dotRadius);
    decor.fillCircle(this.width - 60, 60, dotRadius);
    decor.fillCircle(60, this.height - 60, dotRadius);
    decor.fillCircle(this.width - 60, this.height - 60, dotRadius);
    
    this.cachedLayers.set('controldecor', decor);
  }
  
  // ========== ENHANCED PARTICLES ==========
  
  _createDataParticles() {
    // Data particles - small, techy, cyan-tinted
    const count = Math.min(15, this.qualitySettings.particleCount + 5);
    
    for (let i = 0; i < count; i++) {
      const particle = this.scene.add.circle(
        Math.random() * this.width,
        Math.random() * this.height,
        1 + Math.random() * 2,
        0x44aacc,
        0.1 + Math.random() * 0.15
      );
      particle.setDepth(LAYER_DEPTHS.PARTICLES);
      particle.speedX = (Math.random() - 0.5) * 0.3;
      particle.speedY = (Math.random() - 0.5) * 0.3;
      this.particles.push(particle);
    }
  }
  
  _createAmbientParticles() {
    // Softer, ambient particles
    const count = Math.max(8, this.qualitySettings.particleCount - 5);
    const colors = [0x4466aa, 0x5588bb, 0x6699cc];
    
    for (let i = 0; i < count; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      const particle = this.scene.add.circle(
        Math.random() * this.width,
        Math.random() * this.height,
        2 + Math.random() * 3,
        color,
        0.08 + Math.random() * 0.1
      );
      particle.setDepth(LAYER_DEPTHS.PARTICLES);
      particle.speedX = (Math.random() - 0.5) * 0.2;
      particle.speedY = (Math.random() - 0.5) * 0.2;
      this.particles.push(particle);
    }
  }
  
  _createSubtleAccents() {
    // Very subtle, single accent light
    const accent = this.scene.add.graphics();
    const startX = this.width * 0.5;
    const startY = this.height * 0.9;
    
    accent.fillStyle(0x2a4a6a, 0.02);
    accent.fillTriangle(
      startX, startY,
      startX + Math.cos(-0.2) * 400,
      startY + Math.sin(-0.2) * 400,
      startX + Math.cos(0.2) * 400,
      startY + Math.sin(0.2) * 400
    );
    
    accent.setDepth(LAYER_DEPTHS.LIGHT_ACCENTS);
    
    this.lightAccents.push({
      graphics: accent,
      baseX: startX,
      baseY: startY,
      angle: -0.2,
      phase: Math.random() * Math.PI * 2
    });
  }
  
  _createStandardVariant() {
    // Default: balanced, no grid
    this._createBaseLayers();
    this._createArchitecturalLayer(this.qualitySettings.architecturalDetail);
    this._createFogLayer();
    this._createLightAccents();
    this._createParticles();
  }
  
  // ========== ANIMATION CONTROL ==========
  
  _startAnimations() {
    // Grid animation removed - only particle, light, and fog animations remain
    
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
    
    // Destroy cached layers (including background image)
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
