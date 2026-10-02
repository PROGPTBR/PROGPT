import zipfile, re, csv, json, xml.etree.ElementTree as ET
from collections import Counter
NS='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
SRC='/home/jobsou/Downloads/Follow-up.xlsx'
OUT='/tmp/claude-1000/-home-jobsou-Documentos-PROGPT/0e544fc3-21aa-42f0-bbd1-246fff4de5d9/scratchpad/followup.csv'
z=zipfile.ZipFile(SRC)
shared=[]
with z.open('xl/sharedStrings.xml') as f:
    for ev,el in ET.iterparse(f,events=('end',)):
        if el.tag==NS+'si':
            shared.append(''.join(t.text or '' for t in el.iter(NS+'t'))); el.clear()

def colnum(ref):
    s=re.match(r'[A-Z]+',ref).group(0); n=0
    for ch in s: n=n*26+ord(ch)-64
    return n-1

hdr=None; n=0
fill=Counter(); vals={}
out=open(OUT,'w',newline='',encoding='utf-8'); w=csv.writer(out)
with z.open('xl/worksheets/sheet1.xml') as f:
    for ev,el in ET.iterparse(f,events=('end',)):
        if el.tag!=NS+'row': continue
        cells={}
        for c in el.findall(NS+'c'):
            v=c.find(NS+'v')
            if v is None or v.text is None: continue
            raw=v.text
            if c.get('t')=='s': raw=shared[int(raw)]
            raw=raw.strip()
            if raw: cells[colnum(c.get('r'))]=raw
        el.clear()
        row=[cells.get(i,'') for i in range(41)]
        if hdr is None:
            hdr=row; w.writerow(hdr)
            for i in range(41): vals[i]=Counter()
            continue
        n+=1; w.writerow(row)
        for i in range(41):
            if row[i]:
                fill[i]+=1
                if len(vals[i])<400: vals[i][row[i]]+=1
                elif row[i] in vals[i]: vals[i][row[i]]+=1
out.close()
print('linhas de dados:', n)
print()
for i in range(41):
    pct = 100*fill[i]/n
    top = ', '.join(f'{k}({c})' for k,c in vals[i].most_common(4))
    print(f'{i:2d} {hdr[i]:<22} {pct:5.1f}%  {len(vals[i]):>5} distintos | {top[:95]}')
json.dump({'hdr':hdr,'n':n,'fill':dict(fill)}, open(OUT+'.meta.json','w'))
