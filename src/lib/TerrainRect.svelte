<script>
  import { BATTLEFIELD } from '../stores/elements.js';
  import { COLORS } from './colors.js';

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

  // Rotation handle position
  $: handleDistance = Math.max(width, height) / 2 + 1.5;
  $: handleX = centerX + handleDistance * Math.cos((rotation - 45) * Math.PI / 180);
  $: handleY = centerY + handleDistance * Math.sin((rotation - 45) * Math.PI / 180);

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

    // Snap to grid (1 inch) unless Shift is held
    if (!event.shiftKey) {
      newX = Math.round(newX);
      newY = Math.round(newY);
    }

    // Constrain to battlefield
    const margin = Math.max(width, height) / 2;
    newX = Math.max(-margin, Math.min(BATTLEFIELD.width - width + margin, newX));
    newY = Math.max(-margin, Math.min(BATTLEFIELD.height - height + margin, newY));

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
      on:mousedown={handleMouseDown}
      role="button"
      tabindex="0"
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
  .terrain-rect rect {
    cursor: grab;
  }
  .terrain-rect.dragging rect {
    cursor: grabbing;
  }
  .terrain-rect.selected rect {
    filter: drop-shadow(0 0 0.3px #3b82f6);
  }
  .rotate-handle {
    cursor: grab;
    filter: drop-shadow(0.05px 0.05px 0.1px rgba(0,0,0,0.5));
  }
</style>
