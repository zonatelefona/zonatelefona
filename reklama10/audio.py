"""ZONA TELEFONA — „POV: UŠAO SI SAMO DA POGLEDAŠ…“: original score and sound design, synthesized from scratch (no samples, no licensed music).
Cinematic electronic, 120 BPM, D minor. Every cue is read from timeline.json. usage: python3 audio.py out.wav
"""
import sys, wave, json, os
import numpy as np

SR = 48000
T_ = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "timeline.json")))
DUR = T_["end"]
N = int(SR * DUR)
rng = np.random.default_rng(777)
BEAT = 0.5

dryL = np.zeros(N); dryR = np.zeros(N)
revS = np.zeros(N)            # mono reverb send
dlyS = np.zeros(N)            # ping-pong delay send
duck = np.ones(N)             # sidechain envelope (music bus)
musL = np.zeros(N); musR = np.zeros(N)   # music bus (gets ducked)

def T(sec): return np.arange(int(sec * SR)) / SR
def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)
def noise(n): return rng.standard_normal(n)

def _freqs(n): return np.fft.rfftfreq(n, 1 / SR)
def lp(x, fc, order=2):
    f = _freqs(len(x)); return np.fft.irfft(np.fft.rfft(x) / np.sqrt(1 + (f / fc) ** (2 * order)), len(x))
def hp(x, fc, order=2):
    f = _freqs(len(x)); f[0] = 1e-3
    return np.fft.irfft(np.fft.rfft(x) / np.sqrt(1 + (fc / f) ** (2 * order)), len(x))
def bp(x, fc, oct_bw=1.0):
    f = _freqs(len(x)); f[0] = 1e-3
    return np.fft.irfft(np.fft.rfft(x) * np.exp(-(np.log2(f / fc) ** 2) / (2 * (oct_bw / 2) ** 2)), len(x))
def tvfilt(x, fc_fn, mode='bp', bw=1.0, block=2048):
    """time-varying filter, overlap-add of Hann blocks"""
    hop = block // 2; win = np.hanning(block + 1)[:-1]
    pad = np.concatenate([np.zeros(block), x, np.zeros(block)])
    out = np.zeros_like(pad); f = _freqs(block); f[0] = 1e-3
    for s in range(0, len(pad) - block, hop):
        tc = (s + block / 2 - block) / SR
        fc = max(20.0, fc_fn(tc))
        X = np.fft.rfft(pad[s:s + block] * win)
        if mode == 'bp': Hf = np.exp(-(np.log2(f / fc) ** 2) / (2 * (bw / 2) ** 2))
        elif mode == 'lp': Hf = 1 / np.sqrt(1 + (f / fc) ** 4)
        else: Hf = 1 / np.sqrt(1 + (fc / f) ** 4)
        out[s:s + block] += np.fft.irfft(X * Hf, block)
    return out[block:block + len(x)]

def place(buf, sig, t0, gain=1.0):
    i0 = int(round(t0 * SR))
    if i0 < 0: sig = sig[-i0:]; i0 = 0
    n = min(len(sig), N - i0)
    if n > 0: buf[i0:i0 + n] += sig[:n] * gain

def add(sig, t0, gain=1.0, pan=0.0, rev=0.0, dly=0.0, music=False):
    """pan may be scalar or array (same length as sig)"""
    p = np.clip(pan, -1, 1); gl = np.cos((p + 1) * np.pi / 4); gr = np.sin((p + 1) * np.pi / 4)
    L, R = (musL, musR) if music else (dryL, dryR)
    place(L, sig * gl, t0, gain); place(R, sig * gr, t0, gain)
    if rev: place(revS, sig, t0, gain * rev)
    if dly: place(dlyS, sig, t0, gain * dly)

def env_ad(t, a, d): return np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / d)

# ------------------------------------------------------------------ instruments
def kick(punch=1.0, length=0.6, low=43):
    t = T(length)
    f = low + 105 * np.exp(-t / 0.042) + 420 * np.exp(-t / 0.0035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t / (0.26 * punch)) * (1 - np.exp(-t / 0.0008))
    c = hp(noise(len(t)), 2500) * np.exp(-t / 0.004) * 0.25
    return np.tanh(1.8 * (s + c)) * 0.9

