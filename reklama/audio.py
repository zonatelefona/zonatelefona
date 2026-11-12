"""ZONA TELEFONA — original soundtrack + sound design, synthesized from scratch.
120 BPM, D minor. Every hit/whoosh is placed on the same timestamps the visuals use (scene.js).
usage: python3 audio.py out.wav
"""
import sys, wave
import numpy as np

SR = 48000
DUR = 26.0
N = int(SR * DUR)
rng = np.random.default_rng(20261112)
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

# ------------------------------------------------------------------ harmony
# (start, end, bass midi, pad voicing)
Dm = (38, [57, 60, 64, 65, 69]); Bb = (34, [53, 57, 62, 65, 69]); Gm = (31, [58, 62, 65, 69, 74]); A = (33, [52, 57, 61, 64, 67])
Dfin = (38, [50, 57, 62, 64, 65, 69, 76])
chords = [(0, 2, Dm), (2, 4, Bb), (4, 6, A), (6, 8, Dm), (8, 10, Bb), (10, 12, Gm), (12, 14, A),
          (14, 16, Dm), (16, 18, Bb), (18, 20, Gm), (20, 21, A), (21, 26, Dfin)]
ARP = {id(Dm): [62, 65, 69, 72, 74, 72, 69, 65], id(Bb): [62, 65, 70, 74, 77, 74, 70, 65], id(Gm): [62, 67, 70, 74, 79, 74, 70, 67],
       id(A): [61, 64, 69, 73, 76, 73, 69, 64], id(Dfin): [69, 74, 77, 81, 86, 81, 77, 74]}

# ---------- PAD (music bus, ducked) ----------
padL = np.zeros(N); padR = np.zeros(N)
for (a, b, (root, notes)) in chords:
    st = max(0.0, a - 0.08); ln = (b - st) + 0.9
    t = T(ln)
    ev = np.minimum(1, t / 0.35) * np.where(t > (b - st), np.exp(-(t - (b - st)) / 0.3), 1)
    if a >= 21: ev = np.minimum(1, t / 0.02) * np.exp(-t / 3.2) * 1.3
    for k, m in enumerate(notes):
        s = supersaw(m, ln, 5, 0.11) * ev * 0.11
        pan = -0.55 if k % 2 == 0 else 0.55
        place(padL, s * np.cos((pan + 1) * np.pi / 4), st); place(padR, s * np.sin((pan + 1) * np.pi / 4), st)
def pad_cut(tt):
    if tt < 0.15: return 200
    if tt < 6: return 380 + 900 * (tt / 6) ** 1.6
    if tt < 18: return 1700 + 900 * (tt - 6) / 12
    if tt < 19.5: return 2300
    if tt < 21: return 1500 * (6.0 ** ((tt - 19.5) / 1.5))
    return max(900, 5200 * np.exp(-(tt - 21) / 2.5))
padL = tvfilt(padL, pad_cut, 'lp'); padR = tvfilt(padR, pad_cut, 'lp')
pad_env = np.ones(N); tt = np.arange(N) / SR
pad_env *= np.clip((tt - 0.15) / 1.2, 0, 1) * 0.9 + 0.1 * (tt > 0.15)
pad_env[(tt >= 20.93) & (tt < 21.0)] = 0.0   # gap before final impact
musL += padL * pad_env * 0.9; musR += padR * pad_env * 0.9
revS += (padL + padR) * pad_env * 0.25

# ---------- BASS ----------
for (a, b, (root, notes)) in chords:
    if a >= 6 and a < 19.5:
        n8 = int((min(b, 19.5) - a) / 0.25)
        for i in range(n8):
            t0 = a + i * 0.25
            if 18 <= t0 < 19.5 and (t0 * 2) % 1 != 0: continue
            tq = T(0.3); f = mtof(root + 12)
            s = (2 * ((f * tq) % 1) - 1) * 0.5 + np.sin(2 * np.pi * f * tq) * 0.8
            s = lp(s, 520 + 260 * (i % 2 == 0)) * env_ad(tq, 0.004, 0.16)
            add(s, t0, 0.55, music=True)
    # sub layer
    st = a; ln = b - a
    if a >= 21: ln = 5.0
    t = T(ln); f = mtof(root + 12)
    sub = np.sin(2 * np.pi * f * t) * np.minimum(1, t / 0.05) * np.minimum(1, (ln - t) / 0.1)
    g = 0.0 if a < 3 else 0.22 if a < 6 else 0.42 if a < 19.5 else 0.0
    if a >= 21: g = 0.5; sub *= np.exp(-t / 2.6)
    if a >= 19.5 and a < 21: g = 0.0
    add(np.tanh(sub * 1.4), st, g, music=True)
