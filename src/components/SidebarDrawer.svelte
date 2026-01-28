<script>
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';

  export let open = false;
  export let title = 'Options';

  const dispatch = createEventDispatcher();

  function close() {
    dispatch('close');
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape' && open) {
      close();
    }
  }

  function handleOverlayClick() {
    close();
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });
</script>

{#if open}
  <div class="drawer-overlay" on:click={handleOverlayClick}></div>
{/if}

<aside class="drawer" class:open>
  <div class="drawer-header">
    <h2>{title}</h2>
    <button class="close-btn" on:click={close} aria-label="Close drawer">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </button>
  </div>
  <div class="drawer-content">
    <slot />
  </div>
</aside>

<style>
  .drawer-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 200;
  }

  .drawer {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 320px;
    max-width: 85vw;
    background: #222;
    z-index: 210;
    transform: translateX(100%);
    transition: transform 0.3s ease;
    display: flex;
    flex-direction: column;
    box-shadow: -4px 0 20px rgba(0, 0, 0, 0.3);
  }

  .drawer.open {
    transform: translateX(0);
  }

  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    border-bottom: 1px solid #333;
    flex-shrink: 0;
  }

  .drawer-header h2 {
    margin: 0;
    font-size: 1.125rem;
    color: #e0e0e0;
    font-weight: 600;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    padding: 0;
    background: transparent;
    border: none;
    color: #888;
    cursor: pointer;
    border-radius: 6px;
    transition: all 0.15s ease;
  }

  .close-btn:hover {
    background: #333;
    color: #fff;
  }

  .drawer-content {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    -webkit-overflow-scrolling: touch;
  }

  /* Scrollbar styling for drawer content */
  .drawer-content::-webkit-scrollbar {
    width: 6px;
  }

  .drawer-content::-webkit-scrollbar-track {
    background: #1a1a1a;
  }

  .drawer-content::-webkit-scrollbar-thumb {
    background: #444;
    border-radius: 3px;
  }

  .drawer-content::-webkit-scrollbar-thumb:hover {
    background: #555;
  }
</style>
