"""
UTONDU — original score + motion sound design, composed against the edit.

Reads public/audio/timeline-{film,social,sting}.json (exported from src/timeline.ts by
scripts/export-cues.ts: scene starts, transitions and every element's animation cue)
and writes, per edit:
  public/audio/score-<edit>.wav           final mix (used by the Remotion compositions)
  renders/audio/UTONDU_<Edit>_music.wav   music stem
  renders/audio/UTONDU_<Edit>_sfx.wav     motion-sound stem   (music + sfx = mix)

Music: 90 BPM (one beat = 20 frames = one transition), key of D. The arrangement
follows the edit's structure: intro under the logo, groove from the first page,
a second progression with a nylon-guitar melody through the identity system, a
drum breakdown on the lifestyle scene that returns with the panel glide, a riser
into the applications finale, and a resolve to Dmaj9 on the end card.

Motion sound: every animated element has a designed sound — paper ticks for text
lines, tuned plucks for wordmark letters, air swooshes for photos, felt "cushion"
thuds as furniture lands, pops for dots, pen swishes for drawn lines, shimmers and
sweeps for the signature U moves, and a sound for each transition type. The music
ducks gently under the motion sounds.

Needs numpy, scipy, ffmpeg.   Run: npx tsx scripts/export-cues.ts && python3 -I scripts/score.py
"""
import json
import os
import re
import subprocess
import wave

import numpy as np
from scipy.signal import butter, sosfilt, lfilter, fftconvolve

SR = 48000
FPS = 30
BEAT = 20
BAR = 80
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..")
AUDIO = os.path.join(ROOT, "public", "audio")
STEMS = os.path.join(ROOT, "renders", "audio")


def f2s(frame):
    return int(round(frame / FPS * SR))


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def lp(x, fc, order=2):
    return sosfilt(butter(order, min(fc, SR * 0.45), "low", fs=SR, output="sos"), x, axis=-1)


def hp(x, fc, order=2):
    return sosfilt(butter(order, fc, "high", fs=SR, output="sos"), x, axis=-1)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, min(hi, SR * 0.45)], "band", fs=SR, output="sos"), x, axis=-1)


def env_adsr(n, a, d, s, r, hold):
    A, D, H, R = int(a * SR), int(d * SR), int(hold * SR), int(r * SR)
    e = np.concatenate([np.linspace(0, 1, max(A, 1), endpoint=False), np.linspace(1, s, max(D, 1), endpoint=False),
                        np.full(max(H - A - D, 0), s), np.linspace(s, 0, max(R, 1))])
    return e[:n] if len(e) >= n else np.pad(e, (0, n - len(e)))


def pan2(sig, pan):
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    return np.vstack([sig * l, sig * r]) * 1.414


class Bus:
    def __init__(self, n):
        self.dry = np.zeros((2, n))
        self.send = np.zeros((2, n))
        self.n = n

    def add(self, sig, at, gain=1.0, pan=0.0, reverb=0.2):
        if sig.ndim == 1:
            sig = pan2(sig, pan)
        at = int(max(at, 0))
        end = min(at + sig.shape[1], self.n)
        if end <= at:
            return
        seg = sig[:, : end - at] * gain
        self.dry[:, at:end] += seg
        self.send[:, at:end] += seg * reverb


# ============================================================== instruments ==
def rhodes(note, dur, vel=0.6):
    f = midi(note)
    n = int((dur + 2.0) * SR)
    t = np.arange(n) / SR
    index = (1.5 + vel) * np.exp(-t / 0.18) + 0.25
    car = np.sin(2 * np.pi * f * t + index * np.sin(2 * np.pi * f * t))
    tine = 0.16 * np.sin(2 * np.pi * f * 7.0 * t) * np.exp(-t / 0.05)
    amp = np.exp(-t / (1.3 + 2.5 / (1 + f / 300))) * env_adsr(n, 0.003, 0.1, 0.9, 0.35, dur)
    sig = (car + tine) * amp * vel
    trem = 1 + 0.1 * np.sin(2 * np.pi * 4.2 * t)
    return np.vstack([sig * trem, sig * (2 - trem)]) * 0.45


