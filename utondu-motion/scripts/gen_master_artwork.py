import json, re, sys
j = json.load(open(sys.argv[1]))
L = j['letters']
fills = [L[i] for i in (3, 5, 8, 10, 12, 14)]
tag = L[6]
X0 = fills[0]['x0']; Y0 = min(f['y0'] for f in fills); Y1 = max(f['y1'] for f in fills)
tok = re.compile(r'[MLCZ]|-?\d+\.?\d*')
def shift(d, dx, dy):
    out = []; c = 0
    for t in tok.findall(d):
        if t in 'MLCZ': out.append(t); c = 0
        else:
            v = float(t) - (dx if c % 2 == 0 else dy); c += 1
            out.append(f"{v:.2f}".rstrip('0').rstrip('.'))
    return ' '.join(out)
letters = []
for f in fills:
    letters.append(dict(x=round(f['x0'] - X0, 3), rule=f['rule'], d=shift(f['d'], f['x0'], Y0)))
# tagline: split into subpaths, cluster into glyphs by x overlap
subs = [s.strip() for s in re.split(r'(?=M)', tag['d']) if s.strip()]
boxes = []
for s in subs:
    n = [float(v) for v in re.findall(r'-?\d+\.?\d*', s)]
    xs, ys = n[0::2], n[1::2]
    if max(xs) - min(xs) < 0.5 and max(ys) - min(ys) < 0.5: continue
    boxes.append([min(xs), max(xs), s])
boxes.sort(key=lambda b: b[0])
glyphs = []
for b in boxes:
    if glyphs and b[0] < glyphs[-1]['x1'] - 0.5:
        g = glyphs[-1]; g['x1'] = max(g['x1'], b[1]); g['d'].append(b[2])
    else:
        glyphs.append(dict(x0=b[0], x1=b[1], d=[b[2]]))
TY0 = tag['y0']
tagline = [dict(x=round(g['x0'] - X0, 2), d=shift(' '.join(g['d']), g['x0'], TY0)) for g in glyphs]
data = dict(
    H=round(Y1 - Y0, 3), TOTAL=round(fills[-1]['x1'] - X0, 3), PITCH=round(fills[1]['x0'] - X0, 3),
    LETTER_W=round(fills[0]['x1'] - fills[0]['x0'], 3),
    letters=letters,
    tagline=dict(gap=round(TY0 - Y1, 3), height=round(tag['y1'] - TY0, 3), x=round(tag['x0'] - X0, 3), width=round(tag['x1'] - tag['x0'], 3), glyphs=tagline),
)
print("// Generated from the UTONDU brand identity PDF (page 2, master lockup). Do not edit by hand.")
print("// Units: PDF points, origin at the top-left of the wordmark.")
print("export const master = " + json.dumps(data, indent=1) + " as const;")
