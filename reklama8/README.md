# ZONA TELEFONA: motion design spot (v8)

24,9 s, 1080×1920, **60 fps**, **savršen loop** (renderuje se na 120 fps, pa se po dva kadra spajaju u jedan, što daje pravi motion blur). Boje: Claude Orange #D97757 + crna + krem.

**Šta je novo u odnosu na v7.1**
- Telefoni se nikad ne otkrivaju kroz okvir ili prozor. Svaki telefon je isečena slika koja **iskoči** iz centra (opruga sa blagim prebačajem i 3D zamahom) i živi u Three.js sceni, pa ima pravu perspektivu i debljinu kad se okrene.
- **Hook:** telefon iskoči i **zvoni ~1,7 s**. Na ekranu je dolazni poziv „Tvoj novi iPhone“, telefon vibrira, a talasi prstenova idu u ritmu zvona. Prevuče se „prevuci da se javiš“, kamera uleti u ekran i ekran postane narandžasta pozadina sledećeg kadra. Kad se javiš, krene beat.
- Sav tekst je **centriran** na sredinu kadra. Slova izlaze iz maske jedno po jedno, uz animaciju širine i težine fonta, a izlaze nagore.
- **Bez tvrdih rezova:** svaka promena boje je kružno ili zakrivljeno otkrivanje sa ease-in-out krivom.
- Zvuk: originalno zvono u stilu iPhone-a (marimba) i motor za vibraciju. **Stvarna Apple melodija zvona nije korišćena jer je zaštićena autorskim pravom.** Sitni „ASMR“ efekti (tikovi, klikovi, šljokice) su uklonjeni, pa su efekti samo na velikim momentima.

| Vreme | Kadar |
|---|---|
| 0,0–2,5 | iPhone iskače iz tačke i zvoni (poziv „Tvoj novi iPhone“), prevlačenje za odgovor, uletanje u ekran |
| 2,5–5,5 | **STARI TELEFON?** → **ZAMENI GA ZA NOVI.** (drop na 2,5 s) |
| 5,5–7,3 | Crna se otvara iz centra, iPhone 17 Pro (par) iskače, a iza njega je zid teksta „NOVI“ koji klizi |
| 7,3–11,6 | **KUPI. / PRODAJ. / ZAMENI.**, svaka reč na svojoj boji |
| 11,6–14,5 | Čestice se u vrtlogu skupljaju u iPhone, on postane pravi, pa eksplodira: **OTKUPUJEMO**, brza procena · fer cena |
| 14,5–18,9 | **BRZO. / FER. / SIGURNO.**, pa prolaz kroz slovo „O“ |
| 18,9–21,2 | Reflektor, telefon iskače na sjajnom podu sa refleksijom i okreće se na poleđinu (Cosmic Orange) |
| 21,2–24,9 | CTA: **ZONA TELEFONA**, **POŠALJI DM** (uleće papirni avion), @zona.telefona, kupovina · otkup · zamena, pa skupljanje u tačku (loop) |

**v8.1: sporije reči + loop**
- Svaki tekst duže ostaje na ekranu. Slova sporije ulaze i izlaze, a prelazi boja su malo sporiji.
- **Loop bez spoja:** film počinje i završava se istim kadrom, malom narandžastom tačkom sa sjajem na crnom. Na kraju se CTA skloni, a narandžasta se skupi u tu tačku. Na početku telefon iskače iz nje.
- Zvuk je kružan: reverb, eho i rep zvona sa kraja nastavljaju se na početak, a pred spoj ide „usisavanje“ u tačku. Uzorci se na spoju poklapaju, pa nema klika.
- Sva vremena su u `timeline.json`, koji zajedno čitaju `main.js` i `audio.py`.

**Build:** `./render.sh` (traži `node_modules` kao simlink na `../reklama/node_modules`, Playwright i ffmpeg).
**Slike** (`assets/`, nisu u repozitorijumu): zvanične Apple fotografije iPhone 17 Pro (Newsroom). `front.png` i `pair.png` su isečene pomoću `tools/prep.py`. `back.png` je zvanična srebrna poleđina, prebojena u Cosmic Orange pomoću `tools/recolor_back.py`. Licencna upozorenja su ista kao ranije.
