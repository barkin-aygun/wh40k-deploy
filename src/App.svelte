<script>
  import { onMount, onDestroy } from 'svelte';
  import BattlefieldSetupPage from './pages/BattlefieldSetupPage.svelte';
  import DeploymentPage from './pages/DeploymentPage.svelte';
  import BattlePage from './pages/BattlePage.svelte';
  import DebugPage from './pages/DebugPage.svelte';
  import LayoutPage from './pages/LayoutPage.svelte';
  import { isMobile, MOBILE_BREAKPOINT } from './lib/touch.js';

  let currentPage = 'main';
  let mobileNavOpen = false;
  let isMobileView = false;

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
    // Close mobile nav on page change
    mobileNavOpen = false;
  }

  function handleResize() {
    isMobileView = isMobile();
    // Close mobile nav if we resize to desktop
    if (!isMobileView) {
      mobileNavOpen = false;
    }
  }

  function toggleMobileNav() {
    mobileNavOpen = !mobileNavOpen;
  }

  function closeMobileNav() {
    mobileNavOpen = false;
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape' && mobileNavOpen) {
      mobileNavOpen = false;
    }
  }

  onMount(() => {
    handleHashChange();
    handleResize();
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
    };
  });
</script>

<div class="app-header">
  <h1 class="app-title">Procinctum</h1>
  <nav class="nav-links desktop-nav">
    <a href="#/setup" class:active={currentPage === 'setup'}>Battlefield Setup</a>
    <a href="#/deployment" class:active={currentPage === 'deployment'}>Deployment</a>
    <a href="#/battle" class:active={currentPage === 'battle'}>Battle</a>
    <a href="#/layout" class:active={currentPage === 'layout'}>Layout Builder</a>
  </nav>
  <button class="hamburger-btn" on:click={toggleMobileNav} aria-label="Toggle navigation">
    <span class="hamburger-line"></span>
    <span class="hamburger-line"></span>
    <span class="hamburger-line"></span>
  </button>
</div>

<!-- Mobile Navigation Drawer -->
{#if mobileNavOpen}
  <div class="mobile-nav-overlay" on:click={closeMobileNav}></div>
{/if}
<nav class="mobile-nav" class:open={mobileNavOpen}>
  <div class="mobile-nav-header">
    <h2>Navigation</h2>
    <button class="close-btn" on:click={closeMobileNav} aria-label="Close navigation">&times;</button>
  </div>
  <div class="mobile-nav-links">
    <a href="#/setup" class:active={currentPage === 'setup'} on:click={closeMobileNav}>Battlefield Setup</a>
    <a href="#/deployment" class:active={currentPage === 'deployment'} on:click={closeMobileNav}>Deployment</a>
    <a href="#/battle" class:active={currentPage === 'battle'} on:click={closeMobileNav}>Battle</a>
    <a href="#/layout" class:active={currentPage === 'layout'} on:click={closeMobileNav}>Layout Builder</a>
  </div>
</nav>

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

  /* Hamburger button - hidden on desktop */
  .hamburger-btn {
    display: none;
    flex-direction: column;
    justify-content: space-around;
    width: 28px;
    height: 24px;
    padding: 0;
    margin-left: auto;
    background: transparent;
    border: none;
    cursor: pointer;
  }

  .hamburger-line {
    width: 100%;
    height: 3px;
    background: #888;
    border-radius: 2px;
    transition: all 0.2s ease;
  }

  .hamburger-btn:hover .hamburger-line {
    background: #fff;
  }

  /* Mobile nav overlay */
  .mobile-nav-overlay {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 150;
  }

  /* Mobile navigation drawer */
  .mobile-nav {
    display: none;
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: 280px;
    max-width: 80vw;
    background: #222;
    z-index: 200;
    transform: translateX(100%);
    transition: transform 0.3s ease;
    flex-direction: column;
  }

  .mobile-nav.open {
    transform: translateX(0);
  }

  .mobile-nav-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    border-bottom: 1px solid #333;
  }

  .mobile-nav-header h2 {
    margin: 0;
    font-size: 1.125rem;
    color: #e0e0e0;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    padding: 0;
    background: transparent;
    border: none;
    color: #888;
    font-size: 1.5rem;
    cursor: pointer;
    border-radius: 4px;
  }

  .close-btn:hover {
    background: #333;
    color: #fff;
  }

  .mobile-nav-links {
    display: flex;
    flex-direction: column;
    padding: 1rem;
    gap: 0.5rem;
  }

  .mobile-nav-links a {
    display: block;
    padding: 0.75rem 1rem;
    color: #888;
    text-decoration: none;
    font-size: 1rem;
    border-radius: 6px;
    transition: all 0.15s ease;
  }

  .mobile-nav-links a:hover {
    background: #333;
    color: #fff;
  }

  .mobile-nav-links a.active {
    background: #3b82f6;
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

  /* Mobile styles */
  @media (max-width: 768px) {
    .app-header {
      padding: 0.75rem 1rem;
    }

    .app-title {
      font-size: 1.25rem;
    }

    .desktop-nav {
      display: none;
    }

    .hamburger-btn {
      display: flex;
    }

    .mobile-nav-overlay {
      display: block;
    }

    .mobile-nav {
      display: flex;
    }

    .app-footer {
      flex-direction: column;
      gap: 0.25rem;
      padding: 0.5rem;
      font-size: 0.65rem;
    }

    .app-footer .separator {
      display: none;
    }

    .app-footer .disclaimer {
      text-align: center;
      line-height: 1.3;
    }

    .app-footer .disclaimer br {
      display: none;
    }
  }
</style>
