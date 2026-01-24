<script>
  import { onMount } from 'svelte';
  import Battlefield from '../components/Battlefield.svelte';
  import CollapsibleSection from '../components/CollapsibleSection.svelte';
  import { DEPLOYMENT_PRESETS } from '../stores/deployment.js';
  import { savedLayoutsList, refreshSavedLayouts, TERRAIN_LAYOUT_CATEGORIES } from '../stores/layout.js';
  import { selectedDeployment, selectedLayoutName, selectedLayoutType, loadedTerrain } from '../stores/battlefieldSetup.js';

  onMount(() => {
    refreshSavedLayouts();
  });

  function handleSelectDeployment(preset) {
    selectedDeployment.set(preset);
  }

  function handleSelectPreset(preset) {
    selectedLayoutName.set(preset.name);
    selectedLayoutType.set('preset');
  }

  function handleSelectSavedLayout(name) {
    selectedLayoutName.set(name);
    selectedLayoutType.set('saved');
  }

  function handleClearLayout() {
    selectedLayoutName.set(null);
    selectedLayoutType.set(null);
  }

  function handleClearDeployment() {
    selectedDeployment.set(null);
  }
</script>

<main>
  <div class="layout">
    <div class="sidebar">
      <!-- Deployment Selection -->
      <CollapsibleSection title="Deployment">
        {#if $selectedDeployment}
          <div class="selected-item">
            <span class="selected-name">{$selectedDeployment.name}</span>
            <button class="small secondary" on:click={handleClearDeployment}>Change</button>
          </div>
        {:else}
          <div class="button-group">
            {#each DEPLOYMENT_PRESETS as preset}
              <button on:click={() => handleSelectDeployment(preset)}>
                {preset.name}
              </button>
            {/each}
          </div>
        {/if}
      </CollapsibleSection>

      <!-- Terrain Layout Selection -->
      <CollapsibleSection title="Terrain Layout">
        {#if $selectedLayoutName}
          <div class="selected-item">
            <span class="selected-name">{$selectedLayoutName}</span>
            <button class="small secondary" on:click={handleClearLayout}>Change</button>
          </div>
        {:else}
          <div class="layout-sections">
            {#each TERRAIN_LAYOUT_CATEGORIES as category}
              <div class="layout-group">
                <h4>{category.name}</h4>
                <div class="button-group">
                  {#each category.presets as preset}
                    <button on:click={() => handleSelectPreset(preset)}>
                      {preset.name}
                    </button>
                  {/each}
                </div>
              </div>
            {/each}
            {#if $savedLayoutsList.length > 0}
              <div class="layout-group">
                <h4>Saved</h4>
                <div class="button-group">
                  {#each $savedLayoutsList as layout}
                    <button on:click={() => handleSelectSavedLayout(layout.name)}>
                      {layout.name}
                    </button>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </CollapsibleSection>

      <!-- Summary -->
      <CollapsibleSection title="Summary">
        <div class="summary">
          <div class="summary-row">
            <span class="label">Deployment:</span>
            <span class="value">{$selectedDeployment?.name || 'None'}</span>
          </div>
          <div class="summary-row">
            <span class="label">Terrain:</span>
            <span class="value">{$selectedLayoutName || 'None'}</span>
          </div>
          {#if $selectedDeployment}
            <div class="summary-row">
              <span class="label">Objectives:</span>
              <span class="value">{$selectedDeployment.objectives.length}</span>
            </div>
          {/if}
          {#if $loadedTerrain.terrains.length > 0 || $loadedTerrain.walls.length > 0}
            <div class="summary-row">
              <span class="label">Pieces:</span>
              <span class="value">{$loadedTerrain.terrains.length} terrain, {$loadedTerrain.walls.length} walls</span>
            </div>
          {/if}
        </div>
      </CollapsibleSection>
    </div>

    <div class="battlefield-area">
      <div class="battlefield-container">
        <Battlefield
          deploymentZones={$selectedDeployment?.zones}
          objectives={$selectedDeployment?.objectives}
          terrains={$loadedTerrain.terrains}
          walls={$loadedTerrain.walls}
        />
      </div>
      <div class="info">
        <p>Battlefield: 60" x 44"</p>
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
    width: 220px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }


  .button-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 150px;
    overflow-y: auto;
  }

  .layout-sections {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .layout-group h4 {
    margin: 0 0 0.5rem 0;
    font-size: 0.75rem;
    color: #666;
    font-weight: 500;
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

  button.secondary {
    background: transparent;
    border-color: #555;
    color: #888;
  }

  button.secondary:hover {
    color: #fff;
    border-color: #666;
  }

  button.small {
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
  }

  .selected-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .selected-name {
    color: #3b82f6;
    font-weight: 500;
  }

  .summary {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .summary-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.875rem;
  }

  .summary-row .label {
    color: #888;
  }

  .summary-row .value {
    color: #ccc;
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
  }
</style>
