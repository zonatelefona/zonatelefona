# ZONA TELEFONA — BLACK FRIDAY (v2, potpuna rekonstrukcija)

Najava za Black Friday: **1080×1920, 60 fps**, **25 s**, H.264 High + AAC 48 kHz, −14 LUFS, true peak ≤ −1 dBTP.
60 fps je stvaran: svaki kadar se renderuje na 120 fps, pa se po dva susedna kadra spajaju u jedan, što daje pravi motion blur.

v1 je u istom projektu potpuno zamenjen. Nijedna pozadina, slika telefona, kompozicija ni animaciona sekvenca iz v1 nije ponovo korišćena (stari aseti su u `assets/legacy/`).

## Struktura projekta (sve se menja kao tekst)

| Fajl | Šta je |
|---|---|
| `timeline.json` | Svi tajminzi (scene, udarci, tekst). Slika i zvuk čitaju isti fajl, pa pomeranje jednog broja pomera oba. |
| `main.js` | 11 posebnih 3D svetova („shotova“), 10 različitih prelaza i post-obrada (bloom, grade, film grain). |
| `audio.py` | Kompletan zvučni dizajn i muzika, sintetizovani bez uzoraka. |
| `render.mjs` / `render.sh` | Render kadrova (Playwright + WebGL), enkodovanje, provera rezolucije, fps-a i glasnoće. |
| `tools/qa_text3d.mjs` | QA tipografije: projektuje svako 3D slovo na ekran i proverava centriranje i Instagram safe zonu. |

## Scene

| Vreme | Scena | Tehnika |
|---|---|---|
| 0–3 | Ekstremni makro objektiv: brzi push, iris sa 9 lamela se zatvori (klik) i otvori (servo), narandžasti odsjaj preko stakla. Kamera prolazi kroz otvor blende u tamni prostor sa vertikalnom svetlosnom oštricom. Na 1,55 s udar i **SPREMI SE.** | CG objektiv (lathe geometrija, anodizovani prsten, premazana sočiva, shader blende). Prelaz IRIS: sledeća scena se vidi kroz poligon blende. |
| 3–7 | Četiri različita kadra telefona: titanijumski bočni okvir (pravi Apple snimak, rotiran uspravno, makro pan + svetlo koje putuje po metalu); Cosmic Orange kamera (tracking + rack focus); prednji ekran Galaxy S26 Ultra u tamnom reflektujućem studiju; tri telefona u 3D kompoziciji sa lukom kamere. | Prelazi: svetlosna oštrica, whip, rack focus, dijagonalni light sweep, dubinski dolly. |
| 7–11 | Tamna metalna arhitektura: hodnik od metalnih rebara, narandžasti impulsi u podu, svetlosne kapije. CG telefon sa titanijumskim okvirom lebdi u hodniku, a kamera u slow-motionu prolazi centimetrima pored njegove ivice. Tenzija raste. | Instancirana geometrija, point lights, linije brzine, speed ramp. Prelaz FLASH u svetlo. |
| 11–15 | 2.200 metalnih fragmenata kruži u vrtlogu i slaže se u tačne oblike slova. Na 13,0 s se sklopi masivni 3D **BLACK FRIDAY** (najjači udarac: blesak, varnice, potres). | Uzorci po površini glifova, instancirani fragmenti. Prelaz SLIT kroz procep između redova. |
| 15–19 | Premium izložbeni prostor: ogledalni pod, zid od narandžastih svetlosnih letvica. **ZONA TELEFONA** izranja kroz pod, a kamera ide orbitom do frontalnog kadra. | Clipping planes za refleksiju. Prelaz LUMA: nova scena se prvo pojavi u svetlu. |
| 19–23 | Hero kadar: telefon u orbiti (pravi Apple snimak, rotacija od kamere do ekrana), volumetrijski snopovi, bokeh u prvom planu. **AKCIJA STIŽE**, pa **USKORO.** sa finalnim udarcem. | Footage plate (blend kadrova 30 → 60 fps), aditivni snopovi. Prelaz DIM. |
| 23–25 | Čist logo **ZONA TELEFONA** na dubokoj crnoj, suptilno narandžasto svetlo i linija, završni zvučni rep. | Bez naglog reza. |

## Aseti (u `assets/`, nisu u git-u)

- **Zvanični press materijal** (korisnik je prihvatio rizik upotrebe):
  - `cs/` — 100 kadrova iz Apple filma *iPhone 17 Pro Ceramic Shield 2*;
  - `pl/` — 360 kadrova iz filma *forged plateau*;
  - `cam.jpg` — Apple makro kamere;
  - `pair.png` — iPhone 17 Pro, Cosmic Orange;
  - `s26_front_l30.png` i `s26_back_r30.png` — Samsung Galaxy S26 Ultra (izrezani sa belog).
- **Generisano kodom:** CG objektiv, CG telefon, sva 3D slova i čitav zvuk.
- **Font:** Montserrat Black, latin i latin-ext, zbog slova Ž.

## Zvuk (`audio.py`)

- **Udarci i efekti:** udarac već na prvom kadru (mehanički klak, metal i sub-bas), motor fokusa, klik lamela, servo, „usisavanje“ kroz objektiv, bas udarac na SPREMI SE., metalni zvuk koji klizi po okviru, whip, shutter i rack focus.
- **Hodnik i fragmenti:** doppler prolaz pored telefona, riser i roj sitnih metalnih zvukova za fragmente.
- **Vrhunac:** najjači udarac je na sklapanju BLACK FRIDAY (boom, braam, metalni udarac, sub drop).
- **Kraj:** štimovani metalni udari za svako slovo ZONA, staklo za TELEFONA, udarci za AKCIJA STIŽE i USKORO., pa zvono i dugi sub-rep.
- **Muzika:** originalna, u d-molu na 120 BPM; rezovi su na udarima takta.

## Ograničenja (iskreno)

- AI video modeli (Seedance i slično) nisu povezani i nisu korišćeni.
- Ray tracing nije dostupan, pa refleksije idu preko environment mapa (PMREM).
- Volumetrija je simulirana (aditivni konusi, haze, prašina), nije prava fizička simulacija.
- Render je softverski (SwiftShader), kadar po kadar.

**Build:** `./render.sh` (traži `node_modules` kao simlink na `../reklama/node_modules`, Playwright, ffmpeg i numpy).
