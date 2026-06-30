# Source rules documents (11th edition)

Official Warhammer 40,000 11th edition reference PDFs, downloaded from
`assets.warhammer-community.com` (en-gb) for parsing into app changes.

**The PDFs themselves are git-ignored** (Games Workshop copyright; ~400 MB) — only
this folder structure and `MANIFEST.md` are tracked. `MANIFEST.md` lists every
document with its exact download URL, so any file can be re-fetched on demand:

```bash
# from docs/11th-edition/sources/
mkdir -p faction-packs event-companions core-and-key
# then curl the URLs from MANIFEST.md into the matching folder
```

## Layout

- `core-and-key/` — Core Rules, Terrain Area Footprints
- `faction-packs/` — 29 faction packs (datasheet updates + detachment rules)
- `event-companions/` — matched-play event companion packs

See `MANIFEST.md` for the full list, sizes, and URLs.
