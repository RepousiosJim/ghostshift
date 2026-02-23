# GhostShift Button Generation Matrix

This document defines the complete generation matrix for UI button assets.

---

## Matrix Overview

### Families × States × Variants

| Family | States | Variants (Labels) |
|--------|--------|-------------------|
| primary | default, hover, pressed, selected, disabled | PLAY, START, CONTINUE |
| secondary | default, hover, pressed, selected, disabled | MENU, OPTIONS, SETTINGS |
| neutral | default, hover, pressed, disabled | BACK, CANCEL, CLOSE |
| locked | default, hover | LOCKED |

### Total Assets Per Family

| Family | States Count | Assets (1 label each) |
|--------|--------------|----------------------|
| primary | 5 | 5 |
| secondary | 5 | 5 |
| neutral | 4 | 4 |
| locked | 2 | 2 |
| **Total** | **16** | **16** |

---

## Naming Convention

### File Naming

```
{family}-{state}.png
```

Examples:
- `primary-default.png`
- `primary-hover.png`
- `secondary-pressed.png`
- `neutral-disabled.png`
- `locked-default.png`

### Directory Structure

```
public/assets/ui/buttons/
├── primary-default.png
├── primary-hover.png
├── primary-pressed.png
├── primary-selected.png
├── primary-disabled.png
├── secondary-default.png
├── secondary-hover.png
├── secondary-pressed.png
├── secondary-selected.png
├── secondary-disabled.png
├── neutral-default.png
├── neutral-hover.png
├── neutral-pressed.png
├── neutral-disabled.png
├── locked-default.png
└── locked-hover.png
```

---

## Generation Matrix Table

### Primary Family

| State | Filename | Dimensions | Label |
|-------|----------|------------|-------|
| default | primary-default.png | 300x52 | PLAY |
| hover | primary-hover.png | 300x52 | PLAY |
| pressed | primary-pressed.png | 300x52 | PLAY |
| selected | primary-selected.png | 300x52 | PLAY |
| disabled | primary-disabled.png | 300x52 | PLAY |

### Secondary Family

| State | Filename | Dimensions | Label |
|-------|----------|------------|-------|
| default | secondary-default.png | 300x52 | MENU |
| hover | secondary-hover.png | 300x52 | MENU |
| pressed | secondary-pressed.png | 300x52 | MENU |
| selected | secondary-selected.png | 300x52 | MENU |
| disabled | secondary-disabled.png | 300x52 | MENU |

### Neutral Family

| State | Filename | Dimensions | Label |
|-------|----------|------------|-------|
| default | neutral-default.png | 300x52 | BACK |
| hover | neutral-hover.png | 300x52 | BACK |
| pressed | neutral-pressed.png | 300x52 | BACK |
| disabled | neutral-disabled.png | 300x52 | BACK |

### Locked Family

| State | Filename | Dimensions | Label |
|-------|----------|------------|-------|
| default | locked-default.png | 300x52 | LOCKED |
| hover | locked-hover.png | 300x52 | LOCKED |

---

## Pilot Batch Specification

For initial testing, generate one complete family across all states.

**Recommended**: Primary family (most visual states)
- 5 assets: default, hover, pressed, selected, disabled
- Command: `npm run generate-assets -- --family=primary`

---

## Future Expansions

### Additional Labels

To generate with different labels, modify the prompt template:

```javascript
// In generate-ui-assets.js
const LABEL_MAP = {
  primary: ['PLAY', 'START', 'CONTINUE', 'SUBMIT', 'JOIN'],
  secondary: ['MENU', 'OPTIONS', 'SETTINGS', 'HELP', 'ABOUT'],
  neutral: ['BACK', 'CANCEL', 'CLOSE', 'EXIT', 'RETURN'],
  // ...
};
```

### Danger/Negative Buttons

Not currently in generation matrix. Add when needed:

| State | Filename | Dimensions | Label |
|-------|----------|------------|-------|
| default | danger-default.png | 300x52 | DELETE |
| hover | danger-hover.png | 300x52 | DELETE |
| pressed | danger-pressed.png | 300x52 | DELETE |
| disabled | danger-disabled.png | 300x52 | DELETE |

---

## Generation Commands

### Generate All
```bash
npm run generate-assets
```

### Dry Run (Preview)
```bash
npm run generate-assets -- --dry-run
```

### Specific Family
```bash
npm run generate-assets -- --family=primary
npm run generate-assets -- --family=secondary
```

### Specific State
```bash
npm run generate-assets -- --state=hover
npm run generate-assets -- --state=default
```

---

## Metadata

- **Version**: 1.0
- **Created**: 2026-02-23
- **Prompt Pack**: GhostShift UI Button Asset Prompt Pack v1.0
