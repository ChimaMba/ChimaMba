"""
UTONDU — original score, composed in code and synced to the edit frame by frame.

90 BPM at 30 fps → one beat = 20 frames (one transition), one bar = 80 frames.
Key of D. Progression (one chord per bar): Dmaj9 · Bm11 · Gmaj9 · Asus2.

Voices: Rhodes-style FM electric piano, filtered detuned-saw pad, sine sub bass,
soft kit (kick, shaker, rim), FM bell, noise whooshes and sub impacts, all
through a shared stereo reverb, then bus-compressed and loudness-normalised.

Scene timings mirror src/Sizzle.tsx, src/Social.tsx and the stings. If you change
a scene length there, change it in EDITS below and re-run:
    python3 -I scripts/score.py   (needs numpy + scipy; ffmpeg for loudness)
"""
import os
import subprocess
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
FPS = 30
BEAT = 20  # frames
BAR = 80
TRANSITION = 20
rng = np.random.default_rng(7)

# ---------------------------------------------------------------- edits ------
EDITS = {
    "sizzle": [("sting", 160), ("statement", 120), ("construction", 160), ("palette", 160),
               ("typography", 120), ("lifestyle", 180), ("product", 120), ("applications", 180),
               ("endcard", 120)],
    "social": [("sting", 140), ("statement", 100), ("lifestyle", 180), ("applications", 180),
               ("endcard", 100)],
    "sting": [("sting_solo", 210)],
}

# ---------------------------------------------------------------- helpers ----
def f2s(frame):
    return int(round(frame / FPS * SR))

def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)

def lp(x, fc, order=2):
    return sosfilt(butter(order, min(fc, SR * 0.45), "low", fs=SR, output="sos"), x)

def hp(x, fc, order=2):
    return sosfilt(butter(order, fc, "high", fs=SR, output="sos"), x)

def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)

def adsr(n, a, d, s, r, hold):
    """Sample envelope: attack a, decay d to sustain s, hold, release r (seconds)."""
    A, D, H, R = int(a * SR), int(d * SR), int(hold * SR), int(r * SR)
    env = np.concatenate([
        np.linspace(0, 1, max(A, 1), endpoint=False),
        np.linspace(1, s, max(D, 1), endpoint=False),
        np.full(max(H - A - D, 0), s),
        np.linspace(s, 0, max(R, 1)),
    ])
    return env[:n] if len(env) >= n else np.pad(env, (0, n - len(env)))

class Bus:
    def __init__(self, n):
        self.dry = np.zeros((2, n))
        self.send = np.zeros((2, n))
        self.n = n

    def add(self, sig, at, gain=1.0, pan=0.0, reverb=0.2):
        """Mono or stereo signal placed at sample `at` with equal-power pan."""
        if sig.ndim == 1:
            l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
            sig = np.vstack([sig * l * 1.414, sig * r * 1.414])
        at = max(at, 0)
        end = min(at + sig.shape[1], self.n)
        if end <= at:
            return
        seg = sig[:, : end - at] * gain
        self.dry[:, at:end] += seg
        self.send[:, at:end] += seg * reverb

# ---------------------------------------------------------------- voices -----
def rhodes(note, dur, vel=0.7):
    f = midi(note)
    n = int((dur + 2.0) * SR)
    t = np.arange(n) / SR
    index = (1.6 + vel) * np.exp(-t / 0.18) + 0.25
    car = np.sin(2 * np.pi * f * t + index * np.sin(2 * np.pi * f * t))
    tine = 0.18 * np.sin(2 * np.pi * f * 7.0 * t) * np.exp(-t / 0.05)
    amp = np.exp(-t / (1.4 + 2.5 / (1 + f / 300))) * adsr(n, 0.003, 0.1, 0.9, 0.35, dur)
    sig = (car + tine) * amp * vel
    trem = 1 + 0.12 * np.sin(2 * np.pi * 4.2 * t)
    return np.vstack([sig * trem, sig * (2 - trem)]) * 0.5

def pad(notes, dur, bright=1400):
    n = int((dur + 2.5) * SR)
    t = np.arange(n) / SR
    out = np.zeros((2, n))
    for note in notes:
        f = midi(note)
        for ch, det in enumerate((-0.07, 0.07)):
            v = np.zeros(n)
            for cents in (-9 + det * 10, 0, 9 - det * 10):
                ff = f * 2 ** (cents / 1200)
                # sawtooth; its aliasing sits far above the pad's low-pass
                v += 2 * ((ff * t + rng.uniform(0, 1)) % 1.0) - 1
            out[ch] += v
    out = np.vstack([lp(out[0], bright, 2), lp(out[1], bright, 2)])
    env = adsr(n, 1.1, 0.5, 0.8, 2.0, dur)
    return out * env * (0.05 / max(1, len(notes) ** 0.5))

