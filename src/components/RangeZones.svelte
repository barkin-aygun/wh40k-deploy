<script>
  import { getBaseSize, isOvalBase, isRectangularBase } from '../stores/models.js';
  import { getPlayerColors } from '../lib/colors.js';

  export let models = [];
  export let show6InchZone = false;
  export let show9InchZone = false;
  export let show12InchZone = false;
</script>

{#each models as model (model.id)}
  {@const modelShow6 = show6InchZone || !!model.show6InchZone}
  {@const modelShow9 = show9InchZone || !!model.show9InchZone}
  {@const modelShow12 = show12InchZone || !!model.show12InchZone}
  {#if modelShow6 || modelShow9 || modelShow12}
    {@const baseSize = getBaseSize(model.baseType, model)}
    {@const isOval = isOvalBase(model.baseType)}
    {@const isRect = isRectangularBase(model.baseType)}
    {@const playerColor = getPlayerColors(model.playerId).fillLighter}
    {@const playerStroke = getPlayerColors(model.playerId).primary}
    {#if modelShow12}
      {#if isRect}
        <g transform="rotate({model.rotation || 0}, {model.x}, {model.y})">
          <rect
            x={model.x - model.customWidth / 2 - 12}
            y={model.y - model.customHeight / 2 - 12}
            width={model.customWidth + 24}
            height={model.customHeight + 24}
            rx="12"
            ry="12"
            fill={playerColor}
            stroke={playerStroke}
            stroke-width="0.05"
            stroke-dasharray="0.5,0.25"
            pointer-events="none"
            opacity="0.4"
          />
        </g>
      {:else if isOval}
        <g transform="rotate({model.rotation || 0}, {model.x}, {model.y})">
          <ellipse
            cx={model.x}
            cy={model.y}
            rx={baseSize.width / 2 + 12}
            ry={baseSize.height / 2 + 12}
            fill={playerColor}
            stroke={playerStroke}
            stroke-width="0.05"
            stroke-dasharray="0.5,0.25"
            pointer-events="none"
            opacity="0.4"
          />
        </g>
      {:else}
        <circle
          cx={model.x}
          cy={model.y}
          r={baseSize.radius + 12}
          fill={playerColor}
          stroke={playerStroke}
          stroke-width="0.05"
          stroke-dasharray="0.5,0.25"
          pointer-events="none"
          opacity="0.4"
        />
      {/if}
    {/if}
    {#if modelShow9}
      {#if isRect}
        <g transform="rotate({model.rotation || 0}, {model.x}, {model.y})">
          <rect
            x={model.x - model.customWidth / 2 - 9}
            y={model.y - model.customHeight / 2 - 9}
            width={model.customWidth + 18}
            height={model.customHeight + 18}
            rx="9"
            ry="9"
            fill={playerColor}
            stroke={playerStroke}
            stroke-width="0.05"
            stroke-dasharray="0.5,0.25"
            pointer-events="none"
            opacity="0.5"
          />
        </g>
      {:else if isOval}
        <g transform="rotate({model.rotation || 0}, {model.x}, {model.y})">
          <ellipse
            cx={model.x}
            cy={model.y}
            rx={baseSize.width / 2 + 9}
            ry={baseSize.height / 2 + 9}
            fill={playerColor}
            stroke={playerStroke}
            stroke-width="0.05"
            stroke-dasharray="0.5,0.25"
            pointer-events="none"
            opacity="0.5"
          />
        </g>
      {:else}
        <circle
          cx={model.x}
          cy={model.y}
          r={baseSize.radius + 9}
          fill={playerColor}
          stroke={playerStroke}
          stroke-width="0.05"
          stroke-dasharray="0.5,0.25"
          pointer-events="none"
          opacity="0.5"
        />
      {/if}
    {/if}
    {#if modelShow6}
      {#if isRect}
        <g transform="rotate({model.rotation || 0}, {model.x}, {model.y})">
          <rect
            x={model.x - model.customWidth / 2 - 6}
            y={model.y - model.customHeight / 2 - 6}
            width={model.customWidth + 12}
            height={model.customHeight + 12}
            rx="6"
            ry="6"
            fill={playerColor}
            stroke={playerStroke}
            stroke-width="0.08"
            stroke-dasharray="0.3,0.15"
            pointer-events="none"
            opacity="0.6"
          />
        </g>
      {:else if isOval}
        <g transform="rotate({model.rotation || 0}, {model.x}, {model.y})">
          <ellipse
            cx={model.x}
            cy={model.y}
            rx={baseSize.width / 2 + 6}
            ry={baseSize.height / 2 + 6}
            fill={playerColor}
            stroke={playerStroke}
            stroke-width="0.08"
            stroke-dasharray="0.3,0.15"
            pointer-events="none"
            opacity="0.6"
          />
        </g>
      {:else}
        <circle
          cx={model.x}
          cy={model.y}
          r={baseSize.radius + 6}
          fill="none"
          stroke={playerStroke}
          stroke-width="0.08"
          stroke-dasharray="0.3,0.15"
          pointer-events="none"
          opacity="0.7"
        />
      {/if}
    {/if}
  {/if}
{/each}