# intro drone (from impact)
t = T(5.9); dr = np.tanh(1.3 * np.sin(2 * np.pi * mtof(38) * t)) * np.minimum(1, t / 1.5) * np.minimum(1, (5.9 - t) / 0.3)
add(lp(dr, 300), 0.15, 0.24, music=True)

# ---------- ARP ----------
for (a, b, ch) in chords:
    root, notes = ch; seq = ARP[id(ch)]
    for i in range(int((b - a) / 0.125)):
        t0 = a + i * 0.125
        if t0 < 3.25 or (20.93 <= t0 < 21.0) or t0 > 25.4: continue
        if 18.0 <= t0 < 19.5: continue
        gain = 0.18 if t0 < 6 else 0.34 if t0 < 18 else 0.42 if t0 < 21 else 0.3 * np.exp(-(t0 - 21) / 2.5)
        bright = 1500 + 1200 * min(1, (t0 - 3.25) / 3) if t0 < 6 else 3600 if t0 < 19.5 else 2500 + 4000 * (t0 - 19.5) / 1.5 if t0 < 21 else 3000
        acc = 1.0 if i % 4 == 0 else 0.72
        add(pluck(seq[i % 8], 0.45, bright), t0, gain * acc, pan=0.35 * np.sin(i * 0.9), rev=0.25, dly=0.5, music=True)

# ---------- DRUMS ----------
K = kick(); C = clap()
for i in range(int((18.0 - 6.0) / BEAT)):
    t0 = 6.0 + i * BEAT
    add(K, t0, 0.95 if i > 0 else 1.15)
    place(duck, -0.7 * np.exp(-T(0.4) / 0.11), t0)
    if i % 2 == 1: add(C, t0, 0.55, pan=0.05, rev=0.35)
    if t0 >= 8.0:
        add(hat(), t0 + 0.25, 0.5, pan=0.3)
    if t0 >= 12.0:
        add(hat(0.018), t0 + 0.125, 0.22, pan=-0.3); add(hat(0.018), t0 + 0.375, 0.22, pan=-0.3)
# intro heartbeat
for t0 in (1.0, 2.0, 4.0, 5.0):
    add(lp(kick(0.8, 0.5, 40), 900), t0, 0.55)
# montage hits
for t0 in (18.0, 18.5, 19.0):
    add(K, t0, 1.2); add(boom(1.4, 70, 32, 0.45, 0.6), t0, 0.5, rev=0.4); add(C, t0, 0.6, rev=0.5)
    add(snare(), t0, 0.4, rev=0.3)
    place(duck, -0.75 * np.exp(-T(0.5) / 0.14), t0)
# build: snare roll 19.5 -> 20.93
t0 = 19.5
while t0 < 20.9:
    k = (t0 - 19.5) / 1.43
    step = 0.25 if k < 0.35 else 0.125 if k < 0.7 else 0.0625
    add(snare(), t0, 0.32 + 0.55 * k ** 1.5, pan=0.15 * np.sin(t0 * 20), rev=0.3)
    t0 += step
# build bass pulse 19.5 -> 20.93 (16ths on A, filter opening)
t0 = 19.5
while t0 < 20.92:
    k = (t0 - 19.5) / 1.43
    tq = T(0.2); f = mtof(45)
    sq = (2 * ((f * tq) % 1) - 1) * 0.6 + np.sin(2 * np.pi * f * tq)
    add(lp(sq, 250 + 2400 * k ** 1.5) * env_ad(tq, 0.003, 0.08), t0, 0.35 + 0.35 * k)
    t0 += 0.125
# riser
t = T(1.43)
rz = tvfilt(noise(len(t)), lambda x: 300 * (9000 / 300) ** min(1, x / 1.43), 'bp', 1.6) * (t / 1.43) ** 2.2
rs = np.sin(2 * np.pi * np.cumsum(160 * (1400 / 160) ** (t / 1.43) * (1 + 0.01 * np.sin(2 * np.pi * 7 * t))) / SR) * (t / 1.43) ** 2 * 0.25
add(rz + rs, 19.5, 0.8, rev=0.4)
# small riser into the drop
t = T(1.35)
add(tvfilt(noise(len(t)), lambda x: 400 * (6000 / 400) ** min(1, x / 1.35), 'bp', 1.4) * (t / 1.35) ** 2.5, 4.6, 0.5, rev=0.3)