def nylon(note, vel=0.6, decay=0.996, bright=0.55):
    """Karplus–Strong plucked string (warm nylon guitar / koto-like)."""
    f = midi(note)
    n = int(2.4 * SR)
    N = int(SR / f)
    rng = np.random.default_rng(int(note * 1000 + vel * 100))
    burst = np.zeros(n)
    exc = rng.uniform(-1, 1, N)
    exc = lp(exc, 1500 + 6000 * bright, 1)
    burst[:N] = exc
    a = np.zeros(N + 2)
    a[0] = 1
    a[N] -= decay * 0.5
    a[N + 1] -= decay * 0.5
    y = lfilter([1.0], a, burst)
    body = lp(y, 3200) + 0.25 * bp(y, 180, 420)
    t = np.arange(n) / SR
    return body * np.minimum(t / 0.002, 1) * vel * 0.5


def pad(notes, dur, bright=1400, rng=None):
    n = int((dur + 2.5) * SR)
    t = np.arange(n) / SR
    out = np.zeros((2, n))
    rng = rng or np.random.default_rng(1)
    for note in notes:
        f = midi(note)
        for ch, det in enumerate((-0.07, 0.07)):
            for cents in (-9 + det * 10, 0, 9 - det * 10):
                ff = f * 2 ** (cents / 1200)
                out[ch] += 2 * ((ff * t + rng.uniform(0, 1)) % 1.0) - 1
    out = lp(out, bright, 2)
    return out * env_adsr(n, 1.1, 0.5, 0.8, 2.0, dur) * (0.05 / max(1, len(notes) ** 0.5))


def bass(note, dur, vel=0.8):
    f = midi(note)
    n = int((dur + 0.3) * SR)
    t = np.arange(n) / SR
    sig = np.tanh(1.4 * (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)))
    return lp(sig * env_adsr(n, 0.012, 0.25, 0.75, 0.18, dur) * vel, 420) * 0.3


def kick(vel=1.0, rng=None):
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    freq = 46 + 70 * np.exp(-t / 0.045)
    sig = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t / 0.22)
    click = lp((rng or np.random.default_rng(2)).standard_normal(n), 3000) * np.exp(-t / 0.004) * 0.15
    return (sig + click) * vel * 0.4


def hat(vel=0.3, rng=None, open_=False):
    n = int((0.25 if open_ else 0.09) * SR)
    t = np.arange(n) / SR
    e = np.minimum(t / 0.004, 1) * np.exp(-t / (0.09 if open_ else 0.028))
    return hp((rng or np.random.default_rng(3)).standard_normal(n), 7000) * e * vel * 0.22


def rim(vel=0.4, rng=None):
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * 1750 * t) * np.exp(-t / 0.018)
    noise = bp((rng or np.random.default_rng(4)).standard_normal(n), 1200, 5000) * np.exp(-t / 0.04)
    return (0.5 * tone + noise) * vel * 0.33


def clap(vel=0.4, rng=None):
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    r = rng or np.random.default_rng(5)
    e = sum(np.exp(-np.maximum(t - d, 0) / 0.01) * (t >= d) for d in (0, 0.011, 0.022)) + 0.6 * np.exp(-t / 0.12)
    return bp(r.standard_normal(n), 900, 6000) * e * vel * 0.18


def bell(note, vel=0.5, decay=3.0):
    f = midi(note)
    n = int((decay + 1) * SR)
    t = np.arange(n) / SR
    index = 3.0 * np.exp(-t / 0.6) + 0.4
    sig = np.sin(2 * np.pi * f * t + index * np.sin(2 * np.pi * f * 3.5 * t))
    sig += 0.3 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t / 0.8)
    return sig * np.exp(-t / decay) * np.minimum(t / 0.002, 1) * vel * 0.3