def clap():
    t = T(0.5); n = bp(noise(len(t)), 1700, 1.4)
    e = np.zeros_like(t)
    for d in (0, .011, .021): e += (t >= d) * np.exp(-np.maximum(0, t - d) / 0.007)
    e += (t >= .03) * np.exp(-np.maximum(0, t - .03) / 0.12) * 0.75
    return n * e * 0.5

def hat(dec=0.035):
    t = T(0.25); return hp(noise(len(t)), 7500, 3) * np.exp(-t / dec) * 0.35

def snare():
    t = T(0.3)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05)
    nz = bp(noise(len(t)), 2600, 2.0) * np.exp(-t / 0.09)
    return (tone * 0.5 + nz) * 0.5

def boom(length=3.0, f0=78, f1=29, dec=1.1, crack=1.0):
    t = T(length)
    f = f1 + (f0 - f1) * np.exp(-t / 0.35)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / dec) * (1 - np.exp(-t / 0.002))
    body = lp(noise(len(t)), 260) * np.exp(-t / 0.35) * 1.6
    ck = hp(noise(len(t)), 1800) * np.exp(-t / 0.018) * 0.5 * crack
    return np.tanh(1.5 * (s + body + ck))

def metal(length=2.2, base=523.0, dec=0.9):
    t = T(length); out = np.zeros_like(t)
    for k, a in ((1.0, 1), (2.27, .6), (3.64, .45), (5.18, .3), (6.83, .2)):
        out += a * np.sin(2 * np.pi * base * k * t + rng.uniform(0, 6.28)) * np.exp(-t / (dec / k ** 0.5))
    return out * 0.12 * (1 - np.exp(-t / 0.002))

def bell(m, length=3.0, dec=1.4):
    t = T(length); f = mtof(m)
    mod = np.sin(2 * np.pi * f * 3.5 * t) * 2.2 * np.exp(-t / 0.4)
    return np.sin(2 * np.pi * f * t + mod) * np.exp(-t / dec) * (1 - np.exp(-t / 0.003)) * 0.25

def shimmer(length=2.5):
    t = T(length); out = np.zeros_like(t)
    for m in (86, 88, 93, 95, 98, 100, 105):
        out += np.sin(2 * np.pi * mtof(m) * t + rng.uniform(0, 6.28)) * (0.5 + 0.5 * np.sin(2 * np.pi * rng.uniform(4, 9) * t)) \
            * np.exp(-t / rng.uniform(0.6, 1.4)) * np.minimum(1, t / 0.05)
    return out * 0.05

def whoosh(dur=0.6, f0=260, f1=4200, peak=0.85, bw=1.3):
    t = T(dur); u = t / dur
    e = np.where(u < peak, (u / peak) ** 2.2, np.exp(-(u - peak) / (1 - peak) * 4))
    n = noise(len(t))
    s = tvfilt(n, lambda tt: f0 * (f1 / f0) ** min(1, max(0, tt / (dur * peak))), 'bp', bw)
    return s * e * 0.9

def tick():
    t = T(0.12)
    return (np.sin(2 * np.pi * 3300 * t) * .6 + np.sin(2 * np.pi * 5150 * t) * .4) * np.exp(-t / 0.025) * 0.35 \
        + hp(noise(len(t)), 4000) * np.exp(-t / 0.004) * 0.25

def blip(m1, m2, gap=0.06):
    t = T(0.5)
    a = np.sin(2 * np.pi * mtof(m1) * t) * env_ad(t, .003, .05)
    b = np.sin(2 * np.pi * mtof(m2) * t) * env_ad(t, .003, .12)
    b = np.roll(b, int(gap * SR)); b[:int(gap * SR)] = 0
    return (a + b) * 0.16

