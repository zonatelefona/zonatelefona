"""ZONA TELEFONA — BLACK FRIDAY (v2): completely new soundscape, synthesized from scratch (no samples, no licensed music).
Mechanical lens sounds, sub-bass, metallic impacts, reverse whooshes, risers, controlled explosive hits, futuristic textures and
drones. Every cue is read from timeline.json. usage: python3 audio.py out.wav
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




# ================================================================== v2 additions
tt = np.arange(N) / SR
def sine_sweep(length, f0, f1, curve=1.0):
    t = T(length); u = (t / length) ** curve; f = f0 * (f1 / f0) ** u
    return np.sin(2 * np.pi * np.cumsum(f) / SR)
def metal_hit(base=110., length=4.0, dec=1.6, bright=1.0):
    """struck metal plate: inharmonic partials with long ring"""
    t = T(length); out = np.zeros_like(t)
    for k, a in ((1, 1), (1.47, .7), (2.09, .55), (2.56, .4), (3.31, .3), (4.18, .22), (5.37, .14)):
        out += a * np.sin(2 * np.pi * base * k * t + hash_(k) * 6) * np.exp(-t / (dec / k ** .45))
    return out * .18 * (1 - np.exp(-t / .002)) + hp(noise(len(t)), 2500) * np.exp(-t / .01) * .25 * bright
def hash_(k): return (np.sin(k * 127.1 + 311.7) * 43758.5453) % 1
def crackle(length, dens0=8, dens1=120):
    """electric energy crackling: random micro bursts, density rising"""
    out = np.zeros(int(length * SR)); n = len(out)
    t_ = 0.
    while t_ < length:
        u = t_ / length; rate = dens0 + (dens1 - dens0) * u ** 1.6
        t_ += -np.log(max(1e-4, rng.uniform())) / rate
        i = int(t_ * SR); L = int(rng.uniform(.002, .012) * SR)
        if i + L >= n: break
        b = hp(noise(L), 1800) * np.exp(-np.arange(L) / (L * .3)) * rng.uniform(.3, 1.0)
        out[i:i + L] += b
    return out * .25
def shatter(length=2.0):
    """metal / glass shatter: noise burst + dense cluster of short resonances"""
    t = T(length); out = hp(noise(len(t)), 900) * np.exp(-t / .12) * .7
    for k in range(70):
        st = int(rng.uniform(0, .5) ** 1.8 * SR); f = rng.uniform(1800, 9000); L = int(rng.uniform(.03, .25) * SR)
        if st + L >= len(t): continue
        tl_ = np.arange(L) / SR; out[st:st + L] += np.sin(2 * np.pi * f * tl_) * np.exp(-tl_ / rng.uniform(.01, .07)) * rng.uniform(.05, .2)
    return out
def pulse_bass(m, length=.24):
    t = T(length); f = mtof(m)
    s = (2 * ((f * t) % 1) - 1) * .7 + np.sin(2 * np.pi * f * .5 * t) * .6
    return lp(s, 900) * np.exp(-t / .09) * (1 - np.exp(-t / .002)) * .5

def ratchet(length=.3, rate=55, f=5200):
    """focus-ring detents: a regular run of tiny metal clicks"""
    out = np.zeros(int(length * SR)); k = 0; x = 0.
    while x < length - .01:
        i = int(x * SR); t = T(.01); c = (np.sin(2 * np.pi * f * (1 + .1 * hash_(k)) * t) * .5 + hp(noise(len(t)), 5000) * .5) * np.exp(-t / .0015)
        out[i:i + len(c)] += c[:len(out) - i] * (.6 + .4 * hash_(k + 3)); k += 1; x += 1 / rate
    return out * .3
def iris_snap():
    """aperture blades closing: fast click cluster + a dry metallic snap"""
    a = latch_click() * .9; c = click_cascade(.07, 4000, 7000, 14) * 1.4; a[:len(c)] += c; return a
def motor(length=.35, f0=700, f1=1300):
    t = T(length); u = t / length; f = f0 + (f1 - f0) * u
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = (np.sin(ph) * .5 + np.sign(np.sin(ph * .5)) * .15) * (.6 + .4 * np.sin(2 * np.pi * 90 * t))
    return lp(s, 3500) * np.sin(np.pi * u) ** .6 * .09
def doppler(length=1.4, f0=180, peak=.55):
    """object passing the lens: band-limited rush whose pitch falls as it passes"""
    t = T(length); u = t / length
    fc = lambda z: f0 * 9 if z / length < peak else f0 * 9 * (1 - .82 * min(1, (z / length - peak) / (1 - peak)) ** .5)
    s = tvfilt(noise(len(t)), fc, 'bp', 1.2)
    e = np.where(u < peak, (u / peak) ** 3, np.exp(-(u - peak) / (1 - peak) * 3.5))
    tone = np.sin(2 * np.pi * np.cumsum(np.where(u < peak, 520, 520 * (1 - .45 * np.minimum(1, (u - peak) / .2)))) / SR) * e * .12
    return s * e * .9 + tone
def granular_metal(length, d0=6, d1=90, lo=1500, hi=7000, seed=5):
    """swarm of tiny metal pieces: dense micro-resonances, density rising"""
    r = np.random.default_rng(seed); n = int(length * SR); outL = np.zeros(n); outR = np.zeros(n); x = 0.
    while x < length:
        u = x / length; x += -np.log(max(1e-4, r.uniform())) / (d0 + (d1 - d0) * u ** 1.5)
        i = int(x * SR); L_ = int(r.uniform(.015, .08) * SR)
        if i + L_ >= n: break
        tl_ = np.arange(L_) / SR; f = r.uniform(lo, hi)
        g = np.sin(2 * np.pi * f * tl_) * np.exp(-tl_ / r.uniform(.004, .025)) * r.uniform(.2, 1)
        g += np.sin(2 * np.pi * f * 2.76 * tl_) * np.exp(-tl_ / .006) * .3
        p = r.uniform(-1, 1); outL[i:i + L_] += g * np.cos((p + 1) * np.pi / 4); outR[i:i + L_] += g * np.sin((p + 1) * np.pi / 4)
    return outL * .1, outR * .1
def pad(notes, length, att=1.2, rel=1.2, bright=1400):
    t = T(length); out = np.zeros_like(t)
    for m in notes: out += supersaw(m, length, 5, .09) * .5 + np.sin(2 * np.pi * mtof(m) * t) * .3
    env = np.minimum(1, t / att) * np.minimum(1, np.maximum(0, length - t) / rel)
    return lp(out, bright) * env * .12
def heartbeat():
    return sub_drop(.5, 80, 38) * .8 + np.concatenate([np.zeros(int(.16 * SR)), sub_drop(.4, 70, 36) * .5])[:int(.5 * SR)]
def addst(lr, t0, gain=1., rev=0.):
    l, r_ = lr; place(dryL, l, t0, gain); place(dryR, r_, t0, gain)
    if rev: place(revS, (l + r_) * .5, t0, gain * rev)

tt = np.arange(N) / SR
B = 60 / T_['bpm']

# ================================================================== MUSIC BUS (D minor, 120 BPM)
# drones: low D with a fifth, filtered; they open with the story and close for the end card
dr = np.zeros(N)
for (a, b, m, g) in ((0.0, 3.1, 26, .8), (3.0, 11.0, 26, 1.), (11.0, 13.05, 27, .9), (13.0, 19.1, 26, 1.), (19.0, 25.0, 26, 1.)):
    t = T(b - a); env = np.minimum(1, t / .35) * np.minimum(1, (b - a - t) / .3)
    s = (supersaw(m + 12, b - a, 5, .05) * .32 + np.sin(2 * np.pi * mtof(m) * t) * .55 + supersaw(m + 19, b - a, 3, .04) * .14) * env * g
    place(dr, s, a)
def drone_cut(x):
    if x < 3.0: return 260 + 500 * clip01(x / 3)
    if x < 7.0: return 700
    if x < 11.0: return 700 + 1600 * clip01((x - 7) / 3.7) ** 2
    if x < 13.0: return 380 + 900 * clip01((x - 11) / 2) ** 2
    if x < 15.0: return 1500
    if x < 19.0: return 900
    if x < 23.0: return 1400
    return 900 - 600 * clip01((x - 23) / 2)
def clip01(x): return min(1, max(0, x))
dr = tvfilt(dr, drone_cut, 'lp')
musL += dr * .42; musR += dr * .42; revS += dr * .1
# ostinato pulse (8ths): product shots, corridor (16ths when the tension builds), hero
seqA = [38, 38, 41, 38, 38, 43, 41, 36]
for k, x in enumerate(np.arange(T_['s2a'], T_['s3out'], B / 2)):
    g = .13 + .1 * clip01((x - 3) / 7); add(pulse_bass(seqA[k % 8]), x, g, pan=(.25 if k % 2 else -.25), music=True)
for x in np.arange(T_['build'], T_['s3out'], B / 4): add(pulse_bass(50, .12), x + B / 8, .05 + .1 * clip01((x - T_['build']) / 1.2), pan=.5 * np.sin(x * 9), music=True)
for k, x in enumerate(np.arange(T_['s6'], T_['s6out'], B / 2)): add(pulse_bass(seqA[k % 8] - 2 if k % 16 >= 8 else seqA[k % 8]), x, .24, pan=(.3 if k % 2 else -.3), music=True)
K = kick(1.0, .7, 40)
for x in list(np.arange(T_['s2a'] + 1, T_['s3'], 1.0)) + list(np.arange(T_['s3'], T_['s3out'], B)):
    add(K, x, .42 + .18 * clip01((x - 7) / 3.6), music=True); place(duck, -.3 * np.exp(-T(.35) / .1), x)
for x in np.arange(T_['s7'] - 4 + 0.0, T_['s6out'], B):
    add(K, x, .62, music=True); place(duck, -.38 * np.exp(-T(.35) / .1), x)
for x in np.arange(T_['s3'], T_['s3out'], B / 2): add(hat(.03), x + B / 4, .32 + .3 * clip01((x - 9) / 1.6), pan=.35, music=True)
for x in np.arange(T_['s6'], T_['s6out'], B / 2): add(hat(.03), x + B / 4, .4, pan=-.3, music=True)
for x in (8.0, 9.0, 10.0, 20.0, 21.0, 22.0): add(clap(), x, .3, rev=.35, music=True)
for k, x in enumerate(np.arange(9.5, 10.7, 1 / 16 * 4)): add(snare(), x, .1 + .35 * (k / 19) ** 2, rev=.2, music=True)
# S5 premium brand pad (Dm9) and a slow half-time pulse
add(pad([50, 53, 57, 60, 64], 4.2, 1.0, 1.2, 1600), T_['s5'] - .1, .9, rev=.5, music=True)
for x in np.arange(16.0, 18.6, 1.0): add(pulse_bass(38, .5), x, .26, music=True); add(K, x, .4, music=True)
add(pad([50, 57, 62, 65, 69], 3.0, .6, 1.6, 1300), T_['s7'] - .2, .7, rev=.6, music=True)

# ================================================================== SOUND DESIGN (dry bus)
# S1 — immediate hit on the very first frame: mechanical clack + metal impact + sub
add(boom(1.6, 95, 34, .5, 1.0), 0.0, .72, rev=.35); add(metal_hit(147, 2.2, .9, 1.0), 0.0, .55, rev=.45); add(latch_click(), 0.0, 1.0); add(sub_drop(1.4, 90, 32), 0.0, .7)
add(motor(.34, 650, 1250), .02, .9, pan=-.2)                                   # focus motor during the push
add(ratchet(.22, 70), .05, .7, pan=.15)
add(iris_snap(), T_['irisClose'], 1.0, rev=.15)                                 # blades snap closed
add(motor(.34, 900, 1500), T_['irisOpen'], 1.0, pan=.2); add(ratchet(.3, 45, 4600), T_['irisOpen'] + .02, .8, pan=-.15)   # servo opens the iris
add(glass_sweep(.9, 2400, 4800), .05, .5, pan=np.linspace(-.6, .6, int(.9 * SR)), rev=.6)   # orange light across the glass
add(reverse_swell(.5), T_['through'] - .1, .55)                                   # suction into the aperture
add(whoosh(.75, 90, 2600, .8, 1.3), T_['through'] - .2, .9, rev=.3)
add(sine_sweep(.7, 40, 120, 1.5) * np.linspace(0, 1, int(.7 * SR)) ** 2 * .35, T_['through'], .8)
add(reverse_swell(.3), T_['spremi'] - .3, .8)
add(boom(3.0, 85, 26, 1.1, 1.0), T_['spremi'], .82, rev=.55); add(sub_drop(2.4, 62, 24), T_['spremi'], .85); add(metal_hit(62, 3.4, 1.8, .9), T_['spremi'], .6, rev=.5)
add(braam(38, 2.0, 1.1), T_['spremi'], .35, rev=.5)
add(hum_on(1.2) * .6 + np.sin(2 * np.pi * 220 * T(1.2)) * np.exp(-T(1.2) / .6) * .03, T_['spremi'] + .2, .4, rev=.4)   # light blade humming
add(line_riser(.36), T_['s1out'] - .08, .55); add(zap(5200, 300, .3), T_['s2a'] - .04, .3, rev=.3)
# S2 — four product shots, one transition sound each
add(metal_hit(196, 1.6, .7, .8), T_['s2a'], .45, rev=.4); add(metal_slide(.9), T_['s2a'] + .15, .5, pan=np.linspace(-.3, .3, int(.9 * SR)), rev=.4)
add(whoosh(.32, 400, 7000, .6, 1.0), T_['s2b'] - .2, .75, pan=np.linspace(.9, -.9, int(.32 * SR)))   # whip
add(shutter(), T_['s2b'] + .02, .7); add(ratchet(.35, 40, 3800), T_['s2b'] + .06, .6, pan=.3)        # rack focus
add(glass_sweep(.45, 900, 3200), T_['s2c'] - .22, .5, rev=.4); add(hum_on(.9), T_['s2c'], .3, rev=.4)   # display wakes
add(metal_slide(.5), T_['s2d'] - .16, .45, pan=np.linspace(-.7, .7, int(.5 * SR)), rev=.3); add(shimmer(1.6), T_['s2d'], .22, rev=.6)
add(whoosh(.6, 70, 1400, .85, 1.3), T_['s3'] - .45, .75, rev=.25); add(metal_hit(98, 2.2, 1.1, .8), T_['s3'], .5, rev=.45)
# S3 — corridor: light gates, the phone near-miss, tension
for x in (7.55, 7.95, 9.35, 9.8, 10.15, 10.42): add(whoosh(.35, 500, 5000, .6, 1.0), x, .22, pan=np.linspace(-.6, .6, int(.35 * SR)), rev=.15)
add(doppler(1.5, 170, .58), T_['flyby'] - .75, 1.0, pan=np.linspace(-.3, .9, int(1.5 * SR)), rev=.25)
add(metal_slide(.5), T_['flyby'] - .1, .5, pan=.6, rev=.3); add(tick_hi(5200), T_['flyby'] - .18, .5, pan=.6, rev=.4)
add(line_riser(1.25), T_['build'], .6, rev=.2); add(sine_sweep(1.3, 70, 520, 1.7) * np.linspace(0, 1, int(1.3 * SR)) ** 2 * .3, T_['build'], .7, rev=.3)
add(crackle(1.0, 10, 150), 9.7, .45, rev=.2)
add(reverse_swell(.45), T_['s3out'] - .1, .8)
# S4 — flash, then the metal storm; heartbeats; the lock (strongest hit of the film)
add(boom(1.8, 110, 40, .55, 1.0), T_['s4'] - .1, .7, rev=.5); add(shatter(1.2), T_['s4'] - .1, .35, rev=.4)
addst(granular_metal(2.0, 10, 160, 1600, 7500, 11), T_['s4'], .9, rev=.35)
add(tvfilt(noise(int(2.0 * SR)), lambda z: 200 + 800 * (.5 + .5 * np.sin(2 * np.pi * 1.6 * z)) * (z / 2.0 + .3), 'bp', 1.4) * np.linspace(.3, 1, int(2.0 * SR)) * .35, T_['s4'], .7,
    pan=.7 * np.sin(2 * np.pi * 1.1 * T(2.0)), rev=.3)                          # vortex wind circling
for i, x in enumerate((11.5, 12.0, 12.5)): add(heartbeat(), x, .6 + .15 * i)
add(sine_sweep(1.6, 55, 440, 1.8) * np.linspace(0, 1, int(1.6 * SR)) ** 2.2 * .3, T_['lock'] - 1.6, .8, rev=.4)
add(reverse_swell(.4), T_['lock'] - .4, .9); add(rev_crash(.6), T_['lock'] - .6, .6)
add(boom(4.2, 82, 21, 1.8, 1.0), T_['lock'], 1.2, rev=.7); add(braam(38, 3.2, 1.6), T_['lock'], .75, rev=.6); add(braam(45, 3.2, 1.5), T_['lock'], .4, rev=.6)
add(metal_hit(41, 5.0, 2.8, 1.2), T_['lock'], .95, rev=.6); add(sub_drop(3.2, 52, 19), T_['lock'], 1.0); add(crackle(1.4, 220, 10), T_['lock'] + .02, .55, rev=.3)
add(metal_settle(), T_['lock'] + .55, .4, rev=.5)
add(whoosh(.5, 120, 3800, .85, 1.2), T_['s4out'] - .05, .8, rev=.3)            # slit opens
# S5 — premium brand reveal: one tuned metal strike per rising letter of ZONA, glass for TELEFONA
for i, m in enumerate((62, 65, 69, 74)):
    add(metal_hit(mtof(m) / 2, 2.4, 1.2, .3), T_['logoRise'] + .35 + i * .11, .26, pan=(i - 1.5) * .3, rev=.6)
add(glass_chime([86, 89, 93, 98], 2.6), T_['logoRise'] + .9, .7, rev=.7); add(shimmer(2.0), T_['logoRise'] + .95, .25, rev=.7)
add(felt_thump(), T_['logoRise'] + .35, .6)
add(reverse_swell(.6), T_['s5out'] - .2, .55); add(whoosh(.7, 100, 2000, .8, 1.3), T_['s5out'] - .1, .55, rev=.35)
# S6 — hero: AKCIJA STIŽE, riser, USKORO. (final impact)
add(boom(1.8, 92, 34, .7, .8), T_['akcija'], .7, rev=.45); add(metal_hit(110, 2.4, 1.1, .8), T_['akcija'], .45, rev=.5); add(braam(43, 1.6, .9), T_['akcija'], .25, rev=.5)
add(line_riser(1.0), T_['uskoro'] - 1.0, .5, rev=.2); add(sine_sweep(1.0, 60, 380, 1.8) * np.linspace(0, 1, int(1.0 * SR)) ** 2 * .3, T_['uskoro'] - 1.0, .7)
add(reverse_swell(.4), T_['uskoro'] - .4, .75)
add(boom(4.0, 78, 22, 1.7, .9), T_['uskoro'], .88, rev=.65); add(braam(38, 3.0, 1.7), T_['uskoro'], .42, rev=.6); add(sub_drop(3.0, 50, 21), T_['uskoro'], .75)
add(metal_hit(55, 4.0, 2.2, .8), T_['uskoro'], .55, rev=.6)
# S7 — end card: one clean bell and a long, soft sub tail (no abrupt cut)
add(whoosh(.8, 80, 900, .85, 1.3), T_['s6out'] - .2, .35, rev=.4)
add(bell(74, 3.0, 1.3), T_['s7'] + .35, .5, rev=.8); add(bell(81, 2.6, 1.0), T_['s7'] + .38, .22, rev=.8)
add(np.sin(2 * np.pi * 36.7 * T(2.0)) * np.exp(-T(2.0) / .9) * np.minimum(1, T(2.0) / .05) * .38, T_['s7'] + .3, .8)

# ------------------------------------------------------------------ mix
duck = np.clip(duck, .5, 1); musL *= duck; musR *= duck
L = dryL + musL; R = dryR + musR
ir_t = T(3.2)
def ir():
    n = noise(len(ir_t)); x = lp(n, 5000) * np.exp(-ir_t / .7) + lp(n, 1200) * np.exp(-ir_t / 1.2) * .6
    x[:int(.02 * SR)] = 0; return x / np.sqrt(np.sum(x ** 2))
def conv(x, h):
    n = 1 << int(np.ceil(np.log2(len(x) + len(h)))); return np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(h, n), n)[:len(x)]
rs = hp(revS, 180); L += conv(rs, ir()) * .42; R += conv(rs, ir()) * .42
L = hp(L, 24); R = hp(R, 24)
m = max(np.max(np.abs(L)), np.max(np.abs(R))); L /= m; R /= m
drive = 1.35; L = np.tanh(L * drive) / np.tanh(drive); R = np.tanh(R * drive) / np.tanh(drive)
fin = np.ones(N); sel = tt < .004; fin[sel] = tt[sel] / .004                         # 4 ms de-click on the first sample, nothing more
fade = np.ones(N); sel = tt > DUR - 1.4; fade[sel] = np.cos(np.clip((tt[sel] - (DUR - 1.4)) / 1.4, 0, 1) * np.pi / 2) ** 2
L *= fin * fade; R *= fin * fade
pk = max(np.max(np.abs(L)), np.max(np.abs(R))); L *= .89 / pk; R *= .89 / pk
out = np.stack([L, R], 1)
pcm = np.clip(out * 32767 + rng.uniform(-.5, .5, out.shape) + rng.uniform(-.5, .5, out.shape), -32768, 32767).astype('<i2')
with wave.open(sys.argv[1] if len(sys.argv) > 1 else 'audio.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok', out.shape)
