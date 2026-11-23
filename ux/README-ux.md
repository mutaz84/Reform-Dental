# ReformDental UX layer

`reform-ux.css` and `reform-ux.js` (repo root) give the whole app one look: Inter type scale with a 12px minimum, one teal brand colour, consistent buttons, form fields, borders and radii, and Lucide line icons in place of Font Awesome glyphs. They are loaded by the main HTML right after `reform-main.css` and Font Awesome.

Sources (edit these, then rebuild):

- `tokens.css`: design tokens and component styles (buttons, fields, cards, badges, danger zone)
- `typefloor.css`: generated; raises every app rule that set text below 12px to 12px
- `fa2lucide.py` + `make_icons.py`: Font Awesome → Lucide mapping and icon font subset (icons.css)
- `build.py`: combines tokens.css + typefloor.css + icons.css into `../reform-ux.css`, adding `:root` prefixes so the rules win over styles the app injects later

Rebuild: `python3 make_icons.py fa_freq.txt && python3 build.py && cp reform-ux.css ..`

`reform-ux.js` (behaviour, no data access): Esc closes the top form or dialog (asks first if you changed something), pins Save/Cancel rows on long forms, hides count badges that read 0 and turns overdue counts red, raises inline text below 12px, maps hard-coded inline colours onto the palette (skipping calendars and colour pickers), keeps text clear of icons inside inputs, and moves Reset Data from the gear menu into Master Settings with a typed RESET confirmation.
