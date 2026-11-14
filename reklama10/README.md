# ZONA TELEFONA — „POV: UŠAO SI SAMO DA POGLEDAŠ…“

Humoristična cinematic reklama za Reels: **1080×1920, 30 fps, 25 s, H.264 + AAC, −14 LUFS**. Render se radi na 60 fps, pa se po dva kadra spajaju u jedan, što daje pravi motion blur.

**Materijal:** samo pravi telefoni u originalnim bojama, iz zvaničnog press materijala. Fajlovi nisu u gitu, a pripremaju se pomoću `tools/prep.py`.
- **iPhone 17 Pro (Apple Newsroom):**
  - film „forged plateau“: silueta kamere u mraku, makro i okret od poleđine do ekrana;
  - makro fotografija kamere u boji Cosmic Orange;
  - srebrna poleđina za 3D telefon.
- **iPhone Air (Apple Newsroom):** makro film kamere i Space Black iz fotografije sa svim bojama.
- **Samsung Galaxy S26 Ultra (Samsung):** tri ugla poleđine (desno 30°, pravo, levo 30°) za turntable.
- **AI video (Seedance i slično) nije korišćen,** jer nije povezan, a plaćene generacije nisu odobrene.

**Tehnika:**
- Canvas2D: snimci i fotografije, svetlosni prelazi, kontrolisan „handheld“ pokret kamere, DM razgovor iscrtan direktno u ekran telefona.
- **Rotacija se ne glumi:** okret telefona je samo pravi Apple snimak. Isečci dobijaju samo blago njihanje i odsjaj. Nema krupnih makro kadrova, telefoni se vide celi.
- Three.js: 3D iPhone sa pravom debljinom ivice, kartice proizvoda sa refleksijom na podu, neutralan reflektor.
- GSAP: tipografija (Anton, Montserrat Black/ExtraBold, emoji iz fonta Noto Color Emoji).
- `audio.py`: originalna muzika i zvučni dizajn, sintetizovani bez uzoraka i bez licencirane muzike.

| Vreme | Scena |
|---|---|
| 0–3 | Silueta kamere iPhone-a u mraku, dolly-in. **POV:**, pa **UŠAO SI SAMO** (SAMO narandžasto), pa **DA POGLEDAŠ…** (udarac) |
| 3–7 | Isti snimak sa speed-rampom: makro kamere, pa okret preko profila do ekrana. **ALI ONDA…**, pa **VIDEO SI OVAJ.** (dolly-in na OVAJ) |
| 7–12 | Kamera uleti u ekran do mraka i upali se svetlo u studiju. Zatim horizontalni tracking, svaki telefon ceo i pod svojim reflektorom: iPhone 17 Pro (Cosmic Orange, zvanična fotografija prednje i zadnje strane), Galaxy S26 Ultra, iPhone Air. **I SAD…**, pa **NE MOŽEŠ DA / PRESTANEŠ / DA GLEDAŠ.** |
| 12–17 | **Šala:** iPhone pokazuje tvoj DM ka @zona.telefona. **REKAO SI: SAMO GLEDAM.**, dok poruke rastu: „Koliko je ovaj? 👀“, „Ima li u crnoj?“, „Može zamena za moj stari?“, „Stižem za 10 min 🏃“, pa „Viđeno“. Muzika stane, tišina, nagli ali glatki dolly-in. **DA, NARAVNO. 😂**, a radnja odgovara: „Čekamo te 😉“ |
| 17–21 | Svetla se pale jedno po jedno nad tri telefona sa razmakom: srebrni iPhone 17 Pro, S26 Ultra i iPhone Air. **KOJI BI TI UZEO? 1, 2 ILI 3?** (brojevi iznad telefona) |
| 21–25 | Crno. Poslednji telefon odlazi kroz liniju svetla, koja postaje crta ispod loga. Zatim **ZONA TELEFONA**, **ZAPRATI ZA SVOJ SLEDEĆI TELEFON.**, **@zona.telefona** i **RUMA** |

**Kontrola kvaliteta** (`./render.sh` pokreće sve provere):
- `tools/qa_text.mjs`: tačan tekst, centriranje ±4 px i Reels sigurna zona.
- `tools/flicker.mjs`: proverava da nijedno slovo ne skače i ne trepće.
- Posle rendera: provera trajanja, fps, kodeka, glasnoće i clippinga, plus pregled kadrova.
