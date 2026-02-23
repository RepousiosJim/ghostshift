# Base Button Prompt Template

This is the foundational prompt template for all GhostShift UI buttons. All variant prompts should follow this structure.

## Template Structure

```
A sleek pixel-art game button, {width}x{height} pixels, transparent background. {variant_description}. {state_description}. {text_spec}. {style_modifiers}.
```

## Parameters

| Parameter | Values | Description |
|-----------|--------|-------------|
| width | 300 | Button width in pixels |
| height | 52 | Button height in pixels |
| variant | primary, secondary, neutral, locked | Button type |
| state | default, hover, pressed, selected, disabled | Interaction state |

## Common Elements

### Dimensions
- Always specify exact pixel dimensions
- Format: `{width}x{height} pixels`

### Background
- Always: `transparent background`
- No colored backgrounds in the prompt

### Style Keywords
- `sleek pixel-art game button`
- `clean flat design`
- `Game UI style`
- `crisp edges`

### Common Variations

#### Gradient
- Format: `#HEX1 to #HEX2` (top-left to bottom-right)
- Lighter color first, darker second

#### Glow Effect
- `subtle outer glow in {color}`
- `increased outer glow intensity`
- `no outer glow` (pressed/disabled)

#### Border/Stroke
- `subtle stroke in {color}`
- `white border highlight (2px)` (hover)
- `no stroke` (disabled)

#### Text
- `{color} bold text "{LABEL}" centered`
- `text glow` (hover)
- `no glow` (disabled)

#### Depth Effects
- `slight bevel effect on edges` (primary default)
- `inset shadow effect creating depth` (pressed)
- `no bevel` (disabled)

---

## Quality Assurance Checklist

- [ ] Exact dimensions specified
- [ ] Transparent background explicitly stated
- [ ] Gradient colors are valid hex codes
- [ ] State-specific effects included
- [ ] Text label specified
- [ ] Game UI style keyword included

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-23 | Initial base template |

*Inherit from this base in all variant prompts*