# ------------------------------------------------------------------ SOUND DESIGN (visual sync)
# hook impact
add(boom(3.2, 90, 28, 1.3, 1.2), 0.15, 1.0, rev=0.6)
add(metal(2.5, 466.0, 1.0), 0.15, 0.6, pan=-0.2, rev=0.6)
add(hp(noise(SR // 2), 3000) * np.exp(-T(0.5) / 0.12) * 0.25, 0.15, 0.6, rev=0.5)   # air
# light streak sizzle
t = T(0.9); add(bp(noise(len(t)), 6000, 1.0) * np.exp(-t / 0.25) * 0.35, 0.15, 0.6, pan=np.linspace(-0.8, 0.8, len(t)), rev=0.4)
# screen wake 1.5
t = T(1.6)
wake = sum(np.sin(2 * np.pi * mtof(m) * t) * np.exp(-t / d) for m, d in ((86, .9), (93, .7), (98, .5))) * np.minimum(1, t / 0.006) * 0.08
sweep = np.sin(2 * np.pi * np.cumsum(500 * (4.0 ** np.minimum(1, t / 0.15))) / SR) * np.exp(-t / 0.08) * 0.08
add(wake + sweep, 1.5, 0.9, rev=0.5, dly=0.3)
# push into screen whoosh
add(whoosh(0.55, 300, 5000), 2.45, 0.9, pan=0.0, rev=0.3)
# brand impact 3.25 + shimmer
add(boom(2.6, 70, 30, 1.0, 0.8), 3.25, 0.85, rev=0.6)
add(shimmer(3.0), 3.25, 1.0, rev=0.7, dly=0.3)
for m in (62, 69, 74): add(bell(m, 3.0, 1.6), 3.25, 0.5, pan=(m - 69) / 12, rev=0.6)
add(shimmer(2.0), 4.05, 0.55, pan=np.linspace(-0.6, 0.6, int(2.0 * SR)), rev=0.6)   # shine sweep
# transition whooshes
for tend in (5.95, 9.97, 13.97, 17.97):
    add(whoosh(0.6, 260, 4500), tend - 0.51, 0.85, pan=np.linspace(-0.4, 0.4, int(0.6 * SR)), rev=0.25)
# phone flights + landings
for (tl, pf, pt) in ((6.0, 0.0, 0.0), (6.5, -0.9, -0.4), (7.0, 0.9, 0.4)):
    d = 0.45
    add(whoosh(d, 400, 3000, 0.9, 1.0), tl - d * 0.9, 0.6, pan=np.linspace(pf, pt, int(d * SR)), rev=0.2)
    add(tick(), tl + 0.01, 0.9, pan=pt, rev=0.4)
    add(boom(1.2, 60, 35, 0.35, 0.3), tl, 0.45 if tl > 6 else 0.8, rev=0.3)
add(metal(2.0, 587.3, 0.8), 6.0, 0.5, rev=0.5)
# otkup: entrance hit, scan, checks, confirm
add(boom(1.4, 70, 34, 0.4, 0.5), 10.0, 0.5, rev=0.4)
for (a, b, d) in ((10.5, 11.7, 1), (11.7, 12.9, -1)):
    t = T(b - a); u = t / (b - a)
    amp = np.sin(np.pi * u) ** 0.7
    tone = np.sin(2 * np.pi * np.cumsum(880 + 260 * (u if d > 0 else 1 - u) + 6 * np.sin(2 * np.pi * 31 * t)) / SR) * 0.05
    hiss = tvfilt(noise(len(t)), lambda x, a=a, b=b, d=d: 2500 + 2500 * ((x / (b - a)) if d > 0 else 1 - x / (b - a)), 'bp', 0.6) * 0.12
    add((tone + hiss) * amp, a, 0.8, pan=np.linspace(-0.3 * d, 0.3 * d, len(t)), rev=0.3)
for tc in (11.0, 11.5, 12.0): add(blip(86, 91), tc, 1.0, pan=0.2, rev=0.4, dly=0.3)
for i, m in enumerate((81, 86, 93)): add(bell(m, 1.6, 0.6), 12.5 + i * 0.07, 0.55, rev=0.5)
add(shimmer(1.5), 12.5, 0.5, rev=0.5)
# zamena: entrance, long swap whoosh, landing
add(boom(1.4, 70, 34, 0.4, 0.5), 14.0, 0.5, rev=0.4)
d = 1.15
add(whoosh(d, 220, 3800, 0.82, 1.2), 14.9, 0.9, pan=np.linspace(-0.9, 0.9, int(d * SR)), rev=0.35)
add(boom(1.8, 75, 32, 0.6, 0.6), 16.0, 0.7, rev=0.5); add(tick(), 16.0, 0.8, rev=0.4); add(metal(1.6, 698.5, 0.7), 16.0, 0.4, rev=0.5)
# montage whooshes into each word
for tw in (18.5, 19.0, 19.5):
    add(whoosh(0.3, 600, 6000, 0.9, 1.0), tw - 0.27, 0.45, rev=0.2)
# FINAL IMPACT 21.0
add(boom(4.5, 95, 26, 1.8, 1.4), 21.0, 1.15, rev=0.8)
add(K, 21.0, 1.2)
add(metal(4.0, 293.7, 1.8), 21.0, 0.8, pan=-0.15, rev=0.8)
add(shimmer(4.5), 21.05, 1.2, rev=0.8, dly=0.3)
for m in (50, 62, 69, 74, 81): add(bell(m, 4.5, 2.2), 21.0, 0.55 if m > 60 else 0.35, pan=(m - 69) / 20, rev=0.7)
add(hp(noise(SR), 2500) * np.exp(-T(1.0) / 0.25) * 0.3, 21.0, 0.7, rev=0.6)
# end lockup accents
add(whoosh(0.5, 1500, 7000, 0.7, 1.0), 21.3, 0.25, rev=0.4)
add(bell(86, 2.0, 0.9), 22.15, 0.25, rev=0.6, dly=0.4)     # tagline
add(blip(93, 98, 0.07), 22.8, 0.8, rev=0.6, dly=0.4)       # instagram pill
add(shimmer(2.5), 23.2, 0.7, pan=np.linspace(-0.7, 0.7, int(2.5 * SR)), rev=0.6)
for t0 in (22.0, 23.0, 24.0): add(lp(kick(0.9, 0.6, 40), 700), t0, 0.5)
add(shimmer(2.0), 23.9, 0.6, rev=0.7)
add(bell(74, 2.2, 1.2), 25.0, 0.25, rev=0.8)

# ------------------------------------------------------------------ mix
duck = np.clip(duck, 0.25, 1)
musL *= duck; musR *= duck
# ping-pong delay (dotted eighth)
dt = int(0.375 * SR); dL = np.zeros(N); dR = np.zeros(N); fb = 0.38
src = lp(dlyS, 4500)
for k in range(1, 7):
    sh = dt * k; g = fb ** (k - 1) * 0.55
    if sh >= N: break
    (dL if k % 2 else dR)[sh:] += src[:N - sh] * g
musL += dL * duck; musR += dR * duck
L = dryL + musL; R = dryR + musR
# reverb (stereo convolution)
ir_t = T(3.2)
def ir():
    n = noise(len(ir_t)); e = np.exp(-ir_t / 0.62)
    x = lp(n, 7000) * e + lp(n, 1800) * np.exp(-ir_t / 1.0) * 0.6
    x[:int(0.018 * SR)] = 0; return x / np.sqrt(np.sum(x ** 2))
def conv(x, h):
    n = 1 << int(np.ceil(np.log2(len(x) + len(h))))
    return np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(h, n), n)[:len(x)]
rs = hp(revS, 180)
L += conv(rs, ir()) * 0.55; R += conv(rs, ir()) * 0.55
# master: highpass, glue, limiter-ish, fades
L = hp(L, 28); R = hp(R, 28)
m = max(np.max(np.abs(L)), np.max(np.abs(R)))
L /= m; R /= m
drive = 2.2
L = np.tanh(L * drive) / np.tanh(drive); R = np.tanh(R * drive) / np.tanh(drive)
fade = np.ones(N); fade[tt > 25.4] = np.cos(np.clip((tt[tt > 25.4] - 25.4) / 0.6, 0, 1) * np.pi / 2) ** 2
fade[:int(0.004 * SR)] = np.linspace(0, 1, int(0.004 * SR))
L *= fade; R *= fade
pk = max(np.max(np.abs(L)), np.max(np.abs(R))); L *= 0.89 / pk; R *= 0.89 / pk
out = np.stack([L, R], 1)
pcm = np.clip(out * 32767 + rng.uniform(-.5, .5, out.shape) + rng.uniform(-.5, .5, out.shape), -32768, 32767).astype('<i2')
with wave.open(sys.argv[1] if len(sys.argv) > 1 else 'audio.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok', out.shape, 'rms dB', 20 * np.log10(np.sqrt(np.mean(out ** 2))))