def supersaw(m, length, voices=5, det=0.12):
    t = T(length); out = np.zeros_like(t); f = mtof(m)
    for v in range(voices):
        cents = (v - (voices - 1) / 2) / ((voices - 1) / 2) * det * 100 if voices > 1 else 0
        ff = f * 2 ** (cents / 1200)
        out += 2 * ((ff * t + rng.uniform()) % 1.0) - 1
    return out / voices

def pluck(m, length=0.45, bright=3800):
    t = T(length); f = mtof(m)
    s = (2 * ((f * t) % 1) - 1) * .6 + np.sign(np.sin(2 * np.pi * f * 1.003 * t)) * .25
    s = lp(s, bright) * np.exp(-t / 0.1) * (1 - np.exp(-t / 0.002))
    return s * 0.3

# ------------------------------------------------------------------ extra instruments
def braam(m, length=2.2, dec=1.0):
    """big brass-like cinematic hit: detuned saws through an opening filter"""
    t = T(length); out = np.zeros_like(t)
    for mm in (m - 12, m, m + 7):
        out += supersaw(mm, length, 5, 0.18)
    cut = lambda x: 300 + 3200 * np.exp(-x / 0.35)
    out = tvfilt(out, cut, 'lp') * np.minimum(1, t / 0.008) * np.exp(-t / dec)
    return np.tanh(out * 1.6) * 0.55

def b808(m, length=0.9, dec=0.55):
    t = T(length); f = mtof(m) * (1 + 1.2 * np.exp(-t / 0.03))
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / dec) * (1 - np.exp(-t / 0.002))
    return np.tanh(s * 2.4) * 0.8

def stab(notes, length=0.35, bright=4200):
    t = T(length); out = np.zeros_like(t)
    for m in notes: out += supersaw(m, length, 3, 0.08)
    return lp(out, bright) * np.exp(-t / 0.12) * (1 - np.exp(-t / 0.002)) * 0.22

def downer(length=1.0):
    t = T(length); f = 900 * np.exp(-t / 0.18) + 60
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.35) * 0.35

def glitch_sfx(length=0.4):
    """digital stutter: gated square bursts + crushed noise"""
    t = T(length); out = np.zeros_like(t)
    step = int(0.028 * SR)
    for k, i in enumerate(range(0, len(t), step)):
        f = [220, 880, 1320, 440, 1760, 660][k % 6] * (1 + 0.3 * rng.uniform())
        seg = np.sign(np.sin(2 * np.pi * f * t[:min(step, len(t) - i)])) * (0.5 if k % 2 == 0 else 0.25)
        seg += noise(len(seg)) * 0.25 * (k % 3 == 0)
        out[i:i + len(seg)] = seg * (0.6 + 0.4 * rng.uniform())
    out = np.round(out * 6) / 6
    return hp(out, 300) * np.exp(-t / (length * 0.8)) * 0.25

def key_click():
    t = T(0.05)
    return (hp(noise(len(t)), 3500) * np.exp(-t / 0.004) * 0.5 + np.sin(2 * np.pi * rng.uniform(1800, 2600) * t) * np.exp(-t / 0.006) * 0.3) * 0.5

def line_riser(length):
    t = T(length); u = t / length
    tone = np.sin(2 * np.pi * np.cumsum(120 * 12 ** u) / SR) * u ** 2 * 0.2
    air = tvfilt(noise(len(t)), lambda z: 500 * 14 ** min(1, z / length), 'bp', 1.0) * u ** 2.4 * 0.5
    return tone + air

# ------------------------------------------------------------------ bespoke one-off sounds (each used once)
def tonal_sweep(length, f0, f1):
    t = T(length); u = t / length
    f = f0 * (f1 / f0) ** eio(u)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * .5 + np.sin(ph * 2.003) * .18 + np.sin(ph * 3.01) * .08
    return s * np.sin(np.pi * u) ** 1.2 * .22
