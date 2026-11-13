# ZONA TELEFONA v6: „IPHONE ILI ULTRA?“

Format: 24 s, 1080×1920, 30 fps. Paleta: Claude Orange #D97757, Vivid #F97316, Burnt #C45A35, crna #0A0A0A, charcoal #1C1C1C, krem #F4E9DC.
Fontovi: Anton, Archivo Black i Bebas Neue.

## Uređaji (pravi, ne generisani)
- **iPhone 17 Pro:** Apple-ov originalni CGI snimak (*forged plateau*, Apple Newsroom), sa speed ramp-om i frame blending-om. Narandžasti light sweep osvetljava samo piksele telefona. Srebrna zadnja strana je iz zvanične fotografije *color lineup*.
- **Galaxy S26 Ultra Black:** Samsung Mobile Press, 4500×3000. Korišćeni su zadnja strana, ugao 30° pozadi, levi bok, ugao 30° spreda, prednja strana i S Pen.
- **Ivično svetlo:** narandžasto ivično svetlo je izračunato iz alfa kanala svake fotografije (`tools/make_assets.py`). Geometrija telefona se ne menja.
- **Proporcije:** iPhone je 150 mm, S26 Ultra 163,6 mm.

⚠️ Press materijali su po uslovima Apple-a i Samsunga namenjeni nekomercijalnoj upotrebi. Klijent ih koristi na sopstveni rizik. Zbog toga nisu u repozitorijumu (`assets/` je u .gitignore).

## Storyboard
| Vreme | Kadar | Kamera i animacija | Zvuk |
|---|---|---|---|
| 0–2 | IPHONE / ILI / ULTRA? | Narandžasti zrak preseče kadar, reči udaraju (scale-slam) sa suprotnih strana, kamera ulazi kroz tekst | 2 različita cinematic udara, prasak zraka, riser |
| 2–7 | iPhone 17 Pro (Apple CGI) | Blesak (match cut), push-in na kamere, speed ramp rotacije, ekran, whip pan levo | shutter, servo, tonski sweep, chime, whoosh |
| 7–12 | Galaxy S26 Ultra | Pad odozgo i sletanje, paljenje ivičnog svetla, brz push-in na macro kamere, odsjaj sočiva, whip-spin kroz 5 stvarnih uglova, S Pen izlazi, whip pan desno | zviždanje pada, najdublji bas udar, električno paljenje, swell, ping, 4 zamaha, sleganje, klik S Pen-a |
| 12–17 | Duel | Telefoni uleću sa strana (motion blur), sudar sa svetlosnim rezom, orbita oko centra (zamena dubine), ritmička svetla L/D, build-up | dva whoosh-a, metalni sudar, kružni ton, udari na tekst, stab-ovi, snare roll |
| 17–24 | CTA | Drop: „TVOJ SLEDEĆI TELEFON ČEKA.“, logo otkriven narandžastim zrakom, ZAPRATI @zona.telefona, POŠALJI DM ZA PONUDU, telefoni se dižu odozdo | drop, braam, zvučni potpis (3 note), UI pop |

Render: `./render.sh` (traži lokalni `assets/`).
