"""ZONA TELEFONA v2 — aggressive orange edition. Original soundtrack + sound design, synthesized from scratch.
120 BPM, D minor. Every hit/whoosh is placed on the same timestamps the visuals use (scene.js).
usage: python3 audio.py out.wav
"""
import sys, wave
import numpy as np

SR = 48000
DUR = 27.0
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

# ------------------------------------------------------------------ harmony  (E minor, 120 BPM)
Em = (28, [52, 55, 59, 62, 66]); C = (24, [48, 52, 55, 59, 64]); Am = (33, [57, 60, 64, 67, 71]); Bm = (35, [54, 59, 62, 66, 69])
chords = [(0, 3, Em), (3, 5, C), (5, 7, Bm), (7, 9, Em), (9, 11, C), (11, 13, Am), (13, 15, Bm), (15, 16, Bm),
          (16, 18, Em), (18, 20, C), (20, 21, Bm), (21, 27, Em)]
ARP = {id(Em): [64, 67, 71, 74, 76, 74, 71, 67], id(C): [64, 67, 72, 76, 79, 76, 72, 67], id(Am): [64, 69, 72, 76, 81, 76, 72, 69], id(Bm): [66, 69, 71, 74, 78, 74, 71, 69]}
tt = np.arange(N) / SR

# ---------- PAD ----------
padL = np.zeros(N); padR = np.zeros(N)
for (a, b, (root, notes)) in chords:
    st = max(0.0, a - 0.05); ln = (b - st) + 0.8; t = T(ln)
    ev = np.minimum(1, t / 0.25) * np.where(t > (b - st), np.exp(-(t - (b - st)) / 0.25), 1)
    if a >= 21: ev = np.minimum(1, t / 0.01) * np.exp(-t / 3.0) * 1.3
    for k, m in enumerate(notes):
        s = supersaw(m, ln, 5, 0.12) * ev * 0.1; pan = -0.6 if k % 2 == 0 else 0.6
        place(padL, s * np.cos((pan + 1) * np.pi / 4), st); place(padR, s * np.sin((pan + 1) * np.pi / 4), st)
def pad_cut(x):
    if x < 0.5: return 250
    if x < 3: return 600 + 400 * (x - .5) / 2.5
    if x < 7: return 1300 + 500 * (x - 3) / 4
    if x < 20: return 2400
    if x < 21: return 1200 * (6 ** (x - 20))
    return max(1000, 6000 * np.exp(-(x - 21) / 2.2))
padL = tvfilt(padL, pad_cut, 'lp'); padR = tvfilt(padR, pad_cut, 'lp')
pe = np.clip((tt - 0.5) / 0.3, 0, 1) * 0.85 + 0.15 * (tt > 0.05); pe[(tt >= 20.93) & (tt < 21.0)] = 0
musL += padL * pe; musR += padR * pe; revS += (padL + padR) * pe * 0.2

# ---------- 808 / BASS ----------
def root_at(x):
    for (a, b, ch) in chords:
        if a <= x < b: return ch[0]
    return 28
bass_hits = []
for i in range(int((20.0 - 7.0) / 0.25)):
    x = 7.0 + i * 0.25
    pat = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0][i % 16]
    if pat: bass_hits.append(x)
for x in bass_hits: add(b808(root_at(x) + 12, 0.7, 0.32), x, 0.55, music=True)
for x in (3.5, 4.0, 5.0, 6.0, 6.5): add(b808(root_at(x) + 12, 1.0, 0.5), x, 0.6, music=True)
add(b808(28 + 12, 3.5, 1.6), 21.0, 0.85, music=True)
t = T(2.5); dr = np.tanh(1.4 * np.sin(2 * np.pi * mtof(40) * t)) * np.minimum(1, t / .05) * np.minimum(1, (2.5 - t) / .2)
add(lp(dr, 260), 0.5, 0.3, music=True)

# ---------- ARP ----------
for (a, b, ch) in chords:
    seq = ARP[id(ch)]
    for i in range(int((b - a) / 0.125)):
        x = a + i * 0.125
        if x < 7.0 or (20.93 <= x < 21.0) or x > 25.6: continue
        g = 0.3 if x < 20 else 0.4 if x < 21 else 0.26 * np.exp(-(x - 21) / 2.2)
        br = 3800 if x < 20 else 2500 + 5000 * (x - 20) if x < 21 else 3200
        add(pluck(seq[i % 8], 0.4, br), x, g * (1 if i % 4 == 0 else .7), pan=.4 * np.sin(i * .9), rev=.2, dly=.4, music=True)

