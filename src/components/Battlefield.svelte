<script>
  import { BATTLEFIELD } from '../stores/elements.js';
  import { COLORS, getPlayerColors } from '../lib/colors.js';
  import { pathToSvgD, OBJECTIVE_RADIUS, OBJECTIVE_CONTROL_RADIUS } from '../stores/deployment.js';
  import { getWallVertices } from '../stores/layout.js';
  import { getBaseSize, isOvalBase, isRectangularBase } from '../stores/models.js';
  import { battlefieldView, resetView } from '../stores/battlefieldView.js';
  import TerrainRect from './TerrainRect.svelte';
  import WallPiece from './WallPiece.svelte';
  import ModelBase from './ModelBase.svelte';

  let svgElement;

  const RULER_SIZE = 2; // inches for ruler margin
  const TOTAL_WIDTH = BATTLEFIELD.width + RULER_SIZE * 2;
  const TOTAL_HEIGHT = BATTLEFIELD.height + RULER_SIZE * 2;

  // Data props - when provided, these layers render
  export let deploymentZones = null;
  export let objectives = null;
  export let terrains = null;
  export let walls = null;
  export let models = null;
  export let losResults = null;

  // Behavior props
  export let showGrid = true;
  export let showRuler = true;
  export let interactiveTerrain = false;
  export let interactiveWalls = false;
  export let interactiveModels = false;
  export let showDebugRays = false;

  // Selection state
  export let selectedTerrainId = null;
  export let selectedWallId = null;
  export let selectedModelId = null;

  // Callbacks for interactive modes
  export let onTerrainSelect = () => {};
  export let onTerrainDrag = () => {};
  export let onTerrainRotate = () => {};
  export let onWallSelect = () => {};
  export let onWallDrag = () => {};
  export let onWallRotate = () => {};
  export let onModelSelect = () => {};
  export let onModelDrag = () => {};
  export let onModelDragEnd = () => {};
  export let onModelRotate = () => {};
  export let onModelRotateEnd = () => {};
  export let onModelRename = () => {};
  export let onBackgroundClick = () => {};

  // Pan and zoom state (shared across routes via store)
  let isPanning = false;
  let lastPanPoint = { x: 0, y: 0 };
  let spacePressed = false;

  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 4;

  // Calculate viewBox based on pan/zoom from store
  $: viewWidth = TOTAL_WIDTH / $battlefieldView.zoom;
  $: viewHeight = TOTAL_HEIGHT / $battlefieldView.zoom;
  $: viewX = $battlefieldView.panX;
  $: viewY = $battlefieldView.panY;
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
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, $battlefieldView.zoom * zoomFactor));

    // Calculate new viewBox dimensions
    const newViewWidth = TOTAL_WIDTH / newZoom;
    const newViewHeight = TOTAL_HEIGHT / newZoom;

    // Adjust pan to keep mouse position fixed
    const newPanX = svgMouseX - (mouseX / rect.width) * newViewWidth;
    const newPanY = svgMouseY - (mouseY / rect.height) * newViewHeight;

    battlefieldView.set({ zoom: newZoom, panX: newPanX, panY: newPanY });
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

    battlefieldView.update(v => ({
      ...v,
      panX: v.panX - dx,
      panY: v.panY - dy
    }));

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
    resetView();
  }

  // Handle background click for deselection
  function handleBackgroundClick(event) {
    // Only trigger if clicking directly on background, not on child elements
    if (event.target === event.currentTarget || event.target.tagName === 'rect') {
      onBackgroundClick();
    }
  }

  // Generate tick positions (every inch, with labels every 6 inches)
  $: horizontalTicks = Array.from({ length: BATTLEFIELD.width + 1 }, (_, i) => i);
  $: verticalTicks = Array.from({ length: BATTLEFIELD.height + 1 }, (_, i) => i);

  // Helper to get wall path for static rendering
  function getWallPath(wall) {
    const vertices = getWallVertices(wall.shape, wall.segments);
    if (vertices.length === 0) return '';
    return `M ${vertices.map(v => `${wall.x + v.x},${wall.y + v.y}`).join(' L ')} Z`;
  }

  // Helper to get wall center for rotation
  function getWallCenter(wall) {
    const vertices = getWallVertices(wall.shape, wall.segments);
    if (vertices.length === 0) return { x: wall.x, y: wall.y };
    const xs = vertices.map(v => v.x);
    const ys = vertices.map(v => v.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
      x: wall.x + minX + (maxX - minX) / 2,
      y: wall.y + minY + (maxY - minY) / 2
    };
  }

  // Get selected model for LOS visualization
  $: selectedModel = models?.find(m => m.id === selectedModelId);
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
  on:click={handleBackgroundClick}
