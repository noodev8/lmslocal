# Mailing list

Builds a club mailing list from the CASC register for a posted leaflet batch. Plain Python 3,
standard library only.

```bash
python build_pool.py    # casc-*.ods -> pool.csv / pool.json   (~7,700 clubs)
python sample.py --n 400 --out batch-two.csv --seed <seed> --exclude "batch-*.csv"
```

- **Always pass `--exclude`** so a new batch never re-mails an earlier one (matched on address).
- Give each batch its own seed and record it, so it can be redrawn.
- Only the scripts and the pinned `.ods` are tracked. `pool.*` and `batch-*.csv` are git-ignored:
  this repo is public, and a batch records who we chose to mail (often a secretary's home
  address). Once a batch is posted, keep its sent/replies log somewhere private — a redraw can
  differ because `sample.py` validates postcodes live.
