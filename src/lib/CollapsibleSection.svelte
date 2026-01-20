<script>
  export let title;
  export let defaultOpen = true;

  let isOpen = defaultOpen;

  function toggle() {
    isOpen = !isOpen;
  }
</script>

<section class="collapsible-section" class:collapsed={!isOpen}>
  <div class="section-header" on:click={toggle} role="button" tabindex="0">
    <h3>{title}</h3>
    <span class="toggle-icon">{isOpen ? '▼' : '▶'}</span>
  </div>
  {#if isOpen}
    <div class="section-content">
      <slot />
    </div>
  {/if}
</section>

<style>
  .collapsible-section {
    background: #252525;
    border-radius: 8px;
    overflow: hidden;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    cursor: pointer;
    user-select: none;
    transition: background 0.15s;
  }

  .section-header:hover {
    background: #2a2a2a;
  }

  .section-header h3 {
    margin: 0;
    font-size: 0.875rem;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .toggle-icon {
    font-size: 0.75rem;
    color: #666;
    transition: transform 0.15s;
  }

  .section-content {
    padding: 0 1rem 1rem 1rem;
  }

  .collapsed .section-header {
    padding-bottom: 1rem;
  }
</style>
