#!/usr/bin/env python3
"""Genera le immagini degli esercizi da palestra (costante GYM del template) dai disegni di Everkinetic.

  git clone --depth 1 https://github.com/everkinetic/data /percorso/everkinetic
  python tools/everkinetic.py /percorso/everkinetic

Per ogni esercizio `id:{ek:'nome',n:'Nome',…}` di GYM legge src/images-web/<nome>-1.png e -2.png (se mancano,
dist/png/<numero>-relaxation.png e -tension.png, con il numero preso da exercises.json) e scrive:
  img/ek/<id>.jpg     i due disegni affiancati (scheda dettagli e modalità guidata)
  img/ek/<id>-t.jpg   il primo disegno, quadrato (miniatura)
poi riscrive img/ek/CREDITS.md e toglie le immagini di esercizi che non ci sono più.
Il template si legge da build/template.html se esiste, altrimenti da index.html. Serve Pillow.

Licenza dei disegni: CC BY-SA 4.0 (LICENSE.md del repository everkinetic/data). Le immagini derivate
(ritagliate, ridimensionate, affiancate) restano CC BY-SA 4.0.
"""
import json, pathlib, re, sys
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "img" / "ek"
H, MAXW, THUMB = 420, 860, 144
RX = re.compile(r"\b(g\w+):\{ek:'([a-z0-9-]+)',n:'([^']+)'")

def template():
    tpl = ROOT / "build" / "template.html"
    if tpl.exists():
        return tpl.read_text(encoding="utf-8")
    sys.path.insert(0, str(ROOT / "tools"))
    import bundle
    return json.loads(bundle.load()[1].group(2))

def trim(im):
    """Toglie il bordo bianco intorno al disegno."""
    bb = im.convert("L").point(lambda v: 255 if v < 235 else 0).getbbox()
    return im.crop(bb) if bb else im

def sources(src, ek, nums):
    web = [src / "src" / "images-web" / f"{ek}-{k}.png" for k in (1, 2)]
    if all(f.exists() for f in web):
        return web
    if ek in nums:
        dist = [src / "dist" / "png" / f"{nums[ek]}-{k}.png" for k in ("relaxation", "tension")]
        if all(f.exists() for f in dist):
            return dist
    sys.exit(f"disegni mancanti per {ek}")

def main(src):
    src = pathlib.Path(src)
    if not (src / "exercises.json").exists():
        sys.exit(f"non è una copia di everkinetic/data: {src}")
    nums = {x["name"]: x["id_num"] for x in json.loads((src / "exercises.json").read_text(encoding="utf-8"))}
    items = RX.findall(template())
    if not items:
        sys.exit("nessun esercizio GYM nel template")
    OUT.mkdir(parents=True, exist_ok=True)
    keep = set()
    for gid, ek, _ in items:
        frames = []
        for f in sources(src, ek, nums):
            im = Image.open(f).convert("RGBA")
            bg = Image.new("RGBA", im.size, "white")
            bg.alpha_composite(im)
            frames.append(trim(bg.convert("RGB")))
        frames = [fr.resize((round(fr.width * H / fr.height), H), Image.LANCZOS) for fr in frames]
        pad, gap = 16, 28
        sheet = Image.new("RGB", (sum(fr.width for fr in frames) + gap + 2 * pad, H + 2 * pad), "white")
        x = pad
        for fr in frames:
            sheet.paste(fr, (x, pad))
            x += fr.width + gap
        if sheet.width > MAXW:
            sheet = sheet.resize((MAXW, round(sheet.height * MAXW / sheet.width)), Image.LANCZOS)
        sheet.save(OUT / f"{gid}.jpg", quality=80, optimize=True, progressive=True)
        first = frames[0]
        side = round(max(first.width, first.height) * 1.1)
        sq = Image.new("RGB", (side, side), "white")
        sq.paste(first, ((side - first.width) // 2, (side - first.height) // 2))
        sq.resize((THUMB, THUMB), Image.LANCZOS).save(OUT / f"{gid}-t.jpg", quality=82, optimize=True)
        keep |= {f"{gid}.jpg", f"{gid}-t.jpg"}
    for f in OUT.glob("*.jpg"):
        if f.name not in keep:
            f.unlink()
            print("tolta", f.name)
    rows = "\n".join(f"| `{gid}` | {n.replace('’', "'")} | `{ek}` |" for gid, ek, n in items)
    (OUT / "CREDITS.md").write_text(f"""# Disegni degli esercizi da palestra

Disegni di **Everkinetic** (everkinetic.com, Greg Priday), dal progetto di dati aperti
[everkinetic/data](https://github.com/everkinetic/data), con licenza
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

Modifiche: bordo bianco ritagliato, ridimensionati, i due disegni di ogni esercizio affiancati in
`<id>.jpg`, il primo ritagliato quadrato in `<id>-t.jpg` per la miniatura, salvati in JPEG.
Anche queste immagini sono distribuite con licenza CC BY-SA 4.0. Le istruzioni in italiano nella
scheda sono scritte per la scheda, a partire dalle descrizioni di Everkinetic.

Generate con `python tools/everkinetic.py <copia di everkinetic/data>`.

| ID | Esercizio | Nome in everkinetic/data |
|---|---|---|
{rows}
""", encoding="utf-8")
    print(f"{len(items)} esercizi, {sum(f.stat().st_size for f in OUT.glob('*.jpg')) / 1e6:.1f} MB in {OUT.relative_to(ROOT)}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
