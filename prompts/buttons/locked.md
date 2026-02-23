# Locked Button Prompts

Locked buttons indicate content or features that are not currently available to the user.

## Characteristics

- **Gradient**: Near-black (#151520 to #252535)
- **Icon**: Lock icon included
- **Glow**: Never (locked items don't activate)
- **Text**: Grayed out

## States

### Default State

```
A sleek pixel-art game button, 300x52 pixels, transparent background. Locked button with dark gradient (#151520 to #252535), subtle lock icon in dark gray, no glow effect. Grayed text "LOCKED" centered. Flat design, no bevel. Game UI style.
```

### Hover State

```
A sleek pixel-art game button, 300x52 pixels, transparent background. Locked button hover - very subtle highlight (#202030 to #303040), still no glow, lock icon visible. Grayed text "LOCKED" centered. Flat design. Game UI style.
```

## Color Reference

| State | Start | End | Icon | Text |
|-------|-------|-----|------|------|
| Default | #151520 | #252535 | #444455 | #666677 |
| Hover | #202030 | #303040 | #444455 | #777788 |

## Usage Notes

- Use for locked levels, premium features, or unavailable content
- Never show press/active states (can't interact)
- Lock icon should be subtle but recognizable
- Text typically "LOCKED" or level number

## Accessibility

- Include `aria-disabled="true"`
- May show tooltip explaining why locked
- Keyboard should not focus locked items

---

## Version

| Version | Date | Author |
|---------|------|--------|
| 1.0 | 2026-02-23 | PromptSmith |
