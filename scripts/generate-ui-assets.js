/**
 * GhostShift UI Button Asset Generator
 * 
 * Generates button assets using OpenAI's image generation API.
 * Requires OPENAI_API_KEY environment variable.
 * 
 * Usage:
 *   npm run generate-assets        # Full generation
 *   npm run generate-assets -- --dry-run  # Preview prompts only
 *   npm run generate-assets -- --state hover  # Generate specific state
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const OUTPUT_DIR = path.join(__dirname, '../public/assets/ui/buttons');
const ASSET_SPEC = {
  primary: { width: 300, height: 52 },
  secondary: { width: 300, height: 52 },
  neutral: { width: 300, height: 52 },
  locked: { width: 300, height: 52 }
};

// Button variant configurations
const BUTTON_VARIANTS = {
  primary: {
    states: ['default', 'hover', 'pressed', 'selected', 'disabled'],
    prompts: {
      default: `A sleek pixel-art game button, 300x52 pixels, transparent background. Primary CTA button with vibrant blue gradient background (#2244aa to #4466cc), subtle outer glow in cyan. White bold text "PLAY" centered. Clean flat design, slight bevel effect on edges. No shadow. Game UI style, crisp edges.`,
      hover: `A sleek pixel-art game button, 300x52 pixels, transparent background. Primary CTA button hovered state - brighter blue gradient (#3355bb to #5577dd), white glowing border highlight (2px), increased outer glow intensity. White bold text "PLAY" centered with subtle text glow. Clean flat design. Game UI style.`,
      pressed: `A sleek pixel-art game button, 300x52 pixels, transparent background. Primary CTA button pressed/active state - darker blue gradient (#1122aa to #2244cc), inset shadow effect creating depth, no outer glow. White bold text "PLAY" centered, slightly offset down (2px) for pressed effect. Clean flat design. Game UI style.`,
      selected: `A sleek pixel-art game button, 300x52 pixels, transparent background. Primary CTA button selected state - green tint gradient (#226622 to #338833), subtle glow in green. White bold text "PLAY" with checkmark indicator. Clean flat design. Game UI style.`,
      disabled: `A sleek pixel-art game button, 300x52 pixels, transparent background. Disabled primary button - gray gradient (#333340 to #444455), no glow, no hover effects. Gray text "#666677" "PLAY" centered. Flat design, no bevel. Game UI style.`
    }
  },
  secondary: {
    states: ['default', 'hover', 'pressed', 'selected', 'disabled'],
    prompts: {
      default: `A sleek pixel-art game button, 300x52 pixels, transparent background. Secondary menu button with muted blue-gray gradient background (#2a3a4a to #3a4a5a), subtle stroke in light gray (#666688). White text "MENU" centered. Clean flat design. Game UI style.`,
      hover: `A sleek pixel-art game button, 300x52 pixels, transparent background. Secondary menu button hovered state - slightly brighter blue-gray (#3a4a5a to #4a5a6a), white border highlight (2px). White text "MENU" centered. Clean flat design. Game UI style.`,
      pressed: `A sleek pixel-art game button, 300x52 pixels, transparent background. Secondary menu button pressed state - darker blue-gray (#1a2a3a to #2a3a4a), inset effect. White text "MENU" centered, offset for pressed effect. Clean flat design. Game UI style.`,
      selected: `A sleek pixel-art game button, 300x52 pixels, transparent background. Secondary menu button selected state - accent border in cyan (#66ccff), slightly brighter background. White text "MENU" centered. Clean flat design. Game UI style.`,
      disabled: `A sleek pixel-art game button, 300x52 pixels, transparent background. Disabled secondary button - dark gray gradient (#1a1a22 to #2a2a33), no glow. Gray text "#444455" "MENU" centered. Flat design. Game UI style.`
    }
  },
  neutral: {
    states: ['default', 'hover', 'pressed', 'disabled'],
    prompts: {
      default: `A sleek pixel-art game button, 300x52 pixels, transparent background. Neutral/back button with dark slate gradient (#1a1a2a to #2a2a3a), subtle stroke (#444466). Light gray text "BACK" centered. Clean flat design. Game UI style.`,
      hover: `A sleek pixel-art game button, 300x52 pixels, transparent background. Neutral/back button hovered - slightly lighter slate (#2a2a3a to #3a3a4a), white border highlight. Light gray text "BACK" centered. Clean flat design. Game UI style.`,
      pressed: `A sleek pixel-art game button, 300x52 pixels, transparent background. Neutral/back button pressed - darker slate (#0a0a1a to #1a1a2a), inset shadow. Light gray text "BACK" centered, offset. Clean flat design. Game UI style.`,
      disabled: `A sleek pixel-art game button, 300x52 pixels, transparent background. Disabled neutral button - very dark gray (#0a0a10 to #151520), no stroke. Dim gray text "BACK" centered. Flat design. Game UI style.`
    }
  },
  locked: {
    states: ['default', 'hover'],
    prompts: {
      default: `A sleek pixel-art game button, 300x52 pixels, transparent background. Locked button with dark gradient (#151520 to #252535), subtle lock icon in dark gray, no glow effect. Grayed text "LOCKED" centered. Flat design, no bevel. Game UI style.`,
      hover: `A sleek pixel-art game button, 300x52 pixels, transparent background. Locked button hover - very subtle highlight (#202030 to #303040), still no glow, lock icon visible. Grayed text "LOCKED" centered. Flat design. Game UI style.`
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
 * Generate assets using OpenAI API
 */