def eio(u): return -(np.cos(np.pi * u) - 1) / 2
def glass_chime(notes, length=2.4):
    t = T(length); out = np.zeros_like(t)
    for k, m in enumerate(notes):
        f = mtof(m); d = int(k * .035 * SR)
        s = (np.sin(2 * np.pi * f * t) + .3 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / .3)) * np.exp(-t / (1.4 - k * .2)) * np.minimum(1, t / .004)
        out[d:] += s[:len(t) - d] * .12
    return out
def shutter():
    t = T(.18); out = np.zeros_like(t)
    for d, g in ((0, 1.0), (.045, .7)):
        i = int(d * SR); n = len(t) - i; tt = t[:n]
        out[i:] += (hp(noise(n), 2500) * np.exp(-tt / .006) * .6 + np.sin(2 * np.pi * 1850 * tt) * np.exp(-tt / .012) * .35) * g
    return out * .5
def servo(length=.35):
    t = T(length); f = 900 + 400 * t / length
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sign(np.sin(2 * np.pi * 120 * t)) * .015 * np.sin(np.pi * t / length)
def latch_click():
    t = T(.25)
    a = hp(noise(len(t)), 3000) * np.exp(-t / .003) * .7
    b = np.sin(2 * np.pi * 2600 * t) * np.exp(-t / .02) * .25 + np.sin(2 * np.pi * 4100 * t) * np.exp(-t / .015) * .15
    spring = np.sin(2 * np.pi * (700 + 300 * np.exp(-t / .05)) * t) * np.exp(-t / .06) * .1
    return (a + b + spring) * .55
def friction(length):
    t = T(length); u = t / length
    return bp(noise(len(t)), 3200, 1.6) * (1 - u) ** 1.5 * np.minimum(1, t / .02) * .18
def felt_thump():
    t = T(.6); f = 70 + 40 * np.exp(-t / .03)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .18) * .7 + lp(noise(len(t)), 500) * np.exp(-t / .05) * .3
def mech_whoosh(length=.9):
    t = T(length); u = t / length
    s = tvfilt(noise(len(t)), lambda z: 300 * 10 ** min(1, z / (length * .8)), 'bp', 1.1) * np.where(u < .8, (u / .8) ** 2, np.exp(-(u - .8) * 12)) * .7
    return s
def metal_settle():
    t = T(1.2); out = np.zeros_like(t)
    for k, a in ((1, 1), (2.41, .5), (3.93, .3)): out += np.sin(2 * np.pi * 420 * k * t) * a * np.exp(-t / (.35 / k ** .5))
    return out * .09 + felt_thump()[:len(t)] * .5 if len(t) <= len(felt_thump()) else out * .09
def ui_pop(f=1250):
    t = T(.25); return np.sin(2 * np.pi * f * t * (1 + .25 * np.exp(-t / .02))) * np.exp(-t / .045) * .2
def reverse_swell(length=.8):
    t = T(length); n = hp(noise(len(t)), 1200) * (t / length) ** 3 * .35
    return n + np.sin(2 * np.pi * np.cumsum(60 + 0 * t) / SR) * (t / length) ** 2 * .3

# ------------------------------------------------------------------ distinct sound families
# HOOK family: drums of war — big toms, reversed crash, brass
def tom(f0=90, length=.9, dec=.35):
    t = T(length); f = f0 * (1 + .8 * np.exp(-t / .04))
    return np.tanh(2.2 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / dec)) * .7 + bp(noise(len(t)), 900, 1.5) * np.exp(-t / .05) * .3
def rev_crash(length=1.0):
    t = T(length); n = hp(noise(len(t)), 3000) * np.exp(-(length - t) / .35); return n[::1] * .35
def zap(f0=3000, f1=120, length=.35):            # FM laser for the light streak
    t = T(length); f = f1 + (f0 - f1) * np.exp(-t / .07)
    mod = np.sin(2 * np.pi * f * 1.5 * t) * 3 * np.exp(-t / .1)
    return np.sin(2 * np.pi * np.cumsum(f) / SR + mod) * np.exp(-t / .12) * .3
