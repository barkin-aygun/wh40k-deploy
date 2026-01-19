<script>
  import { BATTLEFIELD } from '../stores/elements.js';
  import LWall from './LWall.svelte';

  export let x;
  export let y;
  export let width;
  export let height;
  export let rotation = 0;
  export let screenToSvg;
  export let onDrag = () => {};
  export let onRotate = () => {};

  let isDragging = false;
  let isRotating = false;
  let dragOffset = { x: 0, y: 0 };

  // Center of the terrain for rotation
  $: centerX = x + width / 2;
  $: centerY = y + height / 2;

  // Rotation handle position (top-right corner, offset outward)
  $: handleDistance = Math.max(width, height) / 2 + 1.5;
  $: handleX = centerX + handleDistance * Math.cos((rotation - 45) * Math.PI / 180);
  $: handleY = centerY + handleDistance * Math.sin((rotation - 45) * Math.PI / 180);

  function handleMouseDown(event) {
    event.preventDefault();
    event.stopPropagation();
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

    // Constrain to battlefield bounds (approximate for rotated rect)
    const margin = Math.max(width, height) / 2;
    newX = Math.max(-margin, Math.min(BATTLEFIELD.width - width + margin, newX));
    newY = Math.max(-margin, Math.min(BATTLEFIELD.height - height + margin, newY));

    onDrag(newX, newY);
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

    // Calculate angle from center to mouse position
    const dx = svgCoords.x - centerX;
    const dy = svgCoords.y - centerY;
    let angle = Math.atan2(dy, dx) * 180 / Math.PI;

    // Offset by 45 degrees (handle starts at top-right)
    angle += 45;

    // Snap to 15-degree increments if shift is not held
    if (!event.shiftKey) {
      angle = Math.round(angle / 15) * 15;
    }

    onRotate(angle);
  }

  function handleRotateMouseUp() {
    isRotating = false;
    window.removeEventListener('mousemove', handleRotateMouseMove);
    window.removeEventListener('mouseup', handleRotateMouseUp);
  }
</script>

<g
  class="terrain-footprint"
  class:dragging={isDragging}
  class:rotating={isRotating}
  transform="rotate({rotation}, {centerX}, {centerY})"
>
  <!-- Terrain footprint rectangle -->
  <rect
    {x}
    {y}
    {width}
    {height}
    fill="rgba(139, 90, 43, 0.3)"
    stroke="#8b5a2b"
    stroke-width="0.1"
    stroke-dasharray="0.5,0.25"
    on:mousedown={handleMouseDown}
    role="button"
    tabindex="0"
  />

  <!-- L-Wall at bottom-left corner of terrain -->
  <LWall
    terrainX={x}
    terrainY={y}
    terrainHeight={height}
  />
</g>

<!-- Rotation handle (outside the rotated group so it's easier to grab) -->
<g class="rotation-handle" class:active={isRotating}>
  <line
    x1={centerX}
    y1={centerY}
    x2={handleX}
    y2={handleY}
    stroke="#666"
    stroke-width="0.08"
    stroke-dasharray="0.2,0.1"
  />
  <circle
    cx={handleX}
    cy={handleY}
    r="0.6"
    fill="#ff9800"
    stroke="#e65100"
    stroke-width="0.08"
    on:mousedown={handleRotateMouseDown}
    role="button"
    tabindex="0"
  />
</g>

<style>
  .terrain-footprint rect {
    cursor: grab;
  }
  .terrain-footprint.dragging rect {
    cursor: grabbing;
  }
  .rotation-handle circle {
    cursor: grab;
    filter: drop-shadow(0.05px 0.05px 0.1px rgba(0,0,0,0.5));
  }
  .rotation-handle.active circle {
    cursor: grabbing;
    fill: #ffc107;
  }
</style>
