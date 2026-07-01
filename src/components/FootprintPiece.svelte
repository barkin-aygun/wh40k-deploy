<script>
  import { BATTLEFIELD } from '../stores/elements.js';
  import { getFootprintVertices } from '../stores/layout.js';
  import { COLORS } from '../lib/colors.js';

  export let id;
  export let x;
  export let y;
  export let shapeId;
  export let rotation = 0;
  export let objectiveGroup = null;
  export let selected = false;
  export let screenToSvg;
  export let onSelect = () => {};
  export let onDrag = () => {};
  export let onRotate = () => {};

  function getBoundingBox(vertices) {
    const xs = vertices.map(v => v.x);
    const ys = vertices.map(v => v.y);
    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys)
    };
  }

  $: vertices = getFootprintVertices(shapeId);
  $: bounds = getBoundingBox(vertices);
  $: fpWidth = bounds.maxX - bounds.minX;
  $: fpHeight = bounds.maxY - bounds.minY;

  // Center point for rotation
  $: centerX = x + bounds.minX + fpWidth / 2;
  $: centerY = y + bounds.minY + fpHeight / 2;

  // Convert vertices to SVG path
  $: pathD = vertices.length > 0
    ? `M ${vertices.map(v => `${x + v.x},${y + v.y}`).join(' L ')} Z`
    : '';

  // Rotation handle position
  $: handleDistance = Math.max(fpWidth, fpHeight) / 2 + 1.5;
  $: handleX = centerX + handleDistance * Math.cos((rotation - 45) * Math.PI / 180);
  $: handleY = centerY + handleDistance * Math.sin((rotation - 45) * Math.PI / 180);

  let isDragging = false;
  let isRotating = false;
  let dragOffset = { x: 0, y: 0 };

  function handleClick(event) {
    event.stopPropagation();
    onSelect(id);
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

    // Snap to a half-inch grid (finer than the visible 1" grid) unless Shift is held
    if (!event.shiftKey) {
      newX = Math.round(newX * 2) / 2;
      newY = Math.round(newY * 2) / 2;
    }

    // Constrain to battlefield (with some margin for rotation)
    const margin = Math.max(fpWidth, fpHeight);
    newX = Math.max(-margin, Math.min(BATTLEFIELD.width + margin - fpWidth, newX));
    newY = Math.max(-margin, Math.min(BATTLEFIELD.height + margin - fpHeight, newY));

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

    const dx = svgCoords.x - centerX;
    const dy = svgCoords.y - centerY;
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

<g class="footprint-piece" class:selected class:dragging={isDragging}>
  <g transform="rotate({rotation}, {centerX}, {centerY})">
    <path
      d={pathD}
      fill={selected ? COLORS.footprint.fillSelected : COLORS.footprint.fill}
      stroke={selected ? COLORS.selection.highlight : COLORS.footprint.stroke}
      stroke-width={selected ? 0.15 : 0.1}
      on:click={handleClick}
      on:mousedown={handleMouseDown}
      role="button"
      tabindex="0"
    />
    {#if objectiveGroup}
      <path
        d={pathD}
        fill={COLORS.footprint.objectiveFill}
        stroke={COLORS.footprint.objectiveStroke}
        stroke-width="0.18"
        stroke-dasharray="0.4,0.2"
        pointer-events="none"
      />
    {/if}
  </g>

  <!-- Objective number label (rendered outside the rotated group so it stays upright;
       centerX/centerY is the rotation pivot, so its position is invariant to rotation) -->
  {#if objectiveGroup}
    <circle
      cx={centerX}
      cy={centerY}
      r="0.9"
      fill={COLORS.footprint.objectiveStroke}
      stroke={COLORS.ui.black}
      stroke-width="0.08"
      pointer-events="none"
    />
    <text
      x={centerX}
      y={centerY}
      text-anchor="middle"
      dominant-baseline="central"
      class="objective-label"
      pointer-events="none"
    >{objectiveGroup}</text>
  {/if}

  <!-- Rotation handle (only show when selected) -->
  {#if selected}
    <line
      x1={centerX}
      y1={centerY}
      x2={handleX}
      y2={handleY}
      stroke={COLORS.selection.highlight}
      stroke-width="0.08"
      stroke-dasharray="0.2,0.1"
    />
    <circle
      cx={handleX}
      cy={handleY}
      r="0.6"
      fill={COLORS.selection.highlight}
      stroke={COLORS.selection.highlightDark}
      stroke-width="0.08"
      on:mousedown={handleRotateMouseDown}
      role="button"
      tabindex="0"
      class="rotate-handle"
    />
  {/if}
</g>

<style>
  .footprint-piece path {
    cursor: grab;
  }
  .footprint-piece.dragging path {
    cursor: grabbing;
  }
  .footprint-piece.selected path {
    filter: drop-shadow(0 0 0.3px #3b82f6);
  }
  .rotate-handle {
    cursor: grab;
    filter: drop-shadow(0.05px 0.05px 0.1px rgba(0,0,0,0.5));
  }
  .objective-label {
    font-size: 1px;
    font-weight: 700;
    fill: #000;
    font-family: system-ui, -apple-system, sans-serif;
    user-select: none;
  }
</style>
