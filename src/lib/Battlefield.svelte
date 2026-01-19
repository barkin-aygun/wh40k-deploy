<script>
  import { BATTLEFIELD } from '../stores/elements.js';

  let svgElement;

  const RULER_SIZE = 2; // inches for ruler margin
  const TOTAL_WIDTH = BATTLEFIELD.width + RULER_SIZE * 2;
  const TOTAL_HEIGHT = BATTLEFIELD.height + RULER_SIZE * 2;

  // Pan and zoom state
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let isPanning = false;
  let lastPanPoint = { x: 0, y: 0 };
  let spacePressed = false;

  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 4;

  // Calculate viewBox based on pan/zoom
  $: viewWidth = TOTAL_WIDTH / zoom;
  $: viewHeight = TOTAL_HEIGHT / zoom;
  $: viewX = panX;
  $: viewY = panY;
  $: viewBoxStr = `${viewX} ${viewY} ${viewWidth} ${viewHeight}`;

  // Convert screen coordinates to SVG coordinates (accounting for pan/zoom and ruler offset)
  export function screenToSvg(screenX, screenY) {
    if (!svgElement) return { x: 0, y: 0 };
    const pt = svgElement.createSVGPoint();
    pt.x = screenX;
    pt.y = screenY;
    const svgPt = pt.matrixTransform(svgElement.getScreenCTM().inverse());
    return { x: svgPt.x - RULER_SIZE, y: svgPt.y - RULER_SIZE };
  }

  // Handle mouse wheel for zoom
  function handleWheel(event) {
    event.preventDefault();

    // Get mouse position in SVG coordinates before zoom
    const rect = svgElement.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Convert to viewBox coordinates
    const svgMouseX = viewX + (mouseX / rect.width) * viewWidth;
    const svgMouseY = viewY + (mouseY / rect.height) * viewHeight;

    // Calculate new zoom
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * zoomFactor));

    // Calculate new viewBox dimensions
    const newViewWidth = TOTAL_WIDTH / newZoom;
    const newViewHeight = TOTAL_HEIGHT / newZoom;

    // Adjust pan to keep mouse position fixed
    const newPanX = svgMouseX - (mouseX / rect.width) * newViewWidth;
    const newPanY = svgMouseY - (mouseY / rect.height) * newViewHeight;

    zoom = newZoom;
    panX = newPanX;
    panY = newPanY;
  }

  // Handle panning
  function handleMouseDown(event) {
    // Middle mouse button or space+left click for panning
    if (event.button === 1 || (event.button === 0 && spacePressed)) {
      event.preventDefault();
      isPanning = true;
      lastPanPoint = { x: event.clientX, y: event.clientY };
    }
  }

  function handleMouseMove(event) {
    if (!isPanning) return;

    const rect = svgElement.getBoundingClientRect();
    const dx = (event.clientX - lastPanPoint.x) / rect.width * viewWidth;
    const dy = (event.clientY - lastPanPoint.y) / rect.height * viewHeight;

    panX -= dx;
    panY -= dy;

    lastPanPoint = { x: event.clientX, y: event.clientY };
  }

  function handleMouseUp() {
    isPanning = false;
  }

  // Handle keyboard for space key (pan mode)
  function handleKeyDown(event) {
    if (event.code === 'Space' && !event.repeat && event.target.tagName !== 'INPUT') {
      event.preventDefault(); // Prevent page scroll
      spacePressed = true;
    }
  }

  function handleKeyUp(event) {
    if (event.code === 'Space') {
      spacePressed = false;
    }
  }

  // Reset view on double-click
  function handleDblClick() {
    zoom = 1;
    panX = 0;
    panY = 0;
  }

  // Generate tick positions (every inch, with labels every 6 inches)
  $: horizontalTicks = Array.from({ length: BATTLEFIELD.width + 1 }, (_, i) => i);
  $: verticalTicks = Array.from({ length: BATTLEFIELD.height + 1 }, (_, i) => i);
</script>

<svelte:window on:keydown={handleKeyDown} on:keyup={handleKeyUp} on:mouseup={handleMouseUp} on:mousemove={handleMouseMove} />

<svg
  bind:this={svgElement}
  viewBox={viewBoxStr}
  preserveAspectRatio="xMidYMid meet"
  class="battlefield"
  class:panning={isPanning || spacePressed}
  on:wheel={handleWheel}
  on:mousedown={handleMouseDown}
  on:dblclick={handleDblClick}
