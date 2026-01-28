<script>
  import { BATTLEFIELD } from '../stores/elements.js';
  import { COLORS } from '../lib/colors.js';
  import { isTouchDevice } from '../lib/touch.js';

  export let id;
  export let x;
  export let y;
  export let width;
  export let height;
  export let rotation = 0;
  export let selected = false;
  export let screenToSvg;
  export let onSelect = () => {};
  export let onDrag = () => {};
  export let onRotate = () => {};

  let isDragging = false;
  let isRotating = false;
  let dragOffset = { x: 0, y: 0 };

  $: centerX = x + width / 2;
  $: centerY = y + height / 2;

  // Larger handles for touch
  $: handleRadius = isTouchDevice() ? 1.0 : 0.6;

  // Rotation handle position
  $: handleDistance = Math.max(width, height) / 2 + 1.5;
  $: handleX = centerX + handleDistance * Math.cos((rotation - 45) * Math.PI / 180);
  $: handleY = centerY + handleDistance * Math.sin((rotation - 45) * Math.PI / 180);

  function handleClick(event) {
    event.stopPropagation();
    onSelect(id);
  }

  function handlePointerDown(event) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    // Capture pointer for reliable tracking
    event.target.setPointerCapture(event.pointerId);

    onSelect(id);
    isDragging = true;

    const svgCoords = screenToSvg(event.clientX, event.clientY);
    dragOffset = { x: svgCoords.x - x, y: svgCoords.y - y };
  }

  function handlePointerMove(event) {
    if (!isDragging) return;
    const svgCoords = screenToSvg(event.clientX, event.clientY);

    let newX = svgCoords.x - dragOffset.x;
    let newY = svgCoords.y - dragOffset.y;

    // Snap to grid (1 inch) unless Shift is held or on touch device
    if (!event.shiftKey && !isTouchDevice()) {
      newX = Math.round(newX);
      newY = Math.round(newY);
    }

    // Constrain to battlefield
    const margin = Math.max(width, height) / 2;
    newX = Math.max(-margin, Math.min(BATTLEFIELD.width - width + margin, newX));
    newY = Math.max(-margin, Math.min(BATTLEFIELD.height - height + margin, newY));

    onDrag(id, newX, newY);
  }

  function handlePointerUp(event) {
    event.target.releasePointerCapture(event.pointerId);
    isDragging = false;
  }

  function handleRotatePointerDown(event) {
    event.preventDefault();
    event.stopPropagation();

    // Capture pointer for reliable tracking
    event.target.setPointerCapture(event.pointerId);

    isRotating = true;
  }

  function handleRotatePointerMove(event) {
    if (!isRotating) return;
    const svgCoords = screenToSvg(event.clientX, event.clientY);

    const dx = svgCoords.x - centerX;
    const dy = svgCoords.y - centerY;
    let angle = Math.atan2(dy, dx) * 180 / Math.PI + 45;

    // Snap to 15 degrees unless on touch device
    if (!event.shiftKey && !isTouchDevice()) {
      angle = Math.round(angle / 15) * 15;
    }

    onRotate(id, angle);
  }

  function handleRotatePointerUp(event) {
    event.target.releasePointerCapture(event.pointerId);
    isRotating = false;
  }
</script>

<g class="terrain-rect" class:selected class:dragging={isDragging}>
  <g transform="rotate({rotation}, {centerX}, {centerY})">
    <rect
      {x}
      {y}
      {width}
      {height}
      fill={selected ? COLORS.terrain.fillSelected : COLORS.terrain.fill}
      stroke={selected ? COLORS.selection.highlight : COLORS.terrain.stroke}
      stroke-width={selected ? 0.15 : 0.1}
      on:click={handleClick}
      on:pointerdown={handlePointerDown}
      on:pointermove={handlePointerMove}
      on:pointerup={handlePointerUp}
      on:pointercancel={handlePointerUp}
      role="button"
      tabindex="0"
      class="terrain-shape"
    />
  </g>

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
      r={handleRadius}
      fill={COLORS.selection.highlight}
      stroke={COLORS.selection.highlightDark}
      stroke-width="0.08"
      on:pointerdown={handleRotatePointerDown}
      on:pointermove={handleRotatePointerMove}
      on:pointerup={handleRotatePointerUp}
      on:pointercancel={handleRotatePointerUp}
      role="button"
      tabindex="0"
      class="rotate-handle"
    />
  {/if}
</g>

<style>
  .terrain-rect rect {
    cursor: grab;
  }
  .terrain-rect.dragging rect {
    cursor: grabbing;
  }
  .terrain-rect.selected rect {
    filter: drop-shadow(0 0 0.3px #3b82f6);
  }
  .terrain-shape {
    touch-action: none;
  }
  .rotate-handle {
    cursor: grab;
    filter: drop-shadow(0.05px 0.05px 0.1px rgba(0,0,0,0.5));
    touch-action: none;
  }
</style>
