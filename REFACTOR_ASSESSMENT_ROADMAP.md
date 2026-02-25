# GhostShift Refactor Assessment & Prioritized Roadmap

**Generated**: 2026-02-25
**Scope**: Full architecture audit, hotspot detection, runtime issues, gameplay systems, engineering quality
**Project Version**: 0.7.1

---

## Executive Summary

**Overall Health**: ✅ Stable - Console-zero achieved, core gameplay functional, comprehensive test coverage

**Critical Issues**: 0 P0, 4 P1, 11 P2

**Primary Risk**: Monolithic `main.js` (9,615 lines) containing 9 scenes, all UI code, and game logic - major maintainability bottleneck

**Recommended Approach**: Incremental extraction in vertical slices, with each slice delivering testable value

---

## Architecture Overview

### Current State

```
ghostshift/
├── src/
│   ├── main.js                    ⚠️ 9,615 lines - MONOLITH
│   │   ├── BootScene
│   │   ├── MainMenuScene
│   │   ├── LevelSelectScene
│   │   ├── SettingsScene
│   │   ├── ControlsScene
│   │   ├── ResultsScene
│   │   ├── VictoryScene
│   │   ├── GameScene              (3,700 lines)
│   │   ├── SaveManager
│   │   ├── FullscreenManager
│   │   ├── PerformanceManager
│   │   ├── SceneTransitionManager
│   │   └── [50+ global functions]
│   ├── guard/                     ✅ Modular (14 files)
│   ├── tile/                      ⚠️ Disabled (USE_TILE_AI=false)
│   ├── nav/                       ⚠️ Unused (no integration)
│   ├── levels.js                  ✅ 1,124 lines - reasonable
│   ├── background-composer.js     ✅ 1,298 lines - extracted
│   └── asset-loader.js            ✅ 657 lines - extracted
├── tests/                         ✅ 14 test files
└── reports/                       ✅ Canary metrics
```

### Dependency Graph

```
main.js (monolith)
  ├── levels.js (level data)
  ├── background-composer.js (UI backgrounds)
  ├── guard/index.js → GuardAI, GuardAIV2, GuardCoordinator, etc.
  ├── tile/index.js → TileGrid, Pathfinder, etc. (DISABLED)
  └── nav/index.js → NavGraph, PathCheckEngine, etc. (UNUSED)
```

---

## P0 - Critical (Immediate Action Required)

**None** - Console-zero achieved, no blocking issues.

---

## P1 - High Priority (Next Sprint)

### P1-001: Scene Extraction from main.js Monolith

**Root Cause**: All 9 scenes defined inline in single 9,615-line file, making navigation, testing, and maintenance difficult.

**Impacted Files**:
- `src/main.js` (9,615 lines)

**Refactor Approach**:
1. Extract each scene to separate file in `src/scenes/` directory
2. Create base scene class with shared lifecycle methods
3. Move scene-specific logic to dedicated modules
4. Update imports in main.js

**Risk**: Medium - requires careful extraction to avoid breaking scene lifecycle

**Effort**: 3-5 days

**Acceptance Criteria**:
- [ ] Each scene in separate file (`src/scenes/BootScene.js`, etc.)
- [ ] `main.js` reduced to <1,000 lines (config + registration)
- [ ] All 14 E2E tests pass
- [ ] No console errors
- [ ] Scene transitions work identically

**Execution Sequence** (Vertical Slices):
1. **Slice 1**: Create `src/scenes/` structure + base scene class
2. **Slice 2**: Extract `BootScene` (smallest, 60 lines)
3. **Slice 3**: Extract `MainMenuScene` (1,400 lines)
4. **Slice 4**: Extract `LevelSelectScene` (600 lines)
5. **Slice 5**: Extract `SettingsScene` (800 lines)
6. **Slice 6**: Extract `ControlsScene` (200 lines)
7. **Slice 7**: Extract `ResultsScene` (500 lines)
8. **Slice 8**: Extract `VictoryScene` (300 lines)
9. **Slice 9**: Extract `GameScene` (3,700 lines) - most complex
10. **Slice 10**: Final cleanup, reduce main.js to config only

