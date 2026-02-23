# GhostShift Button Asset Prompts - Summary

This document provides an overview of the button asset prompt system. See individual files for complete specifications.

## Quick Reference

| Resource | Location |
|----------|----------|
| Style Guide | `docs/ui-button-style-guide.md` |
| Prompt Pack | `prompts/buttons/` |
| Generation Matrix | `prompts/buttons/README.md` |
| Generator Script | `scripts/generate-ui-assets.js` |

## Prompt Pack Files

| File | Description |
|------|-------------|
| `base.md` | Base template for all button prompts |
| `primary.md` | Primary CTA button prompts (PLAY, START) |
| `secondary.md` | Menu button prompts (OPTIONS, SETTINGS) |
| `neutral.md` | Utility button prompts (BACK, CANCEL) |
| `locked.md` | Locked state prompts |
| `negatives.md` | Danger/warning button prompts |

## Button Families

- **Primary**: Main CTAs (default, hover, pressed, selected, disabled)
- **Secondary**: Menu items (default, hover, pressed, selected, disabled)
- **Neutral**: Actions (default, hover, pressed, disabled)
- **Locked**: Unavailable (default, hover)

## Generation

```bash
# Dry run
npm run generate-assets -- --dry-run

# Generate all
npm run generate-assets

# Generate pilot (primary family)
npm run generate-assets -- --family=primary
```

## Output

Assets generated to: `public/assets/ui/buttons/`

Naming: `{family}-{state}.png` (e.g., `primary-default.png`)

## Status

- Style guide: ✅ Complete
- Prompt pack: ✅ Complete
- Generator: ✅ Ready
- Assets: ⏳ Pending (requires OPENAI_API_KEY)
