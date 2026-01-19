<script>
  import Battlefield from '../lib/Battlefield.svelte';
  import UnitBase from '../lib/UnitBase.svelte';
  import TerrainFootprint from '../lib/TerrainFootprint.svelte';
  import TerrainRect from '../lib/TerrainRect.svelte';
  import WallPiece from '../lib/WallPiece.svelte';
  import ModelBase from '../lib/ModelBase.svelte';
  import ModelPaletteItem from '../lib/ModelPaletteItem.svelte';
  import { units, terrains, allWalls, allTerrainPolygons, debugMode } from '../stores/elements.js';
  import { checkLineOfSight } from '../lib/visibility/index.js';
  import {
    layoutTerrains,
    layoutWalls,
    selectedTerrainId,
    selectedWallId,
    TERRAIN_SIZES,
    WALL_SHAPES
  } from '../stores/layout.js';
  import {
    models,
    selectedModelId,
    BASE_SIZES
  } from '../stores/models.js';

  function updateUnit(id, x, y) {
    units.update(u => u.map(unit =>
      unit.id === id ? { ...unit, x, y } : unit
    ));
  }

  function updateTerrain(id, x, y) {
    terrains.update(t => t.map(terrain =>
      terrain.id === id ? { ...terrain, x, y } : terrain
    ));
  }

  function rotateTerrain(id, rotation) {
    terrains.update(t => t.map(terrain =>
      terrain.id === id ? { ...terrain, rotation } : terrain
    ));
  }

  // Layout terrain/wall/model handlers
  function handleAddTerrain(width, height) {
    layoutTerrains.add(width, height);
  }

  function handleAddWall(shape) {
    layoutWalls.add(shape);
  }

  function handleSelectTerrain(id) {
    selectedTerrainId.set(id);
    selectedWallId.set(null);
    selectedModelId.set(null);
  }

  function handleSelectWall(id) {
    selectedWallId.set(id);
    selectedTerrainId.set(null);
    selectedModelId.set(null);
  }

  function handleDragTerrain(id, x, y) {
    layoutTerrains.updateTerrain(id, { x, y });
  }

  function handleDragWall(id, x, y) {
    layoutWalls.updateWall(id, { x, y });
  }

  function handleRotateLayoutTerrain(id, rotation) {
    layoutTerrains.updateTerrain(id, { rotation });
  }

  function handleRotateWall(id, rotation) {
    layoutWalls.updateWall(id, { rotation });
  }

  // Model palette state
  let currentPlayer = 1;
  let phantomModel = null;
  let isDraggingFromPalette = false;
  let screenToSvgRef = null;

  function handlePaletteDragStart(baseSize, event) {
    if (!screenToSvgRef) return;

    isDraggingFromPalette = true;
    const svgCoords = screenToSvgRef(event.clientX, event.clientY);
    phantomModel = {
      baseType: baseSize.type,
      x: svgCoords.x,
      y: svgCoords.y
    };

    window.addEventListener('mousemove', handlePaletteDragMove);
    window.addEventListener('mouseup', handlePaletteDrop);
  }

  function handlePaletteDragMove(event) {
    if (!isDraggingFromPalette || !phantomModel || !screenToSvgRef) return;
    const svgCoords = screenToSvgRef(event.clientX, event.clientY);
    phantomModel = {
      ...phantomModel,
      x: svgCoords.x,
      y: svgCoords.y
    };
  }

  function handlePaletteDrop(event) {
    if (!isDraggingFromPalette || !phantomModel) {
      isDraggingFromPalette = false;
      phantomModel = null;
      window.removeEventListener('mousemove', handlePaletteDragMove);
      window.removeEventListener('mouseup', handlePaletteDrop);
      return;
    }

    models.add(phantomModel.baseType, currentPlayer, phantomModel.x, phantomModel.y);

    phantomModel = null;
    isDraggingFromPalette = false;
    window.removeEventListener('mousemove', handlePaletteDragMove);
    window.removeEventListener('mouseup', handlePaletteDrop);
  }

  function handleSelectModel(id) {
    selectedModelId.set(id);
    selectedTerrainId.set(null);
    selectedWallId.set(null);
  }

  function handleDragModel(id, x, y) {
    models.updateModel(id, { x, y });
  }

  function handleRotateModel(id, rotation) {
    models.updateModel(id, { rotation });
  }

  // Calculate line of sight between the two units
  $: losResult = $units.length >= 2
    ? checkLineOfSight($units[0], $units[1], $allTerrainPolygons, $allWalls)
    : { canSee: true, rays: [] };
</script>

