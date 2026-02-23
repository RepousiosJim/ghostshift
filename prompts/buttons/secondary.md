# Secondary Button Prompts

Secondary buttons are used for menu items, informational actions, and less prominent interactions.

## Characteristics

- **Gradient**: Muted blue-gray (#2a3a4a to #3a4a5a)
- **Stroke**: Subtle light gray stroke
- **Bevel**: None
- **Text**: White, centered

## States

### Default State

```
A sleek pixel-art game button, 300x52 pixels, transparent background. Secondary menu button with muted blue-gray gradient background (#2a3a4a to #3a4a5a), subtle stroke in light gray (#666688). White text "{LABEL}" centered. Clean flat design. Game UI style.
```

**Example labels**: OPTIONS, SETTINGS, HELP, ABOUT, SCORES

### Hover State

```
A sleek pixel-art game button, 300x52 pixels, transparent background. Secondary menu button hovered state - slightly brighter blue-gray (#3a4a5a to #4a5a6a), white border highlight (2px). White text "{LABEL}" centered. Clean flat design. Game UI style.
```

### Pressed State

```
A sleek pixel-art game button, 300x52 pixels, transparent background. Secondary menu button pressed state - darker blue-gray (#1a2a3a to #2a3a4a), inset effect. White text "{LABEL}" centered, offset for pressed effect. Clean flat design. Game UI style.
```

### Selected State

```
A sleek pixel-art game button, 300x52 pixels, transparent background. Secondary menu button selected state - accent border in cyan (#66ccff), slightly brighter background. White text "{LABEL}" centered. Clean flat design. Game UI style.
```

### Disabled State

```
A sleek pixel-art game button, 300x52 pixels, transparent background. Disabled secondary button - dark gray gradient (#1a1a22 to #2a2a33), no glow. Gray text (#444455) "{LABEL}" centered. Flat design. Game UI style.
```

## Color Reference

| State | Start | End | Stroke |
|-------|-------|-----|--------|
| Default | #2a3a4a | #3a4a5a | #666688 |
| Hover | #3a4a5a | #4a5a6a | White |
| Pressed | #1a2a3a | #2a3a4a | None |
| Selected | #2a4a5a | #3a5a6a | #66ccff |
| Disabled | #1a1a22 | #2a2a33 | None |

## Usage Notes

- Use for menu navigation and secondary actions
- Can have multiple per screen
- Labels can be longer than primary (up to 12 characters)
- Good for options, settings, info screens

---

## Version

| Version | Date | Author |
|---------|------|--------|
| 1.0 | 2026-02-23 | PromptSmith |
