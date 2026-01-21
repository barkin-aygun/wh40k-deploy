<script>
  import { createEventDispatcher } from 'svelte';
  import { BASE_SIZES } from '../stores/models.js';

  export let unmatchedUnits = [];
  export let show = false;

  const dispatch = createEventDispatcher();

  // Track selections for each unmatched unit
  let selections = {};

  $: {
    // Initialize selections when unmatchedUnits changes
    selections = {};
    unmatchedUnits.forEach(unit => {
      selections[unit.id] = {
        baseType: '32mm', // Default to 32mm infantry base
        skip: false
      };
    });
  }

  // Get all available base types
  const allBaseTypes = [
    ...BASE_SIZES.circles.map(b => ({ value: b.type, label: b.label })),
    ...BASE_SIZES.ovals.map(b => ({ value: b.type, label: b.label })),
    { value: 'rect-custom', label: 'Custom Rectangle (Vehicle)' }
  ];

  function handleImport() {
    const selected = unmatchedUnits
      .filter(unit => !selections[unit.id]?.skip)
      .map(unit => ({
        unitName: unit.unitName,
        quantity: unit.quantity,
        baseType: selections[unit.id]?.baseType || '32mm'
      }));

    dispatch('import', { selected });
    handleClose();
  }

  function handleClose() {
    show = false;
    dispatch('close');
  }
</script>

{#if show}
  <div class="dialog-overlay" on:click={handleClose}>
    <div class="dialog" on:click={(e) => e.stopPropagation()}>
      <div class="dialog-header">
        <h3>Unmatched Units</h3>
        <button class="close-button" on:click={handleClose}>&times;</button>
      </div>

      <div class="dialog-content">
        <p class="info-text">
          The following units were not found in the database. Please select base sizes or skip them:
        </p>

        <div class="units-table">
          <table>
            <thead>
              <tr>
                <th>Unit Name</th>
                <th>Quantity</th>
                <th>Base Size</th>
                <th>Skip</th>
              </tr>
            </thead>
            <tbody>
              {#each unmatchedUnits as unit (unit.id)}
                <tr class:skipped={selections[unit.id]?.skip}>
                  <td class="unit-name">{unit.unitName}</td>
                  <td class="quantity">{unit.quantity || '1x'}</td>
                  <td>
                    <select
                      bind:value={selections[unit.id].baseType}
                      disabled={selections[unit.id]?.skip}
                    >
                      {#each allBaseTypes as baseType}
                        <option value={baseType.value}>{baseType.label}</option>
                      {/each}
                    </select>
                  </td>
                  <td class="skip-cell">
                    <input
                      type="checkbox"
                      bind:checked={selections[unit.id].skip}
                    />
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>

      <div class="dialog-footer">
        <button on:click={handleClose} class="cancel-button">Cancel</button>
        <button on:click={handleImport} class="import-button">Import Selected</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .dialog {
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
  }

  .dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #ddd;
  }

  .dialog-header h3 {
    margin: 0;
    font-size: 1.25rem;
    color: #333;
  }

  .close-button {
    background: none;
    border: none;
    font-size: 1.5rem;
    color: #666;
    cursor: pointer;
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-button:hover {
    color: #000;
  }

  .dialog-content {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .info-text {
    margin: 0 0 1rem 0;
    color: #666;
    font-size: 0.9rem;
  }

  .units-table {
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  thead {
    background-color: #f8f9fa;
  }

  th {
    padding: 0.75rem;
    text-align: left;
    font-weight: 600;
    font-size: 0.9rem;
    color: #333;
    border-bottom: 2px solid #ddd;
  }

  td {
    padding: 0.75rem;
    border-bottom: 1px solid #eee;
    color: #333;
  }

  tr.skipped {
    opacity: 0.5;
  }

  .unit-name {
    font-weight: 500;
    color: #222;
  }

  .quantity {
    color: #666;
    font-size: 0.9rem;
  }

  .skip-cell {
    text-align: center;
  }

  select {
    width: 100%;
    padding: 0.4rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 0.85rem;
  }

  select:disabled {
    background-color: #f5f5f5;
    cursor: not-allowed;
  }

  input[type="checkbox"] {
    cursor: pointer;
    width: 18px;
    height: 18px;
  }

  .dialog-footer {
    padding: 1rem 1.5rem;
    border-top: 1px solid #ddd;
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }

  button {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .cancel-button {
    background-color: #6c757d;
    color: white;
  }

  .cancel-button:hover {
    background-color: #5a6268;
  }

  .import-button {
    background-color: #007bff;
    color: white;
  }

  .import-button:hover {
    background-color: #0056b3;
  }
</style>
