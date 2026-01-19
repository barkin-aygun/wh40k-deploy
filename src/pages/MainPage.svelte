<script>
  import { onMount } from 'svelte';
  import Battlefield from '../lib/Battlefield.svelte';
  import TerrainRect from '../lib/TerrainRect.svelte';
  import { layoutTerrains, selectedTerrainId, TERRAIN_SIZES } from '../stores/layout.js';

  let hasSavedLayout = false;

  onMount(() => {
    hasSavedLayout = layoutTerrains.hasSaved();
  });

  // Get selected terrain data
  $: selectedTerrain = $layoutTerrains.find(t => t.id === $selectedTerrainId);

  // Local editing values (bound to inputs)
  let editX = '';
  let editY = '';

  // Update edit fields when selection changes
  $: if (selectedTerrain) {
    editX = selectedTerrain.x.toFixed(1);
    editY = selectedTerrain.y.toFixed(1);
  }

  function handleAddTerrain(width, height) {
    layoutTerrains.add(width, height);
  }

  function handleSelectTerrain(id) {
    selectedTerrainId.set(id);
  }

  function handleDeselectAll() {
    selectedTerrainId.set(null);
  }

  function handleDragTerrain(id, x, y) {
    layoutTerrains.updateTerrain(id, { x, y });
  }

  function handleRotateTerrain(id, rotation) {
    layoutTerrains.updateTerrain(id, { rotation });
  }

  function handleRemoveSelected() {
    if ($selectedTerrainId) {
      layoutTerrains.remove($selectedTerrainId);
      selectedTerrainId.set(null);
    }
  }

  function handleUpdateCoordinates() {
    if ($selectedTerrainId) {
      const x = parseFloat(editX);
      const y = parseFloat(editY);
      if (!isNaN(x) && !isNaN(y)) {
        layoutTerrains.updateTerrain($selectedTerrainId, { x, y });
      }
    }
  }

  function handleSave() {
    layoutTerrains.save();
    hasSavedLayout = true;
  }

  function handleLoad() {
    layoutTerrains.load();
    selectedTerrainId.set(null);
  }

  function handleClear() {
    if (confirm('Clear all terrain pieces?')) {
      layoutTerrains.clear();
      selectedTerrainId.set(null);
    }
  }
</script>

<main>
  <div class="header">
    <h1>Warhammer Deployment Planner</h1>
    <a href="#/debug" class="debug-link">Debug Mode</a>
  </div>

  <div class="layout">
    <div class="sidebar">
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

      <!-- Selected Terrain Section -->
      <section>
        <h3>Selected Terrain</h3>
        {#if selectedTerrain}
          <div class="edit-form">
            <div class="field">
              <label>X (inches)</label>
              <input
                type="number"
                step="0.1"
                bind:value={editX}
                on:change={handleUpdateCoordinates}
              />
            </div>
            <div class="field">
              <label>Y (inches)</label>
              <input
                type="number"
                step="0.1"
                bind:value={editY}
                on:change={handleUpdateCoordinates}
              />
            </div>
            <div class="field">
              <label>Size</label>
              <span class="value">{selectedTerrain.width}" x {selectedTerrain.height}"</span>
            </div>
            <div class="field">
              <label>Rotation</label>
              <span class="value">{Math.round(selectedTerrain.rotation)}°</span>
            </div>
            <button class="danger" on:click={handleRemoveSelected}>
              Remove
            </button>
          </div>
        {:else}
          <p class="hint">Click a terrain piece to select it</p>
        {/if}
      </section>

      <!-- Save/Load Section -->
      <section>
        <h3>Layout</h3>
        <div class="button-group vertical">
          <button on:click={handleSave}>Save Layout</button>
          <button on:click={handleLoad} disabled={!hasSavedLayout}>
            Load Layout
          </button>
          <button class="secondary" on:click={handleClear}>Clear All</button>
        </div>
      </section>
    </div>

    <div class="battlefield-area">
      <div class="battlefield-container" on:click={handleDeselectAll} role="presentation">
        <Battlefield let:screenToSvg>
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
              onRotate={handleRotateTerrain}
            />
          {/each}
        </Battlefield>
      </div>
      <div class="info">
        <p>Battlefield: 60" x 44" | {$layoutTerrains.length} terrain piece{$layoutTerrains.length !== 1 ? 's' : ''}</p>
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

  .debug-link {
    color: #888;
    text-decoration: none;
    font-size: 0.875rem;
  }

  .debug-link:hover {
    color: #aaa;
    text-decoration: underline;
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

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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

  .field label {
    font-size: 0.75rem;
    color: #888;
  }

  .field input {
    padding: 0.375rem 0.5rem;
    border: 1px solid #444;
    border-radius: 4px;
    background: #1a1a1a;
    color: #fff;
    font-size: 0.875rem;
  }

  .field input:focus {
    outline: none;
    border-color: #3b82f6;
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
    aspect-ratio: 60 / 44;
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
</style>
