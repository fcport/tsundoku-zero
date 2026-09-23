# /// script
# requires-python = ">=3.10"
# ///
"""Prototipo dell'allineamento furigana: strip dei kana comuni + group ruby sul nucleo."""

def is_kana(ch):
    o = ord(ch)
    return 0x3040 <= o <= 0x309F or 0x30A0 <= o <= 0x30FF or ch == "ー"

def align(kanji, kana):
    """-> lista di (testo, ruby|None)."""
    if not kanji or kanji == kana:
        return [(kana, None)]

    p = 0
    while p < len(kanji) and p < len(kana) and kanji[p] == kana[p] and is_kana(kanji[p]):
        p += 1

    s = 0
    while (s < len(kanji) - p and s < len(kana) - p
           and kanji[len(kanji) - 1 - s] == kana[len(kana) - 1 - s]
           and is_kana(kanji[len(kanji) - 1 - s])):
        s += 1

    prefix = kanji[:p]
    core = kanji[p:len(kanji) - s]
    suffix = kanji[len(kanji) - s:] if s else ""
    reading = kana[p:len(kana) - s]

    out = []
    if prefix:
        out.append((prefix, None))
    if core:
        out.append((core, reading if reading else None))
    if suffix:
        out.append((suffix, None))
    return out

def render(segs):
    return "".join(f"{t}({r})" if r else t for t, r in segs)

CASES = [
    # (kanji, kana, atteso)
    ("駅",       "えき",       "駅(えき)"),
    ("難しい",   "むずかしい", "難(むずか)しい"),
    ("新しい",   "あたらしい", "新(あたら)しい"),
    ("食べる",   "たべる",     "食(た)べる"),
    ("話す",     "はなす",     "話(はな)す"),
    ("行く",     "いく",       "行(い)く"),
    ("お茶",     "おちゃ",     "お茶(ちゃ)"),
    ("お金",     "おかね",     "お金(かね)"),
    ("一人",     "ひとり",     "一人(ひとり)"),     # jukujikun: group ruby, non separabile
    ("大人",     "おとな",     "大人(おとな)"),     # jukujikun
    ("今日",     "きょう",     "今日(きょう)"),     # jukujikun
    ("勉強",     "べんきょう", "勉強(べんきょう)"),
    ("日本語",   "にほんご",   "日本語(にほんご)"),
    ("小さい",   "ちいさい",   "小(ちい)さい"),
    ("見せる",   "みせる",     "見(み)せる"),
    ("引っ越し", "ひっこし",   "引っ越(ひっこ)し"),  # limite noto: っ finisce nel nucleo
    (None,       "ください",   "ください"),          # solo kana, nessun ruby
    ("",         "そして",     "そして"),
    ("ラーメン", "ラーメン",   "ラーメン"),          # identici -> nessun ruby
]

print(f"{'kanji':10} {'kana':12} {'reso':22} {'atteso':22} esito")
print("-" * 78)
fails = 0
for kanji, kana, expected in CASES:
    got = render(align(kanji, kana))
    ok = got == expected
    if not ok:
        fails += 1
    print(f"{(kanji or '-'):10} {kana:12} {got:22} {expected:22} {'OK' if ok else 'FAIL'}")

print("-" * 78)
print(f"{len(CASES) - fails}/{len(CASES)} corretti, {fails} falliti")
