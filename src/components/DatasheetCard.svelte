<script>
  import { formatRulesText } from '../lib/rulesText.js';

  export let sheet; // output of buildUnitDatasheet()

  let open = true;

  const STAT_COLS = [
    { key: 'M', label: 'M' },
    { key: 'T', label: 'T' },
    { key: 'Sv', label: 'Sv' },
    { key: 'W', label: 'W' },
    { key: 'LD', label: 'Ld' },
    { key: 'OC', label: 'OC' },
  ];

  const WEAPON_COLS = [
    { key: 'Range', label: 'Range' },
    { key: 'A', label: 'A' },
    { key: 'BS', label: 'BS' },
    { key: 'WS', label: 'WS' },
    { key: 'S', label: 'S' },
    { key: 'AP', label: 'AP' },
    { key: 'D', label: 'D' },
  ];

  function statCols(chars) {
    const cols = STAT_COLS.filter((c) => chars[c.key] !== undefined);
    if (chars.InSv) cols.push({ key: 'InSv', label: 'Inv Sv' });
    return cols;
  }

  function weaponCols(chars) {
    return WEAPON_COLS.filter((c) => chars[c.key] !== undefined && chars[c.key] !== '');
  }

  function allWargear(s) {
    // Flatten unit-level wargear + every sub-model's wargear into one list of
    // { name, quantity, profile, owner } for a single combined weapons section.
    const rows = s.wargear.map((w) => ({ ...w, owner: null }));
    for (const m of s.models) {
      for (const w of m.wargear) rows.push({ ...w, owner: m.name });
    }
    return rows;
  }

  $: weaponRows = sheet ? allWargear(sheet).filter((w) => w.profile) : [];
  $: plainWargear = sheet ? allWargear(sheet).filter((w) => !w.profile) : [];
</script>

