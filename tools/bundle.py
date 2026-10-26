#!/usr/bin/env python3
"""Estrae e reimpacchetta il template della scheda (index.html è una "bundled page" di Claude Design).

  python tools/bundle.py extract            # index.html -> build/template.html
  python tools/bundle.py pack               # build/template.html -> index.html (più icone e pulizia, sotto)
  python tools/bundle.py check              # verifica codifica, risorse e icone

Il template sta in <script type="__bundler/template"> come stringa JSON.
La codifica deve restare: json.dumps(ensure_ascii=False) con '</' sostituito da '<\\u002F'.

Le risorse (font, script) stanno in <script type="__bundler/manifest">, indicizzate per UUID:
il bootstrap sostituisce ogni UUID del template con un blob o data URL. pack toglie dal manifest
le risorse che né il template né __bundler/ext_resources nominano più.

Icone Phosphor: il template contiene solo le regole CSS e i glifi delle icone usate (classi ph-nome).
pack le rigenera da tools/phosphor/ (font completo e codici) quando l'elenco cambia; in quel caso
servono fontTools e brotli (pip install fonttools brotli).
"""
import io, json, re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
HTML = ROOT / "index.html"
TPL = ROOT / "build" / "template.html"
PH = ROOT / "tools" / "phosphor"
RX = re.compile(r'(<script type="__bundler/template">\n)(.*?)(\n  </script>)', re.S)
RX_MAN = re.compile(r'(<script type="__bundler/manifest">\n)(.*?)(\n  </script>)', re.S)
RX_EXT = re.compile(r'<script type="__bundler/ext_resources">(.*?)</script>', re.S)
UUID = r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
RX_RULES = re.compile(r'(?:\.ph\.ph-[a-z0-9-]+:before \{\n  content: "\\[0-9a-f]+";\n\}\n)+')
RX_PHFONT = re.compile(r'font-family: "Phosphor";\s*src:\s*url\("(' + UUID + r')"\) format\("woff2"\);')

def encode(t: str) -> str:
    return json.dumps(t, ensure_ascii=False).replace("</", "<\\u002F")

def load():
    s = HTML.read_text(encoding="utf-8")
    m = RX.search(s)
    if not m:
        sys.exit("template non trovato in index.html")
    return s, m

def manifest(s):
    mm = RX_MAN.search(s)
    if not mm:
        sys.exit("manifest non trovato in index.html")
    return mm, json.loads(mm.group(2))

def used_uuids(s, tpl):
    ext = RX_EXT.search(s)
    return set(re.findall(UUID, tpl)) | {e["uuid"] for e in json.loads(ext.group(1) if ext else "[]")}

def icons(t):
    """(regole CSS presenti, icone usate) del template; le classi nelle regole stesse non contano."""
    m = RX_RULES.search(t)
    if not m:
        sys.exit("regole CSS delle icone Phosphor non trovate nel template")
    rest = t[:m.start()] + t[m.end():]
    if re.search(r'\bph-(?![a-z0-9])', rest):
        sys.exit("classe ph- composta nel codice: scrivi il nome intero (ph-nome), così pack la trova")
    have = set(re.findall(r'\.ph\.ph-([a-z0-9-]+):before', m.group(0)))
    return m, have, set(re.findall(r'\bph-([a-z0-9-]+)', rest))

def subset_font(cps):
    try:
        import brotli  # noqa: F401  (serve a fontTools per scrivere woff2)
        from fontTools import subset
        from fontTools.ttLib import TTFont
    except ImportError:
        sys.exit("le icone usate sono cambiate: servono fontTools e brotli (pip install fonttools brotli)")
    f = TTFont(PH / "Phosphor.woff2", recalcTimestamp=False)
    o = subset.Options()
    o.flavor, o.layout_features, o.name_IDs, o.notdef_outline = "woff2", [], ["*"], True
    o.drop_tables += ["FFTM"]
    sb = subset.Subsetter(o)
    sb.populate(unicodes=cps)
    sb.subset(f)
    b = io.BytesIO()
    f.save(b)
    return b.getvalue()

def sync_icons(t, old_t, man):
    """Rigenera regole e font se le icone usate non sono più quelle impacchettate in index.html."""
    m, _, used = icons(t)
    cp = json.loads((PH / "codepoints.json").read_text())
    unknown = sorted(used - set(cp))
    if unknown:
        sys.exit("icone Phosphor sconosciute: " + ", ".join("ph-" + n for n in unknown))
    rules = "".join(f'.ph.ph-{n}:before {{\n  content: "\\{cp[n]}";\n}}\n' for n in sorted(used))
    t = t[:m.start()] + rules + t[m.end():]
    if used == icons(old_t)[1]:
        return t, False
    fu = RX_PHFONT.search(t)
    if not fu or fu.group(1) not in man:
        sys.exit("@font-face di Phosphor (woff2) non trovato")
    import base64
    data = subset_font([int(cp[n], 16) for n in used])
    man[fu.group(1)]["data"] = base64.b64encode(data).decode()
    man[fu.group(1)]["compressed"] = False
    print(f"icone: {len(used)}, font {len(data)/1e3:.1f} KB")
    return t, True

def extract():
    s, m = load()
    TPL.parent.mkdir(exist_ok=True)
    TPL.write_text(json.loads(m.group(2)), encoding="utf-8")
    print(f"scritto {TPL.relative_to(ROOT)}")

def pack():
    s, m = load()
    mm, man = manifest(s)
    src = TPL.read_text(encoding="utf-8")
    t, font = sync_icons(src, json.loads(m.group(2)), man)
    if t != src:
        TPL.write_text(t, encoding="utf-8")
    used = used_uuids(s, t)
    gone = [k for k in man if k not in used]
    for k in gone:
        print(f"tolta dal manifest {k} ({man[k]['mime']}, {len(man.pop(k)['data'])/1e3:.0f} KB base64)")
    if font or gone:
        s = s[:mm.start(2)] + json.dumps(man, separators=(",", ":")) + s[mm.end(2):]
    m = RX.search(s)
    out = s[:m.start(2)] + encode(t) + s[m.end(2):]
    HTML.write_text(out, encoding="utf-8")
    print(f"aggiornato {HTML.name} ({len(out.encode())/1e6:.2f} MB)")

def check():
    s, m = load()
    t = json.loads(m.group(2))
    ok = encode(t) == m.group(2)
    print("round-trip identico" if ok else "ATTENZIONE: la codifica non coincide")
    _, man = manifest(s)
    used = used_uuids(s, t)
    # Un UUID del template senza risorsa resterebbe un URL letterale (404).
    bad = [f"{k} è usato ma non è nel manifest" for k in sorted(used - set(man))]
    bad += [f"{k} è nel manifest ma non è usato" for k in man if k not in used]
    _, have, want = icons(t)
    bad += [f"icona ph-{n} senza regola CSS" for n in sorted(want - have)]
    bad += [f"regola CSS di ph-{n} non usata" for n in sorted(have - want)]
    for b in bad:
        print("ATTENZIONE:", b, "(esegui pack)")
    if not bad:
        print(f"risorse e icone ({len(want)}) in ordine")
    sys.exit(0 if ok and not bad else 1)

if __name__ == "__main__":
    {"extract": extract, "pack": pack, "check": check}.get((sys.argv[1:] or [""])[0], lambda: sys.exit(__doc__))()
