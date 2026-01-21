<script>
  export let unit;
  export let models = [];
  export let selected = false;
  export let onclick = () => {};
  export let onremove = () => {};

  $: unitModels = models.filter(m => unit.modelIds.includes(m.id));

  // Calculate bounding box for the unit
  $: bounds = calculateBounds(unitModels);

  function calculateBounds(models) {
    if (models.length === 0) {
      return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
    }

    const positions = models.map(m => ({ x: m.x, y: m.y }));
    const minX = Math.min(...positions.map(p => p.x)) - 0.5;
    const minY = Math.min(...positions.map(p => p.y)) - 0.5;
    const maxX = Math.max(...positions.map(p => p.x)) + 0.5;
    const maxY = Math.max(...positions.map(p => p.y)) + 0.5;

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY
    };
  }

  $: labelX = bounds.minX + bounds.width / 2;
  $: labelY = bounds.minY - 0.3;
</script>

{#if unitModels.length > 0}
  <g class="unit-group">
    <!-- Bounding box -->
    <rect
      x={bounds.minX}
      y={bounds.minY}
      width={bounds.width}
      height={bounds.height}
      fill="none"
      stroke={selected ? '#ffc107' : '#adb5bd'}
      stroke-width={selected ? '0.15' : '0.08'}
      stroke-dasharray="0.3 0.2"
      opacity="0.6"
      cursor="pointer"
      on:click={onclick}
    />

    <!-- Unit label -->
    <text
      x={labelX}
      y={labelY}
      text-anchor="middle"
      font-size="0.5"
      font-weight="600"
      fill={selected ? '#333' : '#6c757d'}
      pointer-events="none"
    >
      {unit.name} ({unitModels.length})
    </text>

    <!-- Remove button (small X in top-right corner) -->
    <g
      class="remove-button"
      cursor="pointer"
      on:click={(e) => {
        e.stopPropagation();
        onremove();
      }}
    >
      <circle
        cx={bounds.maxX - 0.3}
        cy={bounds.minY + 0.3}
        r="0.25"
        fill="#dc3545"
        opacity="0.8"
      />
      <line
        x1={bounds.maxX - 0.4}
        y1={bounds.minY + 0.2}
        x2={bounds.maxX - 0.2}
        y2={bounds.minY + 0.4}
        stroke="white"
        stroke-width="0.08"
      />
      <line
        x1={bounds.maxX - 0.2}
        y1={bounds.minY + 0.2}
        x2={bounds.maxX - 0.4}
        y2={bounds.minY + 0.4}
        stroke="white"
        stroke-width="0.08"
      />
    </g>
  </g>
{/if}

<style>
  .remove-button:hover circle {
    opacity: 1;
  }
</style>
