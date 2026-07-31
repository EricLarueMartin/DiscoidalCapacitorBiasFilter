# Locale catalogs

The web interface loads one UTF-8 JSON catalog per language before it
initializes the controls, tooltips, drawings, and slide deck.

Each catalog contains:

- `meta`: language metadata for maintainers.
- `text`: short interface strings and dynamic labels.
- `slides`: complete rich-text blocks used in the slide deck.
- `content`: rich-text captions and metric labels outside the deck.
- `tooltips`: parameter descriptions keyed by HTML control ID.
- `canvas`: exact strings drawn on canvases.
- `canvasReplacements`: ordered substitutions for canvas labels containing
  calculated values.

English text in the HTML and JavaScript is the source key and the fallback.
Preserve source keys exactly. Values in `slides` and `content` may contain
HTML such as `<sub>` and `<strong>`; formulas and tags should be retained in
translations.

To add a language, copy a catalog, translate its values, add its language code
to `LOCALE_LANGUAGES` in `app.js`, and add an `<option>` to `languageSelect` in
`index.html`.
