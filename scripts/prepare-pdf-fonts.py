"""Maintainer-only asset preparation; normal builds and exports do not need Python.

Requires fonttools==4.68.0. Outputs are committed, licensed, self-hosted assets.
"""
import hashlib
import io
import json
from collections import defaultdict
from pathlib import Path
from urllib.request import urlopen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools import subset

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / 'public/fonts/pdf'
NOTO = 'https://raw.githubusercontent.com/notofonts/noto-fonts/ffebf8c1ee449e544955a7e813c54f9b73848eac/'
GOOGLE = 'https://raw.githubusercontent.com/google/fonts/cc39c4c2c304bc368c9b7c311ea2bcc6013299fe/'
sources = {}

def download(url):
    with urlopen(url, timeout=60) as response:
        data = response.read()
    sources[url] = hashlib.sha256(data).hexdigest()
    return data

DEST.mkdir(parents=True, exist_ok=True)
for family, styles in [('NotoSans', ['Regular', 'Bold', 'Italic', 'BoldItalic']),
                       ('NotoSerif', ['Regular', 'Bold', 'Italic', 'BoldItalic']),
                       ('NotoSansMono', ['Regular', 'Bold'])]:
    for style in styles:
        name = f'{family}-{style}.ttf'
        (DEST / name).write_bytes(download(NOTO + f'hinted/ttf/{family}/{name}'))
(DEST / 'LICENSE-OFL.txt').write_bytes(download(NOTO + 'LICENSE'))
(DEST / 'LICENSE-CJK.txt').write_bytes(download(GOOGLE + 'ofl/notosansjp/OFL.txt'))
font = TTFont(io.BytesIO(download(GOOGLE + 'ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf')), recalcTimestamp=False)
instantiateVariableFont(font, {'wght': 400}, inplace=True)
groups = defaultdict(list)
for codepoint in font.getBestCmap():
    groups[codepoint // 1024 * 1024].append(codepoint)
static = io.BytesIO()
font.save(static)
for start, points in sorted(groups.items()):
    part = TTFont(io.BytesIO(static.getvalue()), recalcTimestamp=False)
    options = subset.Options()
    options.layout_features = ['locl']
    worker = subset.Subsetter(options=options)
    worker.populate(unicodes=points)
    worker.subset(part)
    part.save(DEST / f'NotoSansJP-{start:05x}.ttf')
blocks = [f'{start:05x}' for start in sorted(groups)]
(ROOT / 'src/features/export/cjk-fonts.ts').write_text(
    '// Pre-subset Unicode blocks of the licensed Noto Sans JP font.\n'
    + 'export const cjkBlocks=new Set(' + json.dumps(blocks) + ');\n', encoding='utf-8')
manifest = {'tool': 'fonttools==4.68.0', 'sources': sources,
            'transform': 'Noto Sans JP: static weight 400, 1024-code-point blocks, locl feature; CJK blocks embedded without runtime subsetting.',
            'files': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(DEST.glob('*.ttf'))}}
(DEST / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print(f'Prepared {len(manifest["files"])} licensed PDF fonts.')
