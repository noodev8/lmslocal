# Mailing list

Builds the club mailing list for `docs/marketing-mailshot.md`. No build step, no
`package.json`, imported by nothing — plain Python 3, standard library only.

```bash
python build_pool.py    # casc-*.ods  -> pool.csv / pool.json   (7,714 clubs)
python sample.py        # pool.json   -> batch-one.csv          (400 clubs)
```

## The two files

- **`pool.csv` — the full clean list, 7,714 UK clubs.** Every mailable record in the
  register: name, split address, town, postcode, `club_type`. This is the asset. Drawing
  another batch is a draw from here, not a rebuild.
- **`batch-one.csv` — the 400 actually being posted**, with `variant`, `addressee` and
  `date_added` added.

## Drawing the next batch

**Always pass `--exclude`.** It is the whole of hygiene rule 6 — batch two never re-hits
batch one — and it matches on address rather than name, the same way the pool dedupes.

```bash
python sample.py --n 400 --out batch-two.csv --seed 20260901 --exclude "batch-*.csv"
```

`--football-share` changes the weighting (default 0.50 against a natural 10.6%). Give each
batch **its own seed and record it**, so any batch can be redrawn and audited later.

## What is in git, and why

Tracked: **the scripts and `casc-2026-07-17.ods`**. Ignored: **`pool.*` and `batch-*.csv`**.

`noodev8/lmslocal` is a **public** repo, which decides this. The register itself is Crown
copyright under the Open Government Licence and HMRC publishes it openly, so mirroring the
`.ods` is fine and pinning it is what makes the build reproducible — the gov.uk download URL
changes each time the register is updated.

The derived files are a different matter on both counts:

- They do not need to be in git. `build_pool.py` + `sample.py` regenerate them **byte for
  byte** from the tracked `.ods` and the recorded seed, so moving between machines needs
  nothing synced — clone, run the two commands, get the identical file.
- `batch-*.csv` is not public data even though it is built from public data. It records
  **who we chose to mail**, and once the results log is filled in, who replied. That is our
  own data about named people — a large share of CASC addresses are the secretary's home,
  not a clubhouse — and a public repo is the wrong place for it. Git history also makes
  removal awkward later.

**The one thing that genuinely needs syncing is the sent log.** Once a batch is posted it
stops being reproducible output and becomes a record: the send date, replies, signups. Keep
that copy safe and move it between machines by hand, or put it somewhere private. Do not
rely on regenerating it — `sample.py` validates postcodes against postcodes.io live, so a
redraw months later can differ by a few records as postcodes are retired.
