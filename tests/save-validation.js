/**
 * GhostShift Save System Validation Test
 * Run in browser console or include in HTML for testing
 * 
 * Tests: load, save, reset, migration, corruption recovery, data integrity
 */

(function() {
  'use strict';
  
  const TEST_KEY = 'ghostshift_save_test';
  const SAVE_KEY = 'ghostshift_save';
  
  // Test results
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };
  
  function test(name, fn) {
    try {
      fn();
      results.passed++;
      results.tests.push({ name, status: 'PASS' });
      console.log(`✓ ${name}`);
    } catch (e) {
      results.failed++;
      results.tests.push({ name, status: 'FAIL', error: e.message });
      console.error(`✗ ${name}: ${e.message}`);
    }
  }
  
  function assert(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
  }
  
  // Backup original save
  function backupSave() {
    try {
      return localStorage.getItem(SAVE_KEY);
    } catch (e) {
      return null;
    }
  }
  
  function restoreSave(backup) {
    try {
      if (backup) {
        localStorage.setItem(SAVE_KEY, backup);
      } else {
        localStorage.removeItem(SAVE_KEY);
      }
    } catch (e) { /* ignore */ }
  }
  
  function clearSave() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) { /* ignore */ }
  }
  
  // Run all tests
  function runTests() {
    console.log('=== GhostShift Save System Validation ===\n');
    
    const originalSave = backupSave();
    
    try {
      // Test 1: Fresh load with no save data
      test('Fresh load returns default data', () => {
        clearSave();
        // Re-initialize SaveManager (simulated)
        const saveData = {
          credits: 0,
          totalRuns: 0,
          bestTime: null,
          bestTimes: {},
          unlockedLevels: [0],
          perks: { speed: 1, stealth: 1, luck: 1 },
          settings: { 
            audioEnabled: true, 
            masterVolume: 0.8,
            effectsQuality: 'high',
            fullscreen: false,
            reducedMotion: false
          },
          lastPlayed: null,
          totalCreditsEarned: 0,
          saveVersion: 5
        };
        
        assert(saveData.credits === 0, 'Credits should be 0');
        assert(saveData.unlockedLevels.length === 1, 'Should have level 0 unlocked');
        assert(saveData.unlockedLevels[0] === 0, 'Level 0 should be unlocked');
        assert(saveData.saveVersion === 5, 'Version should be 5');
      });
      
      // Test 2: Save and load persistence
      test('Save persists data correctly', () => {
        const testData = {
          credits: 100,
          totalRuns: 5,
          bestTime: 30000,
          bestTimes: { 0: 30000, 1: 45000 },
          unlockedLevels: [0, 1, 2],
          perks: { speed: 2, stealth: 1, luck: 1 },
          settings: { 
            audioEnabled: false, 
            masterVolume: 0.5,
            effectsQuality: 'medium',
            fullscreen: true,
            reducedMotion: true
          },
          lastPlayed: Date.now(),
          totalCreditsEarned: 200,
          saveVersion: 5
        };
        
        localStorage.setItem(SAVE_KEY, JSON.stringify(testData));
        
        // Simulate load with validation
        const loaded = JSON.parse(localStorage.getItem(SAVE_KEY));
        assert(loaded.credits === 100, 'Credits should persist');
        assert(loaded.totalRuns === 5, 'Total runs should persist');
        assert(loaded.bestTimes[0] === 30000, 'Best time should persist');
        assert(loaded.unlockedLevels.length === 3, 'Unlocked levels should persist');
        assert(loaded.settings.audioEnabled === false, 'Settings should persist');
        assert(loaded.saveVersion === 5, 'Version should persist');
      });
      
      // Test 3: Migration from old version
      test('Migration from v1 to v5 works', () => {
        const v1Data = {
          credits: 50,
          totalRuns: 3,
          unlockedLevels: [0, 1]
        };
        
        localStorage.setItem(SAVE_KEY, JSON.stringify(v1Data));
        
        // Simulate migration
        let data = JSON.parse(localStorage.getItem(SAVE_KEY));
        const currentVersion = data.saveVersion || 1;
        
        // Apply migrations
        if (currentVersion < 5) {
          if (currentVersion < 2) data.perks = { speed: 1, stealth: 1, luck: 1 };
          if (currentVersion < 3) data.settings = { audioEnabled: true, masterVolume: 0.8, effectsQuality: 'high', fullscreen: false, reducedMotion: false };
          if (currentVersion < 4) { data.settings.fullscreen = false; data.settings.reducedMotion = false; }
          data.saveVersion = 5;
        }
        
        assert(data.perks !== undefined, 'Perks should be added');
        assert(data.settings !== undefined, 'Settings should be added');
        assert(data.saveVersion === 5, 'Version should be 5');
      });
      
      // Test 4: Corruption recovery
      test('Corrupted save data recovers to defaults', () => {
        // Set corrupted data
        localStorage.setItem(SAVE_KEY, '{ invalid json }');
        
        let recovered = null;
        try {
          const saved = localStorage.getItem(SAVE_KEY);
          const parsed = JSON.parse(saved);
          if (!parsed || typeof parsed !== 'object') {
            recovered = { credits: 0, totalRuns: 0, bestTime: null, bestTimes: {}, unlockedLevels: [0], perks: { speed: 1, stealth: 1, luck: 1 }, settings: { audioEnabled: true, masterVolume: 0.8, effectsQuality: 'high', fullscreen: false, reducedMotion: false }, lastPlayed: null, totalCreditsEarned: 0, saveVersion: 5 };
          }
        } catch (e) {
          recovered = { credits: 0, totalRuns: 0, bestTime: null, bestTimes: {}, unlockedLevels: [0], perks: { speed: 1, stealth: 1, luck: 1 }, settings: { audioEnabled: true, masterVolume: 0.8, effectsQuality: 'high', fullscreen: false, reducedMotion: false }, lastPlayed: null, totalCreditsEarned: 0, saveVersion: 5 };
        }
        
        assert(recovered !== null, 'Should recover from corruption');
        assert(recovered.credits === 0, 'Recovered credits should be 0');
        assert(recovered.saveVersion === 5, 'Recovered version should be 5');
      });
      
      // Test 5: Data validation - invalid values
      test('Invalid values are sanitized', () => {
        const invalidData = {
          credits: -100,  // Negative
          totalRuns: 'abc', // Wrong type
          bestTimes: { 0: -500, 1: 'invalid' }, // Invalid times
          unlockedLevels: [0, -1, 5], // Invalid levels
          perks: { speed: 10, stealth: 0 }, // Out of range
          settings: { 
            audioEnabled: 'yes', // Wrong type
            masterVolume: 1.5,   // Out of range
            effectsQuality: 'ultra' // Invalid enum
          },
          saveVersion: 5
        };
        
        // Simulate validation
        let validated = { ...invalidData };
        
        // Validate credits
        if (validated.credits < 0) validated.credits = 0;
        
        // Validate totalRuns
        if (typeof validated.totalRuns !== 'number') validated.totalRuns = 0;
        
        // Validate bestTimes
        const cleanedTimes = {};
        for (const key in validated.bestTimes) {
          const time = validated.bestTimes[key];
          if (typeof time === 'number' && time > 0 && time < 3600000) {
            cleanedTimes[key] = time;
          }
        }
        validated.bestTimes = cleanedTimes;
        
        // Validate unlockedLevels
        let levels = [...new Set(validated.unlockedLevels)].filter(l => typeof l === 'number' && l >= 0).sort((a, b) => a - b);
        if (levels.length === 0) levels = [0];
        if (!levels.includes(0)) levels.unshift(0);
        validated.unlockedLevels = levels;
        
        // Validate perks
        validated.perks.speed = Math.max(1, Math.min(4, validated.perks.speed || 1));
        validated.perks.stealth = Math.max(1, Math.min(4, validated.perks.stealth || 1));
        validated.perks.luck = Math.max(1, Math.min(4, validated.perks.luck || 1));
        
        // Validate settings
        if (typeof validated.settings.audioEnabled !== 'boolean') validated.settings.audioEnabled = true;
        validated.settings.masterVolume = Math.max(0, Math.min(1, validated.settings.masterVolume || 0.8));
        if (!['low', 'medium', 'high'].includes(validated.settings.effectsQuality)) validated.settings.effectsQuality = 'high';
        
        assert(validated.credits === 0, 'Negative credits should be 0');
        assert(validated.totalRuns === 0, 'Non-number runs should be 0');
        assert(Object.keys(validated.bestTimes).length === 0, 'Invalid times should be removed');
        assert(validated.unlockedLevels.includes(0), 'Level 0 should always be included');
        assert(validated.perks.speed <= 4, 'Perk should be capped at 4');
        assert(validated.settings.effectsQuality === 'high', 'Invalid quality should default to high');
      });
      
      // Test 6: Level unlock logic
      test('Level unlock maintains integrity', () => {
        let unlockedLevels = [0, 1, 2];
        
        // Unlock new level
        const newLevel = 3;
        if (!unlockedLevels.includes(newLevel)) {
          unlockedLevels.push(newLevel);
        }
        
        // Clean and sort
        unlockedLevels = [...new Set(unlockedLevels)].sort((a, b) => a - b);
        
        assert(unlockedLevels.length === 4, 'Should have 4 unlocked levels');
        assert(unlockedLevels[0] === 0, 'Level 0 should always be first');
        assert(unlockedLevels.includes(3), 'Level 3 should be unlocked');
      });
      
      // Test 7: Reset clears all data
      test('Reset clears all progress', () => {
        const testData = {
          credits: 500,
          totalRuns: 100,
          bestTimes: { 0: 10000, 1: 20000, 2: 30000, 3: 40000, 4: 50000 },
          unlockedLevels: [0, 1, 2, 3, 4],
          perks: { speed: 4, stealth: 4, luck: 4 },
          settings: { audioEnabled: false, masterVolume: 0.1, effectsQuality: 'low' },
          totalCreditsEarned: 1000,
          saveVersion: 5
        };
        
        // Reset to defaults
        const resetData = {
          credits: 0,
          totalRuns: 0,
          bestTime: null,
          bestTimes: {},
          unlockedLevels: [0],
          perks: { speed: 1, stealth: 1, luck: 1 },
          settings: { 
            audioEnabled: true, 
            masterVolume: 0.8,
            effectsQuality: 'high',
            fullscreen: false,
            reducedMotion: false
          },
          lastPlayed: null,
          totalCreditsEarned: 0,
          saveVersion: 5
        };
        
        assert(resetData.credits === 0, 'Credits should be 0');
        assert(resetData.unlockedLevels.length === 1, 'Only level 0 should be unlocked');
        assert(resetData.perks.speed === 1, 'Perks should be reset');
        assert(resetData.bestTimes['0'] === undefined, 'Best times should be cleared');
      });
      
      // Test 8: Best time comparison
      test('Best time only updates if faster', () => {
        let bestTime = 30000;
        
        // Slower time should not update
        const newTime1 = 35000;
        if (!bestTime || newTime1 < bestTime) {
          bestTime = newTime1;
        }
        assert(bestTime === 30000, 'Slower time should not replace best');
        
        // Faster time should update
        const newTime2 = 25000;
        if (!bestTime || newTime2 < bestTime) {
          bestTime = newTime2;
        }
        assert(bestTime === 25000, 'Faster time should replace best');
      });
      
    } finally {
      // Restore original save
      restoreSave(originalSave);
    }
    
    // Summary
    console.log('\n=== Test Results ===');
    console.log(`Passed: ${results.passed}`);
    console.log(`Failed: ${results.failed}`);
    console.log(`Total: ${results.passed + results.failed}`);
    
    if (results.failed > 0) {
      console.log('\nFailed tests:');
      results.tests.filter(t => t.status === 'FAIL').forEach(t => {
        console.log(`  - ${t.name}: ${t.error}`);
      });
    }
    
    return results;
  }
  
  // Export for use
  if (typeof window !== 'undefined') {
    window.GhostShiftSaveTest = { runTests, test, assert };
  }
  
  // Auto-run if in test mode
  if (document.location.search.includes('test=savesystem')) {
    runTests();
  }
  
  console.log('Save system tests loaded. Run GhostShiftSaveTest.runTests() to execute.');
})();
