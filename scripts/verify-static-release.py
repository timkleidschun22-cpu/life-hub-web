import hashlib
import json
import re
import shutil
from pathlib import Path

source = json.loads(Path('release-source.json').read_text())
manifest = json.loads(Path('build-manifest.json').read_text())
if source.get('transport') != 'git-tree':
    raise SystemExit('Expected verified git-tree transport')
for key in ('sourceCommit', 'buildCommit', 'validatedSourceCommit'):
    if not re.fullmatch(r'[0-9a-f]{40}', source.get(key, '')):
        raise SystemExit('Invalid commit: ' + key)
for key in ('version', 'sourceCommit', 'webBuild'):
    if source.get(key) != manifest.get(key):
        raise SystemExit('Build provenance mismatch: ' + key)
files = manifest.get('files', {})
roots = {'index.html','manifest.json','metadata.json','life-hub-192.png','life-hub-512.png','sw.js'}
if not roots.issubset(files):
    raise SystemExit('Required static files missing')
actual = set()
for p in Path('site').rglob('*'):
    if p.is_symlink():
        raise SystemExit('Symlink rejected')
    if p.is_file():
        actual.add(p.relative_to('site').as_posix())
if actual != set(files):
    raise SystemExit('Unexpected or missing static files')
for name, digest in files.items():
    p = Path(name)
    if p.is_absolute() or '..' in p.parts or (name not in roots and p.parts[0] != '_expo'):
        raise SystemExit('Invalid public file path')
    if not re.fullmatch(r'[a-f0-9]{64}', digest):
        raise SystemExit('Invalid checksum')
    if hashlib.sha256((Path('site') / p).read_bytes()).hexdigest() != digest:
        raise SystemExit('Checksum mismatch: ' + name)
if Path('staging').exists():
    shutil.rmtree('staging')
shutil.copytree('site','staging')
print('Verified exact static file set, SHA-256 checksums and source provenance')
