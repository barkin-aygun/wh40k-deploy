<script>
  import Battlefield from '../lib/Battlefield.svelte';
  import UnitBase from '../lib/UnitBase.svelte';
  import TerrainFootprint from '../lib/TerrainFootprint.svelte';
  import { units, terrains, allWalls, allTerrainPolygons, debugMode } from '../stores/elements.js';
  import { checkLineOfSight } from '../lib/visibility/index.js';

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

  // Calculate line of sight between the two units
  $: losResult = $units.length >= 2
    ? checkLineOfSight($units[0], $units[1], $allTerrainPolygons, $allWalls)
    : { canSee: true, rays: [] };
</script>

<main>
  <div class="header">
    <h1>LOS Debug Mode</h1>
    <a href="#/" class="back-link">Back to Main</a>
  </div>
  <div class="controls">
    <label>
      <input type="checkbox" bind:checked={$debugMode} />
      Show debug rays
    </label>
    <span class="los-status" class:can-see={losResult.canSee} class:blocked={!losResult.canSee}>
      {losResult.canSee ? 'Can See' : 'Blocked'}
    </span>
  </div>
  <div class="battlefield-container">
    <Battlefield let:screenToSvg>
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

      <!-- Terrain pieces with L-walls -->
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

      <!-- Unit bases -->
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
    <p>Battlefield: 60" x 44" | Bases: 32mm | {$terrains.length} Terrain pieces (6" x 12" each)</p>
    <p class="hint">Drag to move | Orange handle to rotate (hold Shift for free rotation)</p>
  </div>
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 100vh;
    padding: 1rem;
    box-sizing: border-box;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 2rem;
    margin-bottom: 0.5rem;
  }

  h1 {
    margin: 0;
    font-size: 1.5rem;
    color: #e0e0e0;
  }

  .back-link {
    color: #888;
    text-decoration: none;
    font-size: 0.875rem;
  }

  .back-link:hover {
    color: #aaa;
    text-decoration: underline;
  }

  .controls {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    margin-bottom: 1rem;
  }

  .controls label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    color: #aaa;
  }

  .controls input[type="checkbox"] {
    cursor: pointer;
  }

  .los-status {
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
    font-weight: 600;
    font-size: 0.875rem;
  }

  .los-status.can-see {
    background: #22c55e33;
    color: #22c55e;
  }

  .los-status.blocked {
    background: #ef444433;
    color: #ef4444;
  }

  .battlefield-container {
    width: 100%;
    max-width: 1200px;
    aspect-ratio: 64 / 48;
    border: 2px solid #444;
    border-radius: 4px;
    overflow: hidden;
  }

  .info {
    margin-top: 1rem;
    color: #888;
    font-size: 0.875rem;
    text-align: center;
  }

  .info p {
    margin: 0;
  }

  .info .hint {
    margin-top: 0.5rem;
    font-style: italic;
    color: #666;
  }
</style>
