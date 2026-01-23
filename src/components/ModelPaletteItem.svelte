<script>
  export let baseSize;  // {type, radius or width/height, label}
  export let playerId;
  export let onDragStart = () => {};

  $: playerColor = playerId === 1 ? '#3b82f6' : '#ef4444';
  $: isOval = baseSize.width !== undefined;

  // Scale factors for preview (convert from inches to a reasonable pixel size)
  const PREVIEW_SCALE = 3; // Multiply inches by this for preview size

  $: previewRadius = isOval ? null : baseSize.radius * PREVIEW_SCALE;
  $: previewRx = isOval ? (baseSize.width / 2) * PREVIEW_SCALE : null;
  $: previewRy = isOval ? (baseSize.height / 2) * PREVIEW_SCALE : null;
  $: previewSize = isOval ? Math.max(baseSize.width, baseSize.height) * PREVIEW_SCALE : baseSize.radius * 2 * PREVIEW_SCALE;

  function handleMouseDown(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    onDragStart(baseSize, event);
  }
</script>

<button
  class="palette-item"
  style="border-color: {playerColor}"
  on:mousedown={handleMouseDown}
  title={baseSize.label}
>
  <svg width={previewSize + 8} height={previewSize + 8} viewBox="0 0 {previewSize + 8} {previewSize + 8}">
    {#if isOval}
      <ellipse
        cx={(previewSize + 8) / 2}
        cy={(previewSize + 8) / 2}
        rx={previewRx}
        ry={previewRy}
        fill="none"
        stroke={playerColor}
        stroke-width="2"
      />
    {:else}
      <circle
        cx={(previewSize + 8) / 2}
        cy={(previewSize + 8) / 2}
        r={previewRadius}
        fill="none"
        stroke={playerColor}
        stroke-width="2"
      />
    {/if}
  </svg>
  <span class="label">{baseSize.label}</span>
</button>

<style>
  .palette-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 8px;
    background: rgba(255, 255, 255, 0.05);
    border: 2px solid;
    border-radius: 4px;
    cursor: grab;
    transition: all 0.15s;
  }

  .palette-item:hover {
    background: rgba(255, 255, 255, 0.1);
    transform: translateY(-2px);
  }

  .palette-item:active {
    cursor: grabbing;
    transform: translateY(0);
  }

  .label {
    font-size: 11px;
    color: #fff;
    font-weight: 500;
  }

  svg {
    display: block;
  }
</style>
