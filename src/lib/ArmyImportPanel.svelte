<script>
  import { createEventDispatcher } from 'svelte';
  import { armyImports } from '../stores/armyImports.js';

  export let currentPlayer = 1;

  const dispatch = createEventDispatcher();

  let armyListText = '';
  let loading = false;
  let error = '';
  let successMessage = '';
  let selectedImportId = '';

  function handleParse() {
    if (!armyListText.trim()) {
      error = 'Please paste an army list';
      return;
    }

    loading = true;
    error = '';
    successMessage = '';

    // Dispatch event to parent to handle parsing
    dispatch('parse', {
      text: armyListText,
      playerId: currentPlayer
    });
  }

  function handleLoadImport() {
    if (!selectedImportId) return;

    const importData = armyImports.getImport(selectedImportId);
    if (importData) {
      armyListText = importData.rawText;
      successMessage = `Loaded: ${importData.name} (${importData.faction}, ${importData.totalPoints})`;
      error = '';
    }
  }

  function handleClear() {
    armyListText = '';
    error = '';
    successMessage = '';
  }

  // Export functions for parent to call
  export function setLoading(value) {
    loading = value;
  }

  export function setError(message) {
    error = message;
    successMessage = '';
    loading = false;
  }

  export function setSuccess(message) {
    successMessage = message;
    error = '';
    loading = false;
  }

  export function clearText() {
    armyListText = '';
  }
</script>

<div class="army-import-panel">
  <div class="form-group">
    <label for="army-list-input">Paste Army List:</label>
    <textarea
      id="army-list-input"
      bind:value={armyListText}
      placeholder="Paste your army list here (GW App, WTC, ListForge formats supported)"
      rows="12"
      disabled={loading}
    ></textarea>
  </div>

  <div class="button-group">
    <button on:click={handleParse} disabled={loading || !armyListText.trim()}>
      {loading ? 'Parsing...' : 'Parse Army List'}
    </button>
    <button on:click={handleClear} disabled={loading}>
      Clear
    </button>
  </div>

  {#if error}
    <div class="error-message">
      ⚠️ {error}
    </div>
  {/if}

  {#if successMessage}
    <div class="success-message">
      ✓ {successMessage}
    </div>
  {/if}

  <div class="divider"></div>

  <div class="form-group">
    <label for="import-select">Load Previous Import:</label>
    <select id="import-select" bind:value={selectedImportId} disabled={loading}>
      <option value="">-- Select an import --</option>
      {#each $armyImports as importData (importData.id)}
        <option value={importData.id}>
          {importData.name} ({importData.faction}, {importData.totalPoints})
        </option>
      {/each}
    </select>
    <button
      on:click={handleLoadImport}
      disabled={loading || !selectedImportId}
      class="load-button"
    >
      Load
    </button>
  </div>
</div>

<style>
  .army-import-panel {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  label {
    font-weight: 600;
    font-size: 0.9rem;
    color: #333;
  }

  textarea {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.85rem;
    resize: vertical;
    min-height: 200px;
  }

  textarea:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
  }

  .button-group {
    display: flex;
    gap: 0.5rem;
  }

  button {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    background-color: #007bff;
    color: white;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  button:hover:not(:disabled) {
    background-color: #0056b3;
  }

  button:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }

  .load-button {
    margin-top: 0.5rem;
    width: 100%;
  }

  .error-message {
    padding: 0.75rem;
    background-color: #f8d7da;
    border: 1px solid #f5c6cb;
    border-radius: 4px;
    color: #721c24;
    font-size: 0.9rem;
  }

  .success-message {
    padding: 0.75rem;
    background-color: #d4edda;
    border: 1px solid #c3e6cb;
    border-radius: 4px;
    color: #155724;
    font-size: 0.9rem;
  }

  .divider {
    height: 1px;
    background-color: #ddd;
    margin: 0.5rem 0;
  }

  select {
    padding: 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 0.9rem;
  }

  select:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
  }
</style>
