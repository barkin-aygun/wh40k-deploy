<script>
  import { createEventDispatcher } from 'svelte';
  import { stagingModels, stagingUnits, removeStagingUnit, clearStaging } from '../stores/staging.js';
  import ModelBase from './ModelBase.svelte';
  import UnitGroup from './UnitGroup.svelte';

  const dispatch = createEventDispatcher();

  let selectedModelIds = new Set();
  let svgElement;

  // Convert screen coordinates to SVG coordinates
  function screenToSvg(clientX, clientY) {
    if (!svgElement) return { x: 0, y: 0 };
    const point = svgElement.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const svgPoint = point.matrixTransform(svgElement.getScreenCTM().inverse());
    return { x: svgPoint.x, y: svgPoint.y };
  }

  function handleModelSelect(modelId) {
    selectedModelIds = new Set([modelId]);
  }

  function handleModelDrag(modelId, newX, newY) {
    stagingModels.update(models =>
      models.map(m => m.id === modelId ? { ...m, x: newX, y: newY } : m)
    );
  }

  function handleModelDragEnd(modelId) {
    // No history tracking in staging area
  }

  function handleModelRotate(modelId, newRotation) {
    stagingModels.update(models =>
      models.map(m => m.id === modelId ? { ...m, rotation: newRotation } : m)
    );
  }

  function handleModelRotateEnd(modelId) {
    // No history tracking in staging area
  }

  function handleModelRename(modelId, newName) {
    stagingModels.update(models =>
      models.map(m => m.id === modelId ? { ...m, unitName: newName } : m)
    );
  }

  function handleDeployAll() {
    dispatch('deploy', {
      modelIds: $stagingModels.map(m => m.id)
    });
  }

  function handleDeploySelected() {
    dispatch('deploy', {
      modelIds: Array.from(selectedModelIds)
    });
  }

  function handleClearStaging() {
    if (confirm('Clear all models from staging area?')) {
      clearStaging();
      dispatch('clear');
    }
  }

  function handleRemoveUnit(unitId) {
    if (confirm('Remove this unit from staging?')) {
      removeStagingUnit(unitId);
    }
  }

  function handleUnitClick(unitId) {
    const unit = $stagingUnits.find(u => u.id === unitId);
    if (unit) {
      selectedModelIds = new Set(unit.modelIds);
    }
  }
</script>

<div class="staging-area">
  <div class="staging-header">
    <h3>Staging Area</h3>
    <div class="button-group">
      <button on:click={handleDeploySelected} disabled={selectedModelIds.size === 0}>
        Deploy Selected ({selectedModelIds.size})
      </button>
      <button on:click={handleDeployAll} disabled={$stagingModels.length === 0}>
        Deploy All ({$stagingModels.length})
      </button>
      <button on:click={handleClearStaging} class="clear-button" disabled={$stagingModels.length === 0}>
        Clear
      </button>
    </div>
  </div>

  <div class="staging-canvas">
    <svg
      bind:this={svgElement}
      viewBox="0 0 30 60"
      class="staging-svg"
    >
      <!-- Background -->
      <rect x="0" y="0" width="30" height="60" fill="#1a1a1a" stroke="#444" stroke-width="0.1" />

      <!-- Grid -->
      {#each Array(16) as _, i}
        <line
          x1={i * 2}
          y1="0"
          x2={i * 2}
          y2="60"
          stroke="#2a2a2a"
          stroke-width="0.05"
        />
      {/each}
      {#each Array(31) as _, i}
        <line
          x1="0"
          y1={i * 2}
          x2="30"
          y2={i * 2}
          stroke="#2a2a2a"
          stroke-width="0.05"
        />
      {/each}

      <!-- Unit groupings -->
      {#each $stagingUnits as unit (unit.id)}
        <UnitGroup
          {unit}
          models={$stagingModels}
          selected={unit.modelIds.every(id => selectedModelIds.has(id))}
          onclick={() => handleUnitClick(unit.id)}
          onremove={() => handleRemoveUnit(unit.id)}
        />
      {/each}

      <!-- Models -->
      {#each $stagingModels as model (model.id)}
        <ModelBase
          id={model.id}
          x={model.x}
          y={model.y}
          baseType={model.baseType}
          playerId={model.playerId}
          rotation={model.rotation}
          name={model.name || model.unitName}
          customWidth={model.customWidth}
          customHeight={model.customHeight}
          selected={selectedModelIds.has(model.id)}
          {screenToSvg}
          onSelect={handleModelSelect}
          onDrag={handleModelDrag}
          onDragEnd={handleModelDragEnd}
          onRotate={handleModelRotate}
          onRotateEnd={handleModelRotateEnd}
          onRename={handleModelRename}
        />

        <!-- "STAGING" label overlay -->
        {#if model.inStaging}
          <text
            x={model.x}
            y={model.y - 1}
            text-anchor="middle"
            font-size="0.4"
            fill="#6c757d"
            font-weight="600"
            pointer-events="none"
          >
            STAGING
          </text>
        {/if}
      {/each}

      <!-- Instructions text -->
      {#if $stagingModels.length === 0}
        <text x="15" y="30" text-anchor="middle" font-size="0.8" fill="#666">
          No models in staging
        </text>
      {/if}
    </svg>
  </div>
</div>

<style>
  .staging-area {
    height: 100%;
    border: 2px solid #444;
    border-radius: 8px;
    background-color: #1a1a1a;
    display: flex;
    flex-direction: column;
  }

  .staging-header {
    padding: 0.75rem;
    background-color: #252525;
    border-bottom: 1px solid #444;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .staging-header h3 {
    margin: 0;
    font-size: 0.875rem;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .button-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  button {
    padding: 0.375rem 0.5rem;
    border: 1px solid #444;
    border-radius: 4px;
    background-color: #333;
    color: white;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }

  button:hover:not(:disabled) {
    background-color: #444;
    border-color: #555;
  }

  button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .clear-button {
    background-color: #7f1d1d;
    border-color: #991b1b;
  }

  .clear-button:hover:not(:disabled) {
    background-color: #991b1b;
  }

  .staging-canvas {
    flex: 1;
    overflow: auto;
    background-color: #0d0d0d;
  }

  .staging-svg {
    width: 100%;
    height: 100%;
  }
</style>
