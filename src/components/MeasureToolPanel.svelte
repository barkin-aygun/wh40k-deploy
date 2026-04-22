<script>
  export let lineToolActive = false;
  export let show6InchZone = false;
  export let show9InchZone = false;
  export let show12InchZone = false;
  export let selectedLine = null;
  export let lineCount = 0;
  export let onDeleteSelectedLine = () => {};
  export let onClearAllLines = () => {};

  function lineLength(line) {
    const dx = line.x2 - line.x1;
    const dy = line.y2 - line.y1;
    return Math.sqrt(dx * dx + dy * dy).toFixed(2);
  }
</script>

<div class="edit-form">
  <div class="field">
    <label class="checkbox-label">
      <input type="checkbox" bind:checked={lineToolActive} />
      Line Tool Active (M)
    </label>
  </div>
  {#if lineToolActive}
    <p class="hint">Click and drag on battlefield to draw a measurement line</p>
  {/if}
  {#if selectedLine}
    <div class="field">
      <span class="label-text">Length</span>
      <span class="value">{lineLength(selectedLine)}"</span>
    </div>
    <button class="danger" on:click={onDeleteSelectedLine}>
      Remove Line
    </button>
  {/if}
  {#if lineCount > 0}
    <div class="field">
      <span class="label-text">Lines</span>
      <span class="value">{lineCount} line{lineCount !== 1 ? 's' : ''}</span>
    </div>
    <button class="secondary" on:click={onClearAllLines}>
      Clear All Lines
    </button>
  {/if}
  <div class="field" style="margin-top: 0.5rem; border-top: 1px solid #333; padding-top: 0.5rem;">
    <span class="label-text">Range Zones</span>
    <label class="checkbox-label">
      <input type="checkbox" bind:checked={show6InchZone} />
      Show 6" zones
    </label>
    <label class="checkbox-label">
      <input type="checkbox" bind:checked={show9InchZone} />
      Show 9" zones
    </label>
    <label class="checkbox-label">
      <input type="checkbox" bind:checked={show12InchZone} />
      Show 12" zones
    </label>
  </div>
</div>

<style>
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

  button {
    padding: 0.375rem 0.5rem;
    border: 1px solid #444;
    border-radius: 4px;
    background: #333;
    color: #fff;
    cursor: pointer;
    font-size: 0.8rem;
    transition: all 0.15s;
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
</style>
