# press/

**PDFs that were actually sent to a printer.** Tracked in git, unlike `out/`.

Nothing else goes in here. Drafts, proofs, "final v2", anything you exported to look at — those
belong in `out/`, which is ignored. Everything in this folder should be a file a print shop has
received or is about to receive.

## Why this folder exists when `out/` is ignored

The leaflets regenerate from the HTML in two minutes on any machine with Chrome, so a generated
PDF is normally worth nothing: the artwork source is the HTML, and that is already in git.

A sent file is different. It is a record rather than an artifact:

- A **reprint has to match the first run.** "Another 200 of the same" means the same file.
- **Regeneration is not byte-stable.** Chrome updates shift line-breaking slightly, and Google
  can reissue a webfont. Unlikely to bite, but if it does it bites after the reprint is on the
  noticeboard next to the original.

## Naming

`YYYY-MM-DD-<source-file>.pdf`, date being when it went to the printer:

```
2026-08-13-a5-player-1992.pdf
2026-09-01-a5-landlord-bleed.pdf
```

Say `-bleed` in the name when it is the `?bleed` export, because the two are not
interchangeable and are indistinguishable once they are PDFs.

## Keep it small

Each of these is a few hundred KB, and **git history cannot be pruned afterwards** — a file
committed here is in the repo permanently. A handful a year is free. A folder of drafts is not,
which is the entire reason `out/` is ignored and this one is narrow.
