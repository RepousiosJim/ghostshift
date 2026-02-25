#!/usr/bin/env node
/**
 * GhostShift Refactor Metrics Analyzer
 * Generates metrics for refactor assessment
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const PROJECT_ROOT = join(process.cwd(), '..');
const SRC_DIR = join(PROJECT_ROOT, 'src');

function countLines(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return content.split('\n').length;
  } catch (error) {
    return 0;
  }
}

function analyzeFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  return {
    path: filePath.replace(PROJECT_ROOT, ''),
    lines: lines.length,
    classes: (content.match(/^class\s+\w+/gm) || []).length,
    functions: (content.match(/^(export\s+)?(async\s+)?function\s+\w+/gm) || []).length,
    imports: (content.match(/^import\s+/gm) || []).length,
    exports: (content.match(/^export\s+/gm) || []).length,
    todos: (content.match(/\/\/\s*TODO/gi) || []).length,
    fixes: (content.match(/\/\/\s*FIXME/gi) || []).length,
    hacks: (content.match(/\/\/\s*HACK/gi) || []).length,
  };
}

function analyzeDirectory(dir) {
  const results = [];
  
  const items = readdirSync(dir);
  for (const item of items) {
    const fullPath = join(dir, item);
    const stat = statSync(fullPath);
    
    if (stat.isDirectory()) {
      results.push(...analyzeDirectory(fullPath));
    } else if (extname(item) === '.js') {
      results.push(analyzeFile(fullPath));
    }
  }
  
  return results;
}

function generateReport() {
  console.log('# GhostShift Code Metrics\n');
  console.log('**Generated**: ' + new Date().toISOString() + '\n');
  
  // Analyze all source files
  const files = analyzeDirectory(SRC_DIR);
  
  // Sort by line count
  files.sort((a, b) => b.lines - a.lines);
  
  // Summary
  const total = {
    files: files.length,
    lines: files.reduce((sum, f) => sum + f.lines, 0),
    classes: files.reduce((sum, f) => sum + f.classes, 0),
    functions: files.reduce((sum, f) => sum + f.functions, 0),
    imports: files.reduce((sum, f) => sum + f.imports, 0),
    exports: files.reduce((sum, f) => sum + f.exports, 0),
    todos: files.reduce((sum, f) => sum + f.todos, 0),
    fixes: files.reduce((sum, f) => sum + f.fixes, 0),
    hacks: files.reduce((sum, f) => sum + f.hacks, 0),
  };
  
  console.log('## Summary\n');
  console.log(`- **Total Files**: ${total.files}`);
  console.log(`- **Total Lines**: ${total.lines.toLocaleString()}`);
  console.log(`- **Total Classes**: ${total.classes}`);
  console.log(`- **Total Functions**: ${total.functions}`);
  console.log(`- **Total Imports**: ${total.imports}`);
  console.log(`- **Total Exports**: ${total.exports}`);
  console.log(`- **TODOs**: ${total.todos}`);
  console.log(`- **FIXMEs**: ${total.fixes}`);
  console.log(`- **HACKs**: ${total.hacks}\n`);
  
  // Hotspot files (top 20 by line count)
  console.log('## Hotspot Files (Top 20 by Line Count)\n');
  console.log('| File | Lines | Classes | Functions | TODOs | FIXMEs |');
  console.log('|------|-------|---------|-----------|-------|--------|');
  
  for (const file of files.slice(0, 20)) {
    console.log(`| ${file.path} | ${file.lines.toLocaleString()} | ${file.classes} | ${file.functions} | ${file.todos} | ${file.fixes} |`);
  }
  
  // Large files (>500 lines)
  const largeFiles = files.filter(f => f.lines > 500);
  console.log(`\n## Large Files (>500 lines): ${largeFiles.length}\n`);
  
  if (largeFiles.length > 0) {
    console.log('| File | Lines | Recommendation |');
    console.log('|------|-------|----------------|');
    
    for (const file of largeFiles) {
      let recommendation = 'Review for extraction';
      if (file.lines > 5000) recommendation = 'Extract immediately';
      else if (file.lines > 2000) recommendation = 'Extract soon';
      else if (file.lines > 1000) recommendation = 'Consider extraction';
      
      console.log(`| ${file.path} | ${file.lines.toLocaleString()} | ${recommendation} |`);
    }
  }
  
  // Module analysis
  const modules = {
    guard: files.filter(f => f.path.includes('/guard/')),
    tile: files.filter(f => f.path.includes('/tile/')),
    nav: files.filter(f => f.path.includes('/nav/')),
    scenes: files.filter(f => f.path.includes('/scenes/')),
  };
  
  console.log('\n## Module Breakdown\n');
  console.log('| Module | Files | Lines | Classes | Functions |');
  console.log('|--------|-------|-------|---------|-----------|');
  
  for (const [name, moduleFiles] of Object.entries(modules)) {
    if (moduleFiles.length > 0) {
      const lines = moduleFiles.reduce((sum, f) => sum + f.lines, 0);
      const classes = moduleFiles.reduce((sum, f) => sum + f.classes, 0);
      const functions = moduleFiles.reduce((sum, f) => sum + f.functions, 0);
      console.log(`| ${name} | ${moduleFiles.length} | ${lines.toLocaleString()} | ${classes} | ${functions} |`);
    }
  }
  
  // Main.js specific analysis
  const mainFile = files.find(f => f.path.includes('main.js'));
  if (mainFile) {
    console.log('\n## main.js Analysis\n');
    console.log(`- **Lines**: ${mainFile.lines.toLocaleString()} (${((mainFile.lines / total.lines) * 100).toFixed(1)}% of codebase)`);
    console.log(`- **Classes**: ${mainFile.classes}`);
    console.log(`- **Functions**: ${mainFile.functions}`);
    console.log(`- **TODOs**: ${mainFile.todos}`);
    console.log(`- **FIXMEs**: ${mainFile.fixes}`);
    console.log(`- **HACKs**: ${mainFile.hacks}`);
    
    console.log('\n**Status**: ⚠️ MONOLITH - Requires extraction');
  }
  
  // Recommendations
  console.log('\n## Recommendations\n');
  
  if (mainFile && mainFile.lines > 5000) {
    console.log('1. **P1-001**: Extract scenes from main.js immediately');
  }
  
  const duplicateRisk = files.filter(f => f.lines > 500 && f.functions > 20);
  if (duplicateRisk.length > 0) {
    console.log(`2. **P1-002**: Review ${duplicateRisk.length} files for duplicate code patterns`);
  }
  
  if (total.todos > 10) {
    console.log(`3. **P2**: Address ${total.todos} TODO comments`);
  }
  
  if (total.fixes > 5) {
    console.log(`4. **P2**: Fix ${total.fixes} FIXME comments`);
  }
  
  console.log('\n---\n');
  console.log(`Report generated by GhostShift Refactor Metrics Analyzer`);
}

// Run
generateReport();
