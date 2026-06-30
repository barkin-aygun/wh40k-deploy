# Warhammer 40,000 — 11th Edition Migration

This directory tracks the migration of the deployment planner from **10th edition** to
**11th edition** rules.

## Baseline (10th edition)

The complete 10th edition app is preserved at:

- **Commit:** `888e917` — *"Add range zones, measure tool panel, unit drag, and shared state persistence"*
- **Tag:** `10th` (annotated; created locally — see note below)

> Note: the `10th` git tag was created locally but could not be pushed to `origin`
> in the automated session (the remote push is scoped to the working branch and
> rejects other refs with a 403). To publish the tag from a machine with push
> access to tags:
>
> ```bash
> git tag -a 10th -m "Warhammer 40K 10th edition baseline" 888e917   # if not present
> git push origin 10th
> ```

## What's changing in 11th edition

To be filled in as rules documents are compiled. Known areas of impact for this app:

- [ ] **Deployment setups** — new/changed deployment maps and zone geometry
      (`src/stores/deployment.js`, `DEPLOYMENT_PRESETS`).
- [ ] **Terrain setups** — new official terrain layouts
      (`src/stores/layout.js`, `TERRAIN_LAYOUT_PRESETS`).
- [ ] **Visibility / line-of-sight rules** — changes to LOS / terrain-blocking
      mechanics (`src/lib/visibility/`).
- [ ] **Objectives** — control radius / scoring changes
      (`src/stores/deployment.js`, `objectives`).
- [ ] **Other** — coherency, base sizes, engagement/range rules as applicable.

## How to feed in documents

Drop source rules documents (PDFs, images, notes) into `docs/11th-edition/sources/`
and they will be parsed into concrete changes against the files above. Each change
should reference the relevant store/component so the 10th edition implementation can
be diffed cleanly.

## Migration log

| Date | Change | Files | Notes |
|------|--------|-------|-------|
| _tbd_ | _initial prep scaffold_ | `docs/11th-edition/` | Tagged 10th baseline, set up migration tracking |
