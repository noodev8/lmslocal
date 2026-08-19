"""The CASC export wraps any field longer than 40 characters by injecting a space at
index 40, splitting a word in two ('ASSOCIATIO N', 'Lim ited'). Some fields genuinely
have a space there, so we decide per row using a vocabulary built from the fields short
enough to be untouched: rejoin only when the join makes a known word and the fragment
left behind is not one."""
import collections, re

CASC_FILE = 'casc-2026-07-17.ods'   # HMRC register, downloaded 19 Aug 2026

WRAP_AT = 40

def build_vocab(values):
    v = collections.Counter()
    for s in values:
        if len(s) <= WRAP_AT:
            for w in re.findall(r"[A-Za-z']+", s):
                v[w.lower()] += 1
    return v

def dewrap(s, vocab):
    """Decide whether the space at index 40 was injected by the export or is real.

    Three tests, because no single one separates the cases. Fragment frequency alone
    fails ('on' is commoner than 'association'); the merged form alone fails
    ('abilities' appears nowhere else in the register). So:
      1. a space against punctuation ('CLUB (CHELMSFORD ) LTD') is never real;
      2. if either side is not a word at all, the split is bogus ('Abi|lities');
      3. if the two sides merge into a well-attested word that beats the weaker
         side, they belong together ('CLU|B' -> 'club', 'ASSOCIATI|ON').
    Otherwise both sides are real words and the space stays ('Club|Limited').
    """
    if len(s) <= WRAP_AT or s[WRAP_AT] != ' ':
        return s
    left, right = s[:WRAP_AT], s[WRAP_AT + 1:]
    joined = left + right
    lw = re.search(r"[A-Za-z']+$", left)
    rw = re.match(r"[A-Za-z']+", right)
    if not lw or not rw:
        return joined
    cl, cr = vocab[lw.group().lower()], vocab[rw.group().lower()]
    if cl == 0 or cr == 0:
        return joined
    cm = vocab[(lw.group() + rw.group()).lower()]
    if cm >= 5 and min(cl, cr) < cm:
        return joined
    return s


if __name__ == '__main__':
    from ods import read_ods
    rows = [r + [''] * (6 - len(r)) for r in read_ods(CASC_FILE)['Report_1'][1:]]
    vocab = build_vocab([r[c] for r in rows for c in range(5)])
    changed = [(r[0], dewrap(r[0], vocab)) for r in rows if len(r[0]) > WRAP_AT and r[0][WRAP_AT] == ' ']
    fixed = [(a, b) for a, b in changed if a != b]
    print(f'candidates {len(changed)}, rejoined {len(fixed)}, left alone {len(changed)-len(fixed)}')
    print('\n-- rejoined --')
    for a, b in fixed[:8]: print('  ', repr(a), '->', repr(b))
    print('\n-- left alone (genuine space at 40) --')
    for a, b in changed:
        if a == b: print('  ', repr(a))
