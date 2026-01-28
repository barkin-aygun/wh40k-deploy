<script>
  import { createEventDispatcher } from 'svelte';

  export let onZoomIn = () => {};
  export let onZoomOut = () => {};
  export let onResetView = () => {};
  export let showOptionsButton = true;

  const dispatch = createEventDispatcher();

  function handleOptions() {
    dispatch('openOptions');
  }
</script>

<div class="touch-controls">
  <button class="control-btn" on:click={onZoomIn} aria-label="Zoom in" title="Zoom in">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35M11 8v6M8 11h6" />
    </svg>
  </button>

  <button class="control-btn" on:click={onZoomOut} aria-label="Zoom out" title="Zoom out">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35M8 11h6" />
    </svg>
  </button>

  <button class="control-btn" on:click={onResetView} aria-label="Reset view" title="Reset view">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  </button>

  {#if showOptionsButton}
    <button class="control-btn options-btn" on:click={handleOptions} aria-label="Options" title="Options">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>
  {/if}
</div>

<style>
  .touch-controls {
    display: none;
    position: fixed;
    bottom: 4.5rem;
    right: 1rem;
    flex-direction: column;
    gap: 0.5rem;
    z-index: 90;
  }

  .control-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    padding: 0;
    background: rgba(34, 34, 34, 0.95);
    border: 1px solid #444;
    border-radius: 12px;
    color: #ccc;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    -webkit-tap-highlight-color: transparent;
  }

  .control-btn:hover,
  .control-btn:active {
    background: rgba(51, 51, 51, 0.95);
    color: #fff;
    border-color: #555;
  }

  .control-btn:active {
    transform: scale(0.95);
  }

  .options-btn {
    margin-top: 0.5rem;
    background: rgba(59, 130, 246, 0.9);
    border-color: rgba(59, 130, 246, 0.5);
    color: #fff;
  }

  .options-btn:hover,
  .options-btn:active {
    background: rgba(59, 130, 246, 1);
    border-color: rgba(59, 130, 246, 0.7);
  }

  /* Show on mobile */
  @media (max-width: 768px) {
    .touch-controls {
      display: flex;
    }
  }
</style>
