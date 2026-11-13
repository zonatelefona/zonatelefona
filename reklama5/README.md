# ZONA TELEFONA v5: iPhone 17 Pro × Galaxy S26 Ultra

Premium product reklama (27 s, 1080×1920, 30 fps) u burgundy, crnoj i krem paleti.

## Izvori uređaja (pravi, ne generisani)
- **iPhone 17 Pro:** Apple Newsroom paket „Images of Apple iPhone 17 Pro“. Rotacija i macro kadrovi su Apple-ov originalni CGI snimak *forged plateau* (video 2,0–9,3 s, iseci 1080×1080, bez ikakve izmene geometrije). Srebrni iPhone u duo sceni je izrezan iz zvanične fotografije *color lineup*, ista boja kao u snimku.
- **Galaxy S26 Ultra (Black):** Samsung Mobile Press, 4500×3000. Korišćene fotografije: zadnja strana, zadnja strana pod 30°, prednja strana i S Pen, izrezane sa bele pozadine (`tools/cutout_white.py`).
- Odnos veličina je realan: iPhone 17 Pro 150,0 mm, a S26 Ultra 163,6 mm (faktor 0,917).

⚠️ Licenca: Apple i Samsung press materijali su namenjeni nekomercijalnoj/uredničkoj upotrebi. Klijent je svesno izabrao njihovu upotrebu na sopstveni rizik. Materijali nisu u repozitorijumu (`assets/` je u .gitignore).

## Storyboard i zvuk
| Vreme | Kadar | Zvuk |
|---|---|---|
| 0,0–0,5 | Mrak, anamorfni svetlosni zrak otvara kadar | dubok udar + svetlucanje L→D |
| 0,3–7,5 | Apple CGI: camera plateau izranja iz tame → precizna rotacija → ekran | swell, staklasti chime na naslovu, tonski sweep tokom rotacije, chime na ekranu, tihi „sat“ tikovi |
| 7,5–8,15 | Prelaz svetlosnom trakom | reverse swell + bas pad |
| 8,0–10,0 | S26 Ultra: zadnja strana izranja, svetlo klizi preko stakla | mehanički whoosh + metalno sleganje |
| 10,0–11,5 | Macro kamere (pan preko sočiva) | zvuk okidača + servo (ritam kreće) |
| 11,5–13,0 | Ugao od 30°, lateralni parallax | vazdušni sweep |
| 13,0–14,5 | Prednja strana, S Pen izlazi iz ležišta | tup udar, klik leže + klizanje |
| 14,5–19,5 | Oba telefona, bordo svetlosna traka po podu, svetlo prelazi sa iPhone-a na Samsung, „Izbor je tvoj.“ | dva različita whoosh-a (L/D), sleganje, tonski glissando trake, dve note za dva svetla |
| 19,5–20,5 | Telefoni se povlače u pozadinu | build-up |
| 20,5–27,0 | „Tvoj sledeći telefon je ovde.“ → logo ZONA TELEFONA → „Zaprati profil i pošalji DM.“ + @zona.telefona | payoff akord, zvučni potpis brenda (3 note), UI pop na CTA |

Render: `./render.sh` (traži `assets/` lokalno).