# ---------- DRUMS ----------
K = kick(1.1, 0.6, 45); CL = clap()
def kick_at(x, g=1.0):
    add(K, x, g); place(duck, -0.72 * np.exp(-T(0.4) / 0.11), x)
for x in (3.5, 4.0, 5.0, 5.5, 6.0, 6.5): kick_at(x, 0.9)          # half-time intro groove
for i in range(int((20.0 - 7.0) / BEAT)):
    x = 7.0 + i * BEAT
    kick_at(x, 1.0)
    if i % 2 == 1: add(CL, x, 0.6, rev=0.35); add(snare(), x, 0.35, rev=.2)
    add(hat(0.03), x + 0.25, 0.5, pan=.3)
    if x >= 11:
        add(hat(0.015), x + 0.125, 0.25, pan=-.3); add(hat(0.015), x + 0.375, 0.25, pan=-.3)
add(CL, 4.5, .5, rev=.4); add(CL, 5.5, .5, rev=.4); add(CL, 6.5, .5, rev=.4)
# build roll 20.0 -> 20.93
x = 20.0
while x < 20.9:
    k = (x - 20.0) / .93; add(snare(), x, .3 + .55 * k ** 1.4, pan=.15 * np.sin(x * 20), rev=.3)
    x += 0.125 if k < .45 else 0.0625 if k < .8 else 0.03125
t = T(1.0)
add(tvfilt(noise(len(t)), lambda z: 400 * (10000 / 400) ** min(1, z), 'bp', 1.5) * t ** 2.2, 19.95, 0.9, rev=.4)
add(np.sin(2 * np.pi * np.cumsum(200 * 8 ** t) / SR) * t ** 2 * 0.25, 19.95, 0.8)

# ------------------------------------------------------------------ SOUND DESIGN — synced to every slam
# S1 energy activation: rising charge 0.0 -> 0.5
t = T(0.5)
add(np.sin(2 * np.pi * np.cumsum(80 * 30 ** (t / .5)) / SR) * (t / .5) ** 2 * 0.25 + tvfilt(noise(len(t)), lambda z: 300 * 30 ** min(1, z / .5), 'bp', 1.2) * (t / .5) ** 2.5 * 0.6, 0.0, 1.0, rev=.3)
# word slams: [time, strength, braam note or None]
SLAMS = [(0.5, 1.2, 52), (1.0, 1.0, 55), (3.5, .8, None), (4.0, 1.1, 48), (7.5, .8, 52), (8.5, .8, 55), (9.5, 1.0, 48),
         (11.5, .9, 57), (11.75, .5, None), (13.5, .9, 59), (13.75, .5, None), (17.5, .6, None), (18.0, 1.0, 52), (18.5, .5, None),
         (21.0, 1.5, 40), (21.35, .9, 47)]
for (x, s, note) in SLAMS:
    add(boom(2.0 if s > .9 else 1.3, 85, 30, .5 + .4 * s, .8), x, .55 * s + .2, rev=.45)
    add(hp(noise(int(.3 * SR)), 2500) * np.exp(-T(.3) / .05) * .35, x, .5 * s, rev=.4)         # crack
    add(tick(), x, .6 * s, rev=.3)
    if note: add(braam(note, 2.0, .55 + .3 * s), x, .55 * s, rev=.5, music=False)
    add(whoosh(0.32, 700, 6500, .92, 1.0), x - 0.3, .45 * s, pan=np.linspace(-.5, .5, int(.32 * SR)), rev=.2)
    place(duck, -0.6 * s * np.exp(-T(.5) / .15), x)
# scene transition whooshes (ending on cut) + warp sweeps
for tend in (3.0, 7.0, 11.0, 16.0):
    add(whoosh(0.65, 250, 5000, .88, 1.3), tend - .57, 0.9, pan=np.linspace(-.6, .6, int(.65 * SR)), rev=.3)
    add(downer(.8), tend, .5, rev=.4)
