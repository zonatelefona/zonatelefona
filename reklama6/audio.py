"""ZONA TELEFONA v6 — "IPHONE ILI ULTRA?" Per-shot sound design Original soundtrack + sound design, synthesized from scratch.
120 BPM, D minor. Every hit/whoosh is placed on the same timestamps the visuals use (scene.js).
usage: python3 audio.py out.wav
"""
import sys, wave
import numpy as np

SR = 48000
DUR = 24.0
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

# ------------------------------------------------------------------ music: F minor, 120 BPM (beat = 0.5 s)
Fm = (29, [53, 56, 60, 63, 65]); Db = (25, [49, 53, 56, 60, 63]); Ab = (32, [51, 56, 60, 63, 68]); Eb = (27, [51, 55, 58, 63, 67])
chords = [(0, 2, Fm), (2, 4, Fm), (4, 7, Db), (7, 9, Fm), (9, 11, Db), (11, 12, Eb), (12, 14, Fm), (14, 16, Ab), (16, 17, Eb), (17, 19, Fm), (19, 21, Db), (21, 24, Fm)]
ARP = {id(Fm): [65, 68, 72, 75, 77, 75, 72, 68], id(Db): [65, 68, 73, 77, 80, 77, 73, 68], id(Ab): [63, 68, 72, 75, 80, 75, 72, 68], id(Eb): [63, 67, 70, 75, 79, 75, 70, 67]}
tt = np.arange(N) / SR
def root_at(x):
    for (a, b, ch) in chords:
        if a <= x < b: return ch[0]
    return 29
padL = np.zeros(N); padR = np.zeros(N)
for (a, b, (root, notes)) in chords:
    if a < 2: continue
    st = a - .05; ln = b - st + .6; t = T(ln)
    ev = np.minimum(1, t / .25) * np.where(t > b - st, np.exp(-(t - (b - st)) / .25), 1)
    if a >= 17: ev = ev * (1.2 if a == 17 else .9)
    for k, m in enumerate(notes):
        s = supersaw(m, ln, 5, .1) * ev * .07; pan = -.6 if k % 2 == 0 else .6
        place(padL, s * np.cos((pan + 1) * np.pi / 4), st); place(padR, s * np.sin((pan + 1) * np.pi / 4), st)
def pad_cut(x):
    if x < 7: return 700 + 500 * max(0, x - 2) / 5
    if x < 12: return 1800
    if x < 16: return 2600
    if x < 16.95: return 1600 * 4 ** ((x - 16) / .95)
    return max(1500, 5200 * np.exp(-(x - 17) / 3))
padL = tvfilt(padL, pad_cut, 'lp'); padR = tvfilt(padR, pad_cut, 'lp')
pe = np.ones(N); pe[(tt >= 16.92) & (tt < 17.0)] = 0
musL += padL * pe; musR += padR * pe; revS += (padL + padR) * pe * .15
K = kick(1.05, .55, 46); CL = clap()
def kick_at(x, g): add(K, x, g); place(duck, -.65 * np.exp(-T(.4) / .1), x)
# iPhone section: precise, light — tight kick + 16th ticks + filtered pulse bass
for i in range(int((7.0 - 3.0) / .5)): kick_at(3.0 + i * .5, .55)
for i in range(int((7.0 - 2.0) / .125)):
    x = 2.0 + i * .125; t = T(.03)
    add(hp(noise(len(t)), 7000) * np.exp(-t / .005) * (.22 if i % 2 == 0 else .12), x, .5, pan=.3 if i % 2 else -.3, music=True)
for i in range(int((7.0 - 2.0) / .25)):
    x = 2.0 + i * .25; tq = T(.22); f = mtof(root_at(x) + 24)
    s = lp((2 * ((f * tq) % 1) - 1), 700) * np.exp(-tq / .09); add(s, x, .28, music=True)
