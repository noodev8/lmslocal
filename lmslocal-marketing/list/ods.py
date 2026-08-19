import zipfile, xml.etree.ElementTree as ET

NS={'table':'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
    'text':'urn:oasis:names:tc:opendocument:xmlns:text:1.0'}

def read_ods(path):
    with zipfile.ZipFile(path) as z:
        root = ET.fromstring(z.read('content.xml'))
    sheets={}
    for t in root.iter('{%s}table'%NS['table']):
        name=t.get('{%s}name'%NS['table'])
        rows=[]
        for r in t.findall('{%s}table-row'%NS['table']):
            rep=int(r.get('{%s}number-rows-repeated'%NS['table'],1))
            cells=[]
            for c in r.findall('{%s}table-cell'%NS['table']):
                crep=int(c.get('{%s}number-columns-repeated'%NS['table'],1))
                txt=' '.join(''.join(p.itertext()) for p in c.findall('{%s}p'%NS['text']))
                if crep>200: crep=1   # trailing filler
                cells.extend([txt.strip()]*crep)
            while cells and cells[-1]=='': cells.pop()
            if rep>50: rep=1 if not any(cells) else rep
            for _ in range(rep): rows.append(cells)
        sheets[name]=rows
    return sheets

if __name__=='__main__':
    import sys
    sh=read_ods(sys.argv[1])
    for n,rows in sh.items():
        print('=== SHEET:',n,'rows:',len(rows))
        for r in rows[:12]: print('   ',r)