def bass(note, dur, vel=0.8):
    f = midi(note)
    n = int((dur + 0.3) * SR)
    t = np.arange(n) / SR
    sig = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t)
    sig = np.tanh(1.4 * sig) * adsr(n, 0.012, 0.25, 0.75, 0.18, dur) * vel
    return lp(sig, 420) * 0.3

def kick(vel=1.0):
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    freq = 46 + 70 * np.exp(-t / 0.045)
    sig = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t / 0.22)
    click = lp(rng.standard_normal(n), 3000) * np.exp(-t / 0.004) * 0.15
    return (sig + click) * vel * 0.5

def shaker(vel=0.3):
    n = int(0.09 * SR)
    t = np.arange(n) / SR
    env = np.minimum(t / 0.006, 1) * np.exp(-t / 0.03)
    return hp(rng.standard_normal(n), 6500) * env * vel * 0.25

def rim(vel=0.4):
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    tone = np.sin(2 * np.pi * 1750 * t) * np.exp(-t / 0.018)
    noise = bp(rng.standard_normal(n), 1200, 5000) * np.exp(-t / 0.04)
    return (0.5 * tone + noise) * vel * 0.35

def bell(note, vel=0.6, decay=3.2):
    f = midi(note)
    n = int((decay + 1) * SR)
    t = np.arange(n) / SR
    index = 3.0 * np.exp(-t / 0.6) + 0.4
    sig = np.sin(2 * np.pi * f * t + index * np.sin(2 * np.pi * f * 3.5 * t))
    sig += 0.3 * np.sin(2 * np.pi * f * 2.0 * t) * np.exp(-t / 0.8)
    return sig * np.exp(-t / decay) * np.minimum(t / 0.002, 1) * vel * 0.35

def whoosh(frames, peak_at=0.5, vel=0.5, up=True):
    """Filtered-noise sweep lasting `frames`, loudest at `peak_at` of its length."""
    n = f2s(frames)
    t = np.linspace(0, 1, n)
    env = np.where(t < peak_at, (t / peak_at) ** 2.2, ((1 - t) / (1 - peak_at)) ** 1.6)
    noise = rng.standard_normal((2, n))
    # time-varying brightness via crossfading a dark and a bright copy
    dark = np.vstack([lp(noise[0], 500), lp(noise[1], 500)])
    bright = np.vstack([bp(noise[0], 1500, 9000), bp(noise[1], 1500, 9000)])
    mix = t if up else 1 - t
    sig = dark * (1 - mix) * 1.8 + bright * mix * 0.6
    pan = np.vstack([1 - 0.4 * t, 0.6 + 0.4 * t])
    return sig * env * pan * vel * 0.22

def impact(vel=0.8):
    n = int(1.4 * SR)
    t = np.arange(n) / SR
    freq = 38 + 25 * np.exp(-t / 0.08)
    sig = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t / 0.45)
    return sig * vel * 0.3

def reverb_ir(seconds=2.6):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal((2, n)) * np.exp(-t / (seconds / 6.5))
    ir = np.vstack([lp(ir[0], 6000), lp(ir[1], 5200)])
    ir[:, : int(0.012 * SR)] = 0  # pre-delay
    return ir / np.sqrt((ir ** 2).sum(axis=1, keepdims=True))

# ---------------------------------------------------------------- harmony ----
# voicings (MIDI): pad notes, Rhodes chord tones (upper), bass root
CHORDS = [
    dict(name="Dmaj9", pad=[50, 57, 61, 64, 66], keys=[66, 69, 73, 76, 78], root=38),
    dict(name="Bm11",  pad=[47, 54, 57, 62, 64], keys=[66, 69, 71, 74, 76], root=35),
    dict(name="Gmaj9", pad=[43, 50, 54, 57, 62], keys=[66, 69, 71, 74, 78], root=31),
    dict(name="Asus2", pad=[45, 52, 57, 59, 64], keys=[64, 69, 71, 76, 78], root=33),
]
HOME = CHORDS[0]
ARP = [0, 2, 1, 3, 2, 4, 3, 1]  # Rhodes motif over chord tones, eighth notes

