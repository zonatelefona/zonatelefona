"""ZONA TELEFONA v6.1 — "IPHONE ILI ULTRA?" Every scene has its own sound family Original soundtrack + sound design, synthesized from scratch.
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

# ------------------------------------------------------------------ music: F minor, 120 BPM
Fm = (29, [53, 56, 60, 63, 65]); Db = (25, [49, 53, 56, 60, 63]); Ab = (32, [51, 56, 60, 63, 68]); Eb = (27, [51, 55, 58, 63, 67])
chords = [(0, 2, Fm), (2, 7, Fm), (7, 9, Db), (9, 11, Ab), (11, 12, Eb), (12, 14, Fm), (14, 16, Db), (16, 17, Eb), (17, 19, Fm), (19, 21, Db), (21, 24, Fm)]
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
    ev = np.minimum(1, t / .3) * np.where(t > b - st, np.exp(-(t - (b - st)) / .25), 1)
    for k, m in enumerate(notes):
        s = supersaw(m, ln, 5, .1) * ev * .065; pan = -.6 if k % 2 == 0 else .6
        place(padL, s * np.cos((pan + 1) * np.pi / 4), st); place(padR, s * np.sin((pan + 1) * np.pi / 4), st)
def pad_cut(x):
    if x < 7: return 900
    if x < 12: return 1300
    if x < 16: return 2600
    if x < 16.95: return 1600 * 4 ** ((x - 16) / .95)
    return max(1500, 5200 * np.exp(-(x - 17) / 3))
padL = tvfilt(padL, pad_cut, 'lp'); padR = tvfilt(padR, pad_cut, 'lp')
pe = np.ones(N); pe[(tt >= 16.92) & (tt < 17.0)] = 0
musL += padL * pe; musR += padR * pe; revS += (padL + padR) * pe * .15
K = kick(1.05, .55, 46); CL = clap()
def kick_at(x, g): add(K, x, g); place(duck, -.6 * np.exp(-T(.4) / .1), x)
# iPhone (2–7): light & precise — 16th ticks, plucked pulse, NO heavy kick
for i in range(int((7.0 - 2.0) / .125)):
    x = 2.0 + i * .125; add(tick_hi(4200 if i % 4 == 0 else 6200), x, .35 if i % 4 == 0 else .18, pan=.3 if i % 2 else -.3, music=True)
for i in range(int((7.0 - 2.0) / .25)):
    x = 2.0 + i * .25; add(pluck([65, 72, 68, 75][i % 4], .3, 2600), x, .2, pan=-.2 if i % 2 else .2, rev=.15, dly=.25, music=True)
# Samsung (7–12): heavy — half-time kick + 808 wobble
for x in (7.0, 8.0, 8.75, 9.7, 10.25, 10.7, 11.25): kick_at(x, 1.0)
for x in (7.5, 8.5, 9.5, 10.5, 11.5): add(CL, x, .35, rev=.4)
for i in range(int((11.75 - 7.0) / .5)):
    x = 7.0 + i * .5; add(b808(root_at(x) + 12, .5, .3), x, .5, music=True)
# Duel (12–17): four-on-the-floor + snaps + arp, building
for i in range(int((16.0 - 12.0) / .5)):
    x = 12.0 + i * .5; kick_at(x, .9)
    if i % 2 == 1: add(snap(), x, .7, rev=.35); add(CL, x, .3, rev=.3)
    add(hat(.02), x + .25, .3, pan=.3)
    if x >= 14: add(hat(.01), x + .125, .15, pan=-.3); add(hat(.01), x + .375, .15, pan=-.3)
for (a, b, ch) in chords:
    seq = ARP[id(ch)]
    for i in range(int((b - a) / .125)):
        x = a + i * .125
        if x < 12.0 or 16.92 <= x < 17.0 or x > 23.2: continue
        g = .24 if x < 17 else .2 * np.exp(-(x - 17) / 3.5)
        br = 3000 if x < 16 else 2000 + 5000 * (x - 16) if x < 17 else 3200
        add(pluck(seq[i % 8], .35, br), x, g * (1 if i % 4 == 0 else .7), pan=.4 * np.sin(i * .9), rev=.15, dly=.3, music=True)
for i in range(int((16.0 - 12.0) / .25)):
    x = 12.0 + i * .25
    if [1, 0, 0, 1, 0, 0, 1, 0][i % 8]: add(b808(root_at(x) + 12, .45, .2), x, .42, music=True)
x = 16.0
while x < 16.9:
    k = (x - 16) / .9; add(snare(), x, .22 + .45 * k ** 1.4, rev=.25); x += .125 if k < .45 else .0625 if k < .8 else .03125
add(line_riser(.92), 16.0, .85, rev=.4)
# CTA (17–24): drop, then a calm groove under the logo
kick_at(17.0, 1.2); add(sub_drop(2.0, 90, 36), 17.0, .7)
for i in range(int((23.0 - 17.5) / .5)):
    x = 17.5 + i * .5; kick_at(x, .7)
    if i % 2 == 1: add(CL, x, .35, rev=.35)
    add(hat(.02), x + .25, .22, pan=.3)

# ------------------------------------------------------------------ SOUND DESIGN — one family per scene
# HOOK: war drums + brass + laser streaks
add(zap(4200, 160, .4), .0, .9, pan=np.linspace(-1, 1, int(.4 * SR)), rev=.4)
add(rev_crash(.12), .0, .6, rev=.3)
add(tom(70, 1.2, .45), .12, 1.0, rev=.5); add(tom(140, .6, .2), .12, .5, rev=.4)
add(tick_hi(2600), .5, .7, rev=.5)                                                     # "ILI"
add(zap(3000, 240, .3), .66, .7, pan=np.linspace(1, -1, int(.3 * SR)), rev=.4)
add(braam(48, 2.2, .9), .8, .85, rev=.6); add(tom(55, 1.5, .6), .8, 1.0, rev=.6); add(boom(3.0, 100, 26, 1.2, .2), .8, .7, rev=.6)
add(rev_crash(.4), 1.6, .8, rev=.3); add(line_riser(.4), 1.6, .7)
# iPHONE: precise mechanics + glass
add(shutter(), 2.0, .9, rev=.2)
add(metal_slide(.5), 2.42, .9, pan=np.linspace(.8, 0, int(.5 * SR)), rev=.3)          # title slides in
add(glass_sweep(.9, 2400, 5200), 2.25, .9, pan=np.linspace(-.8, .8, int(.9 * SR)), rev=.5)   # orange light on glass
add(servo(1.2), 2.0, 1.0)                                                              # push-in motor
add(glass_sweep(2.4, 400, 1600), 3.5, .9, pan=np.linspace(-.7, .7, int(2.4 * SR)), rev=.5)   # the rotation (footage 4.8→7.2)
add(metal_slide(.35), 4.45, .6, pan=.4, rev=.3)                                        # edge passes the lens
add(glass_chime([77, 84, 89], 2.0), 6.2, .6, rev=.6)                                   # screen lights up
add(glass_sweep(.9, 2200, 4800), 5.55, .7, pan=np.linspace(-.8, .8, int(.9 * SR)), rev=.5)
add(metal_slide(.3), 6.72, 1.0, pan=np.linspace(0, -1, int(.3 * SR)), rev=.2)            # whip out
# SAMSUNG: deep & heavy
add(sub_drop(2.0, 120, 28), 7.0, 1.0); add(hum_on(.9), 7.03, .8, rev=.3)                # power on + orange rim
add(wub(.6, 58), 7.3, .7)                                                               # title
add(tvfilt(noise(int(.55 * SR)), lambda z: 100 * 8 ** min(1, z / .55), 'lp') * np.linspace(0, 1, int(.55 * SR)) ** 2 * .6, 8.7, .9)   # push-in rush (low)
add(low_metal(), 9.25, .8, rev=.4)                                                     # locks onto the lenses
add(bell(89, 1.0, .4), 9.3, .25, rev=.6)                                               # glint
add(sub_drop(1.2, 80, 34), 9.7, .8); add(low_metal(), 9.7, .5, rev=.5)                  # close-up cut
add(mag_click(), 10.92, 1.0, rev=.3); add(friction(.6), 10.95, .9, pan=-.2, rev=.2)     # S Pen
add(tvfilt(noise(int(.3 * SR)), lambda z: 200 + 1800 * z / .3, 'bp', 1.2) * np.linspace(0, 1, int(.3 * SR)) ** 2 * .7, 11.72, .9, pan=np.linspace(0, -1, int(.3 * SR)))   # heavy whip out
# DUEL: electric blade + rhythmic hits
add(blade(.45), 12.0, 1.0, rev=.4)
for x in (13.0, 13.5): add(blade(.25), x, .45, rev=.3)                                  # blade pulses
add(snap(), 12.4, .8, rev=.4); add(tom(110, .5, .15), 12.4, .6)                        # "DVA TOP MODELA."
add(glass_sweep(.5, 800, 5000), 13.85, .8, pan=np.linspace(-1, 1, int(.5 * SR)), rev=.4)   # light bar wipe
add(snap(), 14.3, .8, rev=.4); add(tom(82, .6, .2), 14.3, .7)                          # "JEDAN IZBOR."
for x, f in ((15.0, 98), (15.5, 131), (16.0, 87)): add(tom(f, .5, .18), x, .7, pan=-.4 if x == 15.0 else .4 if x == 15.5 else 0, rev=.4)
# CTA: drop + logo signature
add(braam(41, 2.2, 1.0), 17.0, .55, rev=.5)
add(metal_slide(.4), 17.15, .6, pan=np.linspace(-1, 0, int(.4 * SR)), rev=.3)
add(tom(60, 1.2, .45), 17.45, .9, rev=.5); add(CL, 17.45, .6, rev=.5)
add(zap(5200, 900, .5), 18.75, .5, pan=np.linspace(-1, 1, int(.5 * SR)), rev=.5)         # logo streak
for k, m in enumerate((77, 84, 89)): add(bell(m, 2.6, 1.4), 18.8 + k * .14, .45, pan=(k - 1) * .35, rev=.75, dly=.25)   # sonic signature
add(shimmer(2.2), 18.9, .45, rev=.7)
add(metal_slide(.4), 19.95, .6, pan=np.linspace(1, 0, int(.4 * SR)), rev=.3)
add(ui_pop(1400), 20.5, .8, rev=.3); add(ui_pop(1870), 20.58, .7, rev=.3)
add(glass_sweep(1.0, 300, 900), 19.4, .5, rev=.4)                                      # phones rise

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
L = hp(L, 28); R = hp(R, 28); L = L + hp(L, 2500) * .15; R = R + hp(R, 2500) * .15
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