# iPHONE family: precise, metallic, high — clicks, sliding metal, glass
def metal_slide(length=.45):
    t = T(length); n = noise(len(t)); s = np.zeros_like(n); d = int(SR / 2200)
    for k in range(4): s[k * d:] += n[:len(n) - k * d] * (.7 ** k)       # comb = metallic shimmer
    return bp(s, 5200, 1.2) * np.sin(np.pi * t / length) ** .8 * .25
def tick_hi(f=4200): t = T(.06); return np.sin(2 * np.pi * f * t) * np.exp(-t / .008) * .3 + hp(noise(len(t)), 6000) * np.exp(-t / .002) * .3
def glass_sweep(length, f0, f1):
    t = T(length); u = t / length; f = f0 * (f1 / f0) ** u
    ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) + .4 * np.sin(ph * 2.01) + .2 * np.sin(ph * 3.02)) * np.sin(np.pi * u) ** 1.5 * .12
# SAMSUNG family: deep, heavy — sub drops, wub glides, low metal
def sub_drop(length=1.6, f0=110, f1=30):
    t = T(length); f = f1 + (f0 - f1) * np.exp(-t / .25)
    return np.tanh(1.8 * np.sin(2 * np.pi * np.cumsum(f) / SR)) * np.exp(-t / .7) * (1 - np.exp(-t / .004)) * .8
def wub(length=.8, f0=60):
    t = T(length); lfo = .5 + .5 * np.sin(2 * np.pi * 6 * t)
    s = (2 * ((f0 * t) % 1) - 1) * .7 + np.sin(2 * np.pi * f0 * .5 * t)
    return tvfilt(s, lambda z: 120 + 900 * (.5 + .5 * np.sin(2 * np.pi * 6 * z)), 'lp') * np.exp(-t / .5) * .55
def hum_on(length=.9):                           # electric rim-light ignition
    t = T(length); s = np.sign(np.sin(2 * np.pi * 50 * t)) * .3 + np.sin(2 * np.pi * 100 * t) * .4 + bp(noise(len(t)), 2500, 1.5) * .25 * np.exp(-t / .05)
    return lp(s, 1600) * np.minimum(1, t / .01) * np.exp(-t / .35) * .5
def low_metal(): t = T(1.4); return sum(np.sin(2 * np.pi * 110 * k * t) * a * np.exp(-t / (.5 / k ** .5)) for k, a in ((1, 1), (2.76, .5), (5.4, .25))) * .12
def mag_click():                                 # S Pen magnetic latch
    t = T(.2); return (hp(noise(len(t)), 2000) * np.exp(-t / .004) * .6 + np.sin(2 * np.pi * 900 * t) * np.exp(-t / .03) * .3) * .6
# DUEL family: rhythmic — claps, snaps, tuned toms, electric blade
def blade(length=.4):
    t = T(length); s = np.sin(2 * np.pi * np.cumsum(5000 * np.exp(-t / .08) + 300) / SR) * np.exp(-t / .1) * .2
    return s + bp(noise(len(t)), 6000, 1.2) * np.exp(-t / .06) * .3
def snap(): t = T(.15); return bp(noise(len(t)), 2400, 1.0) * np.exp(-t / .02) * .6

# ------------------------------------------------------------------ extra one-offs
def click_cascade(length=.32, f0=3000, f1=6000, n=40):
    out = np.zeros(int(length * SR))
    for k in range(n):
        x = int(hash_(k) * length * .9 * SR); f = f0 + (f1 - f0) * k / n; t = T(.012)
        s = np.sin(2 * np.pi * f * t) * np.exp(-t / .002) * .25
        out[x:x + len(s)] += s[:len(out) - x]
    return out
def hash_(k): return (np.sin(k * 127.1 + 311.7) * 43758.5453) % 1
def boing(length=.45, f=180):
    t = T(length); fr = f * (1 + .6 * np.sin(2 * np.pi * 9 * t) * np.exp(-t / .15)) * (1 - .4 * t / length)
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t / .2) * .35
def sparkle(length=1.0):
    out = np.zeros(int(length * SR))
    for k in range(60):
        x = int(hash_(k + 99) * length * .85 * SR); t = T(.08); f = 3000 + hash_(k + 7) * 5000
        s = np.sin(2 * np.pi * f * t) * np.exp(-t / .02) * .1; out[x:x + len(s)] += s[:len(out) - x]
    return out