>
  <!-- Ruler background -->
  {#if showRuler}
    <rect
      x="0"
      y="0"
      width={BATTLEFIELD.width + RULER_SIZE * 2}
      height={BATTLEFIELD.height + RULER_SIZE * 2}
      fill={COLORS.battlefield.rulerBackground}
    />
  {/if}

  <!-- Battlefield background -->
  <rect
    x={RULER_SIZE}
    y={RULER_SIZE}
    width={BATTLEFIELD.width}
    height={BATTLEFIELD.height}
    fill={COLORS.battlefield.background}
  />

  <!-- Grid lines (1 inch spacing) -->
  {#if showGrid}
    {#each Array(BATTLEFIELD.width + 1) as _, i}
      <line
        x1={RULER_SIZE + i}
        y1={RULER_SIZE}
        x2={RULER_SIZE + i}
        y2={RULER_SIZE + BATTLEFIELD.height}
        stroke={COLORS.battlefield.gridFine}
        stroke-width="0.05"
      />
    {/each}
    {#each Array(BATTLEFIELD.height + 1) as _, i}
      <line
        x1={RULER_SIZE}
        y1={RULER_SIZE + i}
        x2={RULER_SIZE + BATTLEFIELD.width}
        y2={RULER_SIZE + i}
        stroke={COLORS.battlefield.gridFine}
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
        stroke={COLORS.battlefield.gridCoarse}
        stroke-width="0.08"
      />
    {/each}
    {#each Array(Math.floor(BATTLEFIELD.height / 6) + 1) as _, i}
      <line
        x1={RULER_SIZE}
        y1={RULER_SIZE + i * 6}
        x2={RULER_SIZE + BATTLEFIELD.width}
        y2={RULER_SIZE + i * 6}
        stroke={COLORS.battlefield.gridCoarse}
        stroke-width="0.08"
      />
    {/each}
  {/if}

  <!-- Rulers -->
  {#if showRuler}
    <!-- Top ruler -->
    {#each horizontalTicks as tick}
      <line
        x1={RULER_SIZE + tick}
        y1={tick % 6 === 0 ? 0.5 : RULER_SIZE - 0.8}
        x2={RULER_SIZE + tick}
        y2={RULER_SIZE}
        stroke={COLORS.battlefield.ruler}
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
        stroke={COLORS.battlefield.ruler}
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
        stroke={COLORS.battlefield.ruler}
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
        stroke={COLORS.battlefield.ruler}
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
  {/if}

  <!-- Offset group for battlefield content -->
  <g transform="translate({RULER_SIZE}, {RULER_SIZE})">
    <!-- Deployment zones layer -->
    {#if deploymentZones}
      {#each deploymentZones as zone}
        <path
          d={pathToSvgD(zone.path)}
          fill={zone.color}
          stroke={zone.borderColor}
          stroke-width="0.10"
          stroke-dasharray="0.5,0.25"
        />
      {/each}
    {/if}

    <!-- LOS debug rays layer (render early, behind other elements) -->
    {#if showDebugRays && losResults && losResults.length > 0}
      {#each losResults as result}
        {#if result.rays}
          {#each result.rays as ray}
            <line
              x1={ray.from.x}
              y1={ray.from.y}
              x2={ray.to.x}
              y2={ray.to.y}
              stroke={ray.blocked ? COLORS.los.rayBlocked : COLORS.los.rayVisible}
              stroke-width="0.05"
            />
          {/each}
        {/if}
      {/each}
    {/if}

    <!-- Terrain layer -->
    {#if terrains}
      {#if interactiveTerrain}
        {#each terrains as terrain (terrain.id)}
          <TerrainRect
            id={terrain.id}
            x={terrain.x}
            y={terrain.y}
            width={terrain.width}
            height={terrain.height}
            rotation={terrain.rotation}
            selected={terrain.id === selectedTerrainId}
            {screenToSvg}
            onSelect={onTerrainSelect}
            onDrag={onTerrainDrag}
            onRotate={onTerrainRotate}
          />
        {/each}
      {:else}
        {#each terrains as terrain}
          {@const centerX = terrain.x + terrain.width / 2}
          {@const centerY = terrain.y + terrain.height / 2}
          <g transform="rotate({terrain.rotation}, {centerX}, {centerY})">
            <rect
              x={terrain.x}
              y={terrain.y}
              width={terrain.width}
              height={terrain.height}
              fill={COLORS.terrain.fillStatic}
              stroke={COLORS.terrain.stroke}
              stroke-width="0.1"
            />
          </g>
        {/each}
      {/if}
    {/if}

    <!-- Walls layer -->
    {#if walls}
      {#if interactiveWalls}
        {#each walls as wall (wall.id)}
          <WallPiece
            id={wall.id}
            x={wall.x}
            y={wall.y}
            shape={wall.shape}
            segments={wall.segments}
            rotation={wall.rotation}
            selected={wall.id === selectedWallId}
            {screenToSvg}
            onSelect={onWallSelect}
            onDrag={onWallDrag}
            onRotate={onWallRotate}
          />
        {/each}
      {:else}
        {#each walls as wall}
          {@const center = getWallCenter(wall)}
          <g transform="rotate({wall.rotation}, {center.x}, {center.y})">
            <path
              d={getWallPath(wall)}
              fill={COLORS.wall.fill}
              stroke={COLORS.wall.stroke}
              stroke-width="0.1"
            />
          </g>
        {/each}
      {/if}
    {/if}

    <!-- Objectives layer -->
    {#if objectives}
      {#each objectives as obj}
        {@const markerColor = obj.isPrimary ? COLORS.objective.primary : COLORS.objective.secondary}
        {@const controlColor = obj.isPrimary ? COLORS.objective.primaryControl : COLORS.objective.secondaryControl}
        <circle
          cx={obj.x}
          cy={obj.y}
          r={OBJECTIVE_CONTROL_RADIUS}
          fill={controlColor}
          stroke={markerColor}
          stroke-width="0.05"
          stroke-dasharray="0.3,0.15"
        />
        <circle
          cx={obj.x}
          cy={obj.y}
          r={OBJECTIVE_RADIUS}
          fill={markerColor}
          stroke={COLORS.objective.center}
          stroke-width="0.06"
        />
        <circle
          cx={obj.x}
          cy={obj.y}
          r="0.15"
          fill={COLORS.objective.center}
        />
      {/each}
    {/if}

    <!-- Models layer -->
    {#if models}
      {#if interactiveModels}
        {#each models as model (model.id)}
          <ModelBase
            id={model.id}
            x={model.x}
            y={model.y}
            baseType={model.baseType}
            playerId={model.playerId}
            rotation={model.rotation}
            name={model.name || ''}
            selected={model.id === selectedModelId}
            {screenToSvg}
            onSelect={onModelSelect}
            onDrag={onModelDrag}
            onDragEnd={onModelDragEnd}
            onRotate={onModelRotate}
            onRotateEnd={onModelRotateEnd}
            onRename={onModelRename}
          />
        {/each}
      {:else}
        {#each models as model}
          {@const baseSize = getBaseSize(model.baseType)}
          {@const playerColors = getPlayerColors(model.playerId)}
          {@const isOval = isOvalBase(model.baseType)}
          {@const isRect = isRectangularBase(model.baseType)}
          {#if isRect}
            <g transform="rotate({model.rotation || 0}, {model.x}, {model.y})">
              <rect
                x={model.x - (model.customWidth || 0) / 2}
                y={model.y - (model.customHeight || 0) / 2}
                width={model.customWidth || 0}
                height={model.customHeight || 0}
                fill={playerColors.fill}
                stroke={playerColors.primary}
                stroke-width="0.1"
              />
            </g>
          {:else if isOval}
            <g transform="rotate({model.rotation || 0}, {model.x}, {model.y})">
              <ellipse
                cx={model.x}
                cy={model.y}
                rx={baseSize.width / 2}
                ry={baseSize.height / 2}
                fill={playerColors.fill}
                stroke={playerColors.primary}
                stroke-width="0.1"
              />
            </g>
          {:else}
            <circle
              cx={model.x}
              cy={model.y}
              r={baseSize.radius}
              fill={playerColors.fill}
              stroke={playerColors.primary}
              stroke-width="0.1"
            />
          {/if}
        {/each}
      {/if}
    {/if}

    <!-- LOS visualization layer -->
    {#if showDebugRays && losResults && losResults.length > 0 && selectedModel}
      {#each losResults as result}
        {#if result.firstClearRay}
          <line
            x1={result.firstClearRay.from.x}
            y1={result.firstClearRay.from.y}
            x2={result.firstClearRay.to.x}
            y2={result.firstClearRay.to.y}
            stroke={COLORS.los.visible}
            stroke-width="0.15"
            opacity="0.7"
            pointer-events="none"
          />
        {:else if result.viewer}
          <line
            x1={selectedModel.x}
            y1={selectedModel.y}
            x2={result.viewer.x}
            y2={result.viewer.y}
            stroke={COLORS.los.blocked}
            stroke-width="0.1"
            stroke-dasharray="0.5 0.25"
            opacity="0.7"
            pointer-events="none"
          />
        {/if}
      {/each}
    {/if}

    <!-- Custom slot content -->
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
