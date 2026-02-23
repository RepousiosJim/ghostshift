# GhostShift Button Assets

This directory contains UI button assets generated via OpenAI image generation.

## Status: Awaiting Generation

No button assets have been generated yet. To generate:

```bash
# Set your OpenAI API key
export OPENAI_API_KEY=your_api_key_here

# Generate all button assets
npm run generate-assets
```

## Available Scripts

- `npm run generate-assets` - Generate all button assets
- `npm run generate-assets -- --dry-run` - Preview prompts without generating
- `npm run generate-assets -- --state=hover` - Generate specific state

## Documentation

See `docs/button-asset-prompts.md` for the full prompt pack and asset specifications.

## Asset Naming Convention

- `{variant}-{state}.png`
- Variants: `primary`, `secondary`, `neutral`, `locked`
- States: `default`, `hover`, `pressed`, `selected`, `disabled`
