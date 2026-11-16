"""ZONA TELEFONA — BLACK FRIDAY IS COMING: original dark technology-trailer score and sound design, synthesized from scratch
(no samples, no licensed music). Every cue is read from timeline.json. usage: python3 audio.py out.wav
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




# ================================================================== BLACK FRIDAY IS COMING — dark technology trailer score (original, synthesized)
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
# ---- music bus: drones, ostinato pulses, braams
def clip01(x): return min(1, max(0, x))
dr = np.zeros(N)
for (a, b, m) in ((.25, 3.2, 26), (3.0, 10.3, 26), (13.2, 19.2, 26), (19.0, 25.0, 26)):
    t = T(b - a); env = np.minimum(1, t / 1.2) * np.minimum(1, (b - a - t) / .8)
    s = (supersaw(m + 12, b - a, 5, .06) * .35 + np.sin(2 * np.pi * mtof(m) * t) * .5 + supersaw(m + 19, b - a, 3, .05) * .18) * env
    place(dr, s, a)
dr = tvfilt(dr, lambda x: 200 + 900 * clip01((x - .25) / 3) if x < 3.2 else (1100 if x < 10 else (500 if x < 13.2 else 1300)), 'lp')
musL += dr * .45; musR += dr * .45; revS += dr * .12
# pulses (ostinato 8ths at 120 BPM) — build in S2/S3, vanish in the slow-down, return heavier in S5/S6
for x in np.arange(3.0, 10.0, .25):
    g = .14 + .12 * (x - 3) / 7
    add(pulse_bass(38 if int(x * 2) % 8 < 6 else 41), x, g, music=True)
for x in np.arange(14.0, 23.0, .25): add(pulse_bass(38 if int(x * 2) % 8 < 6 else 36), x, .26, music=True)
K = kick(1.0, .7, 40)
for x in np.arange(6.0, 10.0, 1.0): add(K, x, .5, music=True); place(duck, -.35 * np.exp(-T(.4) / .12), x)
for x in np.arange(14.0, 23.0, 1.0): add(K, x, .62, music=True); place(duck, -.4 * np.exp(-T(.4) / .12), x)
# ---- sound design (dry)
add(lp(noise(int(3.4 * SR)), 120) * np.minimum(1, T(3.4) / 1.8) * .5, T_['rumble'], .9)               # sub rumble emerging
add(sine_sweep(3.0, 28, 42) * np.minimum(1, T(3.0) / 1.5) * .35, T_['rumble'], .8)
add(np.sin(2 * np.pi * 2650 * T(1.6)) * np.exp(-T(1.6) / .5) * .05 + np.sin(2 * np.pi * 3975 * T(1.6)) * np.exp(-T(1.6) / .3) * .025, T_['light'], .9, rev=.7)   # the tiny light
add(reverse_swell(.9), T_['beams'], .4, rev=.5)
add(reverse_swell(.6), T_['impactZ'] - .6, .7); add(boom(3.2, 70, 26, 1.3, .9), T_['impactZ'], 1.0, rev=.6); add(metal_hit(55, 4.5, 2.2), T_['impactZ'], .9, rev=.5); add(sub_drop(2.0, 60, 24), T_['impactZ'], .7)
for i in range(4): add(metal_hit(90 + i * 14, 1.6, .5, .6), T_['zona'] + (i * .14 if i else -1.25), .35, rev=.4)
add(shimmer(2.4), T_['tel'], .4, rev=.7)
add(hum_on(1.6), T_['edge'], .25, rev=.4); add(line_riser(1.2), T_['edge'], .2)
add(whoosh(1.0, 120, 3200, .7, 1.4), T_['pass'] - .05, .85, pan=np.linspace(-.7, .8, int(1.0 * SR)), rev=.3)   # rush past the monolith edge
for d in (.1, .35, .55): add(whoosh(1.2, 90, 1400, .8, 1.3), T_['rise'] + d, .3, rev=.4)          # phones rising from the dark
add(metal_slide(1.2), T_['hero'] + .3, .25, rev=.5); add(shimmer(2.0), T_['hero'] + .4, .3, rev=.7)
for x in (6.9, 7.8, 8.7, 9.4): add(whoosh(.5, 600, 6000, .5, 1.0), x, .18, pan=np.linspace(-.8, .8, int(.5 * SR)), rev=.2)   # light streaks
# slow-down: music falls away, riser + heartbeat, crackling energy in the cracks
add(sine_sweep(2.7, 80, 640, 1.6) * np.linspace(0, 1, int(2.7 * SR)) ** 2 * .25, T_['s4'] - .05, .8, rev=.4)
add(tvfilt(noise(int(2.7 * SR)), lambda z: 300 * 20 ** min(1, z / 2.7), 'bp', 1.2) * np.linspace(0, 1, int(2.7 * SR)) ** 2.5 * .45, T_['s4'] - .05, .7, rev=.3)
for i, x in enumerate((10.2, 10.95, 11.6, 12.1, 12.45)): add(sub_drop(.9, 75, 34), x, .45 + i * .06)
add(crackle(T_['fracture'] - T_['cracks'], 6, 160), T_['cracks'], .9, pan=0, rev=.35)
add(reverse_swell(.5), T_['fracture'] - .5, .8)
# fracture
add(shatter(2.4), T_['fracture'], .95, rev=.5); add(boom(2.2, 95, 30, .7, 1.0), T_['fracture'], .8, rev=.4); add(crackle(1.2, 200, 20), T_['fracture'] + .02, .6)
# BLACK FRIDAY — the strongest hit of the film
add(reverse_swell(.35), T_['bf'] - .35, .8)
add(boom(4.0, 80, 22, 1.8, 1.0), T_['bf'], 1.15, rev=.7); add(braam(38, 3.2, 1.6), T_['bf'], .8, rev=.6); add(braam(45, 3.2, 1.6), T_['bf'], .45, rev=.6)
add(metal_hit(41, 5.0, 2.8, 1.2), T_['bf'], .9, rev=.6); add(sub_drop(3.0, 55, 20), T_['bf'], .9)
add(boom(1.6, 90, 34, .6, .6), T_['akcija'], .55, rev=.4); add(metal_hit(98, 2.0, .9, .7), T_['akcija'], .35, rev=.5)
add(boom(1.8, 85, 30, .7, .6), T_['zt'], .65, rev=.45); add(metal_hit(73, 2.6, 1.2, .8), T_['zt'], .45, rev=.5)
add(whoosh(.9, 150, 2400, .75, 1.3), T_['s5out'], .5, rev=.3)
add(whoosh(1.4, 80, 1600, .8, 1.3), T_['phone'], .45, rev=.4); add(shimmer(2.0), T_['phone'] + .8, .3, rev=.7)
add(metal_hit(120, 1.4, .5, .5), T_['question'], .3, rev=.5)
add(metal_hit(82, 2.4, 1.1, .8), T_['logo'], .45, rev=.6); add(shimmer(2.0), T_['logo'], .3, rev=.7)
add(sine_sweep(1.1, 60, 420, 1.8) * np.linspace(0, 1, int(1.1 * SR)) ** 2 * .3, T_['uskoro'] - 1.1, .7); add(reverse_swell(.5), T_['uskoro'] - .5, .7)
add(boom(4.5, 75, 22, 2.0, .9), T_['uskoro'], 1.05, rev=.7); add(braam(38, 3.5, 2.0), T_['uskoro'], .55, rev=.6); add(sub_drop(3.4, 50, 22), T_['uskoro'], .85)
add(np.sin(2 * np.pi * 36.7 * T(2.6)) * np.exp(-T(2.6) / 1.0) * np.minimum(1, T(2.6) / .05) * .4, T_['s7'] + .2, .8)   # final bass resonance

# ------------------------------------------------------------------ mix
duck = np.clip(duck, .5, 1); musL *= duck; musR *= duck
L = dryL + musL; R = dryR + musR
ir_t = T(3.2)
def ir():
    n = noise(len(ir_t)); x = lp(n, 5000) * np.exp(-ir_t / .7) + lp(n, 1200) * np.exp(-ir_t / 1.2) * .6
    x[:int(.02 * SR)] = 0; return x / np.sqrt(np.sum(x ** 2))
def conv(x, h):
    n = 1 << int(np.ceil(np.log2(len(x) + len(h)))); return np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(h, n), n)[:len(x)]
rs = hp(revS, 180); L += conv(rs, ir()) * .45; R += conv(rs, ir()) * .45
L = hp(L, 22); R = hp(R, 22)
m = max(np.max(np.abs(L)), np.max(np.abs(R))); L /= m; R /= m
drive = 1.5; L = np.tanh(L * drive) / np.tanh(drive); R = np.tanh(R * drive) / np.tanh(drive)
sil = int(T_['rumble'] * SR); L[:sil] = 0; R[:sil] = 0                                   # absolute silence at the very start
fade = np.ones(N); sel = tt > DUR - .9; fade[sel] = np.cos(np.clip((tt[sel] - (DUR - .9)) / .9, 0, 1) * np.pi / 2) ** 2
L *= fade; R *= fade
pk = max(np.max(np.abs(L)), np.max(np.abs(R))); L *= .89 / pk; R *= .89 / pk
out = np.stack([L, R], 1)
pcm = np.clip(out * 32767 + rng.uniform(-.5, .5, out.shape) + rng.uniform(-.5, .5, out.shape), -32768, 32767).astype('<i2')
with wave.open(sys.argv[1] if len(sys.argv) > 1 else 'audio.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok', out.shape)
