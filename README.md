# &lt;MY&gt;SPACE — Desktop Web App

A desktop-like environment in the browser, built with Flask, Jinja2, vanilla
JavaScript, and Tailwind CSS. Drag icons around, open windows from the taskbar
and start menu, and use the simulated terminal. Desktop icon positions persist
in a JSON file on the server.

> Demo, honestly labeled: folder contents are fixed mock data, the calculator
> and browser windows are visual only, the notepad does not save, and there is
> no login or user account. The terminal is simulated (`help`, `clear`, `date`,
> `echo`, `ls`, `pwd` only) and runs nothing on the server.

## Quick start

```bash
python -m venv .venv
.venv/Scripts/activate
pip install -r requirements.txt
python app.py
```

Open http://127.0.0.1:5001. No Node.js step is needed to run it:
`static/css/output.css` is a committed build artifact. Node is only needed to
rebuild that CSS after changing templates, JavaScript, or `static/css/input.css`.

```bash
npm ci
npm run build-css
```

Configuration lives in the environment (copy `.env.example` to `.env` to
override): `SECRET_KEY`, `FLASK_DEBUG`, `HOST` (default `127.0.0.1`), and
`PORT` (default `5001`).

## Static preview

```bash
npm run build
```

This builds the CSS and freezes the app into `build/` with Frozen-Flask.
Only the desktop page and one example folder view are frozen; the JSON API
is excluded on purpose, so in the static preview drag-to-move and
new-folder actions have no server to persist to.

## What works

- Desktop icons render at their stored `x`/`y` positions from
  `data/desktop_items.json`. Dragging an icon posts the new position and
  saves it; right-click → Sort by Name re-grids icons and saves the result.
- Right-click → New Folder creates a real desktop item via the API.
- Windows can be dragged, minimized, maximized, closed, and focused from
  the taskbar. Double-click a folder for the folder modal; double-click an
  app icon to open its window.
- The taskbar clock polls `GET /api/time`. Clicking it opens a calendar
  window showing the current date and time.

## API endpoints

| Method | Endpoint | Body / notes |
| --- | --- | --- |
| `GET` | `/` | Desktop view, icons at stored positions |
| `GET` | `/api/items` | Desktop items as JSON |
| `POST` | `/api/items` | `{"name": str, "type": "folder" \| "app"}` → `201` |
| `POST` | `/api/items/<id>/move` | `{"x": number, "y": number}` → `{"success": true}` |
| `GET` | `/api/time` | `{"time": ..., "date": ...}` |
| `GET` | `/folder/<path>` | Full-page folder view (fixed demo contents) |

Move and create payloads are validated server-side: non-JSON bodies,
missing or non-numeric coordinates, empty names, and unknown types return
`400`, and a rejected request never touches the data file. Saves are
atomic (temp file + rename), and a missing or malformed data file fails
loud with a `500` instead of rendering a broken desktop.

Desktop item shape: `{"id": int, "name": str, "type": "folder" | "app",
"icon": str, "x": number, "y": number}`.

## Project structure

```
spaces-web-app/
├── app.py                  # Flask app factory, validated API, atomic JSON store
├── freeze.py               # Frozen-Flask config: index + one folder view only
├── requirements.txt        # Pinned runtime dependencies (Flask 3)
├── package.json            # Tailwind CSS build scripts (dev only)
├── tailwind.config.js      # Tailwind config
├── data/
│   └── desktop_items.json  # Desktop items and their stored positions
├── templates/
│   ├── index.html          # Desktop, taskbar, start menu, folder modal
│   └── folder.html         # Full-page folder view
├── static/
│   ├── css/
│   │   ├── input.css       # Tailwind directives + custom styles (source)
│   │   └── output.css      # Built CSS (committed; rebuild with npm run build-css)
│   └── js/
│       └── desktop.js      # The only frontend script: windows, drag, terminal
└── tests/
    └── test_app.py         # API, validation, and freeze-excludes-API tests
```

## Customization

**Add an application:** add a start-menu tile in `templates/index.html`,
then add a `case` in `getWindowContent(type, windowId)` in
`static/js/desktop.js`. Escape any item-derived text with the existing
`escapeHtml` helper before interpolating it into window markup, and put
user-supplied text through `textContent`, never `innerHTML`.

**Add a desktop item:** use `POST /api/items`, or edit
`data/desktop_items.json` directly (keep the shape above; positions are in
pixels from the top-left of the desktop).

**Styling:** Tailwind utility classes in templates and JavaScript, plus
custom rules in `static/css/input.css`. Rebuild with `npm run build-css`
and commit the regenerated `output.css`; CI fails if the committed CSS is
stale.

## Tests

```bash
pip install -r requirements.txt pytest ruff
ruff check .
pytest
node --check static/js/desktop.js
```

CI runs the same gates, plus a CSS-freshness check and a freeze smoke
test that asserts no `build/api/` directory is produced.

## Stack

Python 3.11+, Flask 3, Frozen-Flask, python-dotenv, Tailwind CSS 3,
vanilla JavaScript. No database, no accounts, no external requests at
runtime: the pages load no CDN or third-party assets.

## License

MIT — see [LICENSE](LICENSE).
