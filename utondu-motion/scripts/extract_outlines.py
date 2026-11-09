import re, sys, json
src = open(sys.argv[1]).read()
paths = re.findall(r'<path fill-rule="(\w+)" fill="rgb\(100%, 100%, 100%\)" fill-opacity="1" d="([^"]+)"', src)
num = re.compile(r'-?\d+\.?\d*')
letters = []
for rule, d in paths:
    cmds = re.findall(r'[MLCZ]', d)
    if 'C' not in cmds and len(cmds) < 6:  # skip hairline artefacts
        continue
    if 'C' not in cmds and d.count('Z') > 3:
        continue
    nums = list(map(float, num.findall(d)))
    xs, ys = nums[0::2], nums[1::2]
    letters.append(dict(rule=rule, d=d, x0=min(xs), x1=max(xs), y0=min(ys), y1=max(ys)))
letters.sort(key=lambda l: l['x0'])
ox = min(l['x0'] for l in letters); oy = min(l['y0'] for l in letters)
out = []
for l in letters:
    def shift(m):
        return m.group(0)
    toks = re.findall(r'[MLCZ]|-?\d+\.?\d*', l['d'])
    res = []; i = 0; coord = 0
    for tk in toks:
        if tk in 'MLCZ':
            res.append(tk); coord = 0
        else:
            v = float(tk) - (ox if coord % 2 == 0 else oy)
            res.append(f"{v:.3f}".rstrip('0').rstrip('.')); coord += 1
    out.append(dict(rule=l['rule'], d=' '.join(res), x0=round(l['x0']-ox,3), x1=round(l['x1']-ox,3), y0=round(l['y0']-oy,3), y1=round(l['y1']-oy,3)))
print(json.dumps(dict(width=round(max(l['x1'] for l in letters)-ox,3), height=round(max(l['y1'] for l in letters)-oy,3), letters=out), indent=1))
