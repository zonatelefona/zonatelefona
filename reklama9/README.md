# ZONA TELEFONA: 16:9 verzija (1920×1080, TikTok / YouTube)

Ista reklama kao vertikalna FINAL verzija u `../reklama8`, prilagođena za položen ekran: 19 s, 60 fps (render na 120 fps, pa motion blur), savršen loop, −14 LUFS.

**Šta je drugačije u 16:9**
- **Hook:** telefon iskoči iz tačke i zvoni. Kad se prevuče za odgovor, telefon se tokom uletanja u ekran **okrene u horizontalni položaj**, pa ekran prekrije ceo 16:9 kadar.
- **Reč po reč:** reči su do 1560 px široke i ~330 px visoke, sa jačim klizanjem i rasprsnućem.
- **NOVI:** reč stoji iza para telefona i vidi se sa obe strane.
- **Reflektor scena:** ista kao u vertikalnoj verziji, preračunata za kadar visok 1080 px.
- **CTA u jednom redu:** ZONA prvo stoji velika u centru. Zatim se pomeri ulevo dok TELEFONA uleće desno, pa ispod iskoči **POŠALJI DM** (papirni avion) i @zona.telefona. Na kraju se sve skupi u tačku (loop).
- **Zvono:** sintetizovana marimba u stilu iPhone-a (modalni tonovi 1 : 3,93 : 9,24, rezonator, „zvučnik telefona“), sa originalnom melodijom. **Pravo iPhone zvono:** stavi svoj snimak kao `assets/ringtone.wav` (ili `.m4a`, `.mp3`, `.mov`, `.mp4`). `audio.py` ga automatski koristi: odseče tišinu na početku, uzme 1,7 s i doda kratak fade. Apple-ova zvona su zaštićena autorskim pravom, pa je korišćenje na tvoj rizik.

**Build:** `./render.sh`. Pokreće i dve provere: `tools/qa.py` (centriranje) i `tools/flicker.mjs` (treptanje slova).
