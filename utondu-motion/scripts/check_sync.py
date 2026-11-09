"""Checks that the score (scripts/score.py) and the edits (src/Sizzle.tsx, src/Social.tsx)
use the same scene lengths, and that every length sits on the 90 BPM beat grid."""
import re, sys
sys.path.insert(0, __import__("os").path.dirname(__import__("os").path.abspath(__file__)))
from score import EDITS
root = __import__("os").path.join(__import__("os").path.dirname(__import__("os").path.abspath(__file__)), "..", "src", "")
for name, f in [("sizzle", "Sizzle.tsx"), ("social", "Social.tsx")]:
    tsx = [int(x) for x in re.findall(r'durationInFrames=\{(\d+)\}', open(root + f).read())]
    py = [d for _, d in EDITS[name]]
    print(name, "MATCH" if tsx == py else f"MISMATCH tsx={tsx} py={py}", "| all on beat grid:", all(d % 20 == 0 for d in tsx))
