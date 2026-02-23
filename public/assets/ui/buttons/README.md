# GhostShift Button Assets - Integration Readiness

This directory contains UI button assets for GhostShift UI.

## Status

**Pilot batch pending** - No assets generated yet (no OPENAI_API_KEY set).

## Available Assets

Run generation to populate this directory:

```bash
# Set API key
export OPENAI_API_KEY=your_key_here

# Generate all assets
npm run generate-assets

# Generate only primary family (pilot)
npm run generate-assets -- --family=primary
```

## Integration Guidelines

### Asset Sizes

| Property | Value |
|----------|-------|
| Width | 300px |
| Height | 52px |
| Format | PNG (32-bit RGBA) |
| Background | Transparent |

### Text Overlay Strategy

**Recommended approach**: Generate buttons WITHOUT text, overlay text separately.

```html
<button class="btn btn-primary" data-state="default">
  <span class="btn-text">PLAY</span>
</button>
```

**CSS**:
```css
.btn {
  width: 300px;
  height: 52px;
  background-size: cover;
  /* Use data attributes for state-based backgrounds */
}
.btn[data-state="default"] {
  background-image: url('/assets/ui/buttons/primary-default.png');
}
.btn[data-state="hover"] {
  background-image: url('/assets/ui/buttons/primary-hover.png');
}
.btn[data-state="pressed"] {
  background-image: url('/assets/ui/buttons/primary-pressed.png');
}
.btn[data-state="disabled"] {
  background-image: url('/assets/ui/buttons/primary-disabled.png');
}
```

### Fallback Mode

If API generation fails, use CSS-only fallback:

```css
.btn-fallback {
  background: linear-gradient(180deg, #2244aa 0%, #4466cc 100%);
  border: none;
  border-radius: 6px;
  color: white;
  font-weight: bold;
  padding: 14px 24px;
  /* Match dimensions */
  width: 300px;
  height: 52px;
}
```

### Accessibility

- Always include `alt` text or `aria-label`
- Support keyboard navigation (Tab, Enter, Space)
- Use `aria-disabled="true"` for locked/disabled states
- Support `aria-pressed` for toggle buttons

### Performance

- Preload default states
- Lazy load hover/pressed states
- Consider sprite sheets for many buttons
- Target: < 5KB per asset (PNG)

## Documentation

- **Style Guide**: `docs/ui-button-style-guide.md`
- **Prompt Pack**: `prompts/buttons/`
- **Generation Matrix**: `prompts/buttons/README.md`

## Quick Start

1. Generate assets: `npm run generate-assets`
2. Integrate into UI using CSS background approach
3. Test all states (default, hover, pressed, disabled)
