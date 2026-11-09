import re, sys, json
src = open(sys.argv[1]).read()
ds = re.findall(r'<path fill-rule="nonzero" fill="rgb\(100%, 100%, 100%\)" fill-opacity="0.1" d="([^"]+)"', src)
assert len(ds) == 2, len(ds)
num = re.compile(r'-?\d+\.?\d*')
def fmt(d):
    return re.sub(r'-?\d+\.\d+', lambda m: f"{float(m.group(0)):.2f}".rstrip('0').rstrip('.'), d).strip()
allnums = [float(v) for v in num.findall(ds[0])]
xs, ys = allnums[0::2], allnums[1::2]
data = dict(page=dict(width=1123.2, height=796.8), x0=round(min(xs), 2), x1=round(max(xs), 2), y0=round(min(ys), 2), y1=round(max(ys), 2),
            fill=fmt(ds[0]), edge=fmt(ds[1]), opacity=0.1)
print("// Generated from the UTONDU brand identity PDF (page 10): the oversized master U overlay.")
print("// Page coordinates in PDF points. Regenerate with scripts/extract-master.sh.")
print("export const bigU = " + json.dumps(data, indent=1) + " as const;")
