<script>
  import { onMount } from 'svelte';
  import Battlefield from '../components/Battlefield.svelte';
  import CollapsibleSection from '../components/CollapsibleSection.svelte';
  import {
    layoutTerrains,
    layoutFootprints,
    layoutWalls,
    selectedTerrainId,
    selectedFootprintId,
    selectedWallId,
    FOOTPRINT_SHAPES,
    WALL_SHAPES,
    saveLayout,
    loadLayout,
    deleteLayout,
    savedLayoutsList,
    refreshSavedLayouts
  } from '../stores/layout.js';
  import { DEPLOYMENT_PRESETS } from '../stores/deployment.js';

  let battlefieldComponent;
  let saveLayoutName = '';
  let fileInputRef;

  // Deployment zone overlay (reference only, for aligning terrain with a mission's zones)
  let overlayDeploymentName = '';
  $: overlayDeployment = DEPLOYMENT_PRESETS.find(p => p.name === overlayDeploymentName) || null;

  onMount(() => {
    refreshSavedLayouts();
  });

  // Terrain handlers (kept for editing terrain loaded from presets)
  function handleSelectTerrain(id) {
    selectedTerrainId.set(id);
    selectedFootprintId.set(null);
    selectedWallId.set(null);
  }

  function handleDragTerrain(id, x, y) {
    layoutTerrains.updateTerrain(id, { x, y });
  }

  function handleRotateTerrain(id, rotation) {
    layoutTerrains.updateTerrain(id, { rotation });
  }

  function handleDeleteTerrain() {
    if ($selectedTerrainId) {
      layoutTerrains.remove($selectedTerrainId);
      selectedTerrainId.set(null);
    }
  }

  // Footprint handlers
  function handleAddFootprint(shapeId) {
    layoutFootprints.add(shapeId);
  }

  function handleSelectFootprint(id) {
    selectedFootprintId.set(id);
    selectedTerrainId.set(null);
    selectedWallId.set(null);
  }

  function handleDragFootprint(id, x, y) {
    layoutFootprints.updateFootprint(id, { x, y });
  }

  function handleRotateFootprint(id, rotation) {
    layoutFootprints.updateFootprint(id, { rotation });
  }

  function handleFlipFootprint() {
    if (!$selectedFootprintId) return;
    const footprint = $layoutFootprints.find(f => f.id === $selectedFootprintId);
    layoutFootprints.updateFootprint($selectedFootprintId, { flipped: !footprint?.flipped });
  }

  function handleDeleteFootprint() {
    if ($selectedFootprintId) {
      layoutFootprints.remove($selectedFootprintId);
      selectedFootprintId.set(null);
    }
  }

  // Objective tagging — a footprint (or several sharing the same group, e.g. the two
  // ruin triangles combined into a rectangle) can be marked as a single objective.
  let joinObjectiveGroup = '';

  function nextObjectiveGroup() {
    const groups = $layoutFootprints.map(f => f.objectiveGroup).filter(Boolean);
    return groups.length ? Math.max(...groups) + 1 : 1;
  }

  function handleMarkNewObjective() {
    if (!$selectedFootprintId) return;
    layoutFootprints.updateFootprint($selectedFootprintId, { objectiveGroup: nextObjectiveGroup() });
  }

  function handleJoinObjective() {
    if (!$selectedFootprintId || !joinObjectiveGroup) return;
    layoutFootprints.updateFootprint($selectedFootprintId, { objectiveGroup: parseInt(joinObjectiveGroup, 10) });
    joinObjectiveGroup = '';
  }

  function handleUnmarkObjective() {
    if (!$selectedFootprintId) return;
    layoutFootprints.updateFootprint($selectedFootprintId, { objectiveGroup: null });
  }

  // Wall handlers (AB/CD/EF/GH ruin walls, placed on top of footprints)
  function handleAddWall(shape) {
    layoutWalls.add(shape);
  }

  function handleSelectWall(id) {
    selectedWallId.set(id);
    selectedTerrainId.set(null);
    selectedFootprintId.set(null);
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

  function handleBackgroundClick() {
    selectedTerrainId.set(null);
    selectedFootprintId.set(null);
    selectedWallId.set(null);
  }

  // Clear all
  function handleClearAll() {
    if (confirm('Clear all footprints and walls?')) {
      layoutTerrains.clear();
      layoutFootprints.clear();
      layoutWalls.clear();
      selectedTerrainId.set(null);
      selectedFootprintId.set(null);
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
      version: 2,
      exportedAt: new Date().toISOString(),
      terrains: $layoutTerrains,
      footprints: $layoutFootprints,
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
        if (layout.footprints && Array.isArray(layout.footprints)) {
          layoutFootprints.set(layout.footprints);
        }
        if (layout.walls && Array.isArray(layout.walls)) {
          layoutWalls.set(layout.walls);
        }
        selectedTerrainId.set(null);
        selectedFootprintId.set(null);
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
      } else if ($selectedFootprintId) {
        handleDeleteFootprint();
      } else if ($selectedWallId) {
        handleDeleteWall();
      }
    }

    // Escape - deselect
    if (event.key === 'Escape') {
      selectedTerrainId.set(null);
      selectedFootprintId.set(null);
      selectedWallId.set(null);
    }

    // Flip selected footprint
    if ((event.key === 'f' || event.key === 'F') && $selectedFootprintId) {
      event.preventDefault();
      handleFlipFootprint();
    }
  }

  $: selectedFootprint = $layoutFootprints.find(f => f.id === $selectedFootprintId);
  $: existingObjectiveGroups = [...new Set(
      $layoutFootprints
        .map(f => f.objectiveGroup)
        .filter(g => g && g !== selectedFootprint?.objectiveGroup)
    )].sort((a, b) => a - b);
