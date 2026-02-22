# GhostShift Game Flow Plan

## Overview
Phased roadmap for implementing the complete game flow system.

## Current Status: Phase 6 Complete ✅

### Phase 1: Menu Foundation (DONE)
- [x] Scene architecture with 6 scenes
- [x] SaveManager foundation module
- [x] Full MainMenuScene with all buttons
- [x] LevelSelectScene (stub with real level data)
- [x] SettingsScene (stub with audio toggle)
- [x] ResultsScene (stub)
- [x] Basic transitions between scenes

### Phase 2: Settings & Level Select Enhancement (DONE)
- [x] Settings persistence UI (full: audio, volume, quality, fullscreen, reduced-motion)
- [x] LevelSelectScene: Add level preview/info on selection (completed)
- [x] Add more per-level stats display (best times shown)
- [x] Settings: Master volume slider
- [x] Settings: Effects quality toggle (low/medium/high)
- [x] Settings: Fullscreen toggle
- [x] Settings: Reduced motion toggle
- [x] ResultsScene: Full implementation with stats and buttons
- [x] ResultsScene: Retry, Next Level, Level Select, Menu buttons
- [x] Continue flow: Main menu continue loads last played level
- [x] SaveManager: Proper per-level best times and unlocks

### Phase 3: Polish & Game Feel (DONE)
- [x] Scene transition effects (fade, slide)
- [x] Animated menu background (floating particles, animated grid)
- [x] Sound effects for menu interactions (click, hover, select)
- [x] Detection feedback (red pulse overlay, screen shake, player glow)
- [x] Particle effects for results (win: green/gold particles, lose: red particles)
- [x] Result screen micro-animations (title pop-in, stats slide-in)
- [x] Enhanced button hover/active states with glow and press animations
- [x] Restart sound effect
- [x] Additional SFX hooks (detection, restart, click)

### Phase 4: Content & Maps (DONE)
- [x] Additional levels (4-5) - Added "The Vault" and "Training Facility"
- [x] Level-specific objectives and challenges
- [x] Enemy variety (different guard patterns per level)
- [x] Difficulty scaling (guards, vision cones, sensors scale with level)
- [x] New objectives: Security Code and Power Cell pickups
- [x] UI improvements: Difficulty indicator, additional objective tracking
- [x] Game constant improvements for balancing

### Phase 5: Save System Hardening (COMPLETE ✅)
- [x] Schema versioning (v5) with migration system
- [x] Data validation on load (type checking, range validation, enum validation)
- [x] Corruption recovery (handles invalid JSON, partial data recovery)
- [x] Best times integrity validation (removes invalid times)
- [x] Level unlock integrity (ensures level 0 always unlocked, sorted unique)
- [x] Settings validation with proper defaults
- [x] Save slot protection (prevents rapid successive saves)
- [x] Storage quota handling with cleanup fallback
- [x] Validation test script (`tests/save-validation.js`)
- [x] Build verification (compiles without errors)
- [x] Dev server startup verified

### Phase 6: Polish & Content (COMPLETE ✅)
- [x] Map readability pass - Enhanced wall rendering with top edge highlights
- [x] Level name indicator in-game HUD
- [x] Improved exit zone visibility with pulsing glow animation
- [x] Difficulty indicator improvement - color-coded labels (EASY/MEDIUM/HARD)
- [x] Enhanced detection feedback - more dramatic screen shake, red vignette pulse
- [x] Results scene improvements - Level name display, "NEW BEST!" indicator
- [x] Save progression integrity maintained (no changes to save system)
- [x] Build/dev/tests - 0 console errors verified
- [x] Version bump: v0.5.0 → v0.6.0

## Phase 7: Future Work
- [ ] Multiple save slots
- [ ] Cloud save (stretch)
- [ ] Achievement system
- [ ] Statistics tracking

## Scene Architecture Details

```
BootScene
├── Loads save data
└── Transitions to MainMenuScene

MainMenuScene
├── Display: Title, Stats (runs, best time), Credits
├── Buttons:
│   ├── Play → LevelSelectScene
│   ├── Level Select → LevelSelectScene
│   ├── Continue → GameScene (if save exists)
│   ├── Settings → SettingsScene
│   ├── Controls → Overlay panel
│   └── Credits → Overlay panel
├── Animated background with particles
└── Initialize audio on first interaction

LevelSelectScene
├── Display: Level cards with name, best time, lock status
├── Animated grid background
├── Level number glow effect
├── Back → MainMenuScene
└── Fade transition to game

SettingsScene
├── Audio toggle with visual feedback
├── Master volume slider
├── Effects quality toggle
├── Fullscreen toggle
├── Reduced motion toggle
├── Reset progress (with confirmation)
├── Version info (v0.6.0 - Phase 6)
└── Back → MainMenuScene

GameScene
├── Preserved existing gameplay
├── Added level selection support
├── Detection feedback (red pulse, shake)
├── Win: Transition to ResultsScene
└── Detected: Transition to ResultsScene (failure)

ResultsScene
├── Display success/failure
├── Show credits earned
├── Show time and best time
├── New best indicator
├── Level name display
├── Particle effects (win/lose)
├── Title pop-in animation
├── Stats slide-in animation
├── Fade transition to other scenes
└── Buttons: Retry, Next Level, Level Select, Menu
```

## Save Data Structure

```javascript
{
  credits: 0,
  totalRuns: 0,
  bestTime: null,           // Overall best time
  bestTimes: {},             // Per-level best times
  unlockedLevels: [0],      // Array of unlocked level indices
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
}
```

## Audio System (Phase 3)

The SFXManager provides procedural audio using Web Audio API:
- **alert()**: Detection warning
- **win()**: Mission success melody
- **fail()**: Mission failure sound
- **collect()**: Item pickup
- **select()**: Menu selection
- **menuHover()**: Menu hover feedback
- **pickup()**: General pickup
- **detection()**: Detection pulse (new)
- **restart()**: Level restart sound (new)
- **click()**: Button click feedback (new)

All sounds respect the master volume and audio enabled settings.