# Samsung + duel: full beat, deep 808
for i in range(int((16.0 - 7.5) / .5)):
    x = 7.5 + i * .5; kick_at(x, .95)
    if x >= 8.5 and int((x - 7.5) / .5) % 2 == 1: add(CL, x, .5, rev=.35)
    if x >= 9.5: add(hat(.022), x + .25, .32, pan=.3)
    if x >= 12.5: add(hat(.01), x + .125, .16, pan=-.3); add(hat(.01), x + .375, .16, pan=-.3)
for i in range(int((16.0 - 7.25) / .25)):
    x = 7.25 + i * .25
    if [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0][i % 16]: add(b808(root_at(x) + 12, .6, .25), x, .5, music=True)
for (a, b, ch) in chords:
    seq = ARP[id(ch)]
    for i in range(int((b - a) / .125)):
        x = a + i * .125
        if x < 9.5 or 16.92 <= x < 17.0 or x > 23.2: continue
        g = .2 if x < 12 else .26 if x < 17 else .22 * np.exp(-(x - 17) / 3.5)
        br = 2400 if x < 12 else 3600 if x < 16 else 2000 + 5000 * (x - 16) if x < 17 else 3200
        add(pluck(seq[i % 8], .35, br), x, g * (1 if i % 4 == 0 else .7), pan=.4 * np.sin(i * .9), rev=.15, dly=.3, music=True)
# build 16.0 → 16.92
x = 16.0
while x < 16.9:
    k = (x - 16) / .9; add(snare(), x, .25 + .45 * k ** 1.4, rev=.25); x += .125 if k < .45 else .0625 if k < .8 else .03125
add(line_riser(.92), 16.0, .9, rev=.4)
# drop 17 → end
kick_at(17.0, 1.2); add(b808(41, 2.5, 1.2), 17.0, .8, music=True)
for i in range(int((23.0 - 17.5) / .5)):
    x = 17.5 + i * .5; kick_at(x, .8)
    if i % 2 == 1: add(CL, x, .4, rev=.35)
    add(hat(.02), x + .25, .26, pan=.3)
for i in range(int((23.0 - 17.0) / .25)):
    x = 17.0 + i * .25
    if [1, 0, 0, 1, 0, 0, 1, 0][i % 8]: add(b808(root_at(x) + 12, .55, .22), x, .42, music=True)

