# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Warhammer 40K deployment planner web application built with Svelte 5 and Vite. It helps players practice deployment strategies by visualizing deployment zones, objectives, terrain, and line-of-sight (LOS) mechanics on a digital battlefield.

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Architecture

### Routing System

The app uses hash-based routing implemented in `src/App.svelte`:
- `#/` or no hash → MainPage (deployment and terrain visualization)
- `#/setup` → BattlefieldSetupPage (configure deployment zones and objectives)
- `#/debug` → DebugPage (line-of-sight debugging and testing)

### State Management

The application uses Svelte stores (writable/derived) for state management. All stores are located in `src/stores/`:

**`deployment.js`**: Manages deployment zones and objectives
- `deploymentZones` - Store for player deployment zones with path-based geometry
- `objectives` - Store for objective markers (40mm diameter, 3" + 20mm control radius)
- `DEPLOYMENT_PRESETS` - Hardcoded array of 6 official deployment configurations (Dawn of War, Hammer and Anvil, Tipping Point, Search and Destroy, Sweeping Engagement, Crucible of Battle)
- Deployment zones use path arrays with SVG-like commands (M, L, A, Z) converted to SVG paths via `pathToSvgD()`

**`layout.js`**: Manages terrain and wall pieces for battlefield layouts
- `layoutTerrains` - Rectangular terrain pieces with x, y, width, height, rotation
- `layoutWalls` - L-shaped and C-shaped wall pieces with predefined shapes
- `TERRAIN_LAYOUT_PRESETS` - Hardcoded array of 8 official terrain layouts
- Supports saving/loading custom layouts to localStorage
- Terrain sizes: 6"×12", 5"×10", 4"×6"
- Wall shapes: L-4x8, L-5x6, L-4x6, C-4-8-4 (with mirror variants)

**`elements.js`**: Used by DebugPage for units and terrain with LOS calculations
- `units` - Unit positions (currently uses 32mm base radius = 0.63")
- `terrains` - Terrain rectangles with rotation
- `allWalls` - Derived store that converts terrains to wall vertices for LOS
- `allTerrainPolygons` - Derived store that converts terrains to polygons

### Line of Sight System

Located in `src/lib/visibility/`:

**`lineOfSight.js`**: Core LOS logic
- `checkLineOfSight(modelA, modelB, terrainPolygons, walls)` - Full LOS check with ray data for debugging
- `canSee(modelA, modelB, terrainPolygons, walls)` - Optimized boolean LOS check
- Samples 16 points around each model's perimeter and tests all ray combinations
- Terrain blocking rules: terrain blocks LOS UNLESS the viewing model OR target model has any part overlapping that terrain footprint
- Walls always block LOS regardless of model position

**`geometry.js`**: Geometric primitives
- Circle-polygon intersection tests
- Line-polygon intersection (ray casting)
- Point-in-polygon tests
- Perimeter point sampling

**`index.js`**: Coordinate transformations and shape helpers
- `getLWallVerticesRotated()` - Generates L-wall geometry from terrain rectangles
- `getRotatedRectVertices()` - Converts rotated rectangles to polygon vertices

### Component Structure

**Main Pages**:
- `MainPage.svelte` - Main deployment visualization (deployment zones + terrain layout)
- `BattlefieldSetupPage.svelte` - Configure deployment zones and objectives
- `DebugPage.svelte` - LOS testing and debugging with units

**Reusable Components** (`src/lib/`):
- `Battlefield.svelte` - SVG battlefield canvas (60"×44" with 1" grid)
- `TerrainRect.svelte` - Rectangular terrain piece with drag/rotate/delete
- `TerrainFootprint.svelte` - Renders terrain footprint outlines
- `LWall.svelte` - L-shaped wall visualization
- `WallPiece.svelte` - Draggable/rotatable wall pieces
- `UnitBase.svelte` - Circular unit base with drag support

### Coordinate System

- Battlefield is 60" wide × 44" tall (standard Warhammer 40K Strike Force size)
- SVG viewBox coordinates map 1:1 to inches
- All positions (x, y) are in inches from top-left corner
- Rotations are in degrees (0° = no rotation)
- Unit conversions: MM_TO_INCH = 1/25.4

### Key Implementation Details

1. **Deployment Zones**: Defined as SVG path commands in `deployment.js`, converted to path strings for rendering. Each preset has 2 zones (Player 1 blue, Player 2 red) and 5 objectives (1 primary, 4 secondary).

2. **Terrain Layouts**: All 8 official layouts are hardcoded in `layout.js` with precise positions and rotations. Layouts can be loaded by selecting from presets.

3. **Rotation Handling**: Terrain and walls can be rotated. All geometry calculations account for rotation by transforming vertices before LOS checks.

4. **LOS Optimization**: Two functions exist - `checkLineOfSight()` returns full ray data for visualization, `canSee()` exits early for performance.

## Planned Features (from README)

The README contains a roadmap of features to implement:
- Model palette and drag-to-battlefield system (25mm to 120×90mm oval bases)
- Deep strike denial visualization (9" exclusion zones)
- Drag move ruler showing distance while moving models
- Raycast visibility from selected units
- Base size dataset (JSON mapping factions → units → models)
- Army import from GW app with staging area
- Unit coherency checking (2" rule for ≤6 models, 2 models within 2" for 7+)

## Important Context

- All deployment presets and terrain layouts are **hardcoded** - they represent official Warhammer 40K configurations
- The project is in active development with many planned features not yet implemented
- Focus on the visualization and geometry calculations - these are core to deployment planning
- When adding new features, maintain the existing pattern of using Svelte stores for state and separate geometry calculations
