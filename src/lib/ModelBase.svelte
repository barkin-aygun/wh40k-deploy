<script>
  import { getBaseSize, isOvalBase, isRectangularBase } from '../stores/models.js';

  export let id;
  export let x;
  export let y;
  export let baseType;
  export let playerId;
  export let rotation = 0;
  export let selected = false;
  export let name = '';
  export let customWidth = null;
  export let customHeight = null;
  export let screenToSvg;
  export let onSelect = () => {};
  export let onDrag = () => {};
  export let onDragEnd = () => {};
  export let onRotate = () => {};
  export let onRotateEnd = () => {};
  export let onRename = () => {};

  let isDragging = false;
  let isRotating = false;
  let dragOffset = { x: 0, y: 0 };
  let dragStartState = null;
  let rotateStartState = null;

  // Create a model object for getBaseSize
  $: modelObj = { customWidth, customHeight };
  $: baseSize = getBaseSize(baseType, modelObj);
  $: isOval = isOvalBase(baseType);
  $: isRect = isRectangularBase(baseType);
  $: playerColor = playerId === 1 ? '#3b82f6' : '#ef4444';
  $: playerFill = playerId === 1 ? 'rgba(59, 130, 246, 0.5)' : 'rgba(239, 68, 68, 0.5)';
  $: strokeWidth = selected ? 0.15 : 0.1;

  // For circles
  $: radius = baseSize?.radius || 0.5;

  // For ovals
  $: rx = baseSize?.width ? baseSize.width / 2 : 0;
  $: ry = baseSize?.height ? baseSize.height / 2 : 0;

  // For rectangles
  $: rectWidth = isRect ? (customWidth || 0) : 0;
  $: rectHeight = isRect ? (customHeight || 0) : 0;

  // Rotation handle position (for ovals and rectangles)
  $: handleDistance = isOval ? Math.max(rx, ry) + 1 : (isRect ? Math.max(rectWidth, rectHeight) / 2 + 1 : 0);
  $: handleX = x + handleDistance * Math.cos((rotation - 45) * Math.PI / 180);
  $: handleY = y + handleDistance * Math.sin((rotation - 45) * Math.PI / 180);

  // Drag ruler
  $: dragDistance = isDragging && dragStartState
    ? Math.sqrt(Math.pow(x - dragStartState.x, 2) + Math.pow(y - dragStartState.y, 2))
    : 0;
  $: dragMidX = isDragging && dragStartState ? (dragStartState.x + x) / 2 : 0;
  $: dragMidY = isDragging && dragStartState ? (dragStartState.y + y) / 2 : 0;

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

    // Capture starting position for history
    dragStartState = { x, y };

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
    if (isDragging && dragStartState) {
      // Only save to history if position actually changed
      if (dragStartState.x !== x || dragStartState.y !== y) {
        onDragEnd(id, dragStartState.x, dragStartState.y, x, y);
      }
      dragStartState = null;
    }

    isDragging = false;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }

  function handleRotateMouseDown(event) {
    event.preventDefault();
    event.stopPropagation();
    isRotating = true;

    // Capture starting rotation for history
    rotateStartState = rotation;

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
    if (isRotating && rotateStartState !== null) {
      // Only save to history if rotation actually changed
      if (rotateStartState !== rotation) {
        onRotateEnd(id, rotateStartState, rotation);
      }
      rotateStartState = null;
    }

    isRotating = false;
    window.removeEventListener('mousemove', handleRotateMouseMove);
    window.removeEventListener('mouseup', handleRotateMouseUp);
  }
</script>

<g class="model-base" class:selected class:dragging={isDragging}>
  {#if isRect}
    <!-- Rectangle base (vehicle hull) -->
    <g transform="rotate({rotation}, {x}, {y})">
      <rect
        x={x - rectWidth / 2}
        y={y - rectHeight / 2}
        width={rectWidth}
        height={rectHeight}
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
  {:else if isOval}
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

  <!-- Rotation handle (for ovals and rectangles when selected) -->
  {#if selected && (isOval || isRect)}
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

  <!-- Drag move ruler -->
  {#if isDragging && dragStartState && dragDistance > 0.1}
    <line
      x1={dragStartState.x}
      y1={dragStartState.y}
      x2={x}
      y2={y}
      stroke="#fbbf24"
      stroke-width="0.12"
      stroke-dasharray="0.3,0.15"
      pointer-events="none"
    />
    <circle
      cx={dragStartState.x}
      cy={dragStartState.y}
      r="0.25"
      fill="#fbbf24"
      pointer-events="none"
    />
    <text
      x={dragMidX}
      y={dragMidY - 0.5}
      text-anchor="middle"
      dominant-baseline="middle"
      font-size="0.5"
      font-weight="bold"
      fill="#fbbf24"
      stroke="#000"
      stroke-width="0.05"
      paint-order="stroke"
      pointer-events="none"
      class="drag-ruler-label"
    >
      {dragDistance.toFixed(2)}"
    </text>
  {/if}
</g>

<style>
  .model-base circle,
  .model-base ellipse,
  .model-base rect {
    cursor: grab;
  }
  .model-base.dragging circle,
  .model-base.dragging ellipse,
  .model-base.dragging rect {
    cursor: grabbing;
  }
  .model-base.selected circle,
  .model-base.selected ellipse,
  .model-base.selected rect {
    filter: drop-shadow(0 0 0.3px currentColor);
  }
  .rotate-handle {
    cursor: grab;
    filter: drop-shadow(0.05px 0.05px 0.1px rgba(0,0,0,0.5));
  }
  .drag-ruler-label {
    filter: drop-shadow(0.05px 0.05px 0.1px rgba(0,0,0,0.8));
  }
</style>
