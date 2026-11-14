"""ZONA TELEFONA v8: original soundtrack and sound design, synthesized from scratch (no samples).
The phone rings with an original marimba phrase in the familiar smartphone style, plus a vibration motor. Answering the call drops the beat (120 BPM, E minor).
There are only a few effects, all on the big visual moments.
usage: python3 audio.py out.wav
"""
import sys, wave
import numpy as np

SR = 48000
DUR = 21.0
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


# ================================================================== v8 composition (E minor, 120 BPM, grid starts at the drop 2.5 s)
tt = np.arange(N) / SR
G0 = 2.5
def beat(k): return G0 + .5 * k

# ---------- ringtone: ORIGINAL marimba phrase (iPhone-style timbre; not Apple's copyrighted melody)
def marimba(m, length=.9, vel=1.0):
    t = T(length); f = mtof(m)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t / .32) \
        + .35 * np.sin(2 * np.pi * f * 3.93 * t) * np.exp(-t / .06) \
        + .12 * np.sin(2 * np.pi * f * 9.2 * t) * np.exp(-t / .018)
    mallet = lp(noise(len(t)), 2500) * np.exp(-t / .004) * .12
    return (s * (1 - np.exp(-t / .0015)) + mallet) * .3 * vel
ring = np.zeros(int(2.0 * SR))
PH1 = [76, 83, 80, 88, 87, 83, 80, 83]
PH2 = [76, 83, 80, 88, 90, 88, 83, 88]
STEP = .105
for ph, t0 in ((PH1, 0.0), (PH2, .87)):
    for i, m in enumerate(ph):
        x = int((t0 + i * STEP) * SR); s = marimba(m, .7, 1.0 if i % 4 == 0 else .8); n = min(len(s), len(ring) - x)
        ring[x:x + n] += s[:n]
    for m in (64, 71):                                   # soft dyad under each phrase
        x = int(t0 * SR); s = marimba(m, .9, .45); n = min(len(s), len(ring) - x); ring[x:x + n] += s[:n]
ring = hp(ring, 380, 2); ring = lp(ring, 9000); ring = np.tanh(ring * 1.6) * .8       # small phone speaker
ring[int(1.70 * SR):] *= np.exp(-np.arange(len(ring) - int(1.70 * SR)) / SR / .05)  # cut when the call is answered
add(ring, .35, .95, rev=.25)
# vibration motor: two bursts in sync with the on-screen shake
def buzz(length):
    t = T(length); f = 158 + 4 * np.sin(2 * np.pi * 7 * t)
    s = np.sign(np.sin(2 * np.pi * np.cumsum(f) / SR)) * .5 + np.sin(2 * np.pi * np.cumsum(f) / SR)
    s = lp(s, 700) * (.8 + .2 * np.sin(2 * np.pi * 31 * t))
    e = np.minimum(1, t / .03) * np.minimum(1, (length - t) / .05)
    return s * e * .16
add(buzz(.6), .35, .9); add(buzz(.6), 1.22, .9)

# ---------- hook ambience + pop
air = lp(noise(int(2.6 * SR)), 900) * .05 * np.minimum(1, T(2.6) / .3)
drone = sum(np.sin(2 * np.pi * mtof(m) * T(2.6)) * a for m, a in ((40, .25), (47, .12), (52, .08))) * np.minimum(1, T(2.6) / .5)
add((air + drone) * .5, 0.0, .55, music=True)
pop_sw = tvfilt(noise(int(.32 * SR)), lambda z: 180 * 9 ** min(1, z / .26), 'bp', 1.2) * np.sin(np.pi * T(.32) / .32) ** 1.5 * .5
add(pop_sw, 0.0, .55, rev=.2); add(felt_thump(), .1, .85, rev=.2)                 # the phone pops out
swipe = tvfilt(noise(int(.32 * SR)), lambda z: 1200 + 3000 * z / .32, 'bp', 1.0) * np.sin(np.pi * T(.32) / .32) * .3
add(swipe, 1.82, .5, pan=np.linspace(-.5, .5, len(swipe)))                         # slide to answer
add(whoosh(.45, 300, 5200, .9, 1.2), 2.06, .75, rev=.3); add(reverse_swell(.42), 2.08, .7)   # fly into the screen

