"""ZONA TELEFONA v5 — iPhone 17 Pro × Galaxy S26 Ultra. Per-shot sound design Original soundtrack + sound design, synthesized from scratch.
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

# ------------------------------------------------------------------ music: D minor, 120 BPM grid anchored at 8.0 s
Dm = (26, [50, 53, 57, 60, 64]); Bb = (22, [46, 50, 53, 57, 62]); F_ = (29, [53, 57, 60, 64, 69]); C_ = (24, [48, 52, 55, 60, 62])
chords = [(0, 8, Dm), (8, 10, Dm), (10, 12, Bb), (12, 14, F_), (14, 16, C_), (16, 18, Dm), (18, 19.5, Bb), (19.5, 20.5, C_), (20.5, 27, Dm)]
ARP = {id(Dm): [62, 65, 69, 72, 74, 72, 69, 65], id(Bb): [62, 65, 70, 74, 77, 74, 70, 65], id(F_): [60, 65, 69, 72, 77, 72, 69, 65], id(C_): [60, 64, 67, 72, 76, 72, 67, 64]}
tt = np.arange(N) / SR
padL = np.zeros(N); padR = np.zeros(N)
for (a, b, (root, notes)) in chords:
    st = max(0, a - .05); ln = b - st + .8; t = T(ln)
    ev = np.minimum(1, t / (.8 if a == 0 else .3)) * np.where(t > b - st, np.exp(-(t - (b - st)) / .3), 1)
    if a >= 20.5: ev = np.minimum(1, t / .02) * np.exp(-t / 3.4) * 1.25
    for k, m in enumerate(notes):
        s = supersaw(m, ln, 5, .1) * ev * .08; pan = -.6 if k % 2 == 0 else .6
        place(padL, s * np.cos((pan + 1) * np.pi / 4), st); place(padR, s * np.sin((pan + 1) * np.pi / 4), st)
def pad_cut(x):
    if x < 8: return 300 + 700 * (max(0, x) / 8) ** 1.5
    if x < 14.5: return 1300 + 500 * (x - 8) / 6.5
    if x < 19.5: return 2400
    if x < 20.45: return 1500 * 5 ** ((x - 19.5) / .95)
    return max(900, 4500 * np.exp(-(x - 20.5) / 2.6))
padL = tvfilt(padL, pad_cut, 'lp'); padR = tvfilt(padR, pad_cut, 'lp')
pe = np.clip((tt - .1) / 1.5, 0, 1) * .9 + .1; pe[(tt >= 20.42) & (tt < 20.5)] = 0
musL += padL * pe; musR += padR * pe; revS += (padL + padR) * pe * .22
def root_at(x):
    for (a, b, ch) in chords:
        if a <= x < b: return ch[0]
    return 26
# drone (intro)
t = T(8.2); add(lp(np.tanh(1.3 * np.sin(2 * np.pi * mtof(38) * t)) * np.minimum(1, t / 1.0) * np.minimum(1, (8.2 - t) / .4), 220), 0.0, .26, music=True)
# precision ticks during the iPhone rotation (clock-like, quiet)
for i in range(int((7.5 - 3.25) / .25)):
    x = 3.25 + i * .25; t = T(.03)
    add(hp(noise(len(t)), 6000) * np.exp(-t / .004) * (.25 if i % 2 == 0 else .14), x, .5, pan=.25 if i % 2 else -.25, music=True)
# beat
K = kick(1.0, .6, 44); CL = clap()
def kick_at(x, g): add(K, x, g); place(duck, -.6 * np.exp(-T(.4) / .11), x)
for i in range(int((19.5 - 8.0) / BEAT)):
    x = 8.0 + i * BEAT
    if x < 10.0: continue                    # Samsung reveal breathes, beat enters with the macro cut
    kick_at(x, .75 if x < 14.5 else .95)
    if x >= 14.5 and i % 2 == 1: add(CL, x, .45, rev=.35)
    if x >= 11.5: add(hat(.025), x + .25, .35, pan=.3)
    if x >= 14.5: add(hat(.012), x + .125, .18, pan=-.3); add(hat(.012), x + .375, .18, pan=-.3)
for i in range(int((19.5 - 10.0) / .25)):
    x = 10.0 + i * .25
    if [1, 0, 1, 0, 1, 0, 1, 1][i % 8]: add(b808(root_at(x) + 12, .45, .16), x, .38, music=True)
for (a, b, ch) in chords:
    seq = ARP[id(ch)]
    for i in range(int((b - a) / .125)):
        x = a + i * .125
        if x < 10.0 or x > 25.8 or 20.42 <= x < 20.5: continue
        g = .16 if x < 14.5 else .26 if x < 20.5 else .2 * np.exp(-(x - 20.5) / 2.5)
        br = 1800 if x < 14.5 else 3400 if x < 19.5 else 1800 + 5000 * (x - 19.5) if x < 20.5 else 2800
        add(pluck(seq[i % 8], .4, br), x, g * (1 if i % 4 == 0 else .7), pan=.4 * np.sin(i * .9), rev=.2, dly=.35, music=True)
# build 19.5 -> 20.45
x = 19.5
while x < 20.42:
    k = (x - 19.5) / .92; add(snare(), x, .12 + .3 * k ** 1.5, rev=.3); x += .125 if k < .5 else .0625
add(line_riser(.95), 19.5, .8, rev=.4)
# payoff
add(b808(38, 3.5, 1.7), 20.5, .75, music=True); kick_at(20.5, 1.0)
for x in (22.0, 23.5, 25.0): add(lp(kick(.9, .5, 42), 800), x, .4)

# ------------------------------------------------------------------ sound design, shot by shot
add(boom(4.0, 70, 26, 1.6, .5), .08, .9, rev=.7)                                  # hook: deep impact
t = T(.9); add(tvfilt(noise(len(t)), lambda z: 4000 + 6000 * z / .9, 'bp', .8) * np.exp(-t / .35) * .5, .06, .6, pan=np.linspace(-.9, .9, len(t)), rev=.5)  # streak shimmer L→R
t = T(2.2); add(lp(supersaw(62, 2.2, 5, .15), 1400) * np.sin(np.pi * t / 2.2) ** 2 * .12, .6, 1.0, rev=.6)   # plateau lights up: swell
add(glass_chime([81, 88], 2.0), 2.3, .55, rev=.6)                                  # "iPhone 17 Pro" title
add(tonal_sweep(2.3, 220, 660), 3.2, 1.0, pan=np.linspace(-.6, .6, int(2.3 * SR)), rev=.4)   # rotation
add(whoosh(.55, 400, 2600, .7, 1.1), 5.15, .35, rev=.3)                            # edge passes the lens
add(glass_chime([74, 81, 86, 90], 2.6), 5.9, .7, rev=.7, dly=.3)                   # screen reveal
add(reverse_swell(.5), 7.5, .9, rev=.3); add(downer(1.2), 7.98, .55, rev=.4)       # bass transition iPhone → Samsung
add(boom(1.6, 55, 30, .5, .1), 8.0, .55, rev=.4)
add(mech_whoosh(.9), 7.95, .9, pan=np.linspace(.3, -.1, int(.9 * SR)), rev=.3)     # Samsung reveal
add(metal_settle(), 8.85, .7, rev=.4)
add(glass_chime([69, 76], 1.6), 8.45, .4, rev=.5)                                  # "Galaxy S26 Ultra" title (lower)
t = T(1.1); add(bp(noise(len(t)), 7000, 1.0) * np.sin(np.pi * t / 1.1) * .12, 8.55, .9, pan=np.linspace(-.7, .7, len(t)), rev=.4)  # light sweep on glass
add(shutter(), 10.0, 1.0, rev=.25); add(servo(.4), 10.06, 1.0)                    # macro cut: shutter accent
add(whoosh(.8, 200, 1800, .5, 1.4), 11.4, .5, pan=np.linspace(.8, -.8, int(.8 * SR)), rev=.4)   # 30° angle drift
add(felt_thump(), 13.0, .55, rev=.3)                                               # front view lands
add(latch_click(), 13.3, 1.0, rev=.3); add(friction(.9), 13.33, 1.0, pan=-.2, rev=.2)   # S Pen eject + slide
add(whoosh(.9, 500, 4200, .85, 1.0), 14.6, .6, pan=np.linspace(-1, -.2, int(.9 * SR)), rev=.3)   # iPhone enters (left, brighter)
add(whoosh(.9, 250, 2400, .85, 1.0), 14.62, .6, pan=np.linspace(1, .2, int(.9 * SR)), rev=.3)   # Samsung enters (right, darker)
add(boom(1.5, 80, 34, .45, .4), 15.42, .5, rev=.4)                                 # they settle
add(tonal_sweep(1.6, 520, 1320), 15.6, .8, pan=np.linspace(-.9, .9, int(1.6 * SR)), rev=.6, dly=.3)   # light trail
add(shimmer(1.6), 15.9, .45, pan=np.linspace(-.6, .9, int(1.6 * SR)), rev=.6)
add(bell(69, 1.6, .9), 17.5, .35, pan=-.5, rev=.5)                                 # light on iPhone
add(bell(64, 1.6, .9), 18.5, .35, pan=.5, rev=.5)                                  # light on Samsung
add(glass_chime([62, 69, 74, 81], 3.0), 20.5, .55, rev=.7)                         # payoff chord colour
# sonic signature (logo)
for k, m in enumerate((74, 81, 86)): add(bell(m, 3.0, 1.6), 22.0 + k * .16, .42, pan=(k - 1) * .3, rev=.75, dly=.25)
add(boom(3.0, 60, 30, 1.2, .1), 22.0, .45, rev=.6)
add(shimmer(2.5), 22.1, .5, rev=.7)
add(ui_pop(1250), 23.5, .8, rev=.3); add(ui_pop(1660), 23.58, .7, rev=.3)          # CTA
add(whoosh(.5, 1200, 6000, .7, .9), 23.75, .25, rev=.4)                           # pill
t = T(1.3); add(bp(noise(len(t)), 8000, .8) * np.sin(np.pi * t / 1.3) * .08, 24.6, .9, pan=np.linspace(-.6, .6, len(t)), rev=.5)  # logo shine

# ------------------------------------------------------------------ mix
duck = np.clip(duck, .3, 1); musL *= duck; musR *= duck
dt = int(.375 * SR); dL = np.zeros(N); dR = np.zeros(N); src = lp(dlyS, 4500)
for k in range(1, 7):
    sh = dt * k
    if sh >= N: break
    (dL if k % 2 else dR)[sh:] += src[:N - sh] * .38 ** (k - 1) * .5
musL += dL * duck; musR += dR * duck
L = dryL + musL; R = dryR + musR
ir_t = T(3.2)
def ir():
    n = noise(len(ir_t)); x = lp(n, 6500) * np.exp(-ir_t / .6) + lp(n, 1600) * np.exp(-ir_t / 1.0) * .6
    x[:int(.02 * SR)] = 0; return x / np.sqrt(np.sum(x ** 2))
def conv(x, h):
    n = 1 << int(np.ceil(np.log2(len(x) + len(h)))); return np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(h, n), n)[:len(x)]
rs = hp(revS, 200); L += conv(rs, ir()) * .5; R += conv(rs, ir()) * .5
L = hp(L, 28); R = hp(R, 28)
m = max(np.max(np.abs(L)), np.max(np.abs(R))); L /= m; R /= m
drive = 1.8; L = np.tanh(L * drive) / np.tanh(drive); R = np.tanh(R * drive) / np.tanh(drive)
fade = np.ones(N); sel = tt > 26.3; fade[sel] = np.cos(np.clip((tt[sel] - 26.3) / .7, 0, 1) * np.pi / 2) ** 2
fade[:200] = np.linspace(0, 1, 200); L *= fade; R *= fade
pk = max(np.max(np.abs(L)), np.max(np.abs(R))); L *= .89 / pk; R *= .89 / pk
out = np.stack([L, R], 1)
pcm = np.clip(out * 32767 + rng.uniform(-.5, .5, out.shape) + rng.uniform(-.5, .5, out.shape), -32768, 32767).astype('<i2')
with wave.open(sys.argv[1] if len(sys.argv) > 1 else 'audio.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok', out.shape)
