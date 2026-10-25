#!/usr/bin/env python3
"""Estrae e reimpacchetta il template della scheda (index.html è una "bundled page" di Claude Design).

  python tools/bundle.py extract            # index.html -> build/template.html
  python tools/bundle.py pack               # build/template.html -> index.html
  python tools/bundle.py check              # verifica che extract+pack restituisca un file identico

Il template sta in <script type="__bundler/template"> come stringa JSON.
La codifica deve restare: json.dumps(ensure_ascii=False) con '</' sostituito da '<\\u002F'.
"""
import json, re, sys, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
HTML = ROOT / "index.html"
TPL = ROOT / "build" / "template.html"
RX = re.compile(r'(<script type="__bundler/template">\n)(.*?)(\n  </script>)', re.S)

def encode(t: str) -> str:
    return json.dumps(t, ensure_ascii=False).replace("</", "<\\u002F")

def load():
    s = HTML.read_text(encoding="utf-8")
    m = RX.search(s)
    if not m:
        sys.exit("template non trovato in index.html")
    return s, m

def extract():
    s, m = load()
    TPL.parent.mkdir(exist_ok=True)
    TPL.write_text(json.loads(m.group(2)), encoding="utf-8")
    print(f"scritto {TPL.relative_to(ROOT)}")

def pack():
    s, m = load()
    t = TPL.read_text(encoding="utf-8")
    out = s[:m.start(2)] + encode(t) + s[m.end(2):]
    HTML.write_text(out, encoding="utf-8")
    print(f"aggiornato {HTML.name} ({len(out.encode())/1e6:.2f} MB)")

def check():
    s, m = load()
    ok = encode(json.loads(m.group(2))) == m.group(2)
    print("round-trip identico" if ok else "ATTENZIONE: la codifica non coincide")
    sys.exit(0 if ok else 1)

if __name__ == "__main__":
    {"extract": extract, "pack": pack, "check": check}.get((sys.argv[1:] or [""])[0], lambda: sys.exit(__doc__))()