# ---------- music
Em = (28, [52, 55, 59, 64, 66]); C = (24, [48, 52, 55, 59, 64]); G = (31, [50, 55, 59, 62, 67]); D = (26, [50, 54, 57, 62, 66])
chords = [(2.5, 4.5, Em), (4.5, 6.5, C), (6.5, 8.5, G), (8.5, 10.5, D), (10.5, 12.5, Em), (12.5, 14.5, C), (14.5, 15.5, D), (15.5, 17.5, Em), (17.5, 18.0, C), (18.0, 21.0, Em)]
ARP = {id(Em): [64, 67, 71, 74, 76, 74, 71, 67], id(C): [64, 67, 72, 76, 79, 76, 72, 67], id(G): [62, 67, 71, 74, 79, 74, 71, 67], id(D): [62, 66, 69, 74, 78, 74, 69, 66]}
def root_at(x):
    for (a, b, ch) in chords:
        if a <= x < b: return ch[0]
    return 28
padL = np.zeros(N); padR = np.zeros(N)
for (a, b, (root, notes)) in chords:
    st = max(0, a - .02); ln = b - st + .6; t = T(ln)
    ev = np.minimum(1, t / .3) * np.where(t > b - st, np.exp(-(t - (b - st)) / .3), 1)
    for k, m in enumerate(notes):
        s = supersaw(m, ln, 5, .1) * ev * .06; pan = -.6 if k % 2 == 0 else .6
        place(padL, s * np.cos((pan + 1) * np.pi / 4), st); place(padR, s * np.sin((pan + 1) * np.pi / 4), st)
def pad_cut(x):
    if x < 2.5: return 400
    if 9.8 <= x < 11.05: return 1700 * (1 - .75 * (x - 9.8) / 1.25)          # filter closes while the particles gather
    if 15.0 <= x < 15.5: return 1700 + 5000 * (x - 15.0) / .5                # opens through the O
    if 15.5 <= x < 18.0: return 1300
    return 1800
padL = tvfilt(padL, pad_cut, 'lp'); padR = tvfilt(padR, pad_cut, 'lp')
musL += padL; musR += padR; revS += (padL + padR) * .15
K = kick(1.0, .5, 46); CL = clap()
def kick_at(x, g): add(K, x, g); place(duck, -.5 * np.exp(-T(.4) / .1), x)
def full_bar(x0, x1, hats=True, claps=True, g=.85):
    k = 0; x = x0
    while x < x1 - 1e-6:
        kick_at(x, g)
        if claps and k % 2 == 1: add(CL, x, .33, rev=.3)
        if hats: add(hat(.02), x + .25, .22, pan=.3)
        x += .5; k += 1
full_bar(2.5, 9.8)                     # drop → verbs
full_bar(9.8, 10.8, hats=False, claps=False, g=.55)    # particles gather: heartbeat only
full_bar(11.05, 15.0)                  # burst → adjectives
for x in (15.0, 15.125, 15.25, 15.375): add(snare(), x, .25 + (x - 15.0) * .8, rev=.2)   # fill into the O
for x in (15.5, 16.5, 17.0, 17.5): kick_at(x, .6)      # hero: half-time
full_bar(18.0, 20.5)                   # CTA
kick_at(20.5, .9)
for i in range(int((21.0 - 2.5) / .25)):
    x = 2.5 + i * .25
    if 9.8 <= x < 11.05 or 15.0 <= x < 15.5 or x >= 20.5: continue
    if 15.5 <= x < 18.0 and i % 2: continue
    if [1, 0, 1, 0, 1, 0, 1, 1][i % 8]: add(b808(root_at(x) + 12, .4, .16), x, .34, music=True)
for (a, b, ch) in chords:
    seq = ARP[id(ch)]
    for i in range(int((b - a) / .25)):
        x = a + i * .25
        if x < 4.5 or 9.8 <= x < 11.05 or 15.0 <= x < 15.5 or x >= 20.4: continue
        g = .13 if x < 15.5 else .1 if x < 18 else .15
        add(pluck(seq[(i * 2) % 8], .3, 3000), x, g * (1 if i % 2 == 0 else .75), pan=.4 * np.sin(i * .9), rev=.15, dly=.22, music=True)

