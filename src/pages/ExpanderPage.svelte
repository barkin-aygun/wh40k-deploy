<script>
  import ArmyExpanderPanel from '../components/ArmyExpanderPanel.svelte';
</script>

<div class="expander-page">
  <header class="page-head">
    <h2>List Expander</h2>
    <p>
      Reverse of Desjani's 40kCompactor: paste a compacted 11th-edition list and get a
      fully-parsed, datasheet-ready breakdown with abbreviations expanded to full item names.
      Full-name formats (GW App, WTC, WTC-Compact, NR, ListForge) are also accepted and
      normalised losslessly.
    </p>
  </header>

  <ArmyExpanderPanel />
</div>

<style>
  .expander-page {
    padding: 5rem 1.5rem 4rem;
    max-width: 1200px;
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