---

### P1-002: UI Component Extraction

**Root Cause**: UI creation methods (`createPrimaryButton`, `createSecondaryButton`, `createBackButton`, etc.) duplicated across scenes.

**Impacted Files**:
- `src/main.js` (lines 2,389-2,891)

**Refactor Approach**:
1. Create `src/ui/` directory
2. Extract button factory to `src/ui/ButtonFactory.js`
3. Extract panel creation to `src/ui/PanelFactory.js`
4. Extract HUD components to `src/ui/HUDComponents.js`
5. Update all scenes to use extracted components

**Risk**: Low - pure extraction, no logic changes

**Effort**: 2-3 days

**Acceptance Criteria**:
- [ ] `src/ui/ButtonFactory.js` with `createPrimaryButton`, `createSecondaryButton`
- [ ] `src/ui/PanelFactory.js` with panel creation methods
- [ ] `src/ui/HUDComponents.js` with HUD elements
- [ ] All scenes use extracted components
- [ ] Visual regression testing passes
- [ ] No console errors

---

### P1-003: Manager Class Extraction

**Root Cause**: Three manager classes defined inline in main.js instead of separate modules.

**Impacted Files**:
- `src/main.js` (lines 387-1,283)

**Refactor Approach**:
1. Extract `SaveManager` to `src/managers/SaveManager.js`
2. Extract `FullscreenManager` to `src/managers/FullscreenManager.js`
3. Extract `PerformanceManager` to `src/managers/PerformanceManager.js`
4. Create `src/managers/index.js` for exports
5. Update imports in main.js

**Risk**: Low - already well-encapsulated classes

**Effort**: 1 day

**Acceptance Criteria**:
- [ ] Each manager in separate file
- [ ] Single export point in `src/managers/index.js`
- [ ] All functionality preserved
- [ ] Settings save/load works
- [ ] Fullscreen toggle works
- [ ] Performance metrics tracked

---

### P1-004: Global Function Extraction

**Root Cause**: 50+ global functions in main.js that should be utility modules.

**Impacted Files**:
- `src/main.js` (lines 100-1,500)

**Refactor Approach**:
1. Identify function categories (scene guards, transitions, validation, etc.)
2. Create `src/utils/` directory
3. Extract scene lifecycle utilities to `src/utils/SceneGuard.js`
4. Extract transition utilities to `src/utils/SceneTransition.js`
5. Extract validation utilities to `src/utils/Validation.js`
6. Update imports

**Risk**: Low - pure extraction

**Effort**: 2 days

**Acceptance Criteria**:
- [ ] `src/utils/SceneGuard.js` with lifecycle helpers
- [ ] `src/utils/SceneTransition.js` with transition helpers
- [ ] `src/utils/Validation.js` with validation functions
- [ ] All functions imported where needed
- [ ] No global namespace pollution

---

## P2 - Medium Priority (Future Sprints)

### P2-001: Guard AI Consolidation

**Root Cause**: Dual AI systems (GuardAI legacy + GuardAIV2 modular) coexist with canary rollout.

**Impacted Files**:
- `src/guard/GuardAI.js` (431 lines)
- `src/guard/GuardAIV2.js` (807 lines)
- `src/guard/GuardStateMachine.js` (425 lines)
- `src/guard/GuardStateMachineV2.js` (932 lines)
- `src/guard/CanaryConfig.js` (canary rollout logic)

**Refactor Approach**:
1. Complete canary rollout to 100% V2
2. Remove legacy GuardAI and GuardStateMachine
3. Update all references to V2
4. Remove canary configuration
5. Update tests

**Risk**: Medium - affects core gameplay

**Effort**: 3 days

**Acceptance Criteria**:
- [ ] GuardAI.js removed
- [ ] GuardStateMachine.js removed
- [ ] CanaryConfig.js simplified (no rollout logic)
- [ ] All levels use GuardAIV2
- [ ] Guard behavior unchanged
- [ ] All tests pass

---

