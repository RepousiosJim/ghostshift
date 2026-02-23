# Negative/Danger Button Prompts

Negative buttons are used for destructive actions like DELETE, RESET, QUIT, or error states.

## Characteristics

- **Gradient**: Red/crimson tones
- **Purpose**: Destructive actions, warnings, errors
- **Visual weight**: High (like primary)

## Warning State (Caution)

Used for actions that need attention but aren't fully destructive.

```
A sleek pixel-art game button, 300x52 pixels, transparent background. Warning button with amber/orange gradient (#aa6622 to #cc8844), subtle glow in orange. White bold text "{LABEL}" centered. Clean flat design. Game UI style.
```

**Example labels**: RESET, WARNING

## Danger State (Destructive)

Used for permanent or impactful actions.

```
A sleek pixel-art game button, 300x52 pixels, transparent background. Danger button with red gradient (#aa2222 to #cc4444), subtle outer glow in red. White bold text "{LABEL}" centered. Clean flat design. Game UI style.
```

**Example labels**: DELETE, QUIT, EXIT, ABORT

## Danger Hover

```
A sleek pixel-art game button, 300x52 pixels, transparent background. Danger button hovered - brighter red gradient (#cc3333 to #dd5555), white border highlight (2px), increased red glow. White bold text "{LABEL}" centered. Clean flat design. Game UI style.
```

## Danger Pressed

```
A sleek pixel-art game button, 300x52 pixels, transparent background. Danger button pressed - darker red gradient (#881111 to #aa2222), inset shadow effect, no glow. White bold text "{LABEL}" centered, offset down. Clean flat design. Game UI style.
```

## Danger Disabled

```
A sleek pixel-art game button, 300x52 pixels, transparent background. Disabled danger button - dark gray gradient (#333340 to #444455), no glow. Gray text (#666677) "{LABEL}" centered. Flat design. Game UI style.
```

## Color Reference

| Type | State | Start | End | Glow |
|------|-------|-------|-----|------|
| Warning | Default | #aa6622 | #cc8844 | Orange |
| Warning | Hover | #cc7744 | #dd9955 | Bright Orange |
| Danger | Default | #aa2222 | #cc4444 | Red |
| Danger | Hover | #cc3333 | #dd5555 | Bright Red |
| Danger | Pressed | #881111 | #aa2222 | None |
| Danger | Disabled | #333340 | #444455 | None |

## Usage Guidelines

1. **Confirmation required** - Never execute on single click
2. **Clear labeling** - Use explicit words (DELETE not REMOVE)
3. **Visual hierarchy** - Position away from primary actions
4. **Accessibility** - Ensure sufficient contrast for warning colors

## Common Labels

| Label | Type | Context |
|-------|------|---------|
| DELETE | Danger | Remove saved data |
| QUIT | Danger | Exit game |
| RESET | Warning | Reset progress |
| ABORT | Danger | Cancel operation |
| WARNING | Warning | Attention needed |

---

## Integration Note

These prompts can be added to the generation script as an extension. Currently not in the default generation matrix but available for future implementation.

---

## Version

| Version | Date | Author |
|---------|------|--------|
| 1.0 | 2026-02-23 | PromptSmith |
