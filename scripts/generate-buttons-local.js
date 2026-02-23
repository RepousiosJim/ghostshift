/**
 * GhostShift Button Asset Generator (Local Canvas Version)
 * 
 * Generates button assets using Node.js canvas - no API required.
 * 
 * Usage:
 *   node scripts/generate-buttons-local.js
 *   node scripts/generate-buttons-local.js --family=primary
 */

import { createCanvas, loadImage, registerFont } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const OUTPUT_DIR = path.join(__dirname, '../public/assets/ui/buttons');
const WIDTH = 300;
const HEIGHT = 52;

// Button state configurations based on prompt pack
const BUTTON_STYLES = {
  primary: {
    label: 'PLAY',
    states: {
      default: {
        gradient: ['#2244aa', '#4466cc'],
        glow: '#00ffff',
        textColor: '#ffffff',
        bevel: true
      },
      hover: {
        gradient: ['#3355bb', '#5577dd'],
        glow: '#88ffff',
        border: '#ffffff',
        textColor: '#ffffff',
        textGlow: true
      },
      pressed: {
        gradient: ['#1122aa', '#2244cc'],
        inset: true,
        textColor: '#ffffff',
        textOffset: 2
      },
      selected: {
        gradient: ['#226622', '#338833'],
        glow: '#22ff22',
        textColor: '#ffffff',
        indicator: '✓'
      },
      disabled: {
        gradient: ['#333340', '#444455'],
        textColor: '#666677',
        noGlow: true
      }
    }
  },
  secondary: {
    label: 'MENU',
    states: {
      default: {
        gradient: ['#2a3a4a', '#3a4a5a'],
        stroke: '#666688',
        textColor: '#ffffff'
      },
      hover: {
        gradient: ['#3a4a5a', '#4a5a6a'],
        border: '#ffffff',
        textColor: '#ffffff'
      },
      pressed: {
        gradient: ['#1a2a3a', '#2a3a4a'],
        inset: true,
        textColor: '#ffffff',
        textOffset: 2
      },
      selected: {
        gradient: ['#2a4a5a', '#3a5a6a'],
        border: '#66ccff',
        textColor: '#ffffff'
      },
      disabled: {
        gradient: ['#1a1a22', '#2a2a33'],
        textColor: '#444455'
      }
    }
  }
};

/**
 * Ensure output directory exists
 */
function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`Created output directory: ${OUTPUT_DIR}`);
  }
}

/**
 * Draw a button with the specified style
 */
function drawButton(canvas, style, state) {
  const ctx = canvas.getContext('2d');
  const stateStyle = BUTTON_STYLES[style].states[state];
  const label = BUTTON_STYLES[style].label;
  
  // Clear canvas
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  
  // Create gradient background
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, stateStyle.gradient[0]);
  gradient.addColorStop(1, stateStyle.gradient[1]);
  
  // Draw rounded rectangle background
  const radius = 6;
  ctx.beginPath();
  ctx.roundRect(0, 0, WIDTH, HEIGHT, radius);
  ctx.fillStyle = gradient;
  
  // Add inset effect for pressed state
  if (stateStyle.inset) {
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
  }
  
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  
  // Add bevel effect for primary default
  if (stateStyle.bevel) {
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(1, 1, WIDTH-2, HEIGHT-2, radius);
    ctx.stroke();
  }
  
  // Add outer glow
  if (stateStyle.glow && !stateStyle.noGlow) {
    ctx.shadowColor = stateStyle.glow;
    ctx.shadowBlur = state === 'hover' ? 15 : 8;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }
  
  // Add border
  if (stateStyle.border) {
    ctx.strokeStyle = stateStyle.border;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(2, 2, WIDTH-4, HEIGHT-4, radius-1);
    ctx.stroke();
  }
  
  // Add stroke for secondary default
  if (stateStyle.stroke) {
    ctx.strokeStyle = stateStyle.stroke;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(1, 1, WIDTH-2, HEIGHT-2, radius);
    ctx.stroke();
  }
  
  // Draw text
  ctx.fillStyle = stateStyle.textColor;
  ctx.font = 'bold 20px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  const textX = WIDTH / 2;
  const textY = HEIGHT / 2 + (stateStyle.textOffset || 0);
  
  // Add text glow for hover
  if (stateStyle.textGlow) {
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 5;
  }
  
  ctx.fillText(label, textX, textY);
  
  // Add indicator for selected state
  if (stateStyle.indicator) {
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.fillText(stateStyle.indicator, WIDTH - 30, HEIGHT / 2);
  }
  
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
}

/**
 * Generate all buttons
 */
function generateAll() {
  ensureOutputDir();
  
  console.log('\n=== Generating GhostShift Button Assets (Local) ===\n');
  
  for (const [family, config] of Object.entries(BUTTON_STYLES)) {
    console.log(`## ${family.toUpperCase()} Button`);
    
    for (const state of Object.keys(config.states)) {
      const filename = `${family}-${state}.png`;
      const outputPath = path.join(OUTPUT_DIR, filename);
      
      const canvas = createCanvas(WIDTH, HEIGHT);
      drawButton(canvas, family, state);
      
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(outputPath, buffer);
      
      console.log(`✓ Generated: ${filename}`);
    }
    console.log('');
  }
  
  console.log(`📁 Output: ${OUTPUT_DIR}\n`);
}

/**
 * Generate specific family
 */
function generateFamily(family) {
  if (!BUTTON_STYLES[family]) {
    console.error(`Unknown family: ${family}`);
    console.log(`Available: ${Object.keys(BUTTON_STYLES).join(', ')}`);
    process.exit(1);
  }
  
  ensureOutputDir();
  
  console.log(`\n=== Generating ${family.toUpperCase()} Button Assets ===\n`);
  
  const config = BUTTON_STYLES[family];
  
  for (const state of Object.keys(config.states)) {
    const filename = `${family}-${state}.png`;
    const outputPath = path.join(OUTPUT_DIR, filename);
    
    const canvas = createCanvas(WIDTH, HEIGHT);
    drawButton(canvas, family, state);
    
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    
    console.log(`✓ Generated: ${filename}`);
  }
  
  console.log(`\n📁 Output: ${OUTPUT_DIR}\n`);
}

/**
 * Main entry point
 */
function main() {
  const args = process.argv.slice(2);
  const familyArg = args.find(arg => arg.startsWith('--family='))?.split('=')[1];
  
  if (familyArg) {
    generateFamily(familyArg);
  } else {
    generateAll();
  }
}

main();