def chord_at(frame, resolve_from):
    if frame >= resolve_from:
        return HOME
    return CHORDS[(frame // BAR) % 4]

# ---------------------------------------------------------------- composer ---
def compose(edit):
    scenes = []
    pos = 0
    for i, (kind, dur) in enumerate(edit):
        scenes.append(dict(kind=kind, start=pos, dur=dur))
        pos += dur - (TRANSITION if i < len(edit) - 1 else 0)
    total = pos
    n = f2s(total) + int(2.5 * SR)
    bus = Bus(n)
    solo = edit[0][0] == "sting_solo"

    end = scenes[-1]
    resolve_from = end["start"] if end["kind"] == "endcard" else total
    groove_from = scenes[1]["start"] + TRANSITION if len(scenes) > 1 else None
    groove_to = end["start"] + TRANSITION if end["kind"] == "endcard" else total

    # --- pad + bass, bar by bar (chord changes on bar lines, home chord at the end card)
    bar_starts = list(range(0, total, BAR))
    if resolve_from < total and resolve_from not in bar_starts:
        bar_starts = sorted([b for b in bar_starts if b < resolve_from] + [resolve_from])
    for k, b in enumerate(bar_starts):
        nxt = bar_starts[k + 1] if k + 1 < len(bar_starts) else total + 30
        ch = chord_at(b, resolve_from)
        length = (nxt - b) / FPS
        bright = 900 if (groove_from is None or b < groove_from) else 1600
        in_groove = groove_from is not None and groove_from <= b < groove_to
        pad_gain = 0.85 if in_groove else (0.45 if (groove_from is None or b < groove_from) else 0.6)
        bus.add(pad(ch["pad"], length, bright), f2s(b), gain=pad_gain, reverb=0.35)
        if groove_from is not None and groove_from - BEAT <= b < groove_to:
            for beat in range(0, nxt - b, BEAT * 2):
                fr = b + beat
                if fr >= groove_to:
                    break
                bus.add(bass(ch["root"] + (0 if beat == 0 else 12 if beat == BEAT * 2 else 7), BEAT * 1.6 / FPS, 0.8),
                        f2s(fr), gain=0.9, reverb=0.03)
    # final root under the end card
    if resolve_from < total:
        bus.add(bass(HOME["root"], (total - resolve_from) / FPS + 1.5, 0.7), f2s(resolve_from + TRANSITION), gain=0.8, reverb=0.05)

    # --- groove: kick, shaker, rim, Rhodes motif
    # Act 2 (from the construction scene, or lifestyle in the social cut) adds shaker + rim.
    act2 = next((sc["start"] + TRANSITION for sc in scenes if sc["kind"] in ("construction", "lifestyle")), None)
    # A breath: drums drop at the start of the lifestyle scene and return as the panel glides.
    breath = next(((sc["start"] + TRANSITION, sc["start"] + 80) for sc in scenes if sc["kind"] == "lifestyle"), (0, 0))
    if groove_from is not None:
        for fr in range(groove_from, groove_to, BEAT // 2):
            eighth = (fr - groove_from) // (BEAT // 2)
            beat_in_bar = (fr // BEAT) % 4
            on_beat = fr % BEAT == 0
            drums = not (breath[0] <= fr < breath[1])
            full = act2 is not None and fr >= act2
            if drums and on_beat and beat_in_bar in (0, 2):
                bus.add(kick(0.9 if beat_in_bar == 0 else 0.7), f2s(fr), reverb=0.02)
            if drums and full and on_beat and beat_in_bar in (1, 3):
                bus.add(rim(0.35), f2s(fr), pan=0.25, reverb=0.25)
            if drums and full:
                bus.add(shaker(0.32 if not on_beat else 0.18), f2s(fr) + int(rng.normal(0, 60)), pan=-0.35, reverb=0.1)
            ch = chord_at(fr, resolve_from)
            note = ch["keys"][ARP[eighth % 8]]
            vel = 0.42 + 0.12 * (eighth % 2 == 0) + rng.uniform(-0.05, 0.05)
            if eighth % 8 not in (5,):  # one breath per bar
                bus.add(rhodes(note, 0.32, vel), f2s(fr) + int(rng.normal(0, 90)), gain=1.2,
                        pan=0.15 * np.sin(eighth), reverb=0.3)

    # --- final-act lift: octave-up Rhodes answers on each downbeat over the mockups
    for sc in scenes:
        if sc["kind"] == "applications":
            for fr in range(sc["start"] + TRANSITION, min(sc["start"] + sc["dur"], groove_to), BEAT * 2):
                ch = chord_at(fr, resolve_from)
                bus.add(rhodes(ch["keys"][4] + 12, 0.6, 0.35), f2s(fr), gain=0.6, pan=0.35, reverb=0.5)

    # --- scene cues
    for i, sc in enumerate(scenes):
        s, kind = sc["start"], sc["kind"]
        if kind in ("sting", "sting_solo"):
            # one pluck per letter as it starts drawing (frames 10 + 5i)
            for li, note in enumerate([74, 78, 81, 85, 88, 90]):
                bus.add(rhodes(note, 0.5, 0.3 + 0.03 * li), f2s(s + 10 + li * 5), gain=0.7, pan=-0.5 + li * 0.2, reverb=0.45)
            # the U turns into the n: rising shimmer, bell as it lands
            bus.add(whoosh(30, 0.85, 0.35, up=True), f2s(s + 60), reverb=0.5)
            bus.add(bell(81, 0.32), f2s(s + 90), reverb=0.55)
            bus.add(bell(88, 0.17, 2.4), f2s(s + 90), pan=0.3, reverb=0.6)
            # tagline settles: low pad bloom + soft high bell
            bus.add(bell(93, 0.1, 2.0), f2s(s + 100), pan=-0.3, reverb=0.7)
            if kind == "sting_solo":
                bus.add(impact(0.45), f2s(s + 90), reverb=0.1)
        if kind == "construction":
            for fr, note in ((s + 92, 81), (s + 134, 85)):  # U turns back and forth
                bus.add(bell(note, 0.35, 2.2), f2s(fr), pan=0.2, reverb=0.5)
        if kind == "palette":
            for ci, note in enumerate([78, 81, 85]):  # each colour card lands
                bus.add(rhodes(note, 0.4, 0.5), f2s(s + 10 + ci * 10), pan=-0.4 + ci * 0.4, reverb=0.4)
        if kind == "lifestyle":
            bus.add(whoosh(28, 0.45, 0.45, up=False), f2s(s + 80), reverb=0.3)  # panel glides across
            bus.add(impact(0.5), f2s(s + 80), reverb=0.05)  # drums return with the glide
        if kind == "applications":
            for k in (1, 2, 3):  # each mockup wipes up, centred on the beat
                fr = s + k * 40
                bus.add(whoosh(20, 0.5, 0.3, up=True), f2s(fr - 10), reverb=0.2)
                bus.add(rim(0.45), f2s(fr), pan=-0.1, reverb=0.35)
                bus.add(impact(0.35), f2s(fr), reverb=0.05)
        if kind == "endcard":
            bus.add(bell(74, 0.28, 4.0), f2s(s + TRANSITION + 30), reverb=0.6)
            bus.add(bell(81, 0.2, 4.0), f2s(s + TRANSITION + 34), pan=0.25, reverb=0.6)
            bus.add(bell(90, 0.1, 3.0), f2s(s + TRANSITION + 38), pan=-0.25, reverb=0.7)
        # transitions out of this scene
        if i < len(scenes) - 1:
            t0 = scenes[i + 1]["start"]
            bus.add(whoosh(TRANSITION + 8, 0.6, 0.4, up=(i % 2 == 0)), f2s(t0 - 4), reverb=0.25)
            if scenes[i + 1]["kind"] in ("statement", "lifestyle"):
                bus.add(impact(0.6), f2s(t0 + TRANSITION), reverb=0.05)
            if scenes[i + 1]["kind"] == "endcard":
                bus.add(impact(0.3), f2s(t0 + TRANSITION), reverb=0.1)

    # --- mix
    wet = np.vstack([fftconvolve(bus.send[0], IR[0])[:n], fftconvolve(bus.send[1], IR[1])[:n]])
    mix = bus.dry + 0.9 * wet
    mix = hp(mix, 32)
    mix = mix + 0.35 * hp(mix, 3000)  # presence / air lift
    # gentle bus compression (RMS follower)
    env = np.sqrt(lp((mix ** 2).mean(axis=0), 8, 1).clip(1e-9))
    gain = np.minimum(1, (0.3 / env) ** 0.2)
    mix = mix * gain
    # trim to edit length, short fade-out on the final frames
    out_len = f2s(total)
    mix = mix[:, :out_len]
    fade = int(0.6 * SR)
    mix[:, -fade:] *= np.linspace(1, 0, fade) ** 1.5
    return mix, total

def write_wav(path, stereo):
    import wave
    data = (np.clip(stereo.T, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())

def loudnorm(src, dst):
    """Static gain to -16 LUFS integrated, then a transparent peak limiter at
    -1.5 dBFS. One gain for the whole cue keeps the arrangement's dynamics."""
    import json, re
    probe = subprocess.run(["ffmpeg", "-hide_banner", "-i", src, "-af", "ebur128", "-f", "null", "-"],
                           capture_output=True, text=True, check=True).stderr
    measured = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", probe)[-1])
    gain_db = -16.0 - measured
    af = f"volume={gain_db:.2f}dB,alimiter=limit=0.84:attack=3:release=60:level=false"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-af", af, "-ar", str(SR), dst], check=True)

if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    out_dir = os.path.join(here, "..", "public", "audio")
    os.makedirs(out_dir, exist_ok=True)
    IR = reverb_ir()
    for name, edit in EDITS.items():
        mix, total = compose(edit)
        raw = os.path.join(out_dir, f"_{name}_raw.wav")
        write_wav(raw, mix)
        loudnorm(raw, os.path.join(out_dir, f"score-{name}.wav"))
        os.remove(raw)
        print(f"score-{name}.wav  {total} frames  {total / FPS:.2f}s")