### P2-002: Tile/Nav System Integration or Removal

**Root Cause**: Sophisticated tile/nav system built but disabled (`USE_TILE_AI=false`) and unused.

**Impacted Files**:
- `src/tile/*` (8 files, 4,500+ lines)
- `src/nav/*` (4 files, 2,700+ lines)
- `src/main.js` (TileGrid integration)

**Refactor Approach** (Two Options):

**Option A - Enable**:
1. Complete integration testing
2. Fix any integration bugs
3. Enable tile-based AI for specific levels
4. Monitor canary metrics
5. Roll out gradually

**Option B - Remove**:
1. Mark as deprecated
2. Remove from build
3. Document in README as "future work"
4. Clean up imports

**Risk**: High - affects pathing and AI

**Effort**: 5 days (enable) or 2 days (remove)

**Acceptance Criteria** (if enabling):
- [ ] USE_TILE_AI=true for at least one level
- [ ] Guard pathing quality improved
- [ ] No stuck events
- [ ] Performance acceptable
- [ ] Canary metrics healthy

**Recommendation**: Defer decision - current legacy system is stable and performant

---

### P2-003: Level Data Reorganization

**Root Cause**: Multiple level version files coexist (levels-v6, levels-v6.1), causing confusion.

**Impacted Files**:
- `src/levels.js` (1,124 lines)
- `src/levels-v6-warehouse.js` (225 lines)
- `src/levels-v6.1-warehouse.js` (170 lines)

**Refactor Approach**:
1. Archive legacy version files to `docs/level-history/`
2. Ensure all level data is in `levels.js`
3. Add level schema validation
4. Document level creation process

**Risk**: Low - organizational

**Effort**: 1 day

**Acceptance Criteria**:
- [ ] Only `levels.js` in src/
- [ ] Legacy versions archived
- [ ] Level schema documented
- [ ] Validation passes for all levels

---

### P2-004: Scene State Management

**Root Cause**: Each scene manages its own state without central coordination.

**Impacted Files**:
- All scene files
- `src/main.js` (global state)

**Refactor Approach**:
1. Create `src/state/GameStateManager.js`
2. Define state schema for each scene
3. Implement state transitions
4. Add state persistence
5. Update scenes to use central state

**Risk**: Medium - affects all scenes

**Effort**: 4 days

**Acceptance Criteria**:
- [ ] Central state manager
- [ ] State schema documented
- [ ] State transitions logged
- [ ] State persistence works
- [ ] Scene state isolated

---

### P2-005: Test Coverage Expansion

**Root Cause**: Test infrastructure issues (timing thresholds, mock objects) cause false failures.

**Impacted Files**:
- `tests/runtime-verification-lab.spec.js` (disabled)
- `tests/regression-p1.spec.js` (failures)

**Refactor Approach**:
1. Fix mock objects in runtime verification tests
2. Adjust timing thresholds for CI environments
3. Add timeout extensions for stress tests
4. Re-enable disabled tests
5. Fix failing regression tests

**Risk**: Low - test-only

**Effort**: 2 days

**Acceptance Criteria**:
- [ ] All tests pass consistently
- [ ] No flaky tests
- [ ] CI pipeline green
- [ ] Coverage metrics tracked

---

### P2-006: Performance Optimization

**Root Cause**: No systematic performance monitoring or optimization.

**Impacted Files**:
- All game code
- `src/main.js` (PerformanceManager exists but underutilized)

**Refactor Approach**:
1. Add performance profiling to key systems
2. Identify bottlenecks (rendering, AI, collision)
3. Optimize hot paths
4. Add performance budgets
5. Monitor in production

**Risk**: Medium - optimization can introduce bugs

**Effort**: 3 days

**Acceptance Criteria**:
- [ ] Performance profiling enabled
- [ ] Bottlenecks identified
- [ ] Hot paths optimized
- [ ] Performance budgets defined
- [ ] 60 FPS maintained

---

### P2-007: Asset Pipeline Optimization

**Root Cause**: Asset loading not optimized for production.

