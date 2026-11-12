# ZONA TELEFONA — cinematic reklama (Instagram Reels)

Gotov video: `ZONA_TELEFONA_reklama_1080x1920_30fps.mp4` (9:16, 1080×1920, 26 s, H.264 + AAC 320 kbps).
Postoji i 60 fps verzija.

## Struktura reklame (26 s, 120 BPM, D-mol)
| Vreme | Scena | Tekst |
|---|---|---|
| 0.0–3.0 | Udar svetla, makro kamere telefona, orbit, ekran se pali, ulet kamere u ekran | „Tvoj sledeći telefon / počinje ovde.“ |
| 3.0–6.0 | Brand reveal | ZONA TELEFONA · Premium mobilni telefoni |
| 6.0–10.0 | Drop: 3 telefona uleću na udarce bubnja, orbit kamera | 01 — KUPOVINA · Provereni telefoni. Premium izbor. |
| 10.0–14.0 | Laserski sken + staklena kartica procene | 02 — OTKUP · Brza procena. Fer ponuda. |
| 14.0–18.0 | Dva telefona menjaju mesta po svetlosnoj orbiti | 03 — ZAMENA · Staro za novo. Bez komplikacija. |
| 18.0–21.0 | Ritmička montaža + build-up | Kupovina. Otkup. Zamena. · Premium telefoni. Sigurna kupovina. |
| 21.0–26.0 | Finalni udar, hero telefon sa logom | ZONA TELEFONA · Pronađi svoj sledeći telefon. · @zona.telefona |

## Fajlovi
- `index.html`, `style.css`, `scene.js`: 3D scena (three.js, proceduralni telefoni, PBR metal/staklo, bloom, color grade), tipografija, animacije
- `audio.py`: originalna muzika i sound design, sintetizovani od nule i sinhronizovani sa slikom
- `render.mjs`: renderuje kadrove kroz headless Chromium
- `render.sh`: ceo proces jednom komandom → `build/*.mp4`

## Ponovni render
```bash
cd reklama && ./render.sh      # WORKERS=4 po defaultu
```
Tekstovi se menjaju u `index.html`, a tajming u `scene.js` (`setTime`) i u `audio.py` (iste vremenske oznake).