# ------------------------------------------------------------------ SOUND DESIGN
# HOOK — powerful cinematic impacts, each different
add(boom(3.0, 95, 28, 1.1, 1.3), .12, 1.0, rev=.6); add(braam(53, 1.6, .7), .12, .55, rev=.5)
t = T(.35); add(tvfilt(noise(len(t)), lambda z: 2500 + 9000 * z / .35, 'bp', .9) * np.exp(-t / .12) * .6, 0.0, .8, pan=np.linspace(-1, 1, len(t)), rev=.4)   # streak slash
add(tick(), .5, .5, rev=.4); add(blip(77, 84, .03), .5, .35, rev=.4)                                   # "ILI"
add(boom(3.4, 110, 24, 1.4, 1.5), .8, 1.15, rev=.7); add(braam(48, 2.0, .9), .8, .7, rev=.6); add(metal(2.2, 311.1, 1.0), .8, .45, rev=.6)
t = T(.25); add(tvfilt(noise(len(t)), lambda z: 3000 + 7000 * z / .25, 'bp', .9) * np.exp(-t / .1) * .5, .66, .7, pan=np.linspace(1, -1, len(t)), rev=.4)
add(line_riser(.4), 1.6, .9, rev=.3); add(reverse_swell(.4), 1.6, .6)                                   # push-in through the type
# iPHONE — precise mechanical whooshes, tonal sweeps
add(mech_whoosh(.5), 1.98, .7, rev=.3); add(shutter(), 2.0, .8, rev=.2)
t = T(.9); add(bp(noise(len(t)), 7500, .9) * np.sin(np.pi * t / .9) * .14, 2.25, .9, pan=np.linspace(-.8, .8, len(t)), rev=.4)   # orange sweep on glass
add(whoosh(.4, 800, 6000, .85, .9), 2.1, .4, pan=np.linspace(.9, 0, int(.4 * SR)), rev=.2)                # title slides in
add(servo(.5), 2.4, 1.2)                                                                                 # push-in motor
add(tonal_sweep(2.0, 330, 1320), 3.3, .95, pan=np.linspace(-.7, .7, int(2.0 * SR)), rev=.4)              # rotation
add(whoosh(.35, 600, 4000, .6, 1.0), 4.15, .4, rev=.2)                                                  # edge passes
add(glass_chime([77, 84, 89], 2.0), 5.3, .6, rev=.6)                                                     # screen reveal
t = T(.9); add(bp(noise(len(t)), 6500, .9) * np.sin(np.pi * t / .9) * .12, 5.55, .9, pan=np.linspace(-.8, .8, len(t)), rev=.4)
add(whoosh(.4, 300, 7000, .9, 1.0), 6.62, .9, pan=np.linspace(0, -1, int(.4 * SR)), rev=.2)               # whip out
# SAMSUNG — deeper bass impacts, controlled transitions
t = T(.2); add(np.sin(2 * np.pi * np.cumsum(1400 * np.exp(-t / .12) + 200) / SR) * .12 * (t / .2), 7.0, .8, rev=.3)   # falling whistle
add(boom(3.5, 70, 22, 1.5, .4), 7.2, 1.25, rev=.6); add(b808(29, 2.0, 1.0), 7.2, .7)                     # landing — deepest hit
t = T(.6); add(lp(supersaw(41, .6, 5, .2), 900) * np.exp(-t / .25) * .5, 7.24, .6, rev=.4)               # rim ignites
t = T(.6); add(bp(noise(len(t)), 5500, 1.0) * np.sin(np.pi * t / .6) * .12, 7.55, .8, pan=np.linspace(-.6, .6, len(t)), rev=.4)
add(tvfilt(noise(int(.65 * SR)), lambda z: 120 * 12 ** min(1, z / .65), 'lp') * np.linspace(0, 1, int(.65 * SR)) ** 2 * .5, 8.2, .8, rev=.3)   # push-in swell
add(felt_thump(), 8.85, .7)
add(bell(89, 1.2, .5), 9.05, .3, rev=.6); add(shimmer(.8), 9.05, .4, rev=.6)                            # lens glint
for k, (x, f0) in enumerate(((9.5, 900), (9.62, 750), (9.8, 600), (9.98, 480))):                          # whip spin through angles
    add(whoosh(.18, f0 * .5, f0 * 4, .5, .8), x - .02, .6 - k * .06, pan=.6 - k * .4, rev=.2)
