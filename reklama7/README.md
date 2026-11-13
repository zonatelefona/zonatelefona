# ZONA TELEFONA: motion design spot (v7)

18 s, 1080×1920, **60 fps**, Claude Orange #D97757 + crna + krem.
Stil prema referentnom videu: ritmični rezovi na 120 BPM, cele pozadine u jednoj boji, ogromna variable-font tipografija (Anybody, širina i težina se animiraju), asterisk motiv, truchet proceduralni uzorak, pretapanje oblika sa tačkama u orbiti i 3D oblak tačaka.

**Tehnika**
- **Three.js:** oblak od 26.000 tačaka u obliku iPhone 17 Pro, koji se pretapa u sferu i nazad; hero scena sa volumetrijskim konusom svetla (shader), prašinom, refleksijom na podu, rotirajućim asteriskom i bloom-om.
- **GSAP:** cela kinetička tipografija je jedan timeline koji se za svaki kadar postavlja na tačno vreme (`tl.seek(t)`).
- **Canvas2D:** proceduralna grafika (asterisk, iris maska u obliku superelipse, truchet polje, pretapanje oblika krug → trougao → zvezda → telefon, tačke u orbiti).
- Render ide kadar po kadar kroz headless Chromium (`render.mjs`, 60 fps), a zvuk je sintetizovan u `audio.py`, sa jednim zvukom za svaki rez.
- **iPhone:** zvanične Apple fotografije iPhone 17 Pro u boji Cosmic Orange (Newsroom). One nisu u repozitorijumu, a važe ista licencna upozorenja kao ranije.

| Vreme | Kadar |
|---|---|
| 0–0,5 | Narandžasta tačka, krug se iscrta, eksplozija asteriska |
| 0,5–2,5 | **PRODAJEŠ? / MENJAŠ? / KUPUJEŠ? / ZONA** telefona, na svaka 3/16 takta, svaka reč na drugoj boji pozadine |
| 2,5–4,5 | Iris maska (krug → squircle) otkriva kamere iPhone 17 Pro, tačke u orbiti |
| 4,5–6,5 | Truchet polje se okreće u talasima, kroz prozor se vidi iPhone, **STARI ZA NOVI.** |
| 6,5–8,5 | 3D oblak tačaka u obliku iPhone-a se okreće, eksplodira u sferu i vraća se, **OTKUPUJEMO** |
| 8,5–10,5 | Krug → trougao → zvezda → telefon, koji se ispuni pravim iPhone-om: **IZABERI. ZAMENI. UŽIVAJ.** |
| 10,5–12,5 | **BRZO. FER. SIGURNO. LAKO.** na smenjivim bojama pozadine |
| 12,5–15 | Hero: iPhone 17 Pro pod reflektorom, refleksija, prašina, asterisk |
| 15–18 | CTA: **ZONA TELEFONA**, **POŠALJI DM** (papirni avion), @zona.telefona |