# ---------- the few sound effects (only on the big moments)
add(boom(1.6, 90, 32, .7, .5), 2.5, .8, rev=.4); add(braam(52, 1.3, .6), 2.5, .4, rev=.4)      # DROP: call answered
add(whoosh(.5, 250, 3500, .85, 1.2), 4.5, .45, rev=.3); add(sub_drop(1.2, 95, 34), 4.98, .6)   # pair pops
add(whoosh(.55, 400, 4500, .8, 1.1), 6.5, .4, rev=.3, pan=np.linspace(.3, -.3, int(.55 * SR)))   # wipe into the verbs
add(reverse_swell(.5), 9.3, .45)                                                              # into the particles
add(line_riser(1.2), 9.85, .5, rev=.4)                                                        # gathering
add(boom(2.0, 100, 30, .9, .8), 11.05, .85, rev=.5); add(stab([52, 59, 64], .5, 3000), 11.05, .45, rev=.3)   # burst + OTKUPUJEMO
add(line_riser(.6), 14.55, .45); add(whoosh(.5, 300, 6500, .85, 1.3), 15.02, .75, rev=.4)     # fly through the O
add(spot_thunk(), 15.5, .75, rev=.45); add(hum_on(.9), 15.52, .35, rev=.3)                    # spotlight
add(whoosh(.7, 350, 2600, .6, 1.0), 16.45, .4, rev=.35, pan=np.linspace(-.5, .5, int(.7 * SR)))   # the turn
add(whoosh(.45, 500, 4000, .85, 1.1), 17.5, .45, rev=.3)                                      # out of the hero
add(boom(2.2, 95, 28, .9, .6), 18.0, .8, rev=.5)                                              # CTA
add(stab([64, 71, 76], .45, 3800), 18.5, .45, rev=.4)                                         # POŠALJI DM
add(whoosh(.7, 500, 6000, .75, 1.0), 18.6, .5, pan=np.linspace(-1, .6, int(.7 * SR)), rev=.3)  # paper plane
for k, m in enumerate((76, 83, 88)): add(bell(m, 2.0, 1.1), 20.5 + k * .11, .3, rev=.7, dly=.2)   # sonic signature

# ------------------------------------------------------------------ mix
duck = np.clip(duck, .35, 1); musL *= duck; musR *= duck
dt = int(.375 * SR); dL = np.zeros(N); dR = np.zeros(N); src = lp(dlyS, 4500)
for k in range(1, 6):
    sh = dt * k
    if sh >= N: break
    (dL if k % 2 else dR)[sh:] += src[:N - sh] * .38 ** (k - 1) * .5
musL += dL * duck; musR += dR * duck
L = dryL + musL; R = dryR + musR
ir_t = T(2.6)
def ir():
    n = noise(len(ir_t)); x = lp(n, 6500) * np.exp(-ir_t / .45) + lp(n, 1600) * np.exp(-ir_t / .8) * .6
    x[:int(.015 * SR)] = 0; return x / np.sqrt(np.sum(x ** 2))
def conv(x, h):
    n = 1 << int(np.ceil(np.log2(len(x) + len(h)))); return np.fft.irfft(np.fft.rfft(x, n) * np.fft.rfft(h, n), n)[:len(x)]
rs = hp(revS, 200); L += conv(rs, ir()) * .4; R += conv(rs, ir()) * .4
L = hp(L, 28); R = hp(R, 28); L = L + hp(L, 2500) * .12; R = R + hp(R, 2500) * .12
m = max(np.max(np.abs(L)), np.max(np.abs(R))); L /= m; R /= m
drive = 2.0; L = np.tanh(L * drive) / np.tanh(drive); R = np.tanh(R * drive) / np.tanh(drive)
fade = np.ones(N); sel = tt > 20.4; fade[sel] = np.cos(np.clip((tt[sel] - 20.4) / .6, 0, 1) * np.pi / 2) ** 2
fade[:96] = np.linspace(0, 1, 96); L *= fade; R *= fade
pk = max(np.max(np.abs(L)), np.max(np.abs(R))); L *= .89 / pk; R *= .89 / pk
out = np.stack([L, R], 1)
pcm = np.clip(out * 32767 + rng.uniform(-.5, .5, out.shape) + rng.uniform(-.5, .5, out.shape), -32768, 32767).astype('<i2')
with wave.open(sys.argv[1] if len(sys.argv) > 1 else 'audio.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('ok', out.shape)