>
  <!-- Ruler background -->
  <rect
    x="0"
    y="0"
    width={BATTLEFIELD.width + RULER_SIZE * 2}
    height={BATTLEFIELD.height + RULER_SIZE * 2}
    fill="#1a1a1a"
  />

  <!-- Battlefield background -->
  <rect
    x={RULER_SIZE}
    y={RULER_SIZE}
    width={BATTLEFIELD.width}
    height={BATTLEFIELD.height}
    fill="#4a5a4a"
  />

  <!-- Grid lines (1 inch spacing) -->
  {#each Array(BATTLEFIELD.width + 1) as _, i}
    <line
      x1={RULER_SIZE + i}
      y1={RULER_SIZE}
      x2={RULER_SIZE + i}
      y2={RULER_SIZE + BATTLEFIELD.height}
      stroke="#3a4a3a"
      stroke-width="0.05"
    />
  {/each}
  {#each Array(BATTLEFIELD.height + 1) as _, i}
    <line
      x1={RULER_SIZE}
      y1={RULER_SIZE + i}
      x2={RULER_SIZE + BATTLEFIELD.width}
      y2={RULER_SIZE + i}
      stroke="#3a4a3a"
      stroke-width="0.05"
    />
  {/each}

  <!-- 6x6 grid lines (slightly more visible) -->
  {#each Array(Math.floor(BATTLEFIELD.width / 6) + 1) as _, i}
    <line
      x1={RULER_SIZE + i * 6}
      y1={RULER_SIZE}
      x2={RULER_SIZE + i * 6}
      y2={RULER_SIZE + BATTLEFIELD.height}
      stroke="#5a6a5a"
      stroke-width="0.08"
    />
  {/each}
  {#each Array(Math.floor(BATTLEFIELD.height / 6) + 1) as _, i}
    <line
      x1={RULER_SIZE}
      y1={RULER_SIZE + i * 6}
      x2={RULER_SIZE + BATTLEFIELD.width}
      y2={RULER_SIZE + i * 6}
      stroke="#5a6a5a"
      stroke-width="0.08"
    />
  {/each}

  <!-- Top ruler -->
  {#each horizontalTicks as tick}
    <line
      x1={RULER_SIZE + tick}
      y1={tick % 6 === 0 ? 0.5 : RULER_SIZE - 0.8}
      x2={RULER_SIZE + tick}
      y2={RULER_SIZE}
      stroke="#666"
      stroke-width={tick % 6 === 0 ? 0.08 : 0.04}
    />
    {#if tick % 6 === 0}
      <text
        x={RULER_SIZE + tick}
        y={1.2}
        text-anchor="middle"
        class="ruler-text"
      >{tick}"</text>
    {/if}
  {/each}

  <!-- Bottom ruler -->
  {#each horizontalTicks as tick}
    <line
      x1={RULER_SIZE + tick}
      y1={RULER_SIZE + BATTLEFIELD.height}
      x2={RULER_SIZE + tick}
      y2={RULER_SIZE + BATTLEFIELD.height + (tick % 6 === 0 ? 1.5 : 0.8)}
      stroke="#666"
      stroke-width={tick % 6 === 0 ? 0.08 : 0.04}
    />
    {#if tick % 6 === 0}
      <text
        x={RULER_SIZE + tick}
        y={RULER_SIZE + BATTLEFIELD.height + 1.8}
        text-anchor="middle"
        class="ruler-text"
      >{tick}"</text>
    {/if}
  {/each}

  <!-- Left ruler -->
  {#each verticalTicks as tick}
    <line
      x1={tick % 6 === 0 ? 0.5 : RULER_SIZE - 0.8}
      y1={RULER_SIZE + tick}
      x2={RULER_SIZE}
      y2={RULER_SIZE + tick}
      stroke="#666"
      stroke-width={tick % 6 === 0 ? 0.08 : 0.04}
    />
    {#if tick % 6 === 0}
      <text
        x={1.0}
        y={RULER_SIZE + tick + 0.35}
        text-anchor="middle"
        class="ruler-text"
      >{tick}"</text>
    {/if}
  {/each}

  <!-- Right ruler -->
  {#each verticalTicks as tick}
    <line
      x1={RULER_SIZE + BATTLEFIELD.width}
      y1={RULER_SIZE + tick}
      x2={RULER_SIZE + BATTLEFIELD.width + (tick % 6 === 0 ? 1.5 : 0.8)}
      y2={RULER_SIZE + tick}
      stroke="#666"
      stroke-width={tick % 6 === 0 ? 0.08 : 0.04}
    />
    {#if tick % 6 === 0}
      <text
        x={RULER_SIZE + BATTLEFIELD.width + 1.0}
        y={RULER_SIZE + tick + 0.35}
        text-anchor="middle"
        class="ruler-text"
      >{tick}"</text>
    {/if}
  {/each}

  <!-- Offset group for battlefield content -->
  <g transform="translate({RULER_SIZE}, {RULER_SIZE})">
    <slot {screenToSvg} />
  </g>
</svg>

<style>
  .battlefield {
    width: 100%;
    height: 100%;
    max-width: 100vw;
    max-height: 100vh;
    display: block;
    cursor: default;
  }

  .battlefield.panning {
    cursor: grab;
  }

  .battlefield.panning:active {
    cursor: grabbing;
  }

  .ruler-text {
    font-size: 1px;
    fill: #888;
    font-family: system-ui, -apple-system, sans-serif;
    user-select: none;
  }
</style>
