<script>
  import { expandArmyList } from '../lib/services/armyExpander.js';
  import { buildArmyDatasheets } from '../lib/services/datasheetLookup.js';
  import DatasheetCard from './DatasheetCard.svelte';

  let inputText = '';
  let result = null;
  let sheets = [];
  let error = '';

  function handleShow() {
    error = '';
    result = null;
    sheets = [];
    const text = inputText.trim();
    if (!text) {
      error = 'Paste an army list first — compacted or full, any supported format.';
      return;
    }
    try {
      result = expandArmyList(text);
      sheets = buildArmyDatasheets(result.normalized);
    } catch (e) {
      error = e.message || 'Failed to parse list.';
    }
  }

  function handleClear() {
    inputText = '';
    result = null;
    sheets = [];
    error = '';
  }

  $: missingCount = sheets.filter((s) => !s.found).length;
</script>

<div class="viewer">
  <div class="input-row">
    <textarea
      bind:value={inputText}
      placeholder={"Paste your army list here — compacted (Discord/plain) or full-name (GW App, WTC, WTC-Compact, NR, ListForge)."}
      rows="8"
      spellcheck="false"
    ></textarea>
    <div class="buttons">
      <button class="primary" on:click={handleShow} disabled={!inputText.trim()}>Show Datasheets</button>
      <button on:click={handleClear} disabled={!inputText && !result}>Clear</button>
    </div>
    {#if error}<div class="error">⚠ {error}</div>{/if}
  </div>

  {#if result}
    <div class="meta">
      {#if result.normalized.title}<span class="badge">{result.normalized.title}</span>{/if}
      <span class="badge">{result.normalized.displayFaction || result.normalized.faction}</span>
      {#if result.normalized.detachment}<span class="badge">{result.normalized.detachment}</span>{/if}
      {#if result.normalized.points}<span class="badge">{result.normalized.points}</span>{/if}
      <span class="badge">{sheets.length} units</span>
      {#if missingCount}<span class="badge warn">{missingCount} without a datasheet match</span>{/if}
    </div>

    <div class="sheets">
      {#each sheets as sheet, i (i)}
        <DatasheetCard {sheet} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .viewer {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .input-row {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  textarea {
    width: 100%;
    box-sizing: border-box;
    background: #0f0d09;
    color: #e8e2d0;
    border: 1px solid #3a3320;
    border-radius: 4px;
    padding: 0.6rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.82rem;
    line-height: 1.4;
    resize: vertical;
  }
  textarea:focus {
    outline: none;
    border-color: #b8912f;
  }

  .buttons {
    display: flex;
    gap: 0.5rem;
  }
  button {
    padding: 0.45rem 0.9rem;
    border: 1px solid #3a3320;
    border-radius: 4px;
    background: #1c1810;
    color: #d4af37;
    font-weight: 600;
    font-size: 0.8rem;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }
  button:hover:not(:disabled) {
    background: #2a2114;
    border-color: #b8912f;
  }
  button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
  button.primary {
    background: #b8912f;
    color: #14100a;
    border-color: #d4af37;
  }
  button.primary:hover:not(:disabled) {
    background: #d4af37;
  }

  .error {
    color: #e88;
    font-size: 0.85rem;
    background: #2a1414;
    border: 1px solid #6b2020;
    border-radius: 4px;
    padding: 0.5rem 0.7rem;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
  }
  .badge {
    font-size: 0.72rem;
    padding: 0.2rem 0.5rem;
    border-radius: 999px;
    background: #1c1810;
    border: 1px solid #3a3320;
    color: #b8a76f;
  }
  .badge.warn {
    color: #e0a03a;
    border-color: #6b4e18;
    background: #241a0c;
  }

  .sheets {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
</style>