# ============================================================== motion sfx ==
def sfx_tick(w, rng):
    n = int(0.06 * SR)
    t = np.arange(n) / SR
    centre = rng.uniform(2500, 5200)
    noise = bp(rng.standard_normal(n), centre * 0.6, centre * 1.6) * np.exp(-t / 0.006)
    body = np.sin(2 * np.pi * rng.uniform(900, 1400) * t) * np.exp(-t / 0.012) * 0.25
    return (noise + body) * (0.12 + 0.55 * w)


def sfx_swoosh(w, rng, length=0.42, up=True):
    n = int(length * SR)
    t = np.linspace(0, 1, n)
    e = np.where(t < 0.55, (t / 0.55) ** 2, ((1 - t) / 0.45) ** 1.4)
    noise = rng.standard_normal((2, n))
    dark = lp(noise, 700)
    bright = bp(noise, 1800, 9000)
    mix = t if up else 1 - t
    sig = dark * (1 - mix) * 1.6 + bright * mix * 0.7
    return sig * e * (0.15 + 0.4 * w)


def sfx_thud(w, rng):
    """Soft felt / cushion landing: low sine drop + muffled noise puff."""
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    freq = 78 + 60 * np.exp(-t / 0.03)
    tone = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t / 0.09)
    puff = bp(rng.standard_normal(n), 120, 600) * np.exp(-t / 0.045) * 0.9
    return (tone + puff) * (0.25 + 0.6 * w) * 0.6


def sfx_pop(w, rng):
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    freq = 380 + 700 * (1 - np.exp(-t / 0.02))
    tone = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t / 0.03)
    return (tone + 0.2 * hp(rng.standard_normal(n), 4000) * np.exp(-t / 0.004)) * (0.2 + 0.5 * w) * 0.5


def sfx_swish(w, rng):
    n = int(0.28 * SR)
    t = np.linspace(0, 1, n)
    e = np.sin(np.pi * t) ** 2
    return bp(rng.standard_normal(n), 3000, 11000) * e * (0.1 + 0.35 * w)


def sfx_shimmer(w, rng, chord):
    """Reverse-swell shimmer: bell cluster, reversed, rising into the moment."""
    tail = sum(bell(note + 12, 0.4, 1.4)[: int(1.0 * SR)] for note in chord[2:5])
    rev = tail[::-1]
    air = bp(rng.standard_normal(len(rev)), 4000, 12000) * np.linspace(0, 1, len(rev)) ** 3 * 0.2
    return (rev + air) * (0.3 + 0.5 * w)


