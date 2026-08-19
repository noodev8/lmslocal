"""Stage 2: draw the batch-one mailing list from the pool.

Rules from docs/marketing-mailshot.md 8b:
  2. UK-wide, randomly sampled - never the first N by name or county.
  3. Football-weighted, not football-only; club_type recorded for observation only.
  4. Variant assigned at random, independently of source, region and club type,
     so the variant is not confounded with whatever the list was ordered by.
  5. Addressee is 'The Secretary' - CASC records no contact name.
"""
import json, random, csv, datetime, urllib.request, collections, argparse, glob, os, re

TARGET = 400
FOOTBALL_SHARE = 0.50      # pool is 10.6% football; the hook is live Premier League
SEED = 20260819            # recorded so the draw is reproducible and auditable


def addr_key(club):
    """Identity of a mailing, matching the pool's dedupe: address + postcode, not name."""
    parts = [club.get('address_1', ''), club.get('address_2', ''),
             club.get('address_3', ''), club.get('town', '')]
    return (re.sub(r'[^a-z0-9]', '', ''.join(parts).lower()),
            club['postcode'].replace(' ', '').upper())


def already_sent(patterns):
    """Every club in every previous batch file. Rule 6: batch two never re-hits batch one."""
    sent = set()
    for pat in patterns:
        for path in sorted(glob.glob(pat)):
            with open(path, newline='', encoding='utf-8') as f:
                rows = list(csv.DictReader(f))
            for r in rows:
                sent.add(addr_key(r))
            print(f'  excluding {len(rows):4} from {os.path.basename(path)}')
    return sent


def validate_postcodes(codes):
    """postcodes.io, 100 at a time. Catches codes that no longer exist."""
    ok = {}
    for i in range(0, len(codes), 100):
        chunk = codes[i:i + 100]
        req = urllib.request.Request(
            'https://api.postcodes.io/postcodes',
            data=json.dumps({'postcodes': chunk}).encode(),
            headers={'Content-Type': 'application/json'})
        with urllib.request.urlopen(req, timeout=30) as r:
            for row in json.load(r)['result']:
                ok[row['query']] = bool(row['result'])
    return ok


def main():
    ap = argparse.ArgumentParser(description='Draw a mailing batch from pool.json.')
    ap.add_argument('--n', type=int, default=TARGET, help='batch size')
    ap.add_argument('--out', default='batch-one.csv', help='output CSV')
    ap.add_argument('--seed', type=int, default=SEED, help='draw seed, recorded per batch')
    ap.add_argument('--football-share', type=float, default=FOOTBALL_SHARE)
    ap.add_argument('--exclude', nargs='*', default=[],
                    help='previous batch CSVs to exclude (accepts globs)')
    args = ap.parse_args()

    pool = json.load(open('pool.json'))
    rng = random.Random(args.seed)

    if args.exclude:
        sent = already_sent(args.exclude)
        before = len(pool)
        pool = [c for c in pool if addr_key(c) not in sent]
        print(f'  pool {before} -> {len(pool)} after exclusions')

    football = [c for c in pool if c['club_type'] == 'football']
    other = [c for c in pool if c['club_type'] == 'other']
    n_fb = round(args.n * args.football_share)

    # Oversample, then trim after postcode validation drops the dead ones.
    pad = 60
    if n_fb > len(football) or args.n - n_fb > len(other):
        raise SystemExit(f'pool too small: want {n_fb} football / {args.n - n_fb} other, '
                         f'have {len(football)} / {len(other)}')
    picked = (rng.sample(football, min(n_fb + pad // 2, len(football)))
              + rng.sample(other, min(args.n - n_fb + pad // 2, len(other))))

    live = validate_postcodes(sorted({c['postcode'] for c in picked}))
    dead = [c for c in picked if not live.get(c['postcode'])]
    picked = [c for c in picked if live.get(c['postcode'])]
    print(f'postcode check: {len(picked)} live, {len(dead)} dead and dropped')

    # Trim back to the exact split, keeping the draw random.
    fb = [c for c in picked if c['club_type'] == 'football'][:n_fb]
    ot = [c for c in picked if c['club_type'] == 'other'][:args.n - n_fb]
    batch = fb + ot
    assert len(batch) == args.n, len(batch)

    # Rule 4: variant is drawn independently, then the file is shuffled so the
    # print run is not ordered by club type either.
    rng.shuffle(batch)
    variants = ['a'] * (args.n // 2) + ['b'] * (args.n // 2)
    rng.shuffle(variants)
    today = datetime.date.today().isoformat()
    for c, v in zip(batch, variants):
        c['variant'] = v
        c['addressee'] = 'The Secretary'
        c['date_added'] = today

    cols = ['club_name', 'addressee', 'address_1', 'address_2', 'town', 'postcode',
            'club_type', 'variant', 'source', 'date_added']
    with open(args.out, 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction='ignore')
        w.writeheader()
        for c in batch:
            # address_3 is rare; fold it into address_2 so the label keeps every line.
            if c.get('address_3'):
                c['address_2'] = (c['address_2'] + ', ' + c['address_3']).strip(', ')
            w.writerow(c)

    print('written', args.out + ':', len(batch))
    print('  by variant :', dict(collections.Counter(c['variant'] for c in batch)))
    print('  by type    :', dict(collections.Counter(c['club_type'] for c in batch)))
    print('  cross      :', dict(collections.Counter((c['club_type'], c['variant']) for c in batch)))
    print('  pc areas   :', len({__import__('re').match(r'[A-Z]+', c['postcode']).group() for c in batch}))
    print('  no town    :', sum(1 for c in batch if not c['town']))


if __name__ == '__main__':
    main()
