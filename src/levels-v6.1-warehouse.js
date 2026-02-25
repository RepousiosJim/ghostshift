// Level 1: Warehouse V6.1 - 28x23 map (FIXED CONNECTIVITY 2026-02-25)
// VERTICAL+HORIZONTAL FLOW: Multi-level dungeon with proper connectivity
//
// ARCHITECTURE (3-tier vertical structure with continuous corridors):
// - UPPER TIER (y=1-6): Navigation rooms + Exit chamber
// - MIDDLE TIER (y=8-13): Main objectives (Keycard, Terminal, Datacore)
// - LOWER TIER (y=15-21): Spawn + Safe staging
// - CONTINUOUS VERTICAL CORRIDORS between all tiers (x=3, 9, 15, 21)
// - CONTINUOUS HORIZONTAL CORRIDORS (y=7, y=14)
//
// STRICT DUNGEON-ROOM RULES:
// - Each room: 5x5 or larger (3x3+ walkable interior)
// - Rooms fully surrounded by walls with deliberate door gaps
// - Doors are 2-tile wide gaps for readability
// - Corridors are clear (no dividers blocking flow)
// - Objectives in room interiors only
//
// VERTICAL PROGRESSION:
// Spawn (lower-left y=18) -> Keycard (mid-left y=11) -> Terminal (mid-center y=11)
//   -> Datacore (mid-right y=11) -> Exit (upper-right y=3)
// Players navigate vertically through continuous corridors
{
  name: 'Warehouse',
  width: 28,
  height: 23,
  obstacles: mergeObstacles(
    // ==================== MAP BORDER ====================
    Array.from({length: 28}, (_, i) => ({x: i, y: 0})),
    Array.from({length: 28}, (_, i) => ({x: i, y: 22})),
    Array.from({length: 23}, (_, i) => ({x: 0, y: i})),
    Array.from({length: 23}, (_, i) => ({x: 27, y: i})),

    // ==================== UPPER TIER ROOMS (y=1-6) ====================
    // 5 rooms with doors connecting to upper corridor (y=7)
    
    // UPPER ROOM 1 (5x5) - x=1-5, y=1-5
    createRoomWalls(1, 1, 5, 5, {bottomDoor: {offset: 1, width: 2}}),

    // UPPER ROOM 2 (5x5) - x=7-11, y=1-5
    createRoomWalls(7, 1, 5, 5, {bottomDoor: {offset: 1, width: 2}}),

    // UPPER ROOM 3 (5x5) - x=13-17, y=1-5
    createRoomWalls(13, 1, 5, 5, {bottomDoor: {offset: 1, width: 2}}),

    // UPPER ROOM 4: EXIT CHAMBER (5x5) - x=19-23, y=1-5
    createRoomWalls(19, 1, 5, 5, {bottomDoor: {offset: 1, width: 2}}),

    // UPPER ROOM 5 (3x5) - x=25-27, y=1-5
    createRoomWalls(25, 1, 3, 5, {bottomDoor: {offset: 0, width: 2}}),

    // ==================== UPPER CORRIDOR DIVIDER (y=6) ====================
    // Horizontal wall with 2-tile gaps at doors
    // Leave gaps at x=2-3, 8-9, 14-15, 20-21, 25-26
    [{x: 1, y: 6}, {x: 4, y: 6}, {x: 5, y: 6},
     {x: 7, y: 6}, {x: 10, y: 6}, {x: 11, y: 6},
     {x: 13, y: 6}, {x: 16, y: 6}, {x: 17, y: 6},
     {x: 19, y: 6}, {x: 22, y: 6}, {x: 23, y: 6},
     {x: 25, y: 6}, {x: 27, y: 6}],

    // ==================== MIDDLE TIER ROOMS (y=8-13) ====================
    // 5 rooms with doors to both corridors
    
    // MIDDLE ROOM 1: KEYCARD (5x5) - x=1-5, y=8-12
    createRoomWalls(1, 8, 5, 5, {
      topDoor: {offset: 1, width: 2},
      bottomDoor: {offset: 1, width: 2}
    }),

    // MIDDLE ROOM 2: TERMINAL (5x5) - x=7-11, y=8-12
    createRoomWalls(7, 8, 5, 5, {
      topDoor: {offset: 1, width: 2},
      bottomDoor: {offset: 1, width: 2}
    }),

    // MIDDLE ROOM 3: DATACORE (5x5) - x=13-17, y=8-12
    createRoomWalls(13, 8, 5, 5, {
      topDoor: {offset: 1, width: 2},
      bottomDoor: {offset: 1, width: 2}
    }),

    // MIDDLE ROOM 4 (5x5) - x=19-23, y=8-12
    createRoomWalls(19, 8, 5, 5, {
      topDoor: {offset: 1, width: 2},
      bottomDoor: {offset: 1, width: 2}
    }),

    // MIDDLE ROOM 5 (3x5) - x=25-27, y=8-12
    createRoomWalls(25, 8, 3, 5, {
      topDoor: {offset: 0, width: 2},
      bottomDoor: {offset: 0, width: 2}
    }),

    // ==================== MIDDLE-LOWER DIVIDER (y=13) ====================
    // Horizontal wall with 2-tile gaps at doors
    // Leave gaps at x=2-3, 8-9, 14-15, 20-21, 25-26
    [{x: 1, y: 13}, {x: 4, y: 13}, {x: 5, y: 13},
     {x: 7, y: 13}, {x: 10, y: 13}, {x: 11, y: 13},
     {x: 13, y: 13}, {x: 16, y: 13}, {x: 17, y: 13},
     {x: 19, y: 13}, {x: 22, y: 13}, {x: 23, y: 13},
     {x: 25, y: 13}, {x: 27, y: 13}],

    // ==================== LOWER TIER ROOMS (y=15-21) ====================
    // 5 rooms with doors to lower corridor (y=14)
    
    // LOWER ROOM 1: SPAWN (5x5) - x=1-5, y=15-19
    createRoomWalls(1, 15, 5, 5, {topDoor: {offset: 1, width: 2}}),

    // LOWER ROOM 2 (5x5) - x=7-11, y=15-19
    createRoomWalls(7, 15, 5, 5, {topDoor: {offset: 1, width: 2}}),

    // LOWER ROOM 3 (5x5) - x=13-17, y=15-19
    createRoomWalls(13, 15, 5, 5, {topDoor: {offset: 1, width: 2}}),

    // LOWER ROOM 4 (5x5) - x=19-23, y=15-19
    createRoomWalls(19, 15, 5, 5, {topDoor: {offset: 1, width: 2}}),

    // LOWER ROOM 5 (3x5) - x=25-27, y=15-19
    createRoomWalls(25, 15, 3, 5, {topDoor: {offset: 0, width: 2}}),

    // ==================== BOTTOM ROW ROOMS (y=20-21) ====================
    // Additional staging rooms at bottom
    createRoomWalls(1, 20, 5, 2, {}),
    createRoomWalls(7, 20, 5, 2, {}),
    createRoomWalls(13, 20, 5, 2, {}),
    createRoomWalls(19, 20, 5, 2, {}),
    createRoomWalls(25, 20, 3, 2, {}),

    // ==================== VERTICAL ROOM DIVIDERS ====================
    // These create room boundaries but DON'T block corridors
    // Upper tier (y=1-5)
    [{x: 6, y: 1}, {x: 6, y: 2}, {x: 6, y: 3}, {x: 6, y: 4}, {x: 6, y: 5}],
    [{x: 12, y: 1}, {x: 12, y: 2}, {x: 12, y: 3}, {x: 12, y: 4}, {x: 12, y: 5}],
    [{x: 18, y: 1}, {x: 18, y: 2}, {x: 18, y: 3}, {x: 18, y: 4}, {x: 18, y: 5}],
    [{x: 24, y: 1}, {x: 24, y: 2}, {x: 24, y: 3}, {x: 24, y: 4}, {x: 24, y: 5}],

    // Middle tier (y=8-12)
    [{x: 6, y: 8}, {x: 6, y: 9}, {x: 6, y: 10}, {x: 6, y: 11}, {x: 6, y: 12}],
    [{x: 12, y: 8}, {x: 12, y: 9}, {x: 12, y: 10}, {x: 12, y: 11}, {x: 12, y: 12}],
    [{x: 18, y: 8}, {x: 18, y: 9}, {x: 18, y: 10}, {x: 18, y: 11}, {x: 18, y: 12}],
    [{x: 24, y: 8}, {x: 24, y: 9}, {x: 24, y: 10}, {x: 24, y: 11}, {x: 24, y: 12}],

    // Lower tier (y=15-19)
    [{x: 6, y: 15}, {x: 6, y: 16}, {x: 6, y: 17}, {x: 6, y: 18}, {x: 6, y: 19}],
    [{x: 12, y: 15}, {x: 12, y: 16}, {x: 12, y: 17}, {x: 12, y: 18}, {x: 12, y: 19}],
    [{x: 18, y: 15}, {x: 18, y: 16}, {x: 18, y: 17}, {x: 18, y: 18}, {x: 18, y: 19}],
    [{x: 24, y: 15}, {x: 24, y: 16}, {x: 24, y: 17}, {x: 24, y: 18}, {x: 24, y: 19}]
  ),

  // ==================== OBJECTIVES (distributed vertically) ====================
  playerStart: {x: 3, y: 17},       // Spawn room center (lower-left)
  keyCard: {x: 3, y: 10},           // Keycard room center (middle-left)
  hackTerminal: {x: 9, y: 10},      // Terminal room center (middle-center)
  dataCore: {x: 15, y: 10},         // Data core room center (middle-right)
  exitZone: {x: 21, y: 3},          // Exit room center (upper-right)

  // ==================== GUARD PATROL (middle corridor) ====================
  guardPatrol: [
    {x: 3, y: 14},      // Near keycard room (in lower corridor)
    {x: 9, y: 14},      // Near terminal room
    {x: 15, y: 14},     // Near datacore room
    {x: 21, y: 14}      // Near safe room
  ],

  // ==================== SENSORS (watch corridors) ====================
  cameras: [{x: 9, y: 14}],
  motionSensors: [],
  laserGrids: [],

  difficulty: 1
}
