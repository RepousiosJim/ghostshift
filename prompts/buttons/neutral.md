# Neutral Button Prompts

Neutral buttons are used for cancel, back, and other utility actions that don't require visual prominence.

## Characteristics

- **Gradient**: Dark slate (#1a1a2a to #2a2a3a)
- **Stroke**: Subtle dark stroke (#444466)
- **Bevel**: None
- **Text**: Light gray, centered

## States

### Default State

```
A sleek pixel-art game button, 300x52 pixels, transparent background. Neutral/back button with dark slate gradient (#1a1a2a to #2a2a3a), subtle stroke (#444466). Light gray text "{LABEL}" centered. Clean flat design. Game UI style.
```

**Example labels**: BACK, CANCEL, CLOSE, EXIT, RETURN

### Hover State

```
A sleek pixel-art game button, 300x52 pixels, transparent background. Neutral/back button hovered - slightly lighter slate (#2a2a3a to #3a3a4a), white border highlight. Light gray text "{LABEL}" centered. Clean flat design. Game UI style.
```

### Pressed State

```
A sleek pixel-art game button, 300x52 pixels, transparent background. Neutral/back button pressed - darker slate (#0a0a1a to #1a1a2a), inset shadow. Light gray text "{LABEL}" centered, offset. Clean flat design. Game UI style.
```

### Disabled State

```
A sleek pixel-art game button, 300x52 pixels, transparent background. Disabled neutral button - very dark gray (#0a0a10 to #151520), no stroke. Dim gray text "{LABEL}" centered. Flat design. Game UI style.
```

## Color Reference

| State | Start | End | Text |
|-------|-------|-----|------|
| Default | #1a1a2a | #2a2a3a | #cccccc |
| Hover | #2a2a3a | #3a3a4a | #ffffff |
| Pressed | #0a0a1a | #1a1a2a | #aaaaaa |
| Disabled | #0a0a10 | #151520 | #555555 |

## Usage Notes

- Use for cancel, back, close, and exit actions
- Place opposite to primary action for visual hierarchy
- Labels typically 4-8 characters
- Intentionally lower visual weight than primary

---

## Version

| Version | Date | Author |
|---------|------|--------|
| 1.0 | 2026-02-23 | PromptSmith |
