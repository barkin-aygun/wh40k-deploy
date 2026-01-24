<script>
  import { onMount } from 'svelte';
  import BattlefieldSetupPage from './pages/BattlefieldSetupPage.svelte';
  import DeploymentPage from './pages/DeploymentPage.svelte';
  import BattlePage from './pages/BattlePage.svelte';
  import DebugPage from './pages/DebugPage.svelte';
    import LayoutPage from './pages/LayoutPage.svelte';

  let currentPage = 'main';

  function handleHashChange() {
    const hash = window.location.hash;
    if (hash === '#/debug') {
      currentPage = 'debug';
    } else if (hash === '#/setup') {
      currentPage = 'setup';
    } else if (hash === '#/deployment') {
      currentPage = 'deployment';
    } else if (hash === '#/battle') {
      currentPage = 'battle';
    } else if (hash === '#/layout') {
      currentPage = 'layout';
    } else {
      currentPage = 'deployment';
    }
  }

  onMount(() => {
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  });
</script>

<div class="app-header">
  <h1 class="app-title">Procinctum</h1>
  <nav class="nav-links">
    <a href="#/setup" class:active={currentPage === 'setup'}>Battlefield Setup</a>
    <a href="#/deployment" class:active={currentPage === 'deployment'}>Deployment</a>
    <a href="#/battle" class:active={currentPage === 'battle'}>Battle</a>
    <a href="#/layout" class:active={currentPage === 'layout'}>Layout Builder</a>
  </nav>
</div>

{#if currentPage === 'debug'}
  <DebugPage />
{:else if currentPage === 'setup'}
  <BattlefieldSetupPage />
{:else if currentPage === 'deployment'}
  <DeploymentPage />
{:else if currentPage === 'battle'}
  <BattlePage />
{:else if currentPage === 'layout'}
  <LayoutPage />
{:else}
  <DeploymentPage />
{/if}

<footer class="app-footer">
  <span>Built with love by <a href="https://github.com/barkin-aygun/wh40k-deploy" target="_blank" rel="noopener noreferrer">@Volfied</a></span>
  <span class="separator">|</span>
  <span class="disclaimer">Warhammer 40,000 and all associated marks, logos, and images are trademarks and/or copyrights of Games Workshop Ltd. This is an unofficial fan project and is not affiliated with or endorsed by Games Workshop.<br><a href="https://github.com/desjani/40kCompactor" target="_blank" rel="noopener noreferrer">40KCompactor</a> by Desjani</span>
</footer>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    background: #1a1a1a;
    color: #fff;
    font-family: system-ui, -apple-system, sans-serif;
  }

  .app-header {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    gap: 2rem;
    padding: 1rem;
    background: #1a1a1a;
    border-bottom: 1px solid #333;
    z-index: 100;
  }

  .app-title {
    margin: 0;
    font-size: 1.5rem;
    color: #e0e0e0;
    font-weight: 700;
  }

  .nav-links {
    display: flex;
    gap: 1.5rem;
  }

  .nav-links a {
    color: #888;
    text-decoration: none;
    font-size: 0.875rem;
  }

  .nav-links a:hover {
    color: #aaa;
    text-decoration: underline;
  }

  .nav-links a.active {
    color: #fff;
  }

  .app-footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 0.5rem 1rem;
    background: #111;
    border-top: 1px solid #333;
    font-size: 0.75rem;
    color: #666;
    z-index: 100;
  }

  .app-footer .separator {
    color: #444;
  }

  .app-footer .disclaimer {
    color: #555;
    font-style: italic;
  }

  .app-footer a {
    color: #888;
    text-decoration: none;
  }

  .app-footer a:hover {
    color: #aaa;
    text-decoration: underline;
  }
</style>
