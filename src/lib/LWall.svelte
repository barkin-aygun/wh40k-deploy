<script>
  export let terrainX;
  export let terrainY;
  export let terrainHeight;

  // Wall dimensions
  const WALL_THICKNESS = 0.5;
  const HORIZONTAL_LENGTH = 4;
  const VERTICAL_LENGTH = 8;

  // Bottom-left corner of terrain (in SVG, y increases downward)
  $: cornerX = terrainX;
  $: cornerY = terrainY + terrainHeight;

  // L-wall polygon points, starting from bottom-left and going counterclockwise
  // The wall extends right (4") and up (8") from the corner
  $: points = [
    [cornerX, cornerY],                                          // bottom-left
    [cornerX, cornerY - VERTICAL_LENGTH],                        // top of vertical wall
    [cornerX + WALL_THICKNESS, cornerY - VERTICAL_LENGTH],       // inner top of vertical
    [cornerX + WALL_THICKNESS, cornerY - WALL_THICKNESS],        // inner corner
    [cornerX + HORIZONTAL_LENGTH, cornerY - WALL_THICKNESS],     // inner end of horizontal
    [cornerX + HORIZONTAL_LENGTH, cornerY],                      // bottom-right of horizontal
  ].map(p => p.join(',')).join(' ');
</script>

<polygon
  {points}
  fill="#4a4a4a"
  stroke="#2a2a2a"
  stroke-width="0.05"
  class="l-wall"
/>

<style>
  .l-wall {
    filter: drop-shadow(0.1px 0.1px 0.15px rgba(0,0,0,0.6));
    pointer-events: none;
  }
</style>
