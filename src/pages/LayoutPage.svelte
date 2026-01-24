<script>
  import { onMount } from 'svelte';
  import Battlefield from '../components/Battlefield.svelte';
  import CollapsibleSection from '../components/CollapsibleSection.svelte';
  import {
    layoutTerrains,
    layoutWalls,
    selectedTerrainId,
    selectedWallId,
    TERRAIN_SIZES,
    WALL_SHAPES,
    saveLayout,
    loadLayout,
    deleteLayout,
    getSavedLayoutNames,
    savedLayoutsList,
    refreshSavedLayouts,
    parseWallShape
  } from '../stores/layout.js';

  let battlefieldComponent;
  let saveLayoutName = '';
  let fileInputRef;

  // Custom terrain size inputs
  let customTerrainWidth = 6;
  let customTerrainHeight = 12;

  onMount(() => {
    refreshSavedLayouts();
  });

  // Terrain handlers
  function handleAddTerrain(width, height) {
    layoutTerrains.add(width, height);
  }

  function handleAddCustomTerrain() {
    if (customTerrainWidth > 0 && customTerrainHeight > 0) {
      layoutTerrains.add(customTerrainWidth, customTerrainHeight);
    }
  }

  function handleSelectTerrain(id) {
    selectedTerrainId.set(id);
    selectedWallId.set(null);
  }

  function handleDragTerrain(id, x, y) {
    layoutTerrains.updateTerrain(id, { x, y });
  }

  function handleRotateTerrain(id, rotation) {
    layoutTerrains.updateTerrain(id, { rotation });
  }

  function handleUpdateTerrainDimension(dimension, value) {
    if ($selectedTerrainId && value > 0) {
      layoutTerrains.updateTerrain($selectedTerrainId, { [dimension]: value });
    }
  }

  function handleDeleteTerrain() {
    if ($selectedTerrainId) {
      layoutTerrains.remove($selectedTerrainId);
      selectedTerrainId.set(null);
    }
  }

  // Wall handlers
  function handleAddWall(shape) {
    layoutWalls.add(shape);
  }

  function handleSelectWall(id) {
    selectedWallId.set(id);
    selectedTerrainId.set(null);
  }

  function handleDragWall(id, x, y) {
    layoutWalls.updateWall(id, { x, y });
  }

  function handleRotateWall(id, rotation) {
    layoutWalls.updateWall(id, { rotation });
  }

  function handleDeleteWall() {
    if ($selectedWallId) {
      layoutWalls.remove($selectedWallId);
      selectedWallId.set(null);
    }
  }

  function handleUpdateWallSegment(index, value) {
    if ($selectedWallId && selectedWall && value > 0) {
      const parsed = parseWallShape(selectedWall.shape);
      const currentSegments = selectedWall.segments || parsed.segments;
      const newSegments = [...currentSegments];
      newSegments[index] = value;
      layoutWalls.updateWall($selectedWallId, { segments: newSegments });
    }
  }

  function handleBackgroundClick() {
    selectedTerrainId.set(null);
    selectedWallId.set(null);
  }

  // Clear all
  function handleClearAll() {
    if (confirm('Clear all terrain and walls?')) {
      layoutTerrains.clear();
      layoutWalls.clear();
      selectedTerrainId.set(null);
      selectedWallId.set(null);
    }
  }

  // Save/Load handlers
  function handleSaveLayout() {
    if (!saveLayoutName.trim()) {
      alert('Please enter a layout name');
      return;
    }
    saveLayout(saveLayoutName.trim());
    refreshSavedLayouts();
    saveLayoutName = '';
  }

  function handleLoadLayout(name) {
    loadLayout(name);
    selectedTerrainId.set(null);
    selectedWallId.set(null);
  }

  function handleDeleteSavedLayout(name, event) {
    event.stopPropagation();
    if (confirm(`Delete layout "${name}"?`)) {
      deleteLayout(name);
      refreshSavedLayouts();
    }
  }

  // Export as JSON file
  function handleExportJson() {
    const layout = {
      version: 1,
      exportedAt: new Date().toISOString(),
      terrains: $layoutTerrains,
      walls: $layoutWalls
    };

    const json = JSON.stringify(layout, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const timestamp = new Date().toISOString().slice(0, 10);
    a.download = `layout-${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Import from JSON file
  function handleImportClick() {
    fileInputRef?.click();
  }

  function handleFileImport(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const layout = JSON.parse(e.target.result);
        if (layout.terrains && Array.isArray(layout.terrains)) {
          layoutTerrains.set(layout.terrains);
        }
        if (layout.walls && Array.isArray(layout.walls)) {
          layoutWalls.set(layout.walls);
        }
        selectedTerrainId.set(null);
        selectedWallId.set(null);
      } catch (err) {
        console.error('Failed to parse layout file:', err);
        alert('Failed to import: Invalid JSON file');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  // Keyboard shortcuts
  function handleKeyDown(event) {
    if (event.target.tagName === 'INPUT') return;

    // Delete selected
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      if ($selectedTerrainId) {
        handleDeleteTerrain();
      } else if ($selectedWallId) {
        handleDeleteWall();
      }
    }

    // Escape - deselect
    if (event.key === 'Escape') {
      selectedTerrainId.set(null);
      selectedWallId.set(null);
    }
  }

  // Selected item info
  $: selectedTerrain = $layoutTerrains.find(t => t.id === $selectedTerrainId);
  $: selectedWall = $layoutWalls.find(w => w.id === $selectedWallId);
  $: selectedWallParsed = selectedWall ? parseWallShape(selectedWall.shape) : null;
  $: selectedWallSegments = selectedWall?.segments || selectedWallParsed?.segments || [];
</script>

<svelte:window on:keydown={handleKeyDown} />

<main>
  <div class="layout">
    <div class="sidebar">
      <!-- Add Terrain Section -->
      <CollapsibleSection title="Add Terrain">
        <div class="button-group">
          {#each TERRAIN_SIZES as size}
            <button on:click={() => handleAddTerrain(size.width, size.height)}>
              {size.label}
            </button>
          {/each}
        </div>
        <div class="custom-size-section">
          <span class="section-label">Custom Size</span>
          <div class="dimension-inputs">
            <div class="dimension-input">
              <label>W</label>
              <input type="number" bind:value={customTerrainWidth} min="1" max="20" step="0.5" />
            </div>
            <span class="dimension-separator">×</span>
            <div class="dimension-input">
              <label>H</label>
              <input type="number" bind:value={customTerrainHeight} min="1" max="20" step="0.5" />
            </div>
            <button on:click={handleAddCustomTerrain}>Add</button>
          </div>
        </div>
      </CollapsibleSection>

      <!-- Add Wall Section -->
      <CollapsibleSection title="Add Wall">
        <div class="button-group">
          {#each WALL_SHAPES as wallShape}
            <button on:click={() => handleAddWall(wallShape.shape)}>
              {wallShape.label}
            </button>
          {/each}
        </div>
      </CollapsibleSection>

      <!-- Selected Item Section -->
      <CollapsibleSection title="Selected">
        {#if selectedTerrain}
          <div class="selected-info">
            <div class="field">
              <span class="label">Type</span>
              <span class="value">Terrain</span>
            </div>
            <div class="field">
              <span class="label">Position</span>
              <span class="value">{selectedTerrain.x.toFixed(1)}", {selectedTerrain.y.toFixed(1)}"</span>
            </div>
            <div class="field">
              <span class="label">Rotation</span>
              <span class="value">{Math.round(selectedTerrain.rotation || 0)}°</span>
            </div>
            <div class="edit-section">
              <span class="section-label">Dimensions</span>
              <div class="dimension-inputs">
                <div class="dimension-input">
                  <label>W</label>
                  <input
                    type="number"
                    value={selectedTerrain.width}
                    min="1"
                    max="20"
                    step="0.5"
                    on:change={(e) => handleUpdateTerrainDimension('width', parseFloat(e.target.value))}
                  />
                </div>
                <span class="dimension-separator">×</span>
                <div class="dimension-input">
                  <label>H</label>
                  <input
                    type="number"
                    value={selectedTerrain.height}
                    min="1"
                    max="20"
                    step="0.5"
                    on:change={(e) => handleUpdateTerrainDimension('height', parseFloat(e.target.value))}
                  />
                </div>
              </div>
            </div>
            <button class="danger" on:click={handleDeleteTerrain}>Delete Terrain</button>
          </div>
        {:else if selectedWall}
          <div class="selected-info">
            <div class="field">
              <span class="label">Type</span>
              <span class="value">{selectedWallParsed?.type}-Wall {selectedWallParsed?.mirrored ? '(mirrored)' : ''}</span>
            </div>
            <div class="field">
              <span class="label">Position</span>
              <span class="value">{selectedWall.x.toFixed(1)}", {selectedWall.y.toFixed(1)}"</span>
            </div>
            <div class="field">
              <span class="label">Rotation</span>
              <span class="value">{Math.round(selectedWall.rotation || 0)}°</span>
            </div>
            <div class="edit-section">
              <span class="section-label">Segments</span>
              {#if selectedWallParsed?.type === 'L'}
                <div class="segment-inputs">
                  <div class="segment-input">
                    <label>Width</label>
                    <input
                      type="number"
                      value={selectedWallSegments[0]}
                      min="1"
                      max="20"
                      step="0.5"
                      on:change={(e) => handleUpdateWallSegment(0, parseFloat(e.target.value))}
                    />
                  </div>
                  <div class="segment-input">
                    <label>Height</label>
                    <input
                      type="number"
                      value={selectedWallSegments[1]}
                      min="1"
                      max="20"
                      step="0.5"
                      on:change={(e) => handleUpdateWallSegment(1, parseFloat(e.target.value))}
                    />
                  </div>
                </div>
              {:else if selectedWallParsed?.type === 'C'}
                <div class="segment-inputs">
                  <div class="segment-input">
                    <label>Top</label>
                    <input
                      type="number"
                      value={selectedWallSegments[0]}
                      min="1"
                      max="20"
                      step="0.5"
                      on:change={(e) => handleUpdateWallSegment(0, parseFloat(e.target.value))}
                    />
                  </div>
                  <div class="segment-input">
                    <label>Height</label>
                    <input
                      type="number"
                      value={selectedWallSegments[1]}
                      min="1"
                      max="20"
                      step="0.5"
                      on:change={(e) => handleUpdateWallSegment(1, parseFloat(e.target.value))}
                    />
                  </div>
                  <div class="segment-input">
                    <label>Bottom</label>
                    <input
                      type="number"
                      value={selectedWallSegments[2]}
                      min="1"
                      max="20"
                      step="0.5"
                      on:change={(e) => handleUpdateWallSegment(2, parseFloat(e.target.value))}
                    />
                  </div>
                </div>
              {/if}
            </div>
            <button class="danger" on:click={handleDeleteWall}>Delete Wall</button>
          </div>
        {:else}
          <p class="hint">Click terrain or wall to select</p>
        {/if}
      </CollapsibleSection>

      <!-- Export/Import Section -->
      <CollapsibleSection title="Save & Load">
        <div class="save-section">
          <div class="save-row">
            <input
              type="text"
              bind:value={saveLayoutName}
              placeholder="Layout name..."
              on:keydown={(e) => e.key === 'Enter' && handleSaveLayout()}
            />
            <button on:click={handleSaveLayout}>Save</button>
          </div>

          {#if $savedLayoutsList.length > 0}
            <div class="saved-layouts">
              <span class="section-label">Saved Layouts</span>
              {#each $savedLayoutsList as layout}
                <div class="saved-layout-item">
                  <button class="layout-btn" on:click={() => handleLoadLayout(layout.name)}>
                    {layout.name}
                    <span class="layout-meta">{layout.terrainCount}T {layout.wallCount}W</span>
                  </button>
                  <button class="delete-btn" on:click={(e) => handleDeleteSavedLayout(layout.name, e)} title="Delete">×</button>
                </div>
              {/each}
            </div>
          {/if}

          <div class="export-section">
            <span class="section-label">File Export/Import</span>
            <div class="button-row">
              <button on:click={handleExportJson}>Export JSON</button>
              <button on:click={handleImportClick}>Import JSON</button>
            </div>
            <input
              type="file"
              accept=".json"
              bind:this={fileInputRef}
              on:change={handleFileImport}
              style="display: none;"
            />
          </div>

          <button class="secondary" on:click={handleClearAll}>Clear All</button>
        </div>
      </CollapsibleSection>
    </div>

    <div class="battlefield-area">
      <div class="battlefield-container">
        <Battlefield
          bind:this={battlefieldComponent}
          terrains={$layoutTerrains}
          walls={$layoutWalls}
          models={[]}
          interactiveTerrain={true}
          interactiveWalls={true}
          selectedTerrainId={$selectedTerrainId}
          selectedWallId={$selectedWallId}
          onTerrainSelect={handleSelectTerrain}
          onTerrainDrag={handleDragTerrain}
          onTerrainRotate={handleRotateTerrain}
          onWallSelect={handleSelectWall}
          onWallDrag={handleDragWall}
          onWallRotate={handleRotateWall}
          onBackgroundClick={handleBackgroundClick}
        />
      </div>
      <div class="info">
        <p>Battlefield: 60" × 44" | {$layoutTerrains.length} terrain | {$layoutWalls.length} walls</p>
        <p class="hint">Del to remove | Scroll to zoom | Space+drag to pan | Shift+drag for fine rotation</p>
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
    padding-top: 4rem;
    padding-bottom: 3rem;
    box-sizing: border-box;
  }

  .layout {
    display: flex;
    gap: 1.5rem;
    flex: 1;
  }

  .sidebar {
    width: 240px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 1rem;
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

  button.secondary:hover {
    color: #fff;
    border-color: #666;
  }

  .selected-info {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .field {
    display: flex;
    justify-content: space-between;
    font-size: 0.875rem;
  }

  .field .label {
    color: #888;
  }

  .field .value {
    color: #ccc;
  }

  .hint {
    color: #666;
    font-size: 0.8rem;
    font-style: italic;
    margin: 0;
  }

  .custom-size-section {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid #333;
  }

  .edit-section {
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid #333;
  }

  .dimension-inputs {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .dimension-input {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .dimension-input label {
    font-size: 0.75rem;
    color: #888;
  }

  .dimension-input input {
    width: 50px;
    padding: 0.375rem 0.5rem;
    border: 1px solid #444;
    border-radius: 4px;
    background: #2a2a2a;
    color: #fff;
    font-size: 0.875rem;
    text-align: center;
  }

  .dimension-input input:focus {
    outline: none;
    border-color: #666;
  }

  .dimension-separator {
    color: #666;
    font-size: 0.875rem;
  }

  .dimension-inputs button {
    padding: 0.375rem 0.75rem;
  }

  .segment-inputs {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .segment-input {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .segment-input label {
    font-size: 0.8rem;
    color: #888;
    min-width: 50px;
  }

  .segment-input input {
    width: 60px;
    padding: 0.375rem 0.5rem;
    border: 1px solid #444;
    border-radius: 4px;
    background: #2a2a2a;
    color: #fff;
    font-size: 0.875rem;
    text-align: center;
  }

  .segment-input input:focus {
    outline: none;
    border-color: #666;
  }

  .save-section {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .save-row {
    display: flex;
    gap: 0.5rem;
  }

  .save-row input {
    flex: 1;
    padding: 0.5rem;
    border: 1px solid #444;
    border-radius: 4px;
    background: #2a2a2a;
    color: #fff;
    font-size: 0.875rem;
  }

  .save-row input:focus {
    outline: none;
    border-color: #666;
  }

  .save-row button {
    flex-shrink: 0;
  }

  .section-label {
    display: block;
    font-size: 0.75rem;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.25rem;
  }

  .saved-layouts {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .saved-layout-item {
    display: flex;
    gap: 0.25rem;
  }

  .layout-btn {
    flex: 1;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .layout-meta {
    font-size: 0.75rem;
    color: #666;
  }

  .delete-btn {
    padding: 0.5rem 0.75rem;
    background: transparent;
    color: #666;
    border-color: transparent;
  }

  .delete-btn:hover {
    color: #ef4444;
    background: transparent;
  }

  .export-section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid #333;
  }

  .button-row {
    display: flex;
    gap: 0.5rem;
  }

  .button-row button {
    flex: 1;
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
