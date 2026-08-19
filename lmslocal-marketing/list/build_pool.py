"""Stage 1: CASC register -> a clean, typed, deduplicated pool of mailable clubs."""
import re, json, csv
from ods import read_ods
from dewrap import build_vocab, dewrap

CASC_FILE = 'casc-2026-07-17.ods'   # HMRC register, downloaded 19 Aug 2026

PC_RE = re.compile(r'^([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})$', re.I)

COUNTIES = {c.lower() for c in """
Bedfordshire Berkshire Bristol Buckinghamshire Bucks Cambridgeshire Cambs Cheshire Cleveland
Cornwall Cumbria Derbyshire Devon Dorset Durham Essex Gloucestershire Glos Hampshire Hants
Herefordshire Hertfordshire Herts Humberside Kent Lancashire Lancs Leicestershire Leics
Lincolnshire Lincs Merseyside Middlesex Middx Norfolk Northamptonshire Northants Northumberland
Nottinghamshire Notts Oxfordshire Oxon Rutland Shropshire Salop Somerset Staffordshire Staffs
Suffolk Surrey Sussex Warwickshire Warks Wiltshire Wilts Worcestershire Worcs Yorkshire
'East Sussex' 'West Sussex' 'East Yorkshire' 'North Yorkshire' 'South Yorkshire' 'West Yorkshire'
'West Midlands' 'Tyne and Wear' 'Greater Manchester' 'Greater London'
Clwyd Dyfed Gwent Gwynedd Powys Glamorgan 'Mid Glamorgan' 'South Glamorgan' 'West Glamorgan'
Angus Ayrshire Fife Lanarkshire Lothian Perthshire Renfrewshire Stirlingshire
Antrim Armagh Down Fermanagh Londonderry Tyrone
England Scotland Wales 'Northern Ireland' UK
""".replace("'", '"').split()}
COUNTIES |= {"east sussex","west sussex","east yorkshire","north yorkshire","south yorkshire",
    "west yorkshire","west midlands","tyne and wear","greater manchester","greater london",
    "mid glamorgan","south glamorgan","west glamorgan","northern ireland","north humberside",
    "south humberside","isle of wight","east lothian","west lothian","co durham","county durham"}

# Football first (the hook is live Premier League); everything else is 'other'.
FOOTBALL_RE = re.compile(
    r'(\bf\.?\s?c\.?\b|\ba\.?f\.?c\.?\b|\bfootball\b|\bsoccer\b|\bunited\b|\brovers\b'
    r'|\bwanderers\b|\balbion\b|\bathletic\b|\bhotspur\b|\btown\b(?=.*\bf)|\bcolts\b)', re.I)
# Words that make an 'athletic'/'town' match a false positive (athletics clubs, not football)
# 'Rugby/Gaelic/American Football Club' is not the game the leaflet is about. These stay
# in the pool as club_type 'other' (the filter is 'sporty club with members'), not excluded.
# 'Rugby/Gaelic/American Football Club' is not the game the leaflet is about. These stay
# in the pool as club_type 'other' (the filter is 'sporty club with members'), not excluded.
NOT_FOOTBALL_RE = re.compile(
    r'\bathletics\b|\bharriers\b|\btriathl|\bcycl|\bswim|\brugby\b|\bamerican\b'
    r'|\bgaelic\b|\bhockey\b|\bnetball\b|\bbowl|\brufc\b|\barlfc\b|\brlfc\b|\bgac\b'
    r'|\bcamogie\b|\bhurling\b|\bbasketball\b|\bmotor\b', re.I)

SMALL = {'and','of','the','on','in','at','upon','under','le','la','de'}
ACRONYMS = {'fc','afc','rfc','cc','rufc','ufc','bc','uk','ymca','usc','cic','rbl',
            'st','ss','jfc','yfc','fcc','tc','gc','hc','sc','asc','abc','cricket'}

