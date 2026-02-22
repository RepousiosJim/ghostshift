# GhostShift Game Flow Plan

## Overview
Phased roadmap for implementing the complete game flow system.

## Current Status: Phase 1 Complete ✅

### Phase 1: Menu Foundation (DONE)
- [x] Scene architecture with 6 scenes
- [x] SaveManager foundation module
- [x] Full MainMenuScene with all buttons
- [x] LevelSelectScene (stub with real level data)
- [x] SettingsScene (stub with audio toggle)
- [x] ResultsScene (stub)
- [x] Basic transitions between scenes

## Phase 2: Settings & Level Select Enhancement (NEXT)
- [ ] Settings persistence UI (not just audio)
- [ ] LevelSelectScene: Add level preview/info on selection
- [ ] Add more per-level stats display
- [ ] Settings: Add resolution/graphics options
- [ ] Settings: Add controls remapping (stretch goal)

## Phase 3: Results & Progression
- [ ] ResultsScene: Full implementation with stats
- [ ] Add mission summary (enemies avoided, items collected)
- [ ] Progression system: Unlock levels on completion
- [ ] Add level difficulty modifiers

## Phase 4: Save System Enhancement
- [ ] Multiple save slots
- [ ] Cloud save (stretch)
- [ ] Achievement system
- [ ] Statistics tracking

## Phase 5: Polish & Transitions
- [ ] Scene transition effects (fade, slide)
- [ ] Animated menu background
- [ ] Sound effects for menu interactions
- [ ] Particle effects for results

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
└── Initialize audio on first interaction

LevelSelectScene
├── Display: Level cards with name, best time, lock status
├── Level 0: Warehouse (unlocked by default)
├── Level 1: Labs (unlocked on completing Level 0)
├── Level 2: Server Farm (unlocked on completing Level 1)
└── Back → MainMenuScene

SettingsScene
├── Audio toggle
├── Reset progress (with confirmation)
├── Version info
└── Back → MainMenuScene

GameScene
├── Preserved existing gameplay
├── Added level selection support
├── Win: Transition to ResultsScene
└── Detected: Transition to ResultsScene (failure)

ResultsScene (Stub)
├── Display success/failure
├── Show credits earned
├── Show time
└── Continue → MainMenuScene
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
  settings: { audioEnabled: true },
  lastPlayed: null,
  totalCreditsEarned: 0
}
```