def spot_thunk():
    t = T(1.2); return np.sin(2 * np.pi * np.cumsum(55 + 40 * np.exp(-t / .05)) / SR) * np.exp(-t / .25) * .8 + hp(noise(len(t)), 1500) * np.exp(-t / .01) * .4



# ================================================================== POV — original score + sound design (120 BPM, D minor), every cue from timeline.json
tt = np.arange(N) / SR
def bt(k): return .5 * k                       # beat grid from 0
Dm = (26, [50, 53, 57, 62, 65]); Bb = (22, [46, 50, 53, 58, 62]); F = (29, [48, 53, 57, 60, 65]); C = (24, [48, 52, 55, 60, 64]); Gm = (31, [50, 55, 58, 62, 67])
chords = [(0, 3, Dm), (3, 5, Dm), (5, 7, Bb), (7, 9, Dm), (9, 10, Bb), (10, 11, F), (11, 12, C), (12, 14.25, Dm), (15, 17, Bb), (17, 19, Gm), (19, 21, C), (21, 25, Dm)]
def chord_at(x):
    for a, b, ch in chords:
        if a <= x < b: return ch
    return Dm
# ---- pads (music bus)
padL = np.zeros(N); padR = np.zeros(N)
for a, b, (root, notes) in chords:
    st = max(0, a - .02); ln = min(b - st + .8, DUR - st); t = T(ln)
    ev = np.minimum(1, t / .4) * np.where(t > b - st, np.exp(-(t - (b - st)) / .35), 1)
    for k, m in enumerate(notes):
        s = supersaw(m, ln, 5, .1) * ev * .05; pan = -.6 if k % 2 == 0 else .6
        place(padL, s * np.cos((pan + 1) * np.pi / 4), st); place(padR, s * np.sin((pan + 1) * np.pi / 4), st)
def pad_cut(x):
    if x < 3: return 380 + 260 * x                   # dark intro opening slowly
    if x < 7: return 1300
    if 12 <= x < 14.25: return 900                     # the joke: filtered
    if x >= 21: return max(700, 2400 - 500 * (x - 21))
    return 2000
padL = tvfilt(padL, pad_cut, 'lp'); padR = tvfilt(padR, pad_cut, 'lp')
musL += padL; musR += padR; revS += (padL + padR) * .18
# ---- drums & bass (music bus, so the tape stop takes everything down together)
K = kick(1.0, .5, 44); CL = clap()
def mk(sig, x, g, pan=0., rev=0.): add(sig, x, g, pan=pan, rev=rev, music=True)
def kick_at(x, g): mk(K, x, g); place(duck, -.5 * np.exp(-T(.4) / .1), x)
def groove(x0, x1, half=False, hats=True, claps=True, g=.85):
    k = 0; x = x0
    while x < x1 - 1e-6:
        if not half or k % 2 == 0: kick_at(x, g)
        if claps and k % 2 == 1: mk(CL, x, .3, rev=.25)
        if hats: mk(hat(.02), x + .25, .2, pan=.3); mk(hat(.008), x + .125, .08, pan=-.3); mk(hat(.008), x + .375, .08, pan=-.3)
        x += .5; k += 1
groove(3.0, 7.0, half=True, hats=False, claps=False, g=.7)
groove(7.0, 12.0)
groove(12.0, 14.25, half=True, hats=True, claps=False, g=.6)
groove(15.0, 21.0)
for x in np.arange(3.0, 21.0, .25):                                   # bass: 8th/16th pulse on the chord root
    if 14.0 <= x < 15.0 or (x < 7 and int(x * 4) % 2): continue
    root = chord_at(x)[0]; mk(b808(root + 12, .3, .14), x, .3 if x >= 7 else .22)
