<script>
  import RosterViewerPanel from '../components/RosterViewerPanel.svelte';
</script>

<div class="roster-page">
  <header class="page-head">
    <h2>Roster</h2>
    <p>
      Paste an army list — compacted or full — and see the datasheet for every unit in it:
      stats, abilities, wargear profiles, enhancements, Army/Detachment Rules, and available
      Stratagems, sourced from the community-owned 40kdc-data 11th-edition dataset. Share a
      link to hand someone else the same view.
    </p>
  </header>

  <RosterViewerPanel />
</div>

<style>
  .roster-page {
    padding: 5rem 1.5rem 4rem;
    max-width: 900px;
    margin: 0 auto;
  }
  .page-head h2 {
    margin: 0 0 0.35rem;
    font-family: 'Cinzel', 'Trajan Pro', 'Times New Roman', serif;
    font-size: 1.4rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #d4af37;
  }
  .page-head p {
    margin: 0 0 1.25rem;
    color: #8a7a52;
    font-size: 0.9rem;
    line-height: 1.5;
    max-width: 70ch;
  }
</style>
