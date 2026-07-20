<script>
  import { formatRulesText } from '../lib/rulesText.js';

  export let rules; // output of buildRosterRules() — { armyRule, detachmentRules[] }
  export let stratagems; // output of buildRosterStratagems() — { core[], detachment[] }

  let showCore = false;

  $: hasRules = !!(rules && (rules.armyRule || rules.detachmentRules?.length));
  $: hasStratagems = !!(stratagems && (stratagems.core?.length || stratagems.detachment?.length));
  $: hasContent = hasRules || hasStratagems;
</script>

{#snippet stratagemRow(s)}
  <article class="strat-row">
    <div class="strat-head">
      <span class="strat-name">{s.name}</span>
      <span class="strat-cp">{s.cpCost}CP</span>
    </div>
    <div class="strat-meta">{[s.type, s.phases, s.turn, s.timing].filter(Boolean).join(' · ')}</div>
    {#if s.target}<div class="strat-meta strat-target">Target: {s.target}</div>{/if}
    {#if s.text}
      <div class="strat-text">{@html formatRulesText(s.text)}</div>
    {:else}
      <div class="strat-text strat-no-text">Effect text not available from this data source — see cost/phase/timing above.</div>
    {/if}
  </article>
{/snippet}

{#if hasContent}
  <div class="roster-rules">
    {#if rules?.armyRule}
      <article class="rule-card">
        <h4>Army Rule</h4>
        <div class="rule-name">{rules.armyRule.name}</div>
        <div class="rule-text">{@html formatRulesText(rules.armyRule.text)}</div>
      </article>
    {/if}

    {#each rules?.detachmentRules || [] as d, i (i)}
      <article class="rule-card">
        <h4>Detachment Rule — {d.name}</h4>
        <div class="rule-name">{d.ruleName}</div>
        <div class="rule-text">{@html formatRulesText(d.ruleText)}</div>
      </article>
    {/each}

    {#if stratagems?.detachment?.length}
      <div class="rule-card strat-block">
        <h4>Detachment Stratagems</h4>
        <div class="strat-list">
          {#each stratagems.detachment as s (s.id)}
            {@render stratagemRow(s)}
          {/each}
        </div>
      </div>
    {/if}

    {#if stratagems?.core?.length}
      <div class="rule-card strat-block">
        <button class="toggle-core" type="button" on:click={() => (showCore = !showCore)}>
          <span class="chevron" class:open={showCore}>▶</span>
          Core Stratagems (available to every army)
        </button>
        {#if showCore}
          <div class="strat-list">
            {#each stratagems.core as s (s.id)}
              {@render stratagemRow(s)}
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .roster-rules {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .rule-card {
    background: #150f07;
    border: 1px solid #4a3d1f;
    border-radius: 6px;
    padding: 0.7rem 0.9rem;
  }
  h4 {
    margin: 0 0 0.3rem;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #b8912f;
  }
  .rule-name {
    font-family: 'Cinzel', 'Trajan Pro', serif;
    font-size: 0.95rem;
    font-weight: 700;
    color: #f7e7ac;
    margin-bottom: 0.3rem;
  }
  .rule-text {
    font-size: 0.83rem;
    line-height: 1.5;
    color: #cfc8b4;
  }
  .rule-text :global(strong) {
    color: #e8e2d0;
  }

  .toggle-core {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    background: none;
    border: none;
    padding: 0;
    margin: 0 0 0.3rem;
    font: inherit;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #b8912f;
    cursor: pointer;
    text-align: left;
  }
  .chevron {
    font-size: 0.6rem;
    transition: transform 0.15s;
  }
  .chevron.open {
    transform: rotate(90deg);
  }

  .strat-list {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }
  .strat-row {
    padding-top: 0.5rem;
    border-top: 1px solid #2e2716;
  }
  .strat-list .strat-row:first-child {
    padding-top: 0;
    border-top: none;
  }
  .strat-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.5rem;
  }
  .strat-name {
    font-weight: 700;
    color: #f7e7ac;
    font-size: 0.88rem;
  }
  .strat-cp {
    flex-shrink: 0;
    font-size: 0.75rem;
    font-weight: 700;
    color: #14100a;
    background: #d4af37;
    border-radius: 999px;
    padding: 0.05rem 0.5rem;
  }
  .strat-meta {
    font-size: 0.72rem;
    color: #8a7a52;
    margin-top: 0.1rem;
  }
  .strat-text {
    font-size: 0.82rem;
    line-height: 1.45;
    color: #cfc8b4;
    margin-top: 0.3rem;
  }
  .strat-text :global(strong) {
    color: #e8e2d0;
  }
  .strat-no-text {
    font-style: italic;
    color: #776b48;
  }
</style>