<main>
  <div class="header">
    <h1>Debug Mode</h1>
    <nav class="nav-links">
      <a href="#/setup">Battlefield Setup</a>
      <a href="#/deployment">Deployment</a>
      <a href="#/">Layout Builder</a>
      <a href="#/debug" class="active">Debug Mode</a>
    </nav>
  </div>

  <div class="layout">
    <div class="sidebar">
      <!-- Debug Controls -->
      <section>
        <h3>LOS Debug</h3>
        <div class="controls">
          <label>
            <input type="checkbox" bind:checked={$debugMode} />
            Show debug rays
          </label>
          <span class="los-status" class:can-see={losResult.canSee} class:blocked={!losResult.canSee}>
            {losResult.canSee ? 'Can See' : 'Blocked'}
          </span>
        </div>
      </section>

      <!-- Add Terrain Section -->
      <section>
        <h3>Add Terrain</h3>
        <div class="button-group">
          {#each TERRAIN_SIZES as size}
            <button on:click={() => handleAddTerrain(size.width, size.height)}>
              {size.label}
            </button>
          {/each}
        </div>
      </section>

      <!-- Add Wall Section -->
      <section>
        <h3>Add Wall</h3>
        <div class="button-group">
          {#each WALL_SHAPES as wallShape}
            <button on:click={() => handleAddWall(wallShape.shape)}>
              {wallShape.label}
            </button>
          {/each}
        </div>
      </section>

      <!-- Add Models Section -->
      <section>
        <h3>Add Models</h3>
        <div class="player-toggle">
          <button
            class="toggle-btn"
            class:active={currentPlayer === 1}
            on:click={() => currentPlayer = 1}
          >
            Player 1
          </button>
          <button
            class="toggle-btn"
            class:active={currentPlayer === 2}
            on:click={() => currentPlayer = 2}
          >
            Player 2
          </button>
        </div>
        <div class="base-palette">
          <div class="palette-section">
            <h4>Circles</h4>
            <div class="palette-grid">
              {#each BASE_SIZES.circles as baseSize}
                <ModelPaletteItem
                  {baseSize}
                  playerId={currentPlayer}
                  onDragStart={handlePaletteDragStart}
                />
              {/each}
            </div>
          </div>
          <div class="palette-section">
            <h4>Ovals</h4>
            <div class="palette-grid">
              {#each BASE_SIZES.ovals as baseSize}
                <ModelPaletteItem
                  {baseSize}
                  playerId={currentPlayer}
                  onDragStart={handlePaletteDragStart}
                />
              {/each}
            </div>
          </div>
        </div>
      </section>
    </div>

    <div class="battlefield-area">
      <div class="battlefield-container">
        <Battlefield let:screenToSvg>
          {#if screenToSvg && !screenToSvgRef}
            {screenToSvgRef = screenToSvg, ''}
          {/if}

          <!-- Debug rays (render first, behind everything) -->
          {#if $debugMode}
            {#each losResult.rays as ray}
              <line
                x1={ray.from.x}
                y1={ray.from.y}
                x2={ray.to.x}
                y2={ray.to.y}
                stroke={ray.blocked ? '#ff000033' : '#00ff0033'}
                stroke-width="0.05"
              />
            {/each}
          {/if}

          <!-- Visibility line between units -->
          {#if $units.length >= 2}
            {#if losResult.canSee && losResult.firstClearRay}
              <!-- Show the actual clear line of sight -->
              <line
                x1={losResult.firstClearRay.from.x}
                y1={losResult.firstClearRay.from.y}
                x2={losResult.firstClearRay.to.x}
                y2={losResult.firstClearRay.to.y}
                stroke="#22c55e"
                stroke-width="0.15"
              />
            {:else if !losResult.canSee}
              <!-- Show blocked line from center to center -->
              <line
                x1={$units[0].x}
                y1={$units[0].y}
                x2={$units[1].x}
                y2={$units[1].y}
                stroke="#ef4444"
                stroke-width="0.15"
                stroke-dasharray="0.5,0.25"
              />
            {/if}
          {/if}

          <!-- Layout terrain from terrain builder -->
          {#each $layoutTerrains as terrain (terrain.id)}
            <TerrainRect
              id={terrain.id}
              x={terrain.x}
              y={terrain.y}
              width={terrain.width}
              height={terrain.height}
              rotation={terrain.rotation}
              selected={terrain.id === $selectedTerrainId}
              {screenToSvg}
              onSelect={handleSelectTerrain}
              onDrag={handleDragTerrain}
              onRotate={handleRotateLayoutTerrain}
            />
          {/each}

          <!-- Layout walls from terrain builder -->
          {#each $layoutWalls as wall (wall.id)}
            <WallPiece
              id={wall.id}
              x={wall.x}
              y={wall.y}
              shape={wall.shape}
              rotation={wall.rotation}
              selected={wall.id === $selectedWallId}
              {screenToSvg}
              onSelect={handleSelectWall}
              onDrag={handleDragWall}
              onRotate={handleRotateWall}
            />
          {/each}

          <!-- Models from deployment -->
          {#each $models as model (model.id)}
            <ModelBase
              id={model.id}
              x={model.x}
              y={model.y}
              baseType={model.baseType}
              playerId={model.playerId}
              rotation={model.rotation}
              selected={model.id === $selectedModelId}
              {screenToSvg}
              onSelect={handleSelectModel}
              onDrag={handleDragModel}
              onRotate={handleRotateModel}
            />
          {/each}

          <!-- Phantom model during drag from palette -->
          {#if phantomModel}
            <ModelBase
              id="phantom"
              x={phantomModel.x}
              y={phantomModel.y}
              baseType={phantomModel.baseType}
              playerId={currentPlayer}
              rotation={0}
              selected={false}
              {screenToSvg}
              onSelect={() => {}}
              onDrag={() => {}}
              onRotate={() => {}}
            />
          {/if}

          <!-- Debug terrain pieces with L-walls -->
          {#each $terrains as terrain (terrain.id)}
            <TerrainFootprint
              x={terrain.x}
              y={terrain.y}
              width={terrain.width}
              height={terrain.height}
              rotation={terrain.rotation}
              {screenToSvg}
              onDrag={(x, y) => updateTerrain(terrain.id, x, y)}
              onRotate={(r) => rotateTerrain(terrain.id, r)}
            />
          {/each}

          <!-- Debug unit bases -->
          {#each $units as unit (unit.id)}
            <UnitBase
              x={unit.x}
              y={unit.y}
              radius={unit.radius}
              color={unit.color}
              {screenToSvg}
              onDrag={(x, y) => updateUnit(unit.id, x, y)}
            />
          {/each}
        </Battlefield>
      </div>
      <div class="info">
        <p>Battlefield: 60" x 44" | {$layoutTerrains.length} terrain | {$layoutWalls.length} walls | {$models.length} models | {$terrains.length} debug terrain | {$units.length} debug units</p>
        <p class="hint">Scroll to zoom | Space+drag to pan | Double-click to reset view</p>
      </div>
    </div>
  </div>
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    padding: 1rem;
    box-sizing: border-box;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 2rem;
    margin-bottom: 1rem;
  }

  h1 {
    margin: 0;
    font-size: 1.5rem;
    color: #e0e0e0;
  }

  .nav-links {
    display: flex;
    gap: 1.5rem;
  }

  .nav-links a {
    color: #888;
    text-decoration: none;
    font-size: 0.875rem;
  }

  .nav-links a:hover {
    color: #aaa;
    text-decoration: underline;
  }

  .nav-links a.active {
    color: #fff;
  }

  .layout {
    display: flex;
    gap: 1.5rem;
    flex: 1;
  }

  .sidebar {
    width: 220px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    max-height: calc(100vh - 100px);
    overflow-y: auto;
  }

  section {
    background: #252525;
    border-radius: 8px;
    padding: 1rem;
  }

  section h3 {
    margin: 0 0 0.75rem 0;
    font-size: 0.875rem;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .button-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  button {
    padding: 0.5rem 0.75rem;
    border: 1px solid #444;
    border-radius: 4px;
    background: #333;
    color: #fff;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.15s;
    text-align: left;
  }

  button:hover {
    background: #444;
    border-color: #555;
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .controls label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    color: #aaa;
    font-size: 0.875rem;
  }

  .controls input[type="checkbox"] {
    cursor: pointer;
  }

  .los-status {
    padding: 0.375rem 0.75rem;
    border-radius: 4px;
    font-weight: 600;
    font-size: 0.75rem;
    text-align: center;
  }

  .los-status.can-see {
    background: #22c55e33;
    color: #22c55e;
  }

  .los-status.blocked {
    background: #ef444433;
    color: #ef4444;
  }

  .player-toggle {
    display: flex;
    gap: 0.25rem;
    margin-bottom: 0.75rem;
    background: #1a1a1a;
    border-radius: 4px;
    padding: 0.25rem;
  }

  .toggle-btn {
    flex: 1;
    padding: 0.375rem;
    font-size: 0.75rem;
    background: transparent;
    border: none;
    color: #888;
    transition: all 0.15s;
    text-align: center;
  }

  .toggle-btn.active {
    background: #3b82f6;
    color: #fff;
  }

  .toggle-btn.active:nth-child(2) {
    background: #ef4444;
  }

  .base-palette {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .palette-section h4 {
    margin: 0 0 0.5rem 0;
    font-size: 0.75rem;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .palette-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }

  .battlefield-area {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .battlefield-container {
    flex: 1;
    border: 2px solid #444;
    border-radius: 4px;
    overflow: hidden;
    aspect-ratio: 64 / 48;
    max-height: calc(100vh - 160px);
  }

  .info {
    margin-top: 0.75rem;
    color: #888;
    font-size: 0.875rem;
    text-align: center;
  }

  .info p {
    margin: 0;
  }

  .info .hint {
    margin-top: 0.25rem;
    font-size: 0.75rem;
    color: #666;
    font-style: italic;
  }
</style>
