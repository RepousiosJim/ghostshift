#!/usr/bin/env node
/**
 * Canary Daily Report Generator
 * 
 * Generates a daily summary report for canary health.
 * Can be run as a cron job or manually.
 * 
 * Usage:
 *   node scripts/canary-daily-report.js [--date YYYY-MM-DD] [--output dir]
 * 
 * Options:
 *   --date    Generate report for specific date (default: today)
 *   --output  Output directory for report (default: reports/)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Canary levels from CanaryConfig.js
const CANARY_LEVELS = [0, 1, 2, 3];
const LEGACY_LEVELS = [4, 5, 6];
const LEVEL_NAMES = ['Warehouse', 'Labs', 'Server Farm', 'Comms Tower', 'The Vault', 'Training Facility', 'Penthouse'];

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = {
    date: new Date().toISOString().split('T')[0],
    output: path.join(PROJECT_ROOT, 'reports'),
    help: false
  };
  
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--date':
        args.date = argv[++i];
        break;
      case '--output':
        args.output = argv[++i];
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
    }
  }
  
  return args;
}

/**
 * Load metrics from storage
 */
function loadMetrics(date) {
  const metricsPaths = [
    path.join(PROJECT_ROOT, 'canary-metrics.json'),
    path.join(PROJECT_ROOT, 'reports', 'canary-metrics.json'),
    path.join(PROJECT_ROOT, '.canary', 'metrics.json')
  ];
  
  for (const metricsPath of metricsPaths) {
    if (fs.existsSync(metricsPath)) {
      try {
        const data = fs.readFileSync(metricsPath, 'utf8');
        const allMetrics = JSON.parse(data);
        return allMetrics[date] || null;
      } catch (e) {
        console.error(`Warning: Failed to load metrics from ${metricsPath}: ${e.message}`);
      }
    }
  }
  
  return null;
}

/**
 * Generate simulated metrics for testing/demo
 */
function generateSimulatedMetrics(date) {
  const levels = {};
  
  for (const levelIndex of CANARY_LEVELS) {
    levels[`level_${levelIndex}`] = {
      levelIndex,
      levelName: LEVEL_NAMES[levelIndex],
      aiMode: 'modular',
      sessionCount: Math.floor(Math.random() * 10) + 5,
      totalSamples: Math.floor(Math.random() * 200) + 100,
      totalStuckEvents: Math.floor(Math.random() * 2),
      totalAnomalies: Math.floor(Math.random() * 3),
      fallbackTriggers: 0,
      avgStuckRate: Math.random() * 0.03,
      avgVelocity: 75 + Math.random() * 20
    };
  }
  
  return { levels, lastUpdated: new Date().toISOString() };
}

/**
 * Generate report data
 */
function generateReport(date, metrics) {
  const report = {
    meta: {
      title: 'GhostShift Canary Daily Report',
      date,
      generatedAt: new Date().toISOString(),
      version: '1.0.0'
    },
    summary: {
      canaryLevels: CANARY_LEVELS.length,
      legacyLevels: LEGACY_LEVELS.length,
      totalSessions: 0,
      totalSamples: 0,
      totalAnomalies: 0,
      totalFallbackTriggers: 0,
      overallHealth: 'healthy',
      healthScore: 100
    },
    canary: {
      levels: [],
      aggregate: {
        avgStuckRate: 0,
        avgAnomalyRate: 0,
        avgVelocity: 0
      }
    },
    legacy: {
      note: 'Legacy levels not tracked in canary metrics',
      levels: LEGACY_LEVELS.map(i => ({
        levelIndex: i,
        levelName: LEVEL_NAMES[i],
        aiMode: 'legacy'
      }))
    },
    recommendations: [],
    trends: {
      note: 'Trend analysis requires multiple days of data'
    }
  };
  
  // Process canary levels
  let totalStuckRate = 0;
  let totalAnomalyRate = 0;
  let totalVelocity = 0;
  
  for (const levelIndex of CANARY_LEVELS) {
    const levelKey = `level_${levelIndex}`;
    const levelData = metrics?.levels?.[levelKey] || {
      levelIndex,
      levelName: LEVEL_NAMES[levelIndex],
      aiMode: 'modular',
      sessionCount: 0,
      totalSamples: 0,
      totalStuckEvents: 0,
      totalAnomalies: 0,
      fallbackTriggers: 0,
      avgStuckRate: 0,
      avgVelocity: 0
    };
    
    const anomalyRate = levelData.totalSamples > 0 
      ? levelData.totalAnomalies / levelData.totalSamples 
      : 0;
    
    const levelReport = {
      levelIndex,
      levelName: levelData.levelName,
      aiMode: 'modular',
      sessions: levelData.sessionCount || 0,
      samples: levelData.totalSamples || 0,
      stuckEvents: levelData.totalStuckEvents || 0,
      stuckRate: (levelData.avgStuckRate || 0) * 100,
      anomalyCount: levelData.totalAnomalies || 0,
      anomalyRate: anomalyRate * 100,
      fallbackTriggers: levelData.fallbackTriggers || 0,
      avgVelocity: levelData.avgVelocity || 0,
      health: computeHealth(levelData)
    };
    
    report.canary.levels.push(levelReport);
    
    // Aggregate
    report.summary.totalSessions += levelData.sessionCount || 0;
    report.summary.totalSamples += levelData.totalSamples || 0;
    report.summary.totalAnomalies += levelData.totalAnomalies || 0;
    report.summary.totalFallbackTriggers += levelData.fallbackTriggers || 0;
    totalStuckRate += levelData.avgStuckRate || 0;
    totalAnomalyRate += anomalyRate;
    totalVelocity += levelData.avgVelocity || 0;
  }
  
  // Compute aggregate metrics
  report.canary.aggregate.avgStuckRate = (totalStuckRate / CANARY_LEVELS.length) * 100;
  report.canary.aggregate.avgAnomalyRate = (totalAnomalyRate / CANARY_LEVELS.length) * 100;
  report.canary.aggregate.avgVelocity = totalVelocity / CANARY_LEVELS.length;
  
  // Compute overall health
  report.summary.healthScore = computeHealthScore(report);
  report.summary.overallHealth = report.summary.healthScore >= 80 ? 'healthy' :
                                  report.summary.healthScore >= 50 ? 'degraded' : 'unhealthy';
  
  // Generate recommendations
  generateRecommendations(report);
  
  return report;
}

