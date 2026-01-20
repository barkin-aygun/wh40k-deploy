<script>
  export let x;
  export let y;
  export let radius;
  export let color;
  export let screenToSvg;
  export let onDrag = () => {};

  let isDragging = false;

  function handleMouseDown(event) {
    event.preventDefault();
    isDragging = true;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }

  function handleMouseMove(event) {
    if (!isDragging) return;
    const svgCoords = screenToSvg(event.clientX, event.clientY);

    // No battlefield constraints - models can be dragged anywhere
    onDrag(svgCoords.x, svgCoords.y);
  }

  function handleMouseUp() {
    isDragging = false;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }
</script>

<g class="unit-base" class:dragging={isDragging}>
  <circle
    cx={x}
    cy={y}
    r={radius}
    fill={color}
    stroke="#000"
    stroke-width="0.05"
    on:mousedown={handleMouseDown}
    role="button"
    tabindex="0"
  />
</g>

<style>
  .unit-base {
    cursor: grab;
  }
  .unit-base.dragging {
    cursor: grabbing;
  }
  circle {
    filter: drop-shadow(0.1px 0.1px 0.2px rgba(0,0,0,0.5));
  }
</style>
