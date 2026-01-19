<script>
  import { BATTLEFIELD } from '../stores/elements.js';

  let svgElement;

  const RULER_SIZE = 2; // inches for ruler margin

  // Convert screen coordinates to SVG coordinates (accounting for ruler offset)
  export function screenToSvg(screenX, screenY) {
    if (!svgElement) return { x: 0, y: 0 };
    const pt = svgElement.createSVGPoint();
    pt.x = screenX;
    pt.y = screenY;
    const svgPt = pt.matrixTransform(svgElement.getScreenCTM().inverse());
    return { x: svgPt.x - RULER_SIZE, y: svgPt.y - RULER_SIZE };
  }

  // Generate tick positions (every inch, with labels every 6 inches)
  $: horizontalTicks = Array.from({ length: BATTLEFIELD.width + 1 }, (_, i) => i);
  $: verticalTicks = Array.from({ length: BATTLEFIELD.height + 1 }, (_, i) => i);
</script>

<svg
  bind:this={svgElement}
  viewBox="0 0 {BATTLEFIELD.width + RULER_SIZE * 2} {BATTLEFIELD.height + RULER_SIZE * 2}"
  preserveAspectRatio="xMidYMid meet"
  class="battlefield"
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
    fill="#2d5a27"
  />

  <!-- Grid lines (1 inch spacing) -->
  {#each Array(BATTLEFIELD.width + 1) as _, i}
    <line
      x1={RULER_SIZE + i}
      y1={RULER_SIZE}
      x2={RULER_SIZE + i}
      y2={RULER_SIZE + BATTLEFIELD.height}
      stroke="#1e4d1a"
      stroke-width="0.05"
    />
  {/each}
  {#each Array(BATTLEFIELD.height + 1) as _, i}
    <line
      x1={RULER_SIZE}
      y1={RULER_SIZE + i}
      x2={RULER_SIZE + BATTLEFIELD.width}
      y2={RULER_SIZE + i}
      stroke="#1e4d1a"
      stroke-width="0.05"
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

  .ruler-text {
    font-size: 1px;
    fill: #888;
    font-family: system-ui, -apple-system, sans-serif;
  }
</style>
