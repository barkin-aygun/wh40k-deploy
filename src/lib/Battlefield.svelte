<script>
  import { BATTLEFIELD } from '../stores/elements.js';

  let svgElement;

  // Convert screen coordinates to SVG coordinates
  export function screenToSvg(screenX, screenY) {
    if (!svgElement) return { x: 0, y: 0 };
    const pt = svgElement.createSVGPoint();
    pt.x = screenX;
    pt.y = screenY;
    const svgPt = pt.matrixTransform(svgElement.getScreenCTM().inverse());
    return { x: svgPt.x, y: svgPt.y };
  }
</script>

<svg
  bind:this={svgElement}
  viewBox="0 0 {BATTLEFIELD.width} {BATTLEFIELD.height}"
  preserveAspectRatio="xMidYMid meet"
  class="battlefield"
>
  <!-- Background -->
  <rect
    x="0"
    y="0"
    width={BATTLEFIELD.width}
    height={BATTLEFIELD.height}
    fill="#2d5a27"
  />

  <!-- Grid lines (1 inch spacing) -->
  {#each Array(BATTLEFIELD.width + 1) as _, i}
    <line
      x1={i}
      y1="0"
      x2={i}
      y2={BATTLEFIELD.height}
      stroke="#1e4d1a"
      stroke-width="0.05"
    />
  {/each}
  {#each Array(BATTLEFIELD.height + 1) as _, i}
    <line
      x1="0"
      y1={i}
      x2={BATTLEFIELD.width}
      y2={i}
      stroke="#1e4d1a"
      stroke-width="0.05"
    />
  {/each}

  <slot {screenToSvg} />
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
</style>
