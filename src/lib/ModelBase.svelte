<script>
  import { getBaseSize, isOvalBase } from '../stores/models.js';

  export let id;
  export let x;
  export let y;
  export let baseType;
  export let playerId;
  export let rotation = 0;
  export let selected = false;
  export let name = '';
  export let screenToSvg;
  export let onSelect = () => {};
  export let onDrag = () => {};
  export let onRotate = () => {};
  export let onRename = () => {};

  let isDragging = false;
  let isRotating = false;
  let dragOffset = { x: 0, y: 0 };

  $: baseSize = getBaseSize(baseType);
  $: isOval = isOvalBase(baseType);
  $: playerColor = playerId === 1 ? '#3b82f6' : '#ef4444';
  $: playerFill = playerId === 1 ? 'rgba(59, 130, 246, 0.5)' : 'rgba(239, 68, 68, 0.5)';
  $: strokeWidth = selected ? 0.15 : 0.1;

  // For circles
  $: radius = baseSize?.radius || 0.5;

  // For ovals
  $: rx = baseSize?.width ? baseSize.width / 2 : 0;
  $: ry = baseSize?.height ? baseSize.height / 2 : 0;

  // Rotation handle position (for ovals)
  $: handleDistance = isOval ? Math.max(rx, ry) + 1 : 0;
  $: handleX = x + handleDistance * Math.cos((rotation - 45) * Math.PI / 180);
  $: handleY = y + handleDistance * Math.sin((rotation - 45) * Math.PI / 180);

  function handleClick(event) {
    event.stopPropagation();
    onSelect(id);
  }

  function handleDoubleClick(event) {
    event.stopPropagation();
    const newName = prompt('Model name:', name);
    if (newName !== null) {
      onRename(id, newName);
    }
  }

  function handleMouseDown(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    onSelect(id);
    isDragging = true;

    const svgCoords = screenToSvg(event.clientX, event.clientY);
    dragOffset = { x: svgCoords.x - x, y: svgCoords.y - y };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }

  function handleMouseMove(event) {
    if (!isDragging) return;
    const svgCoords = screenToSvg(event.clientX, event.clientY);

    let newX = svgCoords.x - dragOffset.x;
    let newY = svgCoords.y - dragOffset.y;

    // No battlefield constraints - models can be dragged anywhere
    onDrag(id, newX, newY);
  }

  function handleMouseUp() {
    isDragging = false;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }

  function handleRotateMouseDown(event) {
    event.preventDefault();
    event.stopPropagation();
    isRotating = true;

    window.addEventListener('mousemove', handleRotateMouseMove);
    window.addEventListener('mouseup', handleRotateMouseUp);
  }

  function handleRotateMouseMove(event) {
    if (!isRotating) return;
    const svgCoords = screenToSvg(event.clientX, event.clientY);

    const dx = svgCoords.x - x;
    const dy = svgCoords.y - y;
    let angle = Math.atan2(dy, dx) * 180 / Math.PI + 45;

    if (!event.shiftKey) {
      angle = Math.round(angle / 15) * 15;
    }

    onRotate(id, angle);
  }

  function handleRotateMouseUp() {
    isRotating = false;
    window.removeEventListener('mousemove', handleRotateMouseMove);
    window.removeEventListener('mouseup', handleRotateMouseUp);
  }
</script>

<g class="model-base" class:selected class:dragging={isDragging}>
  {#if isOval}
    <!-- Oval base (ellipse) -->
    <g transform="rotate({rotation}, {x}, {y})">
      <ellipse
        cx={x}
        cy={y}
        {rx}
        {ry}
        fill={selected ? playerColor : playerFill}
        stroke={playerColor}
        stroke-width={strokeWidth}
        on:click={handleClick}
        on:dblclick={handleDoubleClick}
        on:mousedown={handleMouseDown}
        role="button"
        tabindex="0"
      />
    </g>
  {:else}
    <!-- Circle base -->
    <circle
      cx={x}
      cy={y}
      r={radius}
      fill={selected ? playerColor : playerFill}
      stroke={playerColor}
      stroke-width={strokeWidth}
      on:click={handleClick}
      on:dblclick={handleDoubleClick}
      on:mousedown={handleMouseDown}
      role="button"
      tabindex="0"
    />
  {/if}

  <!-- Name text with background -->
  {#if name}
    <text
      x={x}
      y={y}
      text-anchor="middle"
      dominant-baseline="middle"
      font-size="0.4"
      font-weight="bold"
      fill="white"
      pointer-events="none"
      class="model-name"
    >
      {name}
    </text>
  {/if}

  <!-- Rotation handle (only for ovals when selected) -->
  {#if selected && isOval}
    <line
      x1={x}
      y1={y}
      x2={handleX}
      y2={handleY}
      stroke={playerColor}
      stroke-width="0.08"
      stroke-dasharray="0.2,0.1"
    />
    <circle
      cx={handleX}
      cy={handleY}
      r="0.6"
      fill={playerColor}
      stroke={playerId === 1 ? '#1d4ed8' : '#b91c1c'}
      stroke-width="0.08"
      on:mousedown={handleRotateMouseDown}
      role="button"
      tabindex="0"
      class="rotate-handle"
    />
  {/if}
</g>

<style>
  .model-base circle,
  .model-base ellipse {
    cursor: grab;
  }
  .model-base.dragging circle,
  .model-base.dragging ellipse {
    cursor: grabbing;
  }
  .model-base.selected circle,
  .model-base.selected ellipse {
    filter: drop-shadow(0 0 0.3px currentColor);
  }
  .rotate-handle {
    cursor: grab;
    filter: drop-shadow(0.05px 0.05px 0.1px rgba(0,0,0,0.5));
  }
</style>