# S2 phone fly-in from depth
add(whoosh(0.55, 200, 3500, .9, 1.1), 2.97, .8, rev=.3)
# S3 phone entrances
for x, p in ((7.5, -.8), (8.5, .8), (9.5, 0)): add(whoosh(.42, 400, 3000, .9, 1.0), x - .4, .55, pan=np.linspace(p, p * .3, int(.42 * SR)), rev=.2)
# S4 scan beam 12.0 -> 13.2
t = T(1.2); u = t / 1.2
add((np.sin(2 * np.pi * np.cumsum(700 + 500 * u) / SR) * .05 + tvfilt(noise(len(t)), lambda z: 2000 + 3000 * z / 1.2, 'bp', .6) * .14) * np.sin(np.pi * u) ** .6, 12.0, .9, rev=.3)
for x in (12.3, 12.7, 13.1): add(blip(88, 95), x, .7, rev=.4, dly=.3)
# S5 pass-throughs
add(whoosh(.75, 180, 3500, .5, 1.2), 16.0, 1.0, pan=np.linspace(-1, 1, int(.75 * SR)), rev=.3)
add(whoosh(.75, 180, 3500, .5, 1.2), 16.45, 1.0, pan=np.linspace(1, -1, int(.75 * SR)), rev=.3)
add(whoosh(.55, 300, 4500, .9, 1.0), 17.0, .7, rev=.3)
# FINAL 21.0
add(boom(5.0, 100, 24, 2.0, 1.5), 21.0, 1.1, rev=.8)
add(metal(4.0, 329.6, 1.8), 21.0, .7, rev=.8)
add(shimmer(4.5), 21.05, 1.2, rev=.8, dly=.3)
for m in (40, 52, 59, 64, 71, 76): add(bell(m, 4.5, 2.0), 21.0, .4 if m > 50 else .3, pan=(m - 64) / 24, rev=.7)
for x, m in ((22.2, 88), (22.6, 91), (23.0, 95)):
    add(tick(), x, .7, rev=.3); add(bell(m, 1.5, .6), x, .3, rev=.5, dly=.3); add(lp(kick(.9, .5, 42), 900), x, .55)
add(shimmer(2.0), 23.6, .7, pan=np.linspace(-.7, .7, int(2.0 * SR)), rev=.6)
add(shimmer(2.0), 24.0, .6, rev=.7)
for x in (24.0, 25.0): add(lp(kick(.9, .6, 40), 700), x, .45)

# ------------------------------------------------------------------ mix
duck = np.clip(duck, 0.22, 1); musL *= duck; musR *= duck
dt = int(0.375 * SR); dL = np.zeros(N); dR = np.zeros(N); src = lp(dlyS, 4500)
for k in range(1, 7):
    sh = dt * k
    if sh >= N: break
    (dL if k % 2 else dR)[sh:] += src[:N - sh] * 0.38 ** (k - 1) * 0.5
musL += dL * duck; musR += dR * duck
L = dryL + musL; R = dryR + musR
ir_t = T(3.0)
def ir():
    n = noise(len(ir_t)); x = lp(n, 7000) * np.exp(-ir_t / .55) + lp(n, 1800) * np.exp(-ir_t / .9) * .6
    x[:int(.015 * SR)] = 0; return x / np.sqrt(np.sum(x ** 2))
def conv(x, h):
    n = 1 << int(np.ceil(np.log2(len(x) + len(h)))); return np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(h, n), n)[:len(x)]
rs = hp(revS, 200); L += conv(rs, ir()) * .5; R += conv(rs, ir()) * .5
L = hp(L, 30); R = hp(R, 30)
# gentle presence lift so it cuts on phone speakers
def tilt(x): return x + hp(x, 2500) * 0.25
L = tilt(L); R = tilt(R)
m = max(np.max(np.abs(L)), np.max(np.abs(R))); L /= m; R /= m
drive = 2.6; L = np.tanh(L * drive) / np.tanh(drive); R = np.tanh(R * drive) / np.tanh(drive)
fade = np.ones(N); sel = tt > 26.3; fade[sel] = np.cos(np.clip((tt[sel] - 26.3) / .7, 0, 1) * np.pi / 2) ** 2
fade[:200] = np.linspace(0, 1, 200); L *= fade; R *= fade
pk = max(np.max(np.abs(L)), np.max(np.abs(R))); L *= .89 / pk; R *= .89 / pk
out = np.stack([L, R], 1)
pcm = np.clip(out * 32767 + rng.uniform(-.5, .5, out.shape) + rng.uniform(-.5, .5, out.shape), -32768, 32767).astype('<i2')
with wave.open(sys.argv[1] if len(sys.argv) > 1 else 'audio.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok', out.shape)