for a, b, (root, notes) in chords:                                    # premium synth arp
    if a < 7 or a >= 21: continue
    seq = [notes[0] + 12, notes[2] + 12, notes[4] + 12, notes[2] + 12, notes[1] + 12, notes[3] + 12, notes[4] + 12, notes[3] + 12]
    for i in range(int((b - a) / .25)):
        x = a + i * .25
        if 14.0 <= x < 15.0: continue
        mk(pluck(seq[i % 8], .28, 2800 if 12 <= x < 14.25 else 3600), x, .11 * (1 if i % 2 == 0 else .7), pan=.45 * np.sin(i * .8), rev=.15)
        place(dlyS, pluck(seq[i % 8], .28, 3600) * .05, x)
# ---- tape stop (14.25 → 14.55) then silence until the punchline
def tape_stop(buf, a, b, silent_to):
    i0, i1, i2 = int(a * SR), int(b * SR), int(silent_to * SR); n = i1 - i0
    u = np.arange(n) / n; rate = (1 - u) ** 1.6; pos = i0 + np.cumsum(rate)
    seg = np.interp(pos, np.arange(len(buf)), buf) * (1 - u ** 3)
    buf[i0:i1] = seg; buf[i1:i2] = 0
for b in (musL, musR, dlyS, revS): tape_stop(b, T_['tapeStop'], T_['tapeStop'] + .3, T_['punch'])

# ---- sound design (dry bus) — only on the important moments
air = lp(noise(int(3.2 * SR)), 700) * .035 * np.minimum(1, T(3.2) / .8); add(air, 0, 1.0)            # dark room tone
add(np.sin(2 * np.pi * np.cumsum(36.7 + 0 * T(3.0)) / SR) * .22 * np.minimum(1, T(3.0) / 1.2) * np.exp(-np.maximum(0, T(3.0) - 2.4) / .3), 0, .8)   # sub drone (D1)
for x in (0.0, 1.0): add(sub_drop(.9, 70, 38), x, .35)                                              # heartbeat sub
add(whoosh(.45, 300, 4200, .85, 1.2), T_['pov'] - .32, .32, rev=.3)
add(whoosh(.45, 300, 4200, .85, 1.2), T_['usao'] - .32, .36, rev=.3); add(tick_hi(3200), T_['usao'] + .22, .25, rev=.3)
add(reverse_swell(.5), T_['pogledas'] - .5, .55); add(boom(2.2, 85, 30, .9, .6), T_['pogledas'], .85, rev=.5); add(braam(50, 1.2, .5), T_['pogledas'], .3, rev=.4)
add(line_riser(.7), 2.3, .45, rev=.3); add(whoosh(.5, 250, 5000, .8, 1.3), T_['s1out'] - .2, .55, rev=.3)
add(metal_slide(.9), 3.3, .35, rev=.5); add(shimmer(2.0), 3.35, .55, rev=.6)                        # macro: metallic shimmer
add(whoosh(.45, 400, 3800, .85, 1.1), T_['aliOnda'] - .3, .38, rev=.3)
add(whoosh(.4, 300, 4500, .85, 1.2), T_['video'] - .3, .45, rev=.3); add(sub_drop(1.4, 95, 32), T_['video'] + .25, .75); add(boom(1.6, 80, 32, .6, .4), T_['video'] + .25, .5, rev=.4)
add(whoosh(.5, 600, 7000, .7, 1.0), T_['s2out'] - .05, .6, pan=np.linspace(.8, -.8, int(.5 * SR)), rev=.2)   # whip pan
add(reverse_swell(.4), T_['s3'] - .4, .4)
add(whoosh(.5, 500, 6000, .75, 1.0), T_['s26'] - .2, .5, pan=np.linspace(.8, -.3, int(.5 * SR)), rev=.2)
add(metal_slide(.7), 9.6, .3, rev=.4)
add(whoosh(.45, 400, 5000, .8, 1.1), T_['air'] - .25, .45, rev=.3); add(shimmer(1.6), T_['air'] + .1, .35, rev=.6)
for k in ('nemozes', 'prestanes', 'gledas'): add(stab([n + 12 for n in chord_at(T_[k] + .01)[1][:3]], .35, 3500), T_[k], .3, rev=.3, music=False)
add(tick_hi(2600), T_['rekao'], .2, rev=.3)
add(whoosh(.55, 200, 2500, .9, 1.4), T_['s4push'], .45, rev=.2)                                       # the sudden push-in
# punchline: impact + a short, dry two-note "wink" (no cartoon effects)
add(boom(2.0, 90, 30, .8, .9), T_['punch'], .9, rev=.45); add(snare(), T_['punch'], .45, rev=.3)
add(pluck(74, .25, 4200) * 1.4, T_['punch'] + .1, .55, pan=-.2, rev=.25); add(pluck(81, .35, 4200) * 1.4, T_['punch'] + .24, .55, pan=.2, rev=.3)
add(whoosh(.45, 400, 5000, .85, 1.1), T_['s4out'] - .1, .45, pan=np.linspace(.5, -.6, int(.45 * SR)), rev=.2)
for k, m in (('n1', 74), ('n2', 77), ('n3', 81)): add(bell(m, 1.2, .5), T_[k], .3, rev=.5); add(tick_hi(3000 + (m - 74) * 120), T_[k], .2)
add(line_riser(.6), T_['s5out'] - .2, .5, rev=.3); add(reverse_swell(.4), T_['s6'] - .4, .5)
add(boom(3.0, 95, 28, 1.2, .7), T_['s6'], .9, rev=.6); add(braam(50, 2.2, 1.0), T_['s6'], .38, rev=.5)   # brand impact
add(shimmer(2.5), T_['logo'], .4, rev=.7); add(whoosh(.5, 300, 4000, .85, 1.2), T_['zaprati'] - .3, .3, rev=.3)
for k, m in enumerate((62, 69, 74)): add(bell(m, 3.0, 1.6), T_['handle'] + k * .12, .26, rev=.7, dly=.2)   # sonic signature, resolves the score