<article class="sheet" class:not-found={!sheet.found}>
  <button class="sheet-header" on:click={() => (open = !open)} type="button">
    <div class="title-row">
      <span class="chevron" class:open>▶</span>
      <h3>
        {#if sheet.quantity > 1}<span class="qty">{sheet.quantity}x</span>{/if}
        {sheet.name}
      </h3>
      <span class="points">{sheet.points} pts</span>
    </div>
    <div class="badges">
      {#if sheet.warlord}<span class="badge warlord">Warlord</span>{/if}
      {#if sheet.attachment}<span class="badge attach">{sheet.attachment}</span>{/if}
      {#if !sheet.found}<span class="badge missing">No datasheet match</span>{/if}
    </div>
  </button>

  {#if open}
    <div class="sheet-body">
      {#if sheet.keywords.length || sheet.factionKeyword}
        <div class="keywords">
          {#if sheet.factionKeyword}<span class="kw faction">{sheet.factionKeyword}</span>{/if}
          {#each sheet.keywords as k}<span class="kw">{k}</span>{/each}
        </div>
      {/if}

      {#if sheet.stats.length}
        <div class="table-wrap">
          <table class="stat-table">
            <thead>
              <tr>
                <th class="name-col">Model</th>
                {#each statCols(sheet.stats[0].chars) as c}<th>{c.label}</th>{/each}
              </tr>
            </thead>
            <tbody>
              {#each sheet.stats as row}
                <tr>
                  <td class="name-col">{row.name}</td>
                  {#each statCols(row.chars) as c}<td>{row.chars[c.key]}</td>{/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}

      {#if sheet.abilities.length}
        <div class="block">
          <h4>Abilities</h4>
          {#each sheet.abilities as a}
            <div class="ability">
              <span class="ability-name">{a.name}:</span>
              <span class="ability-text">{@html formatRulesText(a.text)}</span>
            </div>
          {/each}
        </div>
      {/if}

      {#if sheet.enhancements.length}
        <div class="block">
          <h4>Enhancements</h4>
          {#each sheet.enhancements as e}
            <div class="enhancement">
              <div class="enhancement-head">
                <span class="enhancement-name">{e.name}</span>
                {#if e.points != null}<span class="enhancement-pts">+{e.points} pts</span>{/if}
              </div>
              {#if e.text}<div class="enhancement-text">{@html formatRulesText(e.text)}</div>{/if}
            </div>
          {/each}
        </div>
      {/if}

      {#if weaponRows.length}
        <div class="block">
          <h4>Wargear</h4>
          {#each weaponRows as w}
            <div class="weapon">
              <div class="weapon-name">
                {#if w.quantity > 1}<span class="wqty">{w.quantity}x</span>{/if}
                {w.name}
                {#if w.owner}<span class="owner">({w.owner})</span>{/if}
              </div>
              <div class="table-wrap">
                <table class="weapon-table">
                  <thead>
                    <tr>
                      {#if w.profile.profiles.length > 1}<th class="name-col">Mode</th>{/if}
                      {#each weaponCols(w.profile.profiles[0].chars) as c}<th>{c.label}</th>{/each}
                    </tr>
                  </thead>
                  <tbody>
                    {#each w.profile.profiles as p}
                      <tr>
                        {#if w.profile.profiles.length > 1}<td class="name-col">{p.mode}</td>{/if}
                        {#each weaponCols(p.chars) as c}<td>{p.chars[c.key]}</td>{/each}
                      </tr>
                    {/each}
                  </tbody>
                </table>
              </div>
              {#each w.profile.profiles as p}
                {#if p.chars.Keywords && p.chars.Keywords !== '-'}
                  <div class="weapon-keywords">{p.chars.Keywords}</div>
                {/if}
              {/each}
            </div>
          {/each}
        </div>
      {/if}

      {#if plainWargear.length}
        <div class="block">
          {#if !weaponRows.length}<h4>Wargear</h4>{/if}
          <ul class="plain-list">
            {#each plainWargear as w}
              <li>
                {#if w.quantity > 1}{w.quantity}x {/if}{w.name}
                {#if w.owner}<span class="owner">({w.owner})</span>{/if}
              </li>
            {/each}
          </ul>
        </div>
      {/if}
    </div>
  {/if}
</article>

<style>
  .sheet {
    background: #150f07;
    border: 1px solid #3a3320;
    border-radius: 6px;
    overflow: hidden;
  }
  .sheet.not-found {
    border-color: #5a3a1a;
  }

  .sheet-header {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.7rem 0.9rem;
    background: #1c1810;
    border: none;
    cursor: pointer;
    text-align: left;
    font: inherit;
    color: inherit;
  }
  .sheet-header:hover {
    background: #241d12;
  }

  .title-row {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }
  .chevron {
    color: #8a7a52;
    font-size: 0.65rem;
    transition: transform 0.15s;
    flex-shrink: 0;
  }
  .chevron.open {
    transform: rotate(90deg);
  }
  h3 {
    margin: 0;
    flex: 1;
    font-family: 'Cinzel', 'Trajan Pro', serif;
    font-size: 1rem;
    letter-spacing: 0.02em;
    color: #f7e7ac;
    font-weight: 700;
  }
  .qty {
    color: #b8a76f;
    font-weight: 600;
    margin-right: 0.3em;
  }
  .points {
    font-size: 0.8rem;
    font-weight: 700;
    color: #d4af37;
    flex-shrink: 0;
  }

  .badges {
    display: flex;
    gap: 0.35rem;
    flex-wrap: wrap;
  }
  .badge {
    font-size: 0.68rem;
    padding: 0.1rem 0.45rem;
    border-radius: 999px;
    border: 1px solid #3a3320;
    background: #241d12;
    color: #b8a76f;
  }
  .badge.warlord {
    color: #f7e7ac;
    border-color: #b8912f;
    background: #2a2114;
  }
  .badge.attach {
    color: #9fc2d8;
  }
  .badge.missing {
    color: #e0a03a;
    border-color: #6b4e18;
  }

  .sheet-body {
    padding: 0.8rem 0.9rem 0.9rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    font-size: 0.83rem;
    color: #cfc8b4;
  }

  .keywords {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }
  .kw {
    font-size: 0.68rem;
    padding: 0.08rem 0.4rem;
    border-radius: 3px;
    background: #241d12;
    color: #8a7a52;
    border: 1px solid #2e2716;
  }
  .kw.faction {
    color: #d4af37;
    border-color: #4a3d1f;
  }

  h4 {
    margin: 0 0 0.35rem;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #8a7a52;
  }

  .table-wrap {
    overflow-x: auto;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 0.78rem;
  }
  th, td {
    padding: 0.25rem 0.5rem;
    text-align: center;
    border-bottom: 1px solid #2e2716;
    white-space: nowrap;
  }
  th {
    color: #8a7a52;
    font-weight: 600;
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  td {
    color: #e8e2d0;
  }
  .name-col {
    text-align: left;
    color: #cfc8b4;
    font-weight: 600;
  }

  .ability, .enhancement, .weapon {
    margin-bottom: 0.55rem;
  }
  .ability:last-child, .enhancement:last-child, .weapon:last-child {
    margin-bottom: 0;
  }
  .ability-name {
    font-weight: 700;
    color: #e8e2d0;
  }
  .ability-text, .enhancement-text {
    color: #a89b78;
    line-height: 1.45;
  }
  .ability-text :global(strong), .enhancement-text :global(strong) {
    color: #cfc8b4;
  }

  .enhancement-head {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .enhancement-name {
    font-weight: 700;
    color: #f7e7ac;
  }
  .enhancement-pts {
    color: #d4af37;
    font-size: 0.75rem;
  }
  .enhancement-text {
    margin-top: 0.15rem;
  }

  .weapon-name {
    font-weight: 600;
    color: #e8e2d0;
    margin-bottom: 0.2rem;
  }
  .wqty {
    color: #b8a76f;
    margin-right: 0.25em;
  }
  .owner {
    color: #776b48;
    font-weight: 400;
    font-size: 0.75rem;
    margin-left: 0.3em;
  }
  .weapon-keywords {
    font-style: italic;
    color: #776b48;
    font-size: 0.73rem;
    margin-top: 0.15rem;
  }

  .plain-list {
    margin: 0;
    padding-left: 1.1rem;
    color: #a89b78;
  }
  .plain-list li {
    margin: 0.1rem 0;
  }
</style>
