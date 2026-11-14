# ZONA TELEFONA: motion design spot (FINAL, Reels)

19 s, 1080×1920, **60 fps**, **savršen loop**. Renderuje se na 120 fps, pa se po dva kadra spajaju u jedan, što daje pravi motion blur. Boje: Claude Orange #D97757 + crna + krem.

**v9: reč po reč, za Reels**
- **Jedna velika reč u isto vreme**, uvek tačno centrirana. Centrira se visina velikih slova, a ne kutija teksta. Svaka reč dobija širinu fonta (variable axis `wdth`) takvu da bude što veća u sigurnoj zoni Reels-a (širina ≤ 940 px, centar kadra, bez preklapanja sa Instagram ikonicama i opisom).
- Nijedna reč se ne ponavlja.
- Svaka reč ima sopstvenu animaciju: izranjanje iz maske, udarac iz kamere, klizanje sa nagibom, 3D okret slova, rasprsnuće slova iz centra ili rastezanje širine. Dok je na ekranu, reč blago „diše“, a na ulazu ima kratak muzički akcent.
- Ritam: oko 0,75 s po reči. Pozadina se menja eased kružnim ili zakrivljenim otkrivanjem, koje se završi baš kad reč stigne. Boje teksta su izabrane da se reč vidi i na staroj i na novoj pozadini.
- **Centriranje:** sve reči, NOVI i ceo CTA blok su automatski provereni i nalaze se ±4 px od centra kadra (`tools/qa.py`). Ranije su široke reči bežale udesno, jer im je bočni razmak sužavao prostor.
- **Bez treptanja slova:** pozicija svakog slova se proverava kadar po kadar na 120 fps (`tools/flicker.mjs`). Nijedno slovo ne sme da skoči ni da se pojavi pre svog reda, a ulaz svake reči se uvek završi pre njenog izlaza. Time je ispravljeno i seckanje reči ZONA na kraju.
- **Ekran telefona sada tačno leži u okviru:** zaobljeni uglovi ekrana (r = 116 px, izmereno na crnom okviru).
- Loop: film počinje i završava se istom narandžastom tačkom, a zvuk je kružan.
- Isporuka: H.264 High, BT.709 tagovi, faststart, AAC 48 kHz, glasnoća **−14 LUFS** (Instagram normalizacija), cover slika.

| Vreme | Reč / kadar |
|---|---|
| 0–2,5 | iPhone iskače iz tačke i zvoni (poziv „Tvoj novi iPhone“), prevlačenje za odgovor, uletanje u ekran |
| 2,5 | **STARI** (maska) |
| 3,25 | **TELEFON?** (rastezanje) |
| 4 | **NOVI**, pa iPhone 17 Pro (par) iskače ispred reči |
| 6 | **KUPI.** (udarac) |
| 6,75 | **PRODAJ.** (klizanje) |
| 7,5 | **ZAMENI.** (3D okret slova) |
| 7,98 | Čestice se skupljaju u iPhone, on postane pravi, pa eksplodira |
| 9,25 | **OTKUPUJEMO** (rasprsnuće slova) |
| 10,5 / 11,25 / 12 | **BRZO.** / **FER.** / **SIGURNO.**, pa prolaz kroz slovo „O“ |
| 13,2 | Reflektor, telefon iskače i okreće se na poleđinu |
| 15,5 | **ZONA**, pa **TELEFONA**, pa **POŠALJI DM** (papirni avion) i @zona.telefona |
| 18,25 | Sve se skupi u tačku (loop) |

**Build:** `./render.sh` (traži `node_modules` kao simlink na `../reklama/node_modules`, Playwright i ffmpeg). Sva vremena su u `timeline.json`, koji zajedno čitaju `main.js` i `audio.py`.
**Slike** (`assets/`, nisu u repozitorijumu): zvanične Apple fotografije iPhone 17 Pro (Newsroom). `front.png` i `pair.png` su isečene pomoću `tools/prep.py`. `back.png` je zvanična srebrna poleđina, prebojena u Cosmic Orange pomoću `tools/recolor_back.py`. Licencna upozorenja su ista kao ranije.
