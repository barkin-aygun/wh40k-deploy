<script>
  import { onMount } from 'svelte';
  import Battlefield from '../lib/Battlefield.svelte';
  import CollapsibleSection from '../lib/CollapsibleSection.svelte';
  import { DEPLOYMENT_PRESETS, pathToSvgD, OBJECTIVE_RADIUS, OBJECTIVE_CONTROL_RADIUS } from '../stores/deployment.js';
  import { savedLayoutsList, refreshSavedLayouts, TERRAIN_LAYOUT_PRESETS } from '../stores/layout.js';
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

  // Get wall vertices for rendering
  function getWallPath(wall) {
    const t = 0.5; // wall thickness
    let vertices = [];

    switch (wall.shape) {
      case 'L-4x8':
        vertices = [
          { x: 0, y: 0 }, { x: t, y: 0 }, { x: t, y: 8 - t },
          { x: 4, y: 8 - t }, { x: 4, y: 8 }, { x: 0, y: 8 }
        ];
        break;
      case 'L-4x8-mirror':
        vertices = [
          { x: 0, y: 0 }, { x: t, y: 0 }, { x: t, y: 8 },
          { x: -4 + t, y: 8 }, { x: -4 + t, y: 8 - t }, { x: 0, y: 8 - t }
        ];
        break;
      case 'C-4-8-4':
        vertices = [
          { x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: t }, { x: t, y: t },
          { x: t, y: 8 - t }, { x: 4, y: 8 - t }, { x: 4, y: 8 }, { x: 0, y: 8 }
        ];
        break;
      case 'L-5x6':
        vertices = [
          { x: 0, y: 0 }, { x: t, y: 0 }, { x: t, y: 6 - t },
          { x: 5, y: 6 - t }, { x: 5, y: 6 }, { x: 0, y: 6 }
        ];
        break;
      case 'L-5x6-mirror':
        vertices = [
          { x: 0, y: 0 }, { x: t, y: 0 }, { x: t, y: 6 },
          { x: -5 + t, y: 6 }, { x: -5 + t, y: 6 - t }, { x: 0, y: 6 - t }
        ];
        break;
      case 'L-4x6':
        vertices = [
          { x: 0, y: 0 }, { x: t, y: 0 }, { x: t, y: 6 - t },
          { x: 4, y: 6 - t }, { x: 4, y: 6 }, { x: 0, y: 6 }
        ];
        break;
      case 'L-4x6-mirror':
        vertices = [
          { x: 0, y: 0 }, { x: t, y: 0 }, { x: t, y: 6 },
          { x: -4 + t, y: 6 }, { x: -4 + t, y: 6 - t }, { x: 0, y: 6 - t }
        ];
        break;
      default:
        return '';
    }

    return `M ${vertices.map(v => `${wall.x + v.x},${wall.y + v.y}`).join(' L ')} Z`;
  }

  function getWallCenter(wall) {
    const t = 0.5;
    switch (wall.shape) {
      case 'L-4x8': return { x: wall.x + 2, y: wall.y + 4 };
      case 'L-4x8-mirror': return { x: wall.x - 2 + t, y: wall.y + 4 };
      case 'C-4-8-4': return { x: wall.x + 2, y: wall.y + 4 };
      case 'L-5x6': return { x: wall.x + 2.5, y: wall.y + 3 };
      case 'L-5x6-mirror': return { x: wall.x - 2.5 + t, y: wall.y + 3 };
      case 'L-4x6': return { x: wall.x + 2, y: wall.y + 3 };
      case 'L-4x6-mirror': return { x: wall.x - 2 + t, y: wall.y + 3 };
      default: return { x: wall.x, y: wall.y };
    }
  }
</script>

<main>
  <div class="header">
    <h1>Battlefield Setup</h1>
    <nav class="nav-links">
      <a href="#/setup" class="active">Battlefield Setup</a>
      <a href="#/deployment">Deployment</a>
      <a href="#/">Layout Builder</a>
      <a href="#/debug">Debug Mode</a>
    </nav>
  </div>

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
            <div class="layout-group">
              <h4>Presets</h4>
              <div class="button-group">
                {#each TERRAIN_LAYOUT_PRESETS as preset}
                  <button on:click={() => handleSelectPreset(preset)}>
                    {preset.name}
                  </button>
                {/each}
              </div>
            </div>
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
        <Battlefield>
          <!-- Deployment zones -->
          {#if $selectedDeployment}
            {#each $selectedDeployment.zones as zone}
              <path
                d={pathToSvgD(zone.path)}
                fill={zone.color}
                stroke={zone.borderColor}
                stroke-width="0.10"
                stroke-dasharray="0.5,0.25"
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
              />
              <circle
                cx={obj.x}
                cy={obj.y}
                r={OBJECTIVE_RADIUS}
                fill={markerColor}
                stroke="#000"
                stroke-width="0.06"
              />
              <circle
                cx={obj.x}
                cy={obj.y}
                r="0.15"
                fill="#000"
              />
            {/each}
          {/if}

          <!-- Terrain pieces -->
          {#each $loadedTerrain.terrains as terrain}
            {@const centerX = terrain.x + terrain.width / 2}
            {@const centerY = terrain.y + terrain.height / 2}
            <g transform="rotate({terrain.rotation}, {centerX}, {centerY})">
              <rect
                x={terrain.x}
                y={terrain.y}
                width={terrain.width}
                height={terrain.height}
                fill="rgba(139, 90, 43, 0.6)"
                stroke="#8b5a2b"
                stroke-width="0.1"
              />
            </g>
          {/each}

          <!-- Wall pieces -->
          {#each $loadedTerrain.walls as wall}
            {@const center = getWallCenter(wall)}
            <g transform="rotate({wall.rotation}, {center.x}, {center.y})">
              <path
                d={getWallPath(wall)}
                fill="rgba(139, 69, 19, 0.8)"
                stroke="#5c3317"
                stroke-width="0.1"
              />
            </g>
          {/each}
        </Battlefield>
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
