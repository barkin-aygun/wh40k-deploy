<script>
  import { formatRulesText } from '../lib/rulesText.js';

  export let rules; // output of buildRosterRules() — { armyRule, detachmentRules[] }

  $: hasContent = !!(rules && (rules.armyRule || rules.detachmentRules?.length));
</script>

{#if hasContent}
  <div class="roster-rules">
    {#if rules.armyRule}
      <article class="rule-card">
        <h4>Army Rule</h4>
        <div class="rule-name">{rules.armyRule.name}</div>
        <div class="rule-text">{@html formatRulesText(rules.armyRule.text)}</div>
      </article>
    {/if}

    {#each rules.detachmentRules as d, i (i)}
      <article class="rule-card">
        <h4>Detachment Rule — {d.name}</h4>
        <div class="rule-name">{d.ruleName}</div>
        <div class="rule-text">{@html formatRulesText(d.ruleText)}</div>
      </article>
    {/each}
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
</style>
