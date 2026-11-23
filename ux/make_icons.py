"""Build icons.css: maps the app's Font Awesome class names onto Lucide icons (https://lucide.dev, ISC licence).
Needs: npm pack lucide-static (unpacked to ./lucide), pip install fonttools brotli tinycss2.
Usage: python3 make_icons.py fa_freq.txt   (fa_freq.txt = 'count fa-name' lines found in the app)"""
import json, base64, subprocess, sys, importlib.util
spec = importlib.util.spec_from_file_location('m', 'fa2lucide.py'); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
cp = m.cp
names = set(l.split()[1][3:] for l in open(sys.argv[1] if len(sys.argv) > 1 else 'fa_freq.txt')) | set(m.alias.keys())
rules = {}
for n in sorted(names):
    t = m.target(n)
    if t: rules.setdefault(t, []).append(n)
used = sorted(set(cp[t] for t in rules))
open('used_cp_lines.txt', 'w').write('\n'.join(f'U+{c:04X}' for c in used))
subprocess.run(['pyftsubset', 'lucide/package/font/lucide.woff2', '--unicodes-file=used_cp_lines.txt', '--flavor=woff2',
                '--output-file=rd-icons.woff2', '--layout-features=', '--drop-tables+=GSUB,GPOS,GDEF'], check=True)
b64 = base64.b64encode(open('rd-icons.woff2', 'rb').read()).decode()
out = ["/* ---- Icons: Lucide (ISC License, https://lucide.dev) mapped onto Font Awesome class names ---- */",
       "@font-face{font-family:'rd-lucide';src:url(data:font/woff2;base64,%s) format('woff2');font-display:block;font-weight:normal;font-style:normal}" % b64]
sel_all = []
for t, ns in sorted(rules.items()):
    out.append(','.join(f'.fa-{n}::before' for n in sorted(ns)) + f'{{content:"\\{cp[t]:x}"!important}}')
    sel_all += [f'.fa-{n}::before' for n in ns]
out.append(','.join(sel_all) + "{font-family:'rd-lucide'!important;font-weight:400!important;font-style:normal!important;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;line-height:1;vertical-align:-0.05em}")
open('icons.css', 'w').write('\n'.join(out) + '\n')
print('icons.css:', len(rules), 'Lucide glyphs for', len(sel_all), 'Font Awesome names')
