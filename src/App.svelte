<script>
  import { onMount } from 'svelte';
  import MainPage from './pages/MainPage.svelte';
  import BattlefieldSetupPage from './pages/BattlefieldSetupPage.svelte';
  import DeploymentPage from './pages/DeploymentPage.svelte';
  import DebugPage from './pages/DebugPage.svelte';

  let currentPage = 'main';

  function handleHashChange() {
    const hash = window.location.hash;
    if (hash === '#/debug') {
      currentPage = 'debug';
    } else if (hash === '#/setup') {
      currentPage = 'setup';
    } else if (hash === '#/deployment') {
      currentPage = 'deployment';
    } else {
      currentPage = 'setup';
    }
  }

  onMount(() => {
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  });
</script>

{#if currentPage === 'debug'}
  <DebugPage />
{:else if currentPage === 'setup'}
  <BattlefieldSetupPage />
{:else if currentPage === 'deployment'}
  <DeploymentPage />
{:else}
  <MainPage />
{/if}

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    background: #1a1a1a;
    color: #fff;
    font-family: system-ui, -apple-system, sans-serif;
  }
</style>
