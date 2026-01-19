<script>
  import Battlefield from '../lib/Battlefield.svelte';
</script>

<main>
  <div class="header">
    <h1>Warhammer Deployment Planner</h1>
    <a href="#/debug" class="debug-link">Debug Mode</a>
  </div>
  <div class="battlefield-container">
    <Battlefield>
      <!-- Empty battlefield ready for terrain layouts -->
    </Battlefield>
  </div>
  <div class="info">
    <p>Battlefield: 60" x 44"</p>
  </div>
</main>

<style>
  main {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 100vh;
    padding: 1rem;
    box-sizing: border-box;
  }

  .header {
    display: flex;
    align-items: center;
    gap: 2rem;
    margin-bottom: 1rem;
  }

  h1 {
    margin: 0;
    font-size: 1.5rem;
    color: #e0e0e0;
  }

  .debug-link {
    color: #888;
    text-decoration: none;
    font-size: 0.875rem;
  }

  .debug-link:hover {
    color: #aaa;
    text-decoration: underline;
  }

  .battlefield-container {
    width: 100%;
    max-width: 1200px;
    aspect-ratio: 60 / 44;
    border: 2px solid #444;
    border-radius: 4px;
    overflow: hidden;
  }

  .info {
    margin-top: 1rem;
    color: #888;
    font-size: 0.875rem;
    text-align: center;
  }

  .info p {
    margin: 0;
  }
</style>