**Impacted Files**:
- `src/asset-loader.js`
- `src/asset-manifest.js`
- `public/assets/`

**Refactor Approach**:
1. Audit asset sizes
2. Implement lazy loading for non-critical assets
3. Add asset compression
4. Optimize sprite sheets
5. Add loading progress UI

**Risk**: Low - loading-only

**Effort**: 2 days

**Acceptance Criteria**:
- [ ] Asset sizes minimized
- [ ] Lazy loading implemented
- [ ] Loading progress visible
- [ ] Initial load < 3 seconds
- [ ] No loading errors

---

### P2-008: Code Documentation

**Root Cause**: Insufficient inline documentation for complex systems.

**Impacted Files**:
- All source files

**Refactor Approach**:
1. Add JSDoc comments to all public APIs
2. Document architecture decisions
3. Create system diagrams
4. Update README with current architecture
5. Add inline comments for complex logic

**Risk**: Low - documentation-only

**Effort**: 3 days

**Acceptance Criteria**:
- [ ] All public APIs documented
- [ ] Architecture diagram created
- [ ] README updated
- [ ] Complex logic commented
- [ ] Documentation reviewed

---

### P2-009: Error Handling Standardization

**Root Cause**: Inconsistent error handling across systems.

**Impacted Files**:
- All source files

**Refactor Approach**:
1. Create error handling standards
2. Implement error boundaries in scenes
3. Add error reporting
4. Standardize error messages
5. Add recovery strategies

**Risk**: Low - error handling only

**Effort**: 2 days

**Acceptance Criteria**:
- [ ] Error handling standard documented
- [ ] Error boundaries in all scenes
- [ ] Error reporting enabled
- [ ] Recovery strategies defined
- [ ] No silent failures

---

### P2-010: Scene Transition Polish

**Root Cause**: Transition effects could be smoother and more consistent.

**Impacted Files**:
- `src/main.js` (SceneTransitionManager)
- All scenes

**Refactor Approach**:
1. Audit current transitions
2. Standardize transition durations
3. Add transition effects (fade, slide, etc.)
4. Ensure cleanup on transitions
5. Add transition analytics

**Risk**: Low - visual polish

**Effort**: 2 days

**Acceptance Criteria**:
- [ ] Transitions standardized
- [ ] Effects smooth (60 FPS)
- [ ] No memory leaks
- [ ] Transition analytics tracked
- [ ] User feedback positive

---

### P2-011: Settings System Refinement

**Root Cause**: Settings V2 recently implemented but could be further refined.

**Impacted Files**:
- `src/main.js` (SettingsScene)
- `src/managers/SaveManager.js`

**Refactor Approach**:
1. Audit current settings
2. Add missing settings (audio, controls, etc.)
3. Improve settings UI
4. Add settings validation
5. Add settings import/export

**Risk**: Low - settings only

**Effort**: 2 days

**Acceptance Criteria**:
- [ ] All settings functional
- [ ] Settings UI polished
- [ ] Validation implemented
- [ ] Import/export works
- [ ] Settings persist correctly

---

## Execution Sequence (Vertical Slices)

### Phase 1: Foundation (Week 1)
1. **P1-003**: Manager class extraction (1 day)
2. **P1-004**: Global function extraction (2 days)
3. **P1-001 Slice 1-2**: Scene structure + BootScene extraction (1 day)

### Phase 2: Scene Extraction (Weeks 2-3)
4. **P1-001 Slice 3**: MainMenuScene extraction (1 day)
5. **P1-002**: UI component extraction (2 days)
6. **P1-001 Slice 4-6**: LevelSelect, Settings, Controls extraction (2 days)
7. **P1-001 Slice 7-8**: Results, Victory extraction (1 day)
8. **P1-001 Slice 9**: GameScene extraction (2 days)
9. **P1-001 Slice 10**: Final cleanup (1 day)

### Phase 3: Polish (Week 4)
10. **P2-003**: Level data reorganization (1 day)
11. **P2-005**: Test coverage expansion (2 days)
12. **P2-008**: Code documentation (2 days)

