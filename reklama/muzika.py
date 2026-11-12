import numpy as np, wave
SR=44100; D=30.5; N=int(SR*D); t=np.arange(N)/SR
out=np.zeros(N); rng=np.random.default_rng(1)
beat=0.5
def add(sig,start):
    i=int(start*SR); n=min(len(sig),N-i)
    if n>0: out[i:i+n]+=sig[:n]
def env(n,a,d): x=np.arange(n)/SR; return np.minimum(x/a,1)*np.exp(-x/d)
# kick
kn=int(.35*SR); kx=np.arange(kn)/SR
kick=np.sin(2*np.pi*(50*kx+90*(1-np.exp(-kx*30))/30*30/ (2*np.pi)*0+ 0)) # placeholder
f=45+110*np.exp(-kx*28); kick=np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-kx*7)
hat=rng.standard_normal(int(.05*SR)); hat=np.diff(hat,prepend=0)*env(len(hat),.001,.012)*.25
clap=rng.standard_normal(int(.2*SR))*env(int(.2*SR),.002,.05)*.35
prog=[ (55.0,[220,261.6,329.6]), (43.65,[174.6,220,261.6]), (65.41,[196,261.6,329.6]), (49.0,[196,246.9,293.7]) ] # Am F C G
start_full=3.5
for b in range(int(D/beat)):
    tb=b*beat
    if tb<start_full:  # intro: samo tihi hat + pad
        if b%2==0: add(hat*.6,tb)
    else:
        add(kick*.9,tb)
        add(hat,tb+beat/2)
        if b%2==1: add(clap,tb)
        if tb>27.3+1.6 and tb<29.5: add(kick*.5,tb+beat/2)
# bas i pad po taktu (4 udarca = 2s)
for bar in range(int(D/2)+1):
    tb=bar*2.0; root,ch=prog[bar%4]
    n=int(2*SR); x=np.arange(n)/SR
    pad=sum(np.sign(np.sin(2*np.pi*fr*x))*.5+np.sin(2*np.pi*fr*1.005*x)*.5 for fr in ch)*.025
    pad*=np.minimum(x/.3,1)*np.minimum((2-x)/.3,1)
    add(pad,tb)
    if tb>=start_full-0.01:
        for k in range(4):
            bx=np.arange(int(.45*SR))/SR
            bass=(np.sin(2*np.pi*root*2*bx)+.4*np.sign(np.sin(2*np.pi*root*2*bx)))*np.exp(-bx*5)*.28
            add(bass,tb+k*.5+.25)
# arp melodija od 8s
notes=[440,523.3,659.3,523.3, 349.2,440,523.3,440, 392,523.3,659.3,784, 392,493.9,587.3,493.9]
for i in range(int((D-8)/.25)):
    tb=8+i*.25; fr=notes[(i//2)%16] if i%2==0 else notes[(i//2)%16]*2
    n=int(.2*SR); x=np.arange(n)/SR
    add(np.sin(2*np.pi*fr*x)*np.exp(-x*14)*.07,tb)
# whoosh/riser pred prelazima
for c in [3.5,8,13,18,23,27.3]:
    n=int(.6*SR); x=np.arange(n)/SR
    nz=rng.standard_normal(n); nz=np.convolve(nz,np.ones(8)/8,'same')
    add(nz*(x/.6)**2*.25, c-.6)
    add(kick*1.0, c); add(clap*.8, c)
# impact na kraju
add(np.sin(2*np.pi*55*np.arange(int(1.5*SR))/SR)*np.exp(-np.arange(int(1.5*SR))/SR*2)*.5, 29.5) if False else None
fade=np.clip((D-t)/1.2,0,1); out*=fade; out*=np.clip(t/.05,0,1)
out=np.tanh(out*1.3); out/=np.abs(out).max()*1.05
s=(out*32767).astype(np.int16); st=np.stack([s,s],1)
with wave.open('muzika.wav','wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(st.tobytes())
