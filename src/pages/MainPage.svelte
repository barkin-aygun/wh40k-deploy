<script>
  import { onMount, onDestroy } from 'svelte';
  import Battlefield from '../lib/Battlefield.svelte';
  import TerrainRect from '../lib/TerrainRect.svelte';
  import WallPiece from '../lib/WallPiece.svelte';
  import CollapsibleSection from '../lib/CollapsibleSection.svelte';
  import {
    layoutTerrains,
    layoutWalls,
    selectedTerrainId,
    selectedWallId,
    TERRAIN_SIZES,
    WALL_SHAPES,
    savedLayoutsList,
    refreshSavedLayouts,
    saveLayout,
    loadLayout,
    deleteLayout,
    parseWallShape
  } from '../stores/layout.js';

  // Modal state
  let showSaveModal = false;
  let showLoadModal = false;
  let saveLayoutName = '';

  // Clipboard for copy/paste
  let clipboard = null;

  onMount(() => {
    refreshSavedLayouts();
    window.addEventListener('keydown', handleKeyDown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });

  function handleKeyDown(event) {
    // Don't handle keys when typing in inputs or modals are open
    if (event.target.tagName === 'INPUT' || showSaveModal || showLoadModal) {
      return;
    }

    const hasSelection = $selectedTerrainId || $selectedWallId;

    // Delete/Backspace - remove selected piece
    if ((event.key === 'Delete' || event.key === 'Backspace') && hasSelection) {
      event.preventDefault();
      handleRemoveSelected();
      return;
    }

    // Arrow keys - move selected piece
    if (hasSelection && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      const step = event.shiftKey ? 0.1 : 1; // Shift for fine movement
      let dx = 0, dy = 0;

      switch (event.key) {
        case 'ArrowUp': dy = -step; break;
        case 'ArrowDown': dy = step; break;
        case 'ArrowLeft': dx = -step; break;
        case 'ArrowRight': dx = step; break;
      }

      if ($selectedTerrainId) {
        const terrain = $layoutTerrains.find(t => t.id === $selectedTerrainId);
        if (terrain) {
          layoutTerrains.updateTerrain($selectedTerrainId, {
            x: terrain.x + dx,
            y: terrain.y + dy
          });
        }
      } else if ($selectedWallId) {
        const wall = $layoutWalls.find(w => w.id === $selectedWallId);
        if (wall) {
          layoutWalls.updateWall($selectedWallId, {
            x: wall.x + dx,
            y: wall.y + dy
          });
        }
      }
      return;
    }

    // Ctrl+C - copy selected piece
    if (event.key === 'c' && (event.ctrlKey || event.metaKey) && hasSelection) {
      event.preventDefault();
      if ($selectedTerrainId) {
        const terrain = $layoutTerrains.find(t => t.id === $selectedTerrainId);
        if (terrain) {
          clipboard = { type: 'terrain', data: { ...terrain } };
        }
      } else if ($selectedWallId) {
        const wall = $layoutWalls.find(w => w.id === $selectedWallId);
        if (wall) {
          clipboard = { type: 'wall', data: { ...wall } };
        }
      }
      return;
    }

    // Ctrl+V - paste piece
    if (event.key === 'v' && (event.ctrlKey || event.metaKey) && clipboard) {
      event.preventDefault();
      if (clipboard.type === 'terrain') {
        const newId = 'terrain-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        const newTerrain = {
          ...clipboard.data,
          id: newId,
          x: clipboard.data.x + 2, // Offset so it's visible
          y: clipboard.data.y + 2
        };
        layoutTerrains.update(terrains => [...terrains, newTerrain]);
        selectedTerrainId.set(newId);
        selectedWallId.set(null);
        // Update clipboard position for next paste
        clipboard.data.x += 2;
        clipboard.data.y += 2;
      } else if (clipboard.type === 'wall') {
        const newId = 'wall-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        const newWall = {
          ...clipboard.data,
          id: newId,
          x: clipboard.data.x + 2,
          y: clipboard.data.y + 2
        };
        layoutWalls.update(walls => [...walls, newWall]);
        selectedWallId.set(newId);
        selectedTerrainId.set(null);
        // Update clipboard position for next paste
        clipboard.data.x += 2;
        clipboard.data.y += 2;
      }
      return;
    }

    // Escape - deselect
    if (event.key === 'Escape') {
      handleDeselectAll();
      return;
    }
  }

  // Get selected terrain data
  $: selectedTerrain = $layoutTerrains.find(t => t.id === $selectedTerrainId);
  $: selectedWall = $layoutWalls.find(w => w.id === $selectedWallId);

  // Local editing values (bound to inputs)
  let editX = '';
  let editY = '';
  let editWidth = '';
  let editHeight = '';
  let editRotation = '';
  let editSegment1 = '';
  let editSegment2 = '';
  let editSegment3 = '';

  // Get wall segment info
  function getWallSegments(wall) {
    if (wall.segments) return wall.segments;
    const parsed = parseWallShape(wall.shape);
    return parsed.segments;
  }

  function getWallType(wall) {
    const parsed = parseWallShape(wall.shape);
    return parsed.type;
  }

  // Update edit fields when selection changes
  $: if (selectedTerrain) {
    editX = selectedTerrain.x.toFixed(1);
    editY = selectedTerrain.y.toFixed(1);
    editWidth = selectedTerrain.width.toString();
    editHeight = selectedTerrain.height.toString();
    editRotation = Math.round(selectedTerrain.rotation).toString();
  } else if (selectedWall) {
    editX = selectedWall.x.toFixed(1);
    editY = selectedWall.y.toFixed(1);
    editRotation = Math.round(selectedWall.rotation).toString();
    const segments = getWallSegments(selectedWall);
    editSegment1 = segments[0]?.toString() || '';
    editSegment2 = segments[1]?.toString() || '';
    editSegment3 = segments[2]?.toString() || '';
  }

  function handleAddTerrain(width, height) {
    layoutTerrains.add(width, height);
  }

  function handleAddWall(shape) {
    layoutWalls.add(shape);
  }

  function handleSelectTerrain(id) {
    selectedTerrainId.set(id);
    selectedWallId.set(null);
  }

  function handleSelectWall(id) {
    selectedWallId.set(id);
    selectedTerrainId.set(null);
  }

  function handleDeselectAll() {
    selectedTerrainId.set(null);
    selectedWallId.set(null);
  }

  function handleDragTerrain(id, x, y) {
    layoutTerrains.updateTerrain(id, { x, y });
  }

  function handleDragWall(id, x, y) {
    layoutWalls.updateWall(id, { x, y });
  }

  function handleRotateTerrain(id, rotation) {
    layoutTerrains.updateTerrain(id, { rotation });
  }

  function handleRotateWall(id, rotation) {
    layoutWalls.updateWall(id, { rotation });
  }

  function handleRemoveSelected() {
    if ($selectedTerrainId) {
      layoutTerrains.remove($selectedTerrainId);
      selectedTerrainId.set(null);
    } else if ($selectedWallId) {
      layoutWalls.remove($selectedWallId);
      selectedWallId.set(null);
    }
  }

  function handleUpdateCoordinates() {
    const x = parseFloat(editX);
    const y = parseFloat(editY);
    if (!isNaN(x) && !isNaN(y)) {
      if ($selectedTerrainId) {
        layoutTerrains.updateTerrain($selectedTerrainId, { x, y });
      } else if ($selectedWallId) {
        layoutWalls.updateWall($selectedWallId, { x, y });
      }
    }
  }

  function handleUpdateSize() {
    if (!$selectedTerrainId) return;
    const width = parseFloat(editWidth);
    const height = parseFloat(editHeight);
    if (!isNaN(width) && !isNaN(height) && width > 0 && height > 0) {
      layoutTerrains.updateTerrain($selectedTerrainId, { width, height });
    }
  }

  function handleUpdateRotation() {
    const rotation = parseFloat(editRotation);
    if (isNaN(rotation)) return;
    if ($selectedTerrainId) {
      layoutTerrains.updateTerrain($selectedTerrainId, { rotation });
    } else if ($selectedWallId) {
      layoutWalls.updateWall($selectedWallId, { rotation });
    }
  }

  function handleUpdateWallSegments() {
    if (!$selectedWallId || !selectedWall) return;
    const wallType = getWallType(selectedWall);

    const seg1 = parseFloat(editSegment1);
    const seg2 = parseFloat(editSegment2);

    if (isNaN(seg1) || isNaN(seg2) || seg1 <= 0 || seg2 <= 0) return;

    let segments;
    if (wallType === 'C') {
      const seg3 = parseFloat(editSegment3);
      if (isNaN(seg3) || seg3 <= 0) return;
      segments = [seg1, seg2, seg3];
    } else {
      segments = [seg1, seg2];
    }

    layoutWalls.updateWall($selectedWallId, { segments });
  }

  function openSaveModal() {
    saveLayoutName = '';
    showSaveModal = true;
  }

  function handleSave() {
    if (saveLayoutName.trim()) {
      saveLayout(saveLayoutName.trim());
      refreshSavedLayouts();
      showSaveModal = false;
      saveLayoutName = '';
    }
  }

  function openLoadModal() {
    refreshSavedLayouts();
    showLoadModal = true;
  }

  function handleLoad(name) {
    loadLayout(name);
    selectedTerrainId.set(null);
    selectedWallId.set(null);
    showLoadModal = false;
  }

  function handleDeleteLayout(name, event) {
    event.stopPropagation();
    if (confirm(`Delete layout "${name}"?`)) {
      deleteLayout(name);
      refreshSavedLayouts();
    }
  }

  function handleClear() {
    if (confirm('Clear all terrain and walls?')) {
      layoutTerrains.clear();
      layoutWalls.clear();
      selectedTerrainId.set(null);
      selectedWallId.set(null);
    }
  }

  function formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Get shape display name
  function getShapeName(shape) {
    const found = WALL_SHAPES.find(s => s.shape === shape);
    return found ? found.label : shape;
  }

  // Export current layout to JSON file
  function handleExport() {
    const layoutName = prompt('Layout name (for the recipient):', 'Custom Layout');
    if (layoutName === null) return; // User cancelled

    const terrains = $layoutTerrains;
    const walls = $layoutWalls;
    const data = {
      version: 1,
      name: layoutName || 'Custom Layout',
      exportedAt: new Date().toISOString(),
      terrainCount: terrains.length,
      wallCount: walls.length,
      terrains,
      walls
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (layoutName || 'layout').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    a.download = `${safeName}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Import layout from JSON file
  let fileInput;

  function handleImportClick() {
    fileInput.click();
  }

  function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.terrains && Array.isArray(data.terrains)) {
          layoutTerrains.set(data.terrains);
        }
        if (data.walls && Array.isArray(data.walls)) {
          layoutWalls.set(data.walls);
        }
        selectedTerrainId.set(null);
        selectedWallId.set(null);

        // Show info about imported layout
        const name = data.name || 'Unknown';
        const terrainCount = data.terrains?.length || 0;
        const wallCount = data.walls?.length || 0;
        alert(`Imported "${name}"\n${terrainCount} terrain(s), ${wallCount} wall(s)`);
      } catch (err) {
        alert('Failed to import layout: Invalid file format');
        console.error('Import error:', err);
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be selected again
    event.target.value = '';
  }
</script>

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
      <CollapsibleSection title="Selected {selectedTerrain ? 'Terrain' : selectedWall ? 'Wall' : 'Item'}">
        {#if selectedTerrain || selectedWall}
          <div class="edit-form">
            <div class="field">
              <label for="edit-x">X (inches)</label>
              <input
                id="edit-x"
                type="number"
                step="0.1"
                bind:value={editX}
                on:change={handleUpdateCoordinates}
              />
            </div>
            <div class="field">
              <label for="edit-y">Y (inches)</label>
              <input
                id="edit-y"
                type="number"
                step="0.1"
                bind:value={editY}
                on:change={handleUpdateCoordinates}
              />
            </div>
            {#if selectedTerrain}
              <div class="field">
                <label for="edit-width">Width (inches)</label>
                <input
                  id="edit-width"
                  type="number"
                  step="0.5"
                  min="1"
                  bind:value={editWidth}
                  on:change={handleUpdateSize}
                />
              </div>
              <div class="field">
                <label for="edit-height">Length (inches)</label>
                <input
                  id="edit-height"
                  type="number"
                  step="0.5"
                  min="1"
                  bind:value={editHeight}
                  on:change={handleUpdateSize}
                />
              </div>
              <div class="field">
                <label for="edit-rotation">Rotation (°)</label>
                <input
                  id="edit-rotation"
                  type="number"
                  step="15"
                  bind:value={editRotation}
                  on:change={handleUpdateRotation}
                />
              </div>
            {:else if selectedWall}
              <div class="field">
                <span class="label-text">Shape</span>
                <span class="value">{getShapeName(selectedWall.shape)}</span>
              </div>
              {#if getWallType(selectedWall) === 'L'}
                <div class="field">
                  <label for="edit-seg1">Horizontal (inches)</label>
                  <input
                    id="edit-seg1"
                    type="number"
                    step="0.5"
                    min="1"
                    bind:value={editSegment1}
                    on:change={handleUpdateWallSegments}
                  />
                </div>
                <div class="field">
                  <label for="edit-seg2">Vertical (inches)</label>
                  <input
                    id="edit-seg2"
                    type="number"
                    step="0.5"
                    min="1"
                    bind:value={editSegment2}
                    on:change={handleUpdateWallSegments}
                  />
                </div>
              {:else if getWallType(selectedWall) === 'C'}
                <div class="field">
                  <label for="edit-seg1">Top Width (inches)</label>
                  <input
                    id="edit-seg1"
                    type="number"
                    step="0.5"
                    min="1"
                    bind:value={editSegment1}
                    on:change={handleUpdateWallSegments}
                  />
                </div>
                <div class="field">
                  <label for="edit-seg2">Length (inches)</label>
                  <input
                    id="edit-seg2"
                    type="number"
                    step="0.5"
                    min="1"
                    bind:value={editSegment2}
                    on:change={handleUpdateWallSegments}
                  />
                </div>
                <div class="field">
                  <label for="edit-seg3">Bottom Width (inches)</label>
                  <input
                    id="edit-seg3"
                    type="number"
                    step="0.5"
                    min="1"
                    bind:value={editSegment3}
                    on:change={handleUpdateWallSegments}
                  />
                </div>
              {/if}
              <div class="field">
                <label for="edit-rotation">Rotation (°)</label>
                <input
                  id="edit-rotation"
                  type="number"
                  step="15"
                  bind:value={editRotation}
                  on:change={handleUpdateRotation}
                />
              </div>
            {/if}
            <button class="danger" on:click={handleRemoveSelected}>
              Remove
            </button>
          </div>
        {:else}
          <p class="hint">Click a piece to select it</p>
        {/if}
      </CollapsibleSection>

      <!-- Save/Load Section -->
      <CollapsibleSection title="Layout">
        <div class="button-group vertical">
          <button on:click={openSaveModal}>Save Layout</button>
          <button on:click={openLoadModal} disabled={$savedLayoutsList.length === 0}>
            Load Layout
          </button>
          <div class="button-row">
            <button class="secondary small" on:click={handleExport}>Export</button>
            <button class="secondary small" on:click={handleImportClick}>Import</button>
          </div>
          <button class="secondary" on:click={handleClear}>Clear All</button>
        </div>
      </CollapsibleSection>

      <!-- Hidden file input for import -->
      <input
        type="file"
        accept=".json"
        bind:this={fileInput}
        on:change={handleFileSelect}
        style="display: none;"
      />
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
          {#each $layoutWalls as wall (wall.id)}
            <WallPiece
              id={wall.id}
              x={wall.x}
              y={wall.y}
              shape={wall.shape}
              segments={wall.segments}
              rotation={wall.rotation}
              selected={wall.id === $selectedWallId}
              {screenToSvg}
              onSelect={handleSelectWall}
              onDrag={handleDragWall}
              onRotate={handleRotateWall}
            />
          {/each}
        </Battlefield>
      </div>
      <div class="info">
        <p>Battlefield: 60" x 44" | {$layoutTerrains.length} terrain{$layoutTerrains.length !== 1 ? 's' : ''} | {$layoutWalls.length} wall{$layoutWalls.length !== 1 ? 's' : ''}</p>
        <p class="hint">Scroll to zoom | Space+drag or middle-click to pan | Double-click to reset view</p>
      </div>
    </div>
  </div>
</main>

<!-- Save Modal -->
{#if showSaveModal}
  <div class="modal-overlay" on:click={() => showSaveModal = false} role="presentation">
    <div class="modal" on:click|stopPropagation role="dialog">
      <h2>Save Layout</h2>
      <div class="modal-field">
        <label for="layout-name">Layout Name</label>
        <input
          id="layout-name"
          type="text"
          bind:value={saveLayoutName}
          placeholder="Enter a name..."
          on:keydown={(e) => e.key === 'Enter' && handleSave()}
        />
      </div>
      <div class="modal-actions">
        <button class="secondary" on:click={() => showSaveModal = false}>Cancel</button>
        <button on:click={handleSave} disabled={!saveLayoutName.trim()}>Save</button>
      </div>
    </div>
  </div>
{/if}

<!-- Load Modal -->
{#if showLoadModal}
  <div class="modal-overlay" on:click={() => showLoadModal = false} role="presentation">
    <div class="modal" on:click|stopPropagation role="dialog">
      <h2>Load Layout</h2>
      {#if $savedLayoutsList.length === 0}
        <p class="hint">No saved layouts yet</p>
      {:else}
        <div class="layout-list">
          {#each $savedLayoutsList as layout}
            <div class="layout-item" on:click={() => handleLoad(layout.name)} role="button" tabindex="0">
              <div class="layout-info">
                <span class="layout-name">{layout.name}</span>
                <span class="layout-meta">{layout.terrainCount} terrain{layout.terrainCount !== 1 ? 's' : ''}, {layout.wallCount || 0} wall{(layout.wallCount || 0) !== 1 ? 's' : ''} · {formatDate(layout.savedAt)}</span>
              </div>
              <button class="delete-btn" on:click={(e) => handleDeleteLayout(layout.name, e)} title="Delete">×</button>
            </div>
          {/each}
        </div>
      {/if}
      <div class="modal-actions">
        <button class="secondary" on:click={() => showLoadModal = false}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

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

  .button-row {
    display: flex;
    gap: 0.5rem;
  }

  .button-row button {
    flex: 1;
  }

  button.small {
    padding: 0.375rem 0.5rem;
    font-size: 0.8rem;
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

  .field label,
  .field .label-text {
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

  /* Modal Styles */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .modal {
    background: #252525;
    border-radius: 8px;
    padding: 1.5rem;
    min-width: 320px;
    max-width: 400px;
  }

  .modal h2 {
    margin: 0 0 1rem 0;
    font-size: 1.25rem;
    color: #e0e0e0;
  }

  .modal-field {
    margin-bottom: 1rem;
  }

  .modal-field label {
    display: block;
    font-size: 0.75rem;
    color: #888;
    margin-bottom: 0.25rem;
  }

  .modal-field input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #444;
    border-radius: 4px;
    background: #1a1a1a;
    color: #fff;
    font-size: 0.875rem;
    box-sizing: border-box;
  }

  .modal-field input:focus {
    outline: none;
    border-color: #3b82f6;
  }

  .modal-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
  }

  .layout-list {
    max-height: 300px;
    overflow-y: auto;
    margin-bottom: 1rem;
  }

  .layout-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem;
    background: #1a1a1a;
    border-radius: 4px;
    margin-bottom: 0.5rem;
    cursor: pointer;
    transition: background 0.15s;
  }

  .layout-item:hover {
    background: #333;
  }

  .layout-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .layout-name {
    color: #e0e0e0;
    font-weight: 500;
  }

  .layout-meta {
    font-size: 0.75rem;
    color: #666;
  }

  .delete-btn {
    padding: 0.25rem 0.5rem;
    background: transparent;
    border: none;
    color: #666;
    font-size: 1.25rem;
    cursor: pointer;
    line-height: 1;
  }

  .delete-btn:hover {
    color: #ef4444;
    background: transparent;
  }
</style>
