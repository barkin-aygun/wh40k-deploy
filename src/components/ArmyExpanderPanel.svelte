<script>
  import { expandArmyList } from '../lib/services/armyExpander.js';

  let inputText = '';
  let result = null;
  let error = '';
  let view = 'readable'; // 'readable' | 'json'
  let copied = false;

  function handleExpand() {
    error = '';
    result = null;
    copied = false;
    const text = inputText.trim();
    if (!text) {
      error = 'Paste a compacted (or full) army list first.';
      return;
    }
    try {
      result = expandArmyList(text);
    } catch (e) {
      error = e.message || 'Failed to expand list.';
    }
  }

  function handleClear() {
    inputText = '';
    result = null;
    error = '';
    copied = false;
  }

  $: outputText = result
    ? view === 'json'
      ? JSON.stringify(result.normalized, null, 2)
      : result.text
    : '';

  async function copyOutput() {
    if (!outputText) return;
    try {
      await navigator.clipboard.writeText(outputText);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      copied = false;
    }
  }
</script>

<div class="expander">
  <div class="io">
    <div class="col">
      <label for="expander-input">Compacted list (or any supported full list)</label>
      <textarea
        id="expander-input"
        bind:value={inputText}
        placeholder={"Paste a 40kCompactor compacted list here, e.g.\n\nMy List | Chaos - World Eaters | Berzerker Warband | 2000pts\n\n• Khârn the Betrayer (Warlord, ...) [115]\n• 3x10 Khorne Berzerkers (IoK, ...) [180]"}
        rows="16"
        spellcheck="false"
      ></textarea>
      <div class="buttons">
        <button class="primary" on:click={handleExpand} disabled={!inputText.trim()}>Expand</button>
        <button on:click={handleClear} disabled={!inputText && !result}>Clear</button>
      </div>
      {#if error}
        <div class="error">⚠ {error}</div>
      {/if}
    </div>

    <div class="col">
      <div class="output-head">
        <div class="tabs">
          <button class:active={view === 'readable'} on:click={() => (view = 'readable')}>Readable</button>
          <button class:active={view === 'json'} on:click={() => (view = 'json')}>Datasheet JSON</button>
        </div>
        <button class="copy" on:click={copyOutput} disabled={!outputText}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre class="output">{outputText || 'Expanded output appears here.'}</pre>
    </div>
  </div>

  {#if result}
    <div class="meta">
      <span class="badge">input: {result.inputKind}</span>
      <span class="badge">format: {result.format}</span>
      {#if result.normalized.faction}<span class="badge">{result.normalized.faction}</span>{/if}
      {#if result.normalized.detachment}<span class="badge">{result.normalized.detachment}</span>{/if}
      {#if result.normalized.points}<span class="badge">{result.normalized.points}</span>{/if}
      <span class="badge">{result.normalized.units.length} units</span>
      <span class="badge" class:warn={result.warnings.length}>
        {result.warnings.length} unresolved
      </span>
    </div>

    {#if result.warnings.length}
      <details class="warnings" open>
        <summary>{result.warnings.length} abbreviation(s) could not be resolved</summary>
        <ul>
          {#each result.warnings as w}
            <li>
              <code>{w.abbreviation}</code>
              <span class="wtype">{w.kind} {w.itemType}</span>
              in <em>{w.context}</em>
              {#if w.options && w.options.length}
                — candidates: {w.options.join(' | ')}
              {/if}
            </li>
          {/each}
        </ul>
        <p class="hint">
          Ambiguous abbreviations (e.g. two weapons sharing initials) need unit-level
          datasheet context to resolve. Unresolved ones aren't in the dictionary yet.
        </p>
      </details>
    {/if}
  {/if}
</div>

<style>
  .expander {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .io {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }
  @media (max-width: 820px) {
    .io { grid-template-columns: 1fr; }
  }
  .col {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
  }
  label {
    font-size: 0.8rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #8a7a52;
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
  textarea:focus { outline: none; border-color: #b8912f; }
  .buttons { display: flex; gap: 0.5rem; }
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
  button:hover:not(:disabled) { background: #2a2114; border-color: #b8912f; }
  button:disabled { opacity: 0.45; cursor: not-allowed; }
  button.primary { background: #b8912f; color: #14100a; border-color: #d4af37; }
  button.primary:hover:not(:disabled) { background: #d4af37; }

  .output-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .tabs { display: flex; gap: 0.25rem; }
  .tabs button { padding: 0.3rem 0.7rem; font-size: 0.75rem; }
  .tabs button.active { color: #f7e7ac; border-color: #b8912f; background: #2a2114; }
  .copy { padding: 0.3rem 0.7rem; font-size: 0.75rem; }

  .output {
    margin: 0;
    background: #0f0d09;
    color: #cfc8b4;
    border: 1px solid #3a3320;
    border-radius: 4px;
    padding: 0.6rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.8rem;
    line-height: 1.45;
    white-space: pre-wrap;
    overflow-x: auto;
    min-height: 22rem;
    max-height: 34rem;
    overflow-y: auto;
  }

  .meta { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .badge {
    font-size: 0.72rem;
    padding: 0.2rem 0.5rem;
    border-radius: 999px;
    background: #1c1810;
    border: 1px solid #3a3320;
    color: #b8a76f;
  }
  .badge.warn { color: #e0a03a; border-color: #6b4e18; background: #241a0c; }

  .error {
    color: #e88; font-size: 0.85rem;
    background: #2a1414; border: 1px solid #6b2020;
    border-radius: 4px; padding: 0.5rem 0.7rem;
  }

  .warnings {
    background: #150f07;
    border: 1px solid #3a3320;
    border-radius: 4px;
    padding: 0.5rem 0.8rem;
    font-size: 0.82rem;
    color: #cfc8b4;
  }
  .warnings summary { cursor: pointer; color: #e0a03a; font-weight: 600; }
  .warnings ul { margin: 0.5rem 0 0; padding-left: 1.1rem; }
  .warnings li { margin: 0.2rem 0; }
  .warnings code {
    background: #2a2114; color: #f7e7ac;
    padding: 0.05rem 0.35rem; border-radius: 3px;
  }
  .wtype { color: #8a7a52; font-size: 0.75rem; }
  .hint { color: #776b48; font-size: 0.75rem; margin: 0.5rem 0 0; }
</style>
