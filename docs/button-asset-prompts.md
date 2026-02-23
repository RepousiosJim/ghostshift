# GhostShift Button Asset Prompt Pack

This document contains optimized prompts for generating GhostShift UI button assets using OpenAI's image generation API (GPT Image 1).

## Asset Specifications

| Property | Value |
|----------|-------|
| Dimensions | 300x52 px (primary), 180x52 px (secondary) |
| Format | PNG with transparency |
| Background | Transparent |
| Style | Flat, minimal, pixel-game aesthetic |

## Button Variants

### 1. Primary Button (Play/CTA)
- **Default**: Vibrant blue gradient, white text, subtle glow
- **Hover**: Brighter, white border highlight
- **Pressed**: Darker, inset shadow effect
- **Selected**: Green tint, checkmark indicator
- **Disabled**: Grayed out, no glow

### 2. Secondary Button (Menu/Info)
- **Default**: Muted blue-gray, white text
- **Hover**: Slightly brighter, subtle highlight
- **Pressed**: Darker shade
- **Selected**: Accent border
- **Disabled**: Dim gray

### 3. Neutral Button (Back/Cancel)
- **Default**: Dark slate, light text
- **Hover**: Border highlight
- **Pressed**: Inset effect
- **Selected**: N/A
- **Disabled**: Muted gray

### 4. Locked Button
- **Default**: Dark with lock icon, no interaction glow
- **Hover**: Subtle highlight but no activation
- **Pressed**: No press effect
- **Selected**: N/A
- **Disabled**: Locked state (same as default)

---

## Prompt Templates

### Primary Button - Default
```
A sleek pixel-art game button, 300x52 pixels, transparent background. Primary CTA button with vibrant blue gradient background (#2244aa to #4466cc), subtle outer glow in cyan. White bold text "PLAY" centered. Clean flat design, slight bevel effect on edges. No shadow. Game UI style, crisp edges.
```

### Primary Button - Hover
```
A sleek pixel-art game button, 300x52 pixels, transparent background. Primary CTA button hovered state - brighter blue gradient (#3355bb to #5577dd), white glowing border highlight (2px), increased outer glow intensity. White bold text "PLAY" centered with subtle text glow. Clean flat design. Game UI style.
```

### Primary Button - Pressed
```
A sleek pixel-art game button, 300x52 pixels, transparent background. Primary CTA button pressed/active state - darker blue gradient (#1122aa to #2244cc), inset shadow effect creating depth, no outer glow. White bold text "PLAY" centered, slightly offset down (2px) for pressed effect. Clean flat design. Game UI style.
```

### Primary Button - Selected
```
A sleek pixel-art game button, 300x52 pixels, transparent background. Primary CTA button selected state - green tint gradient (#226622 to #338833), subtle glow in green. White bold text "PLAY" with checkmark indicator. Clean flat design. Game UI style.
```

### Primary Button - Disabled
```
A sleek pixel-art game button, 300x52 pixels, transparent background. Disabled primary button - gray gradient (#333340 to #444455), no glow, no hover effects. Gray text (#666677) "PLAY" centered. Flat design, no bevel. Game UI style.
```

---

### Secondary Button - Default
```
A sleek pixel-art game button, 300x52 pixels, transparent background. Secondary menu button with muted blue-gray gradient background (#2a3a4a to #3a4a5a), subtle stroke in light gray (#666688). White text "CONTINUE" centered. Clean flat design. Game UI style.
```

### Secondary Button - Hover
```
A sleek pixel-art game button, 300x52 pixels, transparent background. Secondary menu button hovered state - slightly brighter blue-gray (#3a4a5a to #4a5a6a), white border highlight (2px). White text "CONTINUE" centered. Clean flat design. Game UI style.
```

### Secondary Button - Pressed
```
A sleek pixel-art game button, 300x52 pixels, transparent background. Secondary menu button pressed state - darker blue-gray (#1a2a3a to #2a3a4a), inset effect. White text "CONTINUE" centered, offset for pressed effect. Clean flat design. Game UI style.
```

### Secondary Button - Selected
```
A sleek pixel-art game button, 300x52 pixels, transparent background. Secondary menu button selected state - accent border in cyan (#66ccff), slightly brighter background. White text "CONTINUE" centered. Clean flat design. Game UI style.
```

### Secondary Button - Disabled
```
A sleek pixel-art game button, 300x52 pixels, transparent background. Disabled secondary button - dark gray gradient (#1a1a22 to #2a2a33), no glow. Gray text (#444455) "CONTINUE" centered. Flat design. Game UI style.
```

---

### Neutral Button - Default
```
A sleek pixel-art game button, 300x52 pixels, transparent background. Neutral/back button with dark slate gradient (#1a1a2a to #2a2a3a), subtle stroke (#444466). Light gray text "BACK" centered. Clean flat design. Game UI style.
```

### Neutral Button - Hover
```
A sleek pixel-art game button, 300x52 pixels, transparent background. Neutral/back button hovered - slightly lighter slate (#2a2a3a to #3a3a4a), white border highlight. Light gray text "BACK" centered. Clean flat design. Game UI style.
```

### Neutral Button - Pressed
```
A sleek pixel-art game button, 300x52 pixels, transparent background. Neutral/back button pressed - darker slate (#0a0a1a to #1a1a2a), inset shadow. Light gray text "BACK" centered, offset. Clean flat design. Game UI style.
```

### Neutral Button - Disabled
```
A sleek pixel-art game button, 300x52 pixels, transparent background. Disabled neutral button - very dark gray (#0a0a10 to #151520), no stroke. Dim gray text "BACK" centered. Flat design. Game UI style.
```

---

### Locked Button - Default
```
A sleek pixel-art game button, 300x52 pixels, transparent background. Locked button with dark gradient (#151520 to #252535), subtle lock icon (🔒) in dark gray, no glow effect. Grayed text "LOCKED" centered. Flat design, no bevel. Game UI style.
```

### Locked Button - Hover
```
A sleek pixel-art game button, 300x52 pixels, transparent background. Locked button hover - very subtle highlight (#202030 to #303040), still no glow, lock icon visible. Grayed text "LOCKED" centered. Flat design. Game UI style.
```

---

## Color Reference

| Element | Hex Code |
|---------|----------|
| Primary Default BG | #2244aa |
| Primary Hover BG | #3355bb |
| Primary Pressed BG | #1122aa |
| Primary Selected BG | #226622 |
| Primary Disabled BG | #333340 |
| Secondary Default BG | #2a3a4a |
| Secondary Hover BG | #3a4a5a |
| Secondary Pressed BG | #1a2a3a |
| Neutral Default BG | #1a1a2a |
| Neutral Hover BG | #2a2a3a |
| Locked BG | #151520 |
| Stroke/Highlight | #ffffff |
| Text Default | #ffffff |
| Text Disabled | #666677 |

---

## Generation Commands

Use the provided `scripts/generate-ui-assets.js` script:

```bash
# Full generation (requires OPENAI_API_KEY)
npm run generate-assets

# Dry run (preview prompts without generating)
npm run generate-assets -- --dry-run
```

## Output Location

Generated assets are saved to:
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
