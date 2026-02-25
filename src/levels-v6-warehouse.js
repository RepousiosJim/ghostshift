// Level 1: Warehouse V6 - 28x23 map (FULL DUNGEON STRUCTURE 2026-02-25)
// VERTICAL+HORIZONTAL FLOW: Multi-level dungeon with full map utilization
//
// ARCHITECTURE (3-tier vertical structure):
// - UPPER TIER (y=1-7): Navigation rooms + Exit chamber
// - MIDDLE TIER (y=9-14): Main objectives (Keycard, Terminal, Datacore)
// - LOWER TIER (y=16-21): Spawn + Safe staging
// - Vertical connectors between all tiers
// - 2-tile wide corridors for clear traversal
//
// STRICT DUNGEON-ROOM RULES:
// - Each room: 5x5 or larger (3x3+ walkable interior)
// - Rooms fully surrounded by walls
// - Doors are 2-tile wide gaps (deliberate door semantics)
// - 2-tile wide corridors for clear traversal
// - Objectives in room interiors only
// - No non-functional hazards (lasers disabled)
//
// VERTICAL PROGRESSION:
// Spawn (lower-left) -> Keycard (mid-left) -> Terminal (mid-center)
//   -> Datacore (mid-right) -> Exit (upper-right)
// Players navigate vertically through the full map
//
// LAYOUT (28 columns x 23 rows):
// ┌────────────────────────────────────────────────────────────────┐ y=0
// │████████████████████████████████████████████████████████████████│ BORDER
// │█┌────┐  ┌────┐  ┌────┐  ┌──EXIT─┐                          │
// │█│Nav │  │Nav │  │Nav │  │[X]    │  UPPER TIER              │ y=2-4
// │█│    │  │    │  │    │  │       │  (navigation rooms)      │
// │█└──┬─┘  └──┬─┘  └──┬─┘  └───┬───┘                          │
// │████████████████████████████████████████████████████████████████│ y=6
// │    └────┴────┴────┘        │  UPPER CORRIDOR (2-tile)       │ y=7-8
// │████████████████████████████████████████████████████████████████│ y=9
// │█┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐                      │
// │█│[K] │  │[T] │  │[D] │  │Safe │  │Safe │  MIDDLE TIER       │ y=11
// │█│Key │  │Term│  │Core│  │     │  │     │  (objectives)      │
// │█└──┬─┘  └──┬─┘  └──┬─┘  └──┬──┘  └──┬──┘                      │
// │████▀██████▀██████▀██████▀██████▀████                          │ y=13
// │    └────┴────┴────┴────┴────┘    MIDDLE CORRIDOR (2-tile)   │ y=14-15
// │████▄██████▄██████▄██████▄██████▄████                          │
// │█┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐                      │
// │█│[S] │  │Safe │  │Safe │  │Safe │  │Safe │  LOWER TIER       │ y=19
// │█│Spawn  │    │  │    │  │    │  │    │  (staging)          │
// │█└────┘  └────┘  └────┘  └────┘  └────┘                      │
// │████████████████████████████████████████████████████████████████│ y=22
// └────────────────────────────────────────────────────────────────┘
{
  name: 'Warehouse',
  width: 28,   // Horizontal expansion preserved
  height: 23,  // Vertical expansion preserved
  obstacles: mergeObstacles(
    // ==================== MAP BORDER ====================
    Array.from({length: 28}, (_, i) => ({x: i, y: 0})),
    Array.from({length: 28}, (_, i) => ({x: i, y: 22})),
    Array.from({length: 23}, (_, i) => ({x: 0, y: i})),
    Array.from({length: 23}, (_, i) => ({x: 27, y: i})),

    // ==================== UPPER TIER ROOMS (y=1-6) ====================
    // Navigation rooms with vertical connectors to middle tier
    
    // UPPER ROOM 1: Northwest navigation (5x5)
    // Location: x=1-5, y=1-5
    // Door: bottom wall (connects to upper corridor)
    createRoomWalls(1, 1, 5, 5, {bottomDoor: {offset: 1, width: 2}}),

    // UPPER ROOM 2: North navigation (5x5)
    // Location: x=7-11, y=1-5
    // Door: bottom wall (connects to upper corridor)
    createRoomWalls(7, 1, 5, 5, {bottomDoor: {offset: 1, width: 2}}),

    // UPPER ROOM 3: Northeast navigation (5x5)
    // Location: x=13-17, y=1-5
    // Door: bottom wall (connects to upper corridor)
    createRoomWalls(13, 1, 5, 5, {bottomDoor: {offset: 1, width: 2}}),

    // UPPER ROOM 4: EXIT CHAMBER (5x5)
    // Location: x=19-23, y=1-5
    // Door: bottom wall (connects to upper corridor)
    // Exit zone placed here for vertical progression
    createRoomWalls(19, 1, 5, 5, {bottomDoor: {offset: 1, width: 2}}),

    // UPPER ROOM 5: Far northeast corner (3x5)
    // Location: x=25-27, y=1-5
    // Door: bottom wall
    createRoomWalls(25, 1, 3, 5, {bottomDoor: {offset: 0, width: 2}}),

    // ==================== UPPER CORRIDOR DIVIDER (y=6) ====================
    // Horizontal wall with 2-tile gaps at each room door
    [{x: 1, y: 6}, {x: 4, y: 6}, {x: 5, y: 6},
     {x: 7, y: 6}, {x: 10, y: 6}, {x: 11, y: 6},
     {x: 13, y: 6}, {x: 16, y: 6}, {x: 17, y: 6},
     {x: 19, y: 6}, {x: 22, y: 6}, {x: 23, y: 6},
     {x: 25, y: 6}, {x: 27, y: 6}],

    // ==================== MIDDLE TIER ROOMS (y=9-13) ====================
    // Main objective rooms with vertical connectors
    
    // MIDDLE ROOM 1: KEYCARD ROOM (5x5)
    // Location: x=1-5, y=9-13
    // Doors: top and bottom for vertical flow
    createRoomWalls(1, 9, 5, 5, {
      topDoor: {offset: 1, width: 2},
      bottomDoor: {offset: 1, width: 2}
    }),

    // MIDDLE ROOM 2: TERMINAL ROOM (5x5)
    // Location: x=7-11, y=9-13
    // Doors: top and bottom for vertical flow
    createRoomWalls(7, 9, 5, 5, {
      topDoor: {offset: 1, width: 2},
      bottomDoor: {offset: 1, width: 2}
    }),

    // MIDDLE ROOM 3: DATACORE ROOM (5x5)
    // Location: x=13-17, y=9-13
    // Doors: top and bottom for vertical flow
    createRoomWalls(13, 9, 5, 5, {
      topDoor: {offset: 1, width: 2},
      bottomDoor: {offset: 1, width: 2}
    }),

    // MIDDLE ROOM 4: Safe room (5x5)
    // Location: x=19-23, y=9-13
    createRoomWalls(19, 9, 5, 5, {
      topDoor: {offset: 1, width: 2},
      bottomDoor: {offset: 1, width: 2}
    }),

    // MIDDLE ROOM 5: Safe room (3x5)
    // Location: x=25-27, y=9-13
    createRoomWalls(25, 9, 3, 5, {
      topDoor: {offset: 0, width: 2},
      bottomDoor: {offset: 0, width: 2}
    }),

    // ==================== MIDDLE-UPPER CONNECTOR WALLS (y=7-8) ====================
    // Vertical dividers in upper corridor
    [{x: 6, y: 7}, {x: 6, y: 8}],
    [{x: 12, y: 7}, {x: 12, y: 8}],
    [{x: 18, y: 7}, {x: 18, y: 8}],
    [{x: 24, y: 7}, {x: 24, y: 8}],

    // ==================== MIDDLE-LOWER DIVIDER (y=14) ====================
    // Horizontal wall with 2-tile gaps at each room door
    [{x: 1, y: 14}, {x: 4, y: 14}, {x: 5, y: 14},
     {x: 7, y: 14}, {x: 10, y: 14}, {x: 11, y: 14},
     {x: 13, y: 14}, {x: 16, y: 14}, {x: 17, y: 14},
     {x: 19, y: 14}, {x: 22, y: 14}, {x: 23, y: 14},
     {x: 25, y: 14}, {x: 27, y: 14}],

    // ==================== LOWER TIER ROOMS (y=16-21) ====================
    // Spawn and safe staging rooms
    
    // LOWER ROOM 1: SPAWN ROOM (5x5)
    // Location: x=1-5, y=16-21
    // Door: top wall (connects to lower corridor)
    createRoomWalls(1, 16, 5, 5, {topDoor: {offset: 1, width: 2}}),

    // LOWER ROOM 2: Safe staging (5x5)
    // Location: x=7-11, y=16-21
    createRoomWalls(7, 16, 5, 5, {topDoor: {offset: 1, width: 2}}),

    // LOWER ROOM 3: Safe staging (5x5)
    // Location: x=13-17, y=16-21
    createRoomWalls(13, 16, 5, 5, {topDoor: {offset: 1, width: 2}}),

    // LOWER ROOM 4: Safe staging (5x5)
    // Location: x=19-23, y=16-21
    createRoomWalls(19, 16, 5, 5, {topDoor: {offset: 1, width: 2}}),

    // LOWER ROOM 5: Safe staging (3x5)
    // Location: x=25-27, y=16-21
    createRoomWalls(25, 16, 3, 5, {topDoor: {offset: 0, width: 2}}),

    // ==================== LOWER CORRIDOR DIVIDERS (y=15) ====================
    // Vertical dividers in lower corridor
    [{x: 6, y: 15}, {x: 12, y: 15}, {x: 18, y: 15}, {x: 24, y: 15}],

    // ==================== VERTICAL DIVIDERS (between columns) ====================
    // Upper tier (y=1-5)
    [{x: 6, y: 1}, {x: 6, y: 2}, {x: 6, y: 3}, {x: 6, y: 4}, {x: 6, y: 5}],
    [{x: 12, y: 1}, {x: 12, y: 2}, {x: 12, y: 3}, {x: 12, y: 4}, {x: 12, y: 5}],
    [{x: 18, y: 1}, {x: 18, y: 2}, {x: 18, y: 3}, {x: 18, y: 4}, {x: 18, y: 5}],
    [{x: 24, y: 1}, {x: 24, y: 2}, {x: 24, y: 3}, {x: 24, y: 4}, {x: 24, y: 5}],

    // Middle tier (y=9-13)
    [{x: 6, y: 9}, {x: 6, y: 10}, {x: 6, y: 11}, {x: 6, y: 12}, {x: 6, y: 13}],
    [{x: 12, y: 9}, {x: 12, y: 10}, {x: 12, y: 11}, {x: 12, y: 12}, {x: 12, y: 13}],
    [{x: 18, y: 9}, {x: 18, y: 10}, {x: 18, y: 11}, {x: 18, y: 12}, {x: 18, y: 13}],
    [{x: 24, y: 9}, {x: 24, y: 10}, {x: 24, y: 11}, {x: 24, y: 12}, {x: 24, y: 13}],

    // Lower tier (y=16-21)
    [{x: 6, y: 16}, {x: 6, y: 17}, {x: 6, y: 18}, {x: 6, y: 19}, {x: 6, y: 20}, {x: 6, y: 21}],
    [{x: 12, y: 16}, {x: 12, y: 17}, {x: 12, y: 18}, {x: 12, y: 19}, {x: 12, y: 20}, {x: 12, y: 21}],
    [{x: 18, y: 16}, {x: 18, y: 17}, {x: 18, y: 18}, {x: 18, y: 19}, {x: 18, y: 20}, {x: 18, y: 21}],
    [{x: 24, y: 16}, {x: 24, y: 17}, {x: 24, y: 18}, {x: 24, y: 19}, {x: 24, y: 20}, {x: 24, y: 21}]
  ),

  // ==================== OBJECTIVES (distributed vertically) ====================
  // VERTICAL PROGRESSION: Spawn -> Keycard -> Terminal -> Datacore -> Exit
  playerStart: {x: 3, y: 18},       // Spawn room center (lower-left)
  keyCard: {x: 3, y: 11},           // Keycard room center (middle-left)
  hackTerminal: {x: 9, y: 11},      // Terminal room center (middle-center)
  dataCore: {x: 15, y: 11},         // Data core room center (middle-right)
  exitZone: {x: 21, y: 3},          // Exit room center (upper-right)

  // ==================== GUARD PATROL (middle corridor only) ====================
  // Patrol in middle corridor (y=14-15) - watch vertical connectors
  guardPatrol: [
    {x: 3, y: 15},      // Near keycard room
    {x: 9, y: 15},      // Near terminal room
    {x: 15, y: 15},     // Near datacore room
    {x: 21, y: 15}      // Near safe room
  ],

  // ==================== SENSORS (watch corridors) ====================
  // Camera positioned to watch middle corridor
  cameras: [{x: 9, y: 15}],
  motionSensors: [],
  
  // ==================== NO LASERS (disabled) ====================
  laserGrids: [],

  difficulty: 1
}