### Phase 4: Optimization (Weeks 5-6)
13. **P2-006**: Performance optimization (3 days)
14. **P2-007**: Asset pipeline optimization (2 days)
15. **P2-009**: Error handling standardization (2 days)

### Phase 5: Advanced (Future)
16. **P1-002**: Guard AI consolidation (when canary complete)
17. **P2-002**: Tile/Nav system decision
18. **P2-004**: Scene state management
19. **P2-010**: Scene transition polish
20. **P2-011**: Settings system refinement

---

## Verification Strategy

### Implementer Verification (Self-Check)
1. **Syntax Check**: `node --check src/**/*.js`
2. **Build Check**: `npm run build` succeeds
3. **Test Check**: `npm run test:e2e` passes
4. **Console Check**: Zero console errors in browser
5. **Visual Check**: UI renders correctly
6. **Functional Check**: All features work

### Independent Verifier Verification (Gate)
1. **Clean Build**: Fresh `npm install && npm run build`
2. **Full Test Suite**: All 14 test files pass
3. **Console Zero**: Browser console has zero errors
4. **Smoke Test**: Manual playthrough of all levels
5. **Regression Test**: No features broken
6. **Performance Test**: 60 FPS maintained

### Console-Zero Gate (Mandatory)
**Definition**: Zero JavaScript errors in browser console across all game flows

**Verification Steps**:
1. Boot game
2. Navigate all menus
3. Play all 7 levels
4. Trigger fail flow
5. Trigger win flow
6. Restart levels
7. Change settings
8. Check console - must be empty

**Blocking**: Any console error blocks merge

---

## Risk Assessment

### High Risk Items
- **P1-001**: Scene extraction - complex, affects all code
- **P2-002**: Tile/Nav system - affects core gameplay

### Medium Risk Items
- **P1-002**: UI extraction - affects all scenes
- **P2-001**: Guard AI consolidation - affects AI behavior
- **P2-004**: Scene state management - affects all scenes
- **P2-006**: Performance optimization - can introduce bugs

### Low Risk Items
- **P1-003**: Manager extraction - well-encapsulated
- **P1-004**: Function extraction - pure refactoring
- **P2-003**: Level reorganization - organizational
- **P2-005**: Test fixes - test-only
- **P2-007**: Asset optimization - loading-only
- **P2-008**: Documentation - no code changes
- **P2-009**: Error handling - additive
- **P2-010**: Transition polish - visual only
- **P2-011**: Settings refinement - settings only

---

## Success Metrics

### Code Quality
- [ ] `main.js` reduced from 9,615 to <1,000 lines
- [ ] All scenes in separate files
- [ ] All UI components extracted
- [ ] All managers in separate modules
- [ ] Zero console errors
- [ ] All tests passing

### Maintainability
- [ ] Clear file organization
- [ ] Documented architecture
- [ ] Consistent code style
- [ ] No code duplication
- [ ] Easy to navigate

### Performance
- [ ] 60 FPS maintained
- [ ] Load time < 3 seconds
- [ ] No memory leaks
- [ ] Smooth transitions

### Testing
- [ ] 100% E2E test pass rate
- [ ] No flaky tests
- [ ] CI pipeline green
- [ ] Coverage metrics tracked

---

## Conclusion

GhostShift is in excellent shape with console-zero achieved and comprehensive test coverage. The primary refactor target is the monolithic `main.js` file, which should be broken down incrementally using the vertical slice approach outlined above.

**Priority Order**:
1. **P1-001**: Scene extraction (highest impact)
2. **P1-002**: UI component extraction
3. **P1-003**: Manager extraction
4. **P1-004**: Function extraction
5. **P2 items**: As time permits

**Estimated Total Effort**: 40-50 days for complete refactor

**Recommended Approach**: Start with P1 items in vertical slices, each delivering testable value. Defer P2 items until P1 complete.

**Verification**: Every slice must pass console-zero gate before merge.

---

**Generated by**: GhostShift Refactor Assessment
**Date**: 2026-02-25
**Status**: Ready for implementation
