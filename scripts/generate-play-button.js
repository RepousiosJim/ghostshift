/**
 * Generate PLAY Button Asset
 * 
 * Creates menu_btn_play.png - the single source of truth for the PLAY button.
 * This asset replaces all procedural rendering for the PLAY button.
 * 
 * Usage: node scripts/generate-play-button.js
 */

import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, '../public/assets/ui/buttons_v2');
const WIDTH = 320;
const HEIGHT = 64;

// PLAY button color scheme matching GhostShift theme
const PLAY_BUTTON = {
  // Main button colors
  gradientTop: '#2255cc',
  gradientBottom: '#4477ee',
  
  // Glow color
  glowColor: '#00ffff',
  glowAlpha: 0.35,
  
  // Border
  borderColor: '#66aaff',
  borderWidth: 3,
  
  // Text
  textColor: '#ffffff',
  fontSize: 22,
  fontFamily: 'Courier New',
  text: '▶  PLAY',
  
  // Rounded corners
  borderRadius: 8,
  
  // Bevel/highlight
  highlightColor: 'rgba(255, 255, 255, 0.2)',
  highlightHeight: 3
};

/**
 * Draw the PLAY button
 */
function drawPlayButton(canvas) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  
  // Clear with transparent background
  ctx.clearRect(0, 0, width, height);
  
  // Draw outer glow (subtle blur effect using shadow)
  ctx.shadowColor = PLAY_BUTTON.glowColor;
  ctx.shadowBlur = 20;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  
  // Create gradient for background
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, PLAY_BUTTON.gradientTop);
  gradient.addColorStop(1, PLAY_BUTTON.gradientBottom);
  
  // Draw rounded rectangle background
  const radius = PLAY_BUTTON.borderRadius;
  ctx.beginPath();
  ctx.roundRect(0, 0, width, height, radius);
  ctx.fillStyle = gradient;
  ctx.fill();
  
  // Reset shadow for subsequent draws
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  
  // Draw border
  ctx.strokeStyle = PLAY_BUTTON.borderColor;
  ctx.lineWidth = PLAY_BUTTON.borderWidth;
  ctx.beginPath();
  ctx.roundRect(
    PLAY_BUTTON.borderWidth / 2,
    PLAY_BUTTON.borderWidth / 2,
    width - PLAY_BUTTON.borderWidth,
    height - PLAY_BUTTON.borderWidth,
    radius - 1
  );
  ctx.stroke();
  
  // Draw top highlight/bevel
  const highlightGradient = ctx.createLinearGradient(0, 0, 0, PLAY_BUTTON.highlightHeight);
  highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
  highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0.05)');
  
  ctx.beginPath();
  ctx.roundRect(4, 4, width - 8, PLAY_BUTTON.highlightHeight + 4, radius - 4);
  ctx.fillStyle = highlightGradient;
  ctx.fill();
  
  // Draw text shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.font = `bold ${PLAY_BUTTON.fontSize}px "${PLAY_BUTTON.fontFamily}", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(PLAY_BUTTON.text, width / 2 + 1, height / 2 + 2);
  
  // Draw main text with subtle glow
  ctx.shadowColor = 'rgba(255, 255, 255, 0.3)';
  ctx.shadowBlur = 4;
  ctx.fillStyle = PLAY_BUTTON.textColor;
  ctx.fillText(PLAY_BUTTON.text, width / 2, height / 2);
  
  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
}

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
 * Main generation function
 */
function main() {
  ensureOutputDir();
  
  console.log('\n=== Generating PLAY Button Asset ===\n');
  
  // Create canvas
  const canvas = createCanvas(WIDTH, HEIGHT);
  
  // Draw the button
  drawPlayButton(canvas);
  
  // Save to file
  const outputPath = path.join(OUTPUT_DIR, 'menu_btn_play.png');
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  
  console.log(`✓ Generated: menu_btn_play.png (${WIDTH}x${HEIGHT})`);
  console.log(`📁 Output: ${outputPath}\n`);
}

main();
