"""Automated QA: checks that every word and the CTA lockup are centred on the frame (usage: python3 tools/qa.py <frames_dir> timeline.json)."""
import sys, json, numpy as np
from PIL import Image
D, TLf = sys.argv[1], sys.argv[2]
T = json.load(open(TLf))
def mask(a, mode):
    if mode == 'dark': return a.max(2) < 70
    if mode == 'light': return a.min(2) > 190
    return (a[..., 0] > 170) & (a[..., 1] < 150) & (a[..., 2] < 120)
W = [('STARI', 'w1', 'w2', 'dark'), ('TELEFON?', 'w2', 'cRev', 'dark'), ('NOVI', 'nv', 'pair', 'light'),
     ('KUPI.', 'w3', 'd2Rev', 'dark'), ('PRODAJ.', 'w4', 'd3Rev', 'light'), ('ZAMENI.', 'w5', 'eRev', 'or'),
     ('OTKUPUJEMO', 'w6', 'fRev', 'light'), ('BRZO.', 'w7', 'f2Rev', 'or'), ('FER.', 'w8', 'f3Rev', 'dark'), ('SIGURNO.', 'w9', 'zoom', 'light')]
bad = 0
for name, a, b, mode in W:
    t0, t1 = (T[a] + .25, T[b] + .02) if name == 'NOVI' else (T[a] + .4, T[b] - .2) if name == 'STARI' else (T[a] + .4, T[b] + .02)   # only while the word is held
    xs, ys = [], []
    for t in np.arange(t0, t1, .05):
        im = np.asarray(Image.open(f'{D}/{round(t * 120):05d}.jpg').convert('RGB')).astype(int)[760:1180]
        m = mask(im, mode); c = np.where(m.sum(0) > 6)[0]; r = np.where(m.sum(1) > 6)[0]
        if len(c) and len(r): xs.append((c[0] + c[-1]) / 2); ys.append(760 + (r[0] + r[-1]) / 2)
    dx = max(abs(x - 539.5) for x in xs); dy = max(abs(y - 960) for y in ys)
    flag = 'OK' if dx <= 8 and dy <= 14 else 'CHECK'; bad += flag != 'OK'
    print(f'{name:11s} x-centre {np.mean(xs):6.1f} (max off {dx:4.1f})  y-centre {np.mean(ys):6.1f} (max off {dy:4.1f})  {flag}')
# CTA lockup: every block (rows of ink) must be centred
t = T['outro'] - .3
im = np.asarray(Image.open(f'{D}/{round(t * 120):05d}.jpg').convert('RGB')).astype(int)
m = im.max(2) < 70; rows = m.sum(1) > 4; blocks = []; y = 0
while y < len(rows):
    if rows[y]:
        y0 = y
        while y < len(rows) and rows[y]: y += 1
        if y - y0 > 20: blocks.append((y0, y))
    y += 1
for y0, y1 in blocks:
    c = np.where(m[y0:y1].sum(0) > 2)[0]; xc = (c[0] + c[-1]) / 2
    print(f'CTA block y {y0}-{y1}  x-centre {xc:6.1f}  {"OK" if abs(xc - 539.5) <= 8 else "CHECK"}'); bad += abs(xc - 539.5) > 8
print('lockup vertical centre', (blocks[0][0] + blocks[-1][1]) / 2 if blocks else None)
print('ISSUES', bad)