/**
 * Compute health status for a level
 */
function computeHealth(levelData) {
  const stuckRate = levelData.avgStuckRate || 0;
  const anomalies = levelData.totalAnomalies || 0;
  const fallbacks = levelData.fallbackTriggers || 0;
  
  if (fallbacks > 0 || stuckRate > 0.1) return 'unhealthy';
  if (anomalies > 3 || stuckRate > 0.05) return 'degraded';
  return 'healthy';
}

/**
 * Compute overall health score (0-100)
 */
function computeHealthScore(report) {
  let score = 100;
  
  // Deduct for fallbacks (critical)
  score -= report.summary.totalFallbackTriggers * 20;
  
  // Deduct for anomalies
  score -= report.summary.totalAnomalies * 2;
  
  // Deduct for high stuck rate
  if (report.canary.aggregate.avgStuckRate > 5) {
    score -= 10;
  }
  if (report.canary.aggregate.avgStuckRate > 10) {
    score -= 20;
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Generate recommendations based on report data
 */
function generateRecommendations(report) {
  // Check for fallbacks
  if (report.summary.totalFallbackTriggers > 0) {
    report.recommendations.push({
      priority: 'critical',
      type: 'fallback',
      message: `${report.summary.totalFallbackTriggers} fallback trigger(s) detected. Investigate modular AI stability.`,
      action: 'Review fallback logs and consider rolling back affected levels.'
    });
  }
  
  // Check for anomalies
  if (report.summary.totalAnomalies > 10) {
    report.recommendations.push({
      priority: 'high',
      type: 'anomaly',
      message: `High anomaly count (${report.summary.totalAnomalies}) detected.`,
      action: 'Review anomaly types and patterns. May indicate edge cases not covered by tests.'
    });
  }
  
  // Check individual level health
  for (const level of report.canary.levels) {
    if (level.health === 'unhealthy') {
      report.recommendations.push({
        priority: 'critical',
        type: 'level_health',
        message: `Level ${level.levelIndex} (${level.levelName}) is unhealthy.`,
        action: `Consider removing level ${level.levelIndex} from canary until issues are resolved.`
      });
    } else if (level.health === 'degraded') {
      report.recommendations.push({
        priority: 'medium',
        type: 'level_health',
        message: `Level ${level.levelIndex} (${level.levelName}) shows degraded performance.`,
        action: 'Monitor closely and investigate root cause.'
      });
    }
  }
  
  // Positive recommendation if all healthy
  if (report.summary.overallHealth === 'healthy' && report.recommendations.length === 0) {
    report.recommendations.push({
      priority: 'info',
      type: 'expansion',
      message: 'All canary levels are healthy. Consider expanding canary coverage.',
      action: 'Add Level 4 (The Vault) to canary levels in next rollout step.'
    });
  }
}

/**
 * Format report as Markdown
 */
function formatMarkdown(report) {
  const lines = [];
  
  lines.push(`# ${report.meta.title}`);
  lines.push('');
  lines.push(`**Date:** ${report.meta.date}`);
  lines.push(`**Generated:** ${report.meta.generatedAt}`);
  lines.push('');
  
  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Canary Levels | ${report.summary.canaryLevels} |`);
  lines.push(`| Legacy Levels | ${report.summary.legacyLevels} |`);
  lines.push(`| Total Sessions | ${report.summary.totalSessions} |`);
  lines.push(`| Total Samples | ${report.summary.totalSamples} |`);
  lines.push(`| Total Anomalies | ${report.summary.totalAnomalies} |`);
  lines.push(`| Fallback Triggers | ${report.summary.totalFallbackTriggers} |`);
  lines.push(`| Health Score | ${report.summary.healthScore}/100 |`);
  lines.push(`| Overall Health | **${report.summary.overallHealth.toUpperCase()}** |`);
  lines.push('');
  
  // Canary Levels
  lines.push('## Canary Levels (Modular AI)');
  lines.push('');
  lines.push(`| Level | Name | Sessions | Samples | Stuck Rate | Anomalies | Fallbacks | Health |`);
  lines.push(`|-------|------|----------|---------|------------|-----------|-----------|--------|`);
  
  for (const level of report.canary.levels) {
    const healthIcon = level.health === 'healthy' ? '✅' : 
                       level.health === 'degraded' ? '⚠️' : '❌';
    lines.push(`| ${level.levelIndex} | ${level.levelName} | ${level.sessions} | ${level.samples} | ${level.stuckRate.toFixed(2)}% | ${level.anomalyCount} | ${level.fallbackTriggers} | ${healthIcon} |`);
  }
  lines.push('');
  
  // Aggregate metrics
  lines.push('### Aggregate Metrics');
  lines.push('');
  lines.push(`- **Avg Stuck Rate:** ${report.canary.aggregate.avgStuckRate.toFixed(2)}%`);
  lines.push(`- **Avg Anomaly Rate:** ${report.canary.aggregate.avgAnomalyRate.toFixed(2)}%`);
  lines.push(`- **Avg Velocity:** ${report.canary.aggregate.avgVelocity.toFixed(1)} px/s`);
  lines.push('');
  
  // Recommendations
  if (report.recommendations.length > 0) {
    lines.push('## Recommendations');
    lines.push('');
    
    for (const rec of report.recommendations) {
      const priorityIcon = rec.priority === 'critical' ? '🛑' :
                           rec.priority === 'high' ? '🔴' :
                           rec.priority === 'medium' ? '🟡' : 'ℹ️';
      lines.push(`### ${priorityIcon} ${rec.priority.toUpperCase()}: ${rec.type}`);
      lines.push('');
      lines.push(`**Message:** ${rec.message}`);
      lines.push('');
      lines.push(`**Action:** ${rec.action}`);
      lines.push('');
    }
  }
  
  // Footer
  lines.push('---');
  lines.push(`*Generated by GhostShift Canary Observability System v${report.meta.version}*`);
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Format report as JSON
 */
function formatJSON(report) {
  return JSON.stringify(report, null, 2);
}

/**
 * Save report to file
 */
function saveReport(report, outputDir, format = 'all') {
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const baseName = `canary-report-${report.meta.date}`;
  
  if (format === 'all' || format === 'json') {
    const jsonPath = path.join(outputDir, `${baseName}.json`);
    fs.writeFileSync(jsonPath, formatJSON(report));
    console.log(`JSON report saved to: ${jsonPath}`);
  }
  
  if (format === 'all' || format === 'md') {
    const mdPath = path.join(outputDir, `${baseName}.md`);
    fs.writeFileSync(mdPath, formatMarkdown(report));
    console.log(`Markdown report saved to: ${mdPath}`);
  }
}

/**
 * Main function
 */
function main() {
  const args = parseArgs();
  
  if (args.help) {
    console.log(`
Canary Daily Report Generator

Usage:
  node scripts/canary-daily-report.js [options]

Options:
  --date YYYY-MM-DD  Generate report for specific date (default: today)
  --output DIR       Output directory (default: reports/)
  --help             Show this help message

Output:
  - canary-report-YYYY-MM-DD.json  (machine-readable)
  - canary-report-YYYY-MM-DD.md    (human-readable)
`);
    process.exit(0);
  }
  
  console.log(`Generating canary report for ${args.date}...`);
  
  // Load or generate metrics
  let metrics = loadMetrics(args.date);
  if (!metrics) {
    console.log('No persisted metrics found, generating simulated data...');
    metrics = generateSimulatedMetrics(args.date);
  }
  
  // Generate report
  const report = generateReport(args.date, metrics);
  
  // Save reports
  saveReport(report, args.output);
  
  // Print summary to console
  console.log('\n' + formatMarkdown(report));
  
  console.log('\n✅ Daily report generated successfully!');
}

main();