def titlecase(s):
    """CASC stores 72% of names in caps; labels want mixed case, acronyms preserved."""
    if not s: return s
    if not (s.isupper() or s.islower()): return s.strip()   # already mixed - leave alone
    out=[]
    for i, w in enumerate(s.split()):
        core = w.strip('.,()').lower()
        if core in ACRONYMS and core not in ('st','cricket'):
            out.append(w.upper())
        elif core in SMALL and i>0:
            out.append(core)
        elif "'" in w and len(w)>2:              # King's, O'Neill
            p=w.split("'"); out.append(p[0].capitalize()+"'"+p[1].lower())
        elif '-' in w:
            out.append('-'.join(x.capitalize() for x in w.split('-')))
        else:
            out.append(w.capitalize())
    return ' '.join(out)

def norm_pc(pc):
    m = PC_RE.match(pc.strip().replace('  ',' '))
    return f'{m.group(1).upper()} {m.group(2).upper()}' if m else None

def clean_lines(row):
    name = row[0].strip()
    lines = []
    for l in row[1:5]:
        l = l.strip()
        if not l or l.upper() == 'NA':
            continue
        if l.lower() == name.lower():           # 1,519 rows repeat the club name as line 1
            continue
        if l.lower() in COUNTIES:               # county is not a delivery line
            continue
        if lines and l.lower() == lines[-1].lower():
            continue
        lines.append(titlecase(l))
    return lines

def classify(name):
    if FOOTBALL_RE.search(name) and not NOT_FOOTBALL_RE.search(name):
        return 'football'
    return 'other'

def main():
    rows = read_ods(CASC_FILE)['Report_1'][1:]
    rows = [r + [''] * (6 - len(r)) for r in rows]
    # The export wraps fields at 40 chars by injecting a space mid-word - undo it first,
    # or 312 club names go onto labels as 'ANGLING ASSOCIATIO N'.
    vocab = build_vocab([r[c] for r in rows for c in range(5)])
    rows = [[dewrap(r[c], vocab) for c in range(5)] + [r[5]] for r in rows]

    pool, dropped = [], {'no_postcode': 0, 'no_address': 0, 'dup_address': 0}
    seen = set()
    for r in rows:
        pc = norm_pc(r[5])
        if not pc:
            dropped['no_postcode'] += 1; continue
        lines = clean_lines(r)
        if not lines:
            dropped['no_address'] += 1; continue
        # town is the last delivery line once counties are stripped; street lines precede it
        town = lines[-1] if len(lines) > 1 else ''
        street = lines[:-1] if len(lines) > 1 else lines
        # Hygiene rule 6: deduplicate on ADDRESS, not name.
        key = (re.sub(r'[^a-z0-9]', '', ''.join(lines).lower()), pc.replace(' ', ''))
        if key in seen:
            dropped['dup_address'] += 1; continue
        seen.add(key)
        pool.append({
            'club_name': titlecase(r[0].strip()),
            'address_1': street[0] if street else '',
            'address_2': street[1] if len(street) > 1 else '',
            'address_3': ' '.join(street[2:]) if len(street) > 2 else '',
            'town': town,
            'postcode': pc,
            'club_type': classify(r[0]),
            'source': 'HMRC CASC register 2026-07-17',
        })

    json.dump(pool, open('pool.json', 'w'), indent=0)

    # The full clean list, so a future batch is a draw from this rather than a rebuild.
    with open('pool.csv', 'w', newline='', encoding='utf-8') as f:
        cols = ['club_name', 'address_1', 'address_2', 'address_3', 'town', 'postcode',
                'club_type', 'source']
        w = csv.DictWriter(f, fieldnames=cols, extrasaction='ignore')
        w.writeheader()
        w.writerows(pool)
    print('raw rows        :', len(rows))
    print('dropped         :', dropped)
    print('POOL            :', len(pool))
    from collections import Counter
    print('by type         :', Counter(p['club_type'] for p in pool))
    print('missing town    :', sum(1 for p in pool if not p['town']))

if __name__ == '__main__':
    main()
