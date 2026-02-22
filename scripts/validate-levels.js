import { LEVEL_LAYOUTS, validateLevelLayouts } from '../src/levels.js';

const result = validateLevelLayouts(LEVEL_LAYOUTS);

if (result.ok) {
  console.log(`Level validation passed: ${LEVEL_LAYOUTS.length} levels checked.`);
  process.exit(0);
}

console.error('Level validation failed.');
for (const error of result.errors) {
  console.error(`- ${error}`);
}
process.exit(1);
