# ZONA TELEFONA — „BLACK FRIDAY IS COMING“

Cinematic najava za Black Friday: **1080×1920, 60 fps** (render na 120 fps, pa se po dva kadra spajaju u jedan, što daje pravi motion blur), **25 s**, H.264 + AAC, −14 LUFS.

**Tehnika:** pravi 3D u realnom vremenu (Three.js, WebGL). Cela reklama je jedan neprekidan pokret kamere kroz 3D svet:
- **PBR metali:** crni metal, hrom i grafit, sa refleksijama iz posebnog okruženja (crni studio sa narandžastim soft-boxovima i belom trakom). ACES tonemapping.
- **3D tipografija:** svako slovo je posebno ekstrudirano iz fonta Montserrat Black (latin i latin-ext, zbog slova Ž), sa narandžasto osvetljenim ivicama.
- **Volumetrija:** snopovi svetla, čestice prašine, izmaglica i dim (proceduralne teksture), fog.
- **Pucanje zida:** shader sa radijalnim pukotinama, prstenovima i Voronoi lomovima koji se šire od tačke udarca. Zatim 252 metalne krhotine sa fizikom i 900 varnica sa repovima.
- **Telefoni:** pravi telefoni iz zvaničnog press materijala: iPhone 17 Pro (Cosmic Orange, prednja i zadnja strana, sa debljinom ivice), Galaxy S26 Ultra, iPhone Air i srebrni iPhone 17 Pro.
- **Obrada slike:** bloom, color grade (duboke crne, blaga S-kriva, vinjeta) i fino zrno.
- **Zvuk:** `audio.py` je originalni tamni „tech trailer“ score, sintetizovan bez uzoraka. Sadrži sub-bas, metalne udarce sa dugom rezonancom, pucketanje energije, rizere, lomljenje stakla i metala i braam.

| Vreme | Scena |
|---|---|
| 0–3 | Praznina, apsolutna tišina, sub-bas. Sićušno narandžasto svetlo, snopovi kroz prašinu. Na 2,0 s udarac i monumentalno metalno **Z** izranja iz monolita |
| 3–6 | Orbit oko crnog metalnog monolita: **ZONA TELEFONA** izranja slovo po slovo, a narandžasto svetlo putuje po ivicama |
| 6–10 | Kamera prođe tik uz ivicu monolita, pa iz tame izranjaju telefoni. Dolly kroz njih, hero iPhone se polako okreće, iza prolaze narandžasti svetlosni tragovi |
| 10–14 | Sve uspori, kamera ide ka ogromnom crnom zidu, kroz pukotine se širi narandžasta energija. Zid se razbije (krhotine, varnice, blesak, potres kamere), kamera prolazi kroz rupu i otkriva se **BLACK FRIDAY** (najjači udarac) |
| 14–19 | **BLACK FRIDAY / AKCIJA STIŽE U / ZONA TELEFONA**, sa udarcima u ritmu |
| 19–23 | Hero kadar: telefon ispred ogromnog narandžastog BLACK FRIDAY, svetlosni snopovi se spajaju. **BLACK FRIDAY AKCIJA?**, zatim **ZONA TELEFONA**, pa **USKORO.** (finalni bas udarac) |
| 23–25 | Svetla se gase, a na crnom ostaje logo sa narandžastom linijom i bas rezonancom |

**Ograničenja:** AI video modeli (Seedance i slično) nisu povezani i nisu korišćeni. Ray-tracing nije dostupan, pa se refleksije rade preko environment mape (PMREM). Render je softverski (SwiftShader), kadar po kadar.
**Build:** `./render.sh` (traži `node_modules` kao simlink na `../reklama/node_modules`, Playwright i ffmpeg).
