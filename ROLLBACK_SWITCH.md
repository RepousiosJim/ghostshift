# GhostShift Guard AI Rollback Switch

## Quick Rollback (Emergency)

To immediately revert all levels to legacy guard AI, set **ANY** of these:

### Option 1: URL Parameter (Recommended for quick testing)
```
https://your-game-url.com/?modularGuard=none
```

### Option 2: Browser Console (Runtime toggle)
```javascript
window.GHOSTSHIFT_MODULAR_GUARD_AI = false;
// Then restart the current level
```

### Option 3: Code Change (Deployment rollback)
Edit `src/guard/CanaryConfig.js`:
```javascript
export const CANARY_CONFIG = {
  enabled: false,  // Set to false to disable all modular AI
  canaryLevels: [0, 1, 2, 3, 4, 5, 6],
  // ...
};
```

## Partial Rollback (Per-Level)

To disable modular AI for specific levels, edit `src/guard/CanaryConfig.js`:

```javascript
canaryLevels: [0, 1, 2, 3],  // Remove levels 4, 5, 6 to revert them
```

## Current Configuration (2026-02-24 - Step 7)

| Level | Name | AI Mode | Status |
|-------|------|---------|--------|
| 0 | Warehouse | Modular | Active |
| 1 | Labs | Modular | Active |
| 2 | Server Farm | Modular | Active |
| 3 | Comms Tower | Modular | Active |
| 4 | The Vault | Modular | Active |
| 5 | Training Facility | Modular | Active |
| 6 | Penthouse | Modular | Active |

**Coverage: 100% (7 of 7 levels)**

## Legacy Fallback

When modular AI fails (3+ errors), the system automatically:
1. Logs the error to `CanaryMetricsLogger`
2. Falls back to legacy AI for that level
3. Retries modular AI after 30 seconds
4. Reports metrics for analysis

## Fallback Behavior

When modular AI fails (3+ errors), the system automatically:
1. Logs the error to `CanaryMetricsLogger`
2. Falls back to legacy AI for that level
3. Retries modular AI after 30 seconds
4. Reports metrics for analysis

## Monitoring

Check canary health:
```bash
node scripts/canary-rollback-guard.js
```

For JSON output:
```bash
node scripts/canary-rollback-guard.js --json
```

## Rollback Window

This rollback switch is maintained for **one release cycle** (approximately 2 weeks after 100% rollout).

After the rollback window expires:
- Legacy code will be deprecated
- Fallback will be removed
- All levels will use modular AI exclusively

## Related Files

- `src/guard/CanaryConfig.js` - Canary configuration
- `src/guard/GuardAI.js` - Modular guard AI orchestrator
- `scripts/canary-rollback-guard.js` - Health monitoring script
- `tests/canary-comparison.spec.js` - Canary validation tests

## Last Updated

2026-02-24 - Legacy guard cleanup preparation
