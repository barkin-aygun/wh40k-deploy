<script>
  import { onMount } from 'svelte';
  import Battlefield from '../lib/Battlefield.svelte';
  import TerrainRect from '../lib/TerrainRect.svelte';
  import WallPiece from '../lib/WallPiece.svelte';
  import ModelBase from '../lib/ModelBase.svelte';
  import ModelPaletteItem from '../lib/ModelPaletteItem.svelte';
  import CollapsibleSection from '../lib/CollapsibleSection.svelte';
  import { debugMode } from '../stores/elements.js';
  import { checkLineOfSight } from '../lib/visibility/index.js';
  import {
    debugTerrains,
    debugWalls,
    debugSelectedTerrainId,
    debugSelectedWallId,
    TERRAIN_SIZES,
    WALL_SHAPES,
    getWallVertices,
    transformWallVertices
  } from '../stores/layout.js';
  import {
    debugModels,
    debugSelectedModelId,
    BASE_SIZES,
    getBaseSize,
    isOvalBase
  } from '../stores/models.js';
  import { debugHistory } from '../stores/history.js';
  import { getRotatedRectVertices } from '../lib/visibility/geometry.js';

  // Terrain/wall/model handlers
  function handleAddTerrain(width, height) {
    debugTerrains.add(width, height);
  }

  function handleAddWall(shape) {
    debugWalls.add(shape);
  }

  function handleSelectTerrain(id) {
    debugSelectedTerrainId.set(id);
    debugSelectedWallId.set(null);
    debugSelectedModelId.set(null);
  }

  function handleSelectWall(id) {
    debugSelectedWallId.set(id);
    debugSelectedTerrainId.set(null);
    debugSelectedModelId.set(null);
  }

  function handleDragTerrain(id, x, y) {
    debugTerrains.updateTerrain(id, { x, y });
  }

  function handleDragWall(id, x, y) {
    debugWalls.updateWall(id, { x, y });
  }

  function handleRotateLayoutTerrain(id, rotation) {
    debugTerrains.updateTerrain(id, { rotation });
  }

  function handleRotateWall(id, rotation) {
    debugWalls.updateWall(id, { rotation });
  }

  // Model palette state
  let currentPlayer = 1;
  let phantomModel = null;
  let isDraggingFromPalette = false;
  let dragStartPos = null;
  let screenToSvgRef = null;

  const DRAG_THRESHOLD = 5; // pixels - movement below this is considered a click

  // Initialize debug mode with two models (one for each player)
  onMount(() => {
    // Only initialize if debug models is empty
    if ($debugModels.length === 0) {
      const p1Id = debugModels.add('32mm', 1, 10, 22);
      const p2Id = debugModels.add('32mm', 2, 50, 22);
      // Select the first model by default
      debugSelectedModelId.set(p1Id);
    }
  });

  function handlePaletteDragStart(baseSize, event) {
    if (!screenToSvgRef) return;

    isDraggingFromPalette = true;
    dragStartPos = { x: event.clientX, y: event.clientY };

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
      dragStartPos = null;
      window.removeEventListener('mousemove', handlePaletteDragMove);
      window.removeEventListener('mouseup', handlePaletteDrop);
      return;
    }

    // Check if this was a click (no significant movement) or a drag
    const dx = event.clientX - dragStartPos.x;
    const dy = event.clientY - dragStartPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    let x, y;
    if (distance < DRAG_THRESHOLD) {
      // Just a click - place at default position (battlefield center)
      x = 30;
      y = 22;
    } else {
      // Actual drag - use phantom model position
      x = phantomModel.x;
      y = phantomModel.y;
    }

    const id = debugModels.add(phantomModel.baseType, currentPlayer, x, y);
    debugSelectedModelId.set(id);

    phantomModel = null;
    isDraggingFromPalette = false;
    dragStartPos = null;
    window.removeEventListener('mousemove', handlePaletteDragMove);
    window.removeEventListener('mouseup', handlePaletteDrop);
  }

  function handleSelectModel(id) {
    debugSelectedModelId.set(id);
    debugSelectedTerrainId.set(null);
    debugSelectedWallId.set(null);
  }

  function handleDragModel(id, x, y) {
    // Update during drag without saving to history
    debugModels.updateModel(id, { x, y }, true);
  }

  function handleDragModelEnd(id, startX, startY, endX, endY) {
    // Save to history when drag ends
    debugHistory.push({
      type: 'move',
      modelId: id,
      before: { x: startX, y: startY },
      after: { x: endX, y: endY }
    });
  }

  function handleRotateModel(id, rotation) {
    // Update during rotation without saving to history
    debugModels.updateModel(id, { rotation }, true);
  }

  function handleRotateModelEnd(id, startRotation, endRotation) {
    // Save to history when rotation ends
    debugHistory.push({
      type: 'rotate',
      modelId: id,
      before: { rotation: startRotation },
      after: { rotation: endRotation }
    });
  }

  function handleRenameModel(id, name) {
    debugModels.updateModel(id, { name });
  }

  // Convert model to LoS format
  function modelToLosFormat(model) {
    const baseSize = getBaseSize(model.baseType);
    if (isOvalBase(model.baseType)) {
      return {
        x: model.x,
        y: model.y,
        rx: baseSize.width / 2,
        ry: baseSize.height / 2,
        rotation: model.rotation || 0
      };
    } else {
      return {
        x: model.x,
        y: model.y,
        radius: baseSize.radius
      };
    }
  }

  // Model-based LOS calculations (using debug terrains/walls/models)
  $: selectedModel = $debugModels.find(m => m.id === $debugSelectedModelId);
  $: enemyModels = selectedModel
    ? $debugModels.filter(m => m.playerId !== selectedModel.playerId)
    : [];
  $: debugTerrainPolygons = $debugTerrains.map(t => ({
    id: t.id,
    vertices: getRotatedRectVertices(t)
  }));
  $: debugWallPolygons = $debugWalls.map(wall =>
    transformWallVertices(getWallVertices(wall.shape, wall.segments), wall.x, wall.y, wall.rotation)
  );
  // Calculate LOS from each enemy to the selected model (who can see the selected model)
  $: modelLosResults = selectedModel && enemyModels.length > 0
    ? enemyModels.map(enemy => {
        const result = checkLineOfSight(
          modelToLosFormat(enemy),          // enemy is the viewer
          modelToLosFormat(selectedModel),  // selected model is the target
          debugTerrainPolygons,
          debugWallPolygons
        );
        return {
          viewerId: enemy.id,
          viewer: enemy,
          canSee: result.canSee,
          firstClearRay: result.firstClearRay,
          rays: result.rays  // Include all rays for debug visualization
        };
      })
    : [];
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
      <CollapsibleSection title="LOS Debug">
        <div class="controls">
          <label>
            <input type="checkbox" bind:checked={$debugMode} />
            Show debug rays
          </label>
          {#if selectedModel && modelLosResults.length > 0}
            <span class="los-status" class:can-see={modelLosResults.some(r => r.canSee)} class:blocked={!modelLosResults.some(r => r.canSee)}>
              {modelLosResults.filter(r => r.canSee).length}/{modelLosResults.length} visible
            </span>
          {:else}
            <span class="los-status">No enemies</span>
          {/if}
        </div>
      </CollapsibleSection>

      <!-- Add Terrain Section -->
      <CollapsibleSection title="Add Terrain" defaultOpen={false}>
        <div class="button-group">
          {#each TERRAIN_SIZES as size}
            <button on:click={() => handleAddTerrain(size.width, size.height)}>
              {size.label}
            </button>
          {/each}
        </div>
      </CollapsibleSection>

      <!-- Add Wall Section -->
      <CollapsibleSection title="Add Wall" defaultOpen={false}>
        <div class="button-group">
          {#each WALL_SHAPES as wallShape}
            <button on:click={() => handleAddWall(wallShape.shape)}>
              {wallShape.label}
            </button>
          {/each}
        </div>
      </CollapsibleSection>

      <!-- Add Models Section -->
      <CollapsibleSection title="Add Models" defaultOpen={false}>
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
      </CollapsibleSection>
    </div>

    <div class="battlefield-area">
      <div class="battlefield-container">
        <Battlefield let:screenToSvg>
          {#if screenToSvg && !screenToSvgRef}
            {screenToSvgRef = screenToSvg, ''}
          {/if}

          <!-- Debug rays (render first, behind everything) -->
          {#if $debugMode && selectedModel && modelLosResults.length > 0}
            {#each modelLosResults as result}
              {#each result.rays as ray}
                <line
                  x1={ray.from.x}
                  y1={ray.from.y}
                  x2={ray.to.x}
                  y2={ray.to.y}
                  stroke={ray.blocked ? '#ff000033' : '#00ff0033'}
                  stroke-width="0.05"
                />
              {/each}
            {/each}
          {/if}

          <!-- Debug terrain pieces -->
          {#each $debugTerrains as terrain (terrain.id)}
            <TerrainRect
              id={terrain.id}
              x={terrain.x}
              y={terrain.y}
              width={terrain.width}
              height={terrain.height}
              rotation={terrain.rotation}
              selected={terrain.id === $debugSelectedTerrainId}
              {screenToSvg}
              onSelect={handleSelectTerrain}
              onDrag={handleDragTerrain}
              onRotate={handleRotateLayoutTerrain}
            />
          {/each}

          <!-- Debug walls -->
          {#each $debugWalls as wall (wall.id)}
            <WallPiece
              id={wall.id}
              x={wall.x}
              y={wall.y}
              shape={wall.shape}
              segments={wall.segments}
              rotation={wall.rotation}
              selected={wall.id === $debugSelectedWallId}
              {screenToSvg}
              onSelect={handleSelectWall}
              onDrag={handleDragWall}
              onRotate={handleRotateWall}
            />
          {/each}

          <!-- Debug models -->
          {#each $debugModels as model (model.id)}
            <ModelBase
              id={model.id}
              x={model.x}
              y={model.y}
              baseType={model.baseType}
              playerId={model.playerId}
              rotation={model.rotation}
              name={model.name || ''}
              selected={model.id === $debugSelectedModelId}
              {screenToSvg}
              onSelect={handleSelectModel}
              onDrag={handleDragModel}
              onDragEnd={handleDragModelEnd}
              onRotate={handleRotateModel}
              onRotateEnd={handleRotateModelEnd}
              onRename={handleRenameModel}
            />
          {/each}

          <!-- Model LOS Visualization -->
          {#if $debugMode && selectedModel && modelLosResults.length > 0}
            {#each modelLosResults as result}
              {#if result.firstClearRay}
                <!-- Show the actual clear ray of sight -->
                <line
                  x1={result.firstClearRay.from.x}
                  y1={result.firstClearRay.from.y}
                  x2={result.firstClearRay.to.x}
                  y2={result.firstClearRay.to.y}
                  stroke="#22c55e"
                  stroke-width="0.15"
                  opacity="0.7"
                  pointer-events="none"
                />
              {:else}
                <!-- Show blocked line from center to center -->
                <line
                  x1={selectedModel.x}
                  y1={selectedModel.y}
                  x2={result.target.x}
                  y2={result.target.y}
                  stroke="#ef4444"
                  stroke-width="0.1"
                  stroke-dasharray="0.5 0.25"
                  opacity="0.7"
                  pointer-events="none"
                />
              {/if}
            {/each}
          {/if}

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
        </Battlefield>
      </div>
      <div class="info">
        <p>Battlefield: 60" x 44" | {$debugTerrains.length} terrain | {$debugWalls.length} walls | {$debugModels.length} models</p>
        {#if $debugMode && selectedModel && modelLosResults.length > 0}
          <p>Selected model LOS: {modelLosResults.filter(r => r.canSee).length}/{modelLosResults.length} visible</p>
        {/if}
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
