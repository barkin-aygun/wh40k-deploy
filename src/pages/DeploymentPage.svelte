<script>
  import { onMount, onDestroy } from 'svelte';
  import Battlefield from '../lib/Battlefield.svelte';
  import TerrainRect from '../lib/TerrainRect.svelte';
  import WallPiece from '../lib/WallPiece.svelte';
  import ModelBase from '../lib/ModelBase.svelte';
  import ModelPaletteItem from '../lib/ModelPaletteItem.svelte';
  import {
    getWallVertices,
    transformWallVertices
  } from '../stores/layout.js';
  import {
    models,
    selectedModelId,
    player1Models,
    player2Models,
    BASE_SIZES,
    getBaseSize,
    isOvalBase
  } from '../stores/models.js';
  import { selectedDeployment, loadedTerrain } from '../stores/battlefieldSetup.js';
  import { pathToSvgD, OBJECTIVE_RADIUS, OBJECTIVE_CONTROL_RADIUS } from '../stores/deployment.js';
  import { canSee } from '../lib/visibility/lineOfSight.js';
  import { getRotatedRectVertices } from '../lib/visibility/geometry.js';

  // Model palette state
  let currentPlayer = 1;
  let phantomModel = null;
  let isDraggingFromPalette = false;
  let screenToSvgRef = null;
  let losVisualizationEnabled = false;

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });

  function handleKeyDown(event) {
    if (event.target.tagName === 'INPUT') return;

    const hasSelection = $selectedModelId;

    // Player switch keys (1, 2)
    if (event.key === '1') {
      event.preventDefault();
      currentPlayer = 1;
      return;
    }
    if (event.key === '2') {
      event.preventDefault();
      currentPlayer = 2;
      return;
    }

    // Toggle LoS visualization (L key)
    if (event.key === 'l' || event.key === 'L') {
      event.preventDefault();
      losVisualizationEnabled = !losVisualizationEnabled;
      return;
    }

    // Delete/Backspace - remove selected piece
    if ((event.key === 'Delete' || event.key === 'Backspace') && hasSelection) {
      event.preventDefault();
      handleRemoveSelected();
      return;
    }

    // Arrow keys - move selected piece
    if (hasSelection && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      const step = event.shiftKey ? 0.1 : 1;
      let dx = 0, dy = 0;

      switch (event.key) {
        case 'ArrowUp': dy = -step; break;
        case 'ArrowDown': dy = step; break;
        case 'ArrowLeft': dx = -step; break;
        case 'ArrowRight': dx = step; break;
      }

      if ($selectedModelId) {
        const model = $models.find(m => m.id === $selectedModelId);
        if (model) {
          models.updateModel($selectedModelId, {
            x: model.x + dx,
            y: model.y + dy
          });
        }
      }
      return;
    }

    // Escape - deselect
    if (event.key === 'Escape') {
      handleDeselectAll();
      return;
    }
  }

  function handleDeselectAll() {
    selectedModelId.set(null);
  }

  // Model handlers
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

    const id = models.add(phantomModel.baseType, currentPlayer, phantomModel.x, phantomModel.y);
    selectedModelId.set(id);

    phantomModel = null;
    isDraggingFromPalette = false;
    window.removeEventListener('mousemove', handlePaletteDragMove);
    window.removeEventListener('mouseup', handlePaletteDrop);
  }

  function handleSelectModel(id) {
    selectedModelId.set(id);
  }

  function handleDragModel(id, x, y) {
    models.updateModel(id, { x, y });
  }

  function handleRotateModel(id, rotation) {
    models.updateModel(id, { rotation });
  }

  function handleRemoveSelected() {
    if ($selectedModelId) {
      models.remove($selectedModelId);
      selectedModelId.set(null);
    }
  }

  function handleClearAll() {
    if (confirm('Clear all models?')) {
      models.clear();
      selectedModelId.set(null);
    }
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

  let t_id = 0;
  // Reactive calculations for LoS
  $: selectedModel = $models.find(m => m.id === $selectedModelId);
  $: enemyModels = selectedModel
    ? $models.filter(m => m.playerId !== selectedModel.playerId)
    : [];
  $: allTerrainPolygons = $loadedTerrain.terrains.map(t => ({
    id: t_id++,
    vertices: getRotatedRectVertices(t)
  }));
  $: allWallPolygons = $loadedTerrain.walls.map(wall =>
    transformWallVertices(getWallVertices(wall.shape), wall.x, wall.y, wall.rotation)
  );
  $: losResults = selectedModel && losVisualizationEnabled && enemyModels.length > 0
    ? enemyModels.map(enemy => ({
        targetId: enemy.id,
        target: enemy,
        canSee: canSee(
          modelToLosFormat(selectedModel),
          modelToLosFormat(enemy),
          allTerrainPolygons,
          allWallPolygons
        )
      }))
    : [];
</script>

<main>
  <div class="header">
    <h1>Deployment Practice</h1>
    <nav class="nav-links">
      <a href="#/setup">Battlefield Setup</a>
      <a href="#/deployment" class="active">Deployment</a>
      <a href="#/">Layout Builder</a>
      <a href="#/debug">Debug Mode</a>
    </nav>
  </div>

  <div class="layout">
    <div class="sidebar">
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
              {#each BASE_SIZES.circles as base}
                <ModelPaletteItem
                  baseSize={base}
                  playerId={currentPlayer}
                  onDragStart={handlePaletteDragStart}
                />
              {/each}
            </div>
          </div>
          <div class="palette-section">
            <h4>Ovals</h4>
            <div class="palette-grid">
              {#each BASE_SIZES.ovals as base}
                <ModelPaletteItem
                  baseSize={base}
                  playerId={currentPlayer}
                  onDragStart={handlePaletteDragStart}
                />
              {/each}
            </div>
          </div>
        </div>
      </section>

      <!-- Selected Model Section -->
      <section>
        <h3>Selected Model</h3>
        {#if selectedModel}
          <div class="edit-form">
            <div class="field">
              <span class="label-text">Base Type</span>
              <span class="value">{getBaseSize(selectedModel.baseType).label}</span>
            </div>
            <div class="field">
              <span class="label-text">Player</span>
              <span class="value">Player {selectedModel.playerId}</span>
            </div>
            <div class="field">
              <span class="label-text">Position</span>
              <span class="value">{selectedModel.x.toFixed(1)}", {selectedModel.y.toFixed(1)}"</span>
            </div>
            {#if isOvalBase(selectedModel.baseType)}
              <div class="field">
                <span class="label-text">Rotation</span>
                <span class="value">{Math.round(selectedModel.rotation || 0)}°</span>
              </div>
            {/if}
            <div class="field">
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={losVisualizationEnabled} />
                Show Line of Sight
              </label>
            </div>
            {#if losVisualizationEnabled && losResults.length > 0}
              <div class="field">
                <span class="label-text">LoS Status</span>
                <span class="value">{losResults.filter(r => r.canSee).length}/{losResults.length} visible</span>
              </div>
            {/if}
            <button class="danger" on:click={handleRemoveSelected}>
              Remove
            </button>
          </div>
        {:else}
          <p class="hint">Click a model to select it</p>
        {/if}
      </section>

      <!-- Actions -->
      <section>
        <h3>Actions</h3>
        <div class="button-group vertical">
          <button class="secondary" on:click={handleClearAll}>Clear All Models</button>
        </div>
      </section>
    </div>

    <div class="battlefield-area">
      <div class="battlefield-container" on:click={handleDeselectAll} role="presentation">
        <Battlefield let:screenToSvg>
          {#if screenToSvg && !screenToSvgRef}
            {screenToSvgRef = screenToSvg, ''}
          {/if}

          <!-- Deployment zones -->
          {#if $selectedDeployment}
            {#each $selectedDeployment.zones as zone}
              <path
                d={pathToSvgD(zone.path)}
                fill={zone.color}
                stroke={zone.borderColor}
                stroke-width="0.10"
                stroke-dasharray="0.5,0.25"
                pointer-events="none"
              />
            {/each}

            <!-- Objectives -->
            {#each $selectedDeployment.objectives as obj}
              {@const markerColor = obj.isPrimary ? '#fbbf24' : '#9ca3af'}
              {@const controlColor = obj.isPrimary ? 'rgba(251, 191, 36, 0.15)' : 'rgba(156, 163, 175, 0.15)'}
              <circle
                cx={obj.x}
                cy={obj.y}
                r={OBJECTIVE_CONTROL_RADIUS}
                fill={controlColor}
                stroke={markerColor}
                stroke-width="0.05"
                stroke-dasharray="0.3,0.15"
                pointer-events="none"
              />
              <circle
                cx={obj.x}
                cy={obj.y}
                r={OBJECTIVE_RADIUS}
                fill={markerColor}
                stroke="#000"
                stroke-width="0.06"
                pointer-events="none"
              />
              <circle
                cx={obj.x}
                cy={obj.y}
                r="0.15"
                fill="#000"
                pointer-events="none"
              />
            {/each}
          {/if}

          <!-- Render terrain (read-only) -->
          {#each $loadedTerrain.terrains as terrain (terrain.id)}
            <g transform="rotate({terrain.rotation}, {terrain.x + terrain.width/2}, {terrain.y + terrain.height/2})">
              <rect
                x={terrain.x}
                y={terrain.y}
                width={terrain.width}
                height={terrain.height}
                fill="rgba(139, 90, 43, 0.2)"
                stroke="#8b5a2b"
                stroke-width="0.1"
                pointer-events="none"
              />
            </g>
          {/each}

          <!-- Render walls (read-only) -->
          {#each $loadedTerrain.walls as wall (wall.id)}
            <g opacity="0.5" pointer-events="none">
              <WallPiece
                id={wall.id}
                x={wall.x}
                y={wall.y}
                shape={wall.shape}
                rotation={wall.rotation}
                selected={false}
                {screenToSvg}
                onSelect={() => {}}
                onDrag={() => {}}
                onRotate={() => {}}
              />
            </g>
          {/each}

          <!-- Render models -->
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

          <!-- Phantom model during drag -->
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

          <!-- LoS Visualization -->
          {#if losVisualizationEnabled && selectedModel && losResults.length > 0}
            {#each losResults as result}
              <line
                x1={selectedModel.x}
                y1={selectedModel.y}
                x2={result.target.x}
                y2={result.target.y}
                stroke={result.canSee ? '#22c55e' : '#ef4444'}
                stroke-width={result.canSee ? 0.15 : 0.1}
                stroke-dasharray={result.canSee ? 'none' : '0.5 0.25'}
                opacity="0.7"
                pointer-events="none"
              />
            {/each}
          {/if}
        </Battlefield>
      </div>
      <div class="info">
        <p>Battlefield: 60" x 44" | {$player1Models.length} P1 models | {$player2Models.length} P2 models</p>
        <p class="hint">Press 1/2 to switch player | Press L to toggle LoS | Drag models to move</p>
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
    color: #3b82f6;
    font-weight: 600;
  }

  .layout {
    display: flex;
    gap: 1.5rem;
    flex: 1;
  }

  .sidebar {
    width: 200px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
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

  .button-group.vertical {
    flex-direction: column;
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
  }

  button:hover:not(:disabled) {
    background: #444;
    border-color: #555;
  }

  button.danger {
    background: #7f1d1d;
    border-color: #991b1b;
  }

  button.danger:hover {
    background: #991b1b;
  }

  button.secondary {
    background: transparent;
    border-color: #555;
    color: #888;
  }

  button.secondary:hover:not(:disabled) {
    color: #fff;
    border-color: #666;
  }

  .edit-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .field .label-text {
    font-size: 0.75rem;
    color: #888;
  }

  .field .value {
    color: #ccc;
    font-size: 0.875rem;
  }

  .hint {
    color: #666;
    font-size: 0.8rem;
    font-style: italic;
    margin: 0;
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

  /* Models section styles */
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

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #ccc;
    font-size: 0.875rem;
    cursor: pointer;
  }

  .checkbox-label input[type="checkbox"] {
    cursor: pointer;
  }
</style>