async function generateWithOpenAI(prompt, outputPath) {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }
  
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: prompt,
      size: '1024x1024',
      quality: 'high'
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }
  
  const data = await response.json();
  
  if (!data.data || !data.data[0] || !data.data[0].url) {
    throw new Error('Invalid response from OpenAI API');
  }
  
  // Download and save the image
  const imageResponse = await fetch(data.data[0].url);
  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
  
  // Convert to PNG and save
  // Note: GPT Image 1 returns PNG by default
  fs.writeFileSync(outputPath, imageBuffer);
  
  console.log(`✓ Generated: ${path.basename(outputPath)}`);
  return outputPath;
}

/**
 * Dry run - preview all prompts
 */
function dryRun() {
  console.log('\n=== DRY RUN: Previewing all prompts ===\n');
  
  let count = 0;
  for (const [variant, config] of Object.entries(BUTTON_VARIANTS)) {
    console.log(`## ${variant.toUpperCase()} Button`);
    for (const state of config.states) {
      const filename = `${variant}-${state}.png`;
      console.log(`\n### ${filename}`);
      console.log(config.prompts[state]);
      count++;
    }
    console.log('\n---\n');
  }
  
  console.log(`\nTotal: ${count} assets would be generated\n`);
  return count;
}

/**
 * Generate specific variant/state
 */
async function generateSingle(variant, state) {
  if (!BUTTON_VARIANTS[variant]) {
    throw new Error(`Unknown variant: ${variant}. Available: ${Object.keys(BUTTON_VARIANTS).join(', ')}`);
  }
  
  const config = BUTTON_VARIANTS[variant];
  if (!config.states.includes(state)) {
    throw new Error(`Unknown state: ${state} for variant ${variant}. Available: ${config.states.join(', ')}`);
  }
  
  const filename = `${variant}-${state}.png`;
  const outputPath = path.join(OUTPUT_DIR, filename);
  
  console.log(`Generating ${variant}-${state}...`);
  await generateWithOpenAI(config.prompts[state], outputPath);
  
  return outputPath;
}

/**
 * Generate all assets
 */
async function generateAll() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ ERROR: OPENAI_API_KEY environment variable is not set');
    console.log('\nTo generate assets:');
    console.log('  export OPENAI_API_KEY=your_api_key_here');
    console.log('  npm run generate-assets\n');
    process.exit(1);
  }
  
  console.log('\n=== Generating GhostShift Button Assets ===\n');
  
  ensureOutputDir();
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const [variant, config] of Object.entries(BUTTON_VARIANTS)) {
    console.log(`\n## ${variant.toUpperCase()} Button`);
    for (const state of config.states) {
      const filename = `${variant}-${state}.png`;
      const outputPath = path.join(OUTPUT_DIR, filename);
      
      try {
        await generateWithOpenAI(config.prompts[state], outputPath);
        successCount++;
      } catch (error) {
        console.error(`❌ Failed to generate ${filename}: ${error.message}`);
        errorCount++;
      }
    }
  }
  
  console.log('\n=== Generation Complete ===');
  console.log(`✓ Success: ${successCount}`);
  console.log(`✗ Errors: ${errorCount}`);
  console.log(`📁 Output: ${OUTPUT_DIR}\n`);
  
  if (errorCount > 0) {
    process.exit(1);
  }
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRunMode = args.includes('--dry-run');
  const stateArg = args.find(arg => arg.startsWith('--state='))?.split('=')[1];
  
  if (dryRunMode) {
    dryRun();
    return;
  }
  
  if (stateArg) {
    // Generate specific state for all variants
    ensureOutputDir();
    for (const variant of Object.keys(BUTTON_VARIANTS)) {
      if (BUTTON_VARIANTS[variant].states.includes(stateArg)) {
        try {
          await generateSingle(variant, stateArg);
        } catch (error) {
          console.error(`Error: ${error.message}`);
        }
      }
    }
    return;
  }
  
  await generateAll();
}

main().catch(console.error);
