import tinycss2, re, sys
def split_top(sel):
    out, d, cur = [], 0, ''
    for c in sel:
        if c in '([': d += 1
        if c in ')]': d -= 1
        if c == ',' and d == 0: out.append(cur); cur = ''
        else: cur += c
    out.append(cur); return [x.strip() for x in out if x.strip()]
def pref(s, strong):
    if s.startswith(':root'): return s
    if re.match(r'^html\b', s): return 'html:root' + s[4:]
    return (':root:root ' if strong else ':root ') + s
def process(css, strong):
    rules = tinycss2.parse_stylesheet(css, skip_comments=False, skip_whitespace=False)
    out = []
    for r in rules:
        if r.type == 'qualified-rule':
            sel = tinycss2.serialize(r.prelude).strip()
            body = tinycss2.serialize(r.content)
            is_vars = all(d.strip().startswith('--') or not d.strip() for d in body.split(';'))
            sels = split_top(sel)
            if not is_vars:
                sels = [pref(x, strong) for x in sels]
            else:
                # variable blocks also need to out-rank the app's own later blocks (except plain :root)
                sels = [x if x.startswith(':root') else pref(x, strong) for x in sels]
            out.append(',\n'.join(sels) + ' {' + body + '}')
        elif r.type == 'at-rule' and r.lower_at_keyword == 'media' and r.content is not None:
            out.append('@media ' + tinycss2.serialize(r.prelude).strip() + ' {\n' + process(tinycss2.serialize(r.content), strong) + '\n}')
        elif r.type == 'comment':
            out.append('/*' + r.value + '*/')
        elif r.type == 'whitespace':
            continue
        elif r.type == 'error':
            raise SystemExit('CSS parse error: ' + r.message)
        else:
            out.append(tinycss2.serialize([r]))
    return '\n'.join(out)
tokens = process(open('tokens.css').read(), True)
floor = process(open('typefloor.css').read(), False)
icons = open('icons.css').read()
header = "/* ReformDental UX layer. Built by build.py from tokens.css + typefloor.css + icons.css. Edit those, not this file. */\n"
css = header + tokens + '\n\n' + floor + '\n\n' + icons
# sanity: parse whole output
errs = [r for r in tinycss2.parse_stylesheet(css, skip_comments=True, skip_whitespace=True) if r.type == 'error']
if errs: raise SystemExit(f'errors: {errs[:3]}')
open('reform-ux.css', 'w').write(css)
print('reform-ux.css', len(css), 'bytes')