add(metal_settle(), 10.16, .7, rev=.4)
add(latch_click(), 10.6, .9, rev=.3); add(friction(.7), 10.62, .9, pan=-.2, rev=.2)                       # S Pen
add(whoosh(.35, 300, 6500, .9, 1.0), 11.68, .8, pan=np.linspace(0, 1, int(.35 * SR)), rev=.2)            # whip out
# DUEL — music builds, rhythmic impacts
add(whoosh(.5, 500, 5000, .9, 1.0), 11.98, .6, pan=np.linspace(-1, -.1, int(.5 * SR)), rev=.2)
add(whoosh(.5, 250, 3000, .9, 1.0), 11.98, .6, pan=np.linspace(1, .1, int(.5 * SR)), rev=.2)
add(boom(2.0, 120, 36, .7, 1.6), 12.45, .9, rev=.5); add(metal(1.6, 466.2, .8), 12.45, .55, rev=.5)       # clash
add(tonal_sweep(2.0, 200, 520), 12.7, .7, pan=np.linspace(-.9, .9, int(2 * SR)), rev=.5)                 # orbit
for x in (13.0, 14.0): add(snare(), x, .7, rev=.4); add(boom(.8, 140, 60, .25, 1.2), x, .5, rev=.3)       # text slams
for x, p in ((15.0, -.5), (15.5, .5)): add(stab([65, 68, 72], .5, 3000), x, .7, pan=p, rev=.4)           # light hits L / R
add(stab([63, 67, 70, 75], .7, 4000), 16.0, .8, rev=.4)
# CTA — drop, logo sonic signature
add(braam(41, 2.2, 1.0), 17.0, .6, rev=.5)
add(whoosh(.4, 700, 5000, .85, 1.0), 16.95, .5, pan=np.linspace(-1, 0, int(.4 * SR)), rev=.2)
add(boom(2.0, 100, 30, .8, 1.0), 17.45, .8, rev=.5)
t = T(.6); add(tvfilt(noise(len(t)), lambda z: 1500 + 9000 * z / .6, 'bp', .7) * np.sin(np.pi * t / .6) * .35, 18.75, .8, pan=np.linspace(-1, 1, len(t)), rev=.4)   # logo streak
for k, m in enumerate((77, 84, 89)): add(bell(m, 2.6, 1.4), 18.8 + k * .14, .45, pan=(k - 1) * .35, rev=.75, dly=.25)   # sonic signature
add(boom(2.5, 70, 30, 1.0, .2), 18.8, .5, rev=.6); add(shimmer(2.2), 18.9, .5, rev=.7)
add(whoosh(.4, 800, 5000, .85, .9), 19.95, .4, pan=np.linspace(1, 0, int(.4 * SR)), rev=.2)               # follow slides in
add(ui_pop(1400), 20.5, .8, rev=.3); add(ui_pop(1870), 20.58, .7, rev=.3)                                # DM pill pops
add(whoosh(.7, 200, 1600, .6, 1.2), 19.4, .4, rev=.3)                                                    # phones rise
for x in (21.3, 21.6): add(bp(noise(int(.8 * SR)), 7000, .8) * np.sin(np.pi * np.arange(int(.8 * SR)) / (.8 * SR)) * .08, x, .8, rev=.4)

# ------------------------------------------------------------------ mix
duck = np.clip(duck, .3, 1); musL *= duck; musR *= duck
dt = int(.375 * SR); dL = np.zeros(N); dR = np.zeros(N); src = lp(dlyS, 4500)
for k in range(1, 7):
    sh = dt * k
    if sh >= N: break
    (dL if k % 2 else dR)[sh:] += src[:N - sh] * .38 ** (k - 1) * .5
musL += dL * duck; musR += dR * duck
L = dryL + musL; R = dryR + musR
ir_t = T(3.0)
def ir():
    n = noise(len(ir_t)); x = lp(n, 6500) * np.exp(-ir_t / .55) + lp(n, 1600) * np.exp(-ir_t / .9) * .6
    x[:int(.018 * SR)] = 0; return x / np.sqrt(np.sum(x ** 2))
def conv(x, h):
    n = 1 << int(np.ceil(np.log2(len(x) + len(h)))); return np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(h, n), n)[:len(x)]
rs = hp(revS, 200); L += conv(rs, ir()) * .45; R += conv(rs, ir()) * .45
L = hp(L, 28); R = hp(R, 28); L = L + hp(L, 2500) * .18; R = R + hp(R, 2500) * .18
m = max(np.max(np.abs(L)), np.max(np.abs(R))); L /= m; R /= m
drive = 2.0; L = np.tanh(L * drive) / np.tanh(drive); R = np.tanh(R * drive) / np.tanh(drive)
fade = np.ones(N); sel = tt > 23.3; fade[sel] = np.cos(np.clip((tt[sel] - 23.3) / .7, 0, 1) * np.pi / 2) ** 2
fade[:120] = np.linspace(0, 1, 120); L *= fade; R *= fade
pk = max(np.max(np.abs(L)), np.max(np.abs(R))); L *= .89 / pk; R *= .89 / pk
out = np.stack([L, R], 1)
pcm = np.clip(out * 32767 + rng.uniform(-.5, .5, out.shape) + rng.uniform(-.5, .5, out.shape), -32768, 32767).astype('<i2')
with wave.open(sys.argv[1] if len(sys.argv) > 1 else 'audio.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok', out.shape)