def sfx_sweep(w, rng, length=1.6):
    """Long tonal air sweep for the big U draws: resonant band sweeping up."""
    n = int(length * SR)
    t = np.linspace(0, 1, n)
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    blocks = 24
    hop = n // blocks
    win = np.hanning(2 * hop)
    for k in range(blocks):  # band sweeps 300 Hz -> 3.6 kHz, overlap-added
        c = 300 * (12 ** (k / (blocks - 1)))
        s0 = max(0, k * hop - hop // 2)
        seg = noise[s0:s0 + 2 * hop]
        out[s0:s0 + len(seg)] += bp(seg, c * 0.8, c * 1.25) * win[: len(seg)]
    e = np.sin(np.pi * t) ** 1.5
    return pan2(out * e * (0.25 + 0.5 * w), 0) * np.vstack([1 - 0.5 * t, 0.5 + 0.5 * t])


# ============================================================== harmony ==
PROG_A = [
    dict(pad=[50, 57, 61, 64, 66], keys=[66, 69, 73, 76, 78], root=38, scale=[74, 76, 78, 81, 83, 86]),  # Dmaj9
    dict(pad=[47, 54, 57, 62, 64], keys=[66, 69, 71, 74, 76], root=35, scale=[71, 74, 76, 78, 81, 83]),  # Bm11
    dict(pad=[43, 50, 54, 57, 62], keys=[66, 69, 71, 74, 78], root=31, scale=[74, 78, 79, 81, 83, 86]),  # Gmaj9
    dict(pad=[45, 52, 57, 59, 64], keys=[64, 69, 71, 76, 78], root=33, scale=[69, 71, 76, 78, 81, 83]),  # Asus2
]
PROG_B = [
    dict(pad=[43, 50, 54, 57, 62], keys=[66, 69, 71, 74, 78], root=31, scale=[74, 78, 79, 81, 83, 86]),  # Gmaj9
    dict(pad=[45, 52, 54, 57, 61], keys=[64, 66, 69, 73, 76], root=33, scale=[69, 73, 76, 78, 81, 85]),  # A6
    dict(pad=[42, 49, 52, 57, 61], keys=[64, 66, 69, 73, 76], root=30, scale=[69, 73, 76, 78, 81, 85]),  # F#m7
    dict(pad=[47, 54, 57, 61, 62], keys=[66, 69, 71, 73, 74], root=35, scale=[71, 73, 74, 78, 81, 83]),  # Bm9
]
HOME = PROG_A[0]
MOTIF = [(0, 2, 0.9), (1, 4, 0.6), (2, 3, 0.7), (3, 1, 0.5), (5, 2, 0.6), (6, 0, 0.5)]  # (eighth in bar, scale idx, vel)


def plan_sections(tl):
    """Sections from the edit: frames where each musical section begins."""
    sc = tl["scenes"]
    total = tl["total"]
    kinds = [s["kind"] for s in sc]
    starts = {k: next((s["start"] for s in sc if s["kind"] == k), None) for k in set(kinds)}
    pages = [s for s in sc if s["kind"] == "page"]
    sec = dict(total=total)
    sec["groove"] = sc[1]["start"] + (0 if sc[0].get("out") == "cut" else BEAT) if len(sc) > 1 else None
    # act 2 (rim + nylon melody): the identity system in the film, the statement in the social cut
    sec["a2"] = starts.get("palette") or next((s["start"] for s in pages if s["page"] in (5, 6)), None) or starts.get("statement")
    if starts.get("lifestyle") is not None:
        ls = starts["lifestyle"] + BEAT
        sec["breath"] = (ls, starts["lifestyle"] + 80)
    else:
        sec["breath"] = None
    fin = next((s["start"] for s in sc if s["kind"] == "plates" or (s["kind"] == "page" and s["page"] == 13)), None)
    sec["finale"] = fin
    sec["build"] = (fin - BAR) if fin else None
    end = sc[-1]
    sec["resolve"] = end["start"] + BEAT if end["kind"] == "endcard" else None
    sec["groove_to"] = sec["resolve"] if sec["resolve"] else total
    return sec


def chord_at(frame, sec):
    if sec["resolve"] is not None and frame >= sec["resolve"] - BEAT:
        return HOME
    bar = frame // BAR
    use_b = sec["a2"] is not None and frame >= sec["a2"] and not (sec["finale"] and frame >= sec["finale"])
    prog = PROG_B if use_b else PROG_A
    return prog[bar % 4]


# ============================================================== compose ==
def compose(name, tl, ir):
    total = tl["total"]
    n = f2s(total) + int(3 * SR)
    music, sfx = Bus(n), Bus(n)
    rng = np.random.default_rng(11)
    sec = plan_sections(tl)
    solo = len(tl["scenes"]) == 1

    # ---- pad and bass, bar by bar
    edges = sorted(set(list(range(0, total, BAR)) + ([sec["resolve"] - BEAT] if sec["resolve"] else [])))
    for k, b in enumerate(edges):
        nxt = edges[k + 1] if k + 1 < len(edges) else total + 40
        ch = chord_at(b, sec)
        groove = sec["groove"] is not None and sec["groove"] <= b < sec["groove_to"]
        bright = 1700 if groove else 950
        gain = 0.8 if groove else 0.5
        if sec["build"] is not None and sec["build"] <= b < sec["finale"]:
            bright, gain = 2400, 0.9
        music.add(pad(ch["pad"], (nxt - b) / FPS, bright, rng), f2s(b), gain=gain, reverb=0.35)
        if groove:
            for off in range(0, nxt - b, BEAT * 2):
                fr = b + off
                if fr >= sec["groove_to"]:
                    break
                music.add(bass(ch["root"] + (0 if off == 0 else 12 if off == BEAT * 2 else 7), BEAT * 1.6 / FPS), f2s(fr), gain=0.72, reverb=0.03)
    if sec["resolve"]:
        music.add(bass(HOME["root"], (total - sec["resolve"]) / FPS + 2), f2s(sec["resolve"]), gain=0.8, reverb=0.05)

    # ---- the stand-alone sting: piano chord on the first letter, pad swell, low D under the bell
    if solo:
        for k, note in enumerate((62, 66, 69, 73, 76)):
            music.add(rhodes(note, 2.6, 0.32), f2s(10) + k * 220, gain=1.0, pan=-0.3 + k * 0.15, reverb=0.45)
        music.add(pad(HOME["pad"], (total - 60) / FPS, 1500, rng), f2s(60), gain=0.9, reverb=0.4)
        music.add(bass(HOME["root"], (total - 90) / FPS, 0.7), f2s(90), gain=0.9, reverb=0.05)
        music.add(bell(74, 0.3, 3.5), f2s(90), pan=-0.2, reverb=0.6)

    # ---- drums + Rhodes motif + nylon melody
    if sec["groove"] is not None:
        for fr in range(sec["groove"], sec["groove_to"], BEAT // 2):
            eighth = (fr // (BEAT // 2)) % 8
            on_beat = fr % BEAT == 0
            beat = (fr // BEAT) % 4
            breath = sec["breath"] and sec["breath"][0] <= fr < sec["breath"][1]
            a2 = sec["a2"] is not None and fr >= sec["a2"]
            fin = sec["finale"] is not None and fr >= sec["finale"]
            ch = chord_at(fr, sec)
            if not breath:
                if on_beat and beat in (0, 2):
                    music.add(kick(0.95 if beat == 0 else 0.75, rng), f2s(fr), reverb=0.02)
                if a2 and on_beat and beat in (1, 3):
                    music.add(rim(0.32, rng), f2s(fr), pan=0.25, reverb=0.25)
                if fin and on_beat and beat in (1, 3):
                    music.add(clap(0.45, rng), f2s(fr) + 90, pan=-0.1, reverb=0.3)
                music.add(hat(0.3 if not on_beat else 0.16, rng, open_=(fin and eighth == 7)), f2s(fr) + int(rng.normal(0, 50)),
                          pan=-0.3, reverb=0.08)
            note = ch["keys"][[0, 2, 1, 3, 2, 4, 3, 1][eighth]]
            vel = 0.38 + 0.1 * (eighth % 2 == 0) + rng.uniform(-0.04, 0.04)
            if eighth != 5:
                music.add(rhodes(note, 0.32, vel), f2s(fr) + int(rng.normal(0, 80)), gain=1.1, pan=0.15 * np.sin(fr), reverb=0.3)
            # nylon melody: a two-bar call over the identity system and the finale
            if (a2 or fin) and not breath:
                bar_in_phrase = (fr // BAR) % 2
                for e8, idx, v in MOTIF:
                    if eighth == e8 and (bar_in_phrase == 0 or e8 < 4):
                        music.add(nylon(ch["scale"][idx] - (12 if bar_in_phrase else 0), v * 0.8), f2s(fr) + int(rng.normal(0, 60)),
                                  gain=0.9, pan=-0.35, reverb=0.4)
            if fin and on_beat and beat == 0:
                music.add(rhodes(ch["keys"][4] + 12, 0.6, 0.33), f2s(fr), gain=0.6, pan=0.35, reverb=0.5)

    # ---- riser into the finale, impacts on section downbeats
    if sec["finale"]:
        rl = 2 * BEAT
        music.add(sfx_shimmer(0.7, rng, chord_at(sec["finale"], sec)["pad"]), f2s(sec["finale"]) - int(1.0 * SR), gain=0.8, reverb=0.4)
        music.add(sfx_swoosh(0.8, rng, length=rl / FPS, up=True), f2s(sec["finale"] - rl), gain=0.7, reverb=0.3)
    # soft sub impact on each section downbeat
    for key, w in (("groove", 0.6), ("a2", 0.45), ("finale", 0.8)):
        if sec.get(key):
            music.add(sfx_thud(w, rng), f2s(sec[key]), gain=0.8, reverb=0.1)
    if sec["resolve"]:
        for k, note in enumerate((74, 81, 90)):
            music.add(bell(note, 0.32 - k * 0.08, 4.0), f2s(sec["resolve"] + 30 + k * 4), pan=(-0.25, 0.25, 0)[k], reverb=0.6)

    # ---- motion sound design, from the edit's cues
    pluck_idx = {}
    for c in tl["cues"]:
        fr, kind, w, pn = c["frame"], c["kind"], c["weight"], c["pan"]
        at = f2s(fr)
        if kind == "tick":
            sfx.add(sfx_tick(w, rng), at + int(rng.normal(0, 40)), pan=pn, reverb=0.15)
        elif kind == "pluck":
            sc = c["scene"]
            i = pluck_idx.get(sc, 0)
            pluck_idx[sc] = i + 1
            scale = chord_at(fr, sec)["scale"]
            note = scale[i % 6] + 12 * (i // 6 % 2)
            sfx.add(nylon(note, 0.45 + 0.3 * w, bright=0.7), at, pan=pn, reverb=0.35)
        elif kind == "swoosh":
            sfx.add(sfx_swoosh(w, rng), at - int(0.2 * SR), reverb=0.2)
        elif kind == "whoosh":
            sfx.add(sfx_swoosh(w, rng, length=0.7, up=False), at - int(0.25 * SR), reverb=0.25)
        elif kind == "thud":
            sfx.add(sfx_thud(w, rng), at, pan=pn * 0.5, reverb=0.08)
        elif kind == "pop":
            sfx.add(sfx_pop(w, rng), at, pan=pn, reverb=0.25)
        elif kind == "swish":
            sfx.add(sfx_swish(w, rng), at, pan=pn, reverb=0.2)
        elif kind == "bell":
            sfx.add(bell(81 + (5 if w < 0.5 else 0), 0.25 + 0.35 * w, 2.6), at, pan=pn, reverb=0.55)
        elif kind == "shimmer":
            sig = sfx_shimmer(w, rng, chord_at(fr, sec)["pad"])
            sfx.add(sig, at - len(sig) + int(0.05 * SR), reverb=0.4)
        elif kind == "sweep":
            sfx.add(sfx_sweep(w, rng), at, reverb=0.35)
    for tr in tl["transitions"]:
        at = f2s(tr["frame"])
        typ = tr["type"]
        if typ == "cut":
            continue
        if typ == "lift":
            sfx.add(sfx_swoosh(0.55, rng, length=0.55, up=True), at - int(0.1 * SR), reverb=0.25)
            sfx.add(sfx_thud(0.35, rng), at + f2s(BEAT), reverb=0.05)
        elif typ == "iris":
            sig = sfx_shimmer(0.4, rng, chord_at(tr["frame"], sec)["pad"])
            sfx.add(sig, at + f2s(BEAT) - sig.shape[-1], reverb=0.4)
            sfx.add(sfx_thud(0.5, rng), at + f2s(BEAT), reverb=0.05)
        elif typ == "fade":
            sfx.add(sfx_swoosh(0.4, rng, length=0.9, up=False), at - int(0.1 * SR), reverb=0.4)

    # ---- mix: reverb, duck music under the motion sounds, stems that sum to the mix
    def render_bus(b):
        wet = np.vstack([fftconvolve(b.send[0], ir[0])[:n], fftconvolve(b.send[1], ir[1])[:n]])
        return hp(b.dry + 0.9 * wet, 30)

    m = render_bus(music) * section_gain(sec, n)
    s = render_bus(sfx) * 0.8
    m = m + 0.45 * hp(m, 3000)  # presence / air
    s_env = np.sqrt(lp((s ** 2).mean(axis=0), 12, 1).clip(1e-10))
    duck = 1 - 0.3 * np.clip(s_env / 0.05, 0, 1)  # up to -3 dB under busy motion sound
    m = m * duck
    mix = m + s
    out_len = f2s(total) if not solo else f2s(total)
    fade = int(0.5 * SR)
    for arr in (m, s, mix):
        arr[:, out_len - fade:out_len] *= np.linspace(1, 0, fade) ** 1.5
    return m[:, :out_len], s[:, :out_len], mix[:, :out_len]


def section_gain(sec, n):
    """Music level automation following the edit: intimate intro, building acts,
    a dip for the breakdown, a swell into the finale, a settled outro."""
    pts = [(0, 0.55)]
    if sec["groove"] is not None:
        pts += [(sec["groove"] - BEAT, 0.55), (sec["groove"], 0.85)]
    if sec["a2"] is not None:
        pts += [(sec["a2"], 0.85), (sec["a2"] + BEAT, 0.95)]
    if sec["breath"]:
        pts += [(sec["breath"][0] - BEAT, 0.95), (sec["breath"][0], 0.72), (sec["breath"][1], 0.72), (sec["breath"][1] + BEAT, 0.95)]
    if sec["build"] is not None:
        pts += [(sec["build"], 0.95), (sec["finale"], 1.12)]
    if sec["resolve"] is not None:
        pts += [(sec["resolve"] - BEAT, 1.12 if sec["finale"] else 0.95), (sec["resolve"] + BEAT, 0.8)]
    pts.sort()
    frames = np.array([p[0] for p in pts], dtype=float)
    gains = np.array([p[1] for p in pts])
    t = np.arange(n) / SR * FPS
    return np.interp(t, frames, gains)[None, :]


def reverb_ir(seconds=2.6, seed=21):
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = r.standard_normal((2, n)) * np.exp(-t / (seconds / 6.5))
    ir = np.vstack([lp(ir[0], 6000), lp(ir[1], 5200)])
    ir[:, : int(0.012 * SR)] = 0
    return ir / np.sqrt((ir ** 2).sum(axis=1, keepdims=True))


def write_wav(path, stereo):
    data = (np.clip(stereo.T, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


def loudness(path):
    out = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-af", "ebur128", "-f", "null", "-"],
                         capture_output=True, text=True, check=True).stderr
    return float(re.findall(r"I:\s+(-?[\d.]+) LUFS", out)[-1])


def master(name, music, sfx, mix):
    """One static gain (to -16 LUFS) for mix and stems alike, then a transparent
    limiter on the mix only. Stems keep the same gain, so music + sfx = mix."""
    tmp = os.path.join(AUDIO, f"_{name}_raw.wav")
    write_wav(tmp, mix * 0.5)
    g_db = -16.0 - loudness(tmp)
    gain = 0.5 * 10 ** (g_db / 20)
    os.remove(tmp)
    write_wav(tmp, mix * gain)
    final = os.path.join(AUDIO, f"score-{name}.wav")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", tmp, "-af", "alimiter=limit=0.84:attack=3:release=60:level=false:latency=1",
                    "-ar", str(SR), final], check=True)
    os.remove(tmp)
    os.makedirs(STEMS, exist_ok=True)
    title = {"film": "BrandFilm", "social": "Social", "sting": "LogoSting"}[name]
    write_wav(os.path.join(STEMS, f"UTONDU_{title}_music.wav"), music * gain)
    write_wav(os.path.join(STEMS, f"UTONDU_{title}_sfx.wav"), sfx * gain)
    return final


if __name__ == "__main__":
    ir = reverb_ir()
    for name in ("film", "social", "sting"):
        tl = json.load(open(os.path.join(AUDIO, f"timeline-{name}.json")))
        music, sfx, mix = compose(name, tl, ir)
        path = master(name, music, sfx, mix)
        print(f"{name}: {tl['total']} frames ({tl['total'] / FPS:.2f}s), {len(tl['cues'])} cues -> {os.path.relpath(path, ROOT)}")
