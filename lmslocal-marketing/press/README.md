# press/

**PDFs that were actually sent to a printer** — tracked, unlike `out/`, because a reprint has to
match the first run and regeneration isn't byte-stable. Nothing else goes here; drafts and proofs
belong in `out/`.

Name them `YYYY-MM-DD-<source-file>[-bleed].pdf` (date sent to the printer; `-bleed` for the
`?bleed` export). Git history is permanent, so keep it to files a printer really received.
