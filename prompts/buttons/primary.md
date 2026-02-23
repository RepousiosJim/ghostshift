# Primary Button Prompts

Primary buttons are the main call-to-action (CTA) buttons used for critical game actions like PLAY, START, CONTINUE, SUBMIT.

## Characteristics

- **Gradient**: Vibrant blue (#2244aa to #4466cc)
- **Glow**: Cyan outer glow
- **Bevel**: Subtle bevel effect on edges
- **Text**: White bold, centered

## States

### Default State

```
A sleek pixel-art game button, 300x52 pixels, transparent background. Primary CTA button with vibrant blue gradient background (#2244aa to #4466cc), subtle outer glow in cyan. White bold text "{LABEL}" centered. Clean flat design, slight bevel effect on edges. No shadow. Game UI style, crisp edges.
```

**Example labels**: PLAY, START, CONTINUE, SUBMIT, JOIN

### Hover State

```
A sleek pixel-art game button, 300x52 pixels, transparent background. Primary CTA button hovered state - brighter blue gradient (#3355bb to #5577dd), white glowing border highlight (2px), increased outer glow intensity. White bold text "{LABEL}" centered with subtle text glow. Clean flat design. Game UI style.
```

### Pressed/Active State

```
A sleek pixel-art game button, 300x52 pixels, transparent background. Primary CTA button pressed/active state - darker blue gradient (#1122aa to #2244cc), inset shadow effect creating depth, no outer glow. White bold text "{LABEL}" centered, slightly offset down (2px) for pressed effect. Clean flat design. Game UI style.
```

### Selected State

```
A sleek pixel-art game button, 300x52 pixels, transparent background. Primary CTA button selected state - green tint gradient (#226622 to #338833), subtle glow in green. White bold text "{LABEL}" with checkmark indicator. Clean flat design. Game UI style.
```

### Disabled State

```
A sleek pixel-art game button, 300x52 pixels, transparent background. Disabled primary button - gray gradient (#333340 to #444455), no glow, no hover effects. Gray text (#666677) "{LABEL}" centered. Flat design, no bevel. Game UI style.
```

## Color Reference

| State | Start | End | Glow | Border |
|-------|-------|-----|------|--------|
| Default | #2244aa | #4466cc | Cyan | None |
| Hover | #3355bb | #5577dd | Bright Cyan | White 2px |
| Pressed | #1122aa | #2244cc | None | None |
| Selected | #226622 | #338833 | Green | None |
| Disabled | #333340 | #444455 | None | None |

## Usage Notes

- Use for main game actions only (not for navigation)
- Maximum 1-2 primary buttons per screen
- Labels should be short (4-8 characters)
- Never use for destructive actions (use danger/negatives)

---

## Version

| Version | Date | Author |
|---------|------|--------|
| 1.0 | 2026-02-23 | PromptSmith |
