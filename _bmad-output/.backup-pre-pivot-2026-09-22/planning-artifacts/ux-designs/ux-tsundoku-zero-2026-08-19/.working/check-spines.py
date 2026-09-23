# /// script
# requires-python = ">=3.10"
# dependencies = ["pyyaml"]
# ///
"""Verifica meccanica delle due spine UX: YAML, riferimenti token, contrasto, ID sorgente."""
import re, sys, pathlib, yaml

WS = pathlib.Path("_bmad-output/planning-artifacts/ux-designs/ux-tsundoku-zero-2026-08-19")
SRC = pathlib.Path("_bmad-output/planning-artifacts")

def split_fm(p):
    t = p.read_text(encoding="utf-8")
    if not t.startswith("---"):
        return None, t
    end = t.index("\n---", 3)
    return yaml.safe_load(t[3:end]), t[end + 4:]

design_fm, design_body = split_fm(WS / "DESIGN.md")
exp_fm, exp_body = split_fm(WS / "EXPERIENCE.md")

print("=" * 62)
print("1. YAML FRONTMATTER")
print("=" * 62)
for nm, fm in (("DESIGN.md", design_fm), ("EXPERIENCE.md", exp_fm)):
    print(f"  {nm}: parsato OK, {len(fm)} chiavi di primo livello -> {list(fm)}")

# ---- 2. risoluzione dei riferimenti {path.to.token} ----
def resolve(path, fm):
    cur = fm
    for part in path.split("."):
        if isinstance(cur, dict) and part in cur:
            cur = cur[part]
        else:
            return None
    return cur

REF = re.compile(r"\{([a-z][a-zA-Z0-9_.-]*\.[a-zA-Z0-9_.-]+)\}")
print()
print("=" * 62)
print("2. RIFERIMENTI TOKEN  {path.to.token}")
print("=" * 62)
bad = []
seen = set()
sources = [("DESIGN.md/body", design_body), ("EXPERIENCE.md/body", exp_body),
           ("DESIGN.md/components", yaml.dump(design_fm.get("components", {})))]
for where, text in sources:
    for m in REF.finditer(text):
        ref = m.group(1)
        if ref.startswith("planning_artifacts"):
            continue
        seen.add(ref)
        if resolve(ref, design_fm) is None:
            bad.append((where, ref))
print(f"  riferimenti distinti trovati: {len(seen)}")
if bad:
    print(f"  !! NON RISOLTI: {len(bad)}")
    for w, r in bad:
        print(f"     - {{{r}}}  ({w})")
else:
    print("  tutti risolvono contro DESIGN.md frontmatter  OK")

# ---- 3. contrasto WCAG ----
def lum(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]

def ratio(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)

C = design_fm["colors"]
pairs = [
    ("ink-primary su surface-base", "ink-primary", "surface-base", 4.5, "testo corpo"),
    ("ink-secondary su surface-base", "ink-secondary", "surface-base", 4.5, "etichette"),
    ("ink-muted su surface-base", "ink-muted", "surface-base", 4.5, "ATTRIBUZIONE 11px (AD-16)"),
    ("ink-muted su surface-raised", "ink-muted", "surface-raised", 4.5, "sync-indicator 13px"),
    ("surface-raised su accent", "surface-raised", "accent", 4.5, "button-primary"),
    ("accent su surface-base", "accent", "surface-base", 4.5, "link/testo accento"),
    ("danger su surface-base", "danger", "surface-base", 4.5, "errori FR1.5"),
    ("danger su danger-subtle", "danger", "danger-subtle", 4.5, "rating-button-again"),
    ("focus-ring su surface-base", "focus-ring", "surface-base", 3.0, "anello focus (non testo)"),
    ("border-strong su surface-base", "border-strong", "surface-base", 3.0, "confine rating-button"),
    ("border-strong su surface-raised", "border-strong", "surface-raised", 3.0, "confine su card"),
    ("accent su surface-sunken", "accent", "surface-sunken", 3.0, "progress-meter fill/track"),
    ("-- DARK --", None, None, 0, ""),
    ("ink-primary-dark su surface-base-dark", "ink-primary-dark", "surface-base-dark", 4.5, "testo corpo"),
    ("ink-secondary-dark su surface-base-dark", "ink-secondary-dark", "surface-base-dark", 4.5, "etichette"),
    ("ink-muted-dark su surface-base-dark", "ink-muted-dark", "surface-base-dark", 4.5, "ATTRIBUZIONE 11px"),
    ("ink-muted-dark su surface-raised-dark", "ink-muted-dark", "surface-raised-dark", 4.5, "attribuzione su card"),
    ("accent-dark su surface-base-dark", "accent-dark", "surface-base-dark", 4.5, "link/testo accento"),
    ("danger-dark su surface-base-dark", "danger-dark", "surface-base-dark", 4.5, "errori"),
    ("danger-dark su danger-subtle-dark", "danger-dark", "danger-subtle-dark", 4.5, "rating-again"),
    ("focus-ring-dark su surface-base-dark", "focus-ring-dark", "surface-base-dark", 3.0, "anello focus"),
    ("border-strong-dark su surface-base-dark", "border-strong-dark", "surface-base-dark", 3.0, "confine"),
    ("border-strong-dark su surface-raised-dark", "border-strong-dark", "surface-raised-dark", 3.0, "confine su card"),
]
print()
print("=" * 62)
print("3. CONTRASTO WCAG 2.2 AA  (soglia dichiarata in EXPERIENCE.md)")
print("=" * 62)
fails = []
for label, a, b, need, note in pairs:
    if a is None:
        print(f"\n  {label}")
        continue
    r = ratio(C[a], C[b])
    ok = r >= need
    flag = "OK  " if ok else "FAIL"
    if not ok:
        fails.append((label, r, need, note))
    print(f"  [{flag}] {r:5.2f}:1  (min {need})  {label:44s} {note}")

# ---- 4. ID citati vs documenti sorgente ----
print()
print("=" * 62)
print("4. ID CITATI  (FRn.n / NFRn / ADn / Mn) ESISTONO NEI SORGENTI?")
print("=" * 62)
prd = (SRC / "prds/prd-tsundoku-zero-2026-08-19/prd.md").read_text(encoding="utf-8")
arch = (SRC / "architecture/architecture-tsundoku-zero-2026-08-19/ARCHITECTURE-SPINE.md").read_text(encoding="utf-8")
add = (SRC / "prds/prd-tsundoku-zero-2026-08-19/addendum.md").read_text(encoding="utf-8")
corpus = prd + arch + add

ID = re.compile(r"\b(FR\d+\.\d+|NFR\d+|AD-\d+|M\d\b|CM\d\b|F\d\b|OQ-\d+)")
cited = sorted(set(ID.findall(design_body)) | set(ID.findall(exp_body)))
missing = [i for i in cited if i not in corpus]
print(f"  ID distinti citati nelle spine: {len(cited)}")
if missing:
    print(f"  !! NON TROVATI nei sorgenti: {missing}")
else:
    print("  tutti presenti nei documenti sorgente  OK")

print()
print("=" * 62)
print("ESITO")
print("=" * 62)
print(f"  riferimenti token non risolti : {len(bad)}")
print(f"  coppie di contrasto sotto soglia: {len(fails)}")
print(f"  ID inesistenti                 : {len(missing)}")
for label, r, need, note in fails:
    print(f"    -> {label}: {r:.2f}:1, serve {need}  [{note}]")