# ------------------------------------------------------------------ mix
duck = np.clip(duck, .35, 1); musL *= duck; musR *= duck
dt = int(.375 * SR); dL = np.zeros(N); dR = np.zeros(N); src = lp(dlyS, 4500)
for k in range(1, 6):
    sh = dt * k
    if sh >= N: break
    (dL if k % 2 else dR)[sh:] += src[:N - sh] * .38 ** (k - 1) * .5
musL += dL; musR += dR
L = dryL + musL; R = dryR + musR
ir_t = T(2.6)
def ir():
    n = noise(len(ir_t)); x = lp(n, 6500) * np.exp(-ir_t / .45) + lp(n, 1600) * np.exp(-ir_t / .8) * .6
    x[:int(.015 * SR)] = 0; return x / np.sqrt(np.sum(x ** 2))
def conv(x, h):
    n = 1 << int(np.ceil(np.log2(len(x) + len(h)))); return np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(h, n), n)[:len(x)]
rs = hp(revS, 200); L += conv(rs, ir()) * .4; R += conv(rs, ir()) * .4
L = hp(L, 28); R = hp(R, 28)
m = max(np.max(np.abs(L)), np.max(np.abs(R))); L /= m; R /= m
drive = 1.6; L = np.tanh(L * drive) / np.tanh(drive); R = np.tanh(R * drive) / np.tanh(drive)          # gentle bus saturation, no clipping
fade = np.ones(N); sel = tt > DUR - .7; fade[sel] = np.cos(np.clip((tt[sel] - (DUR - .7)) / .7, 0, 1) * np.pi / 2) ** 2
fade[:240] = np.linspace(0, 1, 240); L *= fade; R *= fade
pk = max(np.max(np.abs(L)), np.max(np.abs(R))); L *= .89 / pk; R *= .89 / pk
out = np.stack([L, R], 1)
pcm = np.clip(out * 32767 + rng.uniform(-.5, .5, out.shape) + rng.uniform(-.5, .5, out.shape), -32768, 32767).astype('<i2')
with wave.open(sys.argv[1] if len(sys.argv) > 1 else 'audio.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok', out.shape)