</script>

<svelte:window on:keydown={handleKeyDown} />

<main>
  <div class="layout">
    <div class="sidebar">
      <!-- Deployment Overlay Section -->
      <CollapsibleSection title="Deployment Overlay">
        <select class="deployment-select" bind:value={overlayDeploymentName}>
          <option value="">None</option>
          {#each DEPLOYMENT_PRESETS as preset}
            <option value={preset.name}>{preset.name}</option>
          {/each}
        </select>
        <p class="hint">Reference only — overlays zones for aligning terrain</p>
      </CollapsibleSection>

      <!-- Add Footprint Section -->
      <CollapsibleSection title="Add Footprint">
        <div class="button-group">
          {#each FOOTPRINT_SHAPES as fp}
            <button on:click={() => handleAddFootprint(fp.id)}>
              {fp.label} <span class="layout-meta">×{fp.quantity}</span>
            </button>
          {/each}
        </div>
      </CollapsibleSection>

      <!-- Footprint Section (only when a footprint is selected) -->
      {#if selectedFootprint}
        <CollapsibleSection title="Footprint">
          <button on:click={handleFlipFootprint}>
            {selectedFootprint.flipped ? 'Unflip' : 'Flip'} <span class="layout-meta">(F)</span>
          </button>
          <p class="hint">Mirrors the piece in place — its snapped corner stays put</p>
        </CollapsibleSection>
      {/if}

      <!-- Objective Tagging Section (only when a footprint is selected) -->
      {#if selectedFootprint}
        <CollapsibleSection title="Objective">
          {#if selectedFootprint.objectiveGroup}
            <div class="field">
              <span class="label">Status</span>
              <span class="value">Objective {selectedFootprint.objectiveGroup}</span>
            </div>
            <button class="secondary" on:click={handleUnmarkObjective}>Remove from Objective</button>
          {:else}
            <button on:click={handleMarkNewObjective}>Mark as New Objective</button>
            {#if existingObjectiveGroups.length > 0}
              <div class="join-row">
                <select bind:value={joinObjectiveGroup} class="deployment-select">
                  <option value="">Combine with…</option>
                  {#each existingObjectiveGroups as g}
                    <option value={g}>Objective {g}</option>
                  {/each}
                </select>
                <button on:click={handleJoinObjective} disabled={!joinObjectiveGroup}>Join</button>
              </div>
            {/if}
          {/if}
          <p class="hint">Combine pieces (e.g. the two ruin triangles) into one objective</p>
        </CollapsibleSection>
      {/if}

      <!-- Add Wall Section (AB/CD/EF/GH ruin walls) -->
      <CollapsibleSection title="Add Wall">
        <div class="button-group">
          {#each WALL_SHAPES as wallShape}
            <button on:click={() => handleAddWall(wallShape.shape)}>
              {wallShape.label}
            </button>
          {/each}
        </div>
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
                    <span class="layout-meta">{layout.footprintCount ?? 0}F {layout.wallCount}W</span>
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
          deploymentZones={overlayDeployment?.zones}
          territoryDivider={overlayDeployment?.territory}
          objectives={overlayDeployment?.objectives}
          terrains={$layoutTerrains}
          footprints={$layoutFootprints}
          walls={$layoutWalls}
          models={[]}
          interactiveTerrain={true}
          interactiveFootprints={true}
          interactiveWalls={true}
          panOnDrag={true}
          selectedTerrainId={$selectedTerrainId}
          selectedFootprintId={$selectedFootprintId}
          selectedWallId={$selectedWallId}
          onTerrainSelect={handleSelectTerrain}
          onTerrainDrag={handleDragTerrain}
          onTerrainRotate={handleRotateTerrain}
          onFootprintSelect={handleSelectFootprint}
          onFootprintDrag={handleDragFootprint}
          onFootprintRotate={handleRotateFootprint}
          onWallSelect={handleSelectWall}
          onWallDrag={handleDragWall}
          onWallRotate={handleRotateWall}
          onBackgroundClick={handleBackgroundClick}
        />
      </div>
      <div class="info">
        <p>Battlefield: 60" × 44" | {$layoutFootprints.length} footprints | {$layoutWalls.length} walls</p>
        <p class="hint">Del to remove | F to flip footprint | Scroll to zoom | Click-drag empty area to pan | Shift+drag for fine rotation</p>
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

  .hint {
    color: #666;
    font-size: 0.8rem;
    font-style: italic;
    margin: 0;
  }

  .deployment-select {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #444;
    border-radius: 4px;
    background: #2a2a2a;
    color: #fff;
    font-size: 0.875rem;
    margin-bottom: 0.5rem;
  }

  .deployment-select:focus {
    outline: none;
    border-color: #666;
  }

  .field {
    display: flex;
    justify-content: space-between;
    font-size: 0.875rem;
    margin-bottom: 0.5rem;
  }

  .field .label {
    color: #888;
  }

  .field .value {
    color: #d4af37;
    font-weight: 600;
  }

  .join-row {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .join-row .deployment-select {
    margin-bottom: 0;
  }

  .join-row button {
    flex-shrink: 0;
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
