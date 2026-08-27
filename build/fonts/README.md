# Menu typeface

`IBMPlexSans-latin.woff2` is the menu's typeface (issue #1834). `BannerBuilder`
base64-encodes it at build time into the `@font-face` rule at the top of
`HHAuto.template.js`, so the shipped userscript carries the font itself and
loads nothing from a third-party host at runtime.

## Why embedded and not a Google Fonts link

The script runs inside the game page. A `<link>` to `fonts.googleapis.com`
would make every page load fetch from a third party, would send every user's
request there, and would be silently dropped if any of the game domains ever
sets a `font-src` Content-Security-Policy. A data URI has none of those
failure modes and shows the right font on the first paint, with no swap.

The cost is 45 KB of woff2, ~61 KB once base64-encoded, on a ~2 MB script.

## Why this exact file

It is the `latin` slice that Google Fonts serves for IBM Plex Sans v23,
**byte for byte unmodified**:

    https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600

    sha256  e2291e842cf5af167122a22881a740c7f2dda7716f1e8cd76680264f4a859470
    size    45712 bytes
    glyphs  270, variable, wght axis 100-700

Not re-subsetting it is deliberate. IBM Plex is under the SIL Open Font
License with the Reserved Font Name "Plex" (see `OFL.txt`): a *modified*
version may not keep that name, and subsetting counts as a modification.
Redistributing an unmodified copy is what the licence plainly allows, so the
file is passed through untouched and keeps its own name.

The `latin` slice (U+0000-00FF plus typographic punctuation) covers English,
German, Spanish and French, which is every language in `src/i18n/`. The
`latin-ext`, `greek`, `cyrillic` and `vietnamese` slices are not shipped;
anything outside the slice falls back to the system stack named in the CSS.

## Updating

Refetch the URL above with a browser user agent, drop the new woff2 in here,
and update the hash and size in this file. Do not run it through a subsetter.

## Licence

`OFL.txt` is IBM's licence file, copied from https://github.com/IBM/plex.
The OFL requires it to travel with the font; the userscript header points at
it, and this directory keeps the full text.
